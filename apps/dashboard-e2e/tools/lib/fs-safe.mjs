import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function repositoryPath(root, candidate) {
  if (
    typeof candidate !== 'string' ||
    candidate.includes('\\') ||
    path.posix.isAbsolute(candidate) ||
    candidate.split('/').includes('..')
  )
    throw new Error('unsafe repository path');
  const abs = path.resolve(root, candidate);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`))
    throw new Error('path escapes repository');
  return abs;
}
export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
export function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(tmp, file);
}
