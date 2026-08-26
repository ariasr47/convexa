import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyApiBuildFailure, createArtifactReceipt, runArtifacts } from './artifacts.mjs';
import {
  inspectOciArchive,
  ociLayoutReference,
  rawSha256Digest,
  subjectDigest,
  withExtractedOciArchive,
} from './oci.mjs';
import { runKey } from './run-key.mjs';
import { archiveDirectory, validateTar } from './tar.mjs';

test('dashboard archive is byte-deterministic and validates after safe extraction', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-dist-'));
  try {
    await fs.mkdir(path.join(root, 'assets'));
    await fs.writeFile(path.join(root, 'index.html'), 'ok');
    await fs.writeFile(path.join(root, 'assets', 'app.js'), 'js');
    const a = await archiveDirectory(root),
      b = await archiveDirectory(root);
    assert.deepEqual(a.bytes, b.bytes);
    const result = validateTar(a.bytes);
    assert.equal(result.state, 'pass');
    assert.equal(result.file_count, 2);
    assert.equal(result.archive_sha256, a.digest);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('archive builder rejects symlinks and empty archives', async () => {
  const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-empty-'));
  try {
    await assert.rejects(() => archiveDirectory(empty), /archive-empty/);
  } finally {
    await fs.rm(empty, { recursive: true, force: true });
  }
});

test('TAR validator blocks traversal, links, duplicate members, mutable time and checksum corruption', () => {
  assert.equal(
    validateTar(ustar([{ name: 'dist/../escape', type: '0', data: 'x' }])).state,
    'blocked',
  );
  assert.equal(validateTar(ustar([{ name: 'dist/link', type: '2', data: '' }])).state, 'blocked');
  assert.equal(
    validateTar(
      ustar([
        { name: 'dist/a', type: '0', data: 'x' },
        { name: 'dist/a', type: '0', data: 'x' },
      ]),
    ).state,
    'blocked',
  );
  const timed = ustar([{ name: 'dist/a', type: '0', data: 'x', mtime: 1 }]);
  assert.equal(validateTar(timed).rule_id, 'tar-header-identity');
  const corrupt = ustar([{ name: 'dist/a', type: '0', data: 'x' }]);
  corrupt[0] ^= 1;
  assert.equal(validateTar(corrupt).rule_id, 'tar-checksum');
});

test('OCI subject identity comes from verified manifest descriptor, not TAR bytes', async () => {
  const config = Buffer.from('{"architecture":"amd64","os":"linux"}'),
    layer = Buffer.from('layer');
  const configDigest = rawSha256Digest(config),
    layerDigest = rawSha256Digest(layer);
  const manifest = Buffer.from(
    JSON.stringify({
      schemaVersion: 2,
      config: { digest: configDigest, size: config.length },
      layers: [{ digest: layerDigest, size: layer.length }],
    }),
  );
  const manifestDigest = rawSha256Digest(manifest);
  const archive = ustar(
    [
      { name: 'blobs/sha256/' + configDigest.slice(7), type: '0', data: config },
      { name: 'blobs/sha256/' + layerDigest.slice(7), type: '0', data: layer },
      { name: 'blobs/sha256/' + manifestDigest.slice(7), type: '0', data: manifest },
      {
        name: 'index.json',
        type: '0',
        data: JSON.stringify({
          schemaVersion: 2,
          manifests: [{ digest: manifestDigest, size: manifest.length }],
        }),
      },
      { name: 'oci-layout', type: '0', data: JSON.stringify({ imageLayoutVersion: '1.0.0' }) },
    ],
    '',
  );
  assert.equal(subjectDigest(archive), manifestDigest);
  assert.notEqual(subjectDigest(archive), rawSha256Digest(archive));
  assert.equal(inspectOciArchive(archive).archive_sha256, rawSha256Digest(archive).slice(7));
  let extracted;
  await withExtractedOciArchive(archive, async (layout) => {
    extracted = layout;
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(layout, 'oci-layout'), 'utf8')), {
      imageLayoutVersion: '1.0.0',
    });
    assert.deepEqual(
      await fs.readFile(path.join(layout, 'blobs', 'sha256', layerDigest.slice(7))),
      layer,
    );
  });
  await assert.rejects(() => fs.stat(extracted), { code: 'ENOENT' });
});

test('OCI validator blocks descriptor hash, size and child-blob mutations', () => {
  const blob = Buffer.from('{}'),
    digest = rawSha256Digest(blob),
    manifest = Buffer.from(
      JSON.stringify({ schemaVersion: 2, config: { digest, size: 999 }, layers: [] }),
    ),
    manifestDigest = rawSha256Digest(manifest);
  const archive = ustar(
    [
      { name: `blobs/sha256/${digest.slice(7)}`, type: '0', data: blob },
      { name: `blobs/sha256/${manifestDigest.slice(7)}`, type: '0', data: manifest },
      {
        name: 'index.json',
        type: '0',
        data: JSON.stringify({
          schemaVersion: 2,
          manifests: [{ digest: manifestDigest, size: manifest.length }],
        }),
      },
      { name: 'oci-layout', type: '0', data: '{"imageLayoutVersion":"1.0.0"}' },
    ],
    '',
  );
  assert.throws(() => inspectOciArchive(archive), /oci-child-integrity/);
});

