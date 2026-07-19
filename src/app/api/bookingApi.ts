export interface BookingPayload {
  package_id: number;
  event_type_name: string;
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
  venue_setup_id: number;
  number_of_pax: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  event_date: string;
  start_time: string;
  allergy_notes: string | null;
  dietary_notes: string | null;
  booking_status: "Pending" | "Reserved" | "Confirmed" | "Completed" | "Cancelled";
  booking_summary: string | null; // JSON text containing receipt_path, rejection_reason, etc.
  total_price: number;
  amount_paid: number;
  remaining_balance: number;
  ai_booking_reference: number | null;
  created_at: string;
  updated_at: string;
  package_name?: string;
  type_name?: string;
  setup_name?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  menu_selections?: BookingMenuSelection[];
}

const API_BASE_URL = (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ?? "https://authentic-flavors-backend.onrender.com";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };

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

export function createBooking(accessToken: string, payload: BookingPayload): Promise<{ booking_id: number; total_price: number }> {
  return request<{ booking_id: number; total_price: number }>("/api/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function getCustomerBookings(accessToken: string): Promise<{ bookings: Booking[] }> {
  return request<{ bookings: Booking[] }>("/api/bookings", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getAdminBookings(accessToken: string): Promise<{ bookings: Booking[] }> {
  return request<{ bookings: Booking[] }>("/api/admin/bookings", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function completeBooking(accessToken: string, bookingId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/admin/bookings/${bookingId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
