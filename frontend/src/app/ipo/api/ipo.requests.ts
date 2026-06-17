import { apiClient } from "#/shared/lib/axios";
import type { ApiSuccess, MeroShareIpo, IpoApplication, BulkApplyResult } from "#/shared/types/api";

export interface BulkApplyPayload {
  companyShareId: number;
  ipoName: string;
  kittas: number;
  accountIds?: string[];
}

export const ipoRequests = {
  async listAvailable(): Promise<MeroShareIpo[]> {
    const res = await apiClient.get<ApiSuccess<MeroShareIpo[]>>("/ipo");
    return res.data.data;
  },

  async bulkApply(payload: BulkApplyPayload): Promise<BulkApplyResult> {
    const res = await apiClient.post<ApiSuccess<BulkApplyResult>>("/ipo/apply", payload);
    return res.data.data;
  },

  async reapply(payload: { accountId: string; applicantFormId: number }): Promise<{ message: string }> {
    const res = await apiClient.post<ApiSuccess<{ message: string }>>("/ipo/reapply", payload);
    return res.data.data;
  },

  getStatus: async (ipoId?: string, accountId?: string): Promise<IpoApplication[]> => {
    let url = "/ipo/status";
    const params = new URLSearchParams();
    if (ipoId) params.append("ipoId", ipoId);
    if (accountId) params.append("accountId", accountId);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    const { data } = await apiClient.get<ApiSuccess<IpoApplication[]>>(url);
    return data.data;
  },

  async getResults(): Promise<IpoApplication[]> {
    const { data } = await apiClient.get<ApiSuccess<IpoApplication[]>>("/ipo/results");
    return data.data;
  },

  getAppliedIpos: async (): Promise<{ companyShareId: number; companyName: string; scrip: string; shareTypeName: string; subGroup: string }[]> => {
    const { data } = await apiClient.get<ApiSuccess<any[]>>("/ipo/applied");
    return data.data;
  },

  getCapitals: async (): Promise<{ id: number; code: string; name: string }[]> => {
    const { data } = await apiClient.get<ApiSuccess<{ id: number; code: string; name: string }[]>>("/ipo/capitals");
    return data.data;
  },
};
