import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload, validateImageSignature } from "../middleware/upload.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import {
  getPaymentInstructions,
  uploadReceipt,
  uploadReceiptFile,
  verifyReceipt,
  getPaymentStatus,
  getBookingPayments,
  getAllPayments,
  updatePaymentInstructions,
  getOverduePayments,
  sendPaymentReminder,
  cancelBookingForOverdue,
} from "../controllers/paymentController.js";

const router = express.Router();

// Customer: Get payment instructions for a booking
router.get("/instructions/:bookingId", requireAuth, getPaymentInstructions);

// Customer: Upload payment receipt (direct URL — for frontend Cloudinary upload)
router.post("/upload-receipt", requireAuth, uploadLimiter, uploadReceipt);

// Customer: Upload payment receipt file (multer + server-side Cloudinary upload)
router.post(
  "/upload-receipt-file",
  requireAuth,
  uploadLimiter,
  upload.single("receipt"),
  validateImageSignature,
  uploadReceiptFile,
);

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

// Admin: Get overdue payments
router.get(
  "/admin/overdue",
  requireAuth,
  requireRole("Admin"),
  getOverduePayments,
);

// Admin: Send payment reminder email
router.post(
  "/admin/overdue/remind/:paymentId",
  requireAuth,
  requireRole("Admin"),
  sendPaymentReminder,
);

// Admin: Cancel booking for overdue payment
router.post(
  "/admin/overdue/cancel/:paymentId",
  requireAuth,
  requireRole("Admin"),
  cancelBookingForOverdue,
);

export const paymentRouter = router;
