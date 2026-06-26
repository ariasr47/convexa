/**
 * Pure auth-form validation/derivation helpers (unit-tested in isolation, no DOM). Client-side
 * checks are UX sugar for the obvious cases; the SERVER is the enforcement boundary (it returns the
 * 422 `validation` / 401 `bad_credentials` outcomes the forms map to copy).
 */
import { AUTH_COPY } from './copy';

/** A deliberately permissive email shape check — just enough to catch the obvious "no @" case before
 *  a round-trip. The server is authoritative on validity. */
export function isLikelyEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Extract the backend password floor `{N}` from a 422 `validation` message (UX_BLUEPRINT §2.2: the
 *  copy reads the number, never hardcodes it). Returns null when the message carries no number. */
export function extractPasswordFloor(message: string | undefined): number | null {
  if (!message) return null;
  const m = message.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Map a 422 validation message to the field-level copy. Heuristic: a message mentioning the
 *  password/characters maps to the password field; otherwise the email field. */
export function validationFieldCopy(
  message: string | undefined,
): { field: 'email' | 'password'; copy: string } {
  const lower = (message ?? '').toLowerCase();
  if (lower.includes('password') || lower.includes('character')) {
    const floor = extractPasswordFloor(message);
    return {
      field: 'password',
      copy: floor != null ? AUTH_COPY.signup.passwordFloor(floor) : AUTH_COPY.signup.passwordFloorGeneric,
    };
  }
  return { field: 'email', copy: AUTH_COPY.signup.invalidEmail };
}
