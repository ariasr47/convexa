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
      // apps/api is the Python backend — not part of the JS/TS lint graph.
      'apps/api/**',
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
];
