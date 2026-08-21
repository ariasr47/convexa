#!/usr/bin/env node
/**
 * Free the dev ports by killing whatever still LISTENs on them.
 *
 * The "orphaned dev server" gotcha (TECH_DEBT #13): a killed `nx serve` session can leave
 * its children alive — uvicorn's `multiprocessing.spawn` workers outlive their parent and
 * keep :8000, and a detached Vite keeps :4200/:4300. A stale server then poisons the next
 * run two ways: "port already in use" on serve, or (worse) a verification pass that talks
 * to LAST session's code and reports results for the wrong build — three orphan uvicorns
 * once served a redesign render-pass exactly that way (see redesign-stage-0/RENDER_PASS.md).
 *
 * Address families: Vite on this box binds IPv6 (`[::1]`) as the common case. `netstat -ano
 * -p tcp` is IPv4-only on Windows and used to report "all clear" while `[::1]:4200` still
 * answered 200. Sweep both families. Never touch :8001 (owner's pdf-translator).
 *
 * Usage:  node tools/free-ports.mjs [port ...]     (default: 8000 4200 4300)
 *         npm run ports:free
 *
 * Idempotent — nothing listening is a success, not an error. Kills process TREES on
 * Windows (/T) so uvicorn's children die with their parent.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORTS = [8000, 4200, 4300];
const NEVER_TOUCH = new Set([8001]);

const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return ''; // no matches / already dead — fine
  }
};

/** Local-address field (`127.0.0.1:8000` or `[::1]:8000`) → port number, or null. */
export function portFromLocalAddress(addr) {
  const m = String(addr)
    .trim()
    .match(/:(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * Parse `netstat -ano` (no `-p tcp` — that flag drops TCPv6 on Windows).
 * @param {string} out
 * @param {number} port
 * @returns {number[]}
 */
export function pidsFromNetstat(out, port) {
  const pids = [];
  for (const line of out.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    if (!/^\s*TCP/i.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    // Proto LocalAddress ForeignAddress State PID — IPv6 local is `[::1]:4200` (one column).
    if (cols.length < 5) continue;
    const local = cols[1];
    const pid = Number(cols.at(-1));
    if (portFromLocalAddress(local) === port && Number.isFinite(pid) && pid > 0) {
      pids.push(pid);
    }
  }
  return [...new Set(pids)];
}

/** Parse `lsof -t -nP -iTCP:PORT -sTCP:LISTEN` (one PID per line; IPv4 + IPv6). */
export function pidsFromLsof(out) {
  return [
    ...new Set(
      out
        .split(/\s+/)
        .map(Number)
        .filter((pid) => pid > 0),
    ),
  ];
}

/** @returns {number[]} PIDs listening on the port (both address families) */
export function listeners(port) {
  if (process.platform === 'win32') {
    return pidsFromNetstat(run('netstat -ano'), port);
  }
  return pidsFromLsof(run(`lsof -t -nP -iTCP:${port} -sTCP:LISTEN`));
}

function main() {
  const ports = process.argv.slice(2).length
    ? process.argv.slice(2).map(Number).filter(Number.isFinite)
    : DEFAULT_PORTS;

  let killed = 0;
  for (const port of ports) {
    if (NEVER_TOUCH.has(port)) {
      console.log(`:${port}  skipped (reserved)`);
      continue;
    }
    for (const pid of listeners(port)) {
      const cmd = process.platform === 'win32' ? `taskkill /F /T /PID ${pid}` : `kill -9 ${pid}`;
      run(cmd);
      const gone = !listeners(port).includes(pid);
      console.log(`:${port}  pid ${pid}  ${gone ? 'killed' : 'STILL ALIVE (kill failed?)'}`);
      if (gone) killed += 1;
    }
  }
  console.log(
    killed === 0
      ? `Nothing listening on ${ports.map((p) => `:${p}`).join(' ')} — all clear.`
      : `Freed ${killed} listener(s).`,
  );
}

const isMain =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
