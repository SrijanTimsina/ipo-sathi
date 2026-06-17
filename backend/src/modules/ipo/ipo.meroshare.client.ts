import fs from "fs";
import path from "path";
import axios, { type AxiosInstance } from "axios";
import type { DecryptedAccount } from "../accounts/accounts.service.js";

const MEROSHARE_BASE = "https://webbackend.cdsc.com.np/api";

const REQUEST_TIMEOUT = 30_000;

// ─── Response Types ───────────────────────────────────────────────────────────

export interface MeroShareOwnDetail {
  demat: string;
  boid: string;
  name: string;
  clientCode: string;
  [key: string]: unknown;
}

export interface MeroShareClientBoid {
  boid: string;
  bankCode: string;
  [key: string]: unknown;
}

export interface MeroShareIpo {
  companyShareId: number;
  companyName: string;
  shareTypeName: string;
  issueManager: string;
  minUnit: number;
  maxUnit: number;
  issueOpenDate: string;
  issueCloseDate: string;
  [key: string]: unknown;
}

export interface MeroShareApplicableIssueResponse {
  object: MeroShareIpo[];
  [key: string]: unknown;
}

export type MeroShareApplicationListStatus =
  | "BLOCKED_APPROVE"
  | "TRANSACTION_SUCCESS"
  | "BLOCK_FAILED";

export interface MeroShareApplicationListItem {
  companyShareId: number;
  subGroup: string;
  scrip: string;
  companyName: string;
  shareTypeName: "IPO" | "FPO";
  shareGroupName: string;
  statusName: MeroShareApplicationListStatus;
  applicantFormId: number;
}

export interface MeroShareApplicationListResponse {
  object: MeroShareApplicationListItem[];
  totalCount: number;
}

