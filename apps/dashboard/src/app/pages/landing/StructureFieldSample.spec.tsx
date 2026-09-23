/**
 * GATE Z I-4 (SPEC §7 item 5) — pin the field mount's PROPS, not the DOM. Canvas pixels are
 * outside the reach of both a Testing Library query and a CSS-keyframe scan (`paintStep.spec.ts`
 * mutation-proves the `m.live` gate at the paint layer, unchanged); this is the mount-level half.
 *
 * `landing-samples.spec.tsx:74-76`'s existing assertion — banned canvas-painted strings absent
 * from `container.textContent` — is a real check but a DIFFERENT one: `demo as-of`/`synthetic
 * demo`/`TAPE OFF` are painted onto the CANVAS, never written to the DOM as text, so that
 * assertion would stay green whether or not `variant='ticker'` is actually passed (QA's I-4
 * finding: "dropping the prop would make the field drift ... with every suite still green").
 *
 * This file closes that gap by mocking `StructureFieldCanvas` (same idiom as
 * `StructureHeroPanel.spec.tsx:32-42`) and reading the ACTUAL props `StructureFieldSample` hands
 * it: `variant='ticker'` and the frozen honesty flags `{live:false, liveMid:null, source:'demo',
 * asOfSec:null}`.
 */
import type { StructureFieldCanvasProps } from '@/shared/charts/structure-field';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const captured: StructureFieldCanvasProps[] = [];

vi.mock('@/shared/charts/structure-field', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/charts/structure-field')>();
  return {
    ...actual,
    StructureFieldCanvas: (props: StructureFieldCanvasProps) => {
      captured.push(props);
      return <div data-testid="structure-field-canvas-stub" />;
    },
  };
});

afterEach(() => {
  cleanup();
  captured.length = 0;
});

describe('GATE Z I-4 (§7 item 5) — StructureFieldSample pins variant="ticker" and the frozen model (props, not DOM)', () => {
  it('StructureFieldCanvas receives variant="ticker" and {live:false, liveMid:null, source:"demo", asOfSec:null}', async () => {
    const { StructureFieldSample } = await import('./StructureFieldSample');
    render(
      <ThemeProvider theme={theme}>
        <StructureFieldSample />
      </ThemeProvider>,
    );

    expect(captured).toHaveLength(1);
    const props = captured[0];
    expect(props.variant).toBe('ticker');
    expect(props.model.live).toBe(false);
    expect(props.model.liveMid).toBeNull();
    expect(props.model.source).toBe('demo');
    expect(props.model.asOfSec).toBeNull();
  });
});
