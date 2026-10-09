import { describe, expect, it } from 'vitest';
import { COPY, ORIGIN_BLOCKED_BANNED } from './copy';

describe('copy — exact SPEC §4', () => {
  it('origin-blocked must not contain blocked occupancy', () => {
    expect(COPY.originBlockedBody).not.toContain(ORIGIN_BLOCKED_BANNED);
    expect(ORIGIN_BLOCKED_BANNED).toBe('blocked occupancy');
  });
});
