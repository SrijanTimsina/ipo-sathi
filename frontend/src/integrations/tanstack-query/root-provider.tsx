import { QueryClient } from '@tanstack/react-query'

// Singleton instance — shared across the app so AuthContext and other
// non-component code can write into the same cache that React components read.
export const queryClient = new QueryClient()

export function getContext() {
  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
