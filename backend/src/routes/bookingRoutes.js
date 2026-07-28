import { Router } from "express";
import {
  createBooking,
  getBookings,
  getAdminBookings,
  getAdminStats,
  getAdminActivity,
  completeBooking,
  verifyBooking,
  rejectBooking,
} from "../controllers/bookingController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const bookingRouter = Router();

// Customer booking endpoints
bookingRouter.post("/bookings", requireAuth, createBooking);
bookingRouter.get("/bookings", requireAuth, getBookings);

// Admin booking endpoints
bookingRouter.get(
  "/admin/bookings",
  requireAuth,
  requireRole("Admin"),
  getAdminBookings,
);
bookingRouter.get(
  "/admin/stats",
  requireAuth,
  requireRole("Admin"),
  getAdminStats,
);
bookingRouter.get(
  "/admin/activity",
  requireAuth,
  requireRole("Admin"),
  getAdminActivity,
);
bookingRouter.post(
  "/admin/bookings/:id/complete",
  requireAuth,
  requireRole("Admin"),
  completeBooking,
);
bookingRouter.post(
  "/admin/bookings/:id/verify",
  requireAuth,
  requireRole("Admin"),
  verifyBooking,
);
bookingRouter.post(
  "/admin/bookings/:id/reject",
  requireAuth,
  requireRole("Admin"),
  rejectBooking,
);
