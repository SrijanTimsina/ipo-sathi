import { Router } from "express";
import { portfolioController } from "./portfolio.controller.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);

// GET /api/v1/portfolio — live portfolio across all accounts
router.get("/", asyncHandler(portfolioController.getPortfolio));

export default router;
