// The Cloudflare Pages catch-all functions/api/[[path]].ts, by behavior: it is the only edge
// boundary keeping the operator endpoints (/api/_metrics, /api/_research) off the public
// *.pages.dev origin (ARCHITECTURE_CONTRACT §5/S3, chain-snapshot-capture AC-16, batch-backtest-cli
// AC-22). Calls the real onRequest (Node strips its type annotations) with a faked upstream fetch.
// Replaces the source-text scans in batch-backtest-cli.structural.spec.ts.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { onRequest } from '../functions/api/[[path]].ts';

const ORIGIN = 'https://convexa-api.up.railway.app';
const realFetch = globalThis.fetch;
let calls;
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response('upstream body', { status: 418 });
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const call = (path, env = { API_ORIGIN: `${ORIGIN}/` }) =>
  onRequest({ request: new Request(`https://convexa.pages.dev${path}`), env });

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
