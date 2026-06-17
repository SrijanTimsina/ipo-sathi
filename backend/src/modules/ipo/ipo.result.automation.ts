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
  const updatedRecords = [];

  // 1. Fetch real allotment status for ALL users who applied
  for (const account of allAccounts) {
    const record = await ipoRepo.findByAccountAndIpo(account.id, ipo.companyShareId);
    if (!record) continue; // Didn't even try to apply
    if (record.status === 'error') {
       updatedRecords.push(record);
       continue; // It failed initially, no need to check result
    }

    try {
      const accClient = new MeroShareClient();
      const accToken = await accClient.authenticate(account);
      const accReport = await accClient.getApplicationReport(accToken);
      const accApp = accReport.find((app) => String(app.companyShareId) === ipo.companyShareId);
      
      if (accApp) {
        const detail = await accClient.getApplicationDetail(accToken, accApp.applicantFormId);
        let finalStatus = record.status;
        
        if (detail.statusName === "Alloted" || (detail.receivedKitta ?? 0) > 0) {
          finalStatus = "allotted";
        } else if (detail.statusName === "Not Alloted" || (detail.statusDescription === "TRANSACTION SUCCESS" && (detail.receivedKitta ?? 0) === 0)) {
          finalStatus = "not_allotted";
        }

        if (record.status !== finalStatus) {
           await ipoRepo.updateStatus(record.id, finalStatus as any);
           record.status = finalStatus as any;
        }
      }
    } catch (err) {
      console.error(`[ResultAutomation] Failed to fetch result for account ${account.username}`, err);
    }
    
    updatedRecords.push(record);
    // Add a small delay between accounts to prevent IP blocks
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 2. Group by User ID and send notifications
  // We can just build the map from allAccounts
  const accountMap = new Map(allAccounts.map((a) => [a.id, a.name || a.username]));

  const uniqueUserIds = [...new Set(updatedRecords.map(r => r.userId))];
  
  for (const userId of uniqueUserIds) {
    const user = await usersRepo.findById(userId);
    if (!user || !user.mobileNumber) continue;

    const userApps = updatedRecords.filter(r => r.userId === userId);
    if (userApps.length > 0) {
       await ipoNotificationService.notifyResult(user.mobileNumber, ipo.companyName, userApps, accountMap);
    }
  }

  // 3. Mark as published in DB
  await ipoRepo.markResultPublished(ipo.companyShareId);
  console.info(`[ResultAutomation] Successfully processed and notified for ${ipo.companyName}`);
}
