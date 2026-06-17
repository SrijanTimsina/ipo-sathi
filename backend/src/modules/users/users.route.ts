import { Router } from "express";
import { usersController } from "./users.controller.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const router = Router();

// GET /api/v1/users/me
router.get("/me", requireAuth, asyncHandler(usersController.getMe));

// PUT /api/v1/users/me/password
router.put("/me/password", requireAuth, asyncHandler(usersController.changePassword));

export default router;
