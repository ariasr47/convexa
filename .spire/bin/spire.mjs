#!/usr/bin/env node
// Spire bridge shim (shim-mjs), Direct-v4 target 4.2.0, generation gen-344efe06b2d76427.
// Stable launcher for this consumer root: it dispatches every argument straight through to the
// external recovery bootstrap under the home directory, which selects the active generation. It
// carries no selection logic of its own and refuses only when no bootstrap is installed yet (the
// permitted pre-publication refusal); it writes no file on that path.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT_DIGEST = '082ab6972c3798fb3471ad2190fa59ad53f6f506368b4ead2dcd0ff1dea36bc9';
const bootstrap = path.join(os.homedir(), '.spire', 'os', 'recovery', ROOT_DIGEST, 'bootstrap.mjs');

if (!fs.existsSync(bootstrap)) {
  process.stderr.write(`spire bridge shim: no recovery launcher installed at ${bootstrap}\n`);
  process.exitCode = 1;
} else {
  const child = spawnSync(process.execPath, [bootstrap, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  process.exitCode = child.error ? 1 : (child.status ?? 1);
}
