export interface ChatResponse {
  reply: string;
  conversation_id: number | null;
  booking_action?: {
    type: "SUMMARY" | "CONFIRMED" | "CANCELLED";
    booking_details?: any;
    booking_id?: number;
    ai_booking_reference?: number;
    total_price?: number;
  } | null;
}

export interface Conversation {
  conversation_id: number;
  conversation_title: string | null;
  conversation_purpose: string;
  started_at: string;
  ended_at: string | null;
  conversation_status: string;
}

export interface ChatMessage {
  message_id: number;
  sender: "User" | "AI";
  message_text: string;
  sent_at: string;
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

/**
 * Send a message to the AI chatbot.
 * Optionally provide an access token for authenticated conversations.
 * Optionally provide a conversation_id to continue an existing conversation.
 */
export function sendChatMessage(
  message: string,
  conversationId?: number | null,
  accessToken?: string | null,
): Promise<ChatResponse> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  return request<ChatResponse>("/api/chat/message", {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      conversation_id: conversationId ?? null,
    }),
  });
}

/**
 * Get all conversations for the authenticated user.
 */
export function getConversations(
  accessToken: string,
): Promise<{ conversations: Conversation[] }> {
  return request<{ conversations: Conversation[] }>("/api/chat/conversations", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Get all messages for a specific conversation.
 */
export function getMessages(
  accessToken: string,
  conversationId: number,
): Promise<{ messages: ChatMessage[] }> {
  return request<{ messages: ChatMessage[] }>(
    `/api/chat/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
