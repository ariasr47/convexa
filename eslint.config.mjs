import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import path from 'node:path';

// ---- MUI 9.2 system props: the selectors for the guard at the end of this file ----------------
// Typography's `color` prop matches only a variant colour. Typography.mjs builds one variant per
// palette entry with a string `main` (this theme has the six below) and one per palette.text key
// (text + Key). `inherit` matches no variant, so the text inherits, which is what it asks for.
const TYPOGRAPHY_VARIANT_COLOURS = [
  'primary',
  'secondary',
  'error',
  'info',
  'success',
  'warning',
  'textPrimary',
  'textSecondary',
  'textDisabled',
  'inherit',
].join('|');
const VARIANT = `/^(${TYPOGRAPHY_VARIANT_COLOURS})$/`;
// Where a colour reaches Typography: the color prop of Typography and of the components that are
// styled(Typography) and pass it on (Breadcrumbs, DialogTitle, DialogContentText, AlertTitle), and
// the color key of a Typography slot in slotProps (ListItemText primary and secondary, CardHeader
// title and subheader, FormControlLabel typography).
const TYPOGRAPHY_COLOUR = [
  "JSXOpeningElement[name.name=/^(Typography|Breadcrumbs|DialogTitle|DialogContentText|AlertTitle)$/] > JSXAttribute[name.name='color']",
  "JSXOpeningElement[name.name=/^(ListItemText|CardHeader|FormControlLabel)$/] > JSXAttribute[name.name='slotProps'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(primary|secondary|title|subheader|typography)$/] > ObjectExpression > Property[key.name='color']",
].join(', ');
// A node is the colour's value when each node between it and the prop passes its value on: braces,
// a ternary's branches, the operands of &&, || and ??, `as`, `satisfies` and `!`. A ternary's test,
// a comparison, a call's arguments or an object's keys are not the value, at any depth.
const PASS_THROUGH =
  'JSXExpressionContainer, ConditionalExpression, LogicalExpression, TSAsExpression, TSSatisfiesExpression, TSNonNullExpression';
const colourValue = (node) =>
  `:matches(${TYPOGRAPHY_COLOUR}) ${node}:not(.test):not(:matches(${TYPOGRAPHY_COLOUR}) :matches(:not(${PASS_THROUGH}), .test) *)`;
const BOX_MESSAGE =
  "MUI 9.2 ignores system props on Box, Stack, Grid and Container: color and bgcolor reach the DOM element as plain attributes and style nothing. Put the value in sx, e.g. sx={{ color: 'text.secondary' }}.";
const TYPOGRAPHY_MESSAGE =
  "MUI 9.2 ignores system props on Typography: its color prop takes only a variant colour (primary, secondary, error, info, success, warning, textPrimary, textSecondary, textDisabled, inherit), so a palette path like 'text.secondary' styles nothing. The same holds for Breadcrumbs, DialogTitle, DialogContentText, AlertTitle and a Typography slot's props. Put the value in sx, e.g. sx={{ color: 'text.secondary' }}.";
