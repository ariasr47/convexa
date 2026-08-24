import path from 'node:path';
import { spawnCaptured } from '../lib/process.mjs';
function npmCommand() {
  if (process.platform !== 'win32') return { exe: 'npm', argv: [] };
  return {
    exe: process.execPath,
    argv: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')],
  };
}
export async function runNpmAudit({
  production = false,
  cwd = process.cwd(),
  registry = null,
} = {}) {
  const n = npmCommand();
  const argv = [...n.argv, 'audit', ...(production ? ['--omit=dev'] : []), '--json'];
  if (registry) argv.push('--registry', registry);
  const run = await spawnCaptured(n.exe, argv, { cwd, timeoutMs: 180000 });
  if (run.state === 'blocked') return blocked('npm-audit-unavailable', run.raw_output_sha256);
  let report;
  try {
    report = JSON.parse(run.output);
  } catch {
    return blocked('npm-audit-invalid-json', run.raw_output_sha256);
  }
  if (
    report?.error ||
    !report?.metadata?.vulnerabilities ||
    typeof report.metadata.vulnerabilities.total !== 'number'
  )
    return blocked('npm-audit-untrustworthy', run.raw_output_sha256);
  const total = report.metadata.vulnerabilities.total;
  return {
    state: total ? 'fail' : 'pass',
    rule_id: total ? 'npm-advisory' : 'npm-clean',
    completion: 'complete',
    total,
    raw_output_sha256: run.raw_output_sha256,
    advisory_data_revision: report.auditReportVersion
      ? `npm-audit-v${report.auditReportVersion}`
      : null,
  };
}
const blocked = (rule_id, raw_output_sha256) => ({
  state: 'blocked',
  rule_id,
  completion: 'unavailable',
  total: 0,
  raw_output_sha256,
  advisory_data_revision: null,
});
export function combineAudits(full, production) {
  if (full?.state === 'blocked' || production?.state === 'blocked')
    return {
      state: 'blocked',
      completion: 'unavailable',
      rule_id: 'npm-audit-unavailable',
      count: 0,
    };
  const count = full?.total ?? 0;
  return {
    state: count > 0 || (production?.total ?? 0) > 0 ? 'fail' : 'pass',
    completion: 'complete',
    rule_id: count > 0 || (production?.total ?? 0) > 0 ? 'npm-advisory' : 'npm-clean',
    count: Math.max(count, production?.total ?? 0),
  };
}
