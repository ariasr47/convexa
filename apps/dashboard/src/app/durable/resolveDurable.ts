/**
 * Loss-free migrate-on-read helper for the durable localStorage stores (rebrand-convexa).
 *
 * The product rebranded GammaFlow → Convexa. Durable blobs were stored under `gammaflow.*` keys;
 * they now live under `convexa.*`. This helper resolves a blob across BOTH brand prefixes so no
 * legacy user loses data, with these HARD guarantees (FRONTEND_EXECUTION_CONTRACT §A.1):
 *
 *  - new wins             — if `newKey` exists, return it and never consult `oldKey`.
 *  - promote-forward-once — the first read that finds only the old blob writes it forward under
 *                           `newKey`; subsequent reads short-circuit at `newKey` (idempotent —
 *                           no re-key, no duplicate).
 *  - never delete old     — the `gammaflow.*` blob is NEVER removed (rollback-safe fallback).
 *  - never throw          — every getItem/setItem stays inside a try/catch; on any failure the
 *                           helper returns null and the caller degrades to its empty in-memory
 *                           shape. A failed promote-write NEVER wipes a blob.
 *
 * It sits UNDERNEATH each store's `read()` (it only changes WHICH key supplies the raw string);
 * the in-blob hydrate (`{...empty(), ...JSON.parse(raw)}`) + corrupt-catch stay in the store, so a
 * corrupt blob still degrades to empty-in-memory there, with the unreadable old blob left intact.
 */

/**
 * Resolve a durable blob across the new + legacy brand keys.
 *
 * @returns the raw JSON string (from `newKey`, else promoted from `oldKey`), or null if neither
 *          key holds a value (or storage is unavailable). Never throws.
 */
export function resolveDurable(newKey: string, oldKey: string): string | null {
  try {
    const fromNew = localStorage.getItem(newKey);
    if (fromNew != null) return fromNew; // new wins — never consult the old key

    const fromOld = localStorage.getItem(oldKey);
    if (fromOld != null) {
      // Promote forward (idempotent). A write failure (quota/private mode) must NOT wipe the old
      // blob or throw — we still return the value so the user's data renders in-memory this session.
      try {
        localStorage.setItem(newKey, fromOld);
      } catch {
        /* best-effort promote — leave the old blob intact, return the value anyway */
      }
      // DO NOT remove(oldKey) — leave it intact (rollback-safe, mirrors the v1->v2 chain).
      return fromOld;
    }
  } catch {
    /* storage unavailable — caller degrades to its empty in-memory shape */
  }
  return null; // nothing stored under either brand
}
