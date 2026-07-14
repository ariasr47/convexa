/**
 * DEV/TEST convenience: seed a fixed simulated portfolio into the client-local positions store the
 * first time the always-available test account (`demo@convexa.io`) signs in.
 *
 * Positions are client-local by design (the server stores none — see `store.ts`), so an account's
 * "positions" can only live in this browser's localStorage. This seam populates them once so the
 * test account lands on a non-empty Positions view.
 *
 * Guarantees:
 *  - NON-DESTRUCTIVE: only seeds when the store is currently empty (never clobbers real positions).
 *  - ONE-TIME per browser+account: a marker key prevents re-seeding after the user deletes the
 *    seeded positions (deleting them stays deleted).
 *  - Simulation-only: no real order path, never feeds signals/score/tier/fingerprint.
 *  - Best-effort: any storage failure is swallowed so it can NEVER break the login flow.
 */
import { allPositions, putPosition } from './store';
import type { Position } from './types';
import { PORTFOLIO_SCHEMA_VERSION } from './types';

/** The always-available test account (mirrors the backend SEED_TEST_ACCOUNT default `demo@convexa.io`).
 *  If you override TEST_ACCOUNT_EMAIL on the backend, update this to match. */
export const TEST_ACCOUNT_EMAIL = 'demo@convexa.io';

/** The default dev password for the seeded test account (backend `TEST_ACCOUNT_PASSWORD` default).
 *  Used ONLY to pre-fill the login form when the backend reports the demo seed is active (dev-only).
 *  Not a real secret — it's a throwaway local-dev credential. If you override the backend password,
 *  update this to match (or just type it). */
export const TEST_ACCOUNT_PASSWORD = 'convexa-test-2026';

const SEED_MARKER_KEY = `convexa.test-seed.${TEST_ACCOUNT_EMAIL}`;

/** A small, plausible simulated portfolio: four open single-leg longs + one realized close. Fixed
 *  ids make the seed itself idempotent by construction (a re-run overwrites by the same id). */
const TEST_POSITIONS: Position[] = [
  {
    id: 'seed-tsla-260c',
    ticker: 'TSLA',
    expiration: '2026-08-21',
    strike: 260,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 12.4,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-12T15:32:00Z',
    stop: 8,
    target: 22,
    status: 'open',
    schema_version: PORTFOLIO_SCHEMA_VERSION,
  },
  {
    id: 'seed-nvda-170p',
    ticker: 'NVDA',
    expiration: '2026-09-18',
    strike: 170,
    right: 'put',
    side: 'long',
    qty: 1,
    entry_mark: 7.85,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-18T14:05:00Z',
    stop: null,
    target: null,
    status: 'open',
    schema_version: PORTFOLIO_SCHEMA_VERSION,
  },
  {
    id: 'seed-spy-560c',
    ticker: 'SPY',
    expiration: '2026-08-21',
    strike: 560,
    right: 'call',
    side: 'long',
    qty: 3,
    entry_mark: 6.1,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-24T13:45:00Z',
    stop: 3.5,
    target: 12,
    status: 'open',
    schema_version: PORTFOLIO_SCHEMA_VERSION,
  },
  {
    id: 'seed-amd-160c',
    ticker: 'AMD',
    expiration: '2026-08-21',
    strike: 160,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 5.2,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-26T15:10:00Z',
    stop: null,
    target: null,
    status: 'open',
    schema_version: PORTFOLIO_SCHEMA_VERSION,
  },
  {
    id: 'seed-aapl-230c',
    ticker: 'AAPL',
    expiration: '2026-06-19',
    strike: 230,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 4.05,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-02T14:10:00Z',
    status: 'closed',
    realized_pl_dollar: 196,
    realized_pl_pct: 48.4,
    close_time: '2026-06-19T19:55:00Z',
    schema_version: PORTFOLIO_SCHEMA_VERSION,
  },
];

/**
 * Seed the test portfolio if the signed-in email is the test account and we haven't already handled
 * this browser+account. No-op for every other account. Never throws.
 */
export function seedTestPositionsIfNeeded(email: string | null | undefined): void {
  try {
    if (!email || email.trim().toLowerCase() !== TEST_ACCOUNT_EMAIL) return;
    if (localStorage.getItem(SEED_MARKER_KEY)) return; // already handled on this browser+account
    // Non-destructive: only populate when the store is empty (never clobber real positions).
    if (allPositions().length === 0) {
      for (const p of TEST_POSITIONS) putPosition(p);
    }
    // Mark handled regardless — a deliberate later deletion of the seeded rows stays deleted.
    localStorage.setItem(SEED_MARKER_KEY, new Date().toISOString());
  } catch {
    /* best-effort: a storage/parse failure must never break the login flow */
  }
}

/** Test/internal seam: the marker key, exposed so specs can assert/clear it. */
export const TEST_SEED_MARKER_KEY = SEED_MARKER_KEY;
