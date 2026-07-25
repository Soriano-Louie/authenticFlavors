import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getPaymentInstructions,
  uploadReceipt,
  verifyReceipt,
  getPaymentStatus,
  getBookingPayments,
  getAllPayments,
  updatePaymentInstructions,
} from "../controllers/paymentController.js";

const router = express.Router();

// Customer: Get payment instructions for a booking
router.get("/instructions/:bookingId", requireAuth, getPaymentInstructions);

// Customer: Upload payment receipt
router.post("/upload-receipt", requireAuth, uploadReceipt);

// Customer: Get payment status
router.get("/status/:paymentId", requireAuth, getPaymentStatus);

// Customer/Admin: Get all payments for a booking
router.get("/booking/:bookingId", requireAuth, getBookingPayments);

// Admin: Get all payments (with pending verification first)
router.get("/admin/all", requireAuth, requireRole("Admin"), getAllPayments);

// Admin: Verify (approve/reject) a receipt
router.post(
  "/admin/verify/:paymentId",
  requireAuth,
  requireRole("Admin"),
  verifyReceipt,
);

// Admin: Update payment instructions
router.put(
  "/admin/instructions",
  requireAuth,
  requireRole("Admin"),
  updatePaymentInstructions,
);

export const paymentRouter = router;
