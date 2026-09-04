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
const seq = (key) => [...ts.matchAll(new RegExp(`${key}: '(#[0-9A-Fa-f]{6})'`, 'g'))].map((m) => m[1]);
const [successDark, successLight] = seq('success');
const [errorDark, errorLight] = seq('error');
const [raisedDark, raisedLight] = seq('panelRaised');
const [textAmberLight] = seq('textAmber');

// [design key, mode, expected from tokens.ts, label]
const checks = [
  ['ink', 'dark', consts.ink, 'ink'], ['panel', 'dark', consts.panel, 'panel'], ['phosphor', 'dark', consts.phosphor, 'phosphor'], ['steel', 'dark', consts.steel, 'steel'],
  ['amber', 'dark', consts.gammaAmber, 'gammaAmber'], ['signal', 'dark', consts.signal, 'signal'], ['warn', 'dark', consts.warningOrange, 'warningOrange'],
  ['up', 'dark', successDark, 'palette.dark.success'], ['down', 'dark', errorDark, 'palette.dark.error'], ['raised', 'dark', raisedDark, 'extras.panelRaised'],
  ['ink', 'light', consts.paper, 'paper'], ['phosphor', 'light', consts.inkText, 'inkText'], ['amber', 'light', consts.amberDeep, 'amberDeep'], ['amberText', 'light', textAmberLight, 'extrasLight.textAmber'],
  ['signal', 'light', consts.lightInfo, 'lightInfo'], ['warn', 'light', consts.lightWarning, 'lightWarning'], ['steel', 'light', consts.lightSecondary, 'lightSecondary'],
  ['up', 'light', successLight, 'palette.light.success'], ['down', 'light', errorLight, 'palette.light.error'], ['raised', 'light', raisedLight, 'extrasLight.panelRaised'],
];

let bad = 0;
for (const [key, mode, expected, label] of checks) {
  const got = design.color[mode][key];
  const ok = expected && got && got.toLowerCase() === expected.toLowerCase();
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${mode.padEnd(5)} ${key.padEnd(10)} design ${String(got).padEnd(9)} tokens.ts ${label} = ${expected ?? '(not found)'}`);
}
console.log('\nAdditions (not in tokens.ts yet):');
for (const [k, v] of Object.entries(design.additions)) if (k !== '$comment') console.log(`  + ${k.padEnd(8)} ${v}`);
console.log(bad ? `\n${bad} mismatch(es) — design and app tokens have drifted.` : '\nAll shared tokens match tokens.ts.');
process.exit(bad ? 1 : 0);
