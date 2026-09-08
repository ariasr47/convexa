/**
 * readLayout.render.spec.tsx — the render-level proof for the criteria PLAN's FE-9 Step 5 table
 * assigns to this file (SPEC §4.5, §2.6). Two tiers, deliberately:
 *
 * 1. UNIT-LEVEL, most of the file: the shipped presentational blocks (`DecisionCard`,
 *    `ActionRegion`, `QuietGateNote`, `LoadingBlock`, `SignedOutGate`, `PoweringCta`,
 *    `UnavailableBlock`) rendered directly with hand-built fixtures/presentations — fast, and
 *    every state this task can reach without a network is exercised this way.
 * 2. FULL-APP, only where the criterion is genuinely about HOST composition (rows 58/59: the A1c
 *    annex actually mounting beneath a produced read through `AiRecPanel.tsx`'s own wiring) — a
 *    small, purpose-built `installBackend`/`renderApp` pair (same shape as
 *    `reservedMark.render.spec.tsx`'s, extended to let a rec POST response carry its OWN `gate`
 *    field, which is what makes `(no_edge, fresh_trade)` reachable through the real hook rather
 *    than merely through `deriveAiRecPresentation` directly).
 */
import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import { theme } from '@/shared/theme/theme';
import { extras, extrasLight } from '@/shared/theme/tokens';
import type { RecCap, RecResponse, RecStatus, TickerBundle } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allRulesForClass, joinedStyleText } from '../_kit/emotionCssReader';
import {
  ActionRegion,
  LoadingBlock,
  PoweringCta,
  QuietGateNote,
  SignedOutGate,
  UnavailableBlock,
} from './AiRecPanelBlocks';
import { COPY, POWERING } from './copy';
import { DecisionCard } from './DecisionCard';
import { noTradeRec, recAllTraced, recNoneNamed } from './fixtures';
import {
  deriveAiRecPresentation,
  type AiRecPresentation,
  type PresentationInput,
} from './presentationPolicy';
import { readLayoutFor, type Annex, type BodyCase } from './readLayout';

afterEach(cleanup);

// ---- shared fixtures --------------------------------------------------------------------------

const cap: RecCap = { over_limit: false, remaining_today: 49, resets_at: '2026-06-27T04:00:00Z' };

const actions = (o: Partial<AiRecPresentation['actions']> = {}): AiRecPresentation['actions'] => ({
  directExport: false,
  analyze: false,
  askAnyway: false,
  retry: false,
  settings: false,
  signIn: false,
  reviewTrade: true,
  createOrder: true,
  analysis: true,
  refresh: false,
  dismiss: true,
  ...o,
});
const pres = (o: Partial<AiRecPresentation> = {}): AiRecPresentation => ({
  requestState: 'idle',
  resultState: 'fresh_trade',
  missingPositionFields: [],
  actions: actions(),
  ...o,
});

function renderThemed(node: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

// ---- amber census (rows 29/30) -----------------------------------------------------------------
// `cssVariables: true` (theme.ts:65) compiles `sx={{ color: 'primary.main' }}` to the
// mode-independent `var(--mui-palette-primary-main)`, so the FILL-grade amber is found by that
// literal text regardless of scheme. `extrasFor(theme).textAmber` is NOT CSS-var-bound — it bakes a
// literal hex at render time, so both scheme hexes are checked. Direct-text-node matching mirrors
// dom-testing-library's own `getNodeText` (direct TEXT_NODE children only), so a wrapping `Box`
// that merely contains an amber descendant is never miscounted as itself "spending" it.
function amberBearingTexts(container: HTMLElement): string[] {
  const css = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, '');
  const amberClasses = new Set<string>();
  const classBlocks = Array.from(css.matchAll(/\.([a-zA-Z0-9_-]+)\{([^}]*)\}/g));
  for (const [, cls, block] of classBlocks) {
    // Direct binding: `sx={{ color: 'primary.main' }}` compiles (cssVariables:true) to this exact
    // literal, mode-independent.
    if (block.includes('color:var(--mui-palette-primary-main)')) {
      amberClasses.add(cls);
      continue;
    }
    // ONE-HOP indirection: MUI's own Button/etc. component overrides declare `color:var(--X)` and
    // separately bind `--X:var(--mui-palette-primary-main)` in the SAME rule (e.g. the unthemed
    // default `color="primary"` on a `variant="text"`/`"outlined"` Button — found the hard way: a
    // naive direct-only match let `Full analysis & data` ship amber for a whole session undetected).
    const colorVarMatch = block.match(/(?:^|;)color:var\((--[a-zA-Z0-9-]+)\)/);
    if (colorVarMatch && block.includes(`${colorVarMatch[1]}:var(--mui-palette-primary-main)`)) {
      amberClasses.add(cls);
    }
  }
  for (const hex of [extras.textAmber, extrasLight.textAmber]) {
    const re = new RegExp(`\\.([a-zA-Z0-9_-]+)\\{[^}]*color:${hex}[^}]*\\}`, 'gi');
    for (const m of css.matchAll(re)) amberClasses.add(m[1]);
  }
  const out: string[] = [];
  container.querySelectorAll('*').forEach((el) => {
    const hasAmber = Array.from(el.classList).some((c) => amberClasses.has(c));
    if (!hasAmber) return;
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('')
      .trim();
    if (ownText) out.push(ownText);
  });
  return out;
}

