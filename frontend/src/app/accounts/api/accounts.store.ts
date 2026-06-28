import type { BrokerAccount } from '#/shared/types/api'

/**
 * In-memory store for broker accounts fetched from the server.
 *
 * For authenticated users, accounts are loaded once (on login / session
 * restore) and cached here. All browser-direct MeroShare requests read from
 * this store instead of hitting the backend on every query.
 *
 * The store is intentionally module-level (singleton) so it survives
 * component re-renders.
 */

let cachedAccounts: BrokerAccount[] = []

export const accountsStore = {
  /** Replace the full cache with the given accounts. */
  set(accounts: BrokerAccount[]): void {
    cachedAccounts = accounts
  },

  /** Return all cached accounts. */
  getAll(): BrokerAccount[] {
    return cachedAccounts
  },

  /** Return only active accounts. */
  getActive(): BrokerAccount[] {
    return cachedAccounts.filter((a) => a.isActive)
  },

  /** Clear the cache (called on logout). */
  clear(): void {
    cachedAccounts = []
  },

  /** Whether the store has been populated. */
  isPopulated(): boolean {
    return cachedAccounts.length > 0
  },
}
