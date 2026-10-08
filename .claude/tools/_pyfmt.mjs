// _pyfmt.mjs — the three output formats the gate tools share. Stdlib only.
//
// These formats originated as byte-parity with the Python gates this kit was ported from, but that
// parity gate has EXPIRED and is not a live constraint: the port plan marked its parity corpus test
// temporary and that test no longer exists, the Python backend is a retired phrase in this kit's
// manifest, and no interpreter-side counterpart remains. Nothing is being kept in step with
// anything.
//
// What IS still binding is the behaviour itself, because these bytes are observable: written
// artifacts (council_conflicts.mjs writes conflicts.json through writeJsonAscii) and console output
// carry these exact shapes. Change a format here only for a stated reason, not to make it look more
// idiomatic.
//
// Comments below and in the consuming tools that mention Python are HISTORICAL RATIONALE — they
// record why a behaviour is shaped the way it is. They are not a requirement to match a running
// Python program, and no such program exists to diverge from.

/** repr-style rendering of a JSON.parse value (str/num/bool/null/list/dict). */
export function formatValue(v) {
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    // Python: single quotes, unless the string contains ' and not ".
    const q = v.includes("'") && !v.includes('"') ? '"' : "'";
    let body = v.replace(/\\/g, '\\\\');
    if (q === "'") body = body.replace(/'/g, "\\'");
    body = body.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    return q + body + q;
  }
  if (Array.isArray(v)) return '[' + v.map(formatValue).join(', ') + ']';
  return '{' + Object.entries(v).map(([k, x]) => `${formatValue(k)}: ${formatValue(x)}`).join(', ') + '}';
}

/** JSON with the given indent, every non-ASCII codepoint escaped. The escaping is deliberate
 *  and observable — conflicts.json is written through this. */
export function writeJsonAscii(obj, indent = 2) {
  return JSON.stringify(obj, null, indent).replace(
    /[\u007f-\uffff]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

/** Round to a whole number, half-to-even. Domain here: x >= 0 (percentages). */
export function roundHalfEven(x) {
  const floor = Math.floor(x);
  const frac = x - floor;
  if (frac > 0.5) return String(floor + 1);
  if (frac < 0.5) return String(floor);
  return String(floor % 2 === 0 ? floor : floor + 1);
}
