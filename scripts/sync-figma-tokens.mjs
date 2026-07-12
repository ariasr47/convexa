#!/usr/bin/env node
/**
 * sync-figma-tokens — regenerate apps/dashboard/src/app/tokens.ts from the Figma design system so the
 * Figma variables and the MUI theme never drift. Figma "Convexa — Web App (Design Reference)".
 *
 * TWO INPUT PATHS (the transform is identical):
 *   1) REST  :  node scripts/sync-figma-tokens.mjs            (env FIGMA_TOKEN required)
 *              Uses GET /v1/files/:key/variables/local.
 *              ⚠ The Variables REST API requires a Figma **Enterprise org** plan. On Pro/Team it 403s.
 *   2) FILE  :  node scripts/sync-figma-tokens.mjs --from variables.local.json
 *              Transform a pre-exported JSON (plan-agnostic). Get that JSON on Pro/Team via the
 *              **Tokens Studio** plugin export, or by dumping `getLocalVariables*` through the Figma MCP.
 *
 * Output-neutral: only writes values; the MUI-palette subset becomes --mui-palette-* via theme.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_KEY = process.env.FIGMA_FILE_KEY || '4Njtm8QGWIgm4rA0UESg8n';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/dashboard/src/app/tokens.ts');

// name (Figma) -> dotted path in the tokens module
const COLOR_MAP = {
  'color/primary/main': ['primary'],
  'color/success/main': ['success'],
  'color/error/main': ['error'],
  'color/bg/default': ['background', 'default'],
  'color/bg/paper': ['background', 'paper'],
};
const EXTRA_MAP = {
  'color/bg/raised': 'panelRaised',
  'color/bg/hatch-alt': 'hatchAlt',
  'color/text/secondary': 'textSecondary',
  'color/text/disabled': 'textDisabled',
  'color/accent/violet': 'accentViolet',
};

const hex = (c) => {
  const to = (n) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
};

async function loadPayload() {
  const fileArg = process.argv.indexOf('--from');
  if (fileArg !== -1) return JSON.parse(readFileSync(process.argv[fileArg + 1], 'utf8'));
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new Error('Set FIGMA_TOKEN, or pass --from <variables.local.json>.');
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/variables/local`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok)
    throw new Error(
      `Figma API ${res.status} ${res.statusText} (Variables REST API needs an Enterprise plan — use --from instead).`,
    );
  return res.json();
}

function build({ meta }) {
  const vars = Object.values(meta.variables);
  const cols = Object.values(meta.variableCollections);
  const colorCol = cols.find((c) => c.name === 'Color');
  const modeId = (n) => colorCol.modes.find((m) => m.name === n).modeId;
  const byId = Object.fromEntries(vars.map((v) => [v.id, v]));
  const byName = Object.fromEntries(vars.map((v) => [v.name, v]));

  // resolve a variable's value for a mode, following one alias hop to a primitive color
  const resolve = (v, mode) => {
    let val = v.valuesByMode[mode];
    if (val && val.type === 'VARIABLE_ALIAS') val = byId[val.id].valuesByMode[mode];
    return hex(val);
  };

  const scheme = (mode) => {
    const out = { background: {} };
    for (const [name, path] of Object.entries(COLOR_MAP)) {
      const v = byName[name];
      if (!v) continue;
      const h = resolve(v, mode);
      if (path.length === 1) out[path[0]] = h;
      else out[path[0]][path[1]] = h;
    }
    return out;
  };
  const dark = scheme(modeId('Dark'));
  const light = scheme(modeId('Light'));

  const extras = {};
  for (const [name, key] of Object.entries(EXTRA_MAP)) {
    const v = byName[name];
    if (v) extras[key] = resolve(v, modeId('Dark'));
  }
  return { dark, light, extras };
}

const { dark, light, extras } = build(await loadPayload());
const j = (o) => JSON.stringify(o, null, 2).replace(/"([^"]+)":/g, '$1:');
const banner = readFileSync(OUT, 'utf8').split('*/')[0] + '*/\n'; // keep the existing doc header
writeFileSync(
  OUT,
  `${banner}
export const palette = {
  dark: ${j(dark)},
  light: ${j(light)},
} as const;

export const shape = { borderRadius: 10 } as const;

export const typographyTokens = {
  fontFamily: 'Inter, system-ui, Segoe UI, Roboto, sans-serif',
  monoFontFamily: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const extras = ${j(extras)} as const;
`,
);
console.log(`tokens.ts updated — dark.primary=${dark.primary}, light.primary=${light.primary}`);
