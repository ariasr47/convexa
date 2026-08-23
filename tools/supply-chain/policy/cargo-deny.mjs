import { spawnCaptured } from '../lib/process.mjs';
export async function runCargoDeny({
  executable,
  cwd = process.cwd(),
  offline = false,
  runner = spawnCaptured,
} = {}) {
  if (!executable) return blocked('cargo-deny-unavailable');
  const argv = ['-f', 'json'];
  if (offline) argv.push('--disable-fetch');
  argv.push('check', 'advisories', 'licenses', 'sources', 'bans');
  const run = await runner(executable, argv, {
    cwd,
    timeoutMs: 180000,
    outputStream: 'stderr',
  });
  if (run.state === 'blocked') return blocked('cargo-deny-unavailable', run.raw_output_sha256);
  const parsed = parseSummary(run.output);
  if (!parsed || parsed.exitCode !== run.raw_exit_code)
    return blocked('cargo-deny-invalid-invocation-or-config', run.raw_output_sha256);
  return {
    state: parsed.count === 0 ? 'pass' : 'fail',
    rule_id: parsed.count === 0 ? 'cargo-policy-pass' : 'cargo-policy-finding',
    completion: 'complete',
    count: parsed.count,
    raw_output_sha256: run.raw_output_sha256,
  };
}

function parseSummary(output) {
  if (typeof output !== 'string' || !output.trim()) return null;
  let records;
  try {
    records = output
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
  } catch {
    return null;
  }
  const summaries = records.filter((record) => record?.type === 'summary');
  if (summaries.length !== 1 || records.at(-1) !== summaries[0]) return null;
  const fields = summaries[0].fields;
  const names = ['advisories', 'licenses', 'sources', 'bans'];
  if (
    !fields ||
    Object.keys(fields).sort().join(',') !== [...names].sort().join(',') ||
    names.some(
      (name) =>
        !Number.isInteger(fields[name]?.errors) ||
        fields[name].errors < 0 ||
        !['helps', 'notes', 'warnings'].every(
          (key) => Number.isInteger(fields[name]?.[key]) && fields[name][key] >= 0,
        ),
    )
  )
    return null;
  const bits = { advisories: 1, bans: 2, licenses: 4, sources: 8 };
  return {
    count: names.reduce((sum, name) => sum + fields[name].errors, 0),
    exitCode: names.reduce((code, name) => code | (fields[name].errors > 0 ? bits[name] : 0), 0),
  };
}
export function checkCargoPolicy(
  metadata,
  { manifestTexts = [], deniedCrates = [], yanked = [] } = {},
) {
  if (!metadata || !Array.isArray(metadata.packages) || !metadata.packages.length)
    return { state: 'blocked', rule_id: 'cargo-input', completion: 'malformed' };
  if (manifestTexts.some((text) => /(?:^|\n)\s*[A-Za-z0-9_-]+\s*=\s*["']\*["']/m.test(text)))
    return fail('cargo-wildcard-dependency');
  for (const pkg of metadata.packages) {
    if (!pkg?.name || !pkg.version)
      return { state: 'blocked', rule_id: 'cargo-input', completion: 'malformed' };
    if (deniedCrates.includes(pkg.name)) return fail('cargo-banned-crate');
    if (yanked.includes(`${pkg.name}@${pkg.version}`) || pkg.yanked === true)
      return fail('cargo-yanked-crate');
    if (pkg.source === null || pkg.source === undefined) continue;
    if (
      pkg.source !== 'registry+https://github.com/rust-lang/crates.io-index' &&
      pkg.source !== 'sparse+https://index.crates.io/'
    )
      return fail('cargo-source');
    if (typeof pkg.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(pkg.checksum))
      return fail('cargo-checksum');
  }
  return { state: 'pass', rule_id: 'cargo-metadata-pass', completion: 'complete' };
}
const fail = (rule_id) => ({ state: 'fail', rule_id, completion: 'complete' });
const blocked = (rule_id, raw_output_sha256 = null) => ({
  state: 'blocked',
  rule_id,
  completion: 'unavailable',
  count: 0,
  raw_output_sha256,
});
