export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export const PASSWORD_MIN_LENGTH: number;
export const PASSWORD_MAX_BYTES: number;
export const NAME_MIN_LENGTH: number;
export const NAME_MAX_LENGTH: number;

export function isEmailFormatValid(email: string): boolean;
export function suggestEmailCorrection(email: string): string | null;
export function getInvalidNameReason(name: string, label: string): string | null;
export function validatePhone(
  phone: string,
): { valid: boolean; normalized: string; error: string | null };
export function getPasswordChecks(password: string): PasswordChecks;
export function getPasswordStrength(
  password: string,
): { strength: number; checks: PasswordChecks };
export function getPasswordError(password: string): string | null;
export function isPasswordStrongEnough(password: string): boolean;
