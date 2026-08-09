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
