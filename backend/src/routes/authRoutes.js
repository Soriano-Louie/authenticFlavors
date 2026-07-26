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
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/me", requireAuth, me);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.put("/profile", requireAuth, updateProfile);

// Email verification
authRouter.post("/send-verification", sendVerification);
authRouter.post("/verify-email", verifyEmail);

// Password reset
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
