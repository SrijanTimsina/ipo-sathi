import { Router } from "express";
import { ipoController } from "./ipo.controller.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

const router = Router();

// POST /api/v1/ipo/automate — trigger automation externally
router.post("/automate", (req, res, next) => {
  // Simple protection to prevent abuse. External server must send this header.
  const secret = process.env.AUTOMATION_SECRET;
  if (secret && req.headers["x-automation-secret"] !== secret) {
    return res.status(403).json({ error: "Unauthorized access to automation endpoint" });
  }
  next();
}, asyncHandler(ipoController.automate));

router.use(requireAuth);

// GET  /api/v1/ipo          — list open IPOs
router.get("/", asyncHandler(ipoController.listAvailable));

// POST /api/v1/ipo/apply    — bulk apply
router.post("/apply", asyncHandler(ipoController.bulkApply));

// POST /api/v1/ipo/reapply  — reapply for rejected application
router.post("/reapply", asyncHandler(ipoController.reapply));

// GET  /api/v1/ipo/status   — application statuses
router.get("/status", asyncHandler(ipoController.getStatus));

// GET  /api/v1/ipo/applied  — unique list of applied IPOs
router.get("/applied", asyncHandler(ipoController.getAppliedIpos));

// GET  /api/v1/ipo/capitals — list of MeroShare capitals
router.get("/capitals", asyncHandler(ipoController.getCapitals));

// GET  /api/v1/ipo/results  — allotment results
router.get("/results", asyncHandler(ipoController.getResults));

export default router;
