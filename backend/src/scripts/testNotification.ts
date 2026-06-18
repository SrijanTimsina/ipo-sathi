import "../config/index.js";
import { accountsService } from "../modules/accounts/accounts.service.js";
import { ipoRepo } from "../modules/ipo/ipo.repo.js";
import { MeroShareClient } from "../modules/ipo/ipo.meroshare.client.js";
import { ipoNotificationService } from "../modules/ipo/ipo.notification.service.js";
import { config } from "../config/index.js";

async function testUserStatus() {
  const userId = process.env.TEST_ACCOUNT_ID;
  if (!userId) {
    console.error("❌ TEST_ACCOUNT_ID not found in environment variables.");
    process.exit(1);
  }

  console.log(`🚀 Starting status check and notification test for user: ${userId}`);

  const accounts = await accountsService.getDecryptedAccountsForUser(userId);
  if (accounts.length === 0) {
    console.log("❌ No active accounts found for this user.");
    process.exit(0);
  }

  console.log(`✅ Found ${accounts.length} accounts. Checking unpublished IPOs...`);
  const unpublishedIpos = await ipoRepo.findUnpublishedIpos();

  for (const ipo of unpublishedIpos) {
    console.log(`\n📊 Checking IPO: ${ipo.companyName} (${ipo.companyShareId})`);
    
    // 1. Fetch real status from MeroShare
    const liveApps = [];
    for (const account of accounts) {
      try {
        const client = new MeroShareClient();
        const token = await client.authenticate(account);
        const report = await client.getApplicationReport(token);
        
        const existingApp = report.find((a) => a.companyShareId === Number(ipo.companyShareId));
        
        let finalStatus: any = "pending";
        let isVerified = false;
        let isRejected = false;
        let errorMsg: string | null = null;

        if (existingApp) {
          const detail = await client.getApplicationDetail(token, existingApp.applicantFormId);
          isVerified = detail.statusName === "Verified";
          isRejected = detail.statusName === "Rejected" || existingApp.statusName === "BLOCK_FAILED";
          
          if (isRejected) {
            finalStatus = "error";
            errorMsg = detail.reason || "Block failed / Rejected";
          } else if (detail.statusName === "Alloted" || (detail.receivedKitta ?? 0) > 0) {
            finalStatus = "allotted";
          } else if (
            detail.statusName === "Non-Alloted" ||
            detail.statusName === "Not Alloted" ||
            (detail.stageName === "ALLOTMENT_RESULT_APPROVED" && (detail.receivedKitta ?? 0) === 0) ||
            ((detail.meroshareRemark || detail.reasonOrRemark)?.toLowerCase().includes("release") && (detail.receivedKitta ?? 0) === 0)
          ) {
            finalStatus = "not_allotted";
          } else if (isVerified) {
            finalStatus = "applied";
          } else if (existingApp.statusName === "TRANSACTION_SUCCESS") {
            finalStatus = "applied";
          } else {
            finalStatus = "pending";
          }
          console.log(`   ✔️ ${account.username} is ${finalStatus}`);
        } else {
           console.log(`   ⚠️ ${account.username} has not applied yet.`);
        }

        liveApps.push({
          brokerAccountId: account.id,
          accountName: account.name || account.username,
          isVerified,
          isRejected,
          errorMessage: errorMsg,
          status: finalStatus,
        });

      } catch (err: any) {
        console.error(`   ❌ Error checking ${account.username}:`, err.message);
      }
    }

    // 2. Force reset notification status for testing so evaluateAndNotify definitely triggers!
    console.log(`\n🔔 Resetting notification statuses for testing...`);
    // Delete existing notification state for this IPO so it triggers Rule 1
    const { db } = await import("../shared/db/index.js");
    const { ipoNotifications } = await import("../modules/ipo/ipo.schema.js");
    const { eq, and } = await import("drizzle-orm");
    await db.delete(ipoNotifications).where(
      and(eq(ipoNotifications.userId, userId), eq(ipoNotifications.ipoId, String(ipo.companyShareId)))
    );

    // 3. Evaluate and send notification
    console.log(`📨 Triggering evaluateAndNotifyLive...`);
    await ipoNotificationService.evaluateAndNotifyLive(
      userId,
      String(ipo.companyShareId),
      ipo.companyName,
      liveApps as any,
      accounts,
      ipo.issueOpenDate?.toISOString(),
      ipo.issueCloseDate?.toISOString()
    );
    console.log(`✅ Notification logic executed for ${ipo.companyName}`);
  }

  console.log("\n🎉 Done.");
  process.exit(0);
}

void testUserStatus();
