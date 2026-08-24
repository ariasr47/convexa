import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHILDREN, validateChildCatalog } from './lib/aggregate.mjs';
import { npmInvocation } from './lib/process.mjs';
import { ROOT } from './lib/repository-root.mjs';

export function spawnQualityChildren({
  children = CHILDREN,
  spawnFn = spawn,
  platform = process.platform,
  execPath = process.execPath,
  npmCliPath = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  cwd = ROOT,
  env = process.env,
  runId = crypto.randomUUID(),
  source = '0'.repeat(40),
} = {}) {
  validateChildCatalog(children);
  const childEnv = { ...env };
  // Give each child Nx invocation its own tracker root; inheriting the aggregate root triggers
  // recursive-invocation detection when sibling webServer tasks start.
  delete childEnv.NX_INVOCATION_ROOT_PID;
  const invocation = npmInvocation({
    platform,
    execPath,
    npmCliPath,
    args: ['exec', '--', 'nx', 'run'],
  });
  return children.map(
    ({ target, port }) =>
      new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve({ target, port, invocation_count: 1, ...result });
        };
        let child;
        try {
          child = spawnFn(invocation.command, [...invocation.args, target, '--skip-nx-cache'], {
            cwd,
            shell: false,
            stdio: 'inherit',
            env: {
              ...childEnv,
              NX_DAEMON: 'false',
              BROWSER_QUALITY_RUN_ID: runId,
              BROWSER_QUALITY_SOURCE_REVISION: source,
              BROWSER_QUALITY_PORT: String(port),
            },
          });
        } catch (error) {
          finish({ exit_code: 1, status: 'incomplete', error: error.message });
          return;
        }
        child.once('error', (error) =>
          finish({ exit_code: 1, status: 'incomplete', error: error.message }),
        );
        child.once('close', (code) =>
          finish({ exit_code: code ?? 1, status: code === 0 ? 'pass' : 'fail', error: null }),
        );
      }),
  );
}

export async function runQuality({ spawnOptions = {} } = {}) {
  const runId = process.env.BROWSER_QUALITY_RUN_ID ?? crypto.randomUUID();
  const source =
    process.env.BROWSER_QUALITY_SOURCE_REVISION ??
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const children = spawnQualityChildren({ ...spawnOptions, runId, source });
  const results = await Promise.allSettled(children);
  const failed = results.some(
    (result) => result.status !== 'fulfilled' || result.value.exit_code !== 0,
  );
  const output = path.join(ROOT, 'apps/dashboard-e2e/test-output/playwright/quality');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, 'summary.json'),
    JSON.stringify(
      {
        schema_version: 1,
        gate: 'quality',
        run_id: runId,
        source_revision: source,
        status: failed ? 'fail' : 'pass',
        children: results.map((r) =>
          r.status === 'fulfilled'
            ? { ...r.value, execution_key: `${runId}:${r.value.target}` }
            : {
                target: 'unknown',
                execution_key: `${runId}:unknown`,
                invocation_count: 1,
                exit_code: 1,
                status: 'incomplete',
                error: String(r.reason),
              },
        ),
      },
      null,
      2,
    ) + '\n',
  );
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) {
    console.error('browser quality aggregate accepts no arguments');
    process.exit(2);
  }
  const exitCode = await runQuality();
  process.exitCode = exitCode;
}
