import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

const BASE_URL =
  import.meta.env['VITE_API_URL'] ?? 'http://localhost:4000/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send HTTP-only refresh cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptor: attach access token ─────────────────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  ;(config as any).metadata = { startTime: Date.now() }
  const token = getAccessToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// ─── Response Interceptor: auto-refresh on 401 ───────────────────────────────

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token ?? '')
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => {
    const start = (response.config as any).metadata?.startTime
    if (start) {
      const duration = Date.now() - start
      console.log(
        `[Frontend Roundtrip] ${response.config.method?.toUpperCase()} ${response.config.url} took ${duration}ms`,
      )
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    const start = (originalRequest as any)?.metadata?.startTime
    if (start) {
      const duration = Date.now() - start
      console.log(
        `[Frontend Roundtrip Error] ${originalRequest.method?.toUpperCase()} ${originalRequest.url} took ${duration}ms`,
      )
    }

    // If 401 and not already retrying, attempt token refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post<{ data: { accessToken: string } }>(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        )

        const newToken = response.data.data.accessToken
        setAccessToken(newToken)
        processQueue(null, newToken)

        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAccessToken()
        // Redirect to login if refresh fails
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

// ─── Token helpers ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'ipo_access_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}
