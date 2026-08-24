const externalUse = /^([^./][^@\s]+)@([^\s#]+)(?:\s+#\s*(.+))?$/;
const digestImage = /^[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[a-f0-9]{64}$/;

export function auditAutomation({ workflows, dockerfiles, dependabot, pins }) {
  const errors = [];
  for (const [file, text] of Object.entries(workflows)) {
    for (const line of text.split(/\r?\n/)) {
      const uses = line.match(/^\s*-?\s*uses:\s*(.+)$/)?.[1]?.trim();
      if (uses && !uses.startsWith('./')) {
        const match = uses.match(externalUse);
        if (!match || !/^[a-f0-9]{40}$/i.test(match[2])) errors.push(`${file}:mutable-action`);
        else if (
          !match[3] ||
          !/^(?:v?\d+\.\d+\.\d+|reviewed-commit-\d{4}-\d{2}-\d{2})$/.test(match[3].trim())
        )
          errors.push(`${file}:missing-release-comment`);
        else if (!pins?.actions?.[match[1]] || pins.actions[match[1]] !== match[2])
          errors.push(`${file}:unapproved-action-pin`);
      }
      const image = line.match(/^\s*image:\s*([^\s#]+)/)?.[1];
      if (image && !digestImage.test(image)) errors.push(`${file}:mutable-service-image`);
    }
    if (/ubuntu-latest/.test(text)) errors.push(`${file}:floating-runner`);
    if (
      /uses:\s*dtolnay\/rust-toolchain@/.test(text) &&
      !/toolchain:\s*[0-9]+\.[0-9]+\.[0-9]+\s*(?:#.*)?$/m.test(text)
    )
      errors.push(`${file}:moving-rust-toolchain`);
    if (/continue-on-error\s*:\s*true/.test(text)) errors.push(`${file}:continue-on-error`);
    if (/\b(?:trivy|gitleaks|syft|cargo-deny)\b/.test(stripApprovedWrapperLines(text)))
      errors.push(`${file}:direct-scanner`);
    if (/\btee\b|set\s+-x|\bprintenv\b|\benv\s*>/.test(text))
      errors.push(`${file}:raw-output-path`);
    if (/permissions:[\s\S]*?(?:contents|actions|packages|pull-requests):\s*write/.test(text))
      errors.push(`${file}:write-permission`);
    for (const block of text.matchAll(
      /uses:\s*actions\/checkout@[\s\S]*?(?=\n\s*-\s+(?:uses|name|run):|\n\s{0,4}[A-Za-z_-]+:|$)/g,
    ))
      if (!/persist-credentials:\s*false/.test(block[0]))
        errors.push(`${file}:checkout-credentials`);
    if (file.endsWith('supply-chain.yml'))
      for (const block of text.matchAll(
        /uses:\s*actions\/upload-artifact@[\s\S]*?(?=\n\s*-\s+(?:uses|name|run):|\n\s{0,4}[A-Za-z_-]+:|$)/g,
      )) {
        const paths = uploadPaths(block[0]);
        if (
          !paths.length ||
          paths.some(
            (uploadPath) => /[?*\[\]]/.test(uploadPath) || !/[.][A-Za-z0-9]+$/.test(uploadPath),
          )
        )
          errors.push(`${file}:broad-upload`);
      }
  }
  for (const [file, text] of Object.entries(dockerfiles))
    for (const line of text.split(/\r?\n/)) {
      const selector =
        line.match(/^FROM\s+([^\s]+)/i)?.[1] ?? line.match(/^#\s*syntax=([^\s]+)/i)?.[1];
      if (selector && !digestImage.test(selector)) errors.push(`${file}:mutable-image`);
      else if (selector && !pins?.images?.includes(selector))
        errors.push(`${file}:unapproved-image-pin`);
    }
  const supply = workflows['.github/workflows/supply-chain.yml'] ?? '';
  const ci = workflows['.github/workflows/ci.yml'] ?? '';
  if (
    !/push:[\s\S]*branches:\s*\[main\]/.test(supply) ||
    !/schedule:/.test(supply) ||
    !/workflow_dispatch:[\s\S]*options:\s*\[policy, artifacts\]/.test(supply)
  )
    errors.push('supply-chain:event-matrix');
  if (
    !/workflow_call:[\s\S]*contract_event:[\s\S]*contract_revision:[\s\S]*contract_path:/.test(
      supply,
    ) ||
    !/github\.event_name == 'workflow_call' && inputs\.contract_event/.test(supply) ||
    !/needs\.identity\.outputs\.revision/.test(supply)
  )
    errors.push('supply-chain:workflow-call-contract');
  if (!/uses:\s*.\/.github\/workflows\/supply-chain.yml/.test(ci))
    errors.push('ci:missing-pr-supply-chain');
  if (!/contract_event:[\s\S]*contract_revision:[\s\S]*contract_path:\s*policy/.test(ci))
    errors.push('ci:workflow-call-identity');
  if (
    !/aggregate:\s*\n\s*needs:\s*\[identity, policy, capabilities, artifacts\]\s*\n\s*if:\s*always\(\)/.test(
      supply,
    )
  )
    errors.push('supply-chain:aggregate-not-always');
  if (!/retention-days:\s*30/.test(supply) || !/aggregate-receipts\.mjs/.test(supply))
    errors.push('supply-chain:publication-contract');
  if (!/version:\s*2/.test(dependabot) || /auto-merge|pull-requests:\s*write/.test(dependabot))
    errors.push('dependabot:unsafe');
  return { state: errors.length ? 'fail' : 'pass', errors: [...new Set(errors)] };
}

function uploadPaths(block) {
  const lines = block.split(/\r?\n/),
    index = lines.findIndex((line) => /^\s*path:\s*/.test(line));
  if (index < 0) return [];
  const match = lines[index].match(/^(\s*)path:\s*(.*)$/),
    indent = match[1].length,
    value = match[2].trim().replace(/["']/g, '');
  if (value !== '|') return value ? [value] : [];
  const paths = [];
  for (const line of lines.slice(index + 1)) {
    const leading = line.match(/^\s*/)[0].length;
    if (line.trim() && leading <= indent) break;
    if (line.trim()) paths.push(line.trim().replace(/["']/g, ''));
  }
  return paths;
}

function stripApprovedWrapperLines(text) {
  return text
    .split(/\r?\n/)
    .filter(
      (line) =>
        /run:|name:/.test(line) &&
        !/tools\/supply-chain\/(?:acquire-tools|artifacts|policy|capabilities|aggregate-receipts)|supply-chain:/.test(
          line,
        ),
    )
    .join('\n');
}
