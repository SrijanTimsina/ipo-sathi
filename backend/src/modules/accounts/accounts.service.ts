import { accountsRepo } from "./accounts.repo.js";
import { AppError } from "../../shared/middleware/errorHandler.js";
import { encrypt, decrypt } from "../../shared/utils/crypto.js";
import { MeroShareClient } from "../ipo/ipo.meroshare.client.js";
import type { SelectBrokerAccount } from "./accounts.schema.js";
import type { PaginationParams, PaginatedResult } from "../users/users.repo.js";

export interface CreateAccountInput {
  clientId: string;
  username: string;
  password: string;
  crn: string;
  pin: string;
  bankId?: number;
  autoApply?: boolean;
  autoReApply?: boolean;
}

export interface UpdateAccountInput {
  clientId?: string;
  username?: string;
  password?: string;
  crn?: string;
  pin?: string;
  bankId?: number;
  isActive?: boolean;
  autoApply?: boolean;
  autoReApply?: boolean;
}

/**
 * Account data with decrypted password/pin.
 * We are returning this to the frontend now because the app is local/personal
 * and the user needs to see/edit their credentials.
 */
export interface DecryptedAccount {
  id: string;
  userId: string;
  clientId: string;
  username: string;
  password: string;
  crn: string;
  pin: string;
  bankId: number | null;
  isActive: boolean;
  autoApply: boolean;
  autoReApply: boolean;
  name: string | null;
  demat: string | null;
  clientCode: string | null;
}

function toDecrypted(account: SelectBrokerAccount): DecryptedAccount {
  return {
    id: account.id,
    userId: account.userId,
    clientId: account.clientId,
    username: account.username,
    password: decrypt(account.passwordEncrypted),
    crn: account.crn,
    pin: decrypt(account.pinEncrypted),
    bankId: account.bankId,
    isActive: account.isActive,
    autoApply: account.autoApply,
    autoReApply: account.autoReApply,
    name: account.name,
    demat: account.demat,
    clientCode: account.clientCode,
  };
}

