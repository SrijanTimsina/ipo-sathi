import { Router } from "express";
import { accountsAdminController } from "./accounts.admin.controller.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { requireAdmin } from "../../shared/middleware/requireAdmin.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireAdmin);

// GET /api/v1/admin/users/:userId/accounts
router.get("/", asyncHandler(accountsAdminController.listByUserId));

export default router;
