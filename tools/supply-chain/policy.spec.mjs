import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import { checkCargoPolicy, runCargoDeny } from './policy/cargo-deny.mjs';
import { validateExceptions } from './policy/exceptions.mjs';
import { compareDependencySnapshots, dependencySnapshot } from './policy/lock-integrity.mjs';
import { combineAudits } from './policy/npm-audit.mjs';
import {
  canonicalLockSha256,
  checkLicenseBaseline,
  detectLicenseFromTarball,
  inspectLicenseInventory,
} from './policy/npm-license.mjs';
import { checkNpmLock } from './policy/npm-lock.mjs';
import { resolveCatalog } from './policy/registry.mjs';
const lock = {
  lockfileVersion: 3,
  packages: {
    'node_modules/x': { resolved: 'https://registry.npmjs.org/x/-/x-1.tgz', integrity: 'sha512-x' },
  },
};
test('npm lock accepts v3', () => assert.equal(checkNpmLock(lock).state, 'pass'));
test('npm lock rejects old version', () =>
  assert.equal(checkNpmLock({ ...lock, lockfileVersion: 2 }).state, 'blocked'));
test('npm lock rejects absent packages', () =>
  assert.equal(checkNpmLock({ lockfileVersion: 3 }).state, 'blocked'));
test('npm lock rejects non registry', () =>
  assert.equal(
    checkNpmLock({ lockfileVersion: 3, packages: { x: { resolved: 'git://bad' } } }).state,
    'fail',
  ));
test('npm lock requires integrity', () =>
  assert.equal(
    checkNpmLock({
      lockfileVersion: 3,
      packages: { x: { resolved: 'https://registry.npmjs.org/x' } },
    }).state,
    'fail',
  ));
const licenseRow = {
  ecosystem: 'npm',
  name: 'x',
  version: '1',
  expression: 'MIT',
  origin_lock_sha256: 'a'.repeat(64),
  obligation: null,
  evidence_kind: 'lock_metadata',
  evidence_sha256: null,
  template_id: null,
};
test('license baseline accepts equal', () =>
  assert.equal(checkLicenseBaseline([licenseRow], [licenseRow]).state, 'pass'));
test('license baseline rejects changed', () =>
  assert.equal(
    checkLicenseBaseline([{ ...licenseRow, expression: 'GPL' }], [licenseRow]).state,
    'fail',
  ));
test('license baseline rejects malformed inventory', () =>
  assert.equal(checkLicenseBaseline(null, []).state, 'blocked'));
test('license baseline rejects malformed baseline', () =>
  assert.equal(checkLicenseBaseline([], null).state, 'blocked'));
