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
} from "../controllers/packageController.js";

export const packageRouter = Router();

// Package routes
packageRouter.get("/packages", getPackages);
packageRouter.get("/packages/:id", getPackageById);
packageRouter.get("/packages/:packageId/pricing", getPackagePricing);

// Menu routes
packageRouter.get("/menu/categories", getMenuCategories);
packageRouter.get("/menu/items", getMenuItems);
packageRouter.get("/menu/categories/:categoryId/items", getMenuItemsByCategory);

// Event types and venue setups
packageRouter.get("/event-types", getEventTypes);
packageRouter.get("/venue-setups", getVenueSetups);