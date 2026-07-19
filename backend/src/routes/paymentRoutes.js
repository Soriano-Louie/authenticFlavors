import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createCheckout,
  getPaymentStatus,
  getBookingPayments,
} from "../controllers/paymentController.js";

const router = express.Router();

// Create checkout session for a payment
router.post("/create-checkout", requireAuth, createCheckout);

// Get payment status for polling
router.get("/status/:paymentId", requireAuth, getPaymentStatus);

// Get all payments for a booking
router.get("/booking/:bookingId", requireAuth, getBookingPayments);

export const paymentRouter = router;
