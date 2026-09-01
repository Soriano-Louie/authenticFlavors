import { Router } from "express";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  setUserStatus,
} from "../controllers/userController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const userRouter = Router();

// Admin User Management Routes (Protected by Bearer + Admin role)
userRouter.get("/admin/users", requireAuth, requireRole("Admin"), getAdminUsers);
userRouter.post("/admin/users", requireAuth, requireRole("Admin"), createAdminUser);
userRouter.put("/admin/users/:id", requireAuth, requireRole("Admin"), updateAdminUser);
userRouter.patch("/admin/users/:id/status", requireAuth, requireRole("Admin"), setUserStatus);
