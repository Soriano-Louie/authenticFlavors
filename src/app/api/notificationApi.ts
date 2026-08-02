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

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function fetchNotifications(
  token: string,
): Promise<NotificationsResponse> {
  const response = await fetch(`${API_BASE}/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  return response.json();
}

export async function markNotificationRead(
  token: string,
  notificationId: number,
): Promise<void> {
  const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/notifications/read-all`, {
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
  const response = await fetch(`${API_BASE}/notifications/${notificationId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to delete notification");
  }
}
