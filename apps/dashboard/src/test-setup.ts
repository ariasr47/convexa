// Vitest setup for the dashboard test suite (wired via `setupFiles` in vite.config.mts).
// Adds jest-dom matchers (toBeInTheDocument, toHaveValue, …) to Vitest's `expect`.
import '@testing-library/jest-dom/vitest';

// @testing-library/react auto-cleans between tests when run under Vitest globals, but we register
// it explicitly so the behavior is guaranteed regardless of the globals setting. cleanup() is
// idempotent, so this is safe even if the adapter has already wired its own afterEach.
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/**
 * Node 26+ exposes experimental `globalThis.localStorage` that is **unusable** without
 * `--localstorage-file` (ExperimentalWarning in CI). That stub shadows jsdom's Storage and
 * breaks every durable-store / positions / ledger suite (they all read/write localStorage).
 * Install a real in-memory Storage on both globalThis and window before any app code runs.
 */
function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(String(key), String(value));
    },
  };
  for (const target of [globalThis, typeof window !== 'undefined' ? window : undefined]) {
    if (!target) continue;
    Object.defineProperty(target, 'localStorage', {
      configurable: true,
      enumerable: true,
      value: storage,
      writable: true,
    });
  }
}

installMemoryLocalStorage();

beforeEach(() => {
  // Isolation: each test starts with empty durable storage (matches prior jsdom default).
  try {
    localStorage.clear();
  } catch {
    installMemoryLocalStorage();
  }
});

afterEach(() => cleanup());

// findBy*/waitFor default to 1s, which flakes on loaded CI runners (a shared 4-vCPU box renders
// far slower than a dev machine). 5s only delays *failure* reporting — passing waits return early.
configure({ asyncUtilTimeout: 5000 });
