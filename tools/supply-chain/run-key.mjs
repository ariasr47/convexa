import { createHash } from 'node:crypto';
import { canonicalSha256 } from './lib/canonical.mjs';
export function subjectSetSha256(ids = []) {
  return canonicalSha256([...new Set(ids)].sort());
}
export const subjectSetHash = subjectSetSha256;
export function runKey(event, revision, path, subjectIdsOrHash = []) {
  const hash = Array.isArray(subjectIdsOrHash)
    ? subjectSetSha256(subjectIdsOrHash)
    : subjectIdsOrHash;
  return createHash('sha256')
    .update(`sca-run-v1\0${event}\0${revision}\0${path}\0${hash}`)
    .digest('hex');
}
export const computeRunKey = runKey;
