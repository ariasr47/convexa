import path from 'node:path';
import { canonicalBytes, canonicalSha256, sha256 } from './lib/canonical.mjs';

const FAMILIES = new Set(['convexa-workspace', 'cargo-normal-build', 'npm-production-closure']);
const ECOSYSTEMS = new Set(['cargo', 'npm']);
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]{1,512}$/u;
const HEX64 = /^[0-9a-f]{64}$/;

export function normalizeComponent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('component-object-required');
  if (Object.keys(value).sort().join(',') !== 'ecosystem,family,name,provenance,version')
    throw new TypeError('component-fields');
  if (!FAMILIES.has(value.family) || !ECOSYSTEMS.has(value.ecosystem))
    throw new TypeError('component-domain');
  for (const field of ['name', 'version'])
    if (typeof value[field] !== 'string' || !SAFE_TEXT.test(value[field]))
      throw new TypeError(`component-${field}`);
  const p = value.provenance;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new TypeError('component-provenance');
  if (Object.keys(p).sort().join(',') !== 'integrity,kind,manifest_sha256,path,source')
    throw new TypeError('provenance-fields');
  if (p.kind === 'registry') {
    if (typeof p.source !== 'string' || !SAFE_TEXT.test(p.source) || hasCredentials(p.source))
      throw new TypeError('registry-source');
    if (
      typeof p.integrity !== 'string' ||
      !SAFE_TEXT.test(p.integrity) ||
      p.path !== null ||
      p.manifest_sha256 !== null
    )
      throw new TypeError('registry-provenance');
  } else if (p.kind === 'workspace') {
    if (
      p.source !== 'workspace' ||
      p.integrity !== null ||
      !safeRepoPath(p.path) ||
      !HEX64.test(p.manifest_sha256)
    )
      throw new TypeError('workspace-provenance');
  } else throw new TypeError('provenance-kind');
  return {
    family: value.family,
    ecosystem: value.ecosystem,
    name: value.name,
    version: value.version,
    provenance: {
      kind: p.kind,
      source: p.source,
      integrity: p.integrity,
      path: p.path,
      manifest_sha256: p.manifest_sha256,
    },
  };
}

export function componentIdentity(value) {
  return normalizeComponent(value);
}
export function componentSetHash(values) {
  const normalized = uniqueComponents(values);
  normalized.sort((a, b) => Buffer.compare(canonicalBytes(a), canonicalBytes(b)));
  return canonicalSha256(normalized);
}
export function bomRef(identity) {
  return `urn:convexa:component:sha256:${canonicalSha256(normalizeComponent(identity))}`;
}
export function compareComponents(expected, actual) {
  try {
    if (
      !Array.isArray(expected) ||
      !Array.isArray(actual) ||
      expected.length === 0 ||
      actual.length === 0
    )
      return false;
    const e = uniqueComponents(expected),
      a = uniqueComponents(actual);
    return e.length === a.length && componentSetHash(e) === componentSetHash(a);
  } catch {
    return false;
  }
}

