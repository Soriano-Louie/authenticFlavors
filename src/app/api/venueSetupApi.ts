export interface VenueSetupRequest {
  request_id: number;
  booking_id: number;
  user_id: number;
  venue_setup_notes: string;
  admin_response: string | null;
  status: "Pending" | "Approved" | "Changes_Requested" | "Declined";
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  booking_reference?: string | null;
  event_date?: string | null;
  booking_status?: string | null;
  package_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

const API_BASE_URL =
  (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ??
  "https://authenticflavors.onrender.com";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message ?? "Request failed.";
    throw new Error(message);
  }

  return payload;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  return parseResponse<T>(response);
}

export function submitVenueSetupRequest(
  accessToken: string,
  bookingId: number,
  notes: string,
): Promise<{ message: string; request_id: number }> {
  return request<{ message: string; request_id: number }>(
    `/api/bookings/${bookingId}/venue-setup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ venue_setup_notes: notes }),
    },
  );
}

export function getBookingVenueSetupRequest(
  accessToken: string,
  bookingId: number,
): Promise<{ request: VenueSetupRequest | null }> {
  return request<{ request: VenueSetupRequest | null }>(
    `/api/bookings/${bookingId}/venue-setup`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export function getAdminVenueSetupRequests(
  accessToken: string,
): Promise<{ requests: VenueSetupRequest[] }> {
  return request<{ requests: VenueSetupRequest[] }>(
    `/api/admin/venue-setup-requests`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export function approveVenueSetupRequest(
  accessToken: string,
  requestId: number,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/admin/venue-setup-requests/${requestId}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export function requestVenueSetupChanges(
  accessToken: string,
  requestId: number,
  adminResponse: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/admin/venue-setup-requests/${requestId}/changes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ admin_response: adminResponse }),
    },
  );
}

export function declineVenueSetupRequest(
  accessToken: string,
  requestId: number,
  adminResponse: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/admin/venue-setup-requests/${requestId}/decline`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ admin_response: adminResponse }),
    },
  );
}
