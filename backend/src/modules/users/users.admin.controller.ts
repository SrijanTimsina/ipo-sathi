import type { Request, Response } from "express";
import { z } from "zod";
import { usersService } from "./users.service.js";
import { sendSuccess, sendError } from "../../shared/utils/response.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  mobileNumber: z.string().min(7).max(20),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  mobileNumber: z.string().min(7).max(20).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["admin", "user"]).optional(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

/**
 * Admin-context controller — full CRUD + activate/deactivate.
 */
export const usersAdminController = {
  /**
   * GET /api/v1/admin/users
   * Paginated list of all system users.
   */
  async list(req: Request, res: Response): Promise<void> {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }

    const { page, limit, search } = parsed.data;
    const result = await usersService.listUsers({ page, limit }, search);
    sendSuccess(res, result);
  },

  /**
   * POST /api/v1/admin/users
   * Create a new system user.
   */
  async create(req: Request, res: Response): Promise<void> {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }

    const user = await usersService.createUser(parsed.data);
    sendSuccess(res, user, 201);
  },

  /**
   * GET /api/v1/admin/users/:id
   * Get full profile for any user.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    if (!id) throw new AppError(400, "MISSING_PARAM", "User ID is required");
    const user = await usersService.getUserById(id);
    sendSuccess(res, user);
  },

  /**
   * PUT /api/v1/admin/users/:id
   * Update a user's name, mobile number, password, or role.
   */
  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    if (!id) throw new AppError(400, "MISSING_PARAM", "User ID is required");

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }

    const user = await usersService.updateUser(id, parsed.data);
    sendSuccess(res, user);
  },

  /**
   * PATCH /api/v1/admin/users/:id/status
   * Activate or deactivate a user account.
   */
  async setStatus(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    if (!id) throw new AppError(400, "MISSING_PARAM", "User ID is required");

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }

    const user = await usersService.setUserActiveStatus(id, parsed.data.isActive);
    sendSuccess(res, user);
  },

  /**
   * DELETE /api/v1/admin/users/:id
   * Delete a user account.
   */
  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    if (!id) throw new AppError(400, "MISSING_PARAM", "User ID is required");

    await usersService.deleteUser(id);
    sendSuccess(res, { success: true });
  },
};
