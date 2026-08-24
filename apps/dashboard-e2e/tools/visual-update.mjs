import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomicWriteJson, repositoryPath, sha256File } from './lib/fs-safe.mjs';
import { loadManifest, manifestPath } from './lib/manifest.mjs';
import { npmInvocation } from './lib/process.mjs';
import { ROOT } from './lib/repository-root.mjs';
import { validateAuthorization } from './lib/visual-review.mjs';

export { ROOT };

function treeHashes(dir) {
  if (!fs.existsSync(dir)) return new Map();
  const out = new Map();
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else out.set(path.relative(dir, file).replaceAll(path.sep, '/'), sha256File(file));
    }
  };
  walk(dir);
  return out;
}
function treeBytes(dir) {
  const bytes = new Map();
  for (const [relative] of treeHashes(dir))
    bytes.set(relative, fs.readFileSync(path.join(dir, relative)));
  return bytes;
}
function restoreTree(dir, before) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [relative] of treeHashes(dir))
    if (!before.has(relative)) fs.rmSync(path.join(dir, relative));
  for (const [relative, bytes] of before) {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
}
const sameTree = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const candidateId = (auth, manifestBytes, candidates) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        authorization_id: auth.authorization_id,
        manifest_sha256: crypto.createHash('sha256').update(manifestBytes).digest('hex'),
        candidates,
      }),
    )
    .digest('hex')
    .slice(0, 32);
const pngPath = (root, platform, scenario) =>
  path.join(
    root,
    'apps',
    'dashboard-e2e',
    'src',
    'quality',
    'snapshots',
    platform,
    'chromium',
    `${scenario.id}.png`,
  );
function assertSourceScope(root, authorizationPath, revision) {
  if (!fs.existsSync(path.join(root, '.git'))) return;
  const result = spawnSync('git', ['diff', '--name-only', revision, '--'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) throw new Error('source revision cannot be inspected');
  const changed = result.stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (changed.some((file) => file !== authorizationPath))
    throw new Error(
      'authorization is stale: source diff is broader than the authorization receipt',
    );
}

export function runCandidateUpdate({ authorizationPath, spawn = spawnSync, root = ROOT } = {}) {
  if (
    typeof authorizationPath !== 'string' ||
    path.isAbsolute(authorizationPath) ||
    authorizationPath.includes('\\') ||
    !authorizationPath.startsWith('apps/dashboard-e2e/visual-review/authorizations/')
  )
    throw new Error('authorization must be a repository-relative authorizations path');
  const absoluteAuth = repositoryPath(root, authorizationPath);
  if (!fs.existsSync(absoluteAuth)) throw new Error('Authorization receipt is missing.');
  const auth = JSON.parse(fs.readFileSync(absoluteAuth, 'utf8'));
  const manifest = loadManifest();
  validateAuthorization(auth, manifest, Date.now(), root);
  assertSourceScope(root, authorizationPath, auth.source_revision);
  const authBefore = treeHashes(path.join(root, 'apps/dashboard-e2e/visual-review/authorizations'));
  const acceptanceBefore = treeHashes(
    path.join(root, 'apps/dashboard-e2e/visual-review/acceptances'),
  );
  const platformRoot = path.join(
    root,
    'apps/dashboard-e2e/src/quality/snapshots',
    auth.platform,
    'chromium',
  );
  const before = treeHashes(platformRoot);
  const beforeBytes = treeBytes(platformRoot);
  const selected = manifest.visual.scenarios.map((scenario) => scenario.id);
  const command = npmInvocation({
    platform: process.platform,
    execPath: process.execPath,
    npmCliPath: path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    args: [
      'exec',
      '--',
      'playwright',
      'test',
      '--config',
      'apps/dashboard-e2e/playwright.visual.config.ts',
      '--project',
      'chromium',
      '--update-snapshots',
    ],
  });
  try {
    const result = spawn(command.command, command.args, {
      cwd: root,
      shell: false,
      stdio: 'inherit',
      env: {
        ...process.env,
        BROWSER_QUALITY_AUTHORIZED_UPDATE: '1',
        BROWSER_QUALITY_VISUAL_SELECTION: selected.join(','),
      },
    });
    if (result.status !== 0)
      throw new Error(`candidate generation failed (${result.status ?? 'spawn'})`);
    const after = treeHashes(platformRoot);
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
      (key) => before.get(key) !== after.get(key),
    );
    const expected = selected.map((id) => `${id}.png`).sort();
    if (
      changed.length !== expected.length ||
      changed.slice().sort().join('|') !== expected.join('|')
    )
      throw new Error('candidate PNG write set mismatch');
    if (
      !sameTree(
        authBefore,
        treeHashes(path.join(root, 'apps/dashboard-e2e/visual-review/authorizations')),
      ) ||
      !sameTree(
        acceptanceBefore,
        treeHashes(path.join(root, 'apps/dashboard-e2e/visual-review/acceptances')),
      )
    )
      throw new Error('human receipt tree mutated');
    const candidates = manifest.visual.scenarios.map((scenario) => ({
      scenario_id: scenario.id,
      path: `apps/dashboard-e2e/src/quality/snapshots/${auth.platform}/chromium/${scenario.id}.png`,
      sha256: sha256File(pngPath(root, auth.platform, scenario)),
    }));
    const manifestBytes = fs.readFileSync(manifestPath);
    const id = candidateId(auth, manifestBytes, candidates);
    const output = path.join(root, 'apps/dashboard-e2e/visual-review/candidate-sets', `${id}.json`);
    if (fs.existsSync(output))
      throw new Error('authorization has already generated a candidate set');
    const receipt = {
      schema_version: 1,
      candidate_set_id: id,
      authorization_id: auth.authorization_id,
      state: 'candidates_written',
      generated_by: { actor_id: 'visual-update', command: 'npm run browser:visual:update' },
      source_revision: auth.source_revision,
      platform: auth.platform,
      manifest_sha256: crypto.createHash('sha256').update(manifestBytes).digest('hex'),
      generated_at: new Date().toISOString(),
      candidates,
    };
    atomicWriteJson(output, receipt);
    console.log(`[candidate-written] ${id} — generated candidates; not approved`);
    return receipt;
  } catch (error) {
    restoreTree(platformRoot, beforeBytes);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--authorization') {
    console.error('Candidate update requires exactly one --authorization path.');
    process.exit(2);
  }
  try {
    runCandidateUpdate({ authorizationPath: args[1] });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
