/**
 * Shared API response types.
 * These mirror the backend's standard envelope format.
 */

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  code: string
  message: string
}

export interface ApiFailure {
  success: false
  error: ApiError
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export interface PaginatedData<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user'

export interface User {
  id: string
  name: string
  mobileNumber: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BrokerAccount {
  id: string
  userId: string
  clientId: string
  username: string
  password?: string
  pin?: string
  name?: string | null
  demat?: string | null
  clientCode?: string | null
  crn: string
  bankId?: number | null
  isActive: boolean
  autoApply: boolean
  autoReApply: boolean
  createdAt: string
  updatedAt: string
}

export type IpoStatus =
  | 'applied'
  | 'pending'
  | 'allotted'
  | 'not_allotted'
  | 'error'
  | 'not_applied'

export interface IpoApplication {
  id: string
  userId: string
  brokerAccountId: string
  username?: string
  name?: string
  ipoId: string
  ipoName: string
  status: IpoStatus
  errorMessage: string | null
  quantity?: number
  meroShareRemark?: string
  appliedAt: string
  updatedAt: string
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
  scrip?: string
  subGroup?: string
}

export interface BulkApplyResult {
  total: number
  successful: number
  failed: number
  applications: IpoApplication[]
}

export interface AuthUser {
  id: string
  name: string
  mobileNumber: string
  role: UserRole
}

// ─── Portfolio Types ──────────────────────────────────────────────────────────

export interface PortfolioHolding {
  script: string
  scriptDesc: string
  currentBalance: number
  lastTransactionPrice: number
  previousClosingPrice: number
  valueOfLastTransPrice: number
  valueOfPrevClosingPrice: number
}

export interface AccountPortfolio {
  accountId: string
  accountName: string | null
  demat: string | null
  holdings: PortfolioHolding[]
  totalItems: number
  totalValue: number
  totalValuePrevClose: number
  error?: string
}

export interface PortfolioResponse {
  accounts: AccountPortfolio[]
  grandTotalValue: number
  grandTotalValuePrevClose: number
}
