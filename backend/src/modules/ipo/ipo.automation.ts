import { accountsService } from "../accounts/accounts.service.js";
import { accountsRepo } from "../accounts/accounts.repo.js";
import { MeroShareClient } from "./ipo.meroshare.client.js";
import { applyForAccount, reapplyForAccount } from "./ipo.service.js";
import { ipoRepo } from "./ipo.repo.js";
import { ipoNotificationService } from "./ipo.notification.service.js";
import { config } from "../../config/index.js";
import { usersRepo } from "../users/users.repo.js";

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
  let applicableIssues;
  try {
    const token = await client.authenticate(decryptedRefAccount);
    applicableIssues = await client.getApplicableIpos(token);
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
    }
  >();

  for (const ipo of applicableIssues) {
    iposToProcess.set(ipo.companyShareId, {
      companyShareId: ipo.companyShareId,
      companyName: ipo.companyName,
      issueOpenDate: ipo.issueOpenDate ? new Date(ipo.issueOpenDate) : null,
      issueCloseDate: ipo.issueCloseDate ? new Date(ipo.issueCloseDate) : null,
      isOpen: true,
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
  const allAccounts = await accountsService.getAllActiveDecryptedAccounts();
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

    // We process each account sequentially to respect rate limits
    for (const account of allAccounts) {
      // Create or fetch the record for this account and IPO
      let record = await ipoRepo.findByAccountAndIpo(
        account.id,
        String(ipo.companyShareId),
      );
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
        const existingApp = report.find(
          (app) => app.companyShareId === ipo.companyShareId,
        );

        if (!existingApp) {
          // Not applied yet.
          if (ipo.isOpen && account.autoApply) {
            console.info(
              `[Automation] Account ${account.username} - Applying for ${ipo.companyName}`,
            );
            await applyForAccount(
              account,
              {
                companyShareId: ipo.companyShareId,
                ipoName: ipo.companyName,
                kittas: 10,
              },
              record.id,
            );
            await ipoRepo.updateStatus(record.id, "pending");
            successfulApplications++;
          } else {
            // either closed or autoApply disabled
            if (record.status !== "error") {
              await ipoRepo.updateStatus(
                record.id,
                "error",
                ipo.isOpen ? "Auto-apply disabled" : "Did not apply via system",
              );
            }
          }
        } else {
          // Already applied, get detail to know exact verification status
          const detail = await accClient.getApplicationDetail(
            accToken,
            existingApp.applicantFormId,
          );
          const isVerified = detail.statusName === "Verified";
          const isRejected =
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
              await ipoRepo.updateStatus(record.id, "pending");
              
              // Notify user about the automatic re-application
              const userObj = await usersRepo.findById(account.userId);
              if (userObj?.mobileNumber) {
                await ipoNotificationService.notifyReapplied(
                  userObj.mobileNumber,
                  ipo.companyName,
                  account.name || account.username,
                  detail.reason || "Block Failed"
                );
              }
              
              successfulApplications++;
            } catch (reapplyErr: any) {
              const errorMsg = reapplyErr.message || "Unknown error";
              await ipoRepo.updateStatus(record.id, "error", errorMsg);
              // Mark notification status as rejected so evaluateAndNotify ignores it
              await ipoRepo.updateNotificationStatus(record.id, "rejected"); 
              
              const userObj = await usersRepo.findById(account.userId);
              if (userObj?.mobileNumber) {
                await ipoNotificationService.notifyReapplyFailed(
                  userObj.mobileNumber,
                  ipo.companyName,
                  account.name || account.username,
                  detail.reason || "Block Failed",
                  errorMsg
                );
              }
              failedApplications++;
            }
          } else {
            // determine final status matching ipo.service.ts
            let finalStatus = record.status;
            let errorMsg = record.errorMessage;

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

            if (
              record.status !== finalStatus ||
              record.errorMessage !== errorMsg
            ) {
              await ipoRepo.updateStatus(
                record.id,
                finalStatus as any,
                errorMsg || undefined,
              );
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
          await ipoRepo.updateStatus(
            record.id,
            "pending",
            "Skipped: Already applied",
          );
        } else {
          await ipoRepo.updateStatus(record.id, "error", message);
          console.error(
            `[Automation] Account ${account.username} failed to apply for ${ipo.companyName}: ${message}`,
          );
        }
      }

      // Add a small delay between accounts to prevent IP blocks
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Evaluate notifications for this IPO
    const uniqueUserIds = [...new Set(allAccounts.map((a) => a.userId))];

    if (isIpoResultPublished) {
      const dbIpo = unpublishedIpos.find(
        (i) => Number(i.companyShareId) === ipo.companyShareId,
      );
      if (dbIpo) {
        // Result was unpublished before, but is now published!
        // Notify all users.
        for (const userId of uniqueUserIds) {
          const userApps = await ipoRepo.findByUserId(
            userId,
            String(ipo.companyShareId),
          );
          if (userApps.length > 0) {
            const userAccounts =
              await accountsService.getDecryptedAccountsForUser(userId);
            const accountMap = new Map(
              userAccounts.map((a) => [a.id, a.name || a.username]),
            );
            await ipoNotificationService.notifyResultForUser(
              userId,
              String(ipo.companyShareId),
              ipo.companyName,
              userApps,
              accountMap,
            );
          }
        }
      }
      await ipoRepo.markResultPublished(String(ipo.companyShareId));
    } else {
      // Normal evaluation
      for (const userId of uniqueUserIds) {
        await ipoNotificationService.evaluateAndNotify(
          userId,
          String(ipo.companyShareId),
          ipo.companyName,
          ipo.issueOpenDate?.toISOString(),
          ipo.issueCloseDate?.toISOString(),
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
