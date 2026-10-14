// Checks design/tokens/tokens.json against apps/dashboard/src/app/shared/theme/tokens.ts.
// Exit 1 on any mismatch. Prints the redesign's additions so a tokens.ts patch is one step.
// Run: node design/src/verify-tokens.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const design = JSON.parse(readFileSync(join(here, '..', 'tokens', 'tokens.json'), 'utf8'));
const ts = readFileSync(join(here, '..', '..', 'apps', 'dashboard', 'src', 'app', 'shared', 'theme', 'tokens.ts'), 'utf8');

const consts = {};
for (const m of ts.matchAll(/const (\w+) = '(#[0-9A-Fa-f]{6})'/g)) consts[m[1]] = m[2];
// Generalized to any quoted value (hex OR rgba(...)) so it also serves the v2 additions below,
// which are alpha colors. Still requires a QUOTED literal, so `textAmber: gammaAmber` (a bare
// identifier reference, dark-mode textAmber) correctly does not match — unchanged behaviour for
// the pre-existing hex-only callers.
const seq = (key) => [...ts.matchAll(new RegExp(`${key}: '([^']+)'`, 'g'))].map((m) => m[1]);
const [successDark, successLight] = seq('success');
const [errorDark, errorLight] = seq('error');
const [raisedDark, raisedLight] = seq('panelRaised');
const [textAmberLight] = seq('textAmber');
// Text-grade tokens that landed in tokens.ts after v2 (2026-09-09 textDim/textInfo, 2026-10-13
// textUp/textDown) plus the hatch stripe. They are mirrors, not additions: v4 boards draw with them.
const [textDimDark, textDimLight] = seq('textDim');
const [textInfoDark, textInfoLight] = seq('textInfo');
const [textUpDark, textUpLight] = seq('textUp');
const [textDownDark, textDownLight] = seq('textDown');
const [hatchDark, hatchLight] = seq('hatchAlt');

// [design key, mode, expected from tokens.ts, label]
const checks = [
  ['ink', 'dark', consts.ink, 'ink'], ['panel', 'dark', consts.panel, 'panel'], ['phosphor', 'dark', consts.phosphor, 'phosphor'], ['steel', 'dark', consts.steel, 'steel'],
  ['amber', 'dark', consts.gammaAmber, 'gammaAmber'], ['signal', 'dark', consts.signal, 'signal'], ['warn', 'dark', consts.warningOrange, 'warningOrange'],
  ['up', 'dark', successDark, 'palette.dark.success'], ['down', 'dark', errorDark, 'palette.dark.error'], ['raised', 'dark', raisedDark, 'extras.panelRaised'],
  ['ink', 'light', consts.paper, 'paper'], ['phosphor', 'light', consts.inkText, 'inkText'], ['amber', 'light', consts.amberDeep, 'amberDeep'], ['amberText', 'light', textAmberLight, 'extrasLight.textAmber'],
  ['signal', 'light', consts.lightInfo, 'lightInfo'], ['warn', 'light', consts.lightWarning, 'lightWarning'], ['steel', 'light', consts.lightSecondary, 'lightSecondary'],
  ['up', 'light', successLight, 'palette.light.success'], ['down', 'light', errorLight, 'palette.light.error'], ['raised', 'light', raisedLight, 'extrasLight.panelRaised'],
  ['textDim', 'dark', textDimDark, 'extras.textDim'], ['textDim', 'light', textDimLight, 'extrasLight.textDim'],
  ['textInfo', 'dark', textInfoDark, 'extras.textInfo'], ['textInfo', 'light', textInfoLight, 'extrasLight.textInfo'],
  ['textUp', 'dark', textUpDark, 'extras.textUp'], ['textUp', 'light', textUpLight, 'extrasLight.textUp'],
  ['textDown', 'dark', textDownDark, 'extras.textDown'], ['textDown', 'light', textDownLight, 'extrasLight.textDown'],
  ['hatch', 'dark', hatchDark, 'extras.hatchAlt'], ['hatch', 'light', hatchLight, 'extrasLight.hatchAlt'],
];

// ---------------------------------------------------------------------------------------------
// v2 additions (FE-13, SPEC §1 / §7 invariant 8). Phase 1 owed item 2: `tokens.json`'s
// `additions` block used to be PRINTED only (no structural check), so a mismatch — most
// dangerously `steel2`'s light value, darkened by owner ruling 7 for WCAG AA — could drift
// silently while the script still exited 0. This section makes both directions of drift fail:
// a NAME added/removed from either side (Step 1), and a VALUE that differs for a name both
// sides agree on (Step 2).
// ---------------------------------------------------------------------------------------------

// design.additions key -> its tokens.ts home, both schemes (per PLAN FE-13 Step 1's own mapping).
const ADDITIONS_MAP = {
  ink2: { seqKey: 'well', label: 'extras.well' },
  raised2: { seqKey: 'panelRaised2', label: 'extras.panelRaised2' },
  line: { seqKey: 'divider', label: 'palette.*.divider' },
  line2: { seqKey: 'lineStrong', label: 'extras.lineStrong' },
  steel2: { seqKey: 'textTertiary', label: 'extras.textTertiary' },
  scrim: { seqKey: 'scrim', label: 'extras.scrim' },
  glass: { seqKey: 'glass', label: 'extras.glass' },
};

