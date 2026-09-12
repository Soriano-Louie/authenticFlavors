import type { Booking } from "../api/bookingApi";
import type { MenuChangeRequest } from "../api/menuChangeApi";
import type { VenueSetupRequest } from "../api/venueSetupApi";
import type { Payment } from "../api/paymentApi";
import type { AdminFeedbackItem } from "../api/feedbackApi";
import type { AdminUser, AdminActivity, BlockedDate, AdminMenuCategory, AdminMenuItem } from "../api/adminApi";
import type { Package as PackageType } from "../api/packageApi";
import type { Announcement } from "../api/announcementApi";

/**
 * Escapes a single CSV field value according to RFC-4180 rules.
 */
function escapeCSVField(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports data to a CSV file with a UTF-8 BOM so Excel opens special characters (like ₱) seamlessly.
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
) {
  const headerRow = headers.map(escapeCSVField).join(",");
  const dataRows = rows.map((r) => r.map(escapeCSVField).join(","));
  // \uFEFF is the UTF-8 Byte Order Mark (BOM) ensuring Excel displays UTF-8 (currency symbols, accents) properly
  const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename.replace(/\.csv$/i, "")}_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports raw structured data as a pretty-printed JSON file.
 */
export function exportToJSON(filename: string, data: any) {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename.replace(/\.json$/i, "")}_${new Date().toISOString().split("T")[0]}.json`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Data Transformers for Admin Modules ──────────────────────────────────────

/**
 * Transform Feedback items for export
 */
export function transformFeedbackForExport(feedbacks: AdminFeedbackItem[]) {
  const headers = [
    "Feedback ID",
    "Customer Name",
    "Customer Email",
    "Package Name",
    "Rating",
    "Sentiment",
    "AI Summary",
    "Key Topics",
    "Actionable Insights",
    "Customer Comment",
    "Submitted At",
  ];

  const rows = feedbacks.map((fb) => [
    fb.feedback_id,
    fb.customer_name || "Anonymous",
    fb.customer_email || "N/A",
    fb.package_name || "N/A",
    fb.rating,
    fb.sentiment_status || "Pending",
    fb.sentiment_summary || "N/A",
    (fb.key_topics || []).join("; "),
    (fb.actionable_insights || []).join("; "),
    fb.comment || "",
    fb.submitted_at ? new Date(fb.submitted_at).toLocaleString("en-PH") : "N/A",
  ]);

  return { headers, rows };
}

/**
 * Transform Menu Change Requests for export
 */
export function transformMenuChangeRequestsForExport(requests: MenuChangeRequest[]) {
  const headers = [
    "Request ID",
    "Booking Reference",
    "Customer Name",
    "Customer Email",
    "Event Date",
    "Package Name",
    "Current Dishes",
    "Requested Dishes",
    "Dietary Notes",
    "Status",
    "Rejection Reason",
    "Requested At",
    "Reviewed At",
  ];

  const rows = requests.map((req) => {
    const bookingRef =
      req.booking_reference || `#BK${String(req.booking_id).padStart(4, "0")}`;
    const customer =
      `${req.first_name || ""} ${req.last_name || ""}`.trim() || "N/A";
    const currentDishes = Array.isArray(req.current_menu_selections)
      ? req.current_menu_selections.join("; ")
      : req.current_menu_selections || "N/A";
    const requestedDishes = Array.isArray(req.requested_menu_selections)
      ? req.requested_menu_selections.join("; ")
      : "N/A";

    return [
      req.request_id,
      bookingRef,
      customer,
      req.email || "N/A",
      req.event_date ? new Date(req.event_date).toLocaleDateString("en-PH") : "N/A",
      req.package_name || "N/A",
      currentDishes,
      requestedDishes,
      req.dietary_notes || "None",
      req.status,
      req.rejection_reason || "",
      req.created_at ? new Date(req.created_at).toLocaleString("en-PH") : "N/A",
      req.reviewed_at ? new Date(req.reviewed_at).toLocaleString("en-PH") : "N/A",
    ];
  });

  return { headers, rows };
}

/**
 * Transform Bookings for export
 */
