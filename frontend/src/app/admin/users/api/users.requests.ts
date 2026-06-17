import { apiClient } from '#/shared/lib/axios'
import type {
  ApiSuccess,
  User,
  PaginatedData,
  BrokerAccount,
} from '#/shared/types/api'

export interface CreateUserPayload {
  name: string
  mobileNumber: string
  password: string
  role: 'admin' | 'user'
}

export interface UpdateUserPayload {
  name?: string
  mobileNumber?: string
  password?: string
  role?: 'admin' | 'user'
}

export const adminUsersRequests = {
  async list(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<PaginatedData<User>> {
    const res = await apiClient.get<ApiSuccess<PaginatedData<User>>>(
      '/admin/users',
      {
        params: { page, limit, ...(search ? { search } : {}) },
      },
    )
    return res.data.data
  },

  async getById(id: string): Promise<User> {
    const res = await apiClient.get<ApiSuccess<User>>(`/admin/users/${id}`)
    return res.data.data
  },

  async create(payload: CreateUserPayload): Promise<User> {
    const res = await apiClient.post<ApiSuccess<User>>('/admin/users', payload)
    return res.data.data
  },

  async update(id: string, payload: UpdateUserPayload): Promise<User> {
    const res = await apiClient.put<ApiSuccess<User>>(
      `/admin/users/${id}`,
      payload,
    )
    return res.data.data
  },

  async setStatus(id: string, isActive: boolean): Promise<User> {
    const res = await apiClient.patch<ApiSuccess<User>>(
      `/admin/users/${id}/status`,
      { isActive },
    )
    return res.data.data
  },

  async delete(id: string): Promise<boolean> {
    const res = await apiClient.delete<ApiSuccess<{ success: boolean }>>(
      `/admin/users/${id}`,
    )
    return res.data.data.success
  },

  async getUserAccounts(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedData<BrokerAccount>> {
    const res = await apiClient.get<ApiSuccess<PaginatedData<BrokerAccount>>>(
      `/admin/users/${userId}/accounts`,
      { params: { page, limit } },
    )
    return res.data.data
  },
}
