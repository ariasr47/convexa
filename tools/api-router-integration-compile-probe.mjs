import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = resolve(import.meta.dirname, '..');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const fail = (m) => { throw new Error(m); };
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: false }); if (r.error || r.status !== 0) fail(`${cmd} failed`); return r; };
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function main() {
  const out = arg('--out') ?? '.spire/clusters/tech/contracts/openapi-router-dependency-replacement/router-integration-compile-probe-receipt.json';
  const result = run('cargo', ['test', '-p', 'api-rust', '--test', 'api_contract_router', 'router_integration_compile_probe_emits_execution_receipt', '--', '--nocapture']);
  const lines = [...`${result.stdout}\n${result.stderr}`.matchAll(/ROUTER_INTEGRATION_COMPILE_PROBE (\{[^\r\n]+\})/g)];
  if (lines.length !== 1) fail('missing or duplicate compile probe marker');
  const facts = JSON.parse(lines[0][1]);
  if (facts.verdict !== 'PASS' || facts.registration_count !== 52 || facts.pairing?.observed_unique_pair_count !== 52) fail('invalid compile probe facts');
  const baseline = JSON.parse(readFileSync(join(ROOT, 'apps/api/openapi/router-integration-prechange-baseline.json')));
  const receipt = { ...facts, source_revision: run('git', ['rev-parse', 'HEAD']).stdout.trim(), tool_sha256: sha256(readFileSync(new URL('./api-router-integration-compile-probe.mjs', import.meta.url))), operation_set_sha256: baseline.evidence.response_conversion.id_set_sha256, toolchain: { rustc_vv_sha256: sha256(run('rustc', ['-Vv']).stdout), cargo_version: run('cargo', ['-V']).stdout.trim() }, command: 'cargo test -p api-rust --test api_contract_router -- --nocapture' };
  const target = resolve(ROOT, out); mkdirSync(dirname(target), { recursive: true }); const temp = `${target}.tmp-${process.pid}`; writeFileSync(temp, `${JSON.stringify(receipt, null, 2)}\n`); renameSync(temp, target);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
export { main };