export function transformBookingsForExport(bookings: Booking[]) {
  const headers = [
    "Booking Reference",
    "Customer Name",
    "Contact Email",
    "Contact Phone",
    "Event Date",
    "Start Time",
    "Package Name",
    "Event Type",
    "Number of Pax",
    "Total Price (PHP)",
    "Amount Paid (PHP)",
    "Remaining Balance (PHP)",
    "Booking Status",
    "Allergy Notes",
    "Dietary Notes",
    "Created At",
  ];

  const rows = bookings.map((b) => {
    const bookingRef =
      b.booking_reference ||
      (b.ai_booking_reference
        ? `#AF-${b.ai_booking_reference}`
        : `#BK${String(b.booking_id).padStart(4, "0")}`);
    const customer =
      b.contact_name ||
      `${b.first_name || ""} ${b.last_name || ""}`.trim() ||
      "N/A";

    return [
      bookingRef,
      customer,
      b.contact_email || "N/A",
      b.contact_phone || "N/A",
      b.event_date ? new Date(b.event_date).toLocaleDateString("en-PH") : "N/A",
      b.start_time || "N/A",
      b.package_name || "N/A",
      b.type_name || b.custom_event_type || "Standard",
      b.number_of_pax || 0,
      Number(b.total_price || 0).toFixed(2),
      Number(b.amount_paid || 0).toFixed(2),
      Number(b.remaining_balance || 0).toFixed(2),
      b.booking_status,
      b.allergy_notes || "None",
      b.dietary_notes || "None",
      b.created_at ? new Date(b.created_at).toLocaleString("en-PH") : "N/A",
    ];
  });

  return { headers, rows };
}

/**
 * Transform Overdue Payments for export
 */
export function transformOverduePaymentsForExport(payments: Payment[]) {
  const headers = [
    "Payment ID",
    "Booking ID",
    "Booking Reference",
    "Customer Name",
    "Payment Type",
    "Amount Due (PHP)",
    "Due Date",
    "Days Overdue",
    "Payment Status",
  ];

  const rows = payments.map((p) => {
    const dueDate = p.due_date ? new Date(p.due_date) : null;
    const today = new Date();
    let daysOverdue = 0;
    if (dueDate) {
      const diffTime = today.getTime() - dueDate.getTime();
      daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }

    const customer =
      `${(p as any).first_name || ""} ${(p as any).last_name || ""}`.trim() || "N/A";

    return [
      p.payment_id,
      p.booking_id,
      (p as any).booking_reference || `#BK${String(p.booking_id).padStart(4, "0")}`,
      customer,
      p.payment_type,
      Number(p.amount || 0).toFixed(2),
      p.due_date ? new Date(p.due_date).toLocaleDateString("en-PH") : "N/A",
      daysOverdue,
      p.payment_status,
    ];
  });

  return { headers, rows };
}

/**
 * Transform Venue Setup Requests for export
 */
export function transformVenueSetupRequestsForExport(
  requests: VenueSetupRequest[],
  bookingsMap?: Record<number, Booking>,
) {
  const headers = [
    "Request ID",
    "Booking Reference",
    "Customer Name",
    "Customer Email",
    "Event Date",
    "Package Name",
    "Setup Notes / Instructions",
    "Status",
    "Admin Response",
    "Submitted At",
    "Reviewed At",
  ];

  const rows = requests.map((req) => {
    const booking = bookingsMap ? bookingsMap[req.booking_id] : undefined;
    const bookingRef =
      req.booking_reference ||
      booking?.booking_reference ||
      (booking?.ai_booking_reference
        ? `#AF-${booking.ai_booking_reference}`
        : `#BK${String(req.booking_id).padStart(4, "0")}`);
    const customer =
      `${req.first_name || booking?.first_name || ""} ${req.last_name || booking?.last_name || ""}`.trim() ||
      booking?.contact_name ||
      "N/A";
    const email = req.email || booking?.contact_email || "N/A";
    const eventDate = req.event_date || booking?.event_date;

    return [
      req.request_id,
      bookingRef,
      customer,
      email,
      eventDate ? new Date(eventDate).toLocaleDateString("en-PH") : "N/A",
      req.package_name || booking?.package_name || "N/A",
      req.venue_setup_notes || "N/A",
      req.status,
      req.admin_response || "",
      req.created_at ? new Date(req.created_at).toLocaleString("en-PH") : "N/A",
      req.reviewed_at ? new Date(req.reviewed_at).toLocaleString("en-PH") : "N/A",
    ];
  });

  return { headers, rows };
}

/**
 * Transform Admin Users for export
 */
