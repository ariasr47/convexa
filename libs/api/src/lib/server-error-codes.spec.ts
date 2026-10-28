/**
 * The API's error codes, each mapped to the kind this client gives it: a contract between the two
 * services (auth is a test floor). The API names every auth-class refusal with a closed `error`
 * code (`apps/api/src/services/auth/service.rs`), and the dashboard acts on the kind the client
 * derives from it: the copy it shows, and whether a poller keeps asking.
 *
 * The owner gate is why this exists (docs/product/ai-analyst/DESIGN.md, "2026-10-26: the owner
 * gate shipped"). Every owner-only route answers 403 `auth_required` signed out and 403
 * `owner_only` signed in as anyone but the owner. A client that reads every 403 as `auth_required`
 * asks a signed-in person to sign in, and a poller that cannot tell either refusal from a transport
 * fault asks again forever.
 *
 * A kind is the `AuthError` code for an auth-class outcome, `market_data_paused` for the paused
 * 503, and `ApiError <status>` for any other fault (no code is invented for it).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  AuthError,
  fetchRecExport,
  fetchRecStatus,
  fetchTrackedContract,
  getScan,
  getStructureHistory,
  getTicker,
  isMarketDataPaused,
  login,
  requestRecommendation,
  saveSettings,
  signup,
  simTradeGate,
  type RecRequest,
} from './convexa';

function kindOf(outcome: unknown): string {
  if (outcome instanceof AuthError) return outcome.code;
  if (isMarketDataPaused(outcome)) return 'market_data_paused';
  if (outcome instanceof ApiError) return `ApiError ${outcome.status}`;
  return 'no error';
}

/** The reply body exactly as the API writes it: the auth envelope (`AuthError::envelope`), except
 *  the paused reply, which carries `code` and no `error` (`AppErrorBody`, SPEC B5). */
function bodyFor(code: string): Record<string, string> {
  return code === 'market_data_paused'
    ? { detail: 'Market data is paused.', code }
    : { error: code, message: 'The server’s own sentence.' };
}

const CREDS = { email: 'someone@example.invalid', password: 'not-a-real-password' };
const REQ: RecRequest = {
  persona_id: null,
  snapshot_fingerprint: 'ab12',
  dte_min: 7,
  dte_max: 45,
  dark_pool: true,
  override: false,
};
const LOGIN = () => login(CREDS);
const SIGNUP = () => signup(CREDS);
const BUNDLE = () => getTicker('SPY');

type Call = () => Promise<unknown>;

/** Every owner-only route this client reads by fetch (`routes::OWNER_ONLY_OPERATIONS`). The ticker
 *  stream is an EventSource, which never sees a status; the client calls none of the other five. */
const OWNER_ONLY_CALLS: ReadonlyArray<readonly [route: string, call: Call]> = [
  ['GET /api/scan', () => getScan()],
  ['GET /api/scan/{symbol}/history', () => getStructureHistory('SPY')],
  ['GET /api/ticker/{ticker}', BUNDLE],
  [
    'GET /api/contract/{ticker}',
    () => fetchTrackedContract('SPY', { expiration: '2026-11-20', strike: 600, right: 'call' }),
  ],
  ['GET /api/recommendation/export/{ticker}', () => fetchRecExport('SPY')],
  ['GET /api/recommendation/status/{ticker}', () => fetchRecStatus('SPY')],
  ['POST /api/recommendation/{ticker}', () => requestRecommendation('SPY', REQ)],
];

type Row = readonly [status: number, code: string, route: string, call: Call, kind: string];

const ROWS: readonly Row[] = [
  // The account routes: one reader maps them all, each read where the server sends it.
  [409, 'email_taken', 'POST /api/auth/signup', SIGNUP, 'email_taken'],
  [422, 'validation', 'POST /api/auth/login', LOGIN, 'validation'],
  [401, 'bad_credentials', 'POST /api/auth/login', LOGIN, 'bad_credentials'],
  [403, 'signups_closed', 'POST /api/auth/signup', SIGNUP, 'signups_closed'],
  [429, 'rate_limited', 'POST /api/auth/login', LOGIN, 'rate_limited'],
  [503, 'auth_unavailable', 'POST /api/auth/login', LOGIN, 'auth_unavailable'],
  [401, 'auth_required', 'PUT /api/auth/settings', () => saveSettings({}), 'auth_required'],
  [403, 'auth_required', 'POST /api/positions/sim-trade/gate', simTradeGate, 'auth_required'],
  // Sent only on the OAuth start routes, which the browser navigates to and no fetch reads. Read
  // through the same account reader, so each still has its own kind if one ever is.
  [409, 'google_unavailable', 'GET /api/auth/google/start', LOGIN, 'google_unavailable'],
  [409, 'grok_unavailable', 'GET /api/auth/grok/start', LOGIN, 'grok_unavailable'],
  // The owner gate's two refusals, on every owner-only route the client reads.
  ...OWNER_ONLY_CALLS.flatMap(([route, call]): Row[] => [
    [403, 'auth_required', route, call, 'auth_required'],
    [403, 'owner_only', route, call, 'owner_only'],
  ]),
  [503, 'market_data_paused', 'GET /api/ticker/{ticker}', BUNDLE, 'market_data_paused'],
];

/** The closed auth codes the API can send: every `code: "…"` its auth service constructs. */
function serverAuthCodes(): string[] {
  const workspace = resolve(import.meta.dirname, '../../../..');
  const source = readFileSync(resolve(workspace, 'apps/api/src/services/auth/service.rs'), 'utf8');
  return [...new Set([...source.matchAll(/\bcode: "([a-z_]+)"/g)].map(([, code]) => code))].sort();
}

const settle = (call: Call) =>
  call().then(
    () => undefined,
    (error: unknown) => error,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('server error codes', () => {
  it('maps each server error code to its kind', async () => {
    const mismatches: string[] = [];
    for (const [status, code, route, call, kind] of ROWS) {
      const reply = () =>
        new Response(JSON.stringify(bodyFor(code)), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => reply()),
      );
      const actual = kindOf(await settle(call));
      if (actual !== kind) mismatches.push(`${status} ${code} on ${route}: ${actual}, not ${kind}`);
    }
    expect(mismatches).toEqual([]);

    // Every code the server can send has a row, so a new one fails here until it has a kind.
    const tabled = new Set(ROWS.map(([, code]) => code));
    const codes = serverAuthCodes();
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.filter((code) => !tabled.has(code))).toEqual([]);
  });
});
