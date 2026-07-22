import { Router } from "express";
import {
  sendMessage,
  getConversations,
  getMessages,
  startBookingSession,
  updateBookingSession,
  completeBookingSession,
} from "../controllers/chatbotController.js";
import { requireAuth } from "../middleware/auth.js";

export const chatbotRouter = Router();

// ─── Public endpoint (optional auth) ─────────────────────────────────────────
// The sendMessage endpoint works with or without authentication.
// If authenticated, conversations are persisted to the database.
// If unauthenticated, the AI still responds but without persistence.
chatbotRouter.post(
  "/chat/message",
  (req, res, next) => {
    // Try to authenticate, but don't fail if no token is provided
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      return requireAuth(req, res, (err) => {
        if (!err) return next();
        // If token is invalid, just continue without auth
        return next();
      });
    }
    return next();
  },
  sendMessage,
);

// ─── Authenticated endpoints ─────────────────────────────────────────────────
chatbotRouter.get("/chat/conversations", requireAuth, getConversations);
chatbotRouter.get("/chat/conversations/:id/messages", requireAuth, getMessages);

// ─── Booking Session endpoints (wizard ↔ AI tables) ──────────────────────────
chatbotRouter.post("/chat/booking-session/start", requireAuth, startBookingSession);
chatbotRouter.post("/chat/booking-session/update", requireAuth, updateBookingSession);
chatbotRouter.post("/chat/booking-session/complete", requireAuth, completeBookingSession);
