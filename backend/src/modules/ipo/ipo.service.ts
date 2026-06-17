import {
  MeroShareClient,
  type MeroShareIpo,
  type ApplyIpoPayload,
} from "./ipo.meroshare.client.js";
import { ipoRepo } from "./ipo.repo.js";
import { accountsService } from "../accounts/accounts.service.js";
import { AppError } from "../../shared/middleware/errorHandler.js";
import type { SelectIpoApplication } from "./ipo.schema.js";
import type { DecryptedAccount } from "../accounts/accounts.service.js";

export interface BulkApplyInput {
  companyShareId: number;
  ipoName: string;
  kittas: number;
  accountIds?: string[]; // if omitted, applies to all active accounts
}

export interface BulkApplyResult {
  total: number;
  successful: number;
  failed: number;
  applications: SelectIpoApplication[];
}

export const ipoService = {
  /**
   * Fetch open IPOs using the first active account of the user.
   * Mirrors the CLI's approach: authenticate one account, get the IPO list.
   */
  async getAvailableIpos(userId: string): Promise<MeroShareIpo[]> {
    const accounts = await accountsService.getDecryptedAccountsForUser(userId);
    if (accounts.length === 0) {
      throw new AppError(
        400,
        "NO_ACCOUNTS",
        "You have no active broker accounts. Add an account before fetching IPOs.",
      );
    }

    let lastError: unknown;
    const client = new MeroShareClient();

    for (const account of accounts) {
      try {
        const token = await client.authenticate(account);
        return await client.getApplicableIpos(token);
      } catch (err) {
        lastError = err;
        console.warn(`Failed to fetch IPOs using account ${account.username}:`, err instanceof Error ? err.message : err);
        // Continue and try the next account
      }
    }

    throw new AppError(
      502,
      "MEROSHARE_ERROR",
      `Failed to connect to MeroShare using any of your active accounts. MeroShare might be down or your credentials might be invalid. Error: ${lastError instanceof Error ? lastError.message : "Unknown"}`,
    );
  },

  /**
   * Apply for an IPO across all (or selected) broker accounts.
   * Each application is logged independently in ipo_applications.
   */
  async bulkApply(
    userId: string,
    input: BulkApplyInput,
  ): Promise<BulkApplyResult> {
    const allAccounts =
      await accountsService.getDecryptedAccountsForUser(userId);
    if (allAccounts.length === 0) {
      throw new AppError(400, "NO_ACCOUNTS", "No active broker accounts found");
    }

    const targetAccounts = input.accountIds
      ? allAccounts.filter((a) => input.accountIds!.includes(a.id))
      : allAccounts;

    if (targetAccounts.length === 0) {
      throw new AppError(
        400,
        "NO_MATCHING_ACCOUNTS",
        "None of the specified accounts are active",
      );
    }

    const applications: SelectIpoApplication[] = [];
    let successful = 0;
    let failed = 0;

    // Process accounts sequentially with a short delay to respect rate limits
    for (const account of targetAccounts) {
      const record = await ipoRepo.createApplication({
        userId,
        brokerAccountId: account.id,
        ipoId: String(input.companyShareId),
        ipoName: input.ipoName,
        status: "pending",
      });

      try {
        await applyForAccount(account, input, record.id);

        await ipoRepo.updateStatus(record.id, "applied");
        successful++;
        applications.push({ ...record, status: "applied" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message === "Already applied to this IPO") {
          // If already applied, consider it a success state for the user conceptually,
          // but we can mark it as applied in our DB without incrementing successful application count
          await ipoRepo.updateStatus(
            record.id,
            "applied",
            "Skipped: Already applied",
          );
          applications.push({
            ...record,
            status: "applied",
            errorMessage: "Already applied",
          });
        } else {
          await ipoRepo.updateStatus(record.id, "error", message);
          failed++;
          applications.push({
            ...record,
            status: "error",
            errorMessage: message,
          });
        }
      }

      // Rate limit delay between accounts (mirrors CLI's RATE_LIMIT_DELAY)
      if (targetAccounts.indexOf(account) < targetAccounts.length - 1) {
        await sleep(1500);
      }
    }

    return {
      total: targetAccounts.length,
      successful,
      failed,
      applications,
    };
  },

  /**
   * Get a unique list of all IPOs the user has applied to across all accounts.
   * This is used to populate the IPO dropdown.
   */
  async getAppliedIpos(userId: string) {
    const accounts = await accountsService.getDecryptedAccountsForUser(userId);
    const ipoMap = new Map<
      number,
      {
        companyShareId: number;
        companyName: string;
        scrip: string;
        shareTypeName: string;
        subGroup: string;
      }
    >();

    for (const account of accounts) {
      try {
        const client = new MeroShareClient();
        const token = await client.authenticate(account);
        const report = await client.getApplicationReport(token);
        for (const app of report) {
          if (!ipoMap.has(app.companyShareId)) {
            ipoMap.set(app.companyShareId, {
              companyShareId: app.companyShareId,
              companyName: app.companyName,
              scrip: app.scrip,
              shareTypeName: app.shareTypeName,
              subGroup: app.subGroup,
            });
          }
        }
      } catch (err) {
        // Skip failed accounts
      }
    }

    return Array.from(ipoMap.values());
  },

  /**
   * Get application status records for the user.
   * Fetches real-time status directly from MeroShare API for each account.
   */
  async getApplicationStatus(
    userId: string,
    ipoId?: string,
    accountId?: string,
  ): Promise<
    (SelectIpoApplication & {
      username: string;
      name?: string;
      quantity?: number;
      meroShareRemark?: string;
    })[]
  > {
    let accounts = await accountsService.getDecryptedAccountsForUser(userId);
    if (accountId) {
      accounts = accounts.filter((a) => a.id === accountId);
    }
    const applications: (SelectIpoApplication & {
      username: string;
      name?: string;
      quantity?: number;
      meroShareRemark?: string;
    })[] = [];


    for (const account of accounts) {
      try {
        const client = new MeroShareClient();
        const token = await client.authenticate(account);

        let name: string | undefined = account.name || undefined;

        const report = await client.getApplicationReport(token);

        for (const app of report) {
          if (ipoId && String(app.companyShareId) !== ipoId) continue;

          let status: SelectIpoApplication["status"] = "pending";
          let errorMessage: string | null = null;
          let quantity: number | undefined = undefined;
          let meroShareRemark: string | undefined = undefined;

          // Fetch the detail for every application to get precise quantity and remarks
          try {
            const detail = await client.getApplicationDetail(
              token,
              app.applicantFormId,
            );
            quantity =
              detail.statusName === "Alloted" &&
              detail.receivedKitta !== undefined
                ? detail.receivedKitta
                : detail.appliedKitta;
            meroShareRemark = detail.meroshareRemark || detail.reasonOrRemark;
            const isReleased = meroShareRemark?.toLowerCase().includes("release");
            const isAllotmentResultApproved = detail.stageName === "ALLOTMENT_RESULT_APPROVED";

            if (detail.statusName === "Rejected") {
              status = "error";
              errorMessage = detail.reason || "Block failed";
            } else if (
              detail.statusName === "Alloted" ||
              (detail.receivedKitta ?? 0) > 0
            ) {
              status = "allotted";
            } else if (
              detail.statusName === "Non-Alloted" ||
              detail.statusName === "Not Alloted" ||
              (isAllotmentResultApproved && (detail.receivedKitta ?? 0) === 0) ||
              (isReleased && (detail.receivedKitta ?? 0) === 0)
            ) {
              status = "not_allotted";
            } else if (detail.statusName === "Verified") {
              status = "applied";
            } else if (app.statusName === "TRANSACTION_SUCCESS") {
              // The detail didn't explicitly say Alloted or Non-Alloted
              status = "applied";
            }
          } catch (err) {
            // Fallback to high-level search array data if detail fails
            if (app.statusName === "BLOCKED_APPROVE") {
              status = "applied";
            } else if (app.statusName === "BLOCK_FAILED") {
              status = "error";
              errorMessage = "Block failed";
            } else if (app.statusName === "TRANSACTION_SUCCESS") {
              status = "applied";
            }
          }

          applications.push({
            id: String(app.applicantFormId),
            userId,
            brokerAccountId: account.id,
            ipoId: String(app.companyShareId),
            ipoName: app.companyName,
            status,
            errorMessage,
            quantity,
            meroShareRemark,
            appliedAt: new Date(),
            updatedAt: new Date(),
            notificationStatus: "none",
            username: account.username, // Include username for the UI
            name, // Include real name
          });
        }
        
        if (ipoId) {
          const appliedToThisIpo = report.some((app) => String(app.companyShareId) === ipoId);
          if (!appliedToThisIpo) {
            applications.push({
              id: `not-applied-${account.id}-${ipoId}`,
              userId,
              brokerAccountId: account.id,
              ipoId,
              ipoName: "Not Applied",
              status: "not_applied" as any,
              errorMessage: null,
              quantity: 0,
              meroShareRemark: "Not applied to this IPO",
              appliedAt: new Date(),
              updatedAt: new Date(),
              notificationStatus: "none",
              username: account.username,
              name,
            });
          }
        }
      } catch (err: any) {
        // If an account fails to login or fetch data, report the error so the UI displays it!
        applications.push({
          id: `error-${account.id}`,
          userId,
          brokerAccountId: account.id,
          ipoId: ipoId || "unknown",
          ipoName: "Unknown IPO / Fetch Error",
          status: "error",
          errorMessage: err?.message || "Failed to fetch from MeroShare",
          quantity: 0,
          meroShareRemark: undefined,
          appliedAt: new Date(),
          updatedAt: new Date(),
          notificationStatus: "none",
          username: account.username,
          name: account.name || undefined,
        });
      }
    }

    return applications.sort((a, b) =>
      (a.name || a.username).localeCompare(b.name || b.username),
    );
  },

  /**
   * Get allotted IPO results for the user.
   */
  async getAllotmentResults(userId: string): Promise<SelectIpoApplication[]> {
    return ipoRepo.findAllotmentResults(userId);
  },

  /**
   * Reapply for an IPO for a specific broker account.
   */
  async reapply(userId: string, accountId: string, applicantFormId: number): Promise<void> {
    const allAccounts = await accountsService.getDecryptedAccountsForUser(userId);
    const account = allAccounts.find((a) => a.id === accountId);

    if (!account) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Broker account not found");
    }

    try {
      await reapplyForAccount(account, applicantFormId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new AppError(500, "REAPPLY_FAILED", `Failed to reapply: ${message}`);
    }
  },

  /**
   * ADMIN: Get all IPO activity for any user.
   */
  async getActivityForUser(userId: string): Promise<SelectIpoApplication[]> {
    return ipoRepo.findByUserIdAdmin(userId);
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the full MeroShare apply flow for a single broker account.
 * Mirrors the Python CLI's _apply_ipo_for_user logic.
 */
export async function applyForAccount(
  account: DecryptedAccount,
  input: BulkApplyInput,
  _recordId: string,
): Promise<void> {
  const client = new MeroShareClient();

  // Step 1: Authenticate
  const token = await client.authenticate(account);

  // Step 1.5: Check if already applied
  const report = await client.getApplicationReport(token);
  const existingApp = report.find(
    (app) => app.companyShareId === input.companyShareId,
  );
  
  if (existingApp) {
    // If not BLOCK_FAILED, it means it's pending/verified/allotted, so we don't need to check details
    if (existingApp.statusName !== "BLOCK_FAILED") {
      return;
    }

    const detail = await client.getApplicationDetail(
      token,
      existingApp.applicantFormId,
    );
    if (
      detail.statusName === "Rejected" ||
      detail.statusDescription === "BLOCK_FAILED"
    ) {
      // If rejected, reapply
      await reapplyForAccount(account, existingApp.applicantFormId);
      return;
    } else {
      // Already applied and not rejected
      // Just return to mark it as successful idempotently
      return;
    }
  }

  // Step 2-4: Build Application Payload
  const applicationPayload = await buildApplicationPayload(
    client,
    token,
    account,
    input.companyShareId,
    input.kittas,
  );

  // Step 5: Submit application
  await client.applyIpo(token, applicationPayload);
}

/**
 * Reapplies for an IPO.
 */
export async function reapplyForAccount(
  account: DecryptedAccount,
  applicantFormId: number,
): Promise<void> {
  const client = new MeroShareClient();
  const token = await client.authenticate(account);

  const detail = await client.getApplicationDetail(token, applicantFormId);
  const companyShareId = detail.companyShareId;
  const appliedKitta = detail.appliedKitta || 10;

  const applicationPayload = await buildApplicationPayload(
    client,
    token,
    account,
    companyShareId,
    appliedKitta,
  );

  await client.reapplyIpo(token, applicantFormId, applicationPayload);
}

/**
 * Helper to build the IPO payload required for applying or reapplying
 */
async function buildApplicationPayload(
  client: MeroShareClient,
  token: string,
  account: DecryptedAccount,
  companyShareId: number,
  kittas: number,
): Promise<ApplyIpoPayload> {
  // Step 2: Get own detail (contains demat/boid)
  const ownDetail = await client.getOwnDetail(token);

  // Step 3: Get client BOID detail (contains bankCode)
  const boidDetail = await client.getClientBoidDetail(token, ownDetail.demat);

  // Step 4: Get bank details — try by bankCode first, fall back to bank list
  let applicationPayload: ApplyIpoPayload;

  const bankByCode = await client.getBankDetailByCode(
    token,
    boidDetail.bankCode,
  );

  if (!bankByCode) {
    // Fallback: get first bank from list
    const bankList = await client.getBankList(token);
    if (bankList.length === 0) throw new Error("No banks found for account");

    const firstBank = bankList[0]!;
    const customerCode = await client.getBankCustomerCode(token, firstBank.id);

    applicationPayload = {
      accountBranchId: customerCode.accountBranchId,
      accountNumber: customerCode.accountNumber,
      accountTypeId: customerCode.accountTypeId ?? 1,
      appliedKitta: kittas,
      bankId: firstBank.id,
      boid: ownDetail.boid,
      companyShareId: companyShareId,
      crnNumber: account.crn,
      customerId: customerCode.id,
      demat: boidDetail.boid,
      transactionPIN: account.pin,
    };
  } else {
    // Use bank details from bankCode response
    const bankInfo = bankByCode.bank;
    const bankId = Array.isArray(bankInfo) ? bankInfo[0]!.id : bankInfo.id;

    const customerCode = await client.getBankCustomerCode(token, bankId);

    const branchInfo = bankByCode.branch;
    const branchId = Array.isArray(branchInfo)
      ? branchInfo[0]!.id
      : branchInfo.id;

    applicationPayload = {
      accountBranchId: branchId,
      accountNumber: bankByCode.accountNumber,
      accountTypeId: (bankByCode.accountTypeId as number | undefined) ?? 1,
      appliedKitta: kittas,
      bankId,
      boid: ownDetail.boid,
      companyShareId: companyShareId,
      crnNumber: account.crn,
      customerId: customerCode.id,
      demat: boidDetail.boid,
      transactionPIN: account.pin,
    };
  }

  return applicationPayload;
}
