import bcrypt from "bcryptjs";
import { usersRepo, type PaginationParams, type PaginatedResult } from "./users.repo.js";
import { AppError } from "../../shared/middleware/errorHandler.js";
import type { SelectUser } from "./users.schema.js";

const BCRYPT_ROUNDS = 12;

export type SafeUser = Omit<SelectUser, "passwordHash">;

function toSafeUser(user: SelectUser): SafeUser {
  const { passwordHash: _hash, ...safe } = user;
  return safe;
}

export interface CreateUserInput {
  name: string;
  mobileNumber: string;
  password: string;
  role: "admin" | "user";
}

export interface UpdateUserInput {
  name?: string;
  mobileNumber?: string;
  password?: string;
  role?: "admin" | "user";
}

export const usersService = {
  /**
   * Get the authenticated user's own profile.
   */
  async getOwnProfile(userId: string): Promise<SafeUser> {
    const user = await usersRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    return toSafeUser(user);
  },

  /**
   * ADMIN: List all users with pagination and optional name search.
   */
  async listUsers(
    pagination: PaginationParams,
    search?: string
  ): Promise<PaginatedResult<SafeUser>> {
    const result = await usersRepo.findAll(pagination, search);
    return {
      ...result,
      data: result.data.map(toSafeUser),
    };
  },

  /**
   * ADMIN: Get any user by ID.
   */
  async getUserById(id: string): Promise<SafeUser> {
    const user = await usersRepo.findById(id);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    return toSafeUser(user);
  },

  /**
   * ADMIN: Create a new system user.
   */
  async createUser(input: CreateUserInput): Promise<SafeUser> {
    const existing = await usersRepo.findByMobileNumber(input.mobileNumber);
    if (existing) {
      throw new AppError(409, "MOBILE_CONFLICT", "A user with this mobile number already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await usersRepo.create({
      name: input.name,
      mobileNumber: input.mobileNumber,
      passwordHash,
      role: input.role,
      isActive: true,
    });

    return toSafeUser(user);
  },

  /**
   * ADMIN: Update a user's profile, optionally changing password.
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<SafeUser> {
    const existing = await usersRepo.findById(id);
    if (!existing) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    // Check mobile conflict if changing mobile number
    if (input.mobileNumber && input.mobileNumber !== existing.mobileNumber) {
      const conflict = await usersRepo.findByMobileNumber(input.mobileNumber);
      if (conflict) {
        throw new AppError(409, "MOBILE_CONFLICT", "A user with this mobile number already exists");
      }
    }

    const updateData: Parameters<typeof usersRepo.update>[1] = {
      ...(input.name && { name: input.name }),
      ...(input.mobileNumber && { mobileNumber: input.mobileNumber }),
      ...(input.role && { role: input.role }),
    };

    if (input.password) {
      updateData.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }

    const updated = await usersRepo.update(id, updateData);
    if (!updated) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    return toSafeUser(updated);
  },

  /**
   * ADMIN: Activate or deactivate a user account.
   */
  async setUserActiveStatus(id: string, isActive: boolean): Promise<SafeUser> {
    const user = await usersRepo.findById(id);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const updated = await usersRepo.setActiveStatus(id, isActive);
    if (!updated) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    return toSafeUser(updated);
  },

  /**
   * ADMIN: Delete a user account.
   */
  async deleteUser(id: string): Promise<void> {
    const user = await usersRepo.findById(id);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const deleted = await usersRepo.delete(id);
    if (!deleted) {
      throw new AppError(500, "INTERNAL_ERROR", "Failed to delete user");
    }
  },

  /**
   * User changes their own password
   */
  async changeOwnPassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await usersRepo.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError(400, "INVALID_CREDENTIALS", "Incorrect old password");
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await usersRepo.update(userId, { passwordHash: newHash });
  },
};
