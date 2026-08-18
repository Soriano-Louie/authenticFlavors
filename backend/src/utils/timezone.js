const PH_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getPhilippineDateString() {
  const now = new Date(Date.now() + PH_TIMEZONE_OFFSET_MS);
  return now.toISOString().split("T")[0];
}

export function toPhilippineDateString(value) {
  const date = value instanceof Date ? value : new Date(value);
  const shifted = new Date(date.getTime() + PH_TIMEZONE_OFFSET_MS);
  return shifted.toISOString().split("T")[0];
}

/**
 * Returns the current time as a MySQL DATETIME string in Philippine time
 * (UTC+8). Keeps created_at values from being silently shifted by the MySQL
 * server's own timezone.
 */
export function getPhilippineDateTimeString() {
  const now = new Date(Date.now() + PH_TIMEZONE_OFFSET_MS);
  return now.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Adds calendar days to a 'YYYY-MM-DD' date string. The arithmetic is done in
 * UTC, so it is exact regardless of the server's local timezone or DST rules.
 */
export function addDaysToDateString(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().split("T")[0];
}

/**
 * The earliest date a booking may be scheduled for, in Philippine time:
 * the Manila "today" plus the lead-time window (default 14 days). This is the
 * single source of truth for the booking cutoff so the backend validation and
 * the exposed booking-config endpoint can never disagree.
 */
export function getMinimumEventDate(leadDays = 14) {
  return addDaysToDateString(getPhilippineDateString(), leadDays);
}
