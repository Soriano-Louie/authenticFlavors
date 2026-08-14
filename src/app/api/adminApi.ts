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
