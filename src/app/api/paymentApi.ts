export interface Payment {
  payment_id: number;
  booking_id: number;
  payment_type: "Reservation" | "DownPayment" | "FinalPayment";
  amount: number;
  due_date: string;
  paymongo_checkout_id: string | null;
  paymongo_payment_id: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  payment_status: "Pending" | "Paid" | "Failed";
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ?? "https://authenticflavors.onrender.com";

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

export function createCheckoutSession(accessToken: string, paymentId: number): Promise<{ checkout_url: string; checkout_id: string }> {
  return request<{ checkout_url: string; checkout_id: string }>("/api/payments/create-checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ payment_id: paymentId }),
  });
}

export function getPaymentStatus(accessToken: string, paymentId: number): Promise<{ 
  payment_status: "Pending" | "Paid" | "Failed"; 
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
}> {
  return request<{ 
    payment_status: "Pending" | "Paid" | "Failed"; 
    paid_at: string | null;
    payment_method: string | null;
    payment_reference: string | null;
  }>(`/api/payments/status/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getBookingPayments(accessToken: string, bookingId: number): Promise<{ payments: Payment[] }> {
  return request<{ payments: Payment[] }>(`/api/payments/booking/${bookingId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
