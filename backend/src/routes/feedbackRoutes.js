import { Router } from "express";
import {
  createFeedback,
  getFeedback,
  checkFeedback,
  getPublicFeedbacks,
  getFeedbackForBooking,
  getAdminFeedbackAnalysis,
  reanalyzeFeedback,
  reanalyzeAllFeedbacks,
  deleteAdminFeedback,
} from "../controllers/feedbackController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const feedbackRouter = Router();

// Public endpoint — no auth required
feedbackRouter.get("/feedbacks/public", getPublicFeedbacks);

// Customer feedback endpoints requiring authentication
feedbackRouter.post("/feedback", requireAuth, createFeedback);
feedbackRouter.get("/feedback/:bookingId", requireAuth, getFeedback);
feedbackRouter.get("/feedback/check/:bookingId", requireAuth, checkFeedback);

// Admin AI Feedback Analysis endpoints
feedbackRouter.get(
  "/admin/feedback-analysis",
  requireAuth,
  requireRole("Admin"),
  getAdminFeedbackAnalysis,
);
feedbackRouter.post(
  "/admin/feedback/:id/reanalyze",
  requireAuth,
  requireRole("Admin"),
  reanalyzeFeedback,
);
feedbackRouter.post(
  "/admin/feedback/reanalyze-all",
  requireAuth,
  requireRole("Admin"),
  reanalyzeAllFeedbacks,
);
feedbackRouter.delete(
  "/admin/feedback/:id",
  requireAuth,
  requireRole("Admin"),
  deleteAdminFeedback,
);

