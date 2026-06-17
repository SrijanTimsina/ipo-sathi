import { accountsService } from "../accounts/accounts.service.js";
import {
  MeroShareClient,
  type MeroSharePortfolioItem,
} from "../ipo/ipo.meroshare.client.js";

// ─── Response Types ───────────────────────────────────────────────────────────

export interface PortfolioHolding {
  script: string;
  scriptDesc: string;
  currentBalance: number;
  lastTransactionPrice: number;
  previousClosingPrice: number;
  valueOfLastTransPrice: number;
  valueOfPrevClosingPrice: number;
}

export interface AccountPortfolio {
  accountId: string;
  accountName: string | null;
  demat: string | null;
  holdings: PortfolioHolding[];
  totalItems: number;
  totalValue: number;
  totalValuePrevClose: number;
  error?: string;
}

export interface PortfolioResponse {
  accounts: AccountPortfolio[];
  grandTotalValue: number;
  grandTotalValuePrevClose: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapHolding(item: MeroSharePortfolioItem): PortfolioHolding {
  return {
    script: item.script,
    scriptDesc: item.scriptDesc,
    currentBalance: item.currentBalance,
    lastTransactionPrice: parseFloat(item.lastTransactionPrice) || 0,
    previousClosingPrice: parseFloat(item.previousClosingPrice) || 0,
    valueOfLastTransPrice: item.valueOfLastTransPrice,
    valueOfPrevClosingPrice: item.valueOfPrevClosingPrice,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const portfolioService = {
  /**
   * Fetch live portfolio from MeroShare for all active accounts of the user.
   * Each account is fetched independently — failures are isolated per account.
   */
  async getPortfolioForUser(userId: string): Promise<PortfolioResponse> {
    const accounts = await accountsService.getDecryptedAccountsForUser(userId);

    const client = new MeroShareClient();

    const accountResults = await Promise.allSettled(
      accounts.map(async (account): Promise<AccountPortfolio> => {
        if (!account.demat || !account.clientCode) {
          return {
            accountId: account.id,
            accountName: account.name,
            demat: account.demat,
            holdings: [],
            totalItems: 0,
            totalValue: 0,
            totalValuePrevClose: 0,
            error: "No DEMAT number or client code linked to this account",
          };
        }

        const token = await client.authenticate(account);
        const portfolio = await client.getPortfolio(
          token,
          account.demat,
          account.clientCode,
        );

        return {
          accountId: account.id,
          accountName: account.name,
          demat: account.demat,
          holdings: (portfolio.meroShareMyPortfolio ?? []).map(mapHolding),
          totalItems: portfolio.totalItems ?? 0,
          totalValue: portfolio.totalValueOfLastTransPrice ?? 0,
          totalValuePrevClose: portfolio.totalValueOfPrevClosingPrice ?? 0,
        };
      }),
    );

    const accountPortfolios: AccountPortfolio[] = accountResults.map(
      (result, idx) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        // On failure, return an error entry for that account
        const account = accounts[idx]!;
        return {
          accountId: account.id,
          accountName: account.name,
          demat: account.demat,
          holdings: [],
          totalItems: 0,
          totalValue: 0,
          totalValuePrevClose: 0,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Failed to fetch portfolio",
        };
      },
    );

    const grandTotalValue = accountPortfolios.reduce(
      (sum, a) => sum + a.totalValue,
      0,
    );
    const grandTotalValuePrevClose = accountPortfolios.reduce(
      (sum, a) => sum + a.totalValuePrevClose,
      0,
    );

    return {
      accounts: accountPortfolios,
      grandTotalValue,
      grandTotalValuePrevClose,
    };
  },
};
