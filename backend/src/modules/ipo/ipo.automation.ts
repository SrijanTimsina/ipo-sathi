import { accountsService } from "../accounts/accounts.service.js";
import { accountsRepo } from "../accounts/accounts.repo.js";
import { MeroShareClient } from "./ipo.meroshare.client.js";
import { applyForAccount, reapplyForAccount } from "./ipo.service.js";
import { ipoRepo } from "./ipo.repo.js";
import { ipoNotificationService } from "./ipo.notification.service.js";
import { config } from "../../config/index.js";

export async function runIpoAutomation() {
  console.info("Starting IPO Automation process...");

  // 1. Fetch reference account
  const refUsername = config.meroshare.referenceAccountUsername;
  if (!refUsername) {
    console.error("REFERENCE_ACCOUNT_USERNAME not set in config.");
    return { error: "Configuration missing" };
  }

  const refAccount = await accountsRepo.findByUsername(refUsername);
  if (!refAccount) {
    console.error(`Reference account ${refUsername} not found. Automation aborted.`);
    return { error: "Reference account not found" };
  }

  const decryptedRefAccount = await accountsService.getOwnAccount(refAccount.userId, refAccount.id);

  // 2. Fetch open IPOs using reference account
  const client = new MeroShareClient();
  let applicableIssues;
  try {
    const token = await client.authenticate(decryptedRefAccount);
    applicableIssues = await client.getApplicableIpos(token);
  } catch (error) {
    console.error("Failed to authenticate reference account or fetch IPOs", error);
    return { error: "Failed to fetch IPOs with reference account" };
  }

  if (applicableIssues.length === 0) {
    console.info("No open IPOs available. Automation completed.");
    return { success: true, message: "No open IPOs available." };
  }

  // 3. Fetch all active accounts
  const allAccounts = await accountsService.getAllActiveDecryptedAccounts();
  console.info(`Found ${allAccounts.length} active accounts to process for ${applicableIssues.length} open IPO(s).`);

  let totalApplications = 0;
  let successfulApplications = 0;
  let failedApplications = 0;

  // 4. Process each IPO
  for (const ipo of applicableIssues) {
    console.info(`[Automation] Processing IPO: ${ipo.companyName} (${ipo.companyShareId})`);

    await ipoRepo.upsertIpo({
      companyShareId: String(ipo.companyShareId),
      companyName: ipo.companyName,
      issueOpenDate: ipo.issueOpenDate ? new Date(ipo.issueOpenDate) : null,
      issueCloseDate: ipo.issueCloseDate ? new Date(ipo.issueCloseDate) : null,
    });

    // We process each account sequentially to respect rate limits
    for (const account of allAccounts) {
      // Create or fetch the record for this account and IPO
      let record = await ipoRepo.findByAccountAndIpo(account.id, String(ipo.companyShareId));
      if (!record) {
        record = await ipoRepo.createApplication({
          userId: account.userId,
          brokerAccountId: account.id,
          ipoId: String(ipo.companyShareId),
          ipoName: ipo.companyName,
          status: "pending",
        });
      }

      try {
        const accClient = new MeroShareClient();
        const accToken = await accClient.authenticate(account);
        
        // Check current status directly
        const report = await accClient.getApplicationReport(accToken);
        const existingApp = report.find((app) => app.companyShareId === ipo.companyShareId);

        if (!existingApp) {
          // Not applied yet.
          if (account.autoApply) {
             console.info(`[Automation] Account ${account.username} - Applying for ${ipo.companyName}`);
             await applyForAccount(account, { companyShareId: ipo.companyShareId, ipoName: ipo.companyName, kittas: 10 }, record.id);
             await ipoRepo.updateStatus(record.id, "pending");
             successfulApplications++;
          } else {
             // Auto apply disabled
             if (record.status !== "error") {
               await ipoRepo.updateStatus(record.id, "error", "Auto-apply disabled");
             }
          }
        } else {
          // Already applied, get detail to know exact verification status
          const detail = await accClient.getApplicationDetail(accToken, existingApp.applicantFormId);
          const isVerified = detail.statusName === "Verified";
          const isRejected = detail.statusName === "Rejected" || existingApp.statusName === "BLOCK_FAILED";
          
          if (isRejected && account.autoReApply) {
             console.info(`[Automation] Account ${account.username} - Re-applying for ${ipo.companyName} due to rejection`);
             await reapplyForAccount(account, existingApp.applicantFormId);
             await ipoRepo.updateStatus(record.id, "pending");
             successfulApplications++;
          } else {
             // either already verified/pending, or autoReApply is false
             let finalStatus = record.status;
             let errorMsg = record.errorMessage;
             
             if (isVerified) {
               finalStatus = "applied";
               errorMsg = null;
             } else if (isRejected) {
               finalStatus = "error";
               errorMsg = detail.reason || "Block failed / Rejected";
             } else if (detail.statusName === "Alloted" || (detail.receivedKitta ?? 0) > 0) {
               finalStatus = "allotted";
             } else if (detail.statusDescription === "TRANSACTION SUCCESS" && (detail.receivedKitta ?? 0) === 0) {
               finalStatus = "not_allotted";
             } else {
               finalStatus = "pending";
               errorMsg = null;
             }

             if (record.status !== finalStatus || record.errorMessage !== errorMsg) {
                 await ipoRepo.updateStatus(record.id, finalStatus as any, errorMsg || undefined);
             }
             console.debug(`[Automation] Account ${account.username} - Already applied for ${ipo.companyName} (status: ${detail.statusName})`);
          }
        }
        totalApplications++;
      } catch (err: unknown) {
         failedApplications++;
         const message = err instanceof Error ? err.message : "Unknown error";
         if (message === "Already applied to this IPO") {
            await ipoRepo.updateStatus(record.id, "pending", "Skipped: Already applied");
         } else {
            await ipoRepo.updateStatus(record.id, "error", message);
            console.error(`[Automation] Account ${account.username} failed to apply for ${ipo.companyName}: ${message}`);
         }
      }

      // Add a small delay between accounts to prevent IP blocks
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Evaluate notifications for this IPO
    const uniqueUserIds = [...new Set(allAccounts.map(a => a.userId))];
    for (const userId of uniqueUserIds) {
      await ipoNotificationService.evaluateAndNotify(userId, String(ipo.companyShareId), ipo.companyName, ipo.issueOpenDate, ipo.issueCloseDate);
    }
  }

  console.info(`[Automation] Completed. Processed ${totalApplications} attempts. Successful: ${successfulApplications}, Failed: ${failedApplications}`);
  return {
    success: true,
    totalProcessed: totalApplications,
    successful: successfulApplications,
    failed: failedApplications
  };
}
