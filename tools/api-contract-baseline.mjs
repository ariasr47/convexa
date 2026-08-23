import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const ROUTER = 'apps/api/src/routes/mod.rs';
const TOOL = 'tools/api-contract-baseline.mjs';
const CONTRACT = '.spire/clusters/tech/contracts/api-contract-generation/INTERFACE_CONTRACT.md';
const PARSER = 'rust-axum-route-registration-v1';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const text = (bytes) => bytes.toString('utf8');
const die = (message) => {
  throw new Error(message);
};

function committedRouterBytes(revision) {
  try {
    return execFileSync('git', ['show', `${revision}:${ROUTER}`], { cwd: ROOT });
  } catch (error) {
    die(`cannot read committed router at ${revision}`);
  }
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function parseRegistrations(source) {
  const input = stripComments(source);
  for (const route of input.matchAll(/\.route\s*\(/g)) {
    let cursor = route.index + route[0].length;
    while (/\s/.test(input[cursor] ?? '')) cursor++;
    if (input[cursor] !== '"' && input[cursor] !== "'") die('unsupported dynamic route path');
  }
  const operations = [];
  const unsupported = [];
  const routeStart = /\.route\s*\(\s*(["'])/g;
  let match;
  const consumed = [];
  while ((match = routeStart.exec(input))) {
    const quote = match[1];
    const pathStart = match.index + match[0].length;
    const pathEnd = input.indexOf(quote, pathStart);
    if (pathEnd < 0) die('unterminated route path literal');
    const path = input.slice(pathStart, pathEnd);
    const open = input.lastIndexOf('(', pathStart);
    if (open < 0) die(`route ${path} has no argument list`);
    let depth = 1;
    let close = open + 1;
    let string = false;
    for (; close < input.length && depth; close++) {
      const ch = input[close];
      if (ch === quote && input[close - 1] !== '\\') string = !string;
      if (!string) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
    }
    if (depth) die(`unterminated route expression for ${path}`);
    const expression = input.slice(pathEnd + 1, close - 1);
    consumed.push([match.index, close]);
    if (!path.startsWith('/')) die(`unsupported dynamic route path near ${path}`);
    const methods = [...expression.matchAll(/\b(get|post|put|delete)\s*\(/g)].map((x) =>
      x[1].toUpperCase(),
    );
    if (!methods.length)
      unsupported.push(`route ${path} has no recognized method-router combinator`);
    for (const method of methods) operations.push({ method, path });
  }
  const consumedStarts = new Set(consumed.map(([start]) => start));
  for (const residualMatch of input.matchAll(/\.route\s*\(/g)) {
    if (![...consumedStarts].some((start) => start === residualMatch.index))
      unsupported.push('unconsumed .route( registration');
  }
  if (unsupported.length) die(unsupported.join('; '));
  if (!operations.length) die('no literal Axum route registrations found');
  operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  const keys = new Set();
  for (const operation of operations) {
    const key = `${operation.method} ${operation.path}`;
    if (keys.has(key)) die(`duplicate operation ${key}`);
    keys.add(key);
  }
  return operations;
}

function candidateObject({ sourceRevision, sourceBytes, toolBytes, command, outPath, operations }) {
  return {
    schema_version: 1,
    baseline_id: 'api-contract-generation-precutover',
    source: { revision: sourceRevision, router_path: ROUTER, router_sha256: sha256(sourceBytes) },
    capture: {
      tool_path: TOOL,
      tool_sha256: sha256(toolBytes),
      parser: PARSER,
      candidate_command: command,
      accept_command: `npm run api:contract:baseline:accept -- --initial --candidate ${outPath} --review-contract ${CONTRACT} --reason api-contract-generation-precutover --reviewer-provenance initial-review`,
      commands: [command],
      captured_at_utc: now(),
      operation_count: operations.length,
    },
    operations,
  };
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function candidate() {
  const flags = args(process.argv.slice(3));
  const out = flags.out || die('--out is required');
  const revision = flags['source-revision'] || die('--source-revision is required');
  if (!/^[0-9a-f]{40}$/i.test(revision)) die('source revision must be a full 40-hex SHA');
  // The candidate is deliberately derived from the committed revision, not a
  // worktree that may have line-ending conversion or temporary route wiring.
  const sourceBytes = committedRouterBytes(revision);
  const toolBytes = await readFile(resolve(ROOT, TOOL));
  const operations = parseRegistrations(text(sourceBytes));
  const command = `npm run api:contract:baseline:candidate -- --source-revision ${revision} --out ${out}`;
  await mkdir(dirname(resolve(ROOT, out)), { recursive: true });
  await writeFile(
    resolve(ROOT, out),
    canonical(
      candidateObject({
        sourceRevision: revision,
        sourceBytes,
        toolBytes,
        command,
        outPath: out,
        operations,
      }),
    ),
    'utf8',
  );
}

function interfacePairs(markdown) {
  const pairs = [];
  const re = /^\|\s*\d+\s*\|\s*(GET|POST|PUT|DELETE)\s*\|\s*`([^`]+)`/gm;
  let match;
  while ((match = re.exec(markdown))) pairs.push({ method: match[1], path: match[2] });
  return pairs.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function pairKey(operation) {
  return `${operation.method} ${operation.path}`;
}
function assertEqualPairs(actual, expected) {
  const a = actual.map(pairKey).join('\n');
  const e = expected.map(pairKey).join('\n');
  if (a !== e) die(`operation inventory mismatch\nexpected:\n${e}\nactual:\n${a}`);
}

async function accept() {
  const flags = args(process.argv.slice(3));
  const candidatePath = flags.candidate || die('--candidate is required');
  const contractPath = flags['review-contract'] || die('--review-contract is required');
  const reason = flags.reason || die('--reason is required');
  const provenance = flags['reviewer-provenance'] || die('--reviewer-provenance is required');
  const candidateBytes = await readFile(resolve(ROOT, candidatePath));
  const data = JSON.parse(text(candidateBytes));
  const sourceBytes = committedRouterBytes(data.source.revision);
  const toolBytes = await readFile(resolve(ROOT, TOOL));
  if (data.source.router_sha256 !== sha256(sourceBytes)) die('candidate router hash is stale');
  if (data.capture.tool_sha256 !== sha256(toolBytes)) die('candidate capture-tool hash is stale');
  const contract = text(await readFile(resolve(ROOT, contractPath)));
  const expected = interfacePairs(contract);
  const baselinePath = resolve(ROOT, 'apps/api/openapi/precutover-operation-baseline.json');
  if (flags.initial) {
    try {
      await access(baselinePath);
      die('initial baseline already exists; refusing overwrite');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (data.capture.operation_count !== 52 || data.operations.length !== 52)
      die('initial baseline requires exactly 52 operations');
    assertEqualPairs(data.operations, expected);
  } else {
    const approved = contract.match(/API_BASELINE_CHANGE_APPROVED:\s*([0-9a-f]{64})/i)?.[1];
    if (!approved || approved !== sha256(candidateBytes))
      die('review contract does not approve this candidate hash');
    const current = JSON.parse(text(await readFile(baselinePath)));
    const currentSet = new Set(current.operations.map(pairKey));
    const candidateSet = new Set(data.operations.map(pairKey));
    const added = [...candidateSet].filter((x) => !currentSet.has(x));
    const removed = [...currentSet].filter((x) => !candidateSet.has(x));
    if (
      !contract.includes(`ADDED: ${added.sort().join(', ')}`) ||
      !contract.includes(`REMOVED: ${removed.sort().join(', ')}`)
    )
      die('review contract pair diff does not match candidate');
  }
  const output = {
    ...data,
    acceptance: {
      mode: flags.initial ? 'initial-precutover' : 'reviewed-behavior-change',
      review_contract: relative(ROOT, resolve(ROOT, contractPath)).replaceAll('\\', '/'),
      candidate_sha256: sha256(candidateBytes),
      reason,
      reviewer_provenance: provenance,
    },
  };
  const target = resolve(ROOT, 'apps/api/openapi/precutover-operation-baseline.json');
  const temp = `${target}.tmp-${process.pid}`;
  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(temp, canonical(output), 'utf8');
    await rename(temp, target);
  } catch (error) {
    try {
      await import('node:fs/promises').then((fs) => fs.unlink(temp));
    } catch {}
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];
  if (command === 'candidate') await candidate();
  else if (command === 'accept') await accept();
  else die('usage: api-contract-baseline.mjs <candidate|accept> ...');
}

export { canonical, interfacePairs, parseRegistrations };
