import type { Request, Response } from "express";
import { z } from "zod";
import { accountsService } from "./accounts.service.js";
import { sendSuccess, sendError } from "../../shared/utils/response.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const createAccountSchema = z.object({
  clientId: z.string().min(1).max(100),
  username: z.string().min(1).max(255),
  password: z.string().min(1),
  crn: z.string().min(1).max(100),
  pin: z.string().min(1).max(20),
  autoApply: z.boolean().optional(),
  autoReApply: z.boolean().optional(),
});

const updateAccountSchema = z.object({
  clientId: z.string().min(1).max(100).optional(),
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(1).optional(),
  crn: z.string().min(1).max(100).optional(),
  pin: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  autoReApply: z.boolean().optional(),
});

function getUserId(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return req.user.sub;
}

export const accountsController = {
  /**
   * GET /api/v1/accounts
   */
  async list(req: Request, res: Response): Promise<void> {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }
    const result = await accountsService.listOwnAccounts(getUserId(req), parsed.data);
    sendSuccess(res, result);
  },

  /**
   * GET /api/v1/accounts/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    if (!id) throw new AppError(400, "MISSING_PARAM", "Account ID is required");
    const account = await accountsService.getOwnAccount(getUserId(req), id);
    sendSuccess(res, account);
  },

  /**
   * POST /api/v1/accounts
   */
  async create(req: Request, res: Response): Promise<void> {
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }
    const account = await accountsService.createAccount(getUserId(req), parsed.data);
    sendSuccess(res, account, 201);
  },

  /**
   * PUT /api/v1/accounts/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    if (!id) throw new AppError(400, "MISSING_PARAM", "Account ID is required");

    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map((e: any) => e.message).join(", "));
      return;
    }
    const account = await accountsService.updateAccount(getUserId(req), id, parsed.data);
    sendSuccess(res, account);
  },

  /**
   * DELETE /api/v1/accounts/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    if (!id) throw new AppError(400, "MISSING_PARAM", "Account ID is required");
    await accountsService.deleteAccount(getUserId(req), id);
    sendSuccess(res, { message: "Account deleted successfully" });
  },
};