test('OCI layout scan references bind the verified manifest digest', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  assert.equal(ociLayoutReference('/tmp/layout', digest), `/tmp/layout@${digest}`);
  assert.throws(() => ociLayoutReference('/tmp/layout', 'sha256:not-a-digest'));
});

test('artifact command blocks locally and rejects a stale run key before execution', async () => {
  const local = await runArtifacts({
    event: 'default_branch',
    pathName: 'artifacts',
    runKey: 'a'.repeat(64),
  });
  assert.equal(local.aggregate, 'blocked');
  assert.equal(local.rule_id, 'artifact-input');
});

test('artifact receipt maps the computed policy hash into the serialized field', () => {
  const policySha256 = 'b'.repeat(64);
  const receipt = createArtifactReceipt({
    subjectId: 'api-production-image',
    kind: 'oci_image',
    digest: `sha256:${'a'.repeat(64)}`,
    revision: 'c'.repeat(40),
    runKey: 'd'.repeat(64),
    buildRunId: '123',
    version: '1.51.0',
    inventorySha256: 'e'.repeat(64),
    policySha256,
    componentCount: 2,
    componentSetSha256: 'f'.repeat(64),
    requiredSeedCount: 1,
    requiredSeedsPresent: true,
    sourceInputsSha256: '1'.repeat(64),
    byteScan: '2'.repeat(64),
    archiveValidation: null,
    validation: 'pass',
  });
  assert.equal(receipt.policy_sha256, policySha256);
});

test('API build failures collapse raw Docker output into closed safe categories', () => {
  assert.equal(
    classifyApiBuildFailure('error: failed to run custom build command for `ring v0.17.14`'),
    'api-build-custom-ring',
  );
  assert.equal(classifyApiBuildFailure('/bin/sh: 1: readelf: not found'), 'api-build-tool-readelf');
  assert.equal(
    classifyApiBuildFailure("cp: cannot stat '/etc/ssl/certs/ca-certificates.crt'"),
    'api-build-ca-certificates',
  );
  assert.equal(
    classifyApiBuildFailure('error: linking with `cc` failed: exit status: 1'),
    'api-build-link',
  );
  assert.equal(classifyApiBuildFailure('token=do-not-echo'), 'api-build-failed');
});

test('unexpected artifact failures identify a safe stage without exposing the raw error', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sca-internal-stage-'));
  try {
    const toolBytes = Buffer.from('repository tool stub\n');
    await fs.mkdir(path.join(root, '.supply-chain'));
    await fs.writeFile(path.join(root, 'tool-stub'), toolBytes);
    await fs.writeFile(
      path.join(root, '.supply-chain', 'tools.json'),
      JSON.stringify({
        schema_version: 1,
        tools: ['syft', 'trivy', ...Array.from({ length: 8 }, (_, index) => `stub-${index}`)].map(
          (tool_id) => ({
            tool_id,
            version: 'test',
            source_kind: 'repository',
            source_locator: 'tool-stub',
            sha256: crypto.createHash('sha256').update(toolBytes).digest('hex'),
            platform: 'all',
            capabilities: ['test'],
          }),
        ),
      }),
    );
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Convexa Test'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@convexa.invalid'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: root });
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    const report = await runArtifacts({
      event: 'workflow_dispatch',
      pathName: 'artifacts',
      runKey: runKey('workflow_dispatch', revision, 'artifacts', [
        'api-production-image',
        'dashboard-distribution-archive',
      ]),
      root,
      environment: { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID_SAFE: '1' },
      platform: 'linux',
      arch: 'x64',
      runner: async () => {
        throw new Error('sensitive runner detail');
      },
    });
    assert.equal(report.rule_id, 'artifact-internal-docker-probe');
    assert.doesNotMatch(JSON.stringify(report), /sensitive runner detail/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

function ustar(entries, requiredPrefix = 'dist/') {
  const blocks = [];
  for (const entry of [...entries].sort((a, b) =>
    Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)),
  )) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? '');
    const h = Buffer.alloc(512);
    h.write(entry.name, 0, 100, 'utf8');
    octal(h, 100, 8, entry.mode ?? (entry.type === '5' ? 0o755 : 0o644));
    octal(h, 108, 8, 0);
    octal(h, 116, 8, 0);
    octal(h, 124, 12, data.length);
    octal(h, 136, 12, entry.mtime ?? 0);
    h.fill(32, 148, 156);
    h[156] = (entry.type ?? '0').charCodeAt(0);
    h.write('ustar\0', 257, 6, 'ascii');
    h.write('00', 263, 2, 'ascii');
    let sum = 0;
    for (const byte of h) sum += byte;
    h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}
function octal(buffer, offset, length, value) {
  buffer.write(`${value.toString(8).padStart(length - 1, '0')}\0`, offset, length, 'ascii');
}
