import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { npmInvocation } from './lib/process.mjs';

function runPlaywright(args, extraEnv) {
  const invocation = npmInvocation({
    platform: process.platform,
    execPath: process.execPath,
    npmCliPath: path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    args: ['exec', '--', 'playwright', 'test'],
  });
  return spawnSync(invocation.command, [...invocation.args, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    timeout: 120_000,
  });
}

test('real compatibility poison fails one engine and retains trace evidence', () => {
  const result = runPlaywright(
    [
      '--config',
      'apps/dashboard-e2e/playwright.compat.config.ts',
      '--project=webkit',
      '--grep',
      'ticker-stream-loss',
    ],
    { BROWSER_QUALITY_POISON_COMPAT: '1' },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /intentional compatibility poison: webkit · ticker-stream-loss/);
  assert.match(output, /trace\.zip/);
  assert.match(output, /test-failed-1\.png/);
});

test('real malformed Scanner fixture event fails readiness with retained browser evidence', () => {
  const result = runPlaywright(
    [
      '--config',
      'apps/dashboard-e2e/playwright.a11y.config.ts',
      '--project=chromium',
      '--grep',
      'A11Y-7',
    ],
    { BROWSER_QUALITY_MALFORMED_SCANNER: '1' },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /malformed Scanner SSE payload: empty prices envelope/);
  assert.match(output, /trace\.zip/);
  assert.match(output, /test-failed-1\.png/);
});

test('real visual drift fails compare-only without updating the baseline', () => {
  const result = runPlaywright(
    [
      '--config',
      'apps/dashboard-e2e/playwright.visual.config.ts',
      '--project=chromium',
      '--grep',
      'landing',
    ],
    { BROWSER_QUALITY_VISUAL_DRIFT: '1' },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(
    output,
    /\[FAIL\] visual — landing: the approved baseline differs\. Review expected, actual, and diff images\. Open: apps\/dashboard-e2e\/test-output\/playwright\/visual\/summary\.json/,
  );
  assert.doesNotMatch(output, /\[FAIL\] visual — \d+ failed/);
  assert.match(output, /diff\.png|Screenshot comparison failed/);
  assert.match(output, /actual\.png|expected\.png/);
});
