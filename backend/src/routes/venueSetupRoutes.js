import { Router } from "express";
import {
  submitVenueSetupRequest,
  getBookingVenueSetupRequest,
  getAdminVenueSetupRequests,
  approveVenueSetupRequest,
  requestVenueSetupChanges,
  declineVenueSetupRequest,
} from "../controllers/venueSetupController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const venueSetupRouter = Router();

venueSetupRouter.post(
  "/bookings/:id/venue-setup",
  requireAuth,
  submitVenueSetupRequest,
);

venueSetupRouter.get(
  "/bookings/:id/venue-setup",
  requireAuth,
  getBookingVenueSetupRequest,
);

venueSetupRouter.get(
  "/admin/venue-setup-requests",
  requireAuth,
  requireRole("Admin"),
  getAdminVenueSetupRequests,
);

venueSetupRouter.post(
  "/admin/venue-setup-requests/:requestId/approve",
  requireAuth,
  requireRole("Admin"),
  approveVenueSetupRequest,
);

venueSetupRouter.post(
  "/admin/venue-setup-requests/:requestId/changes",
  requireAuth,
  requireRole("Admin"),
  requestVenueSetupChanges,
);

venueSetupRouter.post(
  "/admin/venue-setup-requests/:requestId/decline",
  requireAuth,
  requireRole("Admin"),
  declineVenueSetupRequest,
);
