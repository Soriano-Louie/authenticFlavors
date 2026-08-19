import { Router } from "express";
import {
  adminGetCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminGetMenuItems,
  adminCreateMenuItem,
  adminUpdateMenuItem,
  adminDeleteMenuItem,
} from "../controllers/menuController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const menuRouter = Router();

// Admin menu category routes
menuRouter.get(
  "/admin/menu/categories",
  requireAuth,
  requireRole("Admin"),
  adminGetCategories,
);
menuRouter.post(
  "/admin/menu/categories",
  requireAuth,
  requireRole("Admin"),
  adminCreateCategory,
);
menuRouter.put(
  "/admin/menu/categories/:id",
  requireAuth,
  requireRole("Admin"),
  adminUpdateCategory,
);
menuRouter.delete(
  "/admin/menu/categories/:id",
  requireAuth,
  requireRole("Admin"),
  adminDeleteCategory,
);

// Admin menu item routes
menuRouter.get(
  "/admin/menu/items",
  requireAuth,
  requireRole("Admin"),
  adminGetMenuItems,
);
menuRouter.post(
  "/admin/menu/items",
  requireAuth,
  requireRole("Admin"),
  adminCreateMenuItem,
);
menuRouter.put(
  "/admin/menu/items/:id",
  requireAuth,
  requireRole("Admin"),
  adminUpdateMenuItem,
);
menuRouter.delete(
  "/admin/menu/items/:id",
  requireAuth,
  requireRole("Admin"),
  adminDeleteMenuItem,
);
