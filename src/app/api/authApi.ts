export interface AuthUser {
  user_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone_number: string;
  role: "Customer" | "Admin";
  account_status: "Active" | "Inactive" | "Suspended";
  created_at: string;
  updated_at: string;
  dietary_preferences?: string | null;
}

interface AuthSuccessResponse {
  user: AuthUser;
  accessToken: string;
}

interface AuthMeResponse {
  user: AuthUser;
}

export interface RegisterPayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone_number: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone_number: string;
  dietary_preferences?: string | null;
}

export interface ApiErrorShape {
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string>;
  };
}

const API_BASE_URL = (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ?? "https://authenticflavors.onrender.com";

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, code?: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorShape;

  if (!response.ok) {
    const message = payload.error?.message ?? "Request failed.";
    throw new ApiError(response.status, message, payload.error?.code, payload.error?.fieldErrors);
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

export function register(payload: RegisterPayload): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refreshSession(): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>("/api/auth/refresh", {
    method: "POST",
  });
}

export function getCurrentUser(accessToken: string): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/api/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function logout(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export function updateProfile(
  accessToken: string,
  payload: UpdateProfilePayload,
): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/api/auth/profile", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}
