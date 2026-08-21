/**
 * Vite analogue of Next.js `optimizePackageImports` for `@mui/material`.
 *
 * Next 13.5+ rewrites `import { Button } from '@mui/material'` to a path import
 * automatically. Vite does not. Barrel imports are the DEV-time cost (module graph);
 * production Rolldown already tree-shakes. This plugin rewrites named value imports
 * at transform time so source can stay barrel-shaped for editor DX.
 *
 * Type-only specifiers stay on the barrel (erased; no runtime graph).
 */
const BARREL = '@mui/material';
const IMPORT_RE = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+(['"])@mui\/material\3\s*;?/g;

/**
 * @param {string} specifiers
 * @returns {{ type: boolean, name: string, alias: string }[]}
 */
export function parseSpecifiers(specifiers) {
  return specifiers
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const type = /^type\s+/.test(s);
      const rest = type ? s.replace(/^type\s+/, '') : s;
      const [name, alias] = rest.split(/\s+as\s+/).map((p) => p.trim());
      return { type, name, alias: alias || name };
    })
    .filter((s) => s.name);
}

/**
 * @param {string} code
 * @returns {string}
 */
export function rewriteMuiMaterialImports(code) {
  if (!code.includes(BARREL)) return code;
  return code.replace(IMPORT_RE, (full, typeKw, specifiers) => {
    if (typeKw) return full;
    const parts = parseSpecifiers(specifiers);
    if (parts.length === 0) return full;
    const values = parts.filter((p) => !p.type);
    const types = parts.filter((p) => p.type);
    if (values.length === 0) return full;
    const lines = values.map((p) =>
      p.alias === p.name
        ? `import ${p.name} from '${BARREL}/${p.name}';`
        : `import ${p.alias} from '${BARREL}/${p.name}';`,
    );
    if (types.length > 0) {
      const inner = types
        .map((p) => (p.alias === p.name ? `type ${p.name}` : `type ${p.name} as ${p.alias}`))
        .join(', ');
      lines.push(`import { ${inner} } from '${BARREL}';`);
    }
    return lines.join('\n');
  });
}

/**
 * @returns {import('vite').Plugin}
 */
export function muiPathImports() {
  return {
    name: 'mui-path-imports',
    enforce: 'pre',
    transform(code, id) {
      const n = id.replace(/\\/g, '/');
      if (n.includes('/node_modules/')) return null;
      // Structural scans import source as text (`?raw` / `?url`). Rewriting those
      // feeds oxc a half-transformed string and fails the suite. HMR `?t=` stays.
      if (/\?(raw|url)(?:&|$)/.test(n)) return null;
      const file = n.split('?')[0] ?? n;
      if (!/\.[cm]?[jt]sx?$/.test(file)) return null;
      if (!code.includes(`'${BARREL}'`) && !code.includes(`"${BARREL}"`)) return null;
      const next = rewriteMuiMaterialImports(code);
      return next === code ? null : { code: next, map: null };
    },
  };
}
