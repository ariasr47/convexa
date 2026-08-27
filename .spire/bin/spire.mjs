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
  UNKNOWN_ASCENT: 8,
  ASCENT_NOT_INSTALLED: 9,
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

// Ascent universe this selector understands. It ships in the same install as the receipt that
// records which of them a consumer actually has, so the two never disagree by version skew.
const ASCENTS = Object.freeze({
  'spire:tech': Object.freeze(['delivery', 'evolution']),
});
// Receipts written before ascents existed carry neither field and mean the single delivery ascent.
const IMPLIED_ASCENTS = Object.freeze(['delivery']);
const IMPLIED_DEFAULT_ASCENT = 'delivery';
const ASCENT_ID = /^[a-z][a-z0-9-]*$/u;

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
  grok: Object.freeze({
    root: '.grok',
    adapter: Object.freeze({ kind: 'skill', installed: 'skills/spire-tech/SKILL.md', invoke: '$spire-tech' }),
    capabilities: Object.freeze({
      supported: Object.freeze(['P1', 'P10', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']),
      degraded: Object.freeze([]),
    }),
    config: Object.freeze({
      placement: 'provider-root',
      path: 'hooks/spire-path-guard.json',
      format: 'json-hook-v1',
      event: 'PreToolUse',
      entry: Object.freeze({
        matcher: 'Write|Edit|MultiEdit|NotebookEdit|search_replace',
        hooks: Object.freeze([Object.freeze({
          type: 'command',
          command: 'node .grok/tools/path_guard.js --protocol grok',
          commandWindows: 'node .grok/tools/path_guard.js --protocol grok',
          timeout: 30,
          statusMessage: 'path-guard: workspace fence (system-4b)',
          spireOwner: SPIRE_GUARD_OWNER,
        })]),
      }),
    }),
  }),
});

// Ascent-specific launch surfaces are platform-owned projections. Delivery retains the provider
// adapters above; evolution points only at files that its composition installs.
const EVOLUTION_ADAPTERS = Object.freeze({
  claude: Object.freeze({ kind: 'command', installed: 'commands/spire-tech-evolution.md', invoke: '/spire-tech-evolution' }),
  codex: Object.freeze({ kind: 'skill', installed: 'skills/spire-tech-evo-context-economy/SKILL.md', invoke: '$spire-tech-evo-context-economy' }),
  grok: Object.freeze({ kind: 'skill', installed: 'skills/spire-tech-evo-context-economy/SKILL.md', invoke: '$spire-tech-evo-context-economy' }),
});

function launchAdapterFor(provider, ascent = 'delivery') {
  return ascent === 'evolution' ? EVOLUTION_ADAPTERS[provider] : PROVIDERS[provider]?.adapter;
}

// Receipt schema 1 is a single installed provider. Schema 2 (written by every multi-provider
// install, which is the default) keeps the same default-provider triple and adds the full
// per-provider inventory. A reader that understands only one of them bricks cluster entry on the
// install shape operators actually get.
const RECEIPT_FIELDS_V1 = Object.freeze([
  'schema_version', 'product', 'version', 'cluster', 'provider', 'provider_root', 'installed_at',
  'artifacts', 'descriptor_sha256', 'launch_adapter', 'provider_capabilities', 'provider_config',
]);
const RECEIPT_FIELDS_V2 = Object.freeze([...RECEIPT_FIELDS_V1, 'providers', 'installations']);
// Both ascent fields or neither. Absent is the pre-ascent receipt shape; exactly one is corruption.
const RECEIPT_FIELDS_ASCENT = Object.freeze(['ascents', 'default_ascent']);
const RECEIPT_FIELDS_R4 = Object.freeze([
  'canonical_role_ids', 'installed_adapters', 'active_targets', 'source_version', 'migration_state',
]);
const INSTALLATION_FIELDS = Object.freeze([
  'provider_root', 'launch_adapter', 'provider_capabilities', 'provider_config',
]);
const ARTIFACT_PLACEMENTS = Object.freeze(['provider-root', 'repo-root', 'spire-root']);
const PROVIDER_ROOTS = Object.freeze(Object.values(PROVIDERS).map((entry) => entry.root));

// A provider the operator asked for but did not install is a distinct, actionable refusal — never
// "malformed", which would send them to re-install a healthy tree.
class ProviderMismatchError extends Error {
  constructor(requested, installed) {
    super(`requested provider '${requested}' is not installed`);
    this.requested = requested;
    this.installed = installed;
  }
}

