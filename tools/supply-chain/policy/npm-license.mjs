import crypto from 'node:crypto';
import zlib from 'node:zlib';

const LICENSE_HASHES = Object.freeze({
  ce5a6467d5e685e6c6ce90ea94dd5764ce16aa5b0332803c1f0411e6cc682d36: {
    expression: 'MIT',
    template_id: 'mit-union-0.5.0',
  },
});

export async function inspectLicenseInventory(
  lock,
  lockSha256,
  { fetchTarball = defaultFetch } = {},
) {
  if (!lock?.packages || typeof lock.packages !== 'object')
    throw new TypeError('invalid package lock');
  const rows = [],
    violations = [];
  for (const [packagePath, pkg] of Object.entries(lock.packages)) {
    if (!packagePath || pkg.link || !packagePath.includes('node_modules/')) continue;
    const name = packageName(packagePath);
    if (!name || typeof pkg.version !== 'string') {
      violations.push({ rule_id: 'license-identity', package_path: packagePath });
      continue;
    }
    let observed;
    if (typeof pkg.license === 'string') {
      try {
        observed = {
          state: 'pass',
          expression: normalizeSpdx(pkg.license),
          evidence_kind: 'lock_metadata',
          evidence_sha256: null,
          template_id: null,
        };
      } catch {
        observed = { state: 'fail', rule_id: 'license-expression' };
      }
    } else {
      try {
        const tarball = await fetchTarball(pkg.resolved);
        observed = detectLicenseFromTarball({
          tarballBytes: tarball,
          integrity: pkg.integrity,
          metadataLicense: null,
        });
      } catch {
        observed = { state: 'blocked', rule_id: 'license-tarball-unavailable' };
      }
    }
    if (observed.state !== 'pass') {
      violations.push({
        rule_id: observed.rule_id,
        ecosystem: 'npm',
        name,
        version: pkg.version,
        state: observed.state,
      });
      continue;
    }
    rows.push({
      ecosystem: 'npm',
      name,
      version: pkg.version,
      expression: observed.expression,
      origin_lock_sha256: lockSha256,
      obligation: null,
      evidence_kind: observed.evidence_kind,
      evidence_sha256: observed.evidence_sha256,
      template_id: observed.template_id,
    });
  }
  const unique = [];
  for (const row of rows.sort(compareRows)) {
    const prior = unique.at(-1);
    if (prior && compareRows(prior, row) === 0) {
      if (JSON.stringify(prior) !== JSON.stringify(row))
        violations.push({
          rule_id: 'license-duplicate-conflict',
          ecosystem: 'npm',
          name: row.name,
          version: row.version,
          state: 'fail',
        });
    } else unique.push(row);
  }
  violations.sort(compareRows);
  return { rows: unique, violations };
}

export function detectLicenseFromTarball({ tarballBytes, integrity, metadataLicense = null }) {
  if (!Buffer.isBuffer(tarballBytes) || !verifySri(tarballBytes, integrity))
    return { state: 'fail', rule_id: 'license-tarball-integrity' };
  let entries;
  try {
    entries = readNpmTarball(tarballBytes);
  } catch {
    return { state: 'fail', rule_id: 'license-tarball-malformed' };
  }
  const candidates = entries.filter((x) =>
    /^package\/(?:licen[cs]e|copying)(?:\.[a-z0-9]+)?$/i.test(x.name),
  );
  if (candidates.length !== 1)
    return {
      state: 'fail',
      rule_id: candidates.length ? 'license-file-ambiguous' : 'license-file-missing',
    };
  const evidenceSha256 = sha256(candidates[0].data),
    match = LICENSE_HASHES[evidenceSha256];
  if (!match)
    return { state: 'fail', rule_id: 'license-file-unknown', evidence_sha256: evidenceSha256 };
  if (metadataLicense !== null) {
    let metadata;
    try {
      metadata = normalizeSpdx(metadataLicense);
    } catch {
      return { state: 'fail', rule_id: 'license-metadata-malformed' };
    }
    if (metadata !== match.expression)
      return { state: 'fail', rule_id: 'license-metadata-file-conflict' };
  }
  return {
    state: 'pass',
    expression: match.expression,
    evidence_kind: 'integrity_verified_license_file',
    evidence_sha256: evidenceSha256,
    template_id: match.template_id,
  };
}

export async function inventoryFromLock(lock, lockSha256, options) {
  const result = await inspectLicenseInventory(lock, lockSha256, options);
  if (result.violations.length)
    throw new TypeError(
      `license inventory unresolved: ${result.violations[0].name ?? result.violations[0].package_path}`,
    );
  return result.rows;
}

