import { spawnCaptured } from '../lib/process.mjs';
export async function runGitleaks({
  executable,
  cwd = process.cwd(),
  logOptions = null,
  requireLogOptions = false,
  runner = spawnCaptured,
} = {}) {
  if (!executable) return blocked('gitleaks-unavailable');
  if (requireLogOptions && !validLogOptions(logOptions))
    return blocked('gitleaks-range-unavailable');
  if (logOptions !== null && !validLogOptions(logOptions)) return blocked('gitleaks-range-invalid');
  const argv = ['git', '--no-banner', '--redact', '--report-format', 'json', '--report-path', '-'];
  if (logOptions) argv.push('--log-opts', logOptions);
  const run = await runner(executable, argv, { cwd, timeoutMs: 180000 });
  if (run.state === 'blocked') return blocked('gitleaks-unavailable', run.raw_output_sha256);
  let findings;
  try {
    findings = JSON.parse(run.output);
    if (!Array.isArray(findings)) throw new TypeError('gitleaks-report');
  } catch {
    return blocked('gitleaks-malformed', run.raw_output_sha256);
  }
  if (run.raw_exit_code === 0 && findings.length === 0)
    return {
      state: 'pass',
      rule_id: 'secret-clean',
      completion: 'complete',
      count: 0,
      raw_output_sha256: run.raw_output_sha256,
    };
  if (run.raw_exit_code === 1 && findings.length > 0)
    return {
      state: 'fail',
      rule_id: 'secret-found',
      completion: 'complete',
      count: findings.length,
      raw_output_sha256: run.raw_output_sha256,
    };
  return blocked('gitleaks-malformed', run.raw_output_sha256);
}
const validLogOptions = (value) =>
  typeof value === 'string' &&
  (/^[a-f0-9]{40}\.\.[a-f0-9]{40}$/.test(value) || /^[a-f0-9]{40}\^!$/.test(value));
export function classifyGitleaks(result) {
  if (!result || result.unavailable) return blocked('gitleaks-unavailable');
  return {
    state: result.findings?.length ? 'fail' : 'pass',
    rule_id: result.findings?.length ? 'secret-found' : 'secret-clean',
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
