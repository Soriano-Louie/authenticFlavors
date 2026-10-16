import { httpError } from './httpError.js';

export function isCalendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function assertBookingInput(body) {
  if (!Number.isInteger(Number(body.package_id)) || Number(body.package_id) <= 0 ||
      !Number.isInteger(Number(body.number_of_pax)) || Number(body.number_of_pax) < 1 ||
      !isCalendarDate(body.event_date) || typeof body.start_time !== 'string' ||
      typeof body.contact_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contact_email) || body.contact_email.length > 254) {
    throw httpError(400, 'VALIDATION_ERROR', 'Provide valid booking details, contact email, guest count, date, and time.');
  }
  for (const key of ['contact_name', 'event_type_name']) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 150) {
      throw httpError(400, 'VALIDATION_ERROR', 'Contact name and event type must be valid text.');
    }
  }
  for (const key of ['allergy_notes', 'dietary_notes', 'custom_event_type', 'contact_phone']) {
    if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > (key === 'contact_phone' ? 30 : 2000))) {
      throw httpError(400, 'VALIDATION_ERROR', 'Contact details and notes must be valid text within the allowed length.');
    }
  }
}
