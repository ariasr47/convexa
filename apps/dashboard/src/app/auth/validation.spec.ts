/**
 * Unit — pure auth-form validation/derivation helpers (no DOM). Covers the password-floor extraction
 * (UX_BLUEPRINT §2.2: copy reads the number, never hardcodes), the email shape check, and the 422
 * field-mapping heuristic.
 */
import { describe, expect, it } from 'vitest';
import { isLikelyEmail, extractPasswordFloor, validationFieldCopy } from './validation';

describe('isLikelyEmail', () => {
  it('accepts a well-formed address and trims', () => {
    expect(isLikelyEmail('a@b.co')).toBe(true);
    expect(isLikelyEmail('  user@example.com  ')).toBe(true);
  });
  it('rejects the obvious bad cases', () => {
    expect(isLikelyEmail('not-an-email')).toBe(false);
    expect(isLikelyEmail('a@b')).toBe(false);
    expect(isLikelyEmail('')).toBe(false);
  });
});

describe('extractPasswordFloor', () => {
  it('reads the {N} number from a 422 message rather than hardcoding it', () => {
    expect(extractPasswordFloor('Password must be at least 8 characters.')).toBe(8);
    expect(extractPasswordFloor('Password must be at least 12 characters.')).toBe(12);
  });
  it('returns null when no number is present', () => {
    expect(extractPasswordFloor('Password too short')).toBeNull();
    expect(extractPasswordFloor(undefined)).toBeNull();
  });
});

describe('validationFieldCopy', () => {
  it('maps a password message to the password field with the floor', () => {
    const r = validationFieldCopy('Password must be at least 10 characters.');
    expect(r.field).toBe('password');
    expect(r.copy).toContain('10');
  });
  it('maps an email message to the email field', () => {
    const r = validationFieldCopy('email is malformed');
    expect(r.field).toBe('email');
    expect(r.copy).toBe('Enter a valid email address.');
  });
});
