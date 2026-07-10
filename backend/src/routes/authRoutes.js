import { Router } from "express";
import {
  login,
  logout,
  me,
  refresh,
  register,
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