const INSTALLATION_INVARIANTS = Object.freeze({
  METADATA: 'metadata integrity',
  ARTIFACT: 'artifact integrity',
  PROVIDER: 'provider contract',
  UNKNOWN: 'installation integrity',
});

class InstallationInvariantError extends Error {
  constructor(invariant) {
    super(invariant);
    this.invariant = invariant;
  }
}

function refusal(error, message, hint = null) {
  const body = { ok: false, error, message };
  if (hint) body.hint = hint;
  return body;
}

const USAGE_HINTS = Object.freeze({
  USAGE: 'Example: node .spire/bin/spire.mjs run tech --provider claude',
  NOT_INSTALLED: 'From the Spire kit: node platform/lifecycle/install.mjs <this-repo>',
  INVALID_INSTALLATION: 'From the Spire kit: node platform/lifecycle/doctor.mjs <root>',
  UNKNOWN_CLUSTER: 'Only "tech" is executable today (spire:tech)',
  CLUSTER_UNAVAILABLE: 'That cluster is planned, not executable — use tech',
  PROVIDER_MISMATCH: 'Pass --provider claude|codex|grok matching an installed host root',
  UNKNOWN_ASCENT: `Valid ascents for tech: ${ASCENTS['spire:tech'].join(', ')}`,
  ASCENT_NOT_INSTALLED: 'Reinstall with --ascents to add it',
});

function parseArgs(argv) {
  if (argv[0] !== 'run' || typeof argv[1] !== 'string' || argv[1] === '') {
    return {
      finding: refusal(
        'USAGE',
        'usage: spire run <cluster> [ascent] [--root <consumer>] [--provider <name>] [--json]',
        USAGE_HINTS.USAGE,
      ),
    };
  }
  const parsed = { selector: argv[1], ascent: null, root: null, provider: null, json: false, check: false };
  // The ascent is positional and optional: only argv[2], and only when it is not a flag.
  let first = 2;
  if (typeof argv[2] === 'string' && argv[2] !== '' && !argv[2].startsWith('--')) {
    parsed.ascent = argv[2];
    first = 3;
  }
  for (let index = first; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      if (parsed.json) return { finding: refusal('USAGE', '--json may be supplied only once') };
      parsed.json = true;
      continue;
    }
    if (token === '--check') {
      if (parsed.check) return { finding: refusal('USAGE', '--check may be supplied only once') };
      parsed.check = true;
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
  // Schema 2 inventories every provider root, so a provider-root artifact resolves against its own
  // recorded root — not the default provider's.
  const base = artifact.placement === 'repo-root' ? root
    : artifact.placement === 'provider-root' ? path.join(root, artifact.provider_root ?? receipt.provider_root)
      : artifact.placement === 'spire-root' ? path.join(root, '.spire') : null;
  if (!base || !safeRelative(artifact.path)) return null;
  const destination = path.resolve(base, ...artifact.path.split('/'));
  return contained(base, destination) ? destination : null;
}

function validateProviderCapabilities(installation, provider) {
  if (!sameCanonicalValue(installation.provider_capabilities, provider.capabilities)) {
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
  const root = providerRoot.toLowerCase();
  if (root === '.codex') return protocol === 'codex';
  if (root === '.grok') return protocol === 'grok';
  return protocol === null;
}

function isProviderGuardHook(hook, providerRoot) {
  if (!isPlainObject(hook) || typeof providerRoot !== 'string' || providerRoot === '') return false;
  if (Object.hasOwn(hook, 'spireOwner')) return hook.spireOwner === SPIRE_GUARD_OWNER;
  return normalizedGuardInvocation(hook.command, providerRoot, process.platform === 'win32') ||
    normalizedGuardInvocation(hook.commandWindows, providerRoot, true);
}

function validateProviderConfig(root, installation, provider) {
  if (!sameCanonicalValue(installation.provider_config, provider.config)) {
    throw new Error('provider config snapshot does not match the selected provider');
  }
  const configFile = path.join(root, installation.provider_root, ...provider.config.path.split('/'));
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

// Mirrors the installer's receipt contract: both ascent fields or neither, and when present the
// list is sorted, unique, non-empty, and contains the recorded default.
function receiptAscents(receipt) {
  const hasList = Object.hasOwn(receipt, 'ascents');
  const hasDefault = Object.hasOwn(receipt, 'default_ascent');
  if (!hasList && !hasDefault) {
    return { ascents: [...IMPLIED_ASCENTS], default_ascent: IMPLIED_DEFAULT_ASCENT };
  }
  if (hasList !== hasDefault) return null;
  const { ascents, default_ascent: fallback } = receipt;
  if (!Array.isArray(ascents) || ascents.length === 0 ||
      !ascents.every((id) => typeof id === 'string' && ASCENT_ID.test(id)) ||
      new Set(ascents).size !== ascents.length ||
      [...ascents].sort().join('\0') !== ascents.join('\0') ||
      typeof fallback !== 'string' || !ascents.includes(fallback)) return null;
  return { ascents: [...ascents], default_ascent: fallback };
}

function artifactKey(artifact) {
  return `${artifact.placement}:${artifact.provider_root ?? ''}:${artifact.path}`;
}

function validateArtifacts(root, receipt, provider, selected, selectedAscent) {
  if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0) {
    throw new Error('installation artifact inventory is empty');
  }
  const multi = receipt.schema_version === 2;
  const keys = [];
  const folded = new Set();
  for (const artifact of receipt.artifacts) {
    // Only schema 2 carries provider_root, and only on provider-root entries.
    const expectedKeys = ['placement', 'path', 'type', 'mode', 'sha256'];
    if (multi && artifact.placement === 'provider-root') expectedKeys.push('provider_root');
    if (!exactKeys(artifact, expectedKeys) ||
        (multi && artifact.placement === 'provider-root' &&
          !PROVIDER_ROOTS.includes(artifact.provider_root)) ||
        !ARTIFACT_PLACEMENTS.includes(artifact.placement) || !safeRelative(artifact.path) ||
        artifact.type !== 'file' || !Number.isInteger(artifact.mode) || artifact.mode < 0 || artifact.mode > 0o777 ||
        !/^[a-f0-9]{64}$/u.test(artifact.sha256)) {
      throw new Error('installation artifact entry has invalid schema');
    }
    const key = artifactKey(artifact);
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
  // Mirrors the installer's ordering: placement, then provider root, then path.
  const sorted = [...receipt.artifacts]
    .sort((left, right) => left.placement.localeCompare(right.placement) ||
      (left.provider_root ?? '').localeCompare(right.provider_root ?? '') ||
      left.path.localeCompare(right.path))
    .map(artifactKey);
  if (keys.join('\0') !== sorted.join('\0')) throw new Error('installation artifacts are not sorted');
  // Under schema 2 the mandatory provider-root artifacts are the SELECTED provider's, not the
  // default's — selecting codex must prove codex's own root is complete.
  const selectedRoot = multi ? selected.provider_root : '';
  const mandatory = [
    'spire-root::version',
    'spire-root::catalog.json',
    'spire-root::clusters/tech/descriptor.json',
    'spire-root::bin/spire.mjs',
    'spire-root::bin/spire',
    'spire-root::bin/spire.cmd',
    `provider-root:${selectedRoot}:${selected.launch_adapter.installed}`,
  ];
  mandatory.push(`provider-root:${selectedRoot}:${selectedAscent === 'evolution' ? 'evolution/ORCHESTRATOR_EVOLUTION.md' : 'ORCHESTRATOR.md'}`);
  if (selectedAscent === 'delivery' && (selected.name === 'codex' || selected.name === 'grok')) {
    const bootKey = `provider-root:${selectedRoot}:AGENTS.md`;
    // Legacy receipts inventoried this boot document at repo root. New installs keep immutable
    // authority under the provider root and leave any root router project-owned and unreceipted.
    if (!folded.has(bootKey.toLowerCase()) && !folded.has('repo-root::agents.md')) {
      throw new Error(`mandatory artifact is absent: ${bootKey}`);
    }
  }
  for (const key of mandatory) if (!folded.has(key.toLowerCase())) throw new Error(`mandatory artifact is absent: ${key}`);
  if (!multi && selected.name === 'claude' && folded.has('repo-root::agents.md')) {
    throw new Error('Claude installation must not inventory repo-root AGENTS.md');
  }
}

function validateInstallation(root, requestedProvider = null, requestedAscent = null) {
  let invariant = INSTALLATION_INVARIANTS.UNKNOWN;
  try {
  rootAuthority(root);
  invariant = INSTALLATION_INVARIANTS.METADATA;
  const spireRoot = path.join(root, '.spire');
  const installed = readCanonical(root, path.join(spireRoot, 'installation.json'));
  const descriptor = readCanonical(root, path.join(spireRoot, 'clusters', 'tech', 'descriptor.json'));
  const catalog = readCanonical(root, path.join(spireRoot, 'catalog.json'));
  if (!installed || !descriptor || !catalog) throw new Error('installed metadata is missing or non-canonical');
  if (!sameCanonicalValue(descriptor.value, DESCRIPTOR)) throw new Error('installed descriptor has invalid schema');
  if (!sameCanonicalValue(catalog.value, CATALOG)) throw new Error('installed catalog has invalid schema');

  const receipt = installed.value;
  const multi = receipt.schema_version === 2;
  const ascent = receiptAscents(receipt);
  if (!ascent) throw new Error('installation receipt has invalid ascent fields');
  const requestedKnownAndInstalled = requestedAscent !== null &&
    (ASCENTS[DESCRIPTOR.id] ?? []).includes(requestedAscent) && ascent.ascents.includes(requestedAscent);
  const selectedAscent = requestedKnownAndInstalled ? requestedAscent : ascent.default_ascent;
  const baseFields = multi ? RECEIPT_FIELDS_V2 : RECEIPT_FIELDS_V1;
  const hasR4Inventory = RECEIPT_FIELDS_R4.some((field) => Object.hasOwn(receipt, field));
  const expectedFields = Object.hasOwn(receipt, 'ascents')
    ? [...baseFields, ...(hasR4Inventory ? RECEIPT_FIELDS_R4 : []), ...RECEIPT_FIELDS_ASCENT]
    : [...baseFields, ...(hasR4Inventory ? RECEIPT_FIELDS_R4 : [])];
  if (!exactKeys(receipt, expectedFields) ||
      ![1, 2].includes(receipt.schema_version) || receipt.product !== 'spire-os' ||
      receipt.cluster !== DESCRIPTOR.id || !Object.hasOwn(PROVIDERS, receipt.provider) ||
      typeof receipt.version !== 'string' || !SPIRE_VERSION_PATTERN.test(receipt.version) ||
      typeof receipt.installed_at !== 'string' || Number.isNaN(Date.parse(receipt.installed_at)) ||
      new Date(receipt.installed_at).toISOString() !== receipt.installed_at ||
      !/^[a-f0-9]{64}$/u.test(receipt.descriptor_sha256)) {
    throw new Error('installation receipt has invalid schema');
  }
  const expectedReceiptAdapter = launchAdapterFor(receipt.provider, ascent.default_ascent);
  if (!exactKeys(receipt.launch_adapter, ['kind', 'installed', 'invoke']) ||
      !sameCanonicalValue(receipt.launch_adapter, expectedReceiptAdapter)) {
    throw new Error('installation receipt launch adapter does not match its default ascent');
  }
  if (hasR4Inventory && (receipt.source_version !== receipt.version ||
      !['none', 'stop-c23-gate-l-1'].includes(receipt.migration_state) ||
      !Array.isArray(receipt.canonical_role_ids) ||
      JSON.stringify(receipt.canonical_role_ids) !== JSON.stringify(['spire:tech/synthesizer']) ||
      !Array.isArray(receipt.installed_adapters) || !Array.isArray(receipt.active_targets) ||
      receipt.active_targets.length === 0 || receipt.active_targets.length !== new Set(receipt.active_targets).size ||
      receipt.installed_adapters.some((adapter) => adapter?.canonical_id !== 'spire:tech/synthesizer'))) {
    throw new Error('installation receipt has invalid R4 canonical adapter inventory');
  }

  // Resolve which installed provider this invocation selects, then validate THAT one end to end.
  const defaultView = {
    name: receipt.provider,
    provider_root: receipt.provider_root,
    launch_adapter: receipt.launch_adapter,
    provider_capabilities: receipt.provider_capabilities,
    provider_config: receipt.provider_config,
  };
  let installedProviders = [receipt.provider];
  if (multi) {
    if (!Array.isArray(receipt.providers) || receipt.providers.length === 0 ||
        new Set(receipt.providers).size !== receipt.providers.length ||
        !receipt.providers.every((name) => Object.hasOwn(PROVIDERS, name)) ||
        [...receipt.providers].sort().join('\0') !== receipt.providers.join('\0') ||
        !receipt.providers.includes(receipt.provider) ||
        !exactKeys(receipt.installations, receipt.providers) ||
        !receipt.providers.every((name) => exactKeys(receipt.installations[name], INSTALLATION_FIELDS))) {
      throw new Error('installation receipt has invalid multi-provider schema');
    }
    // The default triple is a projection of installations[default]; a disagreement means the
    // receipt lies about which host root cluster entry opens.
    const canonicalDefault = receipt.installations[receipt.provider];
    if (canonicalDefault.provider_root !== receipt.provider_root ||
        !sameCanonicalValue(canonicalDefault.launch_adapter, receipt.launch_adapter) ||
        !sameCanonicalValue(canonicalDefault.provider_capabilities, receipt.provider_capabilities) ||
        !sameCanonicalValue(canonicalDefault.provider_config, receipt.provider_config)) {
      throw new Error('installation default provider does not match its own inventory entry');
    }
    installedProviders = receipt.providers;
  }
  const selectedName = requestedProvider ?? receipt.provider;
  if (!installedProviders.includes(selectedName)) {
    throw new ProviderMismatchError(selectedName, installedProviders);
  }
  const selected = multi
    ? { name: selectedName, ...receipt.installations[selectedName], launch_adapter: launchAdapterFor(selectedName, selectedAscent) }
    : { ...defaultView, launch_adapter: launchAdapterFor(selectedName, selectedAscent) };

  invariant = INSTALLATION_INVARIANTS.PROVIDER;
  const provider = PROVIDERS[selectedName];
  if (selected.provider_root !== provider.root || !sameCanonicalValue(selected.launch_adapter, launchAdapterFor(selectedName, selectedAscent))) {
    throw new Error('installation provider or adapter does not match the selected provider');
  }
  invariant = INSTALLATION_INVARIANTS.METADATA;
  if (receipt.descriptor_sha256 !== hash(descriptor.bytes)) throw new Error('installed descriptor hash does not match');
  if (readInside(root, path.join(spireRoot, 'version'), 'utf8') !== `${receipt.version}\n`) {
    throw new Error('installed version does not match the receipt');
  }
  invariant = INSTALLATION_INVARIANTS.PROVIDER;
  validateProviderCapabilities(selected, provider);
  invariant = INSTALLATION_INVARIANTS.ARTIFACT;
  validateArtifacts(root, receipt, provider, selected, selectedAscent);
  invariant = INSTALLATION_INVARIANTS.PROVIDER;
  validateProviderConfig(root, selected, provider);
  invariant = INSTALLATION_INVARIANTS.UNKNOWN;
  inspectContained(root, path.join(root, ...DESCRIPTOR.state_root.split('/')), { leaf: 'directory' });
  return { receipt, catalog: catalog.value, state: descriptor.value, provider, selected, ascent: { ...ascent, selected_ascent: selectedAscent } };
  } catch (error) {
    if (error instanceof ProviderMismatchError) throw error;
    throw new InstallationInvariantError(invariant);
  }
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

// Decomposed at the first mutating call (spire.mjs:607 in the pre-decomposition numbering), not
// at the old function boundary: prepareSelection is every check that can run before any byte
// moves — including the :606 destination-hardlink/non-regular-destination guard
// (inspectSelectionTarget) — and commitSelection is everything from fs.mkdirSync onward. Check
// mode runs prepareSelection and stops; run mode runs both, from the same try/catch, so a throw
// from either phase maps to the identical INVALID_INSTALLATION refusal in both modes. See
// CHANGE_SPEC.md (doctor-selectability) §2.2 for why the boundary is not a skip-the-call design.
function prepareSelection(root, validated, ascent) {
  const provider = validated.selected.name;
  const expectedAdapter = launchAdapterFor(provider, ascent);
  if (!ASCENTS[DESCRIPTOR.id].includes(ascent)) throw new Error('selection ascent is not canonical');
  const selection = {
    schema_version: 1,
    selected_at: new Date().toISOString(),
    cluster: DESCRIPTOR.id,
    ascent,
    provider,
    adapter: expectedAdapter,
  };
  if (!sameCanonicalValue(selection.adapter, expectedAdapter)) throw new Error('selection adapter is not canonical');
  const destination = path.join(root, ...DESCRIPTOR.state_root.split('/'), 'receipts', 'selection.json');
  const parent = path.dirname(destination);
  inspectSelectionTarget(root, destination);
  return { selection, destination, parent };
}

function commitSelection(root, plan) {
  const { selection, destination, parent } = plan;
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
    return refusal('INVALID_INSTALLATION', `installed Spire state at '${root}' is unsafe`, USAGE_HINTS.INVALID_INSTALLATION);
  }
  const installationFile = path.join(root, '.spire', 'installation.json');
  if (!fs.existsSync(installationFile)) {
    return refusal('NOT_INSTALLED', `no complete Spire installation exists at '${root}'`, USAGE_HINTS.NOT_INSTALLED);
  }
  let validated;
  try {
    validated = validateInstallation(root, parsed.provider, parsed.ascent);
  } catch (error) {
    if (error instanceof ProviderMismatchError) {
      return refusal(
        'PROVIDER_MISMATCH',
        `requested provider '${error.requested}' does not match installed provider${error.installed.length > 1 ? 's' : ''} '${error.installed.join(', ')}'`,
        USAGE_HINTS.PROVIDER_MISMATCH,
      );
    }
    const invariant = error instanceof InstallationInvariantError
      ? error.invariant
      : INSTALLATION_INVARIANTS.UNKNOWN;
    return refusal(
      'INVALID_INSTALLATION',
      `installed Spire state at '${root}' violates ${invariant}`,
      USAGE_HINTS.INVALID_INSTALLATION,
    );
  }
  const installation = validated.receipt;
  const catalog = validated.catalog;
  const cluster = parsed.selector === 'tech' ? 'spire:tech' : parsed.selector;
  const entry = catalog.clusters.find((candidate) => candidate.id === cluster);
  if (!entry) return refusal('UNKNOWN_CLUSTER', `unknown cluster '${parsed.selector}'`, USAGE_HINTS.UNKNOWN_CLUSTER);
  if (entry.availability !== 'available' || entry.executable !== true) {
    return refusal(
      'CLUSTER_UNAVAILABLE',
      `cluster '${cluster}' is ${entry.availability} and cannot run`,
      USAGE_HINTS.CLUSTER_UNAVAILABLE,
    );
  }
  if (cluster !== DESCRIPTOR.id || installation.cluster !== cluster) {
    return refusal(
      'INVALID_INSTALLATION',
      `installed cluster '${installation.cluster}' does not match '${cluster}'`,
      USAGE_HINTS.INVALID_INSTALLATION,
    );
  }
  // An unrequested ascent falls back to the consumer's recorded default, never to a kit default.
  // Unknown to this kit version and known-but-absent from the receipt are distinct refusals.
  const ascent = parsed.ascent ?? validated.ascent.default_ascent;
  if (!(ASCENTS[cluster] ?? []).includes(ascent)) {
    return refusal('UNKNOWN_ASCENT', `unknown ascent '${ascent}' for cluster '${cluster}'`, USAGE_HINTS.UNKNOWN_ASCENT);
  }
  if (!validated.ascent.ascents.includes(ascent)) {
    return refusal(
      'ASCENT_NOT_INSTALLED',
      `ascent '${ascent}' is not installed at '${root}'`,
      USAGE_HINTS.ASCENT_NOT_INSTALLED,
    );
  }
  // Provider resolution already happened during validation, which fails closed on an
  // uninstalled provider — there is no fallback to the default.
  try {
    const plan = prepareSelection(root, validated, ascent);
    if (!parsed.check) commitSelection(root, plan);
  } catch {
    return refusal('INVALID_INSTALLATION', `selection receipt path at '${root}' is unsafe`, USAGE_HINTS.INVALID_INSTALLATION);
  }
  return { ok: true, cluster, ascent, provider: validated.selected.name, root };
}

function emit(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.ok ? 0 : (ERROR_STATUS[result.error] ?? 1);
  }
  if (result.ok) {
    process.stdout.write(`selected ${result.cluster} ${result.ascent} for ${result.provider} at ${result.root}\n`);
    return 0;
  }
  process.stderr.write(`spire: ${result.message}\n`);
  if (result.hint) process.stderr.write(`hint: ${result.hint}\n`);
  return ERROR_STATUS[result.error] ?? 1;
}

const parsed = parseArgs(process.argv.slice(2));
const result = parsed.finding ?? select(parsed.parsed);
process.exitCode = emit(result, parsed.parsed?.json === true || process.argv.includes('--json'));
