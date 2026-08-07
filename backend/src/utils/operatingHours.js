export const OPERATING_HOURS = {
  closedDays: [1],
  openTime: "11:00:00",
  closeTime: "22:00:00",
  timezone: "Asia/Manila",
};

export function isOperatingDay(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  return !OPERATING_HOURS.closedDays.includes(dayOfWeek);
}

export function isWithinOperatingHours(timeStr) {
  if (!timeStr) return false;
  const time = timeStr.slice(0, 8);
  return time >= OPERATING_HOURS.openTime && time <= OPERATING_HOURS.closeTime;
}

export function getOperatingHoursMessage() {
  const open = formatTime12(OPERATING_HOURS.openTime);
  const close = formatTime12(OPERATING_HOURS.closeTime);
  return `The booking start time must be within our operating hours (${open} – ${close}, Tuesday to Sunday).`;
}

export function getOperatingHoursDisplay() {
  const open = formatTime12(OPERATING_HOURS.openTime);
  const close = formatTime12(OPERATING_HOURS.closeTime);
  return `${open} – ${close}`;
}

function formatTime12(time24) {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
}
