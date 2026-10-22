import { canonicalSha256, sha256 } from './lib/canonical.mjs';
export function subjectSetSha256(ids = []) {
  return canonicalSha256([...new Set(ids)].sort());
}
export const subjectSetHash = subjectSetSha256;
export function runKey(event, revision, path, subjectIdsOrHash = []) {
  const hash = Array.isArray(subjectIdsOrHash)
    ? subjectSetSha256(subjectIdsOrHash)
    : subjectIdsOrHash;
  return sha256(`sca-run-v1\0${event}\0${revision}\0${path}\0${hash}`);
}
export const computeRunKey = runKey;
