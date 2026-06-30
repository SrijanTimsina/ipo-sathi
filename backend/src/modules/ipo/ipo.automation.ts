import { accountsService } from "../accounts/accounts.service.js";
import { accountsRepo } from "../accounts/accounts.repo.js";
import { MeroShareClient, MeroShareIpo } from "./ipo.meroshare.client.js";
import { applyForAccount, reapplyForAccount } from "./ipo.service.js";
import { ipoRepo } from "./ipo.repo.js";
import {
  ipoNotificationService,
  type LiveApplicationStatus,
} from "./ipo.notification.service.js";
import { config } from "../../config/index.js";
import { usersRepo } from "../users/users.repo.js";

export async function runIpoAutomation(options?: {
  testAccountId?: string;
  isMorningCron?: boolean;
  isEveningCron?: boolean;
}) {
  const { testAccountId, isMorningCron, isEveningCron } = options || {};
  console.info("Starting IPO Automation process...");

  // 1. Fetch reference account
  const refUsername = config.meroshare.referenceAccountUsername;
  if (!refUsername) {
    console.error("REFERENCE_ACCOUNT_USERNAME not set in config.");
    return { error: "Configuration missing" };
  }

  const refAccount = await accountsRepo.findByUsername(refUsername);
  if (!refAccount) {
    console.error(
      `Reference account ${refUsername} not found. Automation aborted.`,
    );
    return { error: "Reference account not found" };
  }

  const decryptedRefAccount = await accountsService.getOwnAccount(
    refAccount.userId,
    refAccount.id,
  );

  // 2. Fetch open IPOs using reference account
  const client = new MeroShareClient();
  let applicableIssues: MeroShareIpo[] = [];
  let issueDetails = new Map<number, any>();
  try {
    const token = await client.authenticate(decryptedRefAccount);
    const allIpos = await client.getApplicableIpos(token);
    applicableIssues = allIpos.filter(
      (ipo) =>
        ipo.shareTypeName === "IPO" &&
        ipo.shareGroupName === "Ordinary Shares" &&
        ipo.subGroup === "For General Public",
    );
    for (const issue of applicableIssues) {
      try {
        const detail = await client.getIpoDetail(token, issue.companyShareId);
        issueDetails.set(issue.companyShareId, detail);
      } catch (err) {
        console.error(`Failed to fetch detail for ${issue.companyShareId}`);
      }
    }
  } catch (error) {
    console.error(
      "Failed to authenticate reference account or fetch IPOs",
      error,
    );
    return { error: "Failed to fetch IPOs with reference account" };
  }

  if (applicableIssues.length === 0) {
    console.info("No open IPOs available.");
  }

  // 3. Fetch unpublished IPOs from DB
  const unpublishedIpos = await ipoRepo.findUnpublishedIpos();

  // 4. Combine into iposToProcess
  const iposToProcess = new Map<
    number,
    {
      companyShareId: number;
      companyName: string;
      issueOpenDate: Date | null;
      issueCloseDate: Date | null;
      isOpen: boolean;
      sharePerUnit?: number;
      shareValue?: number;
    }
  >();

  for (const ipo of applicableIssues) {
    const detail = issueDetails.get(ipo.companyShareId);
    iposToProcess.set(ipo.companyShareId, {
      companyShareId: ipo.companyShareId,
      companyName: ipo.companyName,
      issueOpenDate: ipo.issueOpenDate ? new Date(ipo.issueOpenDate) : null,
      issueCloseDate: ipo.issueCloseDate ? new Date(ipo.issueCloseDate) : null,
      isOpen: true,
      sharePerUnit: detail?.sharePerUnit,
      shareValue: detail?.shareValue,
    });
  }

  for (const ipo of unpublishedIpos) {
    const id = Number(ipo.companyShareId);
    if (!iposToProcess.has(id)) {
      iposToProcess.set(id, {
        companyShareId: id,
        companyName: ipo.companyName,
        issueOpenDate: ipo.issueOpenDate,
        issueCloseDate: ipo.issueCloseDate,
        isOpen: false,
      });
    }
  }

  if (iposToProcess.size === 0) {
    console.info(
      "No open or unpublished IPOs to process. Automation completed.",
    );
    return { success: true, message: "No IPOs to process." };
  }

  // 5. Fetch all active accounts
  let allAccounts = await accountsService.getAllActiveDecryptedAccounts();

  if (testAccountId) {
    allAccounts = allAccounts.filter((acc) => acc.userId === testAccountId);
    console.info(
      `[TEST MODE] Filtering automation to run ONLY for account ID: ${testAccountId}`,
    );
  }

  console.info(
    `Found ${allAccounts.length} active accounts to process for ${iposToProcess.size} IPO(s).`,
  );

  let totalApplications = 0;
  let successfulApplications = 0;
  let failedApplications = 0;

  // 6. Process each IPO
  for (const ipo of iposToProcess.values()) {
    console.info(
      `[Automation] Processing IPO: ${ipo.companyName} (${ipo.companyShareId}) - Open: ${ipo.isOpen}`,
    );

    let isIpoResultPublished = false;

    await ipoRepo.upsertIpo({
      companyShareId: String(ipo.companyShareId),
      companyName: ipo.companyName,
      issueOpenDate: ipo.issueOpenDate,
      issueCloseDate: ipo.issueCloseDate,
    });

    const userLiveApps = new Map<string, LiveApplicationStatus[]>();
    const userAccounts = new Map<string, any[]>();

    for (const acc of allAccounts) {
      if (!userLiveApps.has(acc.userId)) userLiveApps.set(acc.userId, []);
      if (!userAccounts.has(acc.userId)) userAccounts.set(acc.userId, []);
      userAccounts.get(acc.userId)!.push(acc);
    }

    // We process each account sequentially to respect rate limits
    for (const account of allAccounts) {
      let finalStatus:
        | "applied"
        | "pending"
        | "allotted"
        | "not_allotted"
        | "error" = "pending";
      let errorMsg: string | null = null;
      let isVerified = false;
      let isRejected = false;
      let reapplied = false;
      let reapplyFailed = false;

      try {
        const accClient = new MeroShareClient();
        const accToken = await accClient.authenticate(account);

        // Check current status directly
        const report = await accClient.getApplicationReport(accToken);
        const existingApp = report.find(
          (app) => app.companyShareId === ipo.companyShareId,
        );

        if (!existingApp) {
          // Not applied yet.
          if (ipo.isOpen && account.autoApply) {
            let skipAutoApply = false;
            let skipReason = "";

            if (ipo.sharePerUnit && ipo.sharePerUnit > 200) {
              skipAutoApply = true;
              skipReason = `Premium price: ${ipo.sharePerUnit}`;
            } else if (ipo.shareValue && ipo.shareValue > 20000000) {
              skipAutoApply = true;
              skipReason = `High issue volume`;
            }

            if (skipAutoApply) {
              console.info(
                `[Automation] Account ${account.username} - Skipped applying for ${ipo.companyName} due to custom rules (${skipReason})`,
              );
              finalStatus = "error";
              errorMsg = "Skipped due to custom rules";
            } else {
              console.info(
                `[Automation] Account ${account.username} - Applying for ${ipo.companyName}`,
              );
              await applyForAccount(account, {
                companyShareId: ipo.companyShareId,
                ipoName: ipo.companyName,
                kittas: 10,
              });
              finalStatus = "pending";
              successfulApplications++;
            }
          } else {
            // either closed or autoApply disabled
            finalStatus = "error";
            errorMsg = ipo.isOpen
              ? "Auto-apply disabled"
              : "Did not apply via system";
          }
        } else {
          // Already applied, get detail to know exact verification status
          const detail = await accClient.getApplicationDetail(
            accToken,
            existingApp.applicantFormId,
          );
          isVerified = detail.statusName === "Verified";
          isRejected =
            detail.statusName === "Rejected" ||
            existingApp.statusName === "BLOCK_FAILED";
          const isAllotmentResultApproved =
            detail.stageName === "ALLOTMENT_RESULT_APPROVED";
          const isReleased = (detail.meroshareRemark || detail.reasonOrRemark)
            ?.toLowerCase()
            .includes("release");

          if (isAllotmentResultApproved) {
            isIpoResultPublished = true;
          }

          if (isRejected && account.autoReApply && ipo.isOpen) {
            console.info(
              `[Automation] Account ${account.username} - Re-applying for ${ipo.companyName} due to rejection`,
            );
            try {
              await reapplyForAccount(account, existingApp.applicantFormId);
              finalStatus = "pending";
              isRejected = false; // Successfully reapplied, no longer rejected
              reapplied = true;
              successfulApplications++;
            } catch (reapplyErr: any) {
              const errMsg = reapplyErr.message || "Unknown error";
              finalStatus = "error";
              errorMsg = errMsg;
              isRejected = true; // Mark as rejected again so it triggers Rule 2
              reapplyFailed = true;

              failedApplications++;
            }
          } else {
            if (isRejected) {
              finalStatus = "error";
              errorMsg = detail.reason || "Block failed / Rejected";
            } else if (
              detail.statusName === "Alloted" ||
              (detail.receivedKitta ?? 0) > 0
            ) {
              finalStatus = "allotted";
              errorMsg = null;
            } else if (
              detail.statusName === "Non-Alloted" ||
              detail.statusName === "Not Alloted" ||
              (isAllotmentResultApproved &&
                (detail.receivedKitta ?? 0) === 0) ||
              (isReleased && (detail.receivedKitta ?? 0) === 0)
            ) {
              finalStatus = "not_allotted";
              errorMsg = null;
            } else if (isVerified) {
              finalStatus = "applied";
              errorMsg = null;
            } else if (existingApp.statusName === "TRANSACTION_SUCCESS") {
              finalStatus = "applied";
              errorMsg = null;
            } else {
              finalStatus = "pending";
              errorMsg = null;
            }

            console.debug(
              `[Automation] Account ${account.username} - Already applied for ${ipo.companyName} (status: ${finalStatus})`,
            );
          }
        }
        totalApplications++;
      } catch (err: unknown) {
        failedApplications++;
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message === "Already applied to this IPO") {
          finalStatus = "pending";
          errorMsg = "Skipped: Already applied";
        } else {
          finalStatus = "error";
          errorMsg = message;
          console.error(
            `[Automation] Account ${account.username} failed to apply for ${ipo.companyName}: ${message}`,
          );
        }
      }

      userLiveApps.get(account.userId)!.push({
        brokerAccountId: account.id,
        accountName: account.name || account.username,
        isVerified,
        isRejected,
        errorMessage: errorMsg,
        status: finalStatus,
        reapplied,
        reapplyFailed,
      });

      // Add a small delay between accounts to prevent IP blocks
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Evaluate notifications for this IPO
    const uniqueUserIds = [...userLiveApps.keys()];

    if (isIpoResultPublished) {
      const dbIpo = unpublishedIpos.find(
        (i) => Number(i.companyShareId) === ipo.companyShareId,
      );
      if (dbIpo) {
        // Result was unpublished before, but is now published!
        for (const userId of uniqueUserIds) {
          const liveApps = userLiveApps.get(userId) || [];
          if (liveApps.length > 0) {
            await ipoNotificationService.notifyResultForUserLive(
              userId,
              ipo.companyName,
              liveApps,
            );
          }
        }
      }
      await ipoRepo.markResultPublished(String(ipo.companyShareId));
    } else {
      // Normal evaluation
      for (const userId of uniqueUserIds) {
        const liveApps = userLiveApps.get(userId) || [];
        const accounts = userAccounts.get(userId) || [];
        await ipoNotificationService.evaluateAndNotifyLive(
          userId,
          String(ipo.companyShareId),
          ipo.companyName,
          liveApps,
          accounts,
          ipo.issueOpenDate?.toISOString(),
          ipo.issueCloseDate?.toISOString(),
          ipo.isOpen,
          isMorningCron,
          isEveningCron,
          ipo.sharePerUnit,
          ipo.shareValue,
        );
      }
    }
  }

  console.info(
    `[Automation] Completed. Processed ${totalApplications} attempts. Successful: ${successfulApplications}, Failed: ${failedApplications}`,
  );
  return {
    success: true,
    totalProcessed: totalApplications,
    successful: successfulApplications,
    failed: failedApplications,
  };
}
