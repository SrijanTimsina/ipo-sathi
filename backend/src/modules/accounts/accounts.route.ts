import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { requireAuth } from "../../shared/middleware/requireAuth.js";
import { accountsController } from "./accounts.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(accountsController.list));
router.get("/:id", asyncHandler(accountsController.getById));
router.post("/", asyncHandler(accountsController.create));
router.put("/:id", asyncHandler(accountsController.update));
router.delete("/:id", asyncHandler(accountsController.delete));

router.post("/meroshare/banks", asyncHandler(accountsController.fetchMeroshareBanks));
router.get("/:id/meroshare/banks", asyncHandler(accountsController.fetchBanksForAccount));

export default router;
