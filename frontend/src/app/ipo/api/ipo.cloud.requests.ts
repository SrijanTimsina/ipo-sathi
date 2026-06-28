/**
 * IPO requests for **authenticated** users that use browser-direct MeroShare
 * API calls instead of routing through the backend server.
 *
 * Read operations (status, results, portfolio, available IPOs) are sent
 * directly to MeroShare from the browser, dramatically reducing latency by
 * skipping the backend → Supabase round-trip.
 *
 * Write / apply operations (`bulkApply`, `reapply`) still go through the
 * backend so the server can record applications and trigger notifications.
 *
 * Accounts are read from `accountsStore`, which is populated once after
 * login / session restore — no extra server calls needed per query.
 *
 * Parallelism strategy:
 *  - All accounts are processed **in parallel** via `Promise.allSettled`.
 *  - Each account gets its **own** `MeroShareBrowserClient` instance so
 *    concurrent logins never overwrite each other's token.
 *  - The module-level `authCache` inside the client file is shared across
 *    instances (keyed by `clientId:username`), so cached tokens are reused.
 *  - Within each account, all application-detail fetches also run in parallel.
 */

import type {
  IpoStatus,
  MeroShareIpo,
  IpoApplication,
  BulkApplyResult,
  BrokerAccount,
} from '#/shared/types/api'
import type { BulkApplyPayload } from './ipo.requests'
import { ipoRequests } from './ipo.requests'
import { accountsStore } from '#/app/accounts/api/accounts.store'
import { MeroShareBrowserClient } from './ipo.meroshare-client'

// Single shared client is fine only for single-account operations (listAvailable, getCapitals).
// Status / portfolio use per-account clients (see below).
const sharedClient = new MeroShareBrowserClient()

// ─── Status mapping ────────────────────────────────────────────────────────────

/**
 * Maps MeroShare application list + detail into the frontend `IpoStatus` type.
 * Mirrors the mapping logic in the backend's `ipo.service.ts`.
 *
 * @param client  The per-account client (already authenticated).
 */
async function resolveStatus(
  client: MeroShareBrowserClient,
  listStatusName: string,
  applicantFormId: number,
): Promise<{
  status: IpoStatus
  quantity: number | undefined
  meroShareRemark: string | undefined
  errorMessage: string | null
}> {
  let status: IpoStatus = 'pending'
  let quantity: number | undefined = undefined
  let meroShareRemark: string | undefined = undefined
  let errorMessage: string | null = null

  try {
    const detail = await client.getApplicationDetail(applicantFormId)
    quantity =
      detail.statusName === 'Alloted' && detail.receivedKitta !== undefined
        ? detail.receivedKitta
        : detail.appliedKitta
    meroShareRemark = detail.meroshareRemark ?? detail.reasonOrRemark
    const isReleased = meroShareRemark?.toLowerCase().includes('release')
    const isAllotmentResultApproved =
      (detail as any).stageName === 'ALLOTMENT_RESULT_APPROVED'

    if (detail.statusName === 'Rejected') {
      status = 'error'
      errorMessage = (detail as any).reason || 'Block failed'
    } else if (
      detail.statusName === 'Alloted' ||
      (detail.receivedKitta ?? 0) > 0
    ) {
      status = 'allotted'
    } else if (
      detail.statusName === 'Non-Alloted' ||
      detail.statusName === 'Not Alloted' ||
      (isAllotmentResultApproved && (detail.receivedKitta ?? 0) === 0) ||
      (isReleased && (detail.receivedKitta ?? 0) === 0)
    ) {
      status = 'not_allotted'
    } else if (detail.statusName === 'Verified') {
      status = 'applied'
    } else if (listStatusName === 'TRANSACTION_SUCCESS') {
      status = 'applied'
    }
  } catch {
    // Fallback to list-level statusName if detail fetch fails
    if (listStatusName === 'BLOCKED_APPROVE') {
      status = 'applied'
    } else if (listStatusName === 'BLOCK_FAILED') {
      status = 'error'
      errorMessage = 'Block failed'
    } else if (listStatusName === 'TRANSACTION_SUCCESS') {
      status = 'applied'
    }
  }

  return { status, quantity, meroShareRemark, errorMessage }
}

// ─── Per-account parallel fetcher ─────────────────────────────────────────────

/**
 * Fetches application status for a single account.
 * Creates a fresh client so concurrent calls don't share `currentToken`.
 */
