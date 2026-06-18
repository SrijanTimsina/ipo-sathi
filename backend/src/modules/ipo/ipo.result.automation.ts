import { accountsService } from "../accounts/accounts.service.js";
import { accountsRepo } from "../accounts/accounts.repo.js";
import { MeroShareClient } from "./ipo.meroshare.client.js";
import { ipoRepo } from "./ipo.repo.js";
import { ipoNotificationService } from "./ipo.notification.service.js";
import { usersRepo } from "../users/users.repo.js";
import { config } from "../../config/index.js";

export async function checkIpoResults() {
  console.info("[ResultAutomation] Starting IPO Result Check...");

  // 1. Fetch unpublished IPOs that have already closed
  const unpublishedIpos = await ipoRepo.findUnpublishedIpos();
  const now = new Date();
  
  const iposToCheck = unpublishedIpos.filter(ipo => 
    ipo.issueCloseDate && ipo.issueCloseDate < now
  );

  if (iposToCheck.length === 0) {
    console.info("[ResultAutomation] No closed, unpublished IPOs to check.");
    return { success: true, message: "No IPOs to check." };
  }

  // 2. Fetch reference account
  const refUsername = config.meroshare.referenceAccountUsername;
  if (!refUsername) {
    console.error("[ResultAutomation] REFERENCE_ACCOUNT_USERNAME not set in config.");
    return { error: "Configuration missing" };
  }

  const refAccount = await accountsRepo.findByUsername(refUsername);
  if (!refAccount) {
    console.error(`[ResultAutomation] Reference account ${refUsername} not found.`);
    return { error: "Reference account not found" };
  }

  const decryptedRefAccount = await accountsService.getOwnAccount(refAccount.userId, refAccount.id);
  const client = new MeroShareClient();
  let token: string;

  try {
    token = await client.authenticate(decryptedRefAccount);
  } catch (error) {
    console.error("[ResultAutomation] Failed to authenticate reference account", error);
    return { error: "Failed to authenticate reference account" };
  }

  // 3. Get application report for the reference account
  let report;
  try {
    report = await client.getApplicationReport(token);
  } catch (error) {
    console.error("[ResultAutomation] Failed to get application report for reference account", error);
    return { error: "Failed to fetch report" };
  }

  for (const ipo of iposToCheck) {
    console.info(`[ResultAutomation] Checking result for IPO: ${ipo.companyName} (${ipo.companyShareId})`);
    
    // Find this IPO in the reference account's report
    const existingApp = report.find((app) => String(app.companyShareId) === ipo.companyShareId);
    
    if (!existingApp) {
      console.warn(`[ResultAutomation] Reference account did not apply for ${ipo.companyName}. Cannot check result.`);
      continue;
    }

    try {
      const detail = await client.getApplicationDetail(token, existingApp.applicantFormId);
      
      // If the status is Alloted or Not Alloted, the result is published!
      const isPublished = detail.statusName === "Alloted" || detail.statusName === "Not Alloted";
      
      if (isPublished) {
        console.info(`[ResultAutomation] 🚀 Result is PUBLISHED for ${ipo.companyName}!`);
        await processPublishedIpo(ipo);
      } else {
        console.info(`[ResultAutomation] Result not yet published for ${ipo.companyName} (Current Status: ${detail.statusName})`);
      }
    } catch (err) {
      console.error(`[ResultAutomation] Error checking detail for ${ipo.companyName}:`, err);
    }
  }

  console.info("[ResultAutomation] Completed IPO Result Check.");
  return { success: true };
}

async function processPublishedIpo(ipo: any) {
  const allAccounts = await accountsService.getAllActiveDecryptedAccounts();
  const userLiveApps = new Map<string, any[]>();

  // 1. Fetch real allotment status for ALL users who applied
  for (const account of allAccounts) {
    if (!userLiveApps.has(account.userId)) userLiveApps.set(account.userId, []);

    try {
      const accClient = new MeroShareClient();
      const accToken = await accClient.authenticate(account);
      const accReport = await accClient.getApplicationReport(accToken);
      const accApp = accReport.find((app) => String(app.companyShareId) === ipo.companyShareId);
      
      let finalStatus: any = "pending";
      let errorMsg: string | null = null;
      let quantity: number | undefined;

      if (accApp) {
        const detail = await accClient.getApplicationDetail(accToken, accApp.applicantFormId);
        
        if (detail.statusName === "Alloted" || (detail.receivedKitta ?? 0) > 0) {
          finalStatus = "allotted";
          quantity = detail.receivedKitta ?? detail.appliedKitta;
        } else if (detail.statusName === "Not Alloted" || (detail.statusDescription === "TRANSACTION SUCCESS" && (detail.receivedKitta ?? 0) === 0)) {
          finalStatus = "not_allotted";
          quantity = 0;
        } else if (detail.statusName === "Rejected" || accApp.statusName === "BLOCK_FAILED") {
          finalStatus = "error";
          errorMsg = detail.reason || "Block failed";
        } else if (detail.statusName === "Verified") {
          finalStatus = "applied";
        }
      }

      userLiveApps.get(account.userId)!.push({
        brokerAccountId: account.id,
        accountName: account.name || account.username,
        isVerified: finalStatus === "applied" || finalStatus === "allotted" || finalStatus === "not_allotted",
        isRejected: finalStatus === "error",
        errorMessage: errorMsg,
        status: finalStatus,
        quantity,
      });

    } catch (err) {
      console.error(`[ResultAutomation] Failed to fetch result for account ${account.username}`, err);
    }
    
    // Add a small delay between accounts to prevent IP blocks
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 2. Group by User ID and send notifications
  for (const [userId, liveApps] of userLiveApps.entries()) {
    if (liveApps.length > 0) {
      await ipoNotificationService.notifyResultForUserLive(userId, ipo.companyName, liveApps);
    }
  }

  // 3. Mark as published in DB
  await ipoRepo.markResultPublished(ipo.companyShareId);
  console.info(`[ResultAutomation] Successfully processed and notified for ${ipo.companyName}`);
}
