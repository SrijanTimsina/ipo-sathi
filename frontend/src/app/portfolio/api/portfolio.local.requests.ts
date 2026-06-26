import type { AccountPortfolio, PortfolioHolding, PortfolioResponse } from '#/shared/types/api'
import { localStore } from '#/shared/lib/storage'
import { MeroShareBrowserClient } from '#/app/ipo/api/ipo.meroshare-client'

function mapHolding(item: any): PortfolioHolding {
  return {
    script: item.script,
    scriptDesc: item.scriptDesc,
    currentBalance: item.currentBalance,
    lastTransactionPrice: parseFloat(item.lastTransactionPrice.replace(/,/g, '')),
    previousClosingPrice: parseFloat(item.previousClosingPrice.replace(/,/g, '')),
    valueOfLastTransPrice: item.valueOfLastTransPrice,
    valueOfPrevClosingPrice: item.valueOfPrevClosingPrice,
  }
}

export const localPortfolioRequests = {
  async getPortfolio(): Promise<PortfolioResponse> {
    const accounts = localStore.getAccounts().filter((a) => a.isActive)
    const result: PortfolioResponse = {
      accounts: [],
      grandTotalValue: 0,
      grandTotalValuePrevClose: 0,
    }

    const client = new MeroShareBrowserClient()

    for (const account of accounts) {
      if (!account.password) continue

      try {
        await client.login(account.clientId, account.username, account.password)
        const ownDetail = await client.getOwnDetail()
        const portfolio = await client.getPortfolio(ownDetail.demat, ownDetail.clientCode)

        const accountPortfolio: AccountPortfolio = {
          accountId: account.id,
          accountName: account.name || account.username,
          demat: ownDetail.demat,
          holdings: portfolio.meroShareMyPortfolio.map(mapHolding),
          totalItems: portfolio.totalItems || 0,
          totalValue: portfolio.totalValueOfLastTransPrice || 0,
          totalValuePrevClose: portfolio.totalValueOfPrevClosingPrice || 0,
        }

        result.accounts.push(accountPortfolio)
        result.grandTotalValue += accountPortfolio.totalValue
        result.grandTotalValuePrevClose += accountPortfolio.totalValuePrevClose
      } catch (error: any) {
        result.accounts.push({
          accountId: account.id,
          accountName: account.name || account.username,
          demat: null,
          holdings: [],
          totalItems: 0,
          totalValue: 0,
          totalValuePrevClose: 0,
          error: error.message || 'Failed to fetch portfolio',
        })
      }
    }

    return result
  },
}
