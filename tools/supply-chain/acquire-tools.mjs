import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { spawnCaptured } from './lib/process.mjs';

const binaryNames = Object.freeze({
  'cargo-deny': 'cargo-deny',
  gitleaks: 'gitleaks',
  trivy: 'trivy',
  syft: 'syft',
});
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function externalExecutablePath(base, record) {
  if (record.tool_id === 'cargo-deny') {
    return path.join(
      base,
      `cargo-deny-${record.version}-x86_64-unknown-linux-musl`,
      binaryNames[record.tool_id],
    );
  }
  return path.join(base, binaryNames[record.tool_id]);
}

export async function loadToolManifest(root = process.cwd()) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, '.supply-chain', 'tools.json'), 'utf8'),
  );
  if (
    manifest?.schema_version !== 1 ||
    !Array.isArray(manifest.tools) ||
    manifest.tools.length !== 10
  )
    throw new TypeError('tool manifest must contain exactly ten records');
  const ids = new Set();
  for (const record of manifest.tools) {
    validateRecord(record);
    if (ids.has(record.tool_id)) throw new TypeError(`duplicate tool: ${record.tool_id}`);
    ids.add(record.tool_id);
  }
  return manifest;
}

export async function verifyOrAcquireTools({ root = process.cwd(), allowDownload = true } = {}) {
  const manifest = await loadToolManifest(root);
  const resolved = new Map();
  const errors = [];
  for (const record of manifest.tools) {
    try {
      resolved.set(record.tool_id, await verifyOrAcquire(record, { root, allowDownload }));
    } catch (error) {
      errors.push({ tool_id: record.tool_id, reason_code: safeReason(error) });
    }
  }
  return { manifest, resolved, errors, complete: errors.length === 0 };
}

async function verifyOrAcquire(record, { root, allowDownload }) {
  if (record.source_kind === 'repository') {
    const file = path.join(root, ...record.source_locator.split('/'));
    const bytes = await fs.readFile(file);
    if (sha256(bytes) !== record.sha256) throw new Error('repository checksum mismatch');
    return file;
  }
  if (record.source_kind === 'bundled_with_node') {
    if (process.versions.node.split('.').slice(0, 2).join('.') !== '24.19')
      throw new Error('candidate node not active');
    const npm =
      process.platform === 'win32'
        ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
        : path.join(
            path.dirname(process.execPath),
            '..',
            'lib',
            'node_modules',
            'npm',
            'bin',
            'npm-cli.js',
          );
    const run = await spawnCaptured(process.execPath, [npm, '--version']);
    if (run.raw_exit_code !== 0 || run.output.trim() !== record.version)
      throw new Error('bundled npm version mismatch');
    return npm;
  }
  if (process.platform !== 'linux' || process.arch !== 'x64' || record.platform !== 'linux-x64')
    throw new Error('unsupported policy-tool platform');
  const base = path.join(root, '.supply-chain', 'out', 'tools', record.tool_id, record.version);
  const executable = externalExecutablePath(base, record);
  try {
    await fs.access(executable);
    const version = await spawnCaptured(executable, ['--version']);
    if (version.raw_exit_code !== 0 || !version.output.includes(record.version))
      throw new Error('installed tool version mismatch');
    return executable;
  } catch {
    if (!allowDownload) throw new Error('tool archive not acquired');
  }
  const response = await fetch(record.source_locator, { redirect: 'follow' });
  if (!response.ok) throw new Error('tool download unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== record.sha256) throw new Error('tool archive checksum mismatch');
  await fs.mkdir(base, { recursive: true });
  const archive = path.join(base, 'archive.tar.gz');
  await fs.writeFile(archive, bytes, { flag: 'wx' }).catch(async (error) => {
    if (error.code !== 'EEXIST') throw error;
  });
  const extracted = await spawnCaptured('tar', ['-xzf', archive, '-C', base], { timeoutMs: 60000 });
  if (extracted.raw_exit_code !== 0) throw new Error('tool archive extraction failed');
  await fs.rm(archive, { force: true });
  const version = await spawnCaptured(executable, ['--version']);
  if (version.raw_exit_code !== 0 || !version.output.includes(record.version))
    throw new Error('acquired tool version mismatch');
  return executable;
}

function validateRecord(record) {
  const allowed = new Set([
    'tool_id',
    'version',
    'source_kind',
    'source_locator',
    'sha256',
    'platform',
    'capabilities',
  ]);
  if (!record || typeof record !== 'object' || Object.keys(record).some((k) => !allowed.has(k)))
    throw new TypeError('invalid tool record');
  if (
    !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(record.tool_id) ||
    !/^[a-f0-9]{64}$/.test(record.sha256) ||
    !Array.isArray(record.capabilities) ||
    !record.capabilities.length
  )
    throw new TypeError('invalid tool identity');
  if (!['external_download', 'bundled_with_node', 'repository'].includes(record.source_kind))
    throw new TypeError('invalid source kind');
  if (record.source_kind === 'external_download') {
    const u = new URL(record.source_locator);
    if (u.protocol !== 'https:' || u.username || u.password || u.search)
      throw new TypeError('unsafe tool source');
  }
}
const safeReason = (error) =>
  String(error?.message ?? 'tool unavailable')
    .replace(/[^a-z0-9 -]/gi, '')
    .slice(0, 96)
    .toLowerCase();

if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  const result = await verifyOrAcquireTools();
  process.stdout.write(
    JSON.stringify({
      schema_version: 1,
      complete: result.complete,
      tools: [...result.resolved.keys()],
      errors: result.errors,
    }),
  );
  process.exitCode = result.complete ? 0 : 2;
}
