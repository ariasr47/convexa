import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseTar } from './tar.mjs';

export function rawSha256Digest(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('subject-bytes');
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

export function inspectOciArchive(bytes) {
  const entries = parseTar(bytes, { requiredPrefix: '', strict: false });
  const files = new Map(entries.filter((e) => e.type === 'file').map((e) => [e.name, e.data]));
  const layout = parseJson(files.get('oci-layout'), 'oci-layout');
  if (layout.imageLayoutVersion !== '1.0.0') throw new TypeError('oci-layout-version');
  const index = parseJson(files.get('index.json'), 'index');
  if (index.schemaVersion !== 2 || !Array.isArray(index.manifests) || index.manifests.length !== 1)
    throw new TypeError('oci-index-manifest');
  const descriptor = index.manifests[0],
    digest = descriptor?.digest;
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new TypeError('oci-subject-digest');
  const blob = files.get(`blobs/sha256/${digest.slice(7)}`);
  if (!blob) throw new TypeError('oci-manifest-blob');
  if (rawSha256Digest(blob) !== digest || descriptor.size !== blob.length)
    throw new TypeError('oci-manifest-integrity');
  const manifest = parseJson(blob, 'manifest');
  if (manifest.schemaVersion !== 2) throw new TypeError('oci-manifest-schema');
  for (const child of [manifest.config, ...(manifest.layers ?? [])]) {
    if (!child || !/^sha256:[0-9a-f]{64}$/.test(child.digest))
      throw new TypeError('oci-child-descriptor');
    const childBlob = files.get(`blobs/sha256/${child.digest.slice(7)}`);
    if (
      !childBlob ||
      rawSha256Digest(childBlob) !== child.digest ||
      child.size !== childBlob.length
    )
      throw new TypeError('oci-child-integrity');
  }
  return {
    subject_digest: digest,
    manifest_size: blob.length,
    archive_sha256: rawSha256Digest(bytes).slice(7),
  };
}

export function subjectDigest(bytes) {
  return inspectOciArchive(bytes).subject_digest;
}

export async function withExtractedOciArchive(bytes, operation) {
  if (typeof operation !== 'function') throw new TypeError('oci-operation');
  inspectOciArchive(bytes);
  const entries = parseTar(bytes, { requiredPrefix: '', strict: false });
  const layout = await fs.mkdtemp(path.join(os.tmpdir(), 'convexa-oci-layout-'));
  try {
    for (const entry of entries) {
      const destination = path.resolve(layout, ...entry.name.split('/').filter(Boolean));
      if (!destination.startsWith(`${path.resolve(layout)}${path.sep}`))
        throw new TypeError('oci-extraction-path');
      if (entry.type === 'directory') await fs.mkdir(destination, { recursive: true });
      else {
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, entry.data, { flag: 'wx' });
      }
    }
    return await operation(layout);
  } finally {
    await fs.rm(layout, { recursive: true, force: true });
  }
}
function parseJson(bytes, label) {
  if (!bytes) throw new TypeError(`oci-${label}-missing`);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new TypeError(`oci-${label}-json`);
  }
}
