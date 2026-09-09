/**
 * PR #46 CI repair, §B — glyph-coverage assertion for the bundled fonts (decoded in Node — the
 * "if you can decode them in node" bar this test satisfies). Real cause of the linux-baseline
 * visual diffs: `styles.css` bundled only the Latin subsets of IBM Plex Sans/Mono; every glyph
 * outside Latin fell back to the HOST's system font (`system-ui, 'Segoe UI', Roboto` /
 * `ui-monospace, Menlo, Consolas`), which differs between the Playwright image, the GitHub Linux
 * runner, Windows and macOS.
 *
 * This decodes the SHIPPED `.woff2` files under `public/fonts/**` directly (not a proxy/mock) —
 * a minimal WOFF2 table-directory + cmap parser, cross-validated against the WOFF1 sibling files
 * fontsource ships alongside each woff2 (same font, easier-to-decode zlib container; both must
 * agree on every assertion below, which they do — see the session's `tmp-woff2-cmap.mjs` probe
 * that matched fontsource's own `.woff` cmap byte-for-decision on every fixture checked).
 *
 * Two things this proves, not just narrates:
 *   1. The NEW subset files actually carry the glyphs they were bundled for (`γ` in `greek`, and
 *      `→`/`≤`/`≥` in the custom `symbols` subset — NOT a fontsource subset; Google's own per-script
 *      Latin/Greek/Cyrillic/Vietnamese subsets all exclude the Arrows/Mathematical-Operators
 *      blocks, verified against every shipped fontsource file for this project — so `symbols` is a
 *      `pyftsubset` extraction from the same upstream IBM Plex Sans source, `IBM/plex` GitHub
 *      release `@ibm/plex-sans@1.1.0`, never a third-party face).
 *   2. `⌘` (U+2318) and `▾` (U+25BE) are NOT in ANY shipped Plex file — the reason those two
 *      became icons (`KeyboardCommandKeyOutlined` / `ArrowDropDown`, `@mui/icons-material`, already
 *      bundled in the JS bundle) rather than bundled glyphs: no font subset could have fixed them.
 *      This assertion is the guard against a "reduce differently" regression — someone reverting
 *      the icon back to a literal character without re-checking the glyph exists nowhere to render.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/** apps/dashboard root, resolved by walking up from the test cwd to the Nx workspace root
 *  (mirrors `fonts.spec.ts`'s `dashboardRoot()`). */
function dashboardRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return resolve(dir, 'apps', 'dashboard');
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const DASHBOARD_ROOT = dashboardRoot();
const fontPath = (rel: string) => resolve(DASHBOARD_ROOT, 'public', 'fonts', rel);

// ---- Minimal WOFF2 decoder: table directory + the ONE brotli stream -> named table bytes. -------
// We only ever read the 'cmap' table, which WOFF2 never transforms (only glyf/loca are), so no
// glyf reconstruction is needed — just correct offset bookkeeping through the table directory.
const KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
] as const;

function readUIntBase128(buf: Buffer, pos: number): [number, number] {
  let value = 0;
  let p = pos;
  for (let i = 0; i < 5; i++) {
    const b = buf[p];
    p += 1;
    if (i === 0 && b === 0x80) throw new Error('UIntBase128 leading zero byte');
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) return [value >>> 0, p];
  }
  throw new Error('UIntBase128 too long');
}

function parseWoff2Tables(buf: Buffer): Record<string, Buffer> {
  if (buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);
  let p = 48; // fixed WOFF2Header size
  const entries: { tag: string; origLength: number; transformLength: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p];
    p += 1;
    const idx = flags & 0x3f;
    let tag: string;
    if (idx === 0x3f) {
      tag = buf.toString('ascii', p, p + 4);
      p += 4;
    } else {
      tag = KNOWN_TAGS[idx];
    }
    const transformVersion = (flags >> 6) & 0x3;
    let origLength: number;
    [origLength, p] = readUIntBase128(buf, p);
    let transformLength = origLength;
    // Real encoders emit transformLength only for glyf/loca (their xform version 0 IS applied);
    // every other table's version 0 means "no transform", carrying no separate length field.
    if ((tag === 'glyf' || tag === 'loca') && transformVersion === 0) {
      [transformLength, p] = readUIntBase128(buf, p);
    }
    entries.push({ tag, origLength, transformLength });
  }
  const compressed = buf.subarray(p, p + totalCompressedSize);
  const decompressed = brotliDecompressSync(compressed);
  let offset = 0;
  const tables: Record<string, Buffer> = {};
  for (const e of entries) {
    const len = e.tag === 'glyf' || e.tag === 'loca' ? e.transformLength : e.origLength;
    tables[e.tag] = decompressed.subarray(offset, offset + len);
    offset += len; // tables are concatenated with NO padding in the decompressed stream
  }
  return tables;
}

