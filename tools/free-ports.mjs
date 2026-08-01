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
 * Usage:  node tools/free-ports.mjs [port ...]     (default: 8000 4200 4300)
 *         npm run ports:free
 *
 * Idempotent — nothing listening is a success, not an error. Kills process TREES on
 * Windows (/T) so uvicorn's children die with their parent.
 */
import { execSync } from 'node:child_process';

const DEFAULT_PORTS = [8000, 4200, 4300];
const ports = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number).filter(Number.isFinite)
  : DEFAULT_PORTS;

const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return ''; // no matches / already dead — fine
  }
};

/** @returns {number[]} PIDs listening on the port */
function listeners(port) {
  if (process.platform === 'win32') {
    const out = run(`netstat -ano -p tcp`);
    return [
      ...new Set(
        out
          .split(/\r?\n/)
          .filter((l) => l.includes(`:${port} `) && /LISTENING/i.test(l))
          .map((l) => Number(l.trim().split(/\s+/).at(-1)))
          .filter((pid) => Number.isFinite(pid) && pid > 0)
      ),
    ];
  }
  const out = run(`lsof -ti tcp:${port} -sTCP:LISTEN`);
  return [...new Set(out.split(/\s+/).map(Number).filter((pid) => pid > 0))];
}

let killed = 0;
for (const port of ports) {
  for (const pid of listeners(port)) {
    const cmd =
      process.platform === 'win32' ? `taskkill /F /T /PID ${pid}` : `kill -9 ${pid}`;
    run(cmd);
    const gone = !listeners(port).includes(pid);
    console.log(`:${port}  pid ${pid}  ${gone ? 'killed' : 'STILL ALIVE (kill failed?)'}`);
    if (gone) killed += 1;
  }
}
console.log(
  killed === 0 ? `Nothing listening on ${ports.map((p) => `:${p}`).join(' ')} — all clear.`
              : `Freed ${killed} listener(s).`
);