export function transformUsersForExport(users: AdminUser[]) {
  const headers = [
    "User ID",
    "First Name",
    "Middle Name",
    "Last Name",
    "Email",
    "Phone Number",
    "Role",
    "Account Status",
    "Total Bookings",
    "Registered Date",
  ];

  const rows = users.map((u) => [
    u.user_id,
    u.first_name || "",
    u.middle_name || "",
    u.last_name || "",
    u.email,
    u.phone_number || "N/A",
    u.role,
    u.account_status,
    u.total_bookings ?? 0,
    u.created_at ? new Date(u.created_at).toLocaleString("en-PH") : "N/A",
  ]);

  return { headers, rows };
}

/**
 * Transform Food Packages for export
 */
export function transformPackagesForExport(packages: PackageType[]) {
  const headers = [
    "Package ID",
    "Package Name",
    "Description",
    "Max Pax",
    "Status",
    "Pricing Tiers (Pax & Price)",
    "Menu Inclusions",
  ];

  const rows = packages.map((pkg) => {
    const tiers = (pkg.pricing || [])
      .map((t) => `${t.pax_count} pax: ₱${Number(t.price).toLocaleString("en-PH")}`)
      .join(" | ");
    const inclusions = (pkg.menu_inclusions || [])
      .map((inc) => `${inc.category_name}: ${inc.item_name}`)
      .join(" | ");

    return [
      pkg.package_id,
      pkg.package_name,
      pkg.description || "",
      pkg.max_pax || "N/A",
      pkg.status,
      tiers || "N/A",
      inclusions || "N/A",
    ];
  });

  return { headers, rows };
}

/**
 * Transform Menu Items & Categories for export
 */
export function transformMenuItemsForExport(
  categories: AdminMenuCategory[],
  items: AdminMenuItem[],
) {
  const categoryMap = new Map(categories.map((c) => [c.category_id, c.category_name]));

  const headers = [
    "Item ID",
    "Dish Name",
    "Category",
    "Description",
    "Additional Price (PHP)",
    "Availability Status",
  ];

  const rows = items.map((item) => [
    item.menu_item_id,
    item.item_name,
    categoryMap.get(item.category_id) || item.category_name || `Category #${item.category_id}`,
    item.description || "",
    Number(item.additional_price || 0).toFixed(2),
    item.availability_status,
  ]);

  return { headers, rows };
}

/**
 * Transform Blocked Dates for export
 */
export function transformBlockedDatesForExport(dates: BlockedDate[]) {
  const headers = [
    "Blocked Date ID",
    "Blocked Date",
    "Day of Week",
    "Reason / Notes",
    "Blocked By",
    "Created At",
  ];

  const rows = dates.map((bd) => {
    const d = new Date(`${bd.blocked_date}T00:00:00`);
    const dayOfWeek = isNaN(d.getTime())
      ? "N/A"
      : d.toLocaleDateString("en-PH", { weekday: "long" });

    return [
      bd.blocked_date_id,
      bd.blocked_date,
      dayOfWeek,
      bd.reason || "Store Closed / Fully Booked",
      bd.blocked_by_name || "Admin",
      bd.created_at ? new Date(bd.created_at).toLocaleString("en-PH") : "N/A",
    ];
  });

  return { headers, rows };
}

/**
 * Transform Announcements for export
 */
export function transformAnnouncementsForExport(announcements: Announcement[]) {
  const headers = [
    "Announcement ID",
    "Title",
    "Content",
    "Status",
    "Publish Date",
    "Expiration Date",
    "Discount Scope",
    "Discount Type",
    "Discount Value",
    "Is Expired",
    "Created At",
  ];

  const rows = announcements.map((a) => [
    a.id,
    a.title,
    a.content,
    a.status,
    a.publish_date ? new Date(a.publish_date).toLocaleString("en-PH") : "N/A",
    a.expiration_date ? new Date(a.expiration_date).toLocaleString("en-PH") : "No Expiration",
    a.discount_scope || "None",
    a.discount_type || "N/A",
    a.discount_value ? String(a.discount_value) : "0",
    a.is_expired ? "Yes" : "No",
    a.created_at ? new Date(a.created_at).toLocaleString("en-PH") : "N/A",
  ]);

  return { headers, rows };
}

/**
 * Transform Admin Activity for export
 */
export function transformActivityForExport(activities: AdminActivity[]) {
  const headers = [
    "Activity ID",
    "Type",
    "User",
    "Action",
    "Details",
    "Timestamp",
  ];

  const rows = activities.map((act) => [
    act.id,
    act.type || "Activity",
    act.user || "Admin",
    act.action,
    act.details || "",
    act.timestamp ? new Date(act.timestamp).toLocaleString("en-PH") : "N/A",
  ]);

  return { headers, rows };
}
