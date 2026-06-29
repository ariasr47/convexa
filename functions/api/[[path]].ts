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
// edge-to-client. We do NOT read/await the body, do NOT rewrite Cache-Control, and
// preserve the upstream headers (incl. Content-Type and X-Accel-Buffering: no).
//
// Backend origin comes from the Pages env var API_ORIGIN (e.g.
// https://<service>.up.railway.app) — set in the Pages dashboard, NEVER committed and
// NOT a secret (it's a public URL). No secret value lives in this file.
//
// /api/_metrics is operator-only (ARCHITECTURE §5/S3, OQ-4 recommended option): it is NOT
// proxied through the public edge — we return 404 so it is unreachable via *.pages.dev.
// The operator reads it via the Railway URL directly. (system-6 to confirm.)

interface Env {
  API_ORIGIN: string;
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // R4 / S3: never expose operator metrics over the public origin.
  if (url.pathname === '/api/_metrics' || url.pathname.startsWith('/api/_metrics/')) {
    return new Response('Not Found', { status: 404 });
  }

  const origin = (env.API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return new Response('API_ORIGIN is not configured', { status: 502 });
  }

  // Preserve the full /api/* path + query string against the Railway origin.
  const upstreamUrl = origin + url.pathname + url.search;

  // Forward method + headers + body (incl. Cookie). Strip hop-by-hop + Host so the
  // upstream sees its own host; CF auto-manages content-length on the streamed body.
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k) || k === 'host' || k === 'content-length') continue;
    headers.set(key, value);
  }

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

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
};
