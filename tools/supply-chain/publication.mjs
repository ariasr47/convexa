import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitize } from './sanitize.mjs';

export async function publish(report, destination, { root = process.cwd() } = {}) {
  const catalogs = await loadCatalogs(root),
    safe = sanitize(report, catalogs);
  if (!safe.safe) throw new Error(`blocked: ${safe.reason_code}`);
  const outputRoot = path.resolve(root, '.supply-chain', 'out'),
    resolved = path.resolve(destination);
  if (!resolved.startsWith(`${outputRoot}${path.sep}`))
    throw new Error('blocked: publication-destination');
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(safe.value)}\n`, { flag: 'wx' });
  await fs.rename(temporary, resolved);
  return resolved;
}

export function runnerResultLine(checkId, state, artifactName) {
  if (
    !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(checkId) ||
    !['pass', 'pass_with_advisories', 'fail', 'blocked', 'skipped'].includes(state) ||
    !/^[a-z0-9][a-z0-9._-]{0,95}$/.test(artifactName)
  )
    return 'SCA_RESULT blocked sanitizer-output';
  return `SCA_RESULT ${checkId} ${state} ${artifactName}`;
}
export function annotation({ level = 'error', repoPath, title, message }) {
  if (
    !['notice', 'warning', 'error'].includes(level) ||
    !safeRepoPath(repoPath) ||
    typeof title !== 'string' ||
    typeof message !== 'string' ||
    /[\r\n]/.test(title + message)
  )
    return null;
  return `::${level} file=${encode(repoPath)},title=${encode(title)}::${encode(message)}`;
}
async function loadCatalogs(root) {
  const read = async (name) =>
    JSON.parse(await fs.readFile(path.join(root, '.supply-chain', name), 'utf8'));
  return {
    owners: await read('owners.json'),
    actions: await read('actions.json'),
    messages: await read('messages.json'),
  };
}
const encode = (value) =>
  value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');
const safeRepoPath = (value) =>
  typeof value === 'string' &&
  !value.startsWith('/') &&
  !value.includes('\\') &&
  !value.includes('://') &&
  value.split('/').every((x) => x && x !== '.' && x !== '..') &&
  !/[\r\n\0]/.test(value);
