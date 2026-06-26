import { Router } from "express";
import { authController } from "./auth.controller.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const router = Router();

// POST /api/v1/auth/login — public
router.post("/login", asyncHandler(authController.login));

// POST /api/v1/auth/refresh — public
router.post("/refresh", asyncHandler(authController.refresh));

// POST /api/v1/auth/logout — requires auth
router.post("/logout", requireAuth, asyncHandler(authController.logout));

export default router;
