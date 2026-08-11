import { Router } from "express";
import {
  login,
  logout,
  me,
  refresh,
  register,
  sendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  updateProfile,
  uploadProfilePhoto,
  requestEmailChange,
  verifyEmailChange,
  changePassword,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadProfilePhoto as uploadProfilePhotoMiddleware, validateImageSignature } from "../middleware/upload.js";
import { authLimiter, passwordResetLimiter, uploadLimiter } from "../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, register);
authRouter.post("/login", authLimiter, login);
authRouter.get("/me", requireAuth, me);
authRouter.post("/refresh", authLimiter, refresh);
authRouter.post("/logout", requireAuth, logout);
authRouter.put("/profile", requireAuth, updateProfile);
authRouter.post(
  "/profile/photo",
  requireAuth,
  uploadLimiter,
  uploadProfilePhotoMiddleware.single("photo"),
  validateImageSignature,
  uploadProfilePhoto,
);

// Email verification
authRouter.post("/send-verification", authLimiter, sendVerification);
authRouter.post("/verify-email", authLimiter, verifyEmail);

// Verified email change (requires login)
authRouter.post("/change-email/request", requireAuth, requestEmailChange);
authRouter.post("/change-email/verify", requireAuth, verifyEmailChange);

// Secure password change (requires login)
authRouter.post("/change-password", requireAuth, changePassword);

// Password reset
authRouter.post("/forgot-password", passwordResetLimiter, forgotPassword);
authRouter.post("/reset-password", passwordResetLimiter, resetPassword);
