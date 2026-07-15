import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createCheckout,
  webhook,
  getPaymentStatus,
  getBookingPayments,
  simulateWebhook,
} from "../controllers/paymentController.js";

const router = express.Router();

// Create checkout session for a payment
router.post("/create-checkout", requireAuth, createCheckout);

// Handle PayMongo webhook (no auth required)
router.post("/webhook", webhook);

// Simulate webhook for development (auth required)
router.post("/simulate-webhook", requireAuth, simulateWebhook);

// Get payment status for polling
router.get("/status/:paymentId", requireAuth, getPaymentStatus);

// Get all payments for a booking
router.get("/booking/:bookingId", requireAuth, getBookingPayments);

export const paymentRouter = router;
