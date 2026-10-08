/**
 * A minimal static file server for the browser-quality gates — replaces `http-server` (2026-09-23,
 * curvature-v2-landing-and-site F15b).
 *
 * WHY: `http-server@14.1.1` 302s a request for an existing directory to add the trailing slash, then
 * serves a directory listing or a 403 when that directory carries no `index.html`
 * (`node_modules/http-server/lib/core/index.js:374-417`). `apps/dashboard/public/blog/` holds one
 * standalone article (`how-we-read-dealer-structure.html`) and no index file, so `GET /blog` never
 * reached the SPA under `http-server` — it 302s to `/blog/`, which lists the directory instead of
 * mounting the app. No `http-server` flag combination fixes this without breaking `/`:
 * `-i false -d false` 404s the root and loops the `-P` proxy fallback.
 *
 * Production does not have this bug. Cloudflare Pages checks for a real static-asset match first and
 * falls back to `apps/dashboard/public/_redirects`'s `/*  /index.html  200` for everything else — a
 * directory with no `index.html` is not a static-asset match, so it falls through to the SPA shell.
 * Measured 2026-09-23: `curl https://convexa.pages.dev/blog` and `.../blog/` both return 200 with the
 * SPA shell (4,946 bytes, `<div id="root">`). This server reproduces exactly that rule for the gates,
 * using node built-ins only (http/https, fs, path, url — no new dependency):
 *   - an existing regular FILE is served with its Content-Type from the MIME map below;
 *   - an existing DIRECTORY that itself carries an `index.html` serves that file;
 *   - everything else — including a directory with no `index.html`, like `/blog` — serves the ROOT
 *     `index.html` with 200, exactly like the `_redirects` catch-all.
 *
 * Usage: node serve-dist.mjs <root> <port> <host> [http|https]
 * HTTPS uses a public, test-only localhost certificate and accepts only loopback bind hosts.
 * It keeps upgrade-insecure-requests effective without upgrading assets onto an HTTP listener.
 */
import { promises as fs } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import path from 'node:path';
import { URL } from 'node:url';

const [, , rootArg, portArg, hostArg, protocol = 'http', ...extraArgs] = process.argv;
if (
  !rootArg ||
  !portArg ||
  !hostArg ||
  !['http', 'https'].includes(protocol) ||
  extraArgs.length ||
  !Number.isInteger(Number(portArg)) ||
  Number(portArg) < 1 ||
  Number(portArg) > 65535
) {
  console.error('usage: node serve-dist.mjs <root> <port 1-65535> <host> [http|https]');
  process.exit(1);
}
if (protocol === 'https' && !['localhost', '127.0.0.1', '::1'].includes(hostArg)) {
  console.error('[serve-dist] the public test-only TLS certificate requires a loopback host');
  process.exit(1);
}
const ROOT = path.resolve(process.cwd(), rootArg);
const ROOT_WITH_SEP = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
const PORT = Number(portArg);
const HOST = hostArg;
const ORIGIN = `${protocol}://${HOST === '::1' ? '[::1]' : HOST}:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};
const DEFAULT_TYPE = 'application/octet-stream';

/** Read only the artifact's global CSP; this is not a general Pages _headers emulator. */
async function readGlobalCsp() {
  let source;
  try {
    source = await fs.readFile(path.join(ROOT, '_headers'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  let globalBlock = false;
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      globalBlock = line.trim() === '/*';
      continue;
    }
    if (globalBlock) {
      const match = line.match(/^\s+Content-Security-Policy:\s*(.+?)\s*$/i);
      if (match) return match[1];
    }
  }
  return null;
}
const GLOBAL_CSP = await readGlobalCsp();

/** Every response keeps the gate cache/CORS behavior and the artifact's global CSP, if present. */
function commonHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...(GLOBAL_CSP === null ? {} : { 'Content-Security-Policy': GLOBAL_CSP }),
  };
}

/**
 * Decode the request pathname and resolve it against ROOT. Returns null when decoding fails or the
 * resolved path would escape ROOT (e.g. `/../../secret`) — the caller answers 404 either way.
 */
function resolveInsideRoot(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const resolved = path.resolve(ROOT, `.${decoded}`);
  if (resolved !== ROOT && !resolved.startsWith(ROOT_WITH_SEP)) return null;
  return resolved;
}

async function statOrNull(target) {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

async function sendFile(res, status, filePath, method) {
  const type = MIME[path.extname(filePath).toLowerCase()] ?? DEFAULT_TYPE;
  if (method === 'HEAD') {
    res.writeHead(status, { ...commonHeaders(), 'Content-Type': type });
    res.end();
    return;
  }
  const body = await fs.readFile(filePath);
  res.writeHead(status, {
    ...commonHeaders(),
    'Content-Type': type,
    'Content-Length': String(body.length),
  });
  res.end(body);
}

function sendEmpty(res, status, extraHeaders = {}) {
  res.writeHead(status, { ...commonHeaders(), ...extraHeaders });
  res.end();
}

const handleRequest = (req, res) => {
  void (async () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendEmpty(res, 405, { Allow: 'GET, HEAD' });
      return;
    }
    let pathname;
    try {
      pathname = new URL(req.url ?? '/', ORIGIN).pathname;
    } catch {
      sendEmpty(res, 404);
      return;
    }
    const target = resolveInsideRoot(pathname);
    if (target === null) {
      sendEmpty(res, 404);
      return;
    }
    const stat = await statOrNull(target);
    if (stat?.isFile()) {
      await sendFile(res, 200, target, req.method);
      return;
    }
    if (stat?.isDirectory()) {
      const indexPath = path.join(target, 'index.html');
      const indexStat = await statOrNull(indexPath);
      if (indexStat?.isFile()) {
        await sendFile(res, 200, indexPath, req.method);
        return;
      }
    }
    // Everything else — a missing path, or a directory with no index.html (e.g. `/blog`) — mirrors
    // `_redirects`'s `/*  /index.html  200` catch-all.
    await sendFile(res, 200, path.join(ROOT, 'index.html'), req.method);
  })().catch((error) => {
    console.error('[serve-dist]', error);
    if (!res.headersSent) sendEmpty(res, 500);
    else res.end();
  });
};

const server =
  protocol === 'https'
    ? createHttpsServer(
        {
          cert: await fs.readFile(new URL('./fixtures/localhost-test-cert.pem', import.meta.url)),
          key: await fs.readFile(new URL('./fixtures/localhost-test-key.pem', import.meta.url)),
        },
        handleRequest,
      )
    : createHttpServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`[serve-dist] serving ${ROOT} at ${ORIGIN}`);
});
