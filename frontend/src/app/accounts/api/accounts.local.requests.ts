import type { BrokerAccount, PaginatedData } from '#/shared/types/api'
import type {
  CreateAccountPayload,
  UpdateAccountPayload,
  BankListResponse,
} from './accounts.requests'
import { localStore } from '#/shared/lib/storage'
import { MeroShareBrowserClient } from '#/app/ipo/api/ipo.meroshare-client'

export const localAccountsRequests = {
  async list(page = 1, limit = 20): Promise<PaginatedData<BrokerAccount>> {
    const allAccounts = localStore.getAccounts()
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginated = allAccounts.slice(startIndex, endIndex)

    return {
      data: paginated,
      total: allAccounts.length,
      page,
      limit,
      totalPages: Math.ceil(allAccounts.length / limit),
    }
  },

  async getById(id: string): Promise<BrokerAccount> {
    const account = localStore.getAccount(id)
    if (!account) throw new Error('Account not found in local storage')
    return account
  },

  async create(payload: CreateAccountPayload): Promise<BrokerAccount> {
    const allAccounts = localStore.getAccounts()
    const isDuplicate = allAccounts.some(
      (a) => a.clientId === payload.clientId && a.username === payload.username
    )
    if (isDuplicate) {
      throw new Error('This account is already added.')
    }

    let name: string | null = null
    let demat: string | null = null
    let clientCode: string | null = null

    try {
      const client = new MeroShareBrowserClient()
      await client.login(payload.clientId, payload.username, payload.password)
      const ownDetail = await client.getOwnDetail()
      name = ownDetail.name || null
      demat = ownDetail.demat || null
      clientCode = ownDetail.clientCode || null
    } catch (e) {
      console.error('Failed to fetch user details during account creation', e)
      // If login fails, we still create the account, or maybe we should throw?
      // The backend validates credentials and throws if login fails. Let's do that.
      if (e instanceof Error && e.message.includes('Authentication failed')) {
        throw e
      }
    }

    const id = crypto.randomUUID()
    const newAccount = localStore.addAccount({
      id,
      userId: 'local-user', // Mock user id
      clientId: payload.clientId,
      username: payload.username,
      password: payload.password,
      crn: payload.crn,
      pin: payload.pin,
      bankId: payload.bankId,
      isActive: true,
      autoApply: payload.autoApply ?? false,
      autoReApply: payload.autoReApply ?? false,
      name,
      demat,
      clientCode,
    })
    return newAccount
  },

  async update(
    id: string,
    payload: UpdateAccountPayload,
  ): Promise<BrokerAccount> {
    const existingAccount = localStore.getAccount(id)
    if (!existingAccount) throw new Error('Account not found in local storage')

    let updatedName = existingAccount.name
    let updatedDemat = existingAccount.demat
    let updatedClientCode = existingAccount.clientCode

    if (payload.clientId || payload.username || payload.password) {
      const clientId = payload.clientId ?? existingAccount.clientId
      const username = payload.username ?? existingAccount.username
      
      if (clientId !== existingAccount.clientId || username !== existingAccount.username) {
        const allAccounts = localStore.getAccounts()
        const isDuplicate = allAccounts.some(
          (a) => a.id !== id && a.clientId === clientId && a.username === username
        )
        if (isDuplicate) {
          throw new Error('Another account with these credentials already exists.')
        }
      }

      const client = new MeroShareBrowserClient()
      const password = payload.password ?? existingAccount.password

      if (!password) {
        throw new Error('Password is required for verification')
      }

      try {
        await client.login(clientId, username, password, true)
        const ownDetail = await client.getOwnDetail()
        updatedName = ownDetail.name || existingAccount.name
        updatedDemat = ownDetail.demat || existingAccount.demat
        updatedClientCode = ownDetail.clientCode || existingAccount.clientCode
      } catch (e) {
        console.error(
          'Failed to authenticate or fetch user details during update',
          e,
        )
        if (e instanceof Error && e.message.includes('Authentication failed')) {
          throw e
        }
      }
    }

    const updatePayload: Partial<BrokerAccount> = {
      ...payload,
      name: updatedName,
      demat: updatedDemat,
      clientCode: updatedClientCode,
    }

    return localStore.updateAccount(id, updatePayload)
  },

  async delete(id: string): Promise<void> {
    localStore.deleteAccount(id)
  },

  async fetchMeroshareBanks(
    payload: Pick<CreateAccountPayload, 'clientId' | 'username' | 'password'>,
  ): Promise<BankListResponse[]> {
    const client = new MeroShareBrowserClient()
    await client.login(payload.clientId, payload.username, payload.password)
    const banks = await client.getBankList()
    return banks.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
    }))
  },

  async fetchBanksForAccount(id: string): Promise<BankListResponse[]> {
    const account = localStore.getAccount(id)
    if (!account) throw new Error('Account not found')
    if (!account.password) throw new Error('Password required to fetch banks')

    const client = new MeroShareBrowserClient()
    await client.login(account.clientId, account.username, account.password)
    const banks = await client.getBankList()
    return banks.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
    }))
  },
}
