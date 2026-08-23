import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BLOCK = 512;

export async function archiveDirectory(root, prefix = 'dist') {
  const files = [];
  async function walk(dir, rel = '') {
    for (const name of await fsp.readdir(dir)) {
      const full = path.join(dir, name),
        child = path.posix.join(rel, name),
        st = await fsp.lstat(full);
      if (st.isSymbolicLink()) throw new TypeError('archive-link');
      if (st.isDirectory()) await walk(full, child);
      else if (st.isFile())
        files.push({ name: path.posix.join(prefix, child), data: await fsp.readFile(full) });
      else throw new TypeError('archive-special-member');
    }
  }
  await walk(root);
  if (!files.length) throw new TypeError('archive-empty');
  const directories = new Set();
  for (const file of files) {
    let parent = path.posix.dirname(file.name);
    while (parent !== '.' && parent !== prefix) {
      directories.add(`${parent}/`);
      parent = path.posix.dirname(parent);
    }
    directories.add(`${prefix}/`);
  }
  const entries = [...directories]
    .map((name) => ({ name, dir: true, data: Buffer.alloc(0) }))
    .concat(files.map((x) => ({ ...x, dir: false })))
    .sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));
  const blocks = [];
  for (const entry of entries) {
    const header = makeHeader(entry.name, entry.dir, entry.data.length);
    blocks.push(header, entry.data, Buffer.alloc((BLOCK - (entry.data.length % BLOCK)) % BLOCK));
  }
  const bytes = Buffer.concat([...blocks, Buffer.alloc(BLOCK * 2)]);
  return { bytes, digest: crypto.createHash('sha256').update(bytes).digest('hex') };
}

export function parseTar(bytes, { requiredPrefix = 'dist/', strict = true } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length < BLOCK * 2 || bytes.length % BLOCK !== 0)
    throw new TypeError('tar-length');
  const entries = [],
    seen = new Set();
  let offset = 0,
    zeroBlocks = 0;
  while (offset < bytes.length) {
    const header = bytes.subarray(offset, offset + BLOCK);
    if (header.every((x) => x === 0)) {
      zeroBlocks++;
      offset += BLOCK;
      if (zeroBlocks === 2) break;
      continue;
    }
    if (zeroBlocks) throw new TypeError('tar-data-after-zero');
    if (!validChecksum(header)) throw new TypeError('tar-checksum');
    if (
      header.subarray(257, 263).toString('ascii') !== 'ustar\0' ||
      header.subarray(263, 265).toString('ascii') !== '00'
    )
      throw new TypeError('tar-format');
    const name = decodeField(header.subarray(0, 100));
    const prefix = decodeField(header.subarray(345, 500));
    const member = prefix ? `${prefix}/${name}` : name;
    const type = String.fromCharCode(header[156] || 48),
      size = parseOctal(header.subarray(124, 136)),
      mode = parseOctal(header.subarray(100, 108));
    const uid = parseOctal(header.subarray(108, 116)),
      gid = parseOctal(header.subarray(116, 124)),
      mtime = parseOctal(header.subarray(136, 148));
    if (!safeMember(member, requiredPrefix) || seen.has(member))
      throw new TypeError('tar-member-path');
    seen.add(member);
    if (
      strict &&
      (uid !== 0 ||
        gid !== 0 ||
        mtime !== 0 ||
        decodeField(header.subarray(265, 297)) ||
        decodeField(header.subarray(297, 329)))
    )
      throw new TypeError('tar-header-identity');
    const directory = type === '5';
    if (!directory && type !== '0') throw new TypeError('tar-member-type');
    if (
      strict &&
      (directory
        ? mode !== 0o755 || size !== 0 || !member.endsWith('/')
        : mode !== 0o644 || member.endsWith('/'))
    )
      throw new TypeError('tar-member-mode');
    const dataStart = offset + BLOCK,
      dataEnd = dataStart + size,
      padded = dataStart + Math.ceil(size / BLOCK) * BLOCK;
    if (dataEnd > bytes.length || padded > bytes.length) throw new TypeError('tar-size');
    entries.push({
      name: member,
      type: directory ? 'directory' : 'file',
      size,
      sha256: directory
        ? null
        : crypto.createHash('sha256').update(bytes.subarray(dataStart, dataEnd)).digest('hex'),
      data: bytes.subarray(dataStart, dataEnd),
    });
    offset = padded;
  }
  if (zeroBlocks < 2 || offset !== bytes.length) throw new TypeError('tar-terminator');
  if (!entries.some((e) => e.type === 'file')) throw new TypeError('tar-empty');
  const names = entries.map((e) => e.name);
  const sorted = [...names].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  if (strict && names.some((name, i) => name !== sorted[i])) throw new TypeError('tar-order');
  return entries;
}

