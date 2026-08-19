export interface BookingPayload {
  package_id: number;
  event_type_name: string;
  custom_event_type?: string;
  venue_setup_name?: string;
  venue_setup_names?: string[];
  number_of_pax: number;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  event_date: string;
  start_time: string;
  allergy_notes?: string;
  dietary_notes?: string;
  menu_selections: string[];
  total_price?: number;
  is_ai_booking?: boolean;
}

export interface BookingMenuSelection {
  item_name: string;
  category_name: string;
}

export interface Booking {
  booking_id: number;
  user_id: number;
  package_id: number;
  event_type_id: number;
  custom_event_type: string | null;
  venue_setup_id: number;
  number_of_pax: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  event_date: string;
  start_time: string;
  allergy_notes: string | null;
  dietary_notes: string | null;
  booking_status:
    | "Pending"
    | "Reserved"
    | "Confirmed"
    | "Completed"
    | "Cancelled";
  booking_summary: string | null; // JSON text containing receipt_path, rejection_reason, etc.
  total_price: number;
  amount_paid: number;
  remaining_balance: number;
  ai_booking_reference: number | null;
  booking_reference: string | null;
  created_at: string;
  updated_at: string;
  cancellation_requested_at: string | null;
  package_name?: string;
  type_name?: string;
  setup_name?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  menu_selections?: BookingMenuSelection[];
  days_until_event?: number | null;
}

const API_BASE_URL =
  (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ??
  "";

export interface OccupiedDay {
  event_date: string;
  booking_count: number;
  status?: "booked" | "blocked";
  reason?: string | null;
}

export interface DateAvailability {
  capacityPerDay: number;
  occupiedDays: OccupiedDay[];
}

export interface BookingConfig {
  min_event_date: string;
  min_lead_days: number;
  today: string;
  operating_hours: {
    closedDays: number[];
    openTime: string;
    closeTime: string;
    timezone: string;
  };
}

export function getDateAvailability(): Promise<DateAvailability> {
  return request<DateAvailability>("/api/availability");
}

export function getBookingConfig(): Promise<BookingConfig> {
  return request<BookingConfig>("/api/config");
}

export interface Promotion {
  has_discount: boolean;
  type?: "percentage" | "fixed";
  value?: number;
  scope?: "all" | "package";
  package_id?: number | null;
  pax_count?: number | null;
}

export function getPromotion(
  packageId: number | string,
  paxCount?: number,
): Promise<Promotion> {
  const params = new URLSearchParams({
    package_id: String(packageId),
  });
  if (paxCount != null) {
    params.set("pax_count", String(paxCount));
  }
  return request<Promotion>(`/api/announcements/promotion?${params.toString()}`);
}

export function applyPromotion(total: number, promo: Promotion | null): number {
  if (!promo?.has_discount || !promo.value || promo.value <= 0) return total;
  const amount =
    promo.type === "percentage"
      ? Math.round(total * (promo.value / 100) * 100) / 100
      : Math.min(promo.value, total);
  return Math.max(0, total - amount);
}

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

export function createBooking(
  accessToken: string,
  payload: BookingPayload,
): Promise<{
  booking_id: number;
  total_price: number;
  ai_booking_reference?: number;
  booking_reference?: string;
}> {
  return request<{
    booking_id: number;
    total_price: number;
    ai_booking_reference?: number;
    booking_reference?: string;
  }>("/api/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function getCustomerBookings(
  accessToken: string,
): Promise<{ bookings: Booking[] }> {
  return request<{ bookings: Booking[] }>("/api/bookings", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getAdminBookings(
  accessToken: string,
  params?: { status?: string; search?: string; page?: number; limit?: number },
): Promise<{
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
}> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "All") {
    query.set("status", params.status);
  }
  if (params?.search && params.search.trim()) {
    query.set("search", params.search.trim());
  }
  if (params?.page != null) {
    query.set("page", String(params.page));
  }
  if (params?.limit != null) {
    query.set("limit", String(params.limit));
  }
  const qs = query.toString();
  return request<
    { bookings: Booking[]; total: number; page: number; limit: number }
  >(`/api/admin/bookings${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function completeBooking(
  accessToken: string,
  bookingId: number,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/admin/bookings/${bookingId}/complete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export function verifyBooking(
  accessToken: string,
  bookingId: number,
  adminRemarks?: string,
): Promise<{
  message: string;
  booking_status: string;
  amount_paid?: number;
  remaining_balance?: number;
}> {
  return request<{
    message: string;
    booking_status: string;
    amount_paid?: number;
    remaining_balance?: number;
  }>(`/api/admin/bookings/${bookingId}/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ admin_remarks: adminRemarks }),
  });
}

export function rejectBooking(
  accessToken: string,
  bookingId: number,
  adminRemarks?: string,
): Promise<{ message: string; booking_status: string }> {
  return request<{ message: string; booking_status: string }>(
    `/api/admin/bookings/${bookingId}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ admin_remarks: adminRemarks }),
    },
  );
}

// ──────────────────────────────────────────
// Cancellation API functions
// ──────────────────────────────────────────

export interface CancellationDetails {
  booking_id: number;
  booking_reference: string | null;
  package_name: string;
  event_date: string;
  booking_status: string;
  total_price: number;
  amount_already_paid: number;
  days_before_event: number;
  is_cancelled: boolean;
  cancellation_details: {
    policy_applied: string;
    amount_due_on_cancellation: number;
    cancellation_requested_at: string;
    cancellation_processed_at: string;
    cancellation_notes: string | null;
  } | null;
  estimated_cancellation: {
    policy_would_apply: string;
    estimated_amount_due: number;
    estimated_additional_due: number;
    cancellation_charge_would_be_created: boolean;
  } | null;
  cancellation_payments: any[];
}

export interface CancellationResponse {
  message: string;
  booking_status: string;
  booking_id: number;
  booking_reference: string | null;
  package_name: string;
  event_date: string;
  days_before_event: number;
  policy_applied: string;
  total_price: number;
  amount_already_paid: number;
  amount_due_on_cancellation: number;
  additional_amount_due: number;
  cancellation_charge_created: boolean;
}

export function requestCancellation(
  accessToken: string,
  bookingId: number,
  cancellationReason?: string,
): Promise<CancellationResponse> {
  return request<CancellationResponse>(`/api/bookings/${bookingId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ cancellation_reason: cancellationReason }),
  });
}

export function getCancellationDetails(
  accessToken: string,
  bookingId: number,
): Promise<CancellationDetails> {
  return request<CancellationDetails>(
    `/api/bookings/${bookingId}/cancellation-details`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
