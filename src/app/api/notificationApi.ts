export interface AppNotification {
  notification_id: number;
  user_id: number;
  booking_id: number | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread_count: number;
  total_count: number;
}

const API_BASE_URL =
  (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ??
  "";

export async function fetchNotifications(
  token: string,
): Promise<NotificationsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Failed to fetch notifications:", response.status, text);
    throw new Error("Failed to fetch notifications");
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("Non-JSON response:", text);

    // Check if we're getting HTML (indicates backend is not running or proxy issue)
    if (
      text.trim().startsWith("<!DOCTYPE") ||
      text.trim().startsWith("<html")
    ) {
      throw new Error(
        "Unable to connect to backend server. Please ensure the backend is running on port 4000. " +
          "Run 'npm run dev:backend' in a separate terminal.",
      );
    }

    throw new Error("Invalid response format from server");
  }

  return response.json();
}

export async function markNotificationRead(
  token: string,
  notificationId: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to mark all notifications as read");
  }
}

export async function deleteNotification(
  token: string,
  notificationId: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/${notificationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to delete notification");
  }
}
