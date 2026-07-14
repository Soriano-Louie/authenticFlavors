// TypeScript interfaces for package data structures
export interface PackagePricing {
  pax_count: number;
  price: number;
}

export interface Package {
  package_id: number;
  package_name: string;
  description: string | null;
  min_pax: number;
  max_pax: number;
  image: string | null;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
  pricing?: PackagePricing[];
}

export interface MenuCategory {
  category_id: number;
  category_name: string;
  description: string | null;
  display_order: number | null;
  status: 'Active' | 'Inactive';
}

export interface MenuItem {
  menu_item_id: number;
  category_id: number;
  item_name: string;
  description: string | null;
  additional_price: number;
  availability_status: 'Active' | 'Inactive';
  image: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

export interface EventType {
  event_type_id: number;
  type_name: string;
  status: 'Active' | 'Inactive';
}

export interface VenueSetup {
  venue_setup_id: number;
  setup_name: string;
  description: string | null;
  status: 'Active' | 'Inactive';
}

interface ApiResponse<T> {
  packages?: T[];
  package?: T;
  categories?: T[];
  items?: T[];
  eventTypes?: T[];
  venueSetups?: T[];
  error?: {
    code?: string;
    message?: string;
  };
}

const API_BASE_URL = (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:4000`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiResponse<T>;

  if (!response.ok) {
    const message = payload.error?.message ?? "Request failed.";
    throw new Error(message);
  }

  return payload as T;
}

// Package functions
export async function getPackages(): Promise<{ packages: Package[] }> {
  return request<{ packages: Package[] }>("/api/packages");
}

export async function getPackageById(id: number): Promise<{ package: Package }> {
  return request<{ package: Package }>(`/api/packages/${id}`);
}

export async function getPackagePricing(packageId: number): Promise<{ pricing: PackagePricing[] }> {
  return request<{ pricing: PackagePricing[] }>(`/api/packages/${packageId}/pricing`);
}

// Menu functions
export async function getMenuCategories(): Promise<{ categories: MenuCategory[] }> {
  return request<{ categories: MenuCategory[] }>("/api/menu/categories");
}

export async function getMenuItems(): Promise<{ items: MenuItem[] }> {
  return request<{ items: MenuItem[] }>("/api/menu/items");
}

export async function getMenuItemsByCategory(categoryId: number): Promise<{ items: MenuItem[] }> {
  return request<{ items: MenuItem[] }>(`/api/menu/categories/${categoryId}/items`);
}

// Event types and venue setups
export async function getEventTypes(): Promise<{ eventTypes: EventType[] }> {
  return request<{ eventTypes: EventType[] }>("/api/event-types");
}

export async function getVenueSetups(): Promise<{ venueSetups: VenueSetup[] }> {
  return request<{ venueSetups: VenueSetup[] }>("/api/venue-setups");
}

// Homepage Statistics
export interface HomepageStatistics {
  eventsHosted: number;
  happyGuests: number;
  averageRating: number | null;
  yearsOfExcellence: number;
}

export async function getHomepageStatistics(): Promise<{ statistics: HomepageStatistics }> {
  return request<{ statistics: HomepageStatistics }>("/api/homepage/statistics");
}

// Upcoming Events
export interface UpcomingEvent {
  booking_id: number;
  event_date: string;
  start_time: string;
  number_of_pax: number;
  booking_status: string;
  package_name: string;
  event_type: string;
}

export async function getUpcomingEvents(): Promise<{ events: UpcomingEvent[] }> {
  return request<{ events: UpcomingEvent[] }>("/api/homepage/upcoming-events");
}