#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ERROR_STATUS = Object.freeze({
  USAGE: 2,
  NOT_INSTALLED: 3,
  INVALID_INSTALLATION: 4,
  UNKNOWN_CLUSTER: 5,
  CLUSTER_UNAVAILABLE: 6,
  PROVIDER_MISMATCH: 7,
});
const SPIRE_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SPIRE_GUARD_OWNER = 'spire:tech/path-guard';

const DESCRIPTOR = Object.freeze({
  schema_version: 1,
  id: 'spire:tech',
  availability: 'available',
  provider_requirements: Object.freeze({
    required: Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']),
    degradable: Object.freeze(['P8', 'P9', 'P10']),
  }),
  state_root: '.spire/clusters/tech',
  launch_required: true,
  rendered_artifacts: Object.freeze(['ORCHESTRATOR.md']),
});

const CATALOG = Object.freeze({
  schema_version: 1,
  clusters: Object.freeze([
    Object.freeze({ id: 'spire:tech', selector: 'tech', availability: 'available', executable: true }),
    Object.freeze({ id: 'spire:marketing', selector: 'marketing', availability: 'planned', executable: false }),
    Object.freeze({ id: 'spire:business', selector: 'business', availability: 'planned', executable: false }),
    Object.freeze({ id: 'spire:admin', selector: 'admin', availability: 'planned', executable: false }),
    Object.freeze({ id: 'spire:hr', selector: 'hr', availability: 'planned', executable: false }),
  ]),
});

