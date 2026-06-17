import { apiClient } from "#/shared/lib/axios";
import type { ApiSuccess, BrokerAccount, PaginatedData } from "#/shared/types/api";

export interface CreateAccountPayload {
  clientId: string;
  username: string;
  password: string;
  crn: string;
  pin: string;
  autoApply?: boolean;
  autoReApply?: boolean;
}

export interface UpdateAccountPayload {
  clientId?: string;
  username?: string;
  password?: string;
  crn?: string;
  pin?: string;
  isActive?: boolean;
  autoApply?: boolean;
  autoReApply?: boolean;
}

export const accountsRequests = {
  async list(page = 1, limit = 20): Promise<PaginatedData<BrokerAccount>> {
    const res = await apiClient.get<ApiSuccess<PaginatedData<BrokerAccount>>>(
      "/accounts",
      { params: { page, limit } }
    );
    return res.data.data;
  },

  async getById(id: string): Promise<BrokerAccount> {
    const res = await apiClient.get<ApiSuccess<BrokerAccount>>(`/accounts/${id}`);
    return res.data.data;
  },

  async create(payload: CreateAccountPayload): Promise<BrokerAccount> {
    const res = await apiClient.post<ApiSuccess<BrokerAccount>>("/accounts", payload);
    return res.data.data;
  },

  async update(id: string, payload: UpdateAccountPayload): Promise<BrokerAccount> {
    const res = await apiClient.put<ApiSuccess<BrokerAccount>>(`/accounts/${id}`, payload);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/accounts/${id}`);
  },
};
