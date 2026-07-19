export interface FeedbackPayload {
  booking_id: number;
  rating: number;
  comment?: string;
}

export interface Feedback {
  feedback_id: number;
  booking_id: number;
  user_id: number;
  rating: number;
  comment: string | null;
  sentiment_status: string;
  sentiment_score: number | null;
  sentiment_summary: string | null;
  is_analyzed: boolean;
  submitted_at: string;
  package_name?: string;
  event_date?: string;
  start_time?: string;
  number_of_pax?: number;
}

const API_BASE_URL =
  (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ??
  "https://authentic-flavors-backend.onrender.com";

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

export function createFeedback(
  accessToken: string,
  payload: FeedbackPayload,
): Promise<{ message: string; feedback: Feedback }> {
  return request<{ message: string; feedback: Feedback }>("/api/feedback", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function getFeedback(
  accessToken: string,
  bookingId: number,
): Promise<{ feedback: Feedback }> {
  return request<{ feedback: Feedback }>(`/api/feedback/${bookingId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function checkFeedbackExists(
  accessToken: string,
  bookingId: number,
): Promise<{ exists: boolean }> {
  return request<{ exists: boolean }>(`/api/feedback/check/${bookingId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