const MUI_SYSTEM_PROP_GUARD = [
  {
    selector:
      'JSXOpeningElement[name.name=/^(Box|Stack|Grid|Container)$/] > JSXAttribute[name.name=/^(color|bgcolor)$/]',
    message: BOX_MESSAGE,
  },
  // A string that is not a variant colour: color="text.secondary", a branch, an operand, `as const`.
  {
    selector: colourValue(`Literal[value=type(string)]:not([value=${VARIANT}])`),
    message: TYPOGRAPHY_MESSAGE,
  },
  // A template: always when it interpolates, otherwise when its text is not a variant colour.
  // A concatenation counts as a template that interpolates.
  {
    selector: colourValue('TemplateLiteral:not([expressions.length=0])'),
    message: TYPOGRAPHY_MESSAGE,
  },
  {
    selector: colourValue(
      `TemplateLiteral[expressions.length=0]:not([quasis.0.value.cooked=${VARIANT}])`,
    ),
    message: TYPOGRAPHY_MESSAGE,
  },
  { selector: colourValue("BinaryExpression[operator='+']"), message: TYPOGRAPHY_MESSAGE },
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    // Register the React Hooks plugin so the rules (and the source's inline
    // `eslint-disable react-hooks/...` comments) resolve. rules-of-hooks is a real-bug guard;
    // exhaustive-deps stays a warning (advisory).
    files: ['**/*.ts', '**/*.tsx', '**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Specs use `!` after a query that just asserted presence (`getByRole(...)!`). That is a
    // test idiom, not a product non-null lie. Leaving it as warn trained a 120-line ignore
    // habit. Product files keep the rule.
    files: ['**/*.{spec,test}.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-output',
      // apps/api is the Rust backend — not part of the JS/TS lint graph.
      'apps/api/**',
      'archive/**',
      // Git worktrees live here and are GITIGNORED, so they never exist in a CI checkout — but
      // locally they are full copies of the repo, and linting them reported 157 errors from code
      // that is not in this working tree. That made `nx run-many -t lint` (the exact command CI
      // runs) fail on any machine that has a worktree, looking exactly like a real regression.
      '.claude/worktrees/**',
      // Playwright artifacts (e2e migrated from Cypress 2026-07-28).
      '**/playwright-report',
      '**/blob-report',
      '**/test-results',
    ],
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {
      // Lane separation as a first-class graph property (mirrors the agent lanes):
      // - apps (type:app) may only import libs; an e2e app may import the app under test + libs.
      // - libs (type:lib) may only import other libs.
      // - frontend may import frontend + the shared lib; the shared lib stays self-contained.
      // The Rust backend (apps/api, scope:backend) is not in the TS graph, so this rule never
      // links the two lanes — the separation is structural.
      '@nx/enforce-module-boundaries': [
        'error',
        {
          // libs/api is consumed as source via TS path mapping (not a prebuilt package), so the
          // buildable-lib dependency check does not apply here.
          enforceBuildableLibDependency: false,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: 'scope:frontend',
              onlyDependOnLibsWithTags: ['scope:frontend', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:backend',
              onlyDependOnLibsWithTags: ['scope:backend'],
            },
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
            {
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: ['type:app', 'type:lib'],
            },
            { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
          ],
        },
      ],
    },
  },
  // Vite analogue of Next optimizePackageImports: source must not import the @mui barrel
  // (type-only barrels are allowed — erased, no runtime graph). Path imports stay.
  // basePath, as for the guard at the end of this file: `nx lint` runs `eslint .` inside the
  // project folder, where the old patterns 'apps/dashboard/**' and 'libs/**' matched nothing, so
  // this rule never ran under nx lint or npm run verify.
  ...['apps/dashboard', 'libs'].map((dir) => ({
    basePath: path.join(import.meta.dirname, dir),
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mui/material',
              message: 'Use path imports: import Box from "@mui/material/Box".',
              allowTypeImports: true,
            },
            {
              name: '@mui/icons-material',
              message: 'Use path imports: import Menu from "@mui/icons-material/Menu".',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  })),
  // ---- broker-option-grouping · Layer 1 of the no-naming machinery (SPEC §2.3) -------------------
  // File-NAMED deliberately: a directory-wide override would have to re-exempt every shipped module in
  // broker/. That means an implementer CAN forget to add a fourth file here — which is why Layer 2's
  // file set is defined by EXCLUSION and its glob shaped so that forgetting is VISIBLE, not silent.
  // SUBSTITUTION RECORDED FOR GATE Q (SPEC §2.3 / PLAN F6 Step 2): the negation-glob allow-list
  // form (`group: ['**', '!./brokerView', '!./predicates', '!@convexa/api']`) was tried FIRST and does
  // NOT bite correctly on this ESLint version — it flagged the allow-listed specifiers themselves
  // (`@convexa/api`, `./brokerView`, `./predicates`) as restricted, which would make grouping.ts
  // unbuildable. Per the documented fallback, this override uses the GUARANTEED three-specifier
  // deny-list instead — the same list used for the presentational modules below. This is a WEAKER
  // guarantee than a true allow-list (it only closes the three specifiers holding the four naming
  // entry points, not every future path), but it is proven to bite (see F6 Step 2/3 verification).
  //
  // GATE Q FINDING (2026-08-06, `broker-option-grouping` bounce): the alias-form entries below bite
  // on `'@/features/trading/positions/structure'` (verified live via `eslint --stdin`) but do NOT
  // bite on the equivalent RELATIVE form `'../positions/structure'` — `no-restricted-imports`
  // `patterns.group` entries are literal specifiers, not path-normalizing, so an alias and its
  // relative equivalent are two different strings to this rule. The relative-form entries below
  // close that gap for the one directory depth that exists today (`grouping.ts` sits directly under
  // `broker/`, one level above `positions/`); Layer 2's set-A regex
  // (`/from\s+['"][^'"]*positions\/(structure|view|leg)['"]/`) already caught every import-path
  // SHAPE regardless, so this was never a hole in the three-layer stack — only in Layer 1 alone.
  {
    files: ['**/features/trading/broker/grouping.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/trading/positions/structure',
                '@/features/trading/positions/view',
                '@/features/trading/positions/leg',
                '../positions/structure',
                '../positions/view',
                '../positions/leg',
              ],
              message:
                'grouping.ts may not import positions/{structure,view,leg} (SPEC §2.3): those three specifiers hold all four entry points to the naming machine. Use ./brokerView, ./predicates or @convexa/api types instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/features/trading/broker/BrokerGroupHeader.tsx',
      '**/features/trading/broker/groupCopy.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/features/trading/positions/structure',
                '**/features/trading/positions/view',
                '**/features/trading/positions/leg',
              ],
              message:
                'A group-rendering or group-copy module may not import positions/{structure,view,leg}: those three specifiers hold all four entry points to the naming machine plus the label dictionary (SPEC §2.3). Any further module this feature adds joins this override.',
            },
          ],
        },
      ],
    },
  },
  // ---- curvature-v2-landing-and-site · SPEC §2.1 — the public-surface deny-list ------------------
  // The four public surfaces are a ZERO-EDGE tree: no transport, no sibling page, no trading domain,
  // no auth TRANSPORT. `features/auth/copy` (a pure string module) and `features/auth/AuthDialogProvider`
  // (an opener) are DELIBERATELY allowed — the invariant is about a capability, not a folder, and the
  // landing's closed-signups sentence must render from the imported AUTH_COPY literal, not a retyped one.
  //
  // Both the alias form AND the relative form are listed: `patterns.group` entries are literal
  // specifiers, not path-normalizing (the broker-option-grouping GATE Q finding recorded above).
  // Intra-folder imports use RELATIVE paths (`./copy`), which is why `@/pages/*/**` can be banned whole.
  {
    files: [
      '**/pages/landing/**/*.{ts,tsx}',
      '**/pages/blog/**/*.{ts,tsx}',
      '**/pages/methodology/**/*.{ts,tsx}',
      '**/pages/not-found/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@convexa/api', '@convexa/api/*'],
              message:
                'SPEC §2.1: the six public surfaces are a zero-edge tree — no API client, ever. The landing/blog/methodology/404 make no request.',
            },
            {
              group: ['@/pages/*', '@/pages/*/**', '../*/**'],
              message:
                'SPEC §2.1 + repo rule: pages NEVER import sibling pages. Import your own folder relatively (./copy), or promote to shared/ on the 2nd consumer.',
            },
            {
              group: [
                '@/features/trading/*',
                '@/features/trading/*/**',
                '../../features/trading/*',
                '../../features/trading/*/**',
              ],
              message:
                'SPEC §2.1: no trading domain on a marketing surface ([no-real-order-path] — a picture of a CTA never becomes a mounted TradeEntryDialog).',
            },
            {
              group: ['@/features/auth/AuthContext', '../../features/auth/AuthContext'],
              message:
                'SPEC §2.1: AuthContext owns the TRANSPORT. `@/features/auth/copy` (strings) and `@/features/auth/AuthDialogProvider` (an opener) are allowed — this ban is the capability, not the folder.',
            },
            // GATE Z I-4 (SPEC §7 item 3) — the one hero instrument ships as static SVG, never
            // WebGL (owner ruling D-B, §2.3). Scoped to all four surface folders (the same block
            // above), not landing alone: adding it as a SECOND override object with its own
            // `no-restricted-imports` key would SILENTLY REPLACE this block's patterns for any
            // file matching both `files` globs (ESLint flat config does not merge rule VALUES
            // across matching configs — the later one wins whole), dropping the four bans above
            // for every file under `pages/landing/**`. One `patterns` array is the only way to
            // add a ban here without a real risk of quietly weakening this exact list.
            {
              group: ['three', '@react-three/*', 'regl', 'pixi.js'],
              message:
                'SPEC §2.3/§7 item 3: the one hero instrument is static SVG, never WebGL (owner ruling D-B, 2026-09-10) — three/@react-three/*/regl/pixi.js are banned on the public surfaces.',
            },
          ],
        },
      ],
    },
  },
  // ---- MUI 9.2 system props (2026-10-28) ---------------------------------------------------------
  // MUI 9 removed the system props from Box, Stack, Typography and Grid (@mui/material CHANGELOG:
  // #47846 in 9.0.0-alpha.1, #48072 in 9.0.0-beta.0). No material component calls extendSxProp any
  // more. Most system props stopped type-checking, so tsc catches them. `color` did not: React's
  // HTMLAttributes declares it, and Typography's own `color` accepts any string. Box, Stack, Grid
  // and Container pass it to the DOM element, where it styles nothing (@mui/system createBox.mjs
  // forwards every prop except theme, sx and as). Typography matches it only against the variant
  // colours above. So color="text.secondary" type-checked and did nothing in 34 places until
  // 6c8a1297. This guard fails that pattern; the selectors are at the top of this file.
  // It cannot see a value held in a variable (color={tone}) or returned by a call, a prop passed
  // through a spread, a local wrapper or a styled() wrapper, or an aliased import. It matches the
  // element's name, not its import: a local component named like one of these (pages/research has
  // two called Grid) is checked too, although nothing ignores its props; rename it, or disable the
  // rule on that line. If a Box renders a component that has its own colour prop
  // (component={Button}), pass the prop to that component instead.
  // basePath pins the scope to the dashboard's source whichever config loads this array. `nx lint`
  // runs `eslint .` in apps/dashboard, where a pattern like 'apps/dashboard/**' matches nothing.
  {
    basePath: path.join(import.meta.dirname, 'apps/dashboard'),
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...MUI_SYSTEM_PROP_GUARD],
    },
  },
];
