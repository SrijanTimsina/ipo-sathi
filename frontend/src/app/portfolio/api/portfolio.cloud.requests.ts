/**
 * Portfolio requests for **authenticated** users that call MeroShare directly
 * from the browser instead of routing through the backend server.
 *
 * All accounts are fetched **in parallel** — each gets its own
 * `MeroShareBrowserClient` instance so concurrent logins don't overwrite
 * each other's token. The shared `authCache` inside the client file means
 * tokens are still reused across instances.
 *
 * Accounts are read from `accountsStore`, populated once on login.
 */

import type {
  AccountPortfolio,
  PortfolioHolding,
  PortfolioResponse,
  BrokerAccount,
} from '#/shared/types/api'
import { accountsStore } from '#/app/accounts/api/accounts.store'
import { MeroShareBrowserClient } from '#/app/ipo/api/ipo.meroshare-client'

function mapHolding(item: {
  script: string
  scriptDesc: string
  currentBalance: number
  lastTransactionPrice: string
  previousClosingPrice: string
  valueOfLastTransPrice: number
  valueOfPrevClosingPrice: number
}): PortfolioHolding {
  return {
    script: item.script,
    scriptDesc: item.scriptDesc,
    currentBalance: item.currentBalance,
    lastTransactionPrice: parseFloat(
      item.lastTransactionPrice.replace(/,/g, ''),
    ),
    previousClosingPrice: parseFloat(
      item.previousClosingPrice.replace(/,/g, ''),
    ),
    valueOfLastTransPrice: item.valueOfLastTransPrice,
    valueOfPrevClosingPrice: item.valueOfPrevClosingPrice,
  }
}

/**
 * Fetches portfolio for a single account.
 * Creates a fresh client instance so concurrent calls don't share `currentToken`.
 */
async function fetchPortfolioForAccount(
  account: BrokerAccount,
): Promise<AccountPortfolio> {
  if (!account.password) {
    return {
      accountId: account.id,
      accountName: account.name || account.username,
      demat: null,
      holdings: [],
      totalItems: 0,
      totalValue: 0,
      totalValuePrevClose: 0,
      error: 'Password not available',
    }
  }

  const client = new MeroShareBrowserClient()
  await client.login(account.clientId, account.username, account.password)

  // Use cached demat/clientCode from the account store if available to skip
  // an extra getOwnDetail() round-trip; fall back to fetching if missing.
  let demat = account.demat ?? ''
  let clientCode = account.clientCode ?? ''

  if (!demat || !clientCode) {
    const ownDetail = await client.getOwnDetail()
    demat = ownDetail.demat
    clientCode = ownDetail.clientCode
  }

  const portfolio = await client.getPortfolio(demat, clientCode)

  return {
    accountId: account.id,
    accountName: account.name || account.username,
    demat,
    holdings: portfolio.meroShareMyPortfolio.map(mapHolding),
    totalItems: portfolio.totalItems || 0,
    totalValue: portfolio.totalValueOfLastTransPrice || 0,
    totalValuePrevClose: portfolio.totalValueOfPrevClosingPrice || 0,
  }
}

export const portfolioCloudRequests = {
  /**
   * Fetches portfolio for all active accounts **in parallel**.
   * Failed accounts are included in the response with an error field rather
   * than throwing, so successful accounts are always shown.
   */
  async getPortfolio(): Promise<PortfolioResponse> {
    const accounts = accountsStore.getActive()

    // Fan-out: all accounts in parallel
    const results = await Promise.allSettled(
      accounts.map((account) => fetchPortfolioForAccount(account)),
    )

    const portfolioAccounts: AccountPortfolio[] = []
    let grandTotalValue = 0
    let grandTotalValuePrevClose = 0

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        portfolioAccounts.push(result.value)
        grandTotalValue += result.value.totalValue
        grandTotalValuePrevClose += result.value.totalValuePrevClose
      } else {
        const account = accounts[i]
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : 'Failed to fetch portfolio'
        console.error(
          `[cloud] Failed to fetch portfolio for ${account.username}`,
          result.reason,
        )
        portfolioAccounts.push({
          accountId: account.id,
          accountName: account.name || account.username,
          demat: null,
          holdings: [],
          totalItems: 0,
          totalValue: 0,
          totalValuePrevClose: 0,
          error: message,
        })
      }
    })

    return {
      accounts: portfolioAccounts,
      grandTotalValue,
      grandTotalValuePrevClose,
    }
  },
}
