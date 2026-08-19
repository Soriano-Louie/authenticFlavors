import {
  getInvalidNameReason,
  getPasswordError,
  isEmailFormatValid,
  isPasswordStrongEnough,
  suggestEmailCorrection,
  validatePhone,
} from "./registrationValidation.js";

const PHONE_MAX_LENGTH = 20;

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
  const confirmPassword = String(body.confirm_password ?? "");

  const firstNameError = getInvalidNameReason(firstName, "First name");
  if (firstNameError) fieldErrors.first_name = firstNameError;
  const middleNameError = middleName
    ? getInvalidNameReason(middleName, "Middle name")
    : null;
  if (middleNameError) fieldErrors.middle_name = middleNameError;
  const lastNameError = getInvalidNameReason(lastName, "Last name");
  if (lastNameError) fieldErrors.last_name = lastNameError;

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!isEmailFormatValid(email)) {
    fieldErrors.email =
      "Enter a valid email address (e.g. name@example.com).";
  }

  const phoneResult = phoneNumber
    ? validatePhone(phoneNumber)
    : { valid: false, normalized: "", error: "Phone number is required." };
  if (!phoneNumber) {
    fieldErrors.phone_number = "Phone number is required.";
  } else if (phoneNumber.length > PHONE_MAX_LENGTH) {
    fieldErrors.phone_number = `Phone number must be at most ${PHONE_MAX_LENGTH} characters.`;
  } else if (!phoneResult.valid) {
    fieldErrors.phone_number = phoneResult.error;
  }

  const passwordError = getPasswordError(password);
  if (passwordError) {
    fieldErrors.password = passwordError;
  } else if (!isPasswordStrongEnough(password)) {
    fieldErrors.password =
      "Password is too weak. Please meet at least 3 of: 8+ characters, uppercase, lowercase, number, special character.";
  }
  if (!confirmPassword) {
    fieldErrors.confirm_password = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    fieldErrors.confirm_password = "Passwords do not match.";
  }

  // A structurally valid address can still look like a likely typo
  // (e.g. example@gmail.co). The suggestion is surfaced separately from
  // fieldErrors so the controller can decide whether to reject or warn.
  const emailSuggestion =
    !fieldErrors.email && isEmailFormatValid(email)
      ? suggestEmailCorrection(email)
      : null;

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    emailSuggestion,
    data: {
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      email,
      phone_number: phoneResult.valid ? phoneResult.normalized : phoneNumber,
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
  } else if (!isEmailFormatValid(email)) {
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
  const dietaryPreferences =
    body.dietary_preferences !== undefined && body.dietary_preferences !== null
      ? String(body.dietary_preferences).trim()
      : null;

  const firstNameError = getInvalidNameReason(firstName, "First name");
  if (firstNameError) fieldErrors.first_name = firstNameError;
  const middleNameError = middleName
    ? getInvalidNameReason(middleName, "Middle name")
    : null;
  if (middleNameError) fieldErrors.middle_name = middleNameError;
  const lastNameError = getInvalidNameReason(lastName, "Last name");
  if (lastNameError) fieldErrors.last_name = lastNameError;

  // Email is optional on profile updates: changing an email goes through its
  // dedicated verified email-change flow, so a user updating just their
  // name/phone isn't forced to re-submit an email that is then ignored.
  if (email && !isEmailFormatValid(email)) {
    fieldErrors.email =
      "Enter a valid email address (e.g. name@example.com).";
  }

  const phoneResult = phoneNumber
    ? validatePhone(phoneNumber)
    : { valid: false, normalized: "", error: "Phone number is required." };
  if (!phoneNumber) {
    fieldErrors.phone_number = "Phone number is required.";
  } else if (phoneNumber.length > PHONE_MAX_LENGTH) {
    fieldErrors.phone_number = `Phone number must be at most ${PHONE_MAX_LENGTH} characters.`;
  } else if (!phoneResult.valid) {
    fieldErrors.phone_number = phoneResult.error;
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    data: {
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      phone_number: phoneResult.valid ? phoneResult.normalized : phoneNumber,
      dietary_preferences: dietaryPreferences || null,
    },
  };
}
