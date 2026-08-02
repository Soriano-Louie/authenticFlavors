import { Router } from "express";
import {
  requestMenuChange,
  getBookingMenuChangeRequests,
  getAdminMenuChangeRequests,
  approveMenuChangeRequest,
  rejectMenuChangeRequest,
} from "../controllers/menuChangeController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const menuChangeRouter = Router();

// Customer endpoints
menuChangeRouter.post(
  "/bookings/:id/menu-change",
  requireAuth,
  requestMenuChange,
);
menuChangeRouter.get(
  "/bookings/:id/menu-change-requests",
  requireAuth,
  getBookingMenuChangeRequests,
);

// Admin endpoints
menuChangeRouter.get(
  "/admin/menu-change-requests",
  requireAuth,
  requireRole("Admin"),
  getAdminMenuChangeRequests,
);
menuChangeRouter.post(
  "/admin/menu-change-requests/:requestId/approve",
  requireAuth,
  requireRole("Admin"),
  approveMenuChangeRequest,
);
menuChangeRouter.post(
  "/admin/menu-change-requests/:requestId/reject",
  requireAuth,
  requireRole("Admin"),
  rejectMenuChangeRequest,
);