// ---- non-text amber census (row 30, amended GATE Z 2026-09-05) --------------------------------
// The gap the FAIL named: `amberBearingTexts` above scans `color:` bindings on DIRECT-TEXT-bearing
// elements only — the TEXT half of row 30. This is the NON-text half, token-exact against the same
// emotion-CSS-rule reader `_kit/emotionCssReader.ts` uses (never `getAttribute('style')`; MUI `sx`
// compiles to classes). It classifies every rendered non-text amber binding into the amendment's
// CLOSED LIST OF THREE — `focus-ring` (the authored `:focus-visible` outline, a GLOBAL rule, not
// element-scoped), `in-flight` (the CircularProgress the loading state mounts, a `color:` spend
// with no own text node — currentColor reaching an SVG stroke), and `primary-fill` (a
// `variant="contained"` button defaulting to `color="primary"`, i.e. `primary.main` AS THE FILL
// GRADE the amendment names) — and everything else is `other`, the "fourth" the amended row
// forbids. A disabled contained button is EXCLUDED from `primary-fill`: probed against MUI's own
// generated CSS (`css-mp4dpo-...` base rule vs. the SEPARATE, higher-specificity
// `.css-mp4dpo-...Mui-disabled{background-color:var(--mui-palette-action-disabledBackground)}`
// block) — the disabled override wins the cascade and the button no longer renders amber, which is
// why QA's four named fills were all ENABLED buttons.
type NonTextAmberFinding =
  | { kind: 'focus-ring' }
  | { kind: 'in-flight' }
  | { kind: 'primary-fill'; label: string }
  | { kind: 'other'; label: string };

function boundToPrimaryMain(block: string, prop: string): boolean {
  const direct = new RegExp(`(?:^|;)${prop}:var\\(--mui-palette-primary-main\\)(?:;|$)`);
  if (direct.test(block)) return true;
  const indirect = block.match(new RegExp(`(?:^|;)${prop}:var\\((--[a-zA-Z0-9-]+)\\)`));
  return !!(indirect && block.includes(`${indirect[1]}:var(--mui-palette-primary-main)`));
}

function describeAmberElement(el: Element): string {
  const testId = el.getAttribute('data-testid');
  if (testId) return `${el.tagName.toLowerCase()}[data-testid="${testId}"]`;
  const muiClass = Array.from(el.classList).find((c) => c.startsWith('Mui') && c.includes('-'));
  const text = (el.textContent ?? '').trim().slice(0, 30);
  return `${el.tagName.toLowerCase()}.${muiClass ?? '?'}${text ? ` "${text}"` : ''}`;
}

