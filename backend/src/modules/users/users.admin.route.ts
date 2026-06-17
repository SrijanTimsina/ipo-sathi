import { Router } from "express";
import { usersAdminController } from "./users.admin.controller.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { requireAdmin } from "../../shared/middleware/requireAdmin.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const router = Router();

// All admin routes require both auth and admin role
router.use(requireAuth, requireAdmin);

// GET  /api/v1/admin/users
router.get("/", asyncHandler(usersAdminController.list));

// POST /api/v1/admin/users
router.post("/", asyncHandler(usersAdminController.create));

// GET  /api/v1/admin/users/:id
router.get("/:id", asyncHandler(usersAdminController.getById));

// PUT  /api/v1/admin/users/:id
router.put("/:id", asyncHandler(usersAdminController.update));

// PATCH /api/v1/admin/users/:id/status
router.patch("/:id/status", asyncHandler(usersAdminController.setStatus));

// DELETE /api/v1/admin/users/:id
router.delete("/:id", asyncHandler(usersAdminController.delete));

export default router;
