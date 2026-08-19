// ─── Menu Change API ─────────────────────────────────────────────────────────

export interface MenuChangeRequest {
  request_id: number;
  booking_id: number;
  user_id: number;
  requested_menu_selections: string[];
  current_menu_selections?: string[] | string;
  dietary_notes: string | null;
  status: "Pending" | "Approved" | "Rejected";
  rejection_reason: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  booking_reference?: string | null;
  event_date?: string;
  booking_status?: string;
  package_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface RequestMenuChangePayload {
  menu_selections: string[];
  dietary_notes?: string;
}

const API_BASE_URL =
  (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ??
  "";

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

// Customer request menu change
export function submitMenuChangeRequest(
  accessToken: string,
  bookingId: number,
  payload: RequestMenuChangePayload,
): Promise<{ message: string; request_id: number }> {
  return request<{ message: string; request_id: number }>(
    `/api/bookings/${bookingId}/menu-change`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );
}

// Fetch menu change requests for a booking
export function getBookingMenuChangeRequests(
  accessToken: string,
  bookingId: number,
): Promise<{ requests: MenuChangeRequest[] }> {
  return request<{ requests: MenuChangeRequest[] }>(
    `/api/bookings/${bookingId}/menu-change-requests`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

// Admin: Fetch all menu change requests
export function getAdminMenuChangeRequests(
  accessToken: string,
): Promise<{ requests: MenuChangeRequest[] }> {
  return request<{ requests: MenuChangeRequest[] }>(
    `/api/admin/menu-change-requests`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

// Admin: Approve menu change request
export function approveMenuChangeRequest(
  accessToken: string,
  requestId: number,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/admin/menu-change-requests/${requestId}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

// Admin: Reject menu change request
export function rejectMenuChangeRequest(
  accessToken: string,
  requestId: number,
  rejectionReason: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/admin/menu-change-requests/${requestId}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    },
  );
}