const PROVIDERS = Object.freeze({
  claude: Object.freeze({
    root: '.claude',
    adapter: Object.freeze({ kind: 'command', installed: 'commands/spire-tech.md', invoke: '/spire-tech' }),
    capabilities: Object.freeze({
      supported: Object.freeze(['P1', 'P10', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']),
      degraded: Object.freeze([]),
    }),
    config: Object.freeze({
      placement: 'provider-root',
      path: 'settings.json',
      format: 'json-hook-v1',
      event: 'PreToolUse',
      entry: Object.freeze({
        matcher: 'Write|Edit|MultiEdit|NotebookEdit',
        hooks: Object.freeze([Object.freeze({
          type: 'command',
          command: 'node .claude/tools/path_guard.js',
          statusMessage: 'path-guard: workspace fence (system-4b)',
          spireOwner: SPIRE_GUARD_OWNER,
        })]),
      }),
    }),
  }),
  codex: Object.freeze({
    root: '.codex',
    adapter: Object.freeze({ kind: 'skill', installed: 'skills/spire-tech/SKILL.md', invoke: '$spire-tech' }),
    capabilities: Object.freeze({
      supported: Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P9']),
      degraded: Object.freeze([
        Object.freeze({
          id: 'P10',
          reason: 'slash command capability is unavailable; use the installed Spire skill selector',
        }),
        Object.freeze({
          id: 'P8',
          reason: 'per-agent tool fencing is unavailable; role restrictions remain instruction-held',
        }),
      ]),
    }),
    config: Object.freeze({
      placement: 'provider-root',
      path: 'hooks.json',
      format: 'json-hook-v1',
      event: 'PreToolUse',
      entry: Object.freeze({
        matcher: 'apply_patch|Write|Edit|MultiEdit|NotebookEdit',
        hooks: Object.freeze([Object.freeze({
          type: 'command',
          command: 'node .codex/tools/path_guard.js --protocol codex',
          commandWindows: 'node .codex/tools/path_guard.js --protocol codex',
          timeout: 30,
          statusMessage: 'path-guard: workspace fence (system-4b)',
          spireOwner: SPIRE_GUARD_OWNER,
        })]),
      }),
    }),
  }),
});

const RECEIPT_FIELDS = Object.freeze([
  'schema_version', 'product', 'version', 'cluster', 'provider', 'provider_root', 'installed_at',
  'artifacts', 'descriptor_sha256', 'launch_adapter', 'provider_capabilities', 'provider_config',
]);
const ARTIFACT_PLACEMENTS = Object.freeze(['provider-root', 'repo-root', 'spire-root']);

function refusal(error, message) {
  return { ok: false, error, message };
}

function parseArgs(argv) {
  if (argv[0] !== 'run' || typeof argv[1] !== 'string' || argv[1] === '') {
    return { finding: refusal('USAGE', 'usage: spire run <cluster> [--root <consumer>] [--provider <name>] [--json]') };
  }
  const parsed = { selector: argv[1], root: null, provider: null, json: false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      if (parsed.json) return { finding: refusal('USAGE', '--json may be supplied only once') };
      parsed.json = true;
      continue;
    }
    if (token === '--root' || token === '--provider') {
      const key = token.slice(2);
      const value = argv[++index];
      if (typeof value !== 'string' || value === '' || value.startsWith('--') || parsed[key] !== null) {
        return { finding: refusal('USAGE', `${token} requires exactly one value`) };
      }
      parsed[key] = value;
      continue;
    }
    return { finding: refusal('USAGE', `unknown argument '${token}'`) };
  }
  return { parsed };
}

function defaultRoot() {
  const self = fileURLToPath(import.meta.url);
  const bin = path.dirname(self);
  const spire = path.dirname(bin);
  if (path.basename(self) === 'spire.mjs' && path.basename(bin) === 'bin' && path.basename(spire) === '.spire') {
    return path.dirname(spire);
  }
  return process.cwd();
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  return isPlainObject(value) &&
    Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isPlainObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalValue(value[key]);
  return result;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

function sameCanonicalValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function hash(bytes) {
  return crypto.hash('sha256', bytes, 'hex');
}

function safeRelative(value) {
  if (typeof value !== 'string' || value === '' || value.includes('\\') || value.includes('\0') ||
      path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/u.test(value)) return false;
  const segments = value.split('/');
  return segments.every((part) => part !== '' && part !== '.' && part !== '..') &&
    path.posix.normalize(value) === value;
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function contained(root, candidate) {
  const relation = path.relative(root, candidate);
  return relation === '' || (!path.isAbsolute(relation) && relation !== '..' && !relation.startsWith(`..${path.sep}`));
}

function rootAuthority(root) {
  const resolved = path.resolve(root);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('consumer root is not a real directory');
  const real = fs.realpathSync.native(resolved);
  if (normalizedPath(real) !== normalizedPath(resolved)) {
    throw new Error('consumer root is reached through a symbolic link or reparse point');
  }
  return { root: resolved, real };
}

function inspectContained(root, destination, { leaf = 'file', allowMissingLeaf = false, singleLink = false } = {}) {
  const authority = rootAuthority(root);
  const absolute = path.resolve(destination);
  if (!contained(authority.root, absolute)) throw new Error('path escapes the consumer root');
  const relation = path.relative(authority.root, absolute);
  const segments = relation === '' ? [] : relation.split(path.sep);
  let cursor = authority.root;
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error?.code === 'ENOENT' && allowMissingLeaf && index === segments.length - 1) {
        return { exists: false, path: absolute, stat: null };
      }
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`symbolic link or reparse point is forbidden: ${cursor}`);
    const isLeaf = index === segments.length - 1;
    if (!isLeaf && !stat.isDirectory()) throw new Error(`path ancestor is not a directory: ${cursor}`);
    if (isLeaf && leaf === 'directory' && !stat.isDirectory()) throw new Error(`path is not a directory: ${cursor}`);
    if (isLeaf && leaf === 'file' && !stat.isFile()) throw new Error(`path is not a regular file: ${cursor}`);
    if (isLeaf && leaf === 'file' && singleLink && stat.nlink !== 1) {
      throw new Error(`path is externally hard-linked: ${cursor}`);
    }
    const real = fs.realpathSync.native(cursor);
    if (!contained(authority.real, real)) throw new Error(`real path escapes the consumer root: ${cursor}`);
  }
  return { exists: true, path: absolute, stat: fs.lstatSync(absolute) };
}

function readInside(root, file, encoding = null) {
  inspectContained(root, file, { leaf: 'file' });
  return fs.readFileSync(file, encoding ?? undefined);
}

function readCanonical(root, file) {
  try {
    const bytes = readInside(root, file, 'utf8');
    const value = JSON.parse(bytes);
    return bytes === canonicalJson(value) ? { bytes, value } : null;
  } catch {
    return null;
  }
}

function artifactFile(root, receipt, artifact) {
  const base = artifact.placement === 'repo-root' ? root
    : artifact.placement === 'provider-root' ? path.join(root, receipt.provider_root)
      : artifact.placement === 'spire-root' ? path.join(root, '.spire') : null;
  if (!base || !safeRelative(artifact.path)) return null;
  const destination = path.resolve(base, ...artifact.path.split('/'));
  return contained(base, destination) ? destination : null;
}

function validateProviderCapabilities(receipt, provider) {
  if (!sameCanonicalValue(receipt.provider_capabilities, provider.capabilities)) {
    throw new Error('provider capability snapshot does not match the selected provider');
  }
}

function normalizedGuardInvocation(command, providerRoot, windowsCommand) {
  if (typeof command !== 'string') return false;
  const match = /^\s*([^\s]+)\s+(?:"([^"]+)"|'([^']+)'|([^\s"']+))(?:\s+--protocol\s+([^\s]+))?\s*$/u.exec(command);
  if (!match) return false;
  const executable = match[1];
  if (windowsCommand ? executable.toLowerCase() !== 'node' : executable !== 'node') return false;
  const actualPath = (match[2] ?? match[3] ?? match[4]).replaceAll('\\', '/').replace(/^\.\//u, '');
  const expectedPath = `${providerRoot}/tools/path_guard.js`.replace(/^\.\//u, '');
  const samePath = windowsCommand
    ? actualPath.toLowerCase() === expectedPath.toLowerCase()
    : actualPath === expectedPath;
  if (!samePath) return false;
  const protocol = match[5] ?? null;
  return providerRoot.toLowerCase() === '.codex'
    ? protocol === 'codex'
    : protocol === null;
}

function isProviderGuardHook(hook, providerRoot) {
  if (!isPlainObject(hook) || typeof providerRoot !== 'string' || providerRoot === '') return false;
  if (Object.hasOwn(hook, 'spireOwner')) return hook.spireOwner === SPIRE_GUARD_OWNER;
  return normalizedGuardInvocation(hook.command, providerRoot, process.platform === 'win32') ||
    normalizedGuardInvocation(hook.commandWindows, providerRoot, true);
}

function validateProviderConfig(root, receipt, provider) {
  if (!sameCanonicalValue(receipt.provider_config, provider.config)) {
    throw new Error('provider config snapshot does not match the selected provider');
  }
  const configFile = path.join(root, receipt.provider_root, ...provider.config.path.split('/'));
  let configValue;
  try {
    configValue = JSON.parse(readInside(root, configFile, 'utf8'));
  } catch {
    throw new Error('provider config is missing or invalid');
  }
  const entries = configValue?.hooks?.[provider.config.event];
  if (!Array.isArray(entries)) throw new Error('provider config event is not an array');
  const related = entries.filter((entry) => isPlainObject(entry) && Array.isArray(entry.hooks) &&
    entry.hooks.some((hook) => isProviderGuardHook(hook, provider.root)));
  if (related.length !== 1 || !sameCanonicalValue(related[0], provider.config.entry)) {
    throw new Error('provider config must contain exactly one related canonical Spire guard');
  }
}

function validateArtifacts(root, receipt, provider) {
  if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0) {
    throw new Error('installation artifact inventory is empty');
  }
  const keys = [];
  const folded = new Set();
  for (const artifact of receipt.artifacts) {
    if (!exactKeys(artifact, ['placement', 'path', 'type', 'mode', 'sha256']) ||
        !ARTIFACT_PLACEMENTS.includes(artifact.placement) || !safeRelative(artifact.path) ||
        artifact.type !== 'file' || !Number.isInteger(artifact.mode) || artifact.mode < 0 || artifact.mode > 0o777 ||
        !/^[a-f0-9]{64}$/u.test(artifact.sha256)) {
      throw new Error('installation artifact entry has invalid schema');
    }
    const key = `${artifact.placement}:${artifact.path}`;
    if (folded.has(key.toLowerCase())) throw new Error('installation artifact is duplicated');
    folded.add(key.toLowerCase());
    keys.push(key);
    const file = artifactFile(root, receipt, artifact);
    const observed = file && inspectContained(root, file, { leaf: 'file' });
    const observedMode = observed?.stat.mode & 0o777;
    const modeMatches = process.platform === 'win32'
      ? Boolean(observedMode & 0o222) === Boolean(artifact.mode & 0o222)
      : observedMode === artifact.mode;
    if (!file || !modeMatches || hash(fs.readFileSync(file)) !== artifact.sha256) {
      throw new Error(`installation artifact is missing or changed: ${key}`);
    }
  }
  const sorted = [...receipt.artifacts]
    .sort((left, right) => left.placement.localeCompare(right.placement) || left.path.localeCompare(right.path))
    .map((artifact) => `${artifact.placement}:${artifact.path}`);
  if (keys.join('\0') !== sorted.join('\0')) throw new Error('installation artifacts are not sorted');
  const mandatory = [
    'spire-root:version',
    'spire-root:catalog.json',
    'spire-root:clusters/tech/descriptor.json',
    'spire-root:bin/spire.mjs',
    'spire-root:bin/spire',
    'spire-root:bin/spire.cmd',
    'provider-root:ORCHESTRATOR.md',
    `provider-root:${provider.adapter.installed}`,
  ];
  if (receipt.provider === 'codex') mandatory.push('repo-root:AGENTS.md');
  for (const key of mandatory) if (!folded.has(key.toLowerCase())) throw new Error(`mandatory artifact is absent: ${key}`);
  if (receipt.provider === 'claude' && folded.has('repo-root:agents.md')) {
    throw new Error('Claude installation must not inventory repo-root AGENTS.md');
  }
}

