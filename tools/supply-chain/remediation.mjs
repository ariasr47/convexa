import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { spawnCaptured } from './lib/process.mjs';
export const EXPECTED_OVERRIDES = {
  nx: { 'brace-expansion': '5.0.9' },
  postcss: { nanoid: '3.3.18' },
};
export async function validateRemediation(root = process.cwd()) {
  const pkg = JSON.parse(await fs.readFile(`${root}/package.json`));
  if (pkg.devDependencies?.nx !== '23.1.1') return { state: 'fail', rule_id: 'direct-nx-version' };
  if (JSON.stringify(pkg.overrides) !== JSON.stringify(EXPECTED_OVERRIDES))
    return { state: 'fail', rule_id: 'exact-two-overrides' };
  const lock = await fs.readFile(`${root}/package-lock.json`, 'utf8');
  if (!lock.includes('brace-expansion-5.0.9.tgz') || !lock.includes('nanoid-3.3.18.tgz'))
    return { state: 'fail', rule_id: 'resolved-versions' };
  let evidence;
  try {
    evidence = JSON.parse(
      await fs.readFile(`${root}/.supply-chain/remediation-experiments.json`, 'utf8'),
    );
  } catch {
    return { state: 'blocked', rule_id: 'remediation-evidence-missing' };
  }
  const expectedIds = ['nx-brace-expansion', 'postcss-nanoid'];
  if (
    evidence.schema_version !== 1 ||
    evidence.status !== 'candidate_evidence_pending' ||
    evidence.required_check_set_sha256 !==
      '90377d547ae25c3895cb57fa599308e965bef617a5a11642ee26e762409c22f0' ||
    evidence.after_package_lock_sha256 !==
      crypto.createHash('sha256').update(Buffer.from(lock)).digest('hex') ||
    !Array.isArray(evidence.experiments) ||
    evidence.experiments.length !== 2 ||
    evidence.experiments
      .map((item) => item.experiment_id)
      .sort()
      .some((id, index) => id !== expectedIds[index]) ||
    evidence.experiments.some(
      (item) =>
        !Array.isArray(item.before_path) ||
        !Array.isArray(item.after_path) ||
        item.before_path.length < 2 ||
        item.after_path.length < 2 ||
        typeof item.constraint !== 'string',
    )
  )
    return { state: 'blocked', rule_id: 'remediation-evidence-invalid' };
  return {
    state: 'blocked',
    rule_id: 'remediation-hosted-evidence-pending',
    graph_state: 'pass',
  };
}
export async function audit(root = process.cwd(), production = false) {
  return spawnCaptured(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['audit', ...(production ? ['--omit=dev'] : []), '--json'],
    { cwd: root },
  );
}
if (import.meta.url.endsWith(process.argv[1]?.replaceAll('\\', '/')))
  console.log(JSON.stringify(await validateRemediation()));
