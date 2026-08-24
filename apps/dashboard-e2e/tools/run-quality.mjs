import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CHILDREN, validateChildCatalog } from './lib/aggregate.mjs';
import { ROOT } from './lib/repository-root.mjs';

if (process.argv.length !== 2) {
  console.error('browser quality aggregate accepts no arguments');
  process.exit(2);
}
validateChildCatalog();
const targets = CHILDREN.map(({ target }) => target);
const runId = process.env.BROWSER_QUALITY_RUN_ID ?? crypto.randomUUID();
const source =
  process.env.BROWSER_QUALITY_SOURCE_REVISION ??
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const cwd = ROOT;
const children = targets.map(
  (target, index) =>
    new Promise((resolve) => {
      const child = spawn(command, ['nx', 'run', target, '--skip-nx-cache'], {
        cwd,
        shell: false,
        stdio: 'inherit',
        env: {
          ...process.env,
          NX_DAEMON: 'false',
          BROWSER_QUALITY_RUN_ID: runId,
          BROWSER_QUALITY_SOURCE_REVISION: source,
          BROWSER_QUALITY_PORT: String(4210 + index),
        },
      });
      child.once('error', (error) => resolve({ target, exit_code: 1, error: error.message }));
      child.once('close', (code) => resolve({ target, exit_code: code ?? 1 }));
    }),
);
const results = await Promise.allSettled(children);
const failed = results.some(
  (result) => result.status !== 'fulfilled' || result.value.exit_code !== 0,
);
const output = path.join(cwd, 'apps/dashboard-e2e/test-output/playwright/quality');
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
          ? { ...r.value, execution_key: `${runId}:${r.value.target}`, invocation_count: 1 }
          : { status: 'rejected' },
      ),
    },
    null,
    2,
  ) + '\n',
);
process.exitCode = failed ? 1 : 0;
