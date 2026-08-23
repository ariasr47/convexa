import fs from 'node:fs/promises';
import { sanitize } from './sanitize.mjs';

export function renderSummary(report) {
  if (!report?.aggregate)
    return 'Blocked — supply-chain checks did not produce a trustworthy result.';
  const findings = Array.isArray(report.findings) ? report.findings : [],
    shortSha = report.revision_sha.slice(0, 7);
  const lead =
    {
      pass: `Required supply-chain checks passed for revision ${shortSha}.`,
      pass_with_advisories: `Required supply-chain checks passed with advisories for revision ${shortSha}.`,
      fail: `Supply-chain policy failed for revision ${shortSha}.`,
      blocked: `Supply-chain checks are blocked for revision ${shortSha}. No pass result is available.`,
    }[report.aggregate] ??
    `Supply-chain checks are blocked for revision ${shortSha}. No pass result is available.`;
  const lines = [
    `# ${lead}`,
    '',
    `Revision: \`${report.revision_sha}\`  `,
    `Policy: \`${report.policy_sha256}\`  `,
    `Event/path: \`${report.event}\` / \`${report.path}\``,
    '',
    '## Checks',
    '',
    '| Check | Scope | State | Findings |',
    '|---|---|---:|---:|',
  ];
  for (const check of report.checks ?? [])
    lines.push(
      `| ${check.check_id} | ${(check.scope ?? []).join(', ')} | ${check.state} | ${check.finding_count} |`,
    );
  const actions = new Map();
  for (const finding of findings) {
    const review = finding.expires_at ? `expires ${finding.expires_at}` : 'current';
    const key = `${finding.owner_id}|${finding.action_code}|${review}`;
    actions.set(key, (actions.get(key) ?? 0) + 1);
  }
  if (actions.size) {
    lines.push('', '## Required actions', '');
    for (const [key, count] of actions) lines.push(`- ${key.replaceAll('|', ' / ')} — ${count}`);
  }
  const groups = groupFindings(findings),
    shown = groups.slice(0, 20);
  if (shown.length) {
    lines.push('', '## Finding preview', '');
    for (const group of shown) {
      lines.push(`- ${group.key}: ${group.items.length} finding(s)`);
      for (const item of group.items.slice(0, 3))
        lines.push(`  - ${item.finding_id}: ${item.subject}`);
    }
  }
  if (groups.length > shown.length)
    lines.push(
      '',
      `Showing ${shown.length} of ${groups.length} finding groups. Open the sanitized report for complete evidence.`,
    );
  if ((report.subjects ?? []).length) {
    lines.push('', '## Dependency inventory associations', '');
    for (const subject of report.subjects)
      lines.push(
        `- CycloneDX lock-derived dependency inventory generated and schema-validated for dependencies associated with GitHub-built ${subject.subject_id} at revision ${report.revision_sha}, subject digest ${subject.digest}. Evidence: \`${subject.dependency_inventory_artifact_id}\`.`,
      );
    lines.push(
      '',
      'Syft did not observe or catalog the subject bytes; the digest is an association key.',
      '',
      'This evidence does not identify bytes independently rebuilt or deployed by Railway or Cloudflare.',
    );
  }
  lines.push(
    '',
    '## Provenance',
    '',
    `Node ${report.toolchain?.node}; npm ${report.toolchain?.npm}; Rust ${report.toolchain?.rust}.`,
    `Tools: ${(report.checks ?? []).map((x) => `${x.tool}@${x.tool_version}`).join(', ')}.`,
  );
  if (report.redaction?.count > 0)
    lines.push('', 'Some diagnostic text was redacted before publication.');
  return `${lines.join('\n')}\n`;
}
function groupFindings(findings) {
  const ordered = [...findings].sort(
    (a, b) =>
      (a.classification === 'blocker' ? 0 : 1) - (b.classification === 'blocker' ? 0 : 1) ||
      `${a.check_id}:${a.rule_id}:${a.finding_id}`.localeCompare(
        `${b.check_id}:${b.rule_id}:${b.finding_id}`,
      ),
  );
  const groups = new Map();
  for (const finding of ordered) {
    const key = `${finding.check_id}/${finding.rule_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(finding);
  }
  return [...groups].map(([key, items]) => ({ key, items }));
}

export async function renderSummaryCli(argv) {
  const reportIndex = argv.indexOf('--report'),
    outputIndex = argv.indexOf('--output');
  if (reportIndex < 0 || outputIndex < 0 || !argv[reportIndex + 1] || !argv[outputIndex + 1])
    return 2;
  let markdown = 'Blocked — supply-chain checks did not produce a trustworthy result.\n';
  let exitCode = 2;
  try {
    const parsed = JSON.parse(await fs.readFile(argv[reportIndex + 1], 'utf8'));
    const result = sanitize(parsed);
    if (result.safe) {
      markdown = renderSummary(result.value);
      exitCode =
        result.value.aggregate === 'fail' ? 1 : result.value.aggregate === 'blocked' ? 2 : 0;
    }
  } catch {}
  await fs.writeFile(argv[outputIndex + 1], markdown);
  return exitCode;
}
if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href)
  process.exitCode = await renderSummaryCli(process.argv.slice(2));