export function checkLicenseBaseline(inventory, baseline, { now = new Date() } = {}) {
  if (!Array.isArray(inventory) || !Array.isArray(baseline)) return blocked('license-input');
  const key = (x) => `${x.ecosystem}:${x.name}@${x.version}`;
  if ([...inventory, ...baseline].some((x) => !validRow(x))) return blocked('license-row');
  const current = new Map(inventory.map((x) => [key(x), x])),
    recorded = new Map(baseline.map((x) => [key(x), x]));
  if (current.size !== inventory.length || recorded.size !== baseline.length)
    return blocked('license-duplicate');
  let count = 0;
  for (const [id, row] of current) {
    const old = recorded.get(id);
    if (
      !old ||
      old.expression !== row.expression ||
      old.origin_lock_sha256 !== row.origin_lock_sha256 ||
      old.obligation !== row.obligation ||
      old.evidence_kind !== row.evidence_kind ||
      old.evidence_sha256 !== row.evidence_sha256 ||
      old.template_id !== row.template_id
    )
      count++;
  }
  for (const id of recorded.keys()) if (!current.has(id)) count++;
  if (count) return { state: 'fail', rule_id: 'license-continuity', completion: 'complete', count };
  const obligations = inventory.filter((row) => row.obligation !== null);
  if (obligations.some((row) => !validObligation(row.obligation, now)))
    return {
      state: 'fail',
      rule_id: 'license-obligation-accountability',
      completion: 'complete',
      count: 1,
    };
  return {
    state: obligations.length ? 'pass_with_advisories' : 'pass',
    rule_id: obligations.length ? 'license-obligation-review' : 'license-continuity-pass',
    completion: 'complete',
    count: obligations.length,
  };
}

function readNpmTarball(bytes) {
  const tar = zlib.gunzipSync(bytes),
    entries = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((x) => x === 0)) break;
    const name = field(header, 0, 100),
      prefix = field(header, 345, 155),
      member = prefix ? `${prefix}/${name}` : name,
      type = String.fromCharCode(header[156] || 48),
      size = octal(header, 124, 12);
    if (!member.startsWith('package/') || member.includes('..') || member.includes('\\'))
      throw new TypeError('unsafe npm tar');
    const start = offset + 512,
      end = start + size;
    if (end > tar.length) throw new TypeError('truncated npm tar');
    if (type === '0') entries.push({ name: member, data: tar.subarray(start, end) });
    else if (type !== '5') throw new TypeError('unsupported npm tar member');
    offset = start + Math.ceil(size / 512) * 512;
  }
  return entries;
}
function verifySri(bytes, sri) {
  if (typeof sri !== 'string') return false;
  const match = sri.match(/^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  const actual = crypto.createHash(match[1]).update(bytes).digest(),
    expected = Buffer.from(match[2], 'base64');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function validRow(x) {
  return (
    x &&
    ['npm', 'cargo'].includes(x.ecosystem) &&
    typeof x.name === 'string' &&
    typeof x.version === 'string' &&
    typeof x.expression === 'string' &&
    (x.obligation === null || typeof x.obligation === 'object') &&
    /^[0-9a-f]{64}$/.test(x.origin_lock_sha256 ?? '') &&
    ['lock_metadata', 'integrity_verified_license_file', 'cargo_metadata'].includes(
      x.evidence_kind,
    ) &&
    ((x.evidence_kind === 'integrity_verified_license_file' &&
      /^[0-9a-f]{64}$/.test(x.evidence_sha256 ?? '') &&
      typeof x.template_id === 'string') ||
      (x.evidence_kind !== 'integrity_verified_license_file' &&
        x.evidence_sha256 === null &&
        x.template_id === null))
  );
}
function validObligation(value, now) {
  if (
    !value ||
    Object.keys(value).sort().join(',') !== 'action_code,evidence_ref,expires_at,owner_id,review_at'
  )
    return false;
  if (
    !['action_code', 'evidence_ref', 'owner_id'].every(
      (key) => typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 128,
    )
  )
    return false;
  const review = Date.parse(value.review_at),
    expires = Date.parse(value.expires_at);
  return (
    Number.isFinite(review) &&
    Number.isFinite(expires) &&
    review <= expires &&
    expires > now.getTime()
  );
}
function normalizeSpdx(value) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    /[\r\n\x00-\x1f]/.test(value)
  )
    throw new TypeError('missing or malformed SPDX expression');
  if (!/^[A-Za-z0-9.+() -]+(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9.+() -]+)*$/.test(value))
    throw new TypeError('unparseable SPDX expression');
  return value.replace(/\s+/g, ' ').trim();
}
async function defaultFetch(url) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hostname !== 'registry.npmjs.org'
  )
    throw new TypeError('unsafe npm tarball URL');
  const response = await fetch(parsed, { redirect: 'error' });
  if (!response.ok) throw new Error('npm tarball unavailable');
  return Buffer.from(await response.arrayBuffer());
}
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const field = (buffer, offset, length) =>
  buffer
    .subarray(offset, offset + length)
    .toString('utf8')
    .replace(/\0.*$/, '');
const octal = (buffer, offset, length) => {
  const value = field(buffer, offset, length).trim();
  if (!/^[0-7]+$/.test(value)) throw new TypeError('npm tar numeric');
  return Number.parseInt(value, 8);
};
const packageName = (packagePath) =>
  packagePath.slice(packagePath.lastIndexOf('node_modules/') + 'node_modules/'.length);
const compareRows = (a, b) =>
  `${a.ecosystem}:${a.name ?? a.package_path}@${a.version ?? ''}`.localeCompare(
    `${b.ecosystem}:${b.name ?? b.package_path}@${b.version ?? ''}`,
  );
const blocked = (rule_id) => ({ state: 'blocked', rule_id, completion: 'malformed', count: 0 });
