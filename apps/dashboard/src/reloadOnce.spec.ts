/**
 * The reload guard for a chunk that fails to load (site audit SEC-5). Both ways it can break are
 * silent: no reload leaves a blank route after a deploy, and a reload whose flag doesn't hold loops
 * forever on a chunk that is gone for good.
 */
import { describe, expect, it } from 'vitest';
import { RELOAD_FLAG, shouldReloadOnce } from './reloadOnce';

/** An in-memory stand-in for sessionStorage: getItem and setItem are all the guard uses. */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

const denied = (): never => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe('shouldReloadOnce', () => {
  it('reloads on the first failure in a tab and never again', () => {
    const storage = memoryStorage();
    expect(shouldReloadOnce(() => storage)).toBe(true);
    expect(storage.getItem(RELOAD_FLAG)).toBe('1');
    expect(shouldReloadOnce(() => storage)).toBe(false);
    expect(shouldReloadOnce(() => storage)).toBe(false);
  });

  it('never reloads when the flag cannot be kept', () => {
    // Blocked: reading window.sessionStorage itself throws.
    expect(shouldReloadOnce(denied)).toBe(false);
    // Absent: Firefox gives null with DOM storage turned off.
    expect(shouldReloadOnce(() => null)).toBe(false);
    // The read throws, the write throws (full), or the write is silently dropped.
    expect(shouldReloadOnce(() => ({ getItem: denied, setItem: () => undefined }))).toBe(false);
    expect(shouldReloadOnce(() => ({ getItem: () => null, setItem: denied }))).toBe(false);
    expect(shouldReloadOnce(() => ({ getItem: () => null, setItem: () => undefined }))).toBe(false);
  });
});
