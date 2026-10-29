/**
 * Whether a chunk that failed to load should reload the page: once per tab session, never twice.
 *
 * A deploy replaces the hashed chunks, so a tab opened before it asks for a chunk that is gone, gets
 * the SPA shell instead, and Vite fires `vite:preloadError` (site audit 2026-10-25, SEC-5). One
 * reload fetches the new index.html and the chunks it names. The flag keeps a chunk that is missing
 * for good from reloading the page in a loop: a second failure in the same tab surfaces as the error
 * it is. Storage that is blocked, absent or full means no reload, for the same reason.
 *
 * `storage` is a getter, so reading `window.sessionStorage` (which throws where storage is blocked)
 * happens inside the try as well.
 */
export const RELOAD_FLAG = 'convexa.chunk-reload.v1';

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function shouldReloadOnce(storage: () => FlagStorage | null): boolean {
  try {
    const store = storage();
    if (!store || store.getItem(RELOAD_FLAG) !== null) return false;
    store.setItem(RELOAD_FLAG, '1');
    // Reload only on a flag that reads back: a write that didn't take would allow a loop.
    return store.getItem(RELOAD_FLAG) === '1';
  } catch {
    return false;
  }
}
