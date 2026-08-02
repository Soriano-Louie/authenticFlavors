// ─── Announcement API ─────────────────────────────────────────────────────────

export interface Announcement {
  id: number;
  title: string;
  content: string;
  status: "draft" | "published";
  publish_date: string;
  expiration_date: string | null;
  image_url: string | null;
  image_public_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AnnouncementListResponse {
  announcements: Announcement[];
}

export interface AnnouncementSingleResponse {
  message: string;
  announcement: Announcement;
}

export interface AnnouncementDeleteResponse {
  message: string;
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

// ─── Public ──────────────────────────────────────────────────────────────────

/** Fetch published announcements for the landing page (public, no auth) */
export function getPublicAnnouncements(): Promise<AnnouncementListResponse> {
  return request<AnnouncementListResponse>("/api/announcements/public", {
    method: "GET",
  });
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/** Fetch all announcements (admin view, includes drafts) */
export function getAdminAnnouncements(
  accessToken: string,
): Promise<AnnouncementListResponse> {
  return request<AnnouncementListResponse>("/api/admin/announcements", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/** Create a new announcement (multipart/form-data for image upload) */
export async function createAnnouncement(
  accessToken: string,
  formData: FormData,
): Promise<AnnouncementSingleResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/announcements`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return parseResponse<AnnouncementSingleResponse>(response);
}

/** Update an existing announcement (multipart/form-data for image upload) */
export async function updateAnnouncement(
  accessToken: string,
  id: number,
  formData: FormData,
): Promise<AnnouncementSingleResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/announcements/${id}`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
  );

  return parseResponse<AnnouncementSingleResponse>(response);
}

/** Delete an announcement */
export function deleteAnnouncement(
  accessToken: string,
  id: number,
): Promise<AnnouncementDeleteResponse> {
  return request<AnnouncementDeleteResponse>(
    `/api/admin/announcements/${id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
