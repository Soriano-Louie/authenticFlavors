import { Router } from "express";
import {
  getPackageById,
  getPackages,
  getMenuCategories,
  getMenuItems,
  getMenuItemsByCategory,
  getEventTypes,
  getVenueSetups,
  getPackagePricing,
  getHomepageStatistics,
  getUpcomingEvents,
  getAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  deletePackageImage,
} from "../controllers/packageController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

export const packageRouter = Router();

// Public package routes
packageRouter.get("/packages", getPackages);
packageRouter.get("/packages/:id", getPackageById);
packageRouter.get("/packages/:packageId/pricing", getPackagePricing);

// Admin package routes (protected)
packageRouter.get(
  "/admin/packages",
  requireAuth,
  requireRole("Admin"),
  getAllPackages,
);
packageRouter.post(
  "/admin/packages",
  requireAuth,
  requireRole("Admin"),
  upload.single("image"),
  createPackage,
);
packageRouter.put(
  "/admin/packages/:id",
  requireAuth,
  requireRole("Admin"),
  upload.single("image"),
  updatePackage,
);
packageRouter.delete(
  "/admin/packages/:id",
  requireAuth,
  requireRole("Admin"),
  deletePackage,
);
packageRouter.delete(
  "/admin/packages/:id/image",
  requireAuth,
  requireRole("Admin"),
  deletePackageImage,
);

// Menu routes
packageRouter.get("/menu/categories", getMenuCategories);
packageRouter.get("/menu/items", getMenuItems);
packageRouter.get("/menu/categories/:categoryId/items", getMenuItemsByCategory);

// Event types and venue setups
packageRouter.get("/event-types", getEventTypes);
packageRouter.get("/venue-setups", getVenueSetups);

// Homepage routes
packageRouter.get("/homepage/statistics", getHomepageStatistics);
packageRouter.get("/homepage/upcoming-events", getUpcomingEvents);
