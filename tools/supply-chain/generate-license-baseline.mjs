import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { inventoryFromLock } from './policy/npm-license.mjs';

const root = process.cwd();
const npmBytes = await fs.readFile(`${root}/package-lock.json`),
  cargoBytes = await fs.readFile(`${root}/Cargo.lock`);
const npmRows = await inventoryFromLock(JSON.parse(npmBytes), sha(npmBytes));
const result = spawnSync(
  'cargo',
  [
    'metadata',
    '--locked',
    '--format-version',
    '1',
    '--features',
    'postgres',
    '--manifest-path',
    'apps/api/Cargo.toml',
    '--filter-platform',
    'x86_64-unknown-linux-gnu',
  ],
  { cwd: root, encoding: 'utf8', shell: false, maxBuffer: 32 * 1024 * 1024 },
);
if (result.status !== 0) throw new Error('cargo-metadata-unavailable');
const metadata = JSON.parse(result.stdout),
  cargoHash = sha(cargoBytes);
const cargoRows = metadata.packages.map((pkg) => ({
  ecosystem: 'cargo',
  name: pkg.name,
  version: pkg.version,
  expression: normalize(pkg.license),
  origin_lock_sha256: cargoHash,
  obligation: null,
  evidence_kind: 'cargo_metadata',
  evidence_sha256: null,
  template_id: null,
}));
const ordered = [...npmRows, ...cargoRows].sort((a, b) =>
  `${a.ecosystem}:${a.name}@${a.version}`.localeCompare(`${b.ecosystem}:${b.name}@${b.version}`),
);
const rows = [];
for (const row of ordered) {
  const prior = rows.at(-1),
    key = `${row.ecosystem}:${row.name}@${row.version}`;
  if (prior && `${prior.ecosystem}:${prior.name}@${prior.version}` === key) {
    if (JSON.stringify(prior) !== JSON.stringify(row))
      throw new Error(`conflicting-license-identity:${key}`);
  } else rows.push(row);
}
const document = {
  schema_version: 1,
  basis: 'current committed npm/Cargo lock graphs; continuity only, not legal approval',
  licenses: rows,
};
await fs.writeFile(
  `${root}/.supply-chain/license-baseline.json`,
  `${JSON.stringify(document, null, 2)}\n`,
);
function sha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function normalize(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('cargo-license-missing');
  return value
    .replaceAll('Apache-2.0/MIT', 'Apache-2.0 OR MIT')
    .replaceAll('MIT/Apache-2.0', 'MIT OR Apache-2.0')
    .replace(/\s+/g, ' ')
    .trim();
}