function nonTextAmberFindings(container: HTMLElement): NonTextAmberFinding[] {
  const css = joinedStyleText().replace(/\s+/g, '');
  const findings: NonTextAmberFinding[] = [];

  // The one authored focus ring: a GLOBAL `:focus-visible` rule, not tied to any rendered
  // element's own class — recognised directly from the stylesheet text (present only when
  // `<CssBaseline />` is actually mounted in this particular render).
  const ringHexes = [extras.textAmber.toLowerCase(), extrasLight.textAmber.toLowerCase()];
  for (const m of css.matchAll(/:focus-visible[^{]*\{outline:2pxsolid(#[0-9a-fA-F]{6})/g)) {
    if (ringHexes.includes(m[1].toLowerCase())) findings.push({ kind: 'focus-ring' });
  }

  container.querySelectorAll('*').forEach((el) => {
    const ownClasses = Array.from(el.classList).filter((c) => c.startsWith('css-'));
    for (const cls of ownClasses) {
      for (const block of allRulesForClass(css, cls)) {
        if (boundToPrimaryMain(block, 'color')) {
          // A `color:` binding is the TEXT census's job when the element itself carries a direct
          // text node (`amberBearingTexts` above) — here we count it ONLY when it does not, which
          // is exactly the non-text currentColor spend (e.g. an SVG stroke).
          const ownText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join('')
            .trim();
          if (!ownText) {
            findings.push(
              el.classList.contains('MuiCircularProgress-root')
                ? { kind: 'in-flight' }
                : { kind: 'other', label: `${describeAmberElement(el)} color` },
            );
          }
        }
        if (boundToPrimaryMain(block, 'background-color')) {
          if (
            el.classList.contains('MuiButton-contained') &&
            !el.classList.contains('Mui-disabled')
          ) {
            findings.push({ kind: 'primary-fill', label: describeAmberElement(el) });
          } else if (!el.classList.contains('Mui-disabled')) {
            findings.push({ kind: 'other', label: `${describeAmberElement(el)} background-color` });
          }
        }
        for (const prop of ['border-color', 'fill', 'stroke'] as const) {
          if (boundToPrimaryMain(block, prop)) {
            findings.push({ kind: 'other', label: `${describeAmberElement(el)} ${prop}` });
          }
        }
      }
    }
  });
  return findings;
}

function fillCount(findings: NonTextAmberFinding[]): number {
  return findings.filter((f) => f.kind === 'primary-fill').length;
}
function otherFindings(findings: NonTextAmberFinding[]): NonTextAmberFinding[] {
  return findings.filter((f): f is { kind: 'other'; label: string } => f.kind === 'other');
}

// ---- rows 29/30/31 — DecisionCard, produced (trade) --------------------------------------------

describe('row 29/30 — the verdict word is the first content node and the only amber-as-text spend', () => {
  it('A3 (produced, trade): the verdict is the sole amber-bearing text; the panel spends nothing else', () => {
    const { container } = renderThemed(
      <DecisionCard
        rec={recAllTraced()}
        bundle={null}
        presentation={pres()}
        dataAge="older data"
        onReview={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const amber = amberBearingTexts(container);
    expect(amber).toEqual(['Trade · long']);
    // Row 30 (amended) — NON-text half: exactly one primary-action fill (`Review simulated
    // trade`, the state's ONE primary action), no fourth.
    const nonText = nonTextAmberFindings(container);
    expect(otherFindings(nonText)).toEqual([]);
    expect(fillCount(nonText)).toBe(1);
    // Row 29: the verdict is the first content node of the read's own body (after the fixed
    // attribution chrome above it — provenance and, when present, a composing degraded strip;
    // criterion 43 requires the strip itself precede the read).
    const bodyIds = [
      'decision-metadata',
      'decision-grid',
      'decision-thesis',
      'decision-evidence',
      'decision-actions',
    ];
    const verdict = screen.getByTestId('decision-verdict');
    for (const id of bodyIds) {
      expect(
        verdict.compareDocumentPosition(screen.getByTestId(id)) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('A4 (produced, no trade): NO element spends amber — no_trade is info-toned, never amber', () => {
    const { container } = renderThemed(
      <DecisionCard
        rec={noTradeRec()}
        bundle={null}
        presentation={pres({
          resultState: 'no_trade',
          actions: actions({ reviewTrade: false, createOrder: false }),
        })}
        dataAge="older data"
        onReview={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(amberBearingTexts(container)).toEqual([]);
    expect(screen.getByTestId('decision-verdict-word').textContent).toBe(COPY.noTrade.title);
    // Row 30 (amended) — `no_trade` renders NO primary-action fill either (`reviewTrade` and
    // `createOrder` are both false in this presentation): no verdict amber, no fill amber.
    const nonText = nonTextAmberFindings(container);
    expect(otherFindings(nonText)).toEqual([]);
    expect(fillCount(nonText)).toBe(0);
  });

  it('A5 composing over A3 (stale): the verdict is STILL the only amber text, beneath the warning strip', () => {
    const { container } = renderThemed(
      <DecisionCard
        rec={recAllTraced()}
        bundle={null}
        presentation={pres({ resultState: 'stale_newer_snapshot' })}
        dataAge="older data"
        onReview={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(amberBearingTexts(container)).toEqual(['Trade · long']);
    // Row 30 (amended) — composing a degraded strip over a produced trade does not add a SECOND
    // fill: still exactly the one `Review simulated trade` primary action.
    const nonText = nonTextAmberFindings(container);
    expect(otherFindings(nonText)).toEqual([]);
    expect(fillCount(nonText)).toBe(1);
    // Criterion 43: the strip precedes the read, and the read stays legible beneath it.
    const strip = screen.getByTestId('decision-degraded');
    const verdict = screen.getByTestId('decision-verdict');
    expect(strip.compareDocumentPosition(verdict) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('A2 (loading), A7 (signed out), A8 (add a key), A10 (request failure), A6a/A6b/missing-key (cooldown/cap/no-key) spend the amended closed list ONLY — no fourth, at most one fill', () => {
    // `expectedFill`/`expectedInFlight` name what QA's census actually found (or, for the new
    // cases, what the SAME `variant="contained"` default-primary pattern predicts): A7 and A8 are
    // TWO of QA's four named CTA fills (`Sign in to ask AI`, the powering CTA); A2 mounts the
    // in-flight indicator instead (no button at all); A10/A6a/A6b/missing-key render either an
    // OUTLINED/inherit-colour control or a DISABLED contained one, so zero fill either way.
    const cases: Array<{
      label: string;
      node: React.ReactElement;
      expectedFill: number;
      expectedInFlight: number;
    }> = [
      {
        label: 'A2',
        node: <LoadingBlock ticker="TSLA" readName="Default" path={null} model={null} />,
        expectedFill: 0,
        expectedInFlight: 1,
      },
      {
        label: 'A7',
        node: <SignedOutGate hasRec={false} promptText={null} onSignIn={vi.fn()} />,
        expectedFill: 1,
        expectedInFlight: 0,
      },
      {
        label: 'A8',
        node: <PoweringCta reason="no_key" onSettings={vi.fn()} />,
        expectedFill: 1,
        expectedInFlight: 0,
      },
      {
        label: 'A10',
        node: (
          <UnavailableBlock cap={cap} cooldownRemaining={0} retryAllowed={true} onRetry={vi.fn()} />
        ),
        expectedFill: 0,
        expectedInFlight: 0,
      },
      {
        label: 'A6a',
        node: (
          <ActionRegion
            cap={cap}
            cooldownRemaining={30}
            reasons={[]}
            compact={false}
            ticker="TSLA"
            requestState="cooldown"
            actions={actions({ analyze: false })}
            onGet={vi.fn()}
            onAskAnyway={vi.fn()}
          />
        ),
        expectedFill: 0,
        expectedInFlight: 0,
      },
      {
        label: 'A6b',
        node: (
          <ActionRegion
            cap={{ ...cap, over_limit: true }}
            cooldownRemaining={0}
            reasons={[]}
            compact={false}
            ticker="TSLA"
            requestState="daily_cap"
            actions={actions({ analyze: false })}
            onGet={vi.fn()}
            onAskAnyway={vi.fn()}
          />
        ),
        expectedFill: 0,
        expectedInFlight: 0,
      },
      {
        label: 'missing-key',
        node: (
          <ActionRegion
            cap={cap}
            cooldownRemaining={0}
            reasons={[]}
            compact={false}
            ticker="TSLA"
            requestState="missing_key"
            actions={actions({ analyze: false })}
            onGet={vi.fn()}
            onAskAnyway={vi.fn()}
          />
        ),
        // A DISABLED `variant="contained"` button — MUI's `.Mui-disabled` override wins the
        // cascade and repaints it `action.disabledBackground`, never amber (probed against the
        // real generated CSS above `nonTextAmberFindings` documents this).
        expectedFill: 0,
        expectedInFlight: 0,
      },
    ];
    for (const { label, node, expectedFill, expectedInFlight } of cases) {
      const { container, unmount } = renderThemed(node);
      expect(amberBearingTexts(container), `${label} must spend no amber AS TEXT`).toEqual([]);
      const nonText = nonTextAmberFindings(container);
      expect(otherFindings(nonText), `${label} must have no fourth non-text amber`).toEqual([]);
      expect(fillCount(nonText), `${label} primary-fill count`).toBe(expectedFill);
      expect(nonText.filter((f) => f.kind === 'in-flight').length, `${label} in-flight count`).toBe(
        expectedInFlight,
      );
      unmount();
      cleanup();
    }
  });

  it('A1a (idle) and A1b (idle · quiet gate) spend no amber as TEXT — but each still mounts exactly ONE primary fill (the primary control), no fourth', () => {
    for (const requestState of ['idle', 'no_edge'] as const) {
      const { container, unmount } = renderThemed(
        <ActionRegion
          cap={cap}
          cooldownRemaining={0}
          reasons={['score low']}
          compact={false}
          ticker="TSLA"
          requestState={requestState}
          actions={actions({ analyze: true, askAnyway: requestState === 'no_edge' })}
          onGet={vi.fn()}
          onAskAnyway={vi.fn()}
        />,
      );
      expect(amberBearingTexts(container)).toEqual([]);
      const nonText = nonTextAmberFindings(container);
      expect(otherFindings(nonText), `${requestState} must have no fourth non-text amber`).toEqual(
        [],
      );
      // QA's census found this exact fill in idle (`Analyze current snapshot`); `no_edge`'s idle
      // body renders the SAME enabled primary control (row 41 — "everything idle renders") plus
      // the outlined (color=inherit, never amber) `Ask anyway` footnote, so it is one fill too.
      expect(fillCount(nonText), `${requestState} primary-fill count`).toBe(1);
      unmount();
      cleanup();
    }
  });
});

// ---- row 31 — the four risk fields, grounding before prose, register never colour --------------

describe('row 31 — risk-field grounding renders before prose, Mono/dotted-Sans, never colour', () => {
  it('Invalidation (traced) is Mono; Target (untraced, recFabricated-shaped) is Sans with a dotted rule; neither ever colours', () => {
    const rec: RecResponse = {
      ...recAllTraced(),
      grounding: {
        ...recAllTraced().grounding!,
        fields: {
          ...recAllTraced().grounding!.fields,
          exit_target: { ...recAllTraced().grounding!.fields.exit_target, state: 'untraced' },
        },
      },
    };
    renderThemed(
      <DecisionCard
        rec={rec}
        bundle={null}
        presentation={pres()}
        dataAge="older data"
        onReview={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const invalidationVal = screen.getByText(String(rec.strategy!.invalidation_level));
    const targetVal = screen.getByText(String(rec.strategy!.exit_plan!.target));
    expect(getComputedStyle(invalidationVal).fontFamily).toContain('IBM Plex Mono');
    expect(getComputedStyle(targetVal).fontFamily).not.toContain('IBM Plex Mono');
    expect(getComputedStyle(targetVal).fontFamily).toContain('IBM Plex Sans');
    expect(getComputedStyle(targetVal).borderBottomStyle).toBe('dotted');
    expect(getComputedStyle(invalidationVal).borderBottomStyle).not.toBe('dotted');
    // Never in colour — grounding never adds a `color` to the risk-field value itself; the
    // structural signal is the type register (family + rule), not a hue.
    expect(getComputedStyle(invalidationVal).color).toBe(getComputedStyle(targetVal).color);
  });

  it('the risk grid (decision-grid) renders BEFORE any prose (decision-thesis)', () => {
    renderThemed(
      <DecisionCard
        rec={recAllTraced()}
        bundle={null}
        presentation={pres()}
        dataAge="older data"
        onReview={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const grid = screen.getByTestId('decision-grid');
    const thesis = screen.queryByTestId('decision-thesis');
    if (thesis) {
      expect(grid.compareDocumentPosition(thesis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

// ---- rows 32/33 — every named case reachable, no collapsing markers -----------------------------

describe('row 32/33 — every named case is reachable, and no two collapse onto the same primary line', () => {
  const capInput: RecCap = { over_limit: false, remaining_today: 1, resets_at: '' };
  const baseInput = (o: Partial<PresentationInput> = {}): PresentationInput => ({
    rec: null,
    loading: false,
    stale: false,
    signedIn: true,
    canCreateOrder: true,
    inAppEnabled: true,
    cap: capInput,
    cooldownRemaining: 0,
    readinessGateState: 'available',
    scenarioSelected: false,
    currentRiskInputs: null,
    ...o,
  });

  it.each<[string, PresentationInput]>([
    ['A1a idle', baseInput()],
    ['A2 loading', baseInput({ loading: true })],
    ['A3 fresh trade', baseInput({ rec: recAllTraced() })],
    ['A4 no trade', baseInput({ rec: noTradeRec() })],
    ['A6a cooldown', baseInput({ cooldownRemaining: 30 })],
    ['A6b daily cap', baseInput({ cap: { ...capInput, over_limit: true } })],
    ['A7 signed out', baseInput({ signedIn: false })],
    [
      'A8 add a key',
      baseInput({
        rec: {
          ...recAllTraced(),
          status: 'unavailable',
          strategy: null,
          unavailable_reason: 'no_key',
        },
      }),
    ],
    ['A1b idle · quiet gate', baseInput({ readinessGateState: 'no_fresh_edge' })],
    [
      'A1c annex over fresh trade',
      baseInput({ rec: recAllTraced(), readinessGateState: 'no_fresh_edge' }),
    ],
    [
      'A10 request failure',
      baseInput({
        rec: {
          ...recAllTraced(),
          status: 'unavailable',
          strategy: null,
          unavailable_reason: 'transport',
        },
      }),
    ],
    ['A5/A3 stale', baseInput({ rec: recAllTraced(), stale: true })],
    ['produced (trade)/incomplete', baseInput({ rec: recNoneNamed() })],
  ])('%s is a producible pair, and its ReadLayout is defined', (_label, input) => {
    const presentation = deriveAiRecPresentation(input);
    const layout = readLayoutFor(presentation.requestState, presentation.resultState);
    expect(layout.body).toBeTruthy();
  });

  it('the three degraded result states render three DIFFERENT lines through the SAME alert, never the same string', () => {
    const rec = recAllTraced();
    const lines = (
      ['stale_newer_snapshot', 'stale_at_generation', 'superseded_inputs'] as const
    ).map((resultState) => {
      const { unmount } = renderThemed(
        <DecisionCard
          rec={rec}
          bundle={null}
          presentation={pres({ resultState })}
          dataAge="older data"
          onReview={vi.fn()}
          onAnalysis={vi.fn()}
          onRefresh={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );
      const line = screen.getByTestId('decision-degraded').textContent;
      unmount();
      cleanup();
      return line;
    });
    expect(new Set(lines).size).toBe(3);
  });
});

// ---- row 34 — request failure never renders as idle or no-trade --------------------------------

describe('row 34 — A10 renders its own named line, never idle, never a no-trade verdict', () => {
  it('renders AI unavailable — try again, never the idle composer, never "No trade"', () => {
    renderThemed(
      <UnavailableBlock cap={cap} cooldownRemaining={0} retryAllowed onRetry={vi.fn()} />,
    );
    expect(screen.getByText(COPY.unavailable.title)).toBeInTheDocument();
    expect(screen.getByText(COPY.unavailable.body)).toBeInTheDocument();
    expect(screen.queryByText(COPY.noTrade.title)).toBeNull();
    expect(screen.queryByText(COPY.action.get)).toBeNull();
  });
});

// ---- row 36 — cooldown/cap never show each other's marker ---------------------------------------

describe('row 36 — a capped user is never shown a countdown; a cooling-down user is never shown a reset time', () => {
  it('cooldown (A6a) shows the countdown, never "resets"', () => {
    renderThemed(
      <ActionRegion
        cap={cap}
        cooldownRemaining={42}
        reasons={[]}
        compact={false}
        ticker="TSLA"
        requestState="cooldown"
        actions={actions()}
        onGet={vi.fn()}
        onAskAnyway={vi.fn()}
      />,
    );
    expect(screen.getByText(/Cooling down · 42s/)).toBeInTheDocument();
    expect(screen.queryByText(/resets/i)).toBeNull();
  });

  it('daily cap (A6b) shows a reset time, never a countdown', () => {
    renderThemed(
      <ActionRegion
        cap={{ ...cap, over_limit: true }}
        cooldownRemaining={0}
        reasons={[]}
        compact={false}
        ticker="TSLA"
        requestState="daily_cap"
        actions={actions()}
        onGet={vi.fn()}
        onAskAnyway={vi.fn()}
      />,
    );
    expect(screen.getByText(/Daily AI limit reached — resets/)).toBeInTheDocument();
    expect(screen.queryByText(/Cooling down/)).toBeNull();
  });
});

// ---- row 37 — the eight powering reasons never collapse -----------------------------------------

describe('row 37 — the eight powering reasons each render their own sentence; titles never collapse', () => {
  const reasons = [
    'no_key',
    'key_unusable',
    'key_rejected',
    'model_not_in_catalog',
    'model_unset',
    'oauth_expired',
    'oauth_unlinked',
    'subscription_unavailable',
  ];

  it('all eight titles are distinct strings', () => {
    const titles = reasons.map((reason) => {
      const { unmount } = renderThemed(<PoweringCta reason={reason} onSettings={vi.fn()} />);
      const title =
        screen.getByRole('button').previousElementSibling?.previousElementSibling?.textContent;
      unmount();
      cleanup();
      return title;
    });
    expect(new Set(titles).size).toBe(8);
  });

  it('every reason renders the SAME closed vocabulary object POWERING declares (no ad-hoc ninth reason)', () => {
    const keys = Object.keys(POWERING).filter((k) => k !== 'ownKey' && k !== 'subscription');
    expect(keys).toHaveLength(8);
  });
});

// ---- rows 38/39 — produced (no trade) is first-class, every control is real ---------------------

describe('rows 38/39 — no trade is first-class: same weight as a trade, no warning chrome, every control real', () => {
  it('no_trade renders with NO warning severity chrome and no disabled placeholder controls', () => {
    renderThemed(
      <DecisionCard
        rec={noTradeRec()}
        bundle={null}
        presentation={pres({
          resultState: 'no_trade',
          actions: actions({ reviewTrade: false, createOrder: false, refresh: true }),
        })}
        dataAge="older data"
        onReview={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    // No `severity="warning"`/error Alert anywhere in a plain no_trade render (no degraded strip).
    expect(screen.queryByTestId('decision-degraded')).toBeNull();
    // Every rendered button is enabled — no disabled placeholder naming a capability absent here.
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeEnabled();
    }
  });
});

// ---- rows 41/42 — idle vs quiet-gate arm, and the register split on `no_trade` ------------------

describe('rows 41/42 — idle carries no gate note; the quiet-gate arm carries everything idle renders plus the note', () => {
  it('idle: the primary control, no gate note, no Ask anyway', () => {
    renderThemed(
      <ActionRegion
        cap={cap}
        cooldownRemaining={0}
        reasons={[]}
        compact={false}
        ticker="TSLA"
        requestState="idle"
        actions={actions({ analyze: true })}
        onGet={vi.fn()}
        onAskAnyway={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: COPY.action.get })).toBeInTheDocument();
    expect(screen.queryByText(COPY.noEdge.title)).toBeNull();
    expect(screen.queryByRole('button', { name: COPY.action.askAnyway })).toBeNull();
  });

  it('A1b (no_edge, idle body): the SAME primary control PLUS the gate note, the Mono no_trade stance, and Ask anyway', () => {
    renderThemed(
      <ActionRegion
        cap={cap}
        cooldownRemaining={0}
        reasons={['score low']}
        compact={false}
        ticker="TSLA"
        requestState="no_edge"
        actions={actions({ analyze: false, askAnyway: true })}
        onGet={vi.fn()}
        onAskAnyway={vi.fn()}
      />,
    );
    // Everything idle renders: the primary control (disabled under the closed gate, but present).
    expect(screen.getByRole('button', { name: COPY.action.get })).toBeInTheDocument();
    // Plus the gate note, its Mono stance, and Ask anyway.
    expect(screen.getByText(/No fresh edge right now/)).toBeInTheDocument();
    expect(screen.getByTestId('ai-rec-quiet-gate-stance').textContent).toBe('no_trade');
    expect(screen.getByRole('button', { name: COPY.action.askAnyway })).toBeInTheDocument();
    // Row 42: the Mono stance never sits in the verdict slot/register — Archivo display is absent
    // here entirely (there is no mounted verdict in A1b).
    expect(screen.queryByTestId('decision-verdict-word')).toBeNull();
  });

  it('A1c (the annex, no stance line) vs A1b (idle body, with the stance line) — told apart by CONJUNCTION, never by the shared note string', () => {
    const { unmount: unmountA1b } = renderThemed(
      <QuietGateNote reasons={['score low']} onAskAnyway={vi.fn()} includeStanceLine />,
    );
    expect(screen.getByText(/No fresh edge right now/)).toBeInTheDocument();
    expect(screen.getByTestId('ai-rec-quiet-gate-stance')).toBeInTheDocument();
    unmountA1b();
    cleanup();

    renderThemed(
      <QuietGateNote reasons={['score low']} onAskAnyway={vi.fn()} includeStanceLine={false} />,
    );
    expect(screen.getByText(/No fresh edge right now/)).toBeInTheDocument();
    // Row 59: the composing arm renders NO Mono no_trade stance line.
    expect(screen.queryByTestId('ai-rec-quiet-gate-stance')).toBeNull();
  });

  it('MUTATION PROOF (d): identifying A1b by the shared note string ALONE is genuinely ambiguous against A1c — exactly what row 33 forbids', () => {
    const { container: a1b, unmount: unmountA1b } = renderThemed(
      <QuietGateNote reasons={['score low']} onAskAnyway={vi.fn()} includeStanceLine />,
    );
    const a1bHasNote = /No fresh edge right now/.test(a1b.textContent ?? '');
    // The REAL discriminator every other test in this file actually uses: the Mono stance line,
    // present in A1b — read BEFORE unmounting (the container empties on cleanup).
    const a1bHasStance = a1b.querySelector('[data-testid="ai-rec-quiet-gate-stance"]') !== null;
    unmountA1b();
    cleanup();

    const { container: a1c, unmount: unmountA1c } = renderThemed(
      <QuietGateNote reasons={['score low']} onAskAnyway={vi.fn()} includeStanceLine={false} />,
    );
    const a1cHasNote = /No fresh edge right now/.test(a1c.textContent ?? '');
    const a1cHasStance = a1c.querySelector('[data-testid="ai-rec-quiet-gate-stance"]') !== null;
    unmountA1c();
    cleanup();

    // POISON: a naive identifier keyed on the shared note string alone cannot discriminate the two
    // reachable cases — BOTH render it. A test (or a build report) that claimed "A1b is identified
    // by this string" would be equally "true" of A1c, which is precisely the collapse row 33
    // forbids ("no case is identified... by a marker another reachable case also renders").
    expect(a1bHasNote).toBe(true);
    expect(a1cHasNote).toBe(true);

    // The REAL discriminator: the Mono stance line, present in A1b, absent in A1c — a conjunction,
    // never the note alone.
    expect(a1bHasStance).toBe(true);
    expect(a1cHasStance).toBe(false);
  });
});

// ---- row 43 — a stale read renders an in-body warning strip WITH the icon, never a footnote ------

describe('row 43 — the degraded strip carries the icon and the read stays legible beneath it', () => {
  it('stale_at_generation renders `severity="warning"` WITH an icon; the other two degraded members render info, no icon', () => {
    const rec = recAllTraced();
    renderThemed(
      <DecisionCard
        rec={rec}
        bundle={null}
        presentation={pres({ resultState: 'stale_at_generation' })}
        dataAge="12 minutes"
        onReview={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const strip = screen.getByTestId('decision-degraded');
    expect(strip.querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('decision-verdict-word')).toBeInTheDocument();
  });
});

// ---- row 44 — an SSE drop alone never marks the AI read stale -----------------------------------

describe('row 44 — an SSE drop alone never marks the AI read stale (`stale` is a newer-REST-snapshot fact only)', () => {
  it('PresentationInput carries no stream-liveness field at all — `stale` is driven by `input.stale` only', () => {
    const capInput: RecCap = { over_limit: false, remaining_today: 1, resets_at: '' };
    const presentation = deriveAiRecPresentation({
      rec: recAllTraced(),
      loading: false,
      stale: false, // the REST snapshot has NOT advanced past the pin
      signedIn: true,
      canCreateOrder: true,
      inAppEnabled: true,
      cap: capInput,
      cooldownRemaining: 0,
      readinessGateState: 'available',
      scenarioSelected: false,
      currentRiskInputs: null,
    });
    // Confirmed already at the integration level (`ai-rec.risk.spec.tsx:1110`, "SSE drop leaves the
    // rec untouched"); reasserted here at the presentation layer this file owns: no stream/live field
    // reaches `PresentationInput` at all, so an SSE drop is structurally unable to flip this.
    expect(presentation.resultState).toBe('fresh_trade');
    expect(presentation.resultState).not.toBe('stale_newer_snapshot');
  });
});

// ---- rows 58/59 — the runtime companion: (no_edge, fresh_trade) actually renders both -----------

function makeStatus(over: Partial<RecStatus> = {}): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
    ...over,
  };
}

/** Trimmed fetch-mock harness (same shape as `reservedMark.render.spec.tsx`'s own), extended so the
 *  rec POST response can carry its OWN `gate` (the field `applyGating` reads on success) — the
 *  mechanism that keeps `readinessGateState` at `no_fresh_edge` AFTER a produced read lands, which
 *  is what makes `(no_edge, fresh_trade)` reachable through the REAL host, not merely through
 *  `deriveAiRecPresentation` called directly. */
function installBackend(rec: RecResponse, status: RecStatus, bundle: TickerBundle = makeBundle()) {
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/api/auth/session')) {
        return json({
          authenticated: true,
          user: { id: 'u-1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        });
      }
      if (url.includes('/api/positions/sim-trade/gate')) return json({ allowed: true });
      if (url.includes('/api/ticker/')) return json(bundle);
      if (url.includes('/api/recommendation/status/')) return json(status);
      if (url.includes('/api/recommendation/') && method === 'POST') return json(rec);
      if (url.includes('/api/personas')) return json(PRESETS);
      if (url.includes('/api/contract/')) return json(null);
      if (url.includes('/history'))
        return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
      throw new Error(`Unexpected fetch in readLayout.render test: ${url}`);
    }),
  );
}

function renderApp() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/ticker/TSLA']}>
      <App />
    </MemoryRouter>,
  );
  return user;
}

const panel = () => screen.getByTestId('ai-rec-panel');
async function settle() {
  await screen.findByText('Call wall');
  await screen.findByText('AI recommendation · TSLA');
}

function producedNoEdgeRec(): RecResponse {
  return {
    ...recAllTraced(),
    // The pinned read's OWN gate snapshot still reports the closed readiness — "the market moved
    // after I got my read" (SPEC §4.5's framing of the corrected no_edge disposition).
    gate: { state: 'no_fresh_edge', cooldown_remaining_seconds: 0, reasons: ['score low'] },
  };
}

describe('rows 58/59 — (no_edge, fresh_trade), the runtime companion through the REAL host', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('the produced read AND the A1c annex both render — never as an ordinary fresh read, never replacing it', async () => {
    installBackend(
      producedNoEdgeRec(),
      makeStatus({
        gate: { state: 'no_fresh_edge', cooldown_remaining_seconds: 0, reasons: ['score low'] },
      }),
    );
    const user = renderApp();
    await settle();
    const askAnyway = await within(panel()).findByRole('button', { name: COPY.action.askAnyway });
    await user.click(askAnyway);

    // The read stays present and readable.
    await within(panel()).findByTestId('decision-verdict-word');
    expect(within(panel()).getByTestId('decision-verdict-word').textContent).toBe('Trade · long');

    // The annex renders IN BODY, beneath the read — never idle, never a bare no_edge wall.
    const annex = within(panel()).getByTestId('ai-rec-quiet-gate');
    const verdict = within(panel()).getByTestId('decision-verdict');
    expect(verdict.compareDocumentPosition(annex) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Row 59: NO Mono no_trade stance line while a verdict is mounted.
    expect(within(annex).queryByTestId('ai-rec-quiet-gate-stance')).toBeNull();
    expect(within(panel()).queryByText('no_trade')).toBeNull();

    // The panel is never rendered as an ordinary fresh read: the annex is visible alongside it.
    expect(within(panel()).getByText(/No fresh edge right now/)).toBeInTheDocument();
  });

  it('MUTATION PROOF (b): a wrong destination (returning the idle body, dropping the annex) is exactly what this test would catch', () => {
    // readLayout.spec.ts already runs the poison on the pure function; here the runtime host proof
    // is that `presentation.requestState === 'no_edge'` is the ONLY branch condition gating the
    // annex in `AiRecPanel.tsx` — asserted structurally against the pure mapping, not re-narrated.
    const layout = readLayoutFor('no_edge', 'fresh_trade');
    const wrong: { body: BodyCase; annexes: Annex[] } = { body: 'A1a', annexes: [] };
    expect(layout).not.toEqual(wrong);
  });
});

// ---- row 47 (scoped) — the new annex does not disturb the sibling widgets ------------------------

describe('row 47 (scoped to this task’s own new behaviour) — the A1c annex does not disturb the desk', () => {
  it('the ladder, the read strip anchor, and the tape stay mounted while the annex renders', async () => {
    installBackend(
      producedNoEdgeRec(),
      makeStatus({
        gate: { state: 'no_fresh_edge', cooldown_remaining_seconds: 0, reasons: ['score low'] },
      }),
    );
    const user = renderApp();
    await settle();
    await user.click(await within(panel()).findByRole('button', { name: COPY.action.askAnyway }));
    await within(panel()).findByTestId('ai-rec-quiet-gate');
    expect(screen.getByText('Call wall')).toBeInTheDocument();
  });
});
