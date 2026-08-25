import { spawnCaptured } from '../lib/process.mjs';
export async function runTrivyConfig({
  executable,
  cwd = process.cwd(),
  runner = spawnCaptured,
} = {}) {
  if (!executable) return blocked('trivy-unavailable');
  return classify(
    await runner(
      executable,
      [
        'config',
        '--format',
        'json',
        '--exit-code',
        '1',
        '--skip-dirs',
        'node_modules',
        '--skip-dirs',
        'target',
        '.',
      ],
      { cwd, timeoutMs: 240000 },
    ),
    'configuration',
    ['Misconfigurations'],
  );
}
export async function runTrivyImage({
  executable,
  digest,
  input,
  cwd = process.cwd(),
  runner = spawnCaptured,
} = {}) {
  if (!executable || !/^sha256:[a-f0-9]{64}$/.test(digest ?? '') || typeof input !== 'string')
    return blocked('trivy-image-unavailable');
  return classify(
    await runner(
      executable,
      [
        'image',
        '--input',
        input,
        '--format',
        'json',
        '--exit-code',
        '1',
        '--scanners',
        'vuln,secret',
        '--pkg-types',
        'os',
      ],
      { cwd, timeoutMs: 300000, maxOutputBytes: 32 * 1024 * 1024 },
    ),
    'api-image',
    ['Vulnerabilities', 'Secrets'],
  );
}
function classify(run, scope, findingFields) {
  if (run.state === 'blocked') return blocked('trivy-unavailable', run.raw_output_sha256);
  let report;
  try {
    report = JSON.parse(run.output);
    if (report?.SchemaVersion !== 2 || !(report.Results === null || Array.isArray(report.Results)))
      throw new TypeError('trivy-report');
  } catch {
    return blocked('trivy-malformed', run.raw_output_sha256);
  }
  const count = (report.Results ?? []).reduce(
    (total, result) =>
      total +
      findingFields.reduce(
        (subtotal, field) => subtotal + (Array.isArray(result?.[field]) ? result[field].length : 0),
        0,
      ),
    0,
  );
  if (run.raw_exit_code === 0 && count === 0)
    return {
      state: 'pass',
      rule_id: `${scope}-clean`,
      completion: 'complete',
      count: 0,
      raw_output_sha256: run.raw_output_sha256,
    };
  if (run.raw_exit_code === 1 && count > 0)
    return {
      state: 'fail',
      rule_id: `${scope}-finding`,
      completion: 'complete',
      count,
      raw_output_sha256: run.raw_output_sha256,
    };
  return blocked('trivy-malformed', run.raw_output_sha256);
}
export function classifyTrivy(result) {
  if (!result || result.unavailable) return blocked('trivy-unavailable');
  return {
    state: result.findings?.length ? 'fail' : 'pass',
    rule_id: result.findings?.length ? 'image-finding' : 'image-clean',
    completion: 'complete',
  };
}
const blocked = (rule_id, raw_output_sha256 = null) => ({
  state: 'blocked',
  rule_id,
  completion: 'unavailable',
  count: 0,
  raw_output_sha256,
});
