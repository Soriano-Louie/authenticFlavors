import { Router } from "express";
import {
  submitVenueSetupRequest,
  getBookingVenueSetupRequest,
  getAdminVenueSetupRequests,
  approveVenueSetupRequest,
  requestVenueSetupChanges,
  declineVenueSetupRequest,
} from "../controllers/venueSetupController.js";

export const venueSetupRouter = Router();

venueSetupRouter.post(
  "/bookings/:id/venue-setup",
  submitVenueSetupRequest,
);

venueSetupRouter.get(
  "/bookings/:id/venue-setup",
  getBookingVenueSetupRequest,
);

venueSetupRouter.get(
  "/admin/venue-setup-requests",
  getAdminVenueSetupRequests,
);

venueSetupRouter.post(
  "/admin/venue-setup-requests/:requestId/approve",
  approveVenueSetupRequest,
);

venueSetupRouter.post(
  "/admin/venue-setup-requests/:requestId/changes",
  requestVenueSetupChanges,
);

venueSetupRouter.post(
  "/admin/venue-setup-requests/:requestId/decline",
  declineVenueSetupRequest,
);
