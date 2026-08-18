import { Router } from "express";
import {
  getBlockedDates,
  createBlockedDate,
  deleteBlockedDate,
} from "../controllers/blockedDateController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const blockedDateRouter = Router();

// Admin-only management of dates blocked from the booking calendar.
blockedDateRouter.get(
  "/admin/blocked-dates",
  requireAuth,
  requireRole("Admin"),
  getBlockedDates,
);
blockedDateRouter.post(
  "/admin/blocked-dates",
  requireAuth,
  requireRole("Admin"),
  createBlockedDate,
);
blockedDateRouter.delete(
  "/admin/blocked-dates/:id",
  requireAuth,
  requireRole("Admin"),
  deleteBlockedDate,
);