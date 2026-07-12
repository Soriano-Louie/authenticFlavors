import { Router } from "express";
import {
  createBooking,
  getBookings,
  getAdminBookings,
  uploadReceipt,
  uploadSingleReceipt,
  verifyPayment,
  rejectPayment,
} from "../controllers/bookingController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const bookingRouter = Router();

// Customer booking endpoints
bookingRouter.post("/bookings", requireAuth, createBooking);
bookingRouter.get("/bookings", requireAuth, getBookings);
bookingRouter.post("/bookings/:id/receipt", requireAuth, uploadSingleReceipt, uploadReceipt);

// Admin booking & payment verification endpoints
bookingRouter.get("/admin/bookings", requireAuth, requireRole("Admin"), getAdminBookings);
bookingRouter.post("/admin/bookings/:id/verify", requireAuth, requireRole("Admin"), verifyPayment);
bookingRouter.post("/admin/bookings/:id/reject", requireAuth, requireRole("Admin"), rejectPayment);
