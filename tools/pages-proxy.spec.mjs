// The Cloudflare Pages catch-all functions/api/[[path]].ts, by behavior: it is the only edge
// boundary keeping the operator endpoints (/api/_metrics, /api/_research) off the public
// *.pages.dev origin (ARCHITECTURE_CONTRACT §5/S3, chain-snapshot-capture AC-16, batch-backtest-cli
// AC-22), and the only party that knows the visitor's address (SEC-2, site audit 2026-10-25). Calls
// the real onRequest (Node strips its type annotations) with a faked upstream fetch.
// Replaces the source-text scans in batch-backtest-cli.structural.spec.ts.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { onRequest } from '../functions/api/[[path]].ts';

const ORIGIN = 'https://convexa-api.up.railway.app';
const realFetch = globalThis.fetch;
let calls;
let sent;
beforeEach(() => {
  calls = [];
  sent = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    sent.push(new Headers(init?.headers));
    return new Response('upstream body', { status: 418 });
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const call = (path, env = { API_ORIGIN: `${ORIGIN}/` }, headers = {}) =>
  onRequest({ request: new Request(`https://convexa.pages.dev${path}`, { headers }), env });

test('operator endpoints return 404 on the public origin and never reach the upstream', async () => {
  for (const path of [
    '/api/_metrics',
    '/api/_metrics/latency',
    '/api/_metrics?token=operator-token',
    '/api/_research',
    '/api/_research/session-books/2026-10-08',
  ]) {
    const res = await call(path);
    assert.deepEqual(
      { status: res.status, upstreamCalls: calls.length },
      { status: 404, upstreamCalls: 0 },
      path,
    );
  }
});

test('every other /api path is forwarded verbatim and the upstream status is returned', async () => {
  for (const [path, upstreamUrl] of [
    // Look-alikes of the operator prefixes are not operator paths: the refusal is prefix-exact.
    ['/api/_researching', `${ORIGIN}/api/_researching`],
    ['/api/_metricsx', `${ORIGIN}/api/_metricsx`],
    // Path and query survive; the configured origin's trailing slash is dropped.
    ['/api/ticker/SPY?dte_max=45', `${ORIGIN}/api/ticker/SPY?dte_max=45`],
  ]) {
    calls = [];
    const res = await call(path);
    assert.deepEqual(
      { url: calls[0], status: res.status },
      { url: upstreamUrl, status: 418 },
      path,
    );
  }
});

test('a missing API_ORIGIN fails closed with 502 and fetches nothing', async () => {
  for (const env of [{}, { API_ORIGIN: '' }]) {
    const res = await call('/api/ticker/SPY', env);
    assert.deepEqual(
      { status: res.status, upstreamCalls: calls.length },
      { status: 502, upstreamCalls: 0 },
    );
  }
});

// SEC-2: the API's per-IP limits key on the visitor's address. Railway's edge replaces
// X-Forwarded-For and X-Real-IP with the address that connected to it, which for proxied traffic is
// a Cloudflare egress address, so the visitor's address reaches the API only in a header the proxy
// sets, and the API trusts that header only beside the shared secret (rate_limit.rs, client_key).
const VISITOR = '198.51.100.20';
const SECRET = 'pages-proxy-secret-for-tests-0123456789abcdef';
const CLIENT_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'x-convexa-client-ip',
  'x-convexa-proxy-secret',
];
// Cloudflare sets cf-connecting-ip and a visitor cannot; every other header here is the visitor's.
const visitorClaims = {
  'cf-connecting-ip': VISITOR,
  'x-forwarded-for': '203.0.113.7',
  'x-real-ip': '203.0.113.8',
  'x-convexa-client-ip': '203.0.113.9',
  'x-convexa-proxy-secret': 'a-guessed-secret',
};
const forwardedClientHeaders = async (env, headers = visitorClaims) => {
  sent = [];
  await call('/api/public-data/tickers/SPY', { API_ORIGIN: ORIGIN, ...env }, headers);
  return Object.fromEntries(CLIENT_HEADERS.map((name) => [name, sent[0].get(name)]));
};

test('the upstream gets the address Cloudflare saw, never an address the visitor sent', async () => {
  assert.deepEqual(await forwardedClientHeaders({}), {
    'x-forwarded-for': VISITOR,
    'x-real-ip': VISITOR,
    'x-convexa-client-ip': VISITOR,
    'x-convexa-proxy-secret': null,
  });
});

test('with PAGES_PROXY_SECRET set, each forwarded request vouches for its address', async () => {
  // Trimmed, as the API trims its copy: a pasted trailing newline must not split the two.
  const vouched = await forwardedClientHeaders({ PAGES_PROXY_SECRET: `${SECRET}\n` });
  assert.equal(vouched['x-convexa-client-ip'], VISITOR);
  assert.equal(vouched['x-convexa-proxy-secret'], SECRET);
  for (const unset of [{}, { PAGES_PROXY_SECRET: '' }, { PAGES_PROXY_SECRET: '  ' }]) {
    const plain = await forwardedClientHeaders(unset);
    assert.equal(plain['x-convexa-proxy-secret'], null, JSON.stringify(unset));
  }
});

test('without a Cloudflare address, no client address is forwarded at all', async () => {
  const claims = Object.fromEntries(
    Object.entries(visitorClaims).filter(([name]) => name !== 'cf-connecting-ip'),
  );
  assert.deepEqual(await forwardedClientHeaders({ PAGES_PROXY_SECRET: SECRET }, claims), {
    'x-forwarded-for': null,
    'x-real-ip': null,
    'x-convexa-client-ip': null,
    'x-convexa-proxy-secret': SECRET,
  });
});