async function fetchStatusForAccount(
  account: BrokerAccount,
  ipoId?: string,
): Promise<IpoApplication[]> {
  if (!account.password) return []

  const client = new MeroShareBrowserClient()
  await client.login(account.clientId, account.username, account.password)
  const reports = await client.getApplicationReport()

  const filteredReports = ipoId
    ? reports.filter((r) => r.companyShareId.toString() === ipoId)
    : reports

  // All detail fetches for this account run in parallel
  return Promise.all(
    filteredReports.map(async (report) => {
      const { status, quantity, meroShareRemark, errorMessage } =
        await resolveStatus(client, report.statusName, report.applicantFormId)

      return {
        id: String(report.applicantFormId),
        userId: account.userId,
        brokerAccountId: account.id,
        username: account.username,
        name: account.name || account.username,
        ipoId: report.companyShareId.toString(),
        ipoName: report.companyName,
        status,
        errorMessage,
        quantity,
        meroShareRemark,
        appliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies IpoApplication
    }),
  )
}

/**
 * Fetches the applied-IPO list for a single account.
 * Creates a fresh client so concurrent calls don't share `currentToken`.
 */
async function fetchAppliedIposForAccount(
  account: BrokerAccount,
): Promise<
  {
    companyShareId: number
    companyName: string
    scrip: string
    shareTypeName: string
    subGroup: string
  }[]
> {
  if (!account.password) return []

  const client = new MeroShareBrowserClient()
  await client.login(account.clientId, account.username, account.password)
  const reports = await client.getApplicationReport()

  return reports.map((r) => ({
    companyShareId: r.companyShareId,
    companyName: r.companyName,
    scrip: r.scrip,
    shareTypeName: r.shareTypeName,
    subGroup: r.subGroup,
  }))
}

// ─── Public request object ─────────────────────────────────────────────────────

export const ipoCloudRequests = {
  /**
   * Fetch currently open IPOs directly from MeroShare using the first active
   * account's credentials.
   */
  async listAvailable(): Promise<MeroShareIpo[]> {
    const accounts = accountsStore.getActive()
    if (accounts.length === 0) return []

    const account = accounts[0]
    if (!account.password) return []

    await sharedClient.login(
      account.clientId,
      account.username,
      account.password,
    )
    return sharedClient.getApplicableIpos()
  },

  /**
   * Fetch application status for all (or a specific) account/IPO directly
   * from MeroShare.
   *
   * All accounts are queried **in parallel**. Each account gets its own client
   * instance to avoid token collision. Within each account, all detail fetches
   * also run in parallel.
   */
  getStatus: async (
    ipoId?: string,
    accountId?: string,
  ): Promise<IpoApplication[]> => {
    const allAccounts = accountsStore.getActive()
    const targetAccounts = accountId
      ? allAccounts.filter((a) => a.id === accountId)
      : allAccounts

    // Fan-out: all accounts in parallel
    const results = await Promise.allSettled(
      targetAccounts.map((account) => fetchStatusForAccount(account, ipoId)),
    )

    const applications: IpoApplication[] = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        applications.push(...result.value)
      } else {
        console.error(
          `[cloud] Failed to fetch status for ${targetAccounts[i]?.username}`,
          result.reason,
        )
      }
    })

    return applications
  },

  /**
   * Results reuse the same application report from MeroShare (same as status
   * but includes allotment info when available).
   */
  async getResults(): Promise<IpoApplication[]> {
    return ipoCloudRequests.getStatus()
  },

  /**
   * Deduplicated list of IPOs that any of the user's accounts have applied
   * for. All accounts are queried **in parallel**.
   */
  getAppliedIpos: async (): Promise<
    {
      companyShareId: number
      companyName: string
      scrip: string
      shareTypeName: string
      subGroup: string
    }[]
  > => {
    const allAccounts = accountsStore.getActive()

    // Fan-out: all accounts in parallel
    const results = await Promise.allSettled(
      allAccounts.map((account) => fetchAppliedIposForAccount(account)),
    )

    const iposMap = new Map<
      number,
      {
        companyShareId: number
        companyName: string
        scrip: string
        shareTypeName: string
        subGroup: string
      }
    >()

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        for (const ipo of result.value) {
          if (!iposMap.has(ipo.companyShareId)) {
            iposMap.set(ipo.companyShareId, ipo)
          }
        }
      } else {
        console.error(
          `[cloud] Failed to fetch applied IPOs for ${allAccounts[i]?.username}`,
          result.reason,
        )
      }
    })

    return Array.from(iposMap.values())
  },

  /** Capital list (broker list) — public endpoint, no auth required. */
  getCapitals: async (): Promise<
    { id: number; code: string; name: string }[]
  > => {
    return sharedClient.getCapitals()
  },

  // ─── Mutations still go through the backend ──────────────────────────────

  async bulkApply(payload: BulkApplyPayload): Promise<BulkApplyResult> {
    return ipoRequests.bulkApply(payload)
  },

  async reapply(payload: {
    accountId: string
    applicantFormId: number
  }): Promise<{ message: string }> {
    return ipoRequests.reapply(payload)
  },
}
