import fs from 'node:fs/promises';
import path from 'node:path';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]{1,512}$/;
export function safeId(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new TypeError('invalid id');
  return value;
}
export function safeDigest(value) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new TypeError('invalid digest');
  return value;
}
export function safeText(value) {
  if (typeof value !== 'string' || !SAFE_TEXT.test(value)) throw new TypeError('invalid text');
  return value;
}
export async function resolveRepoPath(root, value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\'))
    throw new TypeError('invalid repo path');
  const absoluteRoot = await fs.realpath(root);
  const candidate = path.resolve(absoluteRoot, value);
  if (candidate !== absoluteRoot && !candidate.startsWith(`${absoluteRoot}${path.sep}`))
    throw new TypeError('path escape');
  const parent = await fs.realpath(path.dirname(candidate));
  if (parent !== absoluteRoot && !parent.startsWith(`${absoluteRoot}${path.sep}`))
    throw new TypeError('symlink escape');
  return path.relative(absoluteRoot, candidate).replaceAll(path.sep, '/');
}