test('license lock fingerprint is stable across platform line endings', () => {
  assert.equal(
    canonicalLockSha256(Buffer.from('{\r\n  "lockfileVersion": 3\r\n}\r\n')),
    canonicalLockSha256(Buffer.from('{\n  "lockfileVersion": 3\n}\n')),
  );
  assert.notEqual(
    canonicalLockSha256(Buffer.from('{\n  "lockfileVersion": 3\n}\n')),
    canonicalLockSha256(Buffer.from('{\n  "lockfileVersion": 2\n}\n')),
  );
});
test('canonical integrity-verified MIT license file is detected', async () => {
  const bytes = await npmTar(await fs.readFile('node_modules/union/LICENSE'));
  const result = detectLicenseFromTarball({ tarballBytes: bytes, integrity: sri(bytes) });
  assert.deepEqual(
    { state: result.state, expression: result.expression, template_id: result.template_id },
    { state: 'pass', expression: 'MIT', template_id: 'mit-union-0.5.0' },
  );
});
test('modified or unknown license text fails', async () => {
  const text = await fs.readFile('node_modules/union/LICENSE');
  const bytes = await npmTar(Buffer.concat([text, Buffer.from('modified')]));
  assert.equal(
    detectLicenseFromTarball({ tarballBytes: bytes, integrity: sri(bytes) }).rule_id,
    'license-file-unknown',
  );
});
test('missing license file fails', async () => {
  const bytes = await npmTar(null);
  assert.equal(
    detectLicenseFromTarball({ tarballBytes: bytes, integrity: sri(bytes) }).rule_id,
    'license-file-missing',
  );
});
test('metadata and license-file conflict fails', async () => {
  const bytes = await npmTar(await fs.readFile('node_modules/union/LICENSE'));
  assert.equal(
    detectLicenseFromTarball({
      tarballBytes: bytes,
      integrity: sri(bytes),
      metadataLicense: 'GPL-3.0-only',
    }).rule_id,
    'license-metadata-file-conflict',
  );
});
test('lock integrity mismatch fails before license classification', async () => {
  const bytes = await npmTar(await fs.readFile('node_modules/union/LICENSE'));
  assert.equal(
    detectLicenseFromTarball({
      tarballBytes: bytes,
      integrity: 'sha512-' + Buffer.alloc(64).toString('base64'),
    }).rule_id,
    'license-tarball-integrity',
  );
});
test('current union lock resolves MIT from its actual locked tarball', async () => {
  const lock = JSON.parse(await fs.readFile('package-lock.json'));
  const pkg = lock.packages['node_modules/union'];
  const response = await fetch(pkg.resolved);
  assert.equal(response.ok, true);
  const bytes = Buffer.from(await response.arrayBuffer());
  const result = await inspectLicenseInventory(
    { packages: { 'node_modules/union': pkg } },
    'a'.repeat(64),
    { fetchTarball: async () => bytes },
  );
  assert.equal(result.violations.length, 0);
  assert.equal(result.rows[0].expression, 'MIT');
  assert.equal(
    result.rows[0].evidence_sha256,
    'ce5a6467d5e685e6c6ce90ea94dd5764ce16aa5b0332803c1f0411e6cc682d36',
  );
});
test('cargo accepts a nonempty package graph', () =>
  assert.equal(
    checkCargoPolicy({ packages: [{ name: 'api-rust', version: '0.1.0' }] }).state,
    'pass',
  ));
test('cargo rejects an empty graph', () =>
  assert.equal(checkCargoPolicy({ packages: [] }).state, 'blocked'));
