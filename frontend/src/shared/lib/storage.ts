import type { BrokerAccount } from '../types/api'

const ACCOUNTS_STORAGE_KEY = 'iposathi_local_accounts'

/**
 * Basic obfuscation to prevent casual shoulder-surfing of localStorage.
 * In a production environment, this could be replaced with AES encryption
 * using a user-provided master password.
 */
function encodeData(data: unknown): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)))
  } catch (error) {
    console.error('Failed to encode data', error)
    return ''
  }
}

function decodeData<T>(encodedStr: string): T | null {
  try {
    if (!encodedStr) return null
    return JSON.parse(decodeURIComponent(atob(encodedStr))) as T
  } catch (error) {
    console.error('Failed to decode data', error)
    return null
  }
}

export const localStore = {
  getAccounts(): BrokerAccount[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY)
    if (!stored) return []
    const decoded = decodeData<BrokerAccount[]>(stored)
    return Array.isArray(decoded) ? decoded : []
  },

  setAccounts(accounts: BrokerAccount[]): void {
    if (typeof window === 'undefined') return
    const encoded = encodeData(accounts)
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, encoded)
  },

  getAccount(id: string): BrokerAccount | undefined {
    return this.getAccounts().find((a) => a.id === id)
  },

  addAccount(account: Omit<BrokerAccount, 'createdAt' | 'updatedAt'>): BrokerAccount {
    const accounts = this.getAccounts()
    const now = new Date().toISOString()
    const newAccount: BrokerAccount = {
      ...account,
      createdAt: now,
      updatedAt: now,
    }
    accounts.push(newAccount)
    this.setAccounts(accounts)
    return newAccount
  },

  updateAccount(id: string, updates: Partial<BrokerAccount>): BrokerAccount {
    const accounts = this.getAccounts()
    const index = accounts.findIndex((a) => a.id === id)
    if (index === -1) throw new Error('Account not found')

    const updatedAccount = {
      ...accounts[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    accounts[index] = updatedAccount
    this.setAccounts(accounts)
    return updatedAccount
  },

  deleteAccount(id: string): void {
    const accounts = this.getAccounts()
    const filtered = accounts.filter((a) => a.id !== id)
    this.setAccounts(filtered)
  },

  clearAll(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ACCOUNTS_STORAGE_KEY)
  },
}
