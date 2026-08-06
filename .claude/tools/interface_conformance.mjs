#!/usr/bin/env node
// interface_conformance.mjs — runtime FE↔BE conformance check (system-1).
//
// Proves the dangerous unguarded seam: the live backend EMITS the fields the INTERFACE_CONTRACT
// promises (= the fields the frontend CONSUMES, since the FE binds to the same interface).
// Integration stops being *asserted* and becomes *verified*.
//
// How it works: each `INTERFACE_CONTRACT.md` carries a machine-checkable **conformance spec** — a
// fenced ```json block under a "## Conformance spec" heading — listing each endpoint + the required
// field paths (name · type · presence). This tool hits the live endpoint (or a captured sample) and
// validates the emitted JSON against that spec. The interface stays the single source of truth;
// this just makes it executable.
//
// Usage:
//     # live: boot the backend yourself (see project.json `backend.serve_cmd`), then —
//     node .claude/tools/interface_conformance.mjs --contract .claude/contracts/{F}/INTERFACE_CONTRACT.md --url <backend-base-url>
//     # or a standalone spec file:
//     node .claude/tools/interface_conformance.mjs --spec .claude/tools/conformance/<feature>.json --url <backend-base-url>
//     # offline: validate a captured response against one endpoint (CI / no server):
//     node .claude/tools/interface_conformance.mjs --spec SPEC.json --sample resp.json --endpoint /api/example
//     # receipt: write a machine-readable verdict alongside the human output (any mode):
//     node .claude/tools/interface_conformance.mjs --contract … --url … --report .claude/contracts/{F}/conformance-receipt.json
//
// Spec schema (JSON):
//     {"endpoints": [{
//        "method": "GET", "path": "/api/example/{id}",
//        "path_params": {"id": "abc"}, "query": {"limit": 7},
//        "required": { "<dot.path>": "<typespec>", ... }
//     }]}
// Type specs: number | string | boolean | object | array | null ; unions "object|null"; trailing "?"
// = optional (absent ⇒ pass, present ⇒ must match). A path segment "name[]" means "the value at name
// is an array — apply the rest of the path to EACH element" (empty array ⇒ vacuously passes).
//
// Receipt (--report): a JSON object {tool, verdict, mode, source, base_url, checked_at, summary,
// endpoints}. `verdict` is PASS (live, all pass) | FAIL (any failure, either mode) | UNVERIFIABLE
// (sample, all pass — a captured response proves the shape at capture time, not that the live
// backend emits it now). The flag never changes stdout or the exit code.
//
// Exit: 1 if any endpoint FAILs (missing field / type mismatch / non-200 / unreachable), else 0.
// Node builtins only (node:fs / node:util / global fetch).

import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { pyRepr, pyJsonDumps } from './_pyfmt.mjs';

