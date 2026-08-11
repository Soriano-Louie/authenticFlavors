const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// bcrypt only uses the first 72 bytes of a password; bcryptjs throws a
// RangeError above that, so enforce it here for a clean 400 instead of a 500.
const PASSWORD_MAX_BYTES = 72;
const NAME_MAX_LENGTH = 50;
const PHONE_MAX_LENGTH = 20;

function passwordByteLength(password) {
  return Buffer.byteLength(password, "utf8");
}

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

  if (!firstName) {
    fieldErrors.first_name = "First name is required.";
  } else if (firstName.length > NAME_MAX_LENGTH) {
    fieldErrors.first_name = `First name must be at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (middleName.length > NAME_MAX_LENGTH) {
    fieldErrors.middle_name = `Middle name must be at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (!lastName) {
    fieldErrors.last_name = "Last name is required.";
  } else if (lastName.length > NAME_MAX_LENGTH) {
    fieldErrors.last_name = `Last name must be at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "Email is invalid.";
  }

  if (!phoneNumber) {
    fieldErrors.phone_number = "Phone number is required.";
  } else if (phoneNumber.length > PHONE_MAX_LENGTH) {
    fieldErrors.phone_number = `Phone number must be at most ${PHONE_MAX_LENGTH} characters.`;
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  } else if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  } else if (passwordByteLength(password) > PASSWORD_MAX_BYTES) {
    fieldErrors.password = "Password must be at most 72 bytes.";
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

  if (!firstName) {
    fieldErrors.first_name = "First name is required.";
  } else if (firstName.length > NAME_MAX_LENGTH) {
    fieldErrors.first_name = `First name must be at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (middleName.length > NAME_MAX_LENGTH) {
    fieldErrors.middle_name = `Middle name must be at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (!lastName) {
    fieldErrors.last_name = "Last name is required.";
  } else if (lastName.length > NAME_MAX_LENGTH) {
    fieldErrors.last_name = `Last name must be at most ${NAME_MAX_LENGTH} characters.`;
  }
  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "Email is invalid.";
  }

  if (!phoneNumber) {
    fieldErrors.phone_number = "Phone number is required.";
  } else if (phoneNumber.length > PHONE_MAX_LENGTH) {
    fieldErrors.phone_number = `Phone number must be at most ${PHONE_MAX_LENGTH} characters.`;
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
      dietary_preferences: dietaryPreferences || null,
    },
  };
}