export function validateTar(bytes) {
  try {
    const entries = parseTar(bytes);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'convexa-tar-'));
    try {
      for (const entry of entries) {
        const destination = path.join(temp, ...entry.name.split('/').filter(Boolean));
        const resolved = path.resolve(destination);
        if (!resolved.startsWith(`${path.resolve(temp)}${path.sep}`))
          throw new TypeError('tar-extraction-path');
        if (entry.type === 'directory') fs.mkdirSync(resolved, { recursive: true, mode: 0o755 });
        else {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, entry.data, { mode: 0o644, flag: 'wx' });
          const actual = crypto
            .createHash('sha256')
            .update(fs.readFileSync(resolved))
            .digest('hex');
          if (actual !== entry.sha256) throw new TypeError('tar-extraction-hash');
        }
      }
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
    return {
      state: 'pass',
      rule_id: 'tar-safe',
      completion: 'complete',
      member_count: entries.length,
      file_count: entries.filter((e) => e.type === 'file').length,
      archive_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      file_set_sha256: crypto
        .createHash('sha256')
        .update(
          JSON.stringify(
            entries
              .filter((e) => e.type === 'file')
              .map(({ name, size, sha256 }) => ({ name, size, sha256 })),
          ),
        )
        .digest('hex'),
    };
  } catch (error) {
    return {
      state: 'blocked',
      rule_id: String(error.message).startsWith('tar-') ? error.message : 'tar-invalid',
      completion: 'malformed',
    };
  }
}

function makeHeader(name, directory, size) {
  const nameBytes = Buffer.from(name);
  if (nameBytes.length > 100 || !safeMember(name, 'dist/')) throw new TypeError('tar-member-path');
  const h = Buffer.alloc(BLOCK);
  nameBytes.copy(h, 0);
  writeOctal(h, 100, 8, directory ? 0o755 : 0o644);
  writeOctal(h, 108, 8, 0);
  writeOctal(h, 116, 8, 0);
  writeOctal(h, 124, 12, size);
  writeOctal(h, 136, 12, 0);
  h.fill(32, 148, 156);
  h[156] = directory ? 53 : 48;
  h.write('ustar\0', 257, 6, 'ascii');
  h.write('00', 263, 2, 'ascii');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return h;
}
function writeOctal(buffer, offset, length, value) {
  buffer.write(`${value.toString(8).padStart(length - 1, '0')}\0`, offset, length, 'ascii');
}
function parseOctal(buffer) {
  const value = decodeField(buffer).trim();
  if (!/^[0-7]*$/.test(value)) throw new TypeError('tar-numeric-field');
  return value ? Number.parseInt(value, 8) : 0;
}
function decodeField(buffer) {
  const end = buffer.indexOf(0);
  const slice = buffer.subarray(0, end === -1 ? buffer.length : end);
  const value = new TextDecoder('utf-8', { fatal: true }).decode(slice);
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError('tar-text-field');
  return value;
}
function validChecksum(header) {
  const stored = parseOctal(header.subarray(148, 156));
  const copy = Buffer.from(header);
  copy.fill(32, 148, 156);
  let sum = 0;
  for (const b of copy) sum += b;
  return stored === sum;
}
function safeMember(name, prefix) {
  if (
    typeof name !== 'string' ||
    !name.startsWith(prefix) ||
    name.startsWith('/') ||
    name.includes('\\')
  )
    return false;
  const trimmed = name.endsWith('/') ? name.slice(0, -1) : name;
  return trimmed.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}
