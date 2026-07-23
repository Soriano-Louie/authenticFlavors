const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function normalizePhone(phone) {
  return String(phone ?? "").trim();
}

export function validateRegisterInput(body) {
  const fieldErrors = {};

  const firstName = String(body.first_name ?? "").trim();
  const middleName = String(body.middle_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = normalizeEmail(body.email);
  const phoneNumber = normalizePhone(body.phone_number);
  const password = String(body.password ?? "");

  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "Email is invalid.";
  }

  if (!phoneNumber) fieldErrors.phone_number = "Phone number is required.";

  if (!password) {
    fieldErrors.password = "Password is required.";
  } else if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    data: {
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      password,
    },
  };
}

export function validateLoginInput(body) {
  const fieldErrors = {};
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "Email is invalid.";
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    data: { email, password },
  };
}

export function validateProfileUpdateInput(body) {
  const fieldErrors = {};

  const firstName = String(body.first_name ?? "").trim();
  const middleName = String(body.middle_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = normalizeEmail(body.email);
  const phoneNumber = normalizePhone(body.phone_number);
  const dietaryPreferences = body.dietary_preferences !== undefined && body.dietary_preferences !== null
    ? String(body.dietary_preferences).trim()
    : null;

  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "Email is invalid.";
  }

  if (!phoneNumber) fieldErrors.phone_number = "Phone number is required.";

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    data: {
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      dietary_preferences: dietaryPreferences || null,
    },
  };
}
