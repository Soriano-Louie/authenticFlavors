export interface SentimentBreakdown {
  sentiment: string;
  count: number;
  percentage: number;
}

export interface AdminStats {
  totalUsers: number;
  totalFeedback: number;
  totalRevenue: number;
  sentimentBreakdown: SentimentBreakdown[];
}

export interface AdminActivity {
  id: string;
  type: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
  icon: string;
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

export function getAdminStats(accessToken: string): Promise<AdminStats> {
  return request<AdminStats>("/api/admin/stats", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getAdminActivity(
  accessToken: string,
): Promise<{ activities: AdminActivity[] }> {
  return request<{ activities: AdminActivity[] }>("/api/admin/activity", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