export interface MeroShareApplicationDetail {
  applicantFormId: number;
  companyShareId: number;
  statusName: string;
  statusDescription: string;
  receivedKitta?: number;
  appliedKitta?: number;
  meroshareRemark?: string;
  reasonOrRemark?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface MeroShareBankDetail {
  id: string;
  accountNumber: string;
  accountBranchId: number;
  accountTypeId: number;
  bank:
    | { id: number; [key: string]: unknown }
    | Array<{ id: number; [key: string]: unknown }>;
  branch:
    | { id: number; [key: string]: unknown }
    | Array<{ id: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface MeroShareBankListItem {
  id: number;
  [key: string]: unknown;
}

export interface MeroShareBankCustomerCode {
  id: number;
  accountNumber: string;
  accountBranchId: number;
  accountTypeId: number;
  [key: string]: unknown;
}

export interface MeroSharePortfolioItem {
  currentBalance: number;
  lastTransactionPrice: string;
  previousClosingPrice: string;
  script: string;
  scriptDesc: string;
  valueAsOfLastTransactionPrice: string;
  valueAsOfPreviousClosingPrice: string;
  valueOfLastTransPrice: number;
  valueOfPrevClosingPrice: number;
}

export interface MeroSharePortfolioResponse {
  meroShareMyPortfolio: MeroSharePortfolioItem[];
  totalItems: number;
  totalValueAsOfLastTransactionPrice: string;
  totalValueAsOfPreviousClosingPrice: string;
  totalValueOfLastTransPrice: number;
  totalValueOfPrevClosingPrice: number;
}

export interface ApplyIpoPayload {
  accountBranchId: number;
  accountNumber: string;
  accountTypeId: number;
  appliedKitta: number;
  bankId: number;
  boid: string;
  companyShareId: number;
  crnNumber: string;
  customerId: number;
  demat: string;
  transactionPIN: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}
const authCache = new Map<string, TokenCacheEntry>();
const reverseAuthCache = new Map<string, string>(); // token -> account.id

// ─── Client ───────────────────────────────────────────────────────────────────

export class MeroShareClient {
  private readonly http: AxiosInstance;
  private currentAccount: DecryptedAccount | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: MEROSHARE_BASE,
      timeout: REQUEST_TIMEOUT,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
        Origin: "https://meroshare.cdsc.com.np",
        Referer: "https://meroshare.cdsc.com.np/",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    // Setup logging interceptors
    this.http.interceptors.request.use((config) => {
      try {
        const logDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

        const logLine = `[${new Date().toISOString()}] REQUEST ${config.method?.toUpperCase()} ${config.url}\nHeaders: ${JSON.stringify(config.headers)}\nData: ${JSON.stringify(config.data)}\n\n`;
        fs.appendFileSync(path.join(logDir, "meroshare.log"), logLine);
      } catch (e) {}
      return config;
    });

    this.http.interceptors.response.use(
      (response) => {
        try {
          const logDir = path.join(process.cwd(), "logs");
          const logLine = `[${new Date().toISOString()}] RESPONSE ${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}\nData: ${JSON.stringify(response.data)}\n\n`;
          fs.appendFileSync(path.join(logDir, "meroshare.log"), logLine);
        } catch (e) {}
        return response;
      },
      async (error) => {
        try {
          const logDir = path.join(process.cwd(), "logs");
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          
          const status = error.response?.status || "UNKNOWN";
          const data = error.response?.data || error.message;
          const url = error.config?.url || "UNKNOWN";
          const method = error.config?.method?.toUpperCase() || "UNKNOWN";
          const reqData = error.config?.data || "UNKNOWN";
          const logLine = `[${new Date().toISOString()}] ERROR ${method} ${url} -> ${status}\nRequest Data: ${reqData}\nResponse Data/Error: ${typeof data === "object" ? JSON.stringify(data) : data}\n\n`;
          fs.appendFileSync(path.join(logDir, "meroshare.log"), logLine);
        } catch (e) {}

        const status = error.response?.status;
        const originalRequest = error.config;

        if (
          status === 401 &&
          this.currentAccount &&
          originalRequest &&
          !originalRequest._retry &&
          originalRequest.url !== "/meroShare/auth/"
        ) {
          originalRequest._retry = true;

          // Invalidate cache
          authCache.delete(this.currentAccount.id);
          const oldToken = originalRequest.headers?.Authorization;
          if (oldToken) {
            reverseAuthCache.delete(oldToken as string);
          }

          try {
            // Re-authenticate
            const newToken = await this.authenticate(this.currentAccount);
            // Update request authorization header
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = newToken;
            }
            // Retry request
            return this.http(originalRequest);
          } catch (reAuthError) {
            return Promise.reject(reAuthError);
          }
        }

        if (error.response?.data) {
          const resData = error.response.data;
          if (typeof resData === "string") {
            error.message = resData;
          } else if (resData.message) {
            error.message = resData.message;
          } else if (resData.error) {
            error.message = resData.error;
          }
        }

        return Promise.reject(error);
      },
    );
  }

  private capitalsCache: { id: number; code: string; name: string }[] | null =
    null;

  public async getCapitals() {
    if (this.capitalsCache) return this.capitalsCache;
    const response = await this.http.get<
      { id: number; code: string; name: string }[]
    >("/meroShare/capital/");
    this.capitalsCache = response.data;
    return this.capitalsCache;
  }

  /**
   * Authenticate with MeroShare and return the Bearer token.
   * The token is returned in the Authorization response header.
   */
  async authenticate(account: DecryptedAccount): Promise<string> {
    this.currentAccount = account;
    
    if (account.id) {
      const cached = authCache.get(account.id);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
      }
    }

    const response = await this.http.post<unknown>("/meroShare/auth/", {
      clientId: Number(account.clientId),
      username: account.username,
      password: account.password,
    });

    const token = (
      response.headers["authorization"] as string | undefined
    )?.trim();
    if (!token) {
      throw new Error(
        `Authentication failed for account ${account.username}: no token in response`,
      );
    }
    
    if (account.id) {
      authCache.set(account.id, {
        token,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      reverseAuthCache.set(token, account.id);
    }

    return token;
  }

  /**
   * Get the authenticated user's own MeroShare details.
   */
  async getOwnDetail(token: string): Promise<MeroShareOwnDetail> {
    const response = await this.http.get<MeroShareOwnDetail>(
      "/meroShare/ownDetail/",
      {
        headers: { Authorization: token },
      },
    );
    return response.data;
  }

  /**
   * Get client BOID and bank details by DMAT number.
   */
  async getClientBoidDetail(
    token: string,
    demat: string,
  ): Promise<MeroShareClientBoid> {
    const response = await this.http.get<MeroShareClientBoid>(
      `/meroShareView/myDetail/${demat}`,
      { headers: { Authorization: token } },
    );
    return response.data;
  }

  /**
   * Fetch list of currently applicable IPOs.
   */
  async getApplicableIpos(token: string): Promise<MeroShareIpo[]> {
    const payload = {
      filterFieldParams: [
        { key: "companyIssue.companyISIN.script", alias: "Scrip" },
        { key: "companyIssue.companyISIN.company.name", alias: "Company Name" },
        {
          key: "companyIssue.assignedToClient.name",
          value: "",
          alias: "Issue Manager",
        },
      ],
      page: 1,
      size: 10,
      searchRoleViewConstants: "VIEW_APPLICABLE_SHARE",
      filterDateParams: [
        { key: "minIssueOpenDate", condition: "", alias: "", value: "" },
        { key: "maxIssueCloseDate", condition: "", alias: "", value: "" },
      ],
    };

    const response = await this.http.post<MeroShareApplicableIssueResponse>(
      "/meroShare/companyShare/applicableIssue/",
      payload,
      { headers: { Authorization: token } },
    );

    const ipos = response.data.object ?? [];
    return ipos.filter(
      (ipo) => ipo.shareTypeName === "IPO" || ipo.shareTypeName === "FPO",
    );
  }

  /**
   * Get bank details by bank code.
   */
  async getBankDetailByCode(
    token: string,
    bankCode: string,
  ): Promise<MeroShareBankDetail | null> {
    try {
      const response = await this.http.get<MeroShareBankDetail>(
        `/bankRequest/${bankCode}/`,
        { headers: { Authorization: token } },
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get list of all available banks.
   */
  async getBankList(token: string): Promise<MeroShareBankListItem[]> {
    const response = await this.http.get<MeroShareBankListItem[]>(
      "/meroShare/bank/",
      {
        headers: { Authorization: token },
      },
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Get customer account details for a specific bank.
   */
  async getBankCustomerCode(
    token: string,
    bankId: number,
  ): Promise<MeroShareBankCustomerCode> {
    const response = await this.http.get<
      MeroShareBankCustomerCode | MeroShareBankCustomerCode[]
    >(`/meroShare/bank/${bankId}/`, { headers: { Authorization: token } });
    const data = Array.isArray(response.data)
      ? response.data[0]
      : response.data;
    if (!data) throw new Error("No bank customer code found");
    return data;
  }

  /**
   * Submit an IPO application.
   */
  async applyIpo(token: string, payload: ApplyIpoPayload): Promise<unknown> {
    const response = await this.http.post<unknown>(
      "/meroShare/applicantForm/share/apply/",
      payload,
      { headers: { Authorization: token } },
    );
    return response.data;
  }

  /**
   * Re-submit an IPO application.
   */
  async reapplyIpo(
    token: string,
    applicantFormId: number,
    payload: ApplyIpoPayload,
  ): Promise<unknown> {
    const response = await this.http.post<unknown>(
      `/meroShare/applicantForm/share/reapply/${applicantFormId}`,
      payload,
      { headers: { Authorization: token } },
    );
    return response.data;
  }

  /**
   * Fetch the application report list for the authenticated account.
   */
  async getApplicationReport(
    token: string,
  ): Promise<MeroShareApplicationListItem[]> {
    const payload = {
      filterFieldParams: [
        { key: "companyShare.companyIssue.companyISIN.script", alias: "Scrip" },
        {
          key: "companyShare.companyIssue.companyISIN.company.name",
          alias: "Company Name",
        },
      ],
      page: 1,
      size: 200,
      searchRoleViewConstants: "VIEW_APPLICANT_FORM_COMPLETE",
      filterDateParams: [
        { key: "appliedDate", condition: "", alias: "", value: "" },
        { key: "appliedDate", condition: "", alias: "", value: "" },
      ],
    };

    const response = await this.http.post<MeroShareApplicationListResponse>(
      "/meroShare/applicantForm/active/search/",
      payload,
      { headers: { Authorization: token } },
    );

    return response.data.object ?? [];
  }

  /**
   * Fetch the application detail for a specific application form.
   */
  async getApplicationDetail(
    token: string,
    applicantFormId: number,
  ): Promise<MeroShareApplicationDetail> {
    const response = await this.http.get<MeroShareApplicationDetail>(
      `/meroShare/applicantForm/report/detail/${applicantFormId}`,
      { headers: { Authorization: token } },
    );
    return response.data;
  }

  /**
   * Fetch the portfolio for the authenticated account.
   * Requires demat number and the DP clientCode (from getOwnDetail).
   */
  async getPortfolio(
    token: string,
    demat: string,
    clientCode: string,
  ): Promise<MeroSharePortfolioResponse> {
    const payload = {
      sortBy: "script",
      demat: [demat],
      clientCode,
      page: 1,
      size: 200,
      sortAsc: true,
    };

    const response = await this.http.post<MeroSharePortfolioResponse>(
      "/meroShareView/myPortfolio/",
      payload,
      { headers: { Authorization: token } },
    );

    return response.data;
  }
}
