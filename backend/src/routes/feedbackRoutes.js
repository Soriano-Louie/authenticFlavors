import { Router } from "express";
import {
  createFeedback,
  getFeedback,
  checkFeedback,
  getFeedbackForBooking,
} from "../controllers/feedbackController.js";
import { requireAuth } from "../middleware/auth.js";

export const feedbackRouter = Router();

// All feedback endpoints require authentication
feedbackRouter.post("/feedback", requireAuth, createFeedback);
feedbackRouter.get("/feedback/:bookingId", requireAuth, getFeedback);
feedbackRouter.get("/feedback/check/:bookingId", requireAuth, checkFeedback);