export function deriveNpmComponents({ lock, workspaceManifests }) {
  if (!lock || lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object')
    throw new TypeError('npm-lock-v3-required');
  if (!workspaceManifests || typeof workspaceManifests !== 'object')
    throw new TypeError('workspace-manifests-required');
  const packages = lock.packages,
    roots = new Set(['apps/dashboard', 'libs/api']),
    root = packages[''];
  if (!root || !root.dependencies) throw new TypeError('root-production-dependencies-required');
  const queue = [
      ...roots,
      ...Object.keys(root.dependencies).map((name) => resolveNpmPackageKey('', name, packages)),
    ],
    visited = new Set(),
    components = [];
  while (queue.length) {
    const key = queue.shift();
    if (!key || visited.has(key)) continue;
    visited.add(key);
    const pkg = packages[key];
    if (!pkg) throw new TypeError(`npm-package-missing:${key}`);
    if (pkg.link) {
      const target = normalizePath(pkg.resolved);
      if (!roots.has(target)) throw new TypeError(`npm-workspace-out-of-scope:${target}`);
      queue.push(target);
      continue;
    }
    const workspace = roots.has(key),
      manifest = workspaceManifests[key],
      name = pkg.name ?? packageNameFromKey(key);
    if (!name || !pkg.version) throw new TypeError(`npm-identity-missing:${key}`);
    if (workspace) {
      if (
        !manifest ||
        !Buffer.isBuffer(manifest.bytes) ||
        normalizePath(manifest.path) !== `${key}/package.json`
      )
        throw new TypeError(`workspace-manifest-missing:${key}`);
      components.push({
        family: 'convexa-workspace',
        ecosystem: 'npm',
        name,
        version: pkg.version,
        provenance: {
          kind: 'workspace',
          source: 'workspace',
          integrity: null,
          path: normalizePath(manifest.path),
          manifest_sha256: sha256(manifest.bytes),
        },
      });
    } else {
      if (
        typeof pkg.resolved !== 'string' ||
        !pkg.resolved.startsWith('https://registry.npmjs.org/') ||
        typeof pkg.integrity !== 'string'
      )
        throw new TypeError(`npm-provenance:${key}`);
      components.push({
        family: 'npm-production-closure',
        ecosystem: 'npm',
        name,
        version: pkg.version,
        provenance: {
          kind: 'registry',
          source: pkg.resolved,
          integrity: pkg.integrity,
          path: null,
          manifest_sha256: null,
        },
      });
    }
    for (const dep of Object.keys(pkg.dependencies ?? {}))
      queue.push(resolveNpmPackageKey(key, dep, packages));
  }
  requireSeeds(components, [
    '@convexa/dashboard',
    '@convexa/api',
    'react',
    'react-dom',
    'react-router-dom',
    '@mui/material',
    '@emotion/react',
    'recharts',
    'openapi-fetch',
  ]);
  return uniqueComponents(components);
}

export function deriveCargoComponents({ metadata, repoRoot, manifestBytes, lockText }) {
  if (!metadata?.resolve?.nodes || !Array.isArray(metadata.packages))
    throw new TypeError('cargo-metadata-required');
  const packages = new Map(metadata.packages.map((p) => [p.id, p])),
    nodes = new Map(metadata.resolve.nodes.map((n) => [n.id, n])),
    lockIndex = lockText === undefined ? null : parseCargoLock(lockText);
  const root = metadata.packages.find((p) => p.name === 'api-rust' && p.version === '0.1.0');
  if (!root) throw new TypeError('cargo-root-missing');
  const queue = [root.id],
    visited = new Set(),
    components = [];
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const pkg = packages.get(id),
      node = nodes.get(id);
    if (!pkg || !node) throw new TypeError(`cargo-node-missing:${id}`);
    const workspace = metadata.workspace_members?.includes(id) === true;
    if (workspace) {
      const rel = normalizePath(path.relative(repoRoot, pkg.manifest_path)),
        bytes = manifestBytes?.[rel];
      if (!safeRepoPath(rel) || !Buffer.isBuffer(bytes))
        throw new TypeError(`cargo-workspace-manifest:${rel}`);
      components.push({
        family: 'convexa-workspace',
        ecosystem: 'cargo',
        name: pkg.name,
        version: pkg.version,
        provenance: {
          kind: 'workspace',
          source: 'workspace',
          integrity: null,
          path: rel,
          manifest_sha256: sha256(bytes),
        },
      });
    } else {
      const checksum = pkg.checksum ?? lockIndex?.get(`${pkg.name}\0${pkg.version}\0${pkg.source}`);
      if (typeof pkg.source !== 'string' || typeof checksum !== 'string')
        throw new TypeError(`cargo-provenance:${id}`);
      components.push({
        family: 'cargo-normal-build',
        ecosystem: 'cargo',
        name: pkg.name,
        version: pkg.version,
        provenance: {
          kind: 'registry',
          source: pkg.source,
          integrity: checksum,
          path: null,
          manifest_sha256: null,
        },
      });
    }
    for (const dep of node.deps ?? [])
      if (
        (dep.dep_kinds ?? []).some(
          (k) => k.kind === null || k.kind === 'normal' || k.kind === 'build',
        )
      )
        queue.push(dep.pkg);
  }
  requireSeeds(components, ['api-rust', 'quant-engine', 'axum', 'tokio', 'sqlx', 'reqwest']);
  return uniqueComponents(components);
}

export function requiredSeedsPresent(components, seeds) {
  const names = new Set(components.map((c) => c.name));
  return Array.isArray(seeds) && seeds.length > 0 && seeds.every((seed) => names.has(seed));
}
function requireSeeds(components, seeds) {
  if (!requiredSeedsPresent(components, seeds)) throw new TypeError('required-seed-missing');
}
function uniqueComponents(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError('components-required');
  const out = values.map(normalizeComponent),
    seen = new Set();
  for (const value of out) {
    const key = canonicalSha256(value);
    if (seen.has(key)) throw new TypeError('duplicate-component');
    seen.add(key);
  }
  return out;
}
function resolveNpmPackageKey(fromKey, name, packages) {
  let base = fromKey;
  if (base.startsWith('node_modules/')) base = '';
  else if (base.includes('/node_modules/'))
    base = base.slice(0, base.lastIndexOf('/node_modules/'));
  while (true) {
    const candidate = normalizePath(path.posix.join(base, 'node_modules', name));
    if (packages[candidate]) return candidate;
    if (!base) break;
    base = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : '';
  }
  const link = Object.entries(packages).find(
    ([, p]) =>
      p?.name === name && ['apps/dashboard', 'libs/api'].includes(normalizePath(p.resolved ?? '')),
  );
  if (link) return link[0];
  throw new TypeError(`npm-dependency-unresolved:${name}`);
}
function packageNameFromKey(key) {
  const parts = key.split('node_modules/').at(-1)?.split('/');
  return parts?.[0]?.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts?.[0];
}
function normalizePath(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '');
}
function safeRepoPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.split('/').some((x) => !x || x === '.' || x === '..')
  );
}
function hasCredentials(value) {
  try {
    const u = new URL(value.replace(/^registry\+/, ''));
    return Boolean(u.username || u.password || u.search);
  } catch {
    return true;
  }
}
function parseCargoLock(text) {
  if (typeof text !== 'string' || !/^version\s*=\s*[34]\s*$/m.test(text))
    throw new TypeError('cargo-lock-version');
  const index = new Map();
  for (const block of text.split(/^\[\[package\]\]\s*$/m).slice(1)) {
    const name = tomlString(block, 'name'),
      version = tomlString(block, 'version'),
      source = tomlString(block, 'source', false),
      checksum = tomlString(block, 'checksum', false);
    if (source && checksum) {
      const key = `${name}\0${version}\0${source}`;
      if (index.has(key)) throw new TypeError('cargo-lock-duplicate');
      index.set(key, checksum);
    }
  }
  return index;
}
function tomlString(block, key, required = true) {
  const match = block.match(new RegExp(`^${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`, 'm'));
  if (!match) {
    if (required) throw new TypeError(`cargo-lock-${key}`);
    return null;
  }
  return JSON.parse(match[1]);
}
