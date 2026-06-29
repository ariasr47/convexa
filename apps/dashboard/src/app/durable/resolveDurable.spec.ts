/**
 * Unit tests for the loss-free migrate-on-read helper (rebrand-convexa, FRONTEND_EXECUTION_CONTRACT
 * §A.1). Pure logic over a real jsdom localStorage — no DOM render, no network. Asserts the four HARD
 * guarantees: new-wins, promote-forward-once (idempotent), never-delete-old (rollback-safe),
 * never-throw (degrade to null). These guarantees back every store's AC-A* migration behavior.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { resolveDurable } from './resolveDurable';

const NEW = 'convexa.thing.v1';
const OLD = 'gammaflow.thing.v1';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('resolveDurable', () => {
  it('returns null when neither key is present', () => {
    expect(resolveDurable(NEW, OLD)).toBeNull();
    expect(localStorage.getItem(NEW)).toBeNull(); // nothing written
  });

  it('new wins: returns the new blob and NEVER consults the old key', () => {
    localStorage.setItem(NEW, 'NEWVAL');
    localStorage.setItem(OLD, 'OLDVAL');
    const spy = vi.spyOn(Storage.prototype, 'getItem');
    expect(resolveDurable(NEW, OLD)).toBe('NEWVAL');
    // old key was never read (short-circuit at the new key).
    expect(spy.mock.calls.some(([k]) => k === OLD)).toBe(false);
  });

  it('promote-forward: with only the old blob, returns it AND writes it under the new key', () => {
    localStorage.setItem(OLD, 'LEGACY');
    expect(resolveDurable(NEW, OLD)).toBe('LEGACY');
    expect(localStorage.getItem(NEW)).toBe('LEGACY'); // promoted forward
  });

  it('never deletes the old key after a promote (rollback-safe)', () => {
    localStorage.setItem(OLD, 'LEGACY');
    resolveDurable(NEW, OLD);
    expect(localStorage.getItem(OLD)).toBe('LEGACY'); // still intact
  });

  it('idempotent: a second call short-circuits at the new key, never re-reads/re-writes old', () => {
    localStorage.setItem(OLD, 'LEGACY');
    resolveDurable(NEW, OLD); // first call promotes
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');
    expect(resolveDurable(NEW, OLD)).toBe('LEGACY');
    expect(setSpy).not.toHaveBeenCalled();        // no re-write
    expect(getSpy.mock.calls.some(([k]) => k === OLD)).toBe(false); // never touched the old key
  });

  it('never throws when getItem throws (storage unavailable) — returns null', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => resolveDurable(NEW, OLD)).not.toThrow();
    expect(resolveDurable(NEW, OLD)).toBeNull();
  });

  it('promote-write failure is swallowed: still returns the value, old blob untouched', () => {
    localStorage.setItem(OLD, 'LEGACY');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => resolveDurable(NEW, OLD)).not.toThrow();
    expect(resolveDurable(NEW, OLD)).toBe('LEGACY'); // value still surfaced in-memory
    expect(localStorage.getItem(OLD)).toBe('LEGACY'); // old blob never wiped
  });

  it('preserves the exact bytes of the old blob on promote (no transform)', () => {
    const blob = JSON.stringify({ a: 1, nested: { b: [1, 2, 3] }, s: 'x' });
    localStorage.setItem(OLD, blob);
    expect(resolveDurable(NEW, OLD)).toBe(blob);
    expect(localStorage.getItem(NEW)).toBe(blob); // byte-identical promotion
  });
});