// Step 1 — set-equality: the names PROPOSED in tokens.json's `additions` must be exactly the
// names this checker knows how to verify, in both directions. A name added to `additions`
// without a matching entry here (or vice versa) is itself a defect, independent of any value.
const designAdditionNames = Object.keys(design.additions).filter((k) => k !== '$comment' && k !== 'proposed').sort();
const knownAdditionNames = Object.keys(ADDITIONS_MAP).sort();
const onlyInDesign = designAdditionNames.filter((k) => !knownAdditionNames.includes(k));
const onlyInChecker = knownAdditionNames.filter((k) => !designAdditionNames.includes(k));
let bad = 0;
if (onlyInDesign.length || onlyInChecker.length) {
  bad++;
  if (onlyInDesign.length) console.log(`✗ additions: in tokens.json but not checked here: ${onlyInDesign.join(', ')}`);
  if (onlyInChecker.length) console.log(`✗ additions: checked here but missing from tokens.json: ${onlyInChecker.join(', ')}`);
} else {
  console.log(`✓ additions: name sets match (${knownAdditionNames.join(', ')})`);
}

// Step 2 — per-value equality against tokens.ts, both schemes (fourteen checks: 7 × 2 modes).
const additionChecks = [];
for (const [designKey, { seqKey, label }] of Object.entries(ADDITIONS_MAP)) {
  const [tsDark, tsLight] = seq(seqKey);
  additionChecks.push([designKey, 'dark', tsDark, `${label} (dark)`], [designKey, 'light', tsLight, `${label} (light)`]);
}

for (const [key, mode, expected, label] of checks) {
  const got = design.color[mode][key];
  const ok = expected && got && got.toLowerCase() === expected.toLowerCase();
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${mode.padEnd(5)} ${key.padEnd(10)} design ${String(got).padEnd(9)} tokens.ts ${label} = ${expected ?? '(not found)'}`);
}
console.log('\nv2 additions (now structurally checked, not merely printed):');
for (const [key, mode, expected, label] of additionChecks) {
  const got = design.color[mode][key];
  const ok = expected && got && got.toLowerCase() === expected.toLowerCase();
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${mode.padEnd(5)} ${key.padEnd(10)} design ${String(got).padEnd(28)} tokens.ts ${label} = ${expected ?? '(not found)'}`);
}
// ---------------------------------------------------------------------------------------------
// v5 (2026-10-13): roles PROPOSED for tokens.ts (`additions.proposed`). Not in the app yet, so there is
// nothing to mirror; instead each one must (a) carry a value for both schemes, (b) clear its stated
// contrast floor on its stated surfaces, measured here (WCAG 2 relative luminance), and (c) either be
// absent from tokens.ts or, once it lands, carry the same value there (then it moves into the mirror).
// ---------------------------------------------------------------------------------------------
const proposed = Object.entries(design.additions.proposed || {}).filter(([k]) => k !== '$comment');
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgbOf = (s) => { const h = /^#([0-9a-f]{6})$/i.exec(s); if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)); const m = /^rgba?\(([^)]+)\)$/i.exec(s); if (m) return m[1].split(',').map(Number).slice(0, 3); return null; };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
if (proposed.length) console.log('\nv5 proposed chart roles (not in tokens.ts yet; checked for shape and contrast):');
for (const [name, r] of proposed) {
  for (const mode of ['dark', 'light']) {
    const v = r[mode]; const rgb = v && rgbOf(v);
    if (!rgb) { bad++; console.log(`✗ ${mode.padEnd(5)} ${name.padEnd(14)} missing or unparseable value ${v}`); continue; }
    const floor = r.floor;
    if (floor && floor.contrast) {
      for (const surf of floor.on) {
        const sv = rgbOf(design.color[mode][surf] || '');
        if (!sv) { bad++; console.log(`✗ ${mode.padEnd(5)} ${name.padEnd(14)} unknown surface ${surf}`); continue; }
        const cr = ratio(rgb, sv); const ok = cr >= floor.contrast; if (!ok) bad++;
        console.log(`${ok ? '✓' : '✗'} ${mode.padEnd(5)} ${name.padEnd(14)} ${v.padEnd(22)} ${cr.toFixed(2)}:1 on ${surf} (floor ${floor.contrast}:1)`);
      }
    } else console.log(`· ${mode.padEnd(5)} ${name.padEnd(14)} ${v.padEnd(22)} no contrast floor (not a carrier: ${String(r.role).split('.')[0]})`);
  }
  const key = String(r.home || '').split('.').pop();
  const landed = key ? seq(key) : [];
  if (landed.length) {
    const same = landed[0]?.toLowerCase() === r.dark.toLowerCase() && landed[1]?.toLowerCase() === r.light.toLowerCase();
    if (!same) bad++;
    console.log(`${same ? '✓' : '✗'} ${name} has landed in tokens.ts as ${r.home} (${landed.join(' / ')}): ${same ? 'same values, move it into the mirror' : 'VALUES DIFFER from the proposal'}`);
  }
}
console.log(bad ? `\n${bad} mismatch(es) — design and app tokens have drifted.` : '\nAll shared tokens match tokens.ts.');
process.exit(bad ? 1 : 0);
