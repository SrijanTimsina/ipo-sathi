import axios from 'axios'
import type { AxiosInstance } from 'axios'

const MEROSHARE_BASE = 'https://webbackend.cdsc.com.np/api'
const REQUEST_TIMEOUT = 30_000

export interface MeroShareOwnDetail {
  demat: string
  boid: string
  name: string
  clientCode: string
  [key: string]: unknown
}

export interface MeroShareClientBoid {
  boid: string
  bankCode: string
  [key: string]: unknown
}

export interface MeroShareIpo {
  companyShareId: number
  companyName: string
  shareTypeName: string
  issueManager: string
  minUnit: number
  maxUnit: number
  issueOpenDate: string
  issueCloseDate: string
  [key: string]: unknown
}

export interface MeroShareApplicableIssueResponse {
  object?: MeroShareIpo[]
  [key: string]: unknown
}

export type MeroShareApplicationListStatus =
  | 'BLOCKED_APPROVE'
  | 'TRANSACTION_SUCCESS'
  | 'BLOCK_FAILED'

export interface MeroShareApplicationListItem {
  companyShareId: number
  subGroup: string
  scrip: string
  companyName: string
  shareTypeName: 'IPO' | 'FPO'
  shareGroupName: string
  statusName: MeroShareApplicationListStatus
  applicantFormId: number
}

export interface MeroShareApplicationListResponse {
  object?: MeroShareApplicationListItem[]
  totalCount: number
}

export interface MeroShareApplicationDetail {
  applicantFormId: number
  companyShareId: number
  statusName: string
  statusDescription: string
  receivedKitta?: number
  appliedKitta?: number
  meroshareRemark?: string
  reasonOrRemark?: string
  reason?: string
  [key: string]: unknown
}

export interface MeroShareBankDetail {
  id: string
  accountNumber: string
  accountBranchId: number
  accountTypeId: number
  bank:
    | { id: number; [key: string]: unknown }
    | Array<{ id: number; [key: string]: unknown }>
  branch:
    | { id: number; [key: string]: unknown }
    | Array<{ id: number; [key: string]: unknown }>
  [key: string]: unknown
}

export interface MeroShareBankListItem {
  id: number
  code: string
  name: string
  [key: string]: unknown
}

export interface MeroShareBankCustomerCode {
  id: number
  accountNumber: string
  accountBranchId: number
  accountTypeId: number
  [key: string]: unknown
}

export interface MeroSharePortfolioItem {
  currentBalance: number
  lastTransactionPrice: string
  previousClosingPrice: string
  script: string
  scriptDesc: string
  valueAsOfLastTransactionPrice: string
  valueAsOfPreviousClosingPrice: string
  valueOfLastTransPrice: number
  valueOfPrevClosingPrice: number
}

export interface MeroSharePortfolioResponse {
  meroShareMyPortfolio: MeroSharePortfolioItem[]
  totalItems: number
  totalValueAsOfLastTransactionPrice: string
  totalValueAsOfPreviousClosingPrice: string
  totalValueOfLastTransPrice: number
  totalValueOfPrevClosingPrice: number
}

export interface ApplyIpoPayload {
  accountBranchId: number
  accountNumber: string
  accountTypeId: number
  appliedKitta: number
  bankId: number
  boid: string
  companyShareId: number
  crnNumber: string
  customerId: number
  demat: string
  transactionPIN: string
}

interface TokenCacheEntry {
  token: string
  expiresAt: number
}

// Global cache to persist across component re-renders
const authCache = new Map<string, TokenCacheEntry>()

export class MeroShareBrowserClient {
  private readonly http: AxiosInstance
  private currentToken: string | null = null

