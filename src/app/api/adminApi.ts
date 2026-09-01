import type { Package } from "./packageApi";

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
  "";

// Error subclass that also carries the server's error code and the raw
// payload so callers can react to specific codes (e.g. DATE_HAS_BOOKINGS)
// and read extra fields such as the list of affected bookings.
export class AdminApiError extends Error {
  code?: string;
  payload?: any;

  constructor(message: string, code?: string, payload?: any) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.payload = payload;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message ?? "Request failed.";
    throw new AdminApiError(message, payload.error?.code, payload);
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
): Promise<{
  activities: AdminActivity[];
  total: number;
  page: number;
  limit: number;
}> {
  return request<{
    activities: AdminActivity[];
    total: number;
    page: number;
    limit: number;
  }>("/api/admin/activity", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ─── Admin Package Management ───────────────────────────────────────

export interface AdminPackageResponse {
  packages: Package[];
}

export interface AdminSinglePackageResponse {
  package: Package;
}

export interface AdminDeleteResponse {
  message: string;
}

/** Fetch all packages (including inactive) for admin view */
export function getAdminPackages(
  accessToken: string,
): Promise<AdminPackageResponse> {
  return request<AdminPackageResponse>("/api/admin/packages", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/** Create a new package (multipart/form-data for image upload) */
export async function createAdminPackage(
  accessToken: string,
  formData: FormData,
): Promise<AdminSinglePackageResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/packages`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Note: No Content-Type set — browser sets multipart boundary automatically
    },
    body: formData,
  });

  return parseResponse<AdminSinglePackageResponse>(response);
}

/** Update an existing package (multipart/form-data for image upload) */
export async function updateAdminPackage(
  accessToken: string,
  id: number,
  formData: FormData,
): Promise<AdminSinglePackageResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/packages/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return parseResponse<AdminSinglePackageResponse>(response);
}

/** Deactivate (soft-delete) a package */
export function deleteAdminPackage(
  accessToken: string,
  id: number,
): Promise<AdminDeleteResponse> {
  return request<AdminDeleteResponse>(`/api/admin/packages/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/** Delete a package's image */
export function deleteAdminPackageImage(
  accessToken: string,
  id: number,
): Promise<AdminDeleteResponse> {
  return request<AdminDeleteResponse>(`/api/admin/packages/${id}/image`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ─── Admin Menu Management ──────────────────────────────────────────

export interface AdminMenuCategory {
  category_id: number;
  category_name: string;
  description: string | null;
  display_order: number | null;
  status: "Active" | "Inactive";
}

export interface AdminMenuItem {
  menu_item_id: number;
  category_id: number;
  item_name: string;
  description: string | null;
  additional_price: number;
  availability_status: "Active" | "Inactive";
  image: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

export interface AdminMenuCategoryResponse {
  category: AdminMenuCategory;
}

export interface AdminMenuCategoriesResponse {
  categories: AdminMenuCategory[];
}

export interface AdminMenuItemsResponse {
  items: AdminMenuItem[];
}

export interface AdminMenuItemResponse {
  item: AdminMenuItem;
}

export interface AdminMenuDeleteResponse {
  message: string;
}

/** Fetch all menu categories (including inactive) for admin */
export function getAdminMenuCategories(
  accessToken: string,
): Promise<AdminMenuCategoriesResponse> {
  return request<AdminMenuCategoriesResponse>("/api/admin/menu/categories", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/** Create a new menu category */
export function createAdminMenuCategory(
  accessToken: string,
  data: Record<string, unknown>,
): Promise<AdminMenuCategoryResponse> {
  return request<AdminMenuCategoryResponse>("/api/admin/menu/categories", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

/** Update a menu category */
export function updateAdminMenuCategory(
  accessToken: string,
  id: number,
  data: Record<string, unknown>,
): Promise<AdminMenuCategoryResponse> {
  return request<AdminMenuCategoryResponse>(
    `/api/admin/menu/categories/${id}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
}

/** Delete (deactivate) a menu category */
export function deleteAdminMenuCategory(
  accessToken: string,
  id: number,
): Promise<AdminMenuDeleteResponse> {
  return request<AdminMenuDeleteResponse>(
    `/api/admin/menu/categories/${id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

/** Fetch all menu items (including inactive) for admin */
export function getAdminMenuItems(
  accessToken: string,
): Promise<AdminMenuItemsResponse> {
  return request<AdminMenuItemsResponse>("/api/admin/menu/items", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/** Create a new menu item (multipart/form-data for image upload) */
export async function createAdminMenuItem(
  accessToken: string,
  formData: FormData,
): Promise<AdminMenuItemResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/menu/items`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return parseResponse<AdminMenuItemResponse>(response);
}

/** Update a menu item (multipart/form-data for image upload) */
export async function updateAdminMenuItem(
  accessToken: string,
  id: number,
  formData: FormData,
): Promise<AdminMenuItemResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/menu/items/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return parseResponse<AdminMenuItemResponse>(response);
}

/** Delete (deactivate) a menu item */
export function deleteAdminMenuItem(
  accessToken: string,
  id: number,
): Promise<AdminMenuDeleteResponse> {
  return request<AdminMenuDeleteResponse>(`/api/admin/menu/items/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ──────────────────────────────────────────
// Blocked (unavailable) calendar dates
// ──────────────────────────────────────────

export interface BlockedDate {
  blocked_date_id: number;
  blocked_date: string; // YYYY-MM-DD
  is_past: boolean;
  reason: string | null;
  created_at: string;
  blocked_by_name: string;
}

export function getAdminBlockedDates(
  accessToken: string,
): Promise<{ blockedDates: BlockedDate[] }> {
  return request<{ blockedDates: BlockedDate[] }>(
    "/api/admin/blocked-dates",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export function createBlockedDate(
  accessToken: string,
  payload: { date: string; reason?: string; force?: boolean },
): Promise<{
  message: string;
  blocked_date_id: number;
  blocked_date: string;
  reason: string | null;
}> {
  return request<{
    message: string;
    blocked_date_id: number;
    blocked_date: string;
    reason: string | null;
  }>("/api/admin/blocked-dates", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function deleteBlockedDate(
  accessToken: string,
  blockedDateId: number,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/admin/blocked-dates/${blockedDateId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export interface AdminUser {
  user_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: "Admin" | "Customer";
  account_status: "Active" | "Inactive" | "Suspended" | "Pending";
  profile_photo_url?: string | null;
  created_at: string;
  updated_at?: string;
  total_bookings: number;
}

export interface AdminUserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingUsers: number;
  adminUsers: number;
  customerUsers: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  stats: AdminUserStats;
}

export interface CreateAdminUserPayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone_number?: string;
  password: string;
  role: "Admin" | "Customer";
  account_status?: "Active" | "Inactive" | "Suspended" | "Pending";
}

export interface UpdateAdminUserPayload {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  password?: string;
  role?: "Admin" | "Customer";
  account_status?: "Active" | "Inactive" | "Suspended" | "Pending";
}

export function getAdminUsers(
  accessToken: string,
  params?: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
): Promise<AdminUsersResponse> {
  const query = new URLSearchParams();
  if (params?.role && params.role !== "All") query.set("role", params.role);
  if (params?.status && params.status !== "All") query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString() ? `?${query.toString()}` : "";
  return request<AdminUsersResponse>(`/api/admin/users${qs}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function createAdminUser(
  accessToken: string,
  payload: CreateAdminUserPayload,
): Promise<{ message: string; user: AdminUser }> {
  return request<{ message: string; user: AdminUser }>("/api/admin/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(
  accessToken: string,
  userId: number,
  payload: UpdateAdminUserPayload,
): Promise<{ message: string; user: Partial<AdminUser> }> {
  return request<{ message: string; user: Partial<AdminUser> }>(
    `/api/admin/users/${userId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );
}

export function setAdminUserStatus(
  accessToken: string,
  userId: number,
  account_status: "Active" | "Inactive" | "Suspended" | "Pending",
): Promise<{ message: string; user_id: number; account_status: string }> {
  return request<{ message: string; user_id: number; account_status: string }>(
    `/api/admin/users/${userId}/status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ account_status }),
    },
  );
}