function parseCmapFormat4(data: Buffer, subOffset: number) {
  if (data.readUInt16BE(subOffset) !== 4) return null;
  const segCountX2 = data.readUInt16BE(subOffset + 6);
  const segCount = segCountX2 / 2;
  const endCodeOff = subOffset + 14;
  const startCodeOff = endCodeOff + segCountX2 + 2;
  const idDeltaOff = startCodeOff + segCountX2;
  const idRangeOff = idDeltaOff + segCountX2;
  const segs: {
    startCode: number;
    endCode: number;
    idDelta: number;
    idRangeOffset: number;
    idRangeOffsetAddr: number;
  }[] = [];
  for (let i = 0; i < segCount; i++) {
    segs.push({
      endCode: data.readUInt16BE(endCodeOff + i * 2),
      startCode: data.readUInt16BE(startCodeOff + i * 2),
      idDelta: data.readInt16BE(idDeltaOff + i * 2),
      idRangeOffset: data.readUInt16BE(idRangeOff + i * 2),
      idRangeOffsetAddr: idRangeOff + i * 2,
    });
  }
  return {
    hasGlyph(cp: number): boolean {
      for (const seg of segs) {
        if (cp < seg.startCode || cp > seg.endCode) continue;
        let glyphId: number;
        if (seg.idRangeOffset === 0) {
          glyphId = (cp + seg.idDelta) & 0xffff;
        } else {
          const addr = seg.idRangeOffsetAddr + seg.idRangeOffset + (cp - seg.startCode) * 2;
          if (addr + 2 > data.length) return false;
          glyphId = data.readUInt16BE(addr);
          if (glyphId !== 0) glyphId = (glyphId + seg.idDelta) & 0xffff;
        }
        return glyphId !== 0;
      }
      return false;
    },
  };
}

/** `hasGlyphForCodePoint` — decodes the shipped woff2 at `relPath` and checks BMP cmap coverage. */
function hasGlyphForCodePoint(relPath: string, codePoint: number): boolean {
  const tables = parseWoff2Tables(readFileSync(fontPath(relPath)));
  const cmap = tables['cmap'];
  if (!cmap) throw new Error(`no cmap table in ${relPath}`);
  const numTables = cmap.readUInt16BE(2);
  let best: ReturnType<typeof parseCmapFormat4> = null;
  for (let i = 0; i < numTables; i++) {
    const rec = 4 + i * 8;
    const platformID = cmap.readUInt16BE(rec);
    const encodingID = cmap.readUInt16BE(rec + 2);
    const offset = cmap.readUInt32BE(rec + 4);
    const fmt = cmap.readUInt16BE(offset);
    if (fmt === 4) {
      best = parseCmapFormat4(cmap, offset);
      if (platformID === 3 && encodingID === 1) break;
    }
  }
  if (!best) throw new Error(`no usable format-4 cmap subtable in ${relPath}`);
  return best.hasGlyph(codePoint);
}

const ARROW = 0x2192; // →
const GEQ = 0x2265; // ≥
const LEQ = 0x2264; // ≤
const GAMMA = 0x03b3; // γ
const COMMAND = 0x2318; // ⌘
const TRIANGLE = 0x25be; // ▾

describe('PR46 §B — bundled font glyph coverage (decoded from the shipped woff2 files)', () => {
  it('MUTATION GUARD: the decoder correctly finds NO coverage in a Latin-only file for a Greek letter', () => {
    expect(hasGlyphForCodePoint('ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2', GAMMA)).toBe(
      false,
    );
  });

  it('the new `greek` subset carries γ (scanner "Pos γ" / "Neg γ") at every bundled weight', () => {
    for (const w of [400, 500, 600, 700]) {
      expect(
        hasGlyphForCodePoint(`ibm-plex-sans/ibm-plex-sans-greek-${w}-normal.woff2`, GAMMA),
        `weight ${w}`,
      ).toBe(true);
    }
  });

  it('the new `symbols` subset carries →/≤/≥ (landing CTAs at button weight 600, scanner filter labels) at every bundled weight', () => {
    for (const w of [400, 500, 600, 700]) {
      const rel = `ibm-plex-sans/ibm-plex-sans-symbols-${w}-normal.woff2`;
      expect(hasGlyphForCodePoint(rel, ARROW), `weight ${w} →`).toBe(true);
      expect(hasGlyphForCodePoint(rel, GEQ), `weight ${w} ≥`).toBe(true);
      expect(hasGlyphForCodePoint(rel, LEQ), `weight ${w} ≤`).toBe(true);
    }
  });

  it("the `symbols` subset is MINIMAL — it does not also carry γ (that is `greek`'s job, not duplicated)", () => {
    expect(
      hasGlyphForCodePoint('ibm-plex-sans/ibm-plex-sans-symbols-400-normal.woff2', GAMMA),
    ).toBe(false);
  });

  it('every new subset file + the Mono latin-ext files actually ship on disk', () => {
    const files = [
      'ibm-plex-sans/ibm-plex-sans-greek-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-greek-500-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-greek-600-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-greek-700-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-latin-ext-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-latin-ext-500-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-latin-ext-600-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-latin-ext-700-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-symbols-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-symbols-500-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-symbols-600-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-symbols-700-normal.woff2',
      'ibm-plex-mono/ibm-plex-mono-latin-ext-400-normal.woff2',
      'ibm-plex-mono/ibm-plex-mono-latin-ext-500-normal.woff2',
      'ibm-plex-mono/ibm-plex-mono-latin-ext-600-normal.woff2',
    ];
    for (const f of files) expect(existsSync(fontPath(f)), f).toBe(true);
  });

  it('⌘ (U+2318) is in NO shipped Plex Sans/Mono file — the reason it is an icon (KeyboardCommandKeyOutlined), not bundled text', () => {
    const files = [
      'ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-greek-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-latin-ext-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-symbols-400-normal.woff2',
      'ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2',
      'ibm-plex-mono/ibm-plex-mono-latin-ext-400-normal.woff2',
    ];
    for (const f of files) expect(hasGlyphForCodePoint(f, COMMAND), f).toBe(false);
  });

  it('▾ (U+25BE) is in NO shipped Plex Sans file — the reason it is an icon (ArrowDropDown), not bundled text', () => {
    const files = [
      'ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-greek-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-latin-ext-400-normal.woff2',
      'ibm-plex-sans/ibm-plex-sans-symbols-400-normal.woff2',
    ];
    for (const f of files) expect(hasGlyphForCodePoint(f, TRIANGLE), f).toBe(false);
  });
});