function validateInstallation(root) {
  rootAuthority(root);
  const spireRoot = path.join(root, '.spire');
  const installed = readCanonical(root, path.join(spireRoot, 'installation.json'));
  const descriptor = readCanonical(root, path.join(spireRoot, 'clusters', 'tech', 'descriptor.json'));
  const catalog = readCanonical(root, path.join(spireRoot, 'catalog.json'));
  if (!installed || !descriptor || !catalog) throw new Error('installed metadata is missing or non-canonical');
  if (!sameCanonicalValue(descriptor.value, DESCRIPTOR)) throw new Error('installed descriptor has invalid schema');
  if (!sameCanonicalValue(catalog.value, CATALOG)) throw new Error('installed catalog has invalid schema');

  const receipt = installed.value;
  if (!exactKeys(receipt, RECEIPT_FIELDS) || receipt.schema_version !== 1 || receipt.product !== 'spire-os' ||
      receipt.cluster !== DESCRIPTOR.id || !Object.hasOwn(PROVIDERS, receipt.provider) ||
      typeof receipt.version !== 'string' || !SPIRE_VERSION_PATTERN.test(receipt.version) ||
      typeof receipt.installed_at !== 'string' || Number.isNaN(Date.parse(receipt.installed_at)) ||
      new Date(receipt.installed_at).toISOString() !== receipt.installed_at ||
      !/^[a-f0-9]{64}$/u.test(receipt.descriptor_sha256)) {
    throw new Error('installation receipt has invalid schema');
  }
  const provider = PROVIDERS[receipt.provider];
  if (receipt.provider_root !== provider.root || !sameCanonicalValue(receipt.launch_adapter, provider.adapter)) {
    throw new Error('installation provider or adapter does not match the selected provider');
  }
  if (receipt.descriptor_sha256 !== hash(descriptor.bytes)) throw new Error('installed descriptor hash does not match');
  if (readInside(root, path.join(spireRoot, 'version'), 'utf8') !== `${receipt.version}\n`) {
    throw new Error('installed version does not match the receipt');
  }
  validateProviderCapabilities(receipt, provider);
  validateArtifacts(root, receipt, provider);
  validateProviderConfig(root, receipt, provider);
  inspectContained(root, path.join(root, ...DESCRIPTOR.state_root.split('/')), { leaf: 'directory' });
  return { receipt, catalog: catalog.value, state: descriptor.value, provider };
}

function inspectSelectionTarget(root, destination, { allowMissing = true } = {}) {
  const parent = path.dirname(destination);
  inspectContained(root, parent, { leaf: 'directory' });
  return inspectContained(root, destination, {
    leaf: 'file',
    allowMissingLeaf: allowMissing,
    singleLink: true,
  });
}

function syncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, 'r');
    fs.fsyncSync(descriptor);
  } catch {
    // Directory fsync is not supported by every host filesystem (notably Windows).
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function writeSelection(root, validated) {
  const provider = validated.receipt.provider;
  const expectedAdapter = PROVIDERS[provider].adapter;
  const selection = {
    schema_version: 1,
    selected_at: new Date().toISOString(),
    cluster: DESCRIPTOR.id,
    provider,
    adapter: provider === 'claude'
      ? { kind: 'command', installed: 'commands/spire-tech.md', invoke: '/spire-tech' }
      : { kind: 'skill', installed: 'skills/spire-tech/SKILL.md', invoke: '$spire-tech' },
  };
  if (!sameCanonicalValue(selection.adapter, expectedAdapter)) throw new Error('selection adapter is not canonical');
  const destination = path.join(root, ...DESCRIPTOR.state_root.split('/'), 'receipts', 'selection.json');
  const parent = path.dirname(destination);
  inspectSelectionTarget(root, destination);
  fs.mkdirSync(parent, { recursive: true });
  inspectSelectionTarget(root, destination);

  const scratch = path.join(parent, `.selection.json.spire-tmp-${crypto.randomUUID()}`);
  inspectContained(root, scratch, { leaf: 'file', allowMissingLeaf: true, singleLink: true });
  let descriptor;
  try {
    descriptor = fs.openSync(scratch, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    fs.writeFileSync(descriptor, canonicalJson(selection), 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    inspectContained(root, scratch, { leaf: 'file', singleLink: true });
    inspectSelectionTarget(root, destination);
    fs.renameSync(scratch, destination);
    syncDirectory(parent);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.rmSync(scratch, { force: true }); } catch { /* best effort after a contained unique path */ }
  }
}

function select(parsed) {
  const root = path.resolve(parsed.root ?? defaultRoot());
  try {
    rootAuthority(root);
  } catch {
    return refusal('INVALID_INSTALLATION', `installed Spire state at '${root}' is unsafe`);
  }
  const installationFile = path.join(root, '.spire', 'installation.json');
  if (!fs.existsSync(installationFile)) {
    return refusal('NOT_INSTALLED', `no complete Spire installation exists at '${root}'`);
  }
  let validated;
  try {
    validated = validateInstallation(root);
  } catch {
    return refusal('INVALID_INSTALLATION', `installed Spire state at '${root}' is malformed`);
  }
  const installation = validated.receipt;
  const catalog = validated.catalog;
  const cluster = parsed.selector === 'tech' ? 'spire:tech' : parsed.selector;
  const entry = catalog.clusters.find((candidate) => candidate.id === cluster);
  if (!entry) return refusal('UNKNOWN_CLUSTER', `unknown cluster '${parsed.selector}'`);
  if (entry.availability !== 'available' || entry.executable !== true) {
    return refusal('CLUSTER_UNAVAILABLE', `cluster '${cluster}' is ${entry.availability} and cannot run`);
  }
  if (cluster !== DESCRIPTOR.id || installation.cluster !== cluster) {
    return refusal('INVALID_INSTALLATION', `installed cluster '${installation.cluster}' does not match '${cluster}'`);
  }
  if (parsed.provider !== null && parsed.provider !== installation.provider) {
    return refusal(
      'PROVIDER_MISMATCH',
      `requested provider '${parsed.provider}' does not match installed provider '${installation.provider}'`,
    );
  }
  try {
    writeSelection(root, validated);
  } catch {
    return refusal('INVALID_INSTALLATION', `selection receipt path at '${root}' is unsafe`);
  }
  return { ok: true, cluster, provider: installation.provider, root };
}

function emit(result, json) {
  const output = json
    ? JSON.stringify(result)
    : result.ok
      ? `selected ${result.cluster} for ${result.provider} at ${result.root}`
      : `spire: ${result.message}`;
  const stream = result.ok || json ? process.stdout : process.stderr;
  stream.write(`${output}\n`);
  return result.ok ? 0 : (ERROR_STATUS[result.error] ?? 1);
}

const parsed = parseArgs(process.argv.slice(2));
const result = parsed.finding ?? select(parsed.parsed);
process.exitCode = emit(result, parsed.parsed?.json === true || process.argv.includes('--json'));
