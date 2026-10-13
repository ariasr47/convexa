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
const designAdditionNames = Object.keys(design.additions).filter((k) => k !== '$comment').sort();
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
console.log(bad ? `\n${bad} mismatch(es) — design and app tokens have drifted.` : '\nAll shared tokens match tokens.ts.');
process.exit(bad ? 1 : 0);
