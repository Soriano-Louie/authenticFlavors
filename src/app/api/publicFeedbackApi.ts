export interface PublicFeedback {
  feedback_id: number;
  rating: number;
  comment: string | null;
  submitted_at: string;
  customer_name: string;
  package_name: string;
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

export function getPublicFeedbacks(): Promise<{
  feedbacks: PublicFeedback[];
}> {
  return fetch(`${API_BASE_URL}/api/feedbacks/public`, {
    credentials: "include",
  }).then((res) => parseResponse<{ feedbacks: PublicFeedback[] }>(res));
}
