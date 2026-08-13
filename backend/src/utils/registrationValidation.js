// ─────────────────────────────────────────────────────────────────────────────
// Shared registration validation.
//
// This module is the single source of truth for registration validation rules
// and is imported by BOTH the backend (Node ESM, via validators.js) and the
// frontend (Vite, via a relative import from src/). Keeping one implementation
// guarantees the frontend and backend never disagree about what is valid.
//
// It lives under backend/ so a Render deploy rooted at backend/ still includes
// it, while the Vercel frontend build (repo root) can reach it too.
// ─────────────────────────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 50;

const EMAIL_MAX_LENGTH = 254;
const LOCAL_PART_MAX_LENGTH = 64;
const DOMAIN_MAX_LENGTH = 253;

// Practical local-part syntax: printable ASCII allowed by RFC 5322 with "."
// separators that are never leading, trailing, or consecutive. Quoted local
// parts are intentionally unsupported (rarely used, easily abused).
const LOCAL_PART_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

// Domain labels: 1-63 chars of letters/digits/hyphens, no leading/trailing hyphen.
const LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
// TLD: letters only, 2-63 chars (syntactic validity — see isEmailFormatValid).
const TLD_PATTERN = /^[A-Za-z]{2,63}$/;

// Domains frequently mistyped by users, as name + TLD pairs. Correction
// suggestions are only made for these well-known providers, never by guessing
// arbitrary domains.
const KNOWN_EMAIL_PROVIDERS = [
  { name: "gmail", tld: "com" },
  { name: "googlemail", tld: "com" },
  { name: "yahoo", tld: "com" },
  { name: "outlook", tld: "com" },
  { name: "hotmail", tld: "com" },
  { name: "live", tld: "com" },
  { name: "icloud", tld: "com" },
  { name: "me", tld: "com" },
  { name: "aol", tld: "com" },
  { name: "proton", tld: "me" },
  { name: "protonmail", tld: "com" },
  { name: "zoho", tld: "com" },
  { name: "mail", tld: "com" },
  { name: "gmx", tld: "com" },
  { name: "yandex", tld: "com" },
  { name: "msn", tld: "com" },
  { name: "ymail", tld: "com" },
  { name: "qq", tld: "com" },
];

function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value)).length;
}

/**
 * Structural email validation (more than a regex):
 * - Overall/local/domain length limits
 * - One "@", non-empty local part and domain
 * - Local-part character set and dot placement
 * - Domain must have at least two labels, each well-formed
 * - TLD must be 2-63 letters (no digits/symbols, no obviously fake TLDs)
 *
 * NOTE: A structurally valid address still may not exist — ownership is proven
 * by the email verification code, not by this function.
 */
export function isEmailFormatValid(email) {
  if (typeof email !== "string") return false;
  const value = email.trim();
  if (!value || value.length > EMAIL_MAX_LENGTH) return false;

  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) return false;
  if (value.indexOf("@") !== atIndex) return false;

  const localPart = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);

  if (localPart.length === 0 || localPart.length > LOCAL_PART_MAX_LENGTH)
    return false;
  if (domain.length === 0 || domain.length > DOMAIN_MAX_LENGTH) return false;

  if (!LOCAL_PART_PATTERN.test(localPart)) return false;

  if (!domain.includes(".")) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => label.length === 0))
    return false;

  const tld = labels[labels.length - 1];
  if (!TLD_PATTERN.test(tld)) return false;
  for (const label of labels) {
    if (!LABEL_PATTERN.test(label)) return false;
  }

  return true;
}

// Common misspellings of the ".com" TLD (transpositions and dropped/extra
// letters). Transposition typos are distance 2, which is the same as a
// genuinely different TLD, so these are matched explicitly instead of by
// edit distance to avoid over-flagging (e.g. gmail.io stays untouched).
const TLD_TYPOS = {
  com: new Set([
    "co",
    "con",
    "cm",
    "cmo",
    "comn",
    "comm",
    "ocm",
    "moc",
    "cpm",
    "cim",
    "comc",
    "colm",
  ]),
};

