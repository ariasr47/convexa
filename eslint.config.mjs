import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

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
      // The Python backend (apps/api, scope:backend) is not in the TS graph, so this rule never
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
  // ---- broker-option-grouping · Layer 1 of the no-naming machinery (SPEC §2.3) -------------------
  // File-NAMED deliberately: a directory-wide override would have to re-exempt every shipped module in
  // broker/. That means an implementer CAN forget to add a fourth file here — which is why Layer 2's
  // file set is defined by EXCLUSION and its glob shaped so that forgetting is VISIBLE, not silent.
  // SUBSTITUTION RECORDED FOR GATE Q (SPEC §2.3 / PLAN F6 Step 2): the negation-glob allow-list
  // form (`group: ['**', '!./brokerView', '!./predicates', '!@org/api']`) was tried FIRST and does
  // NOT bite correctly on this ESLint version — it flagged the allow-listed specifiers themselves
  // (`@org/api`, `./brokerView`, `./predicates`) as restricted, which would make grouping.ts
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
                'grouping.ts may not import positions/{structure,view,leg} (SPEC §2.3): those three specifiers hold all four entry points to the naming machine. Use ./brokerView, ./predicates or @org/api types instead.',
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
];
