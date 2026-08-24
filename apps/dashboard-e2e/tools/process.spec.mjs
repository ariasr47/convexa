import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { npmInvocation } from './lib/process.mjs';
const source = readFileSync(new URL('./lib/process.mjs', import.meta.url), 'utf8');

test('Windows npm invocation uses node plus an absolute npm CLI and shell false', () => {
  assert.deepEqual(
    npmInvocation({
      platform: 'win32',
      execPath: 'C:/Node/node.exe',
      npmCliPath: 'C:/Node/node_modules/npm/bin/npm-cli.js',
      args: ['exec', '--', 'playwright', 'test'],
    }),
    {
      command: 'C:/Node/node.exe',
      args: ['C:/Node/node_modules/npm/bin/npm-cli.js', 'exec', '--', 'playwright', 'test'],
      shell: false,
    },
  );
  assert.match(source, /process\.execPath/);
});

test('Windows npm invocation fails closed for missing or relative npm CLI paths', () => {
  assert.throws(() =>
    npmInvocation({ platform: 'win32', execPath: 'C:/Node/node.exe', npmCliPath: null }),
  );
  assert.throws(() =>
    npmInvocation({
      platform: 'win32',
      execPath: 'C:/Node/node.exe',
      npmCliPath: 'node_modules/npm/bin/npm-cli.js',
    }),
  );
  assert.match(source, /path\.isAbsolute\(npmCliPath\)/);
});

test('non-Windows keeps canonical npm command invocation shell-free', () => {
  assert.deepEqual(
    npmInvocation({
      platform: 'linux',
      execPath: '/usr/bin/node',
      npmCliPath: null,
      args: ['--version'],
    }),
    { command: 'npm', args: ['--version'], shell: false },
  );
});
