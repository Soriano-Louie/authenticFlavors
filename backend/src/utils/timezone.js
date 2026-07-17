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