// §3.1: every regex lives at module scope so no call site recompiles one per invocation.
// re.S | re.I on the Python side: `.` spans newlines (→ [\s\S]) and the heading match is
// case-insensitive. Non-global, so `.exec()` cannot leak lastIndex between calls.
const CONFORMANCE_BLOCK_RE = /##\s*Conformance spec[\s\S]*?```json\s*([\s\S]*?)```/i;
// Python's Path.read_text() opens in universal-newline mode: \r\n and lone \r both become \n.
const UNIVERSAL_NEWLINE_RE = /\r\n?/g;
// Python's str.rstrip("/") removes EVERY trailing slash, not just one.
const TRAILING_SLASHES_RE = /\/+$/;
// urllib.parse.quote/quote_plus escape these; encodeURIComponent leaves them literal.
const QUOTE_EXTRA_RE = /[!'()*]/g;
const PERCENT_SLASH_RE = /%2F/g;
const PERCENT_SPACE_RE = /%20/g;

// argparse auto-generates its usage block from the parser; parseArgs does not. Spec §4.1 N4: these
// paths are compared by exit code only, and this line is the hand-written close equivalent.
const USAGE =
  'usage: interface_conformance.mjs (--contract C | --spec S) [--url U] [--sample F] [--endpoint P] [--report F] [--auth-signup | --auth-cookie NAME=VALUE]';

// A Map (not an object literal) so a typespec like "constructor" cannot reach Object.prototype.
const TYPE_CHECKS = new Map([
  // Python excludes bool from `number` explicitly; JS has no bool/number overlap to exclude.
  ['number', (v) => typeof v === 'number'],
  ['string', (v) => typeof v === 'string'],
  ['boolean', (v) => typeof v === 'boolean'],
  ['object', (v) => v !== null && typeof v === 'object' && !Array.isArray(v)],
  ['array', (v) => Array.isArray(v)],
  ['null', (v) => v === null],
]);

// --- small Python-semantics shims (local: _pyfmt.mjs owns only output formatting) -----------

/** Python `isinstance(v, dict)` for JSON-parsed values. */
function isDict(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Python `str(v)` for JSON-parsed values — str passes through, everything else reprs. */
function pyStr(v) {
  return typeof v === 'string' ? v : pyRepr(v);
}

/** Python truthiness — empty list/dict/string are falsy in Python; {} and [] are truthy in JS. */
function pyTruthy(v) {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

/** Python `len(v)` for JSON-parsed values (dict keys / list items / str chars). */
function pyLen(v) {
  if (Array.isArray(v) || typeof v === 'string') return v.length;
  if (v !== null && typeof v === 'object') return Object.keys(v).length;
  return 0;
}

/** Python `d.get(k, dflt)` without reaching Object.prototype for a colliding JSON key. */
function pyGet(obj, key, dflt) {
  return isDict(obj) && Object.hasOwn(obj, key) ? obj[key] : dflt;
}

/** Python's Path.read_text(encoding="utf-8"): decode UTF-8 + universal newlines. */
function readText(p) {
  return fs.readFileSync(p, 'utf8').replace(UNIVERSAL_NEWLINE_RE, '\n');
}

/** Python `str(e)` for an exception — the message, no class name. */
function pyErrStr(e) {
  return e && typeof e.message === 'string' ? e.message : String(e);
}

/** urllib.parse.quote(s) — default safe="/". encodeURIComponent leaves !'()* literal and escapes
 *  "/", so both differences have to be undone to land on Python's byte-for-byte output. */
function pyQuote(s) {
  return encodeURIComponent(s)
    .replace(QUOTE_EXTRA_RE, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(PERCENT_SLASH_RE, '/');
}

/** urllib.parse.urlencode(d) — quote_plus (safe="", space → "+") on str(k)/str(v), joined by "&". */
function pyUrlencode(d) {
  const quotePlus = (s) =>
    encodeURIComponent(s)
      .replace(QUOTE_EXTRA_RE, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
      .replace(PERCENT_SPACE_RE, '+');
  return Object.entries(d)
    .map(([k, v]) => `${quotePlus(pyStr(k))}=${quotePlus(pyStr(v))}`)
    .join('&');
}

/** json.dumps(obj) with no indent — Python's default separators are ", " and ": " (JSON.stringify
 *  emits neither space), and ensure_ascii=True escapes every non-ASCII codepoint. Request bodies go
 *  on the wire, so the bytes have to match what urllib would have sent. */
function pyJsonCompact(v) {
  if (Array.isArray(v)) return `[${v.map(pyJsonCompact).join(', ')}]`;
  if (v !== null && typeof v === 'object') {
    // pyJsonDumps() on a bare string gives json.dumps's quoted, ensure_ascii-escaped form.
    return `{${Object.entries(v).map(([k, x]) => `${pyJsonDumps(k)}: ${pyJsonCompact(x)}`).join(', ')}}`;
  }
  return pyJsonDumps(v);
}

// --- the port, function-for-function in source order ----------------------------------------

export function typeOk(value, typespec) {
  for (const t of typespec.split('|')) {
    const check = TYPE_CHECKS.get(t.trim());
    if (check !== undefined && check(value)) return true;
  }
  return false;
}

export class Fail extends Error {}

/** Resolve a dot-path (with name[] array fan-out) and type-check the leaf(s). */
export function checkPath(obj, path, typespec, failures) {
  const optional = typespec.endsWith('?');
  const tspec = optional ? typespec.slice(0, -1) : typespec;
  const segs = path.split('.');
  walk(obj, segs, tspec, optional, path, failures);
}

function walk(node, segs, tspec, optional, full, failures) {
  if (segs.length === 0) {
    if (!typeOk(node, tspec)) {
      // Python's `{node!r:.40}` is format(repr(node), '.40') — the repr, truncated to 40 chars.
      failures.push(`${full}: expected ${tspec}, got ${typename(node)} (${pyRepr(node).slice(0, 40)})`);
    }
    return;
  }
  const seg = segs[0];
  const rest = segs.slice(1);
  const fan = seg.endsWith('[]');
  const key = fan ? seg.slice(0, -2) : seg;
  if (!isDict(node) || !Object.hasOwn(node, key)) {
    if (!optional) failures.push(`${full}: missing field (no '${key}')`);
    return;
  }
  const val = node[key];
  if (fan) {
    if (!Array.isArray(val)) {
      failures.push(`${full}: expected array at '${key}', got ${typename(val)}`);
      return;
    }
    for (const el of val) walk(el, rest, tspec, optional, full, failures); // empty list ⇒ vacuously passes
  } else {
    walk(val, rest, tspec, optional, full, failures);
  }
}

function typename(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return 'array';
  return 'object';
}

export function extractSpecFromContract(text) {
  const m = CONFORMANCE_BLOCK_RE.exec(text);
  if (m === null) throw new Fail("no '## Conformance spec' ```json block found in the contract");
  return JSON.parse(m[1]);
}

/**
 * Bootstrap a throwaway session and return its `name=value` session cookie.
 *
 * PROJECT-LOCAL (convexa): restored after the v1.8.0 kit port dropped it — see the auth block
 * below. Manual Set-Cookie parse rather than a cookie jar, deliberately: a jar honors the
 * cookie's Secure attribute and would refuse to replay it over the local http:// base that
 * every gate run uses.
 */
async function bootstrapSession(base) {
  const tag = randomUUID().replaceAll('-', '').slice(0, 12);
  const body = {
    email: `conformance-${tag}@sweep.invalid`,
    password: `Sweep-${tag}!x9`,
    display_name: 'conformance sweep',
  };
  const resp = await fetch(`${base.replace(TRAILING_SLASHES_RE, '')}/api/auth/signup`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (resp.status !== 200) throw new Fail(`auth bootstrap: signup returned HTTP ${resp.status}`);
  const setCookie = resp.headers.get('set-cookie');
  if (!setCookie || !setCookie.split(';', 1)[0].includes('=')) {
    throw new Fail('auth bootstrap: signup succeeded but no Set-Cookie header was returned');
  }
  const cookie = setCookie.split(';', 1)[0].trim();
  console.log(`  auth: session bootstrapped via /api/auth/signup (${body.email})`);
  return cookie;
}

/** urllib fetch → global fetch. Same URL construction, same 30s timeout, same non-200 → Fail. */
async function fetchEndpoint(base, ep, cookie = null) {
  let epPath = ep.path;
  for (const [k, v] of Object.entries(pyGet(ep, 'path_params', {}))) {
    epPath = epPath.replaceAll(`{${k}}`, pyQuote(pyStr(v)));
  }
  let url = base.replace(TRAILING_SLASHES_RE, '') + epPath;
  if (pyTruthy(pyGet(ep, 'query', undefined))) url += `?${pyUrlencode(ep.query)}`;
  // Optional JSON request body (for POST/PUT endpoints). Absent ⇒ no body (GET semantics
  // unchanged), so this is fully backward-compatible with every existing flat spec.
  let data = null;
  const headers = {};
  if (pyGet(ep, 'body', null) !== null) {
    data = pyJsonCompact(ep.body);
    headers['Content-Type'] = 'application/json';
  }
  // `"auth": true` marks a session-gated endpoint. Without a cookie this must fail LOUD and name
  // the fix — the alternative (requesting anonymously) reports a bare "HTTP 401", which reads as
  // "the endpoint is broken" rather than "the runner cannot authenticate". Endpoints WITHOUT the
  // flag stay anonymous, so the anonymous surface is still verified as anonymous.
  if (pyTruthy(pyGet(ep, 'auth', false))) {
    if (!cookie) {
      throw new Fail(
        "endpoint is auth-gated ('auth': true) but no session cookie is available — " +
          'pass --auth-signup or --auth-cookie'
      );
    }
    headers.Cookie = cookie;
  }
  // urlopen raises HTTPError (a URLError) for >=400 before Python reaches its own status check;
  // fetch resolves instead, so the check below is what turns a 500 into the same FAIL branch.
  // The message text differs ("HTTP 500" vs "HTTP Error 500: …") — spec §4.1 N6 covers exactly that.
  const resp = await fetch(url, {
    method: pyGet(ep, 'method', 'GET'),
    body: data,
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (resp.status !== 200) throw new Fail(`HTTP ${resp.status}`);
  return JSON.parse(await resp.text());
}

export function validateEndpoint(ep, payload) {
  const failures = [];
  for (const [p, tspec] of Object.entries(pyGet(ep, 'required', {}))) {
    checkPath(payload, p, tspec, failures);
  }
  return failures;
}

export async function main(argv) {
  let args;
  try {
    ({ values: args } = parseArgs({
      args: argv.slice(1),
      options: {
        contract: { type: 'string' },
        spec: { type: 'string' },
        url: { type: 'string' },
        sample: { type: 'string' },
        endpoint: { type: 'string' },
        report: { type: 'string' },
        'auth-signup': { type: 'boolean' },
        'auth-cookie': { type: 'string' },
      },
      strict: true,
    }));
  } catch {
    console.error(USAGE);
    return 2;
  }
  // argparse's mutually-exclusive group with required=True: exactly one of --contract / --spec.
  if (Boolean(args.contract) === Boolean(args.spec)) {
    console.error(USAGE);
    return 2;
  }

  let spec;
  try {
    if (args.contract) {
      spec = extractSpecFromContract(readText(args.contract));
    } else {
      spec = JSON.parse(readText(args.spec));
    }
  } catch (e) {
    console.log(`spec error: ${pyErrStr(e)}`);
    return 2;
  }

  const endpoints = pyGet(spec, 'endpoints', []);
  if (!pyTruthy(endpoints)) {
    console.log('spec has no endpoints');
    return 2;
  }

  const cases = [];
  if (args.sample) {
    // `e["path"]` on a path-less endpoint is a KeyError in Python; hasOwn keeps a missing key from
    // silently matching an absent --endpoint (undefined === undefined) here.
    const matched = endpoints.filter((e) => Object.hasOwn(e, 'path') && e.path === args.endpoint);
    const eps = matched.length ? matched : endpoints.slice(0, 1);
    const payload = JSON.parse(readText(args.sample));
    cases.push([eps[0], payload, null]);
  } else if (args.url) {
    let cookie = args['auth-cookie'] ?? null;
    if (cookie === null && args['auth-signup'] && endpoints.some((e) => pyTruthy(pyGet(e, 'auth', false)))) {
      try {
        cookie = await bootstrapSession(args.url);
      } catch (e) {
        console.log(`auth bootstrap error: ${pyErrStr(e)}`);
        return 2;
      }
    }
    for (const ep of endpoints) {
      try {
        cases.push([ep, await fetchEndpoint(args.url, ep, cookie), null]);
      } catch (e) {
        cases.push([ep, null, pyErrStr(e)]);
      }
    }
  } else {
    console.log('provide --url (live) or --sample (offline)');
    return 2;
  }

  let totalFail = 0;
  const results = [];
  console.log(`interface_conformance — ${cases.length} endpoint(s)`);
  for (const [ep, payload, err] of cases) {
    const label = `${pyStr(pyGet(ep, 'method', 'GET'))} ${pyStr(ep.path)}`;
    const entry = {
      method: pyGet(ep, 'method', 'GET'),
      path: ep.path,
      verdict: 'PASS',
      required_checked: pyLen(pyGet(ep, 'required', {})),
      failures: [],
    };
    if (err !== null) {
      console.log(`  FAIL  ${label}: unreachable/error — ${err}`);
      totalFail += 1;
      entry.verdict = 'FAIL';
      entry.required_checked = 0;
      entry.failures = [`unreachable/error — ${err}`];
      results.push(entry);
      continue;
    }
    const failures = validateEndpoint(ep, payload);
    if (failures.length) {
      totalFail += 1;
      console.log(`  FAIL  ${label} — ${failures.length} issue(s):`);
      for (const f of failures) console.log(`          - ${f}`);
      entry.verdict = 'FAIL';
      entry.failures = failures;
    } else {
      const n = pyLen(pyGet(ep, 'required', {}));
      console.log(`  PASS  ${label} — ${n} required field(s) present + well-typed`);
    }
    results.push(entry);
  }
  console.log(`\n  ${totalFail} endpoint failure(s).`);

  if (args.report) {
    const mode = args.sample ? 'sample' : 'live';
    // A passing sample proves the shape at capture time, not that the live backend emits it now.
    // A FAILING sample is definitive either way — the shape is wrong.
    let verdict;
    if (totalFail) {
      verdict = 'FAIL';
    } else if (mode === 'sample') {
      verdict = 'UNVERIFIABLE';
    } else {
      verdict = 'PASS';
    }
    // Key order is part of the artifact: it must match the Python literal exactly.
    const receipt = {
      tool: 'interface_conformance',
      verdict,
      mode,
      source: args.contract || args.spec,
      base_url: mode === 'live' ? args.url : null,
      checked_at: `${new Date().toISOString().slice(0, 19)}Z`,
      summary: {
        pass: results.filter((r) => r.verdict === 'PASS').length,
        fail: totalFail,
        total: results.length,
      },
      endpoints: results,
    };
    try {
      fs.writeFileSync(args.report, `${pyJsonDumps(receipt)}\n`, 'utf8');
    } catch (e) {
      console.log(`  (warning: could not write --report to ${args.report}: ${pyErrStr(e)})`);
    }
  }

  return totalFail ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // `process.exitCode`, NOT `process.exit()`. Calling process.exit() while undici still holds a
  // socket handle from a live-mode fetch aborts the process on Windows with
  // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c" and exit code
  // 0xC0000409 — reproduced deterministically here whenever an endpoint answered non-200 and its
  // body was therefore never read. Setting exitCode lets the loop drain and exits ~80ms later with
  // the right code; every other gate path has no open handles at all, so nothing can hang.
  main(['interface_conformance.mjs', ...process.argv.slice(2)]).then((code) => {
    process.exitCode = code;
  });
}