export const accountsService = {
  /**
   * List a user's own accounts (paginated).
   */
  async listOwnAccounts(
    userId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<DecryptedAccount>> {
    const result = await accountsRepo.findAllByUserId(userId, pagination);
    return {
      ...result,
      data: result.data.map(toDecrypted),
    };
  },

  /**
   * Get a single account — enforces ownership.
   */
  async getOwnAccount(
    userId: string,
    accountId: string,
  ): Promise<DecryptedAccount> {
    const account = await accountsRepo.findById(accountId);
    if (!account) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Broker account not found");
    }
    if (account.userId !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this account",
      );
    }
    return toDecrypted(account);
  },

  /**
   * Add a new broker account for the user.
   */
  async createAccount(
    userId: string,
    input: CreateAccountInput,
  ): Promise<DecryptedAccount> {
    // Verify credentials with MeroShare before saving
    const client = new MeroShareClient();
    let token = "";
    try {
      token = await client.authenticate({
        id: "",
        userId: "",
        clientId: input.clientId,
        username: input.username,
        password: input.password,
        crn: input.crn,
        pin: input.pin,
        isActive: true,
        autoApply: true,
        autoReApply: true,
        name: null,
        demat: null,
        clientCode: null,
        bankId: null,
      });
    } catch (error: any) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        error.message || "MeroShare authentication failed. Please check your credentials.",
      );
    }

    let name: string | null = null;
    let demat: string | null = null;
    let clientCode: string | null = null;
    try {
      const ownDetail = await client.getOwnDetail(token);
      name = ownDetail.name || null;
      demat = ownDetail.demat || null;
      clientCode = ownDetail.clientCode || null;
    } catch {
      // ignore
    }

    const account = await accountsRepo.create({
      userId,
      clientId: input.clientId,
      username: input.username,
      name,
      demat,
      clientCode,
      passwordEncrypted: encrypt(input.password),
      crn: input.crn,
      pinEncrypted: encrypt(input.pin),
      bankId: input.bankId ?? null,
      isActive: true,
      autoApply: input.autoApply ?? true,
      autoReApply: input.autoReApply ?? true,
    });
    return toDecrypted(account);
  },

  /**
   * Update a broker account — enforces ownership.
   */
  async updateAccount(
    userId: string,
    accountId: string,
    input: UpdateAccountInput,
  ): Promise<DecryptedAccount> {
    const account = await accountsRepo.findById(accountId);
    if (!account) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Broker account not found");
    }
    if (account.userId !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this account",
      );
    }

    const updatedClientId = input.clientId ?? account.clientId;
    const updatedUsername = input.username ?? account.username;
    const updatedPassword =
      input.password ?? decrypt(account.passwordEncrypted);

    let updatedName = account.name;
    let updatedDemat = account.demat;
    let updatedClientCode = account.clientCode;

    // If login credentials changed, verify them with MeroShare
    if (input.clientId || input.username || input.password) {
      const client = new MeroShareClient();
      let token = "";
      try {
        token = await client.authenticate({
          id: account.id,
          userId: account.userId,
          clientId: updatedClientId,
          username: updatedUsername,
          password: updatedPassword,
          crn: input.crn ?? account.crn,
          pin: input.pin ?? decrypt(account.pinEncrypted),
          isActive: account.isActive,
          autoApply: account.autoApply,
          autoReApply: account.autoReApply,
          name: account.name,
          demat: account.demat,
          clientCode: account.clientCode,
          bankId: account.bankId,
        });
      } catch (error: any) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          error.message || "MeroShare authentication failed with updated credentials.",
        );
      }

      try {
        const ownDetail = await client.getOwnDetail(token);
        updatedName = ownDetail.name || account.name;
        updatedDemat = ownDetail.demat || account.demat;
        updatedClientCode = ownDetail.clientCode || account.clientCode;
      } catch {
        // ignore
      }
    }

    const updateData: Parameters<typeof accountsRepo.update>[1] = {
      ...(input.clientId && { clientId: input.clientId }),
      ...(input.username && { username: input.username }),
      ...(input.crn && { crn: input.crn }),
      ...(input.password && { passwordEncrypted: encrypt(input.password) }),
      ...(input.pin && { pinEncrypted: encrypt(input.pin) }),
      ...(input.bankId !== undefined && { bankId: input.bankId }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.autoApply !== undefined && { autoApply: input.autoApply }),
      ...(input.autoReApply !== undefined && { autoReApply: input.autoReApply }),
      name: updatedName,
      demat: updatedDemat,
      clientCode: updatedClientCode,
    };

    const updated = await accountsRepo.update(accountId, updateData);
    if (!updated) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Broker account not found");
    }
    return toDecrypted(updated);
  },

  /**
   * Delete a broker account — enforces ownership.
   */
  async deleteAccount(userId: string, accountId: string): Promise<void> {
    const account = await accountsRepo.findById(accountId);
    if (!account) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Broker account not found");
    }
    if (account.userId !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this account",
      );
    }
    await accountsRepo.delete(accountId);
  },

  /**
   * ADMIN: List accounts for any user (read-only).
   */
  async listUserAccounts(
    userId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<DecryptedAccount>> {
    const result = await accountsRepo.findAllByUserId(userId, pagination);
    return {
      ...result,
      data: result.data.map(toDecrypted),
    };
  },

  /**
   * INTERNAL: Get decrypted accounts for a user — used only by IPO service.
   * Never expose this in a controller response.
   */
  async getDecryptedAccountsForUser(
    userId: string,
  ): Promise<DecryptedAccount[]> {
    const accounts = await accountsRepo.findActiveByUserId(userId);
    return accounts.map(toDecrypted);
  },

  /**
   * INTERNAL: Get all active decrypted accounts for all users — used only by automation service.
   * Never expose this in a controller response.
   */
  async getAllActiveDecryptedAccounts(): Promise<DecryptedAccount[]> {
    const accounts = await accountsRepo.findAllActive();
    return accounts.map(toDecrypted);
  },

  /**
   * Fetch bank list directly from MeroShare (stateless, used for Add Account wizard step 2)
   */
  async fetchMeroshareBanks(clientId: string, username: string, password: string) {
    const client = new MeroShareClient();
    try {
      const token = await client.authenticate({
        id: "",
        userId: "",
        clientId,
        username,
        password,
        crn: "",
        pin: "",
        isActive: true,
        autoApply: true,
        autoReApply: true,
        name: null,
        demat: null,
        clientCode: null,
        bankId: null,
      });
      const banks = await client.getBankList(token);
      return banks;
    } catch (error: any) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        error.message || "MeroShare authentication failed.",
      );
    }
  },

  /**
   * Fetch bank list for an existing account
   */
  async fetchBanksForAccount(userId: string, accountId: string) {
    const account = await this.getOwnAccount(userId, accountId);
    const client = new MeroShareClient();
    try {
      const token = await client.authenticate(account);
      const banks = await client.getBankList(token);
      return banks;
    } catch (error: any) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        error.message || "Failed to fetch banks for account.",
      );
    }
  },
};