  constructor() {
    this.http = axios.create({
      baseURL: MEROSHARE_BASE,
      timeout: REQUEST_TIMEOUT,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
    })

    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data) {
          const resData = error.response.data
          if (typeof resData === 'string') {
            error.message = resData
          } else if (resData.message) {
            error.message = resData.message
          } else if (resData.error) {
            error.message = resData.error
          }
        }
        return Promise.reject(error)
      },
    )
  }

  async login(
    clientId: string | number,
    username: string,
    password?: string,
    force: boolean = false,
  ): Promise<string> {
    const cacheKey = `${clientId}:${username}`
    const cached = authCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now() && !force) {
      this.currentToken = cached.token
      return cached.token
    }

    if (!password) {
      throw new Error(
        `Authentication failed for ${username}: Password is required`,
      )
    }

    const response = await this.http.post<unknown>('/meroShare/auth/', {
      clientId: Number(clientId),
      username,
      password,
    })

    const token = (
      response.headers['authorization'] as string | undefined
    )?.trim()
    if (!token) {
      throw new Error(
        `Authentication failed for ${username}: no token in response`,
      )
    }

    authCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })
    this.currentToken = token

    return token
  }

  private getToken(): string {
    if (!this.currentToken)
      throw new Error('MeroShareBrowserClient is not authenticated')
    return this.currentToken
  }

  async getOwnDetail(): Promise<MeroShareOwnDetail> {
    const response = await this.http.get<MeroShareOwnDetail>(
      '/meroShare/ownDetail/',
      {
        headers: { Authorization: this.getToken() },
      },
    )
    return response.data
  }

  async getClientBoidDetail(demat: string): Promise<MeroShareClientBoid> {
    const response = await this.http.get<MeroShareClientBoid>(
      `/meroShareView/myDetail/${demat}`,
      {
        headers: { Authorization: this.getToken() },
      },
    )
    return response.data
  }

  async getApplicableIpos(): Promise<MeroShareIpo[]> {
    const payload = {
      filterFieldParams: [
        { key: 'companyIssue.companyISIN.script', alias: 'Scrip' },
        { key: 'companyIssue.companyISIN.company.name', alias: 'Company Name' },
        {
          key: 'companyIssue.assignedToClient.name',
          value: '',
          alias: 'Issue Manager',
        },
      ],
      page: 1,
      size: 10,
      searchRoleViewConstants: 'VIEW_APPLICABLE_SHARE',
      filterDateParams: [
        { key: 'minIssueOpenDate', condition: '', alias: '', value: '' },
        { key: 'maxIssueCloseDate', condition: '', alias: '', value: '' },
      ],
    }

    const response = await this.http.post<MeroShareApplicableIssueResponse>(
      '/meroShare/companyShare/applicableIssue/',
      payload,
      { headers: { Authorization: this.getToken() } },
    )

    const ipos = response.data.object ?? []

    return ipos.filter(
      (ipo) =>
        ipo.shareTypeName === 'IPO' &&
        ipo.shareGroupName === 'Ordinary Shares' &&
        ipo.subGroup === 'For General Public',
    )
  }

  async getBankList(): Promise<MeroShareBankListItem[]> {
    const response = await this.http.get<MeroShareBankListItem[]>(
      '/meroShare/bank/',
      {
        headers: { Authorization: this.getToken() },
      },
    )
    return Array.isArray(response.data) ? response.data : []
  }

  async getBankCustomerCode(
    bankId: number,
  ): Promise<MeroShareBankCustomerCode> {
    const response = await this.http.get<
      MeroShareBankCustomerCode | MeroShareBankCustomerCode[]
    >(`/meroShare/bank/${bankId}/`, {
      headers: { Authorization: this.getToken() },
    })
    const data = (
      Array.isArray(response.data) ? response.data[0] : response.data
    ) as MeroShareBankCustomerCode | undefined
    if (!data) throw new Error('No bank customer code found')
    return data
  }

  async applyIpo(payload: ApplyIpoPayload): Promise<unknown> {
    const response = await this.http.post<unknown>(
      '/meroShare/applicantForm/share/apply/',
      payload,
      { headers: { Authorization: this.getToken() } },
    )
    return response.data
  }

  async getApplicationReport(): Promise<MeroShareApplicationListItem[]> {
    const payload = {
      filterFieldParams: [
        { key: 'companyShare.companyIssue.companyISIN.script', alias: 'Scrip' },
        {
          key: 'companyShare.companyIssue.companyISIN.company.name',
          alias: 'Company Name',
        },
      ],
      page: 1,
      size: 200,
      searchRoleViewConstants: 'VIEW_APPLICANT_FORM_COMPLETE',
      filterDateParams: [
        { key: 'appliedDate', condition: '', alias: '', value: '' },
        { key: 'appliedDate', condition: '', alias: '', value: '' },
      ],
    }

    const response = await this.http.post<MeroShareApplicationListResponse>(
      '/meroShare/applicantForm/active/search/',
      payload,
      { headers: { Authorization: this.getToken() } },
    )

    return response.data.object ?? []
  }

  async getApplicationDetail(
    applicantFormId: number,
  ): Promise<MeroShareApplicationDetail> {
    const response = await this.http.get<MeroShareApplicationDetail>(
      `/meroShare/applicantForm/report/detail/${applicantFormId}`,
      { headers: { Authorization: this.getToken() } },
    )
    return response.data
  }

  async getPortfolio(
    demat: string,
    clientCode: string,
  ): Promise<MeroSharePortfolioResponse> {
    const payload = {
      sortBy: 'script',
      demat: [demat],
      clientCode,
      page: 1,
      size: 200,
      sortAsc: true,
    }

    const response = await this.http.post<MeroSharePortfolioResponse>(
      '/meroShareView/myPortfolio/',
      payload,
      { headers: { Authorization: this.getToken() } },
    )
    return response.data
  }

  async getCapitals(): Promise<{ id: number; code: string; name: string }[]> {
    const response = await this.http.get<
      { id: number; code: string; name: string }[]
    >('/meroShare/capital/')
    return Array.isArray(response.data) ? response.data : []
  }
}
