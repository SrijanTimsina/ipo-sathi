import { Router } from "express";
import { ipoAdminController } from "./ipo.admin.controller.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { requireAdmin } from "../../shared/middleware/requireAdmin.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/v1/admin/ipo?userId=:userId
router.get("/", asyncHandler(ipoAdminController.getActivityForUser));

export default router;
