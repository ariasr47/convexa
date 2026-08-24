import crypto from 'node:crypto';

function number(value) {
  if (!Number.isFinite(value)) throw new TypeError('non-finite number');
  return JSON.stringify(value);
}

function encode(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') return number(value);
  if (Array.isArray(value)) return `[${value.map(encode).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${encode(value[key])}`).join(',')}}`;
  }
  throw new TypeError('unsupported canonical value');
}

export function canonicalBytes(value) {
  return Buffer.from(encode(value), 'utf8');
}
export function canonicalSha256(value) {
  return crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
}
export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
