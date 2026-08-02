import { Router } from "express";
import {
  getPublicAnnouncements,
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcementController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

export const announcementRouter = Router();

// Public route — fetches published announcements for landing page
announcementRouter.get("/announcements/public", getPublicAnnouncements);

// Admin routes (protected)
announcementRouter.get(
  "/admin/announcements",
  requireAuth,
  requireRole("Admin"),
  getAdminAnnouncements,
);
announcementRouter.post(
  "/admin/announcements",
  requireAuth,
  requireRole("Admin"),
  upload.single("image"),
  createAnnouncement,
);
announcementRouter.put(
  "/admin/announcements/:id",
  requireAuth,
  requireRole("Admin"),
  upload.single("image"),
  updateAnnouncement,
);
announcementRouter.delete(
  "/admin/announcements/:id",
  requireAuth,
  requireRole("Admin"),
  deleteAnnouncement,
);
