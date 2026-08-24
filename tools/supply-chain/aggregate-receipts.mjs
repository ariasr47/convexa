import fs from 'node:fs/promises';
import path from 'node:path';

import { validateCapabilityReceiptSet } from './capabilities.mjs';

const argv = process.argv.slice(2);
const value = (name) => {
  const i = argv.indexOf(name);
  return i < 0 ? null : argv[i + 1];
};
const directory = value('--dir'),
  revision = value('--revision'),
  event = value('--event'),
  runKey = value('--run-key'),
  expectedPath = value('--path');
let aggregate = 'blocked',
  reason_code = 'aggregate-input';
try {
  if (
    !directory ||
    !/^[a-f0-9]{40}$/.test(revision ?? '') ||
    !/^[a-f0-9]{64}$/.test(runKey ?? '') ||
    !['pull_request', 'default_branch', 'schedule', 'workflow_dispatch'].includes(event) ||
    !['policy', 'artifacts'].includes(expectedPath)
  )
    throw new Error('invalid invocation');
  const policy = await readOne(directory, 'policy-report.json');
  const capability = await readOne(directory, 'capability-receipts.json');
  const identityOk =
    policy.revision_sha === revision &&
    policy.event === event &&
    policy.path === expectedPath &&
    policy.run_key === runKey;
  const capabilityOk = validateCapabilityReceiptSet(capability.receipts).valid;
  let artifactOk = true;
  if (expectedPath === 'artifacts') {
    const artifact = await readOne(directory, 'artifact-report.json');
    artifactOk =
      artifact.revision_sha === revision &&
      artifact.event === event &&
      artifact.path === 'artifacts' &&
      artifact.run_key === runKey &&
      artifact.complete === true &&
      ['pass', 'pass_with_advisories'].includes(artifact.aggregate);
  }
  if (!identityOk) {
    reason_code = 'stale-or-cross-run-policy';
  } else if (!capabilityOk) {
    reason_code = 'capability-stop';
  } else if (!artifactOk) {
    reason_code = 'artifact-evidence-blocked';
  } else {
    aggregate = policy.aggregate;
    reason_code =
      aggregate === 'pass'
        ? 'all-required-evidence-pass'
        : aggregate === 'pass_with_advisories'
          ? 'license-advisory'
          : 'policy-result';
  }
  const report = {
    schema_version: 1,
    receipt_kind: 'supply_chain_aggregate',
    revision_sha: revision,
    event,
    path: expectedPath,
    run_key: runKey,
    complete: ['pass', 'pass_with_advisories', 'fail'].includes(aggregate),
    aggregate,
    reason_code,
    children: {
      policy_sha256: policy.policy_sha256,
      capability_receipt_count: capability.receipts?.length ?? 0,
      artifact_required: expectedPath === 'artifacts',
    },
  };
  await fs.writeFile(path.join(directory, 'aggregate-report.json'), JSON.stringify(report));
} catch {
  aggregate = 'blocked';
  reason_code = 'missing-or-malformed-child';
  if (directory)
    await fs
      .writeFile(
        path.join(directory, 'aggregate-report.json'),
        JSON.stringify({
          schema_version: 1,
          receipt_kind: 'supply_chain_aggregate',
          revision_sha: revision ?? '0'.repeat(40),
          event: event ?? 'unknown',
          path: expectedPath ?? 'unknown',
          run_key: runKey ?? '',
          complete: false,
          aggregate,
          reason_code,
          children: {
            policy_sha256: '0'.repeat(64),
            capability_receipt_count: 0,
            artifact_required: expectedPath === 'artifacts',
          },
        }),
      )
      .catch(() => {});
}
process.stdout.write(JSON.stringify({ aggregate, reason_code }));
process.exitCode = aggregate === 'blocked' ? 2 : aggregate === 'fail' ? 1 : 0;

async function readOne(root, name) {
  const matches = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === name) matches.push(full);
    }
  }
  await walk(root);
  if (matches.length !== 1) throw new Error('missing or duplicate child');
  return JSON.parse(await fs.readFile(matches[0], 'utf8'));
}
