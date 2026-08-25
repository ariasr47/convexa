import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { npmInvocation } from './lib/process.mjs';

const target = process.argv[2];
const configs = {
  chromium: 'playwright.config.ts',
  compatibility: 'playwright.compat.config.ts',
  accessibility: 'playwright.a11y.config.ts',
  visual: 'playwright.visual.config.ts',
};
if (!configs[target] || process.argv.length !== 3) {
  console.error('Unknown browser quality gate.');
  process.exit(2);
}
const root = path.resolve(import.meta.dirname, '..');
const cwd = path.resolve(root, '..', '..');
const npmCliPath = path.join(
  path.dirname(process.execPath),
  'node_modules',
  'npm',
  'bin',
  'npm-cli.js',
);
if (process.platform === 'win32' && !fs.existsSync(npmCliPath)) {
  console.error(`[BLOCKED] browser prerequisites — npm CLI not found: ${npmCliPath}`);
  process.exit(1);
}
const invocation = npmInvocation({
  npmCliPath,
  args: ['exec', '--', 'playwright', 'test', '--config', path.join(root, configs[target])],
});
const artifactRoot = path.join(cwd, 'apps/dashboard-e2e/test-output/playwright', target);
fs.rmSync(artifactRoot, { recursive: true, force: true });
if (process.env.BROWSER_QUALITY_PREBUILD_STATUS === 'fail') {
  console.error('[BLOCKED] browser quality dashboard prebuild failed');
  process.exit(1);
}
const revisionResult = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd,
  encoding: 'utf8',
  shell: false,
});
const sourceRevision =
  process.env.BROWSER_QUALITY_SOURCE_REVISION ??
  (revisionResult.status === 0 ? revisionResult.stdout.trim() : '0'.repeat(40));
const child = spawn(invocation.command, invocation.args, {
  cwd,
  stdio: 'inherit',
  shell: invocation.shell,
  env: {
    ...process.env,
    PLAYWRIGHT_UPDATE_SNAPSHOTS: 'none',
    BROWSER_QUALITY_RUN_ID:
      process.env.BROWSER_QUALITY_RUN_ID ??
      `local-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    BROWSER_QUALITY_SOURCE_REVISION: sourceRevision,
  },
});
child.on('error', (error) => {
  console.error(`[BLOCKED] browser prerequisites — ${error.message}`);
  process.exitCode = 1;
});
child.on('close', (code) => {
  process.exitCode = code ?? 1;
});