test('cargo rejects malformed', () => assert.equal(checkCargoPolicy(null).state, 'blocked'));
test('cargo rejects missing packages', () => assert.equal(checkCargoPolicy({}).state, 'blocked'));
test('development or production npm advisory makes the combined audit fail', () => {
  assert.equal(
    combineAudits({ state: 'fail', total: 1 }, { state: 'pass', total: 0 }).state,
    'fail',
  );
  assert.equal(
    combineAudits({ state: 'pass', total: 0 }, { state: 'fail', total: 1 }).state,
    'fail',
  );
  assert.equal(
    combineAudits({ state: 'pass', total: 0 }, { state: 'pass', total: 0 }).state,
    'pass',
  );
});
test('Cargo rejects alternate registry, git, absent checksum, wildcard, yanked, and banned crates', () => {
  const base = {
    name: 'x',
    version: '1.0.0',
    source: 'registry+https://github.com/rust-lang/crates.io-index',
    checksum: 'a'.repeat(64),
  };
  assert.equal(
    checkCargoPolicy({ packages: [{ ...base, source: 'registry+https://example.test/index' }] })
      .rule_id,
    'cargo-source',
  );
  assert.equal(
    checkCargoPolicy({ packages: [{ ...base, source: 'git+https://example.test/x' }] }).rule_id,
    'cargo-source',
  );
  assert.equal(
    checkCargoPolicy({ packages: [{ ...base, checksum: null }] }).rule_id,
    'cargo-checksum',
  );
  assert.equal(
    checkCargoPolicy({ packages: [base] }, { manifestTexts: ['x = "*"'] }).rule_id,
    'cargo-wildcard-dependency',
  );
  assert.equal(
    checkCargoPolicy({ packages: [base] }, { yanked: ['x@1.0.0'] }).rule_id,
    'cargo-yanked-crate',
  );
  assert.equal(
    checkCargoPolicy({ packages: [base] }, { deniedCrates: ['x'] }).rule_id,
    'cargo-banned-crate',
  );
});
test('cargo-deny 0.20.2 adapter uses the supported direct-binary CLI and validates its summary', async () => {
  let observed;
  const runner = async (executable, argv, options) => {
    observed = { executable, argv, options };
    return cargoDenyRun(0, cargoDenySummary());
  };
  assert.deepEqual(await runCargoDeny({ executable: '/tools/cargo-deny', cwd: '/repo', runner }), {
    state: 'pass',
    rule_id: 'cargo-policy-pass',
    completion: 'complete',
    count: 0,
    raw_output_sha256: 'a'.repeat(64),
  });
  assert.deepEqual(observed.argv, [
    '-f',
    'json',
    'check',
    'advisories',
    'licenses',
    'sources',
    'bans',
  ]);
  assert.equal(observed.options.outputStream, 'stderr');
  assert.equal(observed.argv.includes('--manifest-path'), false);
  assert.equal(observed.argv.includes('deny'), false);
});
test('cargo-deny policy findings fail while unavailable, invalid and partial results block', async () => {
  const execute = (run) =>
    runCargoDeny({ executable: '/tools/cargo-deny', runner: async () => run });
  assert.equal((await execute(cargoDenyRun(1, cargoDenySummary({ advisories: 1 })))).state, 'fail');
  assert.equal((await execute(cargoDenyRun(4, cargoDenySummary({ licenses: 1 })))).state, 'fail');
  assert.equal((await execute(cargoDenyRun(8, cargoDenySummary({ sources: 1 })))).state, 'fail');
  assert.equal((await execute(cargoDenyRun(2, cargoDenySummary({ bans: 1 })))).state, 'fail');
  for (const run of [
    { ...cargoDenyRun(null, ''), state: 'blocked' },
    cargoDenyRun(2, ''),
    cargoDenyRun(2, '{not-json}'),
    cargoDenyRun(2, JSON.stringify({ type: 'diagnostic', fields: {} })),
    cargoDenyRun(0, cargoDenySummary({ advisories: 1 })),
    cargoDenyRun(1, cargoDenySummary()),
  ])
    assert.equal((await execute(run)).state, 'blocked');
});
test('license obligations require unchanged, current accountability and yield advisory only then', () => {
  const obligation = {
    owner_id: 'security-owner',
    action_code: 'review_license_obligation',
    evidence_ref: 'evidence-1',
    review_at: '2030-01-01T00:00:00Z',
    expires_at: '2030-01-30T00:00:00Z',
  };
  const row = { ...licenseRow, obligation };
  assert.equal(
    checkLicenseBaseline([row], [row], { now: new Date('2029-12-01') }).state,
    'pass_with_advisories',
  );
  assert.equal(checkLicenseBaseline([row], [row], { now: new Date('2031-01-01') }).state, 'fail');
  assert.equal(
    checkLicenseBaseline(
      [{ ...row, obligation: { ...obligation, owner_id: '' } }],
      [{ ...row, obligation: { ...obligation, owner_id: '' } }],
      { now: new Date('2029-01-01') },
    ).state,
    'fail',
  );
});
test('lock snapshots reject nested Cargo lock and scan-time byte mutation', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-locks-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of [
    'package.json',
    'package-lock.json',
    'Cargo.toml',
    'Cargo.lock',
    'apps/api/Cargo.toml',
    'libs/quant-engine/Cargo.toml',
  ]) {
    const absolute = path.join(root, file);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file);
  }
  const before = await dependencySnapshot(root);
  assert.equal(before.state, 'pass');
  await fs.appendFile(path.join(root, 'Cargo.lock'), 'poison');
  assert.equal(
    compareDependencySnapshots(before, await dependencySnapshot(root)).rule_id,
    'dependency-bytes-mutated',
  );
  await fs.writeFile(path.join(root, 'libs/quant-engine/Cargo.lock'), 'nested');
  assert.equal((await dependencySnapshot(root)).rule_id, 'nested-cargo-lock');
});
const exception = (id = 'e1') => ({
  exception_id: id,
  predecessor_id: null,
  finding_id: 'license-notice-x',
  ecosystem: 'license',
  package: 'x',
  version_or_range: '1.0.0',
  dependency_path: ['x@1.0.0'],
  surface: 'npm_licenses',
  rule_id: 'license-notice',
  rationale: 'Temporary review',
  compensating_control: 'Manual notice review',
  owner_id: 'security-owner',
  approver_id: 'security-approver',
  created_at: '2030-01-01T00:00:00Z',
  review_at: '2030-01-10T00:00:00Z',
  expires_at: '2030-01-20T00:00:00Z',
  intended_fixed_version: null,
});
test('exception registry rejects expiry poison, wildcard, duplicate active, missing predecessor, and security rule', () => {
  const options = { now: new Date('2030-01-05') };
  assert.equal(
    validateExceptions({ schema_version: 1, exceptions: [exception()] }, options).state,
    'pass',
  );
  assert.equal(
    validateExceptions(
      { schema_version: 1, exceptions: [{ ...exception(), finding_id: 'x*' }] },
      options,
    ).state,
    'blocked',
  );
  assert.equal(
    validateExceptions({ schema_version: 1, exceptions: [exception('a'), exception('b')] }, options)
      .rule_id,
    'exception-duplicate-active',
  );
  assert.equal(
    validateExceptions(
      { schema_version: 1, exceptions: [{ ...exception(), predecessor_id: 'missing' }] },
      options,
    ).rule_id,
    'exception-predecessor-missing',
  );
  assert.equal(
    validateExceptions(
      { schema_version: 1, exceptions: [exception()] },
      { ...options, securityRuleIds: ['license-notice'] },
    ).rule_id,
    'security-exception-prohibited',
  );
  assert.equal(
    validateExceptions(
      { schema_version: 1, exceptions: [{ ...exception(), expires_at: '2030-02-20T00:00:00Z' }] },
      options,
    ).rule_id,
    'exception-date-window',
  );
});
test('catalog resolves known', () => assert.equal(resolveCatalog({ a: 1 }, 'a'), 1));
test('catalog rejects unknown', () => assert.throws(() => resolveCatalog({}, 'x')));

async function npmTar(licenseBytes) {
  const entries = licenseBytes === null ? [] : [{ name: 'package/LICENSE', data: licenseBytes }];
  const blocks = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, entry.data.length);
    writeOctal(header, 136, 12, 0);
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    blocks.push(header, entry.data, Buffer.alloc((512 - (entry.data.length % 512)) % 512));
  }
  return zlib.gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]), { mtime: 0 });
}
function writeOctal(buffer, offset, length, value) {
  buffer.write(`${value.toString(8).padStart(length - 1, '0')}\0`, offset, length, 'ascii');
}
function sri(bytes) {
  return `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
}
function cargoDenyRun(raw_exit_code, output) {
  return {
    state: raw_exit_code === 0 ? 'pass' : 'fail',
    raw_exit_code,
    output,
    raw_output_sha256: 'a'.repeat(64),
  };
}
function cargoDenySummary(errors = {}) {
  const check = (name) => ({ errors: errors[name] ?? 0, helps: 0, notes: 0, warnings: 0 });
  return JSON.stringify({
    type: 'summary',
    fields: Object.fromEntries(
      ['advisories', 'licenses', 'sources', 'bans'].map((name) => [name, check(name)]),
    ),
  });
}
