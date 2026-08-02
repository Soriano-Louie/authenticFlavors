import { Router } from "express";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationRouter = Router();

notificationRouter.get("/notifications", requireAuth, getUserNotifications);
notificationRouter.patch("/notifications/read-all", requireAuth, markAllAsRead);
notificationRouter.patch("/notifications/:id/read", requireAuth, markAsRead);
notificationRouter.delete("/notifications/:id", requireAuth, deleteNotification);
