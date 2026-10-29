// Cloudflare Pages Function — catch-all /api/* proxy to the Railway backend. [deploy R3]
//
// Why this exists (ARCHITECTURE_CONTRACT §1, option A): the SPA client
// (libs/api/src/lib/convexa.ts) builds EVERY API URL as a RELATIVE path and assumes
// same-origin (the gf_session cookie is credentials:'same-origin', the live tiles use
// EventSource SSE). There is no VITE_ absolute base. So in production the browser must
// stay same-origin on *.pages.dev; this edge Function forwards /api/* to the Railway
// origin, keeping the cookie first-party (SameSite=Lax) and the server the gate of record.
//
// SSE-safe: we return the upstream Response BODY UNBUFFERED
// (`new Response(upstream.body, ...)`) so text/event-stream flushes event-by-event
// edge-to-client. We do NOT read/await the body, leave an event stream's Cache-Control as
// the upstream set it, and preserve the upstream headers (incl. Content-Type and
// X-Accel-Buffering: no).
//
// Caching (API-CACHE, site audit 2026-10-25): every other answer gets a Cache-Control here.
// Only an identity-free public read (/api/health, /api/public-data/*: GET or HEAD, 200, no
// Set-Cookie) may be kept, briefly, and the API answers those the same for every caller;
// everything else, sessions and owner-only reads included, is no-store.
//
// Backend origin comes from the Pages env var API_ORIGIN (e.g.
// https://<service>.up.railway.app) — set in the Pages dashboard, NEVER committed and
// NOT a secret (it's a public URL). No secret value lives in this file.
//
// /api/_metrics and /api/_research/* are operator-only (ARCHITECTURE §5/S3; chain-snapshot-
// capture AC-16): they are NOT proxied through the public trader origin — we return 404 so
// they are unreachable via *.pages.dev. The operator reads them via the Railway URL directly.
// Token gate alone is not the _metrics posture.
//
// The visitor's address (SEC-2, site audit 2026-10-25): the API's per-IP limits need it, and only
// this Function knows it. Railway's edge sets X-Real-IP, and overwrites X-Forwarded-For, to the
// address that connected to it, here a Cloudflare egress address, so the visitor's address travels
// in X-Convexa-Client-IP, and PAGES_PROXY_SECRET vouches that this Function set it. The API trusts
// the header only beside that secret (apps/api/src/middleware/rate_limit.rs, client_key). Set the
// same value as a Pages secret first, then on the API. Unset sends no secret.

interface Env {
  API_ORIGIN: string;
  PAGES_PROXY_SECRET?: string;
}

// Hop-by-hop headers that must not be forwarded across the proxy (RFC 7230 §6.1).
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

// Client-address headers a visitor can send. None is forwarded as sent: the ones the API reads are
// set below from Cloudflare's CF-Connecting-IP, which a visitor cannot set.
const CLIENT_ADDRESS = new Set([
  'x-forwarded-for',
  'x-real-ip',
  'x-convexa-client-ip',
  'x-convexa-proxy-secret',
]);

// Edge defence-in-depth (the static SPA gets the same from public/_headers), on every answer,
// the edge's own included. An upstream value wins; Content-Type and Set-Cookie are never touched.
const DEFENCE_HEADERS: ReadonlyArray<[string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'],
];

function withDefenceHeaders(headers: Headers): Headers {
  for (const [name, value] of DEFENCE_HEADERS) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return headers;
}

// An answer the edge gives itself: defended, and never cached.
function edgeAnswer(body: string, status: number): Response {
  const headers = withDefenceHeaders(new Headers({ 'Cache-Control': 'no-store' }));
  return new Response(body, { status, headers });
}

// A browser may keep a public read 30 s, and reuse it up to 5 minutes more while it refetches.
const PUBLIC_READ_CACHE = 'public, max-age=30, stale-while-revalidate=300';

// The reads the API answers the same for every caller: no session, no owner gate, no cookie.
// tools/pages-proxy.spec.mjs fails if one of them stops being anonymous in the API contract.
function isPublicRead(method: string, pathname: string): boolean {
  return (
    (method === 'GET' || method === 'HEAD') &&
    (pathname === '/api/health' || pathname.startsWith('/api/public-data/'))
  );
}

function applyCachePolicy(method: string, pathname: string, status: number, headers: Headers) {
  if ((headers.get('content-type') ?? '').toLowerCase().startsWith('text/event-stream')) return;
  if (status === 200 && isPublicRead(method, pathname) && !headers.has('set-cookie')) {
    if (!headers.has('cache-control')) headers.set('Cache-Control', PUBLIC_READ_CACHE);
    return;
  }
  headers.set('Cache-Control', 'no-store');
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // R4 / S3 / AC-16: never expose operator metrics or research corpus over the public origin.
  if (
    url.pathname === '/api/_metrics' ||
    url.pathname.startsWith('/api/_metrics/') ||
    url.pathname === '/api/_research' ||
    url.pathname.startsWith('/api/_research/')
  ) {
    return edgeAnswer('Not Found', 404);
  }

  const origin = (env.API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return edgeAnswer('API_ORIGIN is not configured', 502);
  }

  // Preserve the full /api/* path + query string against the Railway origin.
  const upstreamUrl = origin + url.pathname + url.search;

  // Forward method + headers + body (incl. Cookie). Strip hop-by-hop + Host so the
  // upstream sees its own host; CF auto-manages content-length on the streamed body.
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k) || k === 'host' || k === 'content-length' || CLIENT_ADDRESS.has(k))
      continue;
    headers.set(key, value);
  }
  const visitor = request.headers.get('cf-connecting-ip')?.trim();
  if (visitor) {
    headers.set('X-Forwarded-For', visitor);
    headers.set('X-Real-IP', visitor);
    headers.set('X-Convexa-Client-IP', visitor);
  }
  const secret = env.PAGES_PROXY_SECRET?.trim();
  if (secret) headers.set('X-Convexa-Proxy-Secret', secret);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  // GET/HEAD have no body; everything else streams the request body through.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  const upstream = await fetch(upstreamUrl, init);

  // Stream the upstream body back UNBUFFERED so SSE survives. Copy upstream headers
  // verbatim (preserves Content-Type: text/event-stream, X-Accel-Buffering: no, and
  // Set-Cookie so gf_session round-trips first-party). Drop hop-by-hop headers only.
  const respHeaders = new Headers();
  for (const [key, value] of upstream.headers) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    respHeaders.set(key, value);
  }
  withDefenceHeaders(respHeaders);
  applyCachePolicy(request.method, url.pathname, upstream.status, respHeaders);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
};
