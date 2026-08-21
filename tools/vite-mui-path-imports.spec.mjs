import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSpecifiers, rewriteMuiMaterialImports } from './vite-mui-path-imports.mjs';

describe('parseSpecifiers', () => {
  it('splits names, aliases, and inline type specifiers', () => {
    assert.deepEqual(parseSpecifiers(' Box, Button as Btn, type SxProps '), [
      { type: false, name: 'Box', alias: 'Box' },
      { type: false, name: 'Button', alias: 'Btn' },
      { type: true, name: 'SxProps', alias: 'SxProps' },
    ]);
  });
});

describe('rewriteMuiMaterialImports', () => {
  it('rewrites a single-line barrel to path imports', () => {
    const out = rewriteMuiMaterialImports(
      "import { Box, CircularProgress } from '@mui/material';\n",
    );
    assert.equal(
      out,
      "import Box from '@mui/material/Box';\nimport CircularProgress from '@mui/material/CircularProgress';\n",
    );
  });

  it('rewrites multiline barrels', () => {
    const src = `import {
  AppBar,
  Box,
  useScrollTrigger,
} from '@mui/material';
`;
    const out = rewriteMuiMaterialImports(src);
    assert.equal(
      out,
      "import AppBar from '@mui/material/AppBar';\nimport Box from '@mui/material/Box';\nimport useScrollTrigger from '@mui/material/useScrollTrigger';\n",
    );
  });

  it('keeps type-only barrels (no runtime graph)', () => {
    const src = "import type { SxProps, Theme } from '@mui/material';\n";
    assert.equal(rewriteMuiMaterialImports(src), src);
  });

  it('splits mixed value + inline type specifiers', () => {
    const out = rewriteMuiMaterialImports("import { Box, type SxProps } from '@mui/material';\n");
    assert.equal(
      out,
      "import Box from '@mui/material/Box';\nimport { type SxProps } from '@mui/material';\n",
    );
  });

  it('leaves @mui/material/styles and path imports alone', () => {
    const src = `import { alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
`;
    assert.equal(rewriteMuiMaterialImports(src), src);
  });

  it('preserves aliases', () => {
    const out = rewriteMuiMaterialImports("import { Link as RouterLink } from '@mui/material';\n");
    assert.equal(out, "import RouterLink from '@mui/material/Link';\n");
  });
});