function isCommonTldTypo(tld, knownTld) {
  return Boolean(TLD_TYPOS[knownTld]?.has(tld));
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Detect a likely typo of a well-known email provider domain and return the
 * corrected full email address, or null when nothing clearly matches.
 *
 * The provider NAME and TLD are scored separately: the name must be within
 * two edits and the TLD identical or within one edit. This keeps real
 * addresses like gmail.io or user@mail.com from being flagged while still
 * catching gmail.co, gmai.com, gmial.com, hotmail.co, etc.
 *
 * This NEVER auto-corrects anything — the caller must show the suggestion and
 * let the user decide.
 */
export function suggestEmailCorrection(email) {
  if (!isEmailFormatValid(email)) return null;

  const lower = email.trim().toLowerCase();
  const atIndex = lower.lastIndexOf("@");
  const local = lower.slice(0, atIndex);
  const domain = lower.slice(atIndex + 1);

  const labels = domain.split(".");
  const root = labels.slice(-2);
  const prefix = labels.length > 2 ? labels.slice(0, -2).join(".") : "";
  const [name, tld] = root;

  // Root is itself a known provider domain — nothing to correct.
  if (KNOWN_EMAIL_PROVIDERS.some((p) => p.name === name && p.tld === tld)) {
    return null;
  }

  let best = null;
  for (const known of KNOWN_EMAIL_PROVIDERS) {
    // Single-character names can spuriously match within distance 2
    // (e.g. "l" vs "me"), so require a real name on both sides.
    if (name.length < 2 || known.name.length < 2) continue;
    const nameDist = levenshtein(name, known.name);
    const tldDist = levenshtein(tld, known.tld);
    if (
      nameDist <= 2 &&
      (tldDist <= 1 || isCommonTldTypo(tld, known.tld))
    ) {
      const score = nameDist + tldDist;
      if (best === null || score < best.score) {
        best = { known, score };
      }
    }
  }

  if (!best) return null;
  const correctedDomain = prefix ? `${prefix}.${best.known.name}.${best.known.tld}` : `${best.known.name}.${best.known.tld}`;
  return `${local}@${correctedDomain}`;
}

// Names: Unicode letters plus space / . ' - separators; must start with a
// letter; digits and other symbols are rejected.
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;

export function getInvalidNameReason(name, label) {
  const value = String(name ?? "").trim();
  if (!value) return `${label} is required.`;
  if (value.length < NAME_MIN_LENGTH)
    return `${label} must be at least ${NAME_MIN_LENGTH} characters.`;
  if (value.length > NAME_MAX_LENGTH)
    return `${label} must be at most ${NAME_MAX_LENGTH} characters.`;
  if (!NAME_PATTERN.test(value))
    return `${label} must contain only letters, spaces, and . ' - characters.`;
  return null;
}

/**
 * Philippine mobile phone validation. Accepts:
 *   09171234567  (11 digits, leading 0)
 *   +639171234567 (13 chars with +)
 *   639171234567  (12 digits)
 * Returns a normalized 0XXXXXXXXXX (11-digit) form for consistent storage.
 */
export function validatePhone(phone) {
  const raw = String(phone ?? "").trim();
  if (!raw)
    return { valid: false, normalized: "", error: "Phone number is required." };

  const compact = raw.replace(/[\s-]/g, "");
  const match = compact.match(/^(?:\+?63|0)(9\d{9})$/);

  if (!match) {
    return {
      valid: false,
      normalized: "",
      error:
        "Invalid phone number. Use a Philippine mobile number like 09171234567 or +639171234567.",
    };
  }

  return { valid: true, normalized: "0" + match[1], error: null };
}

export function getPasswordChecks(password) {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&]/.test(password),
  };
}

export function getPasswordStrength(password) {
  const checks = getPasswordChecks(password);
  return {
    strength: Object.values(checks).filter(Boolean).length,
    checks,
  };
}

export function getPasswordError(password) {
  if (!password) return "Password is required.";
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (utf8ByteLength(password) > PASSWORD_MAX_BYTES)
    return `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`;
  return null;
}

export function isPasswordStrongEnough(password) {
  return getPasswordStrength(password).strength >= 3;
}
