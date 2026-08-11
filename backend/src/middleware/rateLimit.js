import rateLimit from "express-rate-limit";

const standardHeaders = true;
const legacyHeaders = false;

// Shared error shape so the frontend can parse it consistently.
function rateLimitResponse(req, res, opts) {
  return res.status(429).json({
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    },
  });
}

// Sensitive auth endpoints (login, register, verify, resend codes).
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders,
  legacyHeaders,
  handler: rateLimitResponse,
});

// Password reset flow — stricter to prevent email bombing.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders,
  legacyHeaders,
  handler: rateLimitResponse,
});

// Payment receipt / profile photo uploads.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders,
  legacyHeaders,
  handler: rateLimitResponse,
});

// Public chatbot endpoint — gates cost of Gemini calls.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders,
  legacyHeaders,
  handler: rateLimitResponse,
});
