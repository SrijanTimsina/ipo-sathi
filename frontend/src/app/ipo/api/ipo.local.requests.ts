import type { MeroShareIpo, IpoApplication, BulkApplyResult } from '#/shared/types/api'
import type { BulkApplyPayload } from './ipo.requests'
import { localStore } from '#/shared/lib/storage'
import { MeroShareBrowserClient } from './ipo.meroshare-client'

export const localIpoRequests = {
  async listAvailable(): Promise<MeroShareIpo[]> {
    const accounts = localStore.getAccounts()
    if (accounts.length === 0) return []
    
    // Just use the first account to fetch available IPOs
    const account = accounts[0]
    if (!account.password) return []

    const client = new MeroShareBrowserClient()
    await client.login(account.clientId, account.username, account.password)
    return client.getApplicableIpos()
  },

  async bulkApply(payload: BulkApplyPayload): Promise<BulkApplyResult> {
    const allAccounts = localStore.getAccounts()
    const targetAccounts = payload.accountIds 
      ? allAccounts.filter(a => payload.accountIds!.includes(a.id))
      : allAccounts.filter(a => a.isActive)

    const result: BulkApplyResult = {
      total: targetAccounts.length,
      successful: 0,
      failed: 0,
      applications: []
    }

    const client = new MeroShareBrowserClient()
    
    for (const account of targetAccounts) {
      try {
        if (!account.password) throw new Error("Missing password")
        
        await client.login(account.clientId, account.username, account.password)
        const ownDetail = await client.getOwnDetail()
        const boidDetail = await client.getClientBoidDetail(ownDetail.demat)
        const bankCode = await client.getBankCustomerCode(account.bankId!)

        await client.applyIpo({
          accountBranchId: bankCode.accountBranchId,
          accountNumber: bankCode.accountNumber,
          accountTypeId: bankCode.accountTypeId,
          appliedKitta: payload.kittas,
          bankId: bankCode.id,
          boid: boidDetail.boid,
          companyShareId: payload.companyShareId,
          crnNumber: account.crn,
          customerId: bankCode.id, // MeroShare often expects this as id
          demat: ownDetail.demat,
          transactionPIN: account.pin!
        })
        
        result.successful++
      } catch (error) {
        result.failed++
      }
    }
    
    return result
  },

  async reapply(_payload: { accountId: string; applicantFormId: number }): Promise<{ message: string }> {
    throw new Error('Not supported in local mode')
  },

  getStatus: async (ipoId?: string, accountId?: string): Promise<IpoApplication[]> => {
    const allAccounts = localStore.getAccounts()
    const targetAccounts = accountId 
      ? allAccounts.filter(a => a.id === accountId)
      : allAccounts
      
    const applications: IpoApplication[] = []
    const client = new MeroShareBrowserClient()

    for (const account of targetAccounts) {
      try {
        if (!account.password) continue
        await client.login(account.clientId, account.username, account.password)
        const reports = await client.getApplicationReport()
        
        for (const report of reports) {
          if (ipoId && report.companyShareId.toString() !== ipoId) continue
          
          applications.push({
            id: `${account.id}-${report.companyShareId}`,
            userId: 'local',
            brokerAccountId: account.id,
            username: account.username,
            name: account.name || account.username,
            ipoId: report.companyShareId.toString(),
            ipoName: report.companyName,
            status: report.statusName === 'TRANSACTION_SUCCESS' ? 'applied' : 'pending',
            errorMessage: null,
            quantity: undefined,
            appliedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.error(`Failed to fetch status for ${account.username}`, e)
      }
    }
    
    return applications
  },

  async getResults(): Promise<IpoApplication[]> {
    return localIpoRequests.getStatus()
  },

  getAppliedIpos: async (): Promise<{ companyShareId: number; companyName: string; scrip: string; shareTypeName: string; subGroup: string }[]> => {
    const allAccounts = localStore.getAccounts()
    const iposMap = new Map<number, any>()
    const client = new MeroShareBrowserClient()

    for (const account of allAccounts) {
      try {
        if (!account.password) continue
        await client.login(account.clientId, account.username, account.password)
        const reports = await client.getApplicationReport()
        
        for (const report of reports) {
          if (!iposMap.has(report.companyShareId)) {
            iposMap.set(report.companyShareId, {
              companyShareId: report.companyShareId,
              companyName: report.companyName,
              scrip: report.scrip,
              shareTypeName: report.shareTypeName,
              subGroup: report.subGroup,
            })
          }
        }
      } catch (e) {
        console.error(`Failed to fetch applied IPOs for ${account.username}`, e)
      }
    }
    
    return Array.from(iposMap.values())
  },

  getCapitals: async (): Promise<{ id: number; code: string; name: string }[]> => {
    const client = new MeroShareBrowserClient()
    return client.getCapitals()
  },
}
