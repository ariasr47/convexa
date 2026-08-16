# AI Recommendation Decision Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root and keep this project-owned plan at `.spire/clusters/tech/contracts/ai-rec-decision-card/PLAN.md`.

**Goal:** Replace the report-like AI recommendation with a decision-first card and a non-mutating desktop drawer/mobile sheet while preserving current gates, provenance, grounding, export, and shared simulated-entry boundaries.

**Architecture:** `AiRecPanel` remains the request-state host. A pure `deriveAiRecPresentation` function owns named request/result states and allowed actions; `DecisionCard` and `AnalysisSurface` consume that policy plus the pinned `RecResponse` and current bundle. Existing `StateExportDrawer` and both variants of the one shared `TradeEntryDialog` remain the only export and simulated-entry surfaces.

**Tech Stack:** React 19, TypeScript 5.9, MUI 9/Emotion, Nx 23, Vitest 4 + Testing Library, Playwright 1.62.

**Spec:** `.spire/clusters/tech/contracts/ai-rec-decision-card/SPEC.md`

## Global Constraints

The interface deliberately has no `## Conformance spec` block. Its complete binding posture is copied verbatim:

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be empty

This feature changes frontend composition, labels, interaction state, and action gating only. It
introduces no endpoint, route, request field, response field, field-presence rule, status token,
stream event, persistence shape, AI prompt, grounding rule, cap rule, score input, tier, gate, or
fingerprint behavior.

The current recommendation response, ticker bundle, persona/scenario status, grounding and cap data,
request export, risk inputs, auth/key/cooldown/cap state, and simulated-entry callbacks are consumed
unchanged. There is no conformance block because this feature is explicitly `NO_BACKEND_CHANGE`.

- Own only `apps/dashboard/**` and `apps/dashboard-e2e/**`. Do not edit `apps/api/**`, `libs/api/**`, prompts, schemas, scoring, fingerprints, persistence, or contracts.
- Keep `useAiRecommendation` as the only pinned-read owner. Analysis open/close/read performs no request, recomputation, alternate cache, or response copy.
- Keep `StateExportDrawer` as the export implementation and `features/trading/TradeEntryDialog.tsx` as the only simulated-entry component.
- Every result button consumes `deriveAiRecPresentation`; buttons do not re-derive freshness, completeness, auth, cap, cooldown, or risk-input changes.
- When loading hides a retained result, direct request-export access remains visible. Review, order, and analysis actions are false while loading even if `rec` still contains an older produced read.
- Completeness requires nonblank structure, at least one finite strike, nonblank expiration, and nonblank entry trigger. Horizon, confidence, stop, target, max risk, and size are not completeness gates.
- Degraded precedence is `stale_newer_snapshot → stale_at_generation → superseded_inputs → incomplete_trade`. Render one reason; all applicable safety predicates still deny both simulated actions.
- Use current theme/type/elevation tokens and `extrasFor(theme)`. Add no hex, palette role, keyframe, animation family, convex arc, client-derived count/score, inferred “near,” rewritten thesis, or confidence interpretation.
- Preserve closed absence/grounding vocabularies and server-authored typography/counts byte-for-byte.
- Baseline on 2026-08-15: `orders.risk.spec.tsx` is already red (8/9; `act_confirm_live_cross_fill_creates_exactly_one_position_with_provenance` expects stop `3`, receives `null`). Re-run before Task 4; if unchanged without a feature diff, report it as pre-existing and do not alter grounding/prefill under this feature.
- Preserve unrelated workspace changes; do not revert other workers.

## Tracks and exact ownership

| Track | Tasks | Ownership |
|---|---:|---|
| Backend | 0 | Intentional no-op; `apps/api` and `libs/api` feature diffs stay empty. |
| Frontend | 5 | Policy, card, analysis, host/flows, structural/browser enforcement. |
| Verification | 1 | Read-only checks after frontend commits. |

Create under `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/`: `presentationPolicy.ts` + spec, `DecisionCard.tsx` + spec, `AnalysisSurface.tsx` + spec, and `decisionCard.structural.spec.ts`. Modify `AiRecPanel.tsx`, `copy.ts`, `reasoning.tsx`, the existing AI-rec specs, `features/trading/orders/copy.ts`, `features/trading/orders/orders.risk.spec.tsx`, and `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts`. Do not modify `TickerDashboard.tsx`, `useTickerTradeFlows.ts`, `StateExportDrawer.tsx`, `TradeEntryDialog.tsx`, stores, or `@convexa/api`.

---

## Frontend Track

### Task 1: Pure presentation/action policy

**Files:** create `presentationPolicy.ts` and `presentationPolicy.spec.ts`.

**Interfaces:** consume `RecResponse | null`, current `RiskInputs`, stale/auth/key/cap/cooldown/gate/scenario flags; produce `deriveAiRecPresentation(input): AiRecPresentation`. `AiRecPanel`/`DecisionCard` depend on its `requestState`, `resultState`, `missingPositionFields`, and action booleans.

**Reviewer probe:** poison every safety input alone and together. No SSE/live concept may enter the signature/source.

- [ ] **Step 1: Write 18 failing matrix tests**

Cover idle, loading, signed-out, three key states, cooldown, cap, no-edge, unavailable retry allowed/blocked, fresh complete, stale, stale-born, superseded, incomplete, no-trade, and soft-fields-absent. Include:

```ts
const rec = recAllTraced();
rec.stale_born = true;
rec.strategy = {
  ...rec.strategy!,
  structure: null,
  strikes: [Number.NaN],
  expiration: null,
  entry_trigger: ' ',
};
const currentRiskInputs = {
  ...rec.sent!.risk_inputs!,
  account_size: (rec.sent!.risk_inputs!.account_size ?? 0) + 1,
};
const view = deriveAiRecPresentation({
  rec,
  loading: false,
  stale: true,
  signedIn: true,
  inAppEnabled: true,
  cap: { over_limit: false, remaining_today: 1, resets_at: '' },
  cooldownRemaining: 0,
  effectiveGateState: 'available',
  scenarioSelected: false,
  currentRiskInputs,
});
expect(view.resultState).toBe('stale_newer_snapshot');
expect(view.missingPositionFields).toEqual([
  'Structure', 'Strike(s)', 'Expiration', 'Entry trigger',
]);
expect(view.actions.reviewTrade).toBe(false);
expect(view.actions.createOrder).toBe(false);
expect(view.actions.analysis).toBe(true);
expect(String(deriveAiRecPresentation)).not.toMatch(/LiveUpdate|streamOffline|EventSource|SSE/);
```

The loading-with-retained-result case asserts `directExport: true`, `reviewTrade: false`,
`createOrder: false`, and `analysis: false` so the old result cannot act while the transparency floor
remains reachable.

- [ ] **Step 2: Verify RED**

Run from `apps/dashboard`: `npx vitest run src/app/pages/ticker/widgets/ai-rec/presentationPolicy.spec.ts`

Expected: exit 1, unresolved `./presentationPolicy`.

- [ ] **Step 3: Implement the exact public shape and precedence**

```ts
export type AiRecRequestState =
  | 'idle' | 'loading' | 'signed_out' | 'missing_key'
  | 'shared_allowance_exhausted' | 'shared_key_unavailable'
  | 'cooldown' | 'daily_cap' | 'no_edge' | 'unavailable';
export type AiRecResultState =
  | 'fresh_trade' | 'no_trade' | 'stale_newer_snapshot'
  | 'stale_at_generation' | 'superseded_inputs' | 'incomplete_trade';
export type MissingPositionField =
  | 'Structure' | 'Strike(s)' | 'Expiration' | 'Entry trigger';

export interface PresentationInput {
  rec: RecResponse | null;
  loading: boolean;
  stale: boolean;
  signedIn: boolean;
  inAppEnabled: boolean;
  cap: RecCap;
  cooldownRemaining: number;
  effectiveGateState: string;
  scenarioSelected: boolean;
  currentRiskInputs: RiskInputs | null | undefined;
}
export interface AiRecPresentation {
  requestState: AiRecRequestState;
  resultState: AiRecResultState | null;
  missingPositionFields: MissingPositionField[];
  actions: {
    directExport: boolean; analyze: boolean; askAnyway: boolean;
    retry: boolean; settings: boolean; signIn: boolean;
    reviewTrade: boolean; createOrder: boolean; analysis: boolean;
    refresh: boolean; dismiss: boolean;
  };
}
```

Implement missing fields with `trim()` and `strikes.some(Number.isFinite)`. Derive supersession with existing `riskInputsSuperseded(rec.sent?.risk_inputs, currentRiskInputs)`. Apply the global precedence. Request-state precedence is loading → signed-out → response key/unavailable → deployment key → cap → cooldown → no-edge → idle; scenario selection bypasses only deployment-key/cap/cooldown exactly as today. `directExport = loading || !produced`; review/order require `fresh_trade && signedIn && !loading`; analysis/dismiss require `produced && !loading`; refresh requires a degraded result plus idle request gate.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npx vitest run src/app/pages/ticker/widgets/ai-rec/presentationPolicy.spec.ts`

Expected: `1 passed` file, `18 passed` tests.

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/presentationPolicy.*
git commit -m "test: centralize AI recommendation action policy"
```

### Task 2: Decision-first card and approved copy

**Files:** create `DecisionCard.tsx` + spec and `AccessibleHelp.tsx`; modify `copy.ts`, `reasoning.tsx`, `GroundingNote.tsx`, and `AiRecPanel.tsx` only enough to mount the fresh card and make result help reachable.

**Interfaces:** `DecisionCard({ rec, bundle, presentation, dataAge, onReview, onCreateOrder, onAnalysis, onRefresh, onDismiss })`. It renders produced reads only, has no request state, and contains no long rationale.

**Reviewer probe:** inspect DOM order and poison free prose/bundle values. Verdict/metadata use only named response fields; grounding counts are never recounted.

- [ ] **Step 1: Write 10 failing component tests**

Cover fixed hierarchy, structured-only verdict, grid order, exact/new and absent/old labels, no inline long-form rationale, no-trade, incomplete names, one degraded strip, byte-faithful grounding, and scripted framing. Assert ordered test ids `decision-context`, `decision-verdict`, `decision-metadata`, `decision-thesis`, `decision-grid`, `decision-evidence`, `decision-actions`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx`

Expected: exit 1, unresolved `./DecisionCard`.

- [ ] **Step 3: Centralize the five replacements**

```ts
action: {
  analyze: 'Analyze current snapshot',
  askAnyway: 'Ask anyway',
  retry: 'Retry',
  reviewTrade: 'Review simulated trade',
  createOrder: 'Create sim order',
  analysis: 'Full analysis & data',
  requestExport: 'What’s sent to the AI',
  refresh: 'Refresh analysis',
  dismiss: 'Dismiss',
},
```

Keep all existing closed absence, grounding, cap, key, cooldown, quota, scenario, auth, export, and confirmation meanings. Update adjacent stale/no-trade/sizing/tooltips that still say `Accept`, `ghost trade`, `Get a fresh recommendation`, or `Show full analysis` so the result surface uses one vocabulary. Add `incompleteAction(labels)` using the existing `notActionableLine` wording and `Nothing is saved until you review and confirm.`. The negative copy test scans rendered result text and accessible names for the three retired labels and `ghost trade`.

- [ ] **Step 4: Implement the fixed card composition**

Move existing pure display helpers `Provenance`, `RiskField`, `PlanField`, and `ConvictionSlot` from `AiRecPanel` without changing their closed-literal behavior. Compose:

```tsx
const maxRiskLiteral = fieldLiteral({
  decision: strategy.decision,
  value: strategy.max_risk,
  reason: rec.field_reasons?.max_risk,
});
const invalidationLiteral = fieldLiteral({
  decision: strategy.decision,
  value: strategy.invalidation_level,
  reason: rec.field_reasons?.invalidation_level,
});
const entryTriggerLiteral = planFieldLiteral({
  decision: strategy.decision,
  value: strategy.entry_trigger,
  reason: rec.field_reasons?.entry_trigger,
});
const targetLiteral = fieldLiteral({
  decision: strategy.decision,
  value: strategy.exit_plan?.target,
  reason: rec.field_reasons?.exit_target,
});

<Box data-testid="ai-rec-decision-card">
  <DecisionContext data-testid="decision-context" rec={rec} state={presentation.resultState} dataAge={dataAge} />
  <DecisionVerdict data-testid="decision-verdict" strategy={strategy} />
  <DecisionMetadata data-testid="decision-metadata" rec={rec} bundle={bundle} />
  <Typography data-testid="decision-thesis">{deriveReasoning(strategy).lead}</Typography>
  {strategy.decision === 'trade' && (
    <Box data-testid="decision-grid" sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
      gap: 1,
    }}>
      <RiskField label="Max risk" literal={maxRiskLiteral} valueTip={MAX_RISK_TIP} />
      <RiskField label="Invalidation" literal={invalidationLiteral}
        clause={<FigureClause field={rec.grounding?.fields.invalidation_level} testId="clause-invalidation" />} />
      <PlanField label="Entry" literal={entryTriggerLiteral} />
      <RiskField label="Target" literal={targetLiteral}
        clause={<FigureClause field={rec.grounding?.fields.exit_target} testId="clause-target" />} />
    </Box>
  )}
  <DecisionEvidence data-testid="decision-evidence" rec={rec} />
  <DecisionActions data-testid="decision-actions" presentation={presentation}
    onReview={onReview} onCreateOrder={onCreateOrder}
    onAnalysis={onAnalysis} onRefresh={onRefresh} onDismiss={onDismiss} />
</Box>
```

`DecisionEvidence` renders exactly one `GroundingNote` and at most the existing cited-contract/cap indicators; levels, candidates, full grounding clauses, risk inputs, and request detail move to analysis. No-trade renders exact verdict + lead + supplied re-engagement, analysis/dismiss, no grid/review/order. Incomplete renders missing names once and retains analysis.

`AccessibleHelp({ label, text })` is the single focusable tooltip trigger used by moved field and
grounding help. It renders an `IconButton` with `aria-label={label}` and the existing info icon inside a
MUI `Tooltip`; the theme supplies the coarse-pointer 44px floor and focus-visible ring. Replace bare
`InfoOutlinedIcon` tooltip children in the decision-card path. Any retained tooltip on a provenance
chip must either have a keyboard-focusable trigger with an accessible name or move its explanation into
visible/assistive text. Component tests Tab through every help trigger and assert its accessible name.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx vitest run src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx`

Expected: `1 passed` file, `10 passed` tests.

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AccessibleHelp.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts apps/dashboard/src/app/pages/ticker/widgets/ai-rec/reasoning.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/GroundingNote.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx
git commit -m "feat: add decision-first AI recommendation card"
```

### Task 3: Analysis drawer/mobile sheet

**Files:** create `AnalysisSurface.tsx` + spec; modify `reasoning.tsx`.

**Interfaces:** consumes pinned `RecResponse`/bundle by reference plus `open/onClose/onViewExport`; produces no request/store setter. The export callback first closes analysis and then opens existing `StateExportDrawer`, so two modal drawers never stack.

**Reviewer probe:** trade/no-trade/incomplete/pre-grounding/scripted fixtures; repeated open/close; unchanged request/store counts and pinned text; exact focus return.

- [ ] **Step 1: Write 8 failing tests**

Cover ordered summary/provenance → rationale → management/re-engagement → levels/numbers → cited/grounding/cap → as-sent inputs → export entry; full rationale; partial-data safety; export callback; open focus; Tab/Shift+Tab containment; Escape; focus return.

```tsx
const opener = screen.getByRole('button', { name: 'Full analysis & data' });
await user.click(opener);
const dialog = await screen.findByRole('dialog', { name: 'Full analysis & data · TSLA' });
expect(within(dialog).getByRole('button', { name: 'Close analysis' })).toHaveFocus();
await user.tab();
expect(dialog).toContainElement(document.activeElement);
await user.keyboard('{Escape}');
expect(screen.queryByRole('dialog')).toBeNull();
expect(opener).toHaveFocus();
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.spec.tsx`

Expected: exit 1, unresolved `./AnalysisSurface`.

- [ ] **Step 3: Add explicit expanded analysis mode to reasoning**

Add `expanded?: boolean` to `ReasoningSection`. Use `const detailOpen = expanded || open`; omit its toggle when expanded; keep current lists/prose/disclaimer text and styles. The card no longer mounts `ReasoningSection`.

```tsx
{detail && (
  <Box>
    {!expanded && (
      <Button onClick={() => setOpen((value) => !value)} aria-expanded={detailOpen}>
        {detailOpen ? COPY.reasoning.showLess : COPY.reasoning.showMore}
      </Button>
    )}
    <Collapse in={detailOpen}>
      <ReasoningProse text={detail} />
    </Collapse>
  </Box>
)}
```

- [ ] **Step 4: Implement the modal**

Define the private helpers in the same file with these exact signatures: `analysisTitle(ticker: string): string`, `AnalysisSummary({ rec }: { rec: RecResponse })`, `GroundingDetail({ grounding }: { grounding: Grounding | null | undefined })`, and `AsSentInputs({ riskInputs, openPositions }: { riskInputs: RiskInputs | null | undefined; openPositions: OpenPositionsDigest | null | undefined })`. `analysisTitle` returns `Full analysis & data · {ticker}`; the three renderers use existing closed lookups and supplied values only.

```tsx
<Drawer
  anchor="right"
  open={open}
  onClose={onClose}
  aria-labelledby="ai-rec-analysis-title"
  slotProps={{ paper: {
    role: 'dialog',
    'aria-modal': true,
    sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100vw',
      overflow: 'hidden', bgcolor: 'background.paper' },
  } }}
>
  <Stack sx={{ height: '100%', minHeight: 0 }}>
    <Stack direction="row" sx={{
      position: 'sticky', top: 0, zIndex: 1, alignItems: 'center',
      justifyContent: 'space-between', px: 2.5, py: 2,
      bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider',
    }}>
      <Typography id="ai-rec-analysis-title" component="h2" variant="subtitle1">
        {analysisTitle(ticker)}
      </Typography>
      <IconButton autoFocus aria-label="Close analysis" onClick={onClose}><CloseIcon /></IconButton>
    </Stack>
    <Stack data-testid="analysis-content" spacing={2}
      sx={{ minHeight: 0, overflowX: 'hidden', overflowY: 'auto', p: 2.5 }}>
      <AnalysisSummary rec={rec} />
      <ReasoningSection strategy={rec.strategy} suppressLead expanded />
      <LevelsStrip bundle={bundle} />
      <NumbersSaidStrip candidates={rec.sent?.candidates}
        move={bundle?.market_state.straddle_move}
        citedExpiration={rec.strategy.expiration} />
      <CitedContractLine cited={rec.cited_contract}
        asOf={rec.sent?.candidates?.as_of ?? null} />
      <GroundingDetail grounding={rec.grounding} />
      <CapAnnotation capCheck={rec.cap_check} />
      <AsSentInputs riskInputs={rec.sent?.risk_inputs}
        openPositions={rec.sent?.open_positions} />
      <Button onClick={() => { onClose(); onViewExport(); }}>{COPY.action.requestExport}</Button>
    </Stack>
  </Stack>
</Drawer>
```

`AnalysisSummary` displays only pinned persona/as-of/scripted/simulated provenance and supplied verdict metadata. `GroundingDetail` uses current closed lookups and server counts. `AsSentInputs` prints supplied values/absence literals without arithmetic/parsing. The paper has one scroll region; sections do not scroll.

Render the drawer only as `open && rec !== null`; if the pinned result disappears while open, close the
surface without dereferencing a missing response. The export-transition test asserts the analysis dialog
is gone before the existing export drawer appears.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx vitest run src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.spec.tsx`

Expected: `1 passed` file, `8 passed` tests.

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/reasoning.tsx
git commit -m "feat: move recommendation detail into analysis surface"
```

### Task 4: Integrate host gates and existing simulated flows

**Files:** modify `AiRecPanel.tsx`, `AiRecPanel.reasoning.spec.tsx`, `ai-rec.risk.spec.tsx`, `ai-rec.grounding.spec.tsx`, `ai-rec.absence.spec.tsx`, `reservedMark.render.spec.tsx`, `features/trading/orders/copy.ts`, `features/trading/orders/orders.risk.spec.tsx`.

**Interfaces:** keep all current `AiRecPanel` props. `onAccept(rec, personaName)` and `onAct(rec, personaName)` still open current shared dialog variants; `onViewExport(personaId)` still opens `StateExportDrawer`. No page/trade-hook/dialog/store/client edit.

**Reviewer probe:** exercise every host state. Policy booleans are the sole button conditions; current server gate still runs on click; cancel/confirm never dismisses, refreshes, or rewrites pinned read.

- [ ] **Step 1: Add failing cancel/confirm flow assertions**

Update label queries through `COPY`. Add review cancel/confirm and order cancel/confirm cases. Each captures `ai-rec-decision-card.textContent` and pinned fingerprint/as-of/persona; cancel asserts zero writes, confirm asserts exactly one existing position/order write, and all assert unchanged card.

```tsx
const before = within(panel()).getByTestId('ai-rec-decision-card').textContent;
await user.click(within(panel()).getByRole('button', { name: COPY.action.reviewTrade }));
await user.click(screen.getByRole('button', { name: 'Cancel' }));
expect(allPositions()).toHaveLength(0);
expect(within(panel()).getByTestId('ai-rec-decision-card').textContent).toBe(before);
```

- [ ] **Step 2: Verify RED**

From `apps/dashboard`:

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec src/app/features/trading/orders/orders.risk.spec.tsx src/app/features/trading/TradeEntryDialog.risk.spec.tsx src/app/features/trading/shared-entry.flow.spec.tsx
```

Expected: new assertions fail because policy/analysis/new labels are not fully hosted. Keep the recorded baseline order failure separate.

- [ ] **Step 3: Derive once and mount card/analysis**

```tsx
const currentRiskInputs = useSettings().riskInputs;
const presentation = deriveAiRecPresentation({
  rec, loading, stale, signedIn, inAppEnabled, cap, cooldownRemaining,
  effectiveGateState, scenarioSelected, currentRiskInputs,
});
const [analysisOpen, setAnalysisOpen] = useState(false);
const producedRec = rec?.status === 'produced' && rec.strategy ? rec : null;
```

Render direct export only for `actions.directExport`. Render `DecisionCard` only for `producedRec && !loading`. Pass existing auth-guarded `onAccept` only to `onReview` and existing `onAct` only when `actions.createOrder`. Keep a compact, accessible `Next read persona` selector visible for signed-in users before and after production; remove the permanent helper paragraph, retain its explanation as keyboard/pointer help, and render `Persona · {rec.persona.name}` from the response inside `DecisionContext`. Changing the next-read selector must neither call `ai.request` nor relabel the pinned result. Apply the same compact treatment to the scenario selector only when its existing flag allows it. Mount:

```tsx
<AnalysisSurface open={analysisOpen} ticker={ticker} rec={producedRec} bundle={bundle}
  onClose={() => setAnalysisOpen(false)}
  onViewExport={() => onViewExport(producedRec?.persona.id ?? null)} />
```

Delete `RecResult` and duplicated freshness/completeness/action derivation. Convert `ActionRegion` into a switch on `presentation.requestState` only:

| State | Render |
|---|---|
| idle | `Analyze current snapshot` + direct export |
| loading | existing honest progress + direct export; no verdict/duplicate/sim action |
| signed_out | existing sign-in gate + policy-permitted export; no persona/quota/key/request/sim action |
| three key states | existing distinct explanation + Settings + direct export |
| cooldown/daily_cap | existing server-vouched values + direct export; no request |
| no_edge | existing explanation + `Ask anyway` + direct export; no verdict |
| unavailable | honest error + policy-allowed `Retry` + direct export |

Result detail is only `Full analysis & data`; `What’s sent to the AI` is direct only with no produced read and inside analysis for retained reads.

- [ ] **Step 4: Update existing tests without weakening invariants**

Reasoning/grounding detail tests click `Full analysis & data` before full-rationale/levels assertions; one-line thesis stays card-level. Absence tests prove missing position fields deny actions while soft-field absences do not. Prefill withholding and reserved-mark cardinality remain exact. Delete obsolete `ACT_LABEL` from orders copy; keep order tooltip/dialog copy.

- [ ] **Step 5: Verify GREEN and commit**

Re-run Step 2. Expected feature inventory after Task 4: `19 passed` files/`277 passed` tests if the pre-existing order assertion is externally resolved; otherwise stop with that one baseline failure named.

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec apps/dashboard/src/app/features/trading/orders/copy.ts apps/dashboard/src/app/features/trading/orders/orders.risk.spec.tsx
git commit -m "feat: integrate decision card with existing simulated flows"
```

### Task 5: Structural and real-browser enforcement

**Files:** create `decisionCard.structural.spec.ts`; modify `DecisionCard.tsx`, `AnalysisSurface.tsx`, `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts`.

**Interfaces:** 1440×900 normal two-column ticker; 393×852 mobile; dark/light; modal focus contract.

**Reviewer probe:** poison each forbidden token once, observe red, revert. Browser checks require real result/card/detail nodes so blank/error pages cannot pass.

- [ ] **Step 1: Write six source guards and five Playwright checks**

Source guards assert production code has no hex, keyframe/animation, `LiveUpdate/streamOffline/EventSource`, old three result labels, alternate dialog import, or feature-owned API/client file. Browser group `AI recommendation decision card`:

1. 393 dark/light: result → analysis; sheet width ≤ viewport, one title/close, one vertical analysis scroll region, no page overflow.
2. 1440×900 dark/light: verdict/grid/review visible without card-internal scroll; drawer <60% viewport and ticker context remains visible.
3. Keyboard: open focus, Tab/Shift+Tab containment, Escape, opener focus return.

- [ ] **Step 2: Verify RED**

```powershell
Set-Location apps/dashboard
npx vitest run src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts
Set-Location ../dashboard-e2e
npx playwright test src/e2e/no-overflow.spec.ts --grep "AI recommendation decision card"
```

Expected: structural/old-label or responsive geometry failures before final enforcement.

- [ ] **Step 3: Apply minimum token-only responsive styles**

Card root: flex column, `minWidth: 0`, no internal scroll. Grid: `xs: 1fr`, `sm: 1fr 1fr`. Action row: `xs` one column, `sm` primary + auto secondary, coarse-pointer button `minHeight: 44`. Drawer paper: `xs: 100%`, `sm: 560`, `maxWidth: 100vw`, `overflow: hidden`. Analysis content alone gets `overflowY: auto`, `overflowX: hidden`, `overflowWrap: anywhere`. Use only theme tokens; keep MUI default Drawer motion.

- [ ] **Step 4: Prove guards non-vacuous**

Temporarily add `#fff` to `DecisionCard.tsx`; structural test must fail. Revert. Temporarily add `streamOffline` to policy source; isolation test must fail. Revert. `git diff` must contain neither poison.

- [ ] **Step 5: Verify GREEN and commit**

Step 2 expected: structural `1 file/6 tests`; focused Playwright `5 passed`.

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.tsx apps/dashboard-e2e/src/e2e/no-overflow.spec.ts
git commit -m "test: enforce decision card layout and accessibility"
```

---

## Verification Track

### Task 6: Independent contract, suite, build, and rendered checks

**Files:** no writes. No conformance receipt: interface explicitly has no conformance block.

- [ ] **Step 1: Prove scope and `NO_BACKEND_CHANGE`**

```powershell
$implementationBase = 'f41fe37'
git diff --exit-code "$implementationBase..HEAD" -- apps/api libs/api
git diff --name-only "$implementationBase..HEAD"
```

Expected: first exits 0/no output; second lists `PLAN.md` plus only planned frontend/e2e files. The
approved contract/wireframe commit is the explicit implementation baseline.

- [ ] **Step 2: Format, lint, typecheck**

```powershell
npx prettier --check "apps/dashboard/src/app/pages/ticker/widgets/ai-rec/**/*.{ts,tsx}" "apps/dashboard/src/app/features/trading/orders/**/*.{ts,tsx}" "apps/dashboard-e2e/src/e2e/no-overflow.spec.ts"
npx nx run @convexa/dashboard:lint
npx nx run dashboard-e2e:lint
npx nx run @convexa/dashboard:typecheck
npx nx run dashboard-e2e:typecheck
```

Expected: all exit 0; no formatting/lint/type errors.

- [ ] **Step 3: Focused and full tests**

```powershell
Set-Location apps/dashboard
npx vitest run src/app/pages/ticker/widgets/ai-rec src/app/features/trading/orders/orders.risk.spec.tsx src/app/features/trading/TradeEntryDialog.risk.spec.tsx src/app/features/trading/shared-entry.flow.spec.tsx
Set-Location ../..
npx nx run @convexa/dashboard:test -- --run
```

Expected: focused `20 files/283 tests` pass (18 policy, 10 card, 8 analysis, 6 structural); full dashboard has zero failures. If recorded baseline order test remains red, report and stop.

- [ ] **Step 4: Real-browser checks**

```powershell
npx nx run dashboard-e2e:e2e -- --grep "AI recommendation decision card"
npx nx run dashboard-e2e:e2e
```

Expected: focused `5 passed`; full Chromium `52 passed`. Inspect traces/screens at 393×852 and 1440×900 in both schemes against approved hierarchy references.

- [ ] **Step 5: Production build and hygiene**

```powershell
npx nx build @convexa/dashboard --configuration=production
git diff --check "$implementationBase..HEAD"
rg -n "Accept into ghost trade|Act as sim order|Show full analysis" apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.tsx apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts
git status --short
```

Expected: build succeeds including archive/precompression; diff check clean; `rg` exits 1/no matches; no uncommitted feature files.

## Acceptance-criteria coverage

| AC | Owner/evidence |
|---:|---|
| 1 | Task 2 hierarchy test; 1440 review |
| 2 | Task 2 poisoned prose/bundle structured-only test |
| 3 | Task 2 fixed grid DOM order |
| 4 | Task 5 1440×900 dark/light |
| 5 | Task 2 exact labels + Task 6 negative scan |
| 6 | Task 4 review-position cancel/confirm; zero pre-confirm write |
| 7 | Task 4 create-order cancel/confirm; zero pre-confirm write |
| 8 | Task 3 content order + desktop drawer review |
| 9 | Task 5 393 dark/light sheet |
| 10 | Task 3 component focus + Task 5 keyboard browser |
| 11 | Tasks 1/4 stale-newer policy/recovery |
| 12 | Tasks 1/2 stale-born distinct state |
| 13 | Tasks 1/2 superseded-input state |
| 14 | Tasks 1/2 exact completeness/missing names |
| 15 | Task 2 no-trade test |
| 16 | Tasks 1/4 loading negative actions |
| 17 | Tasks 1/4 unavailable/retry isolation |
| 18 | Tasks 1/4 signed-out outer gate/no request |
| 19 | Tasks 1/4 three key states |
| 20 | Tasks 1/4 cooldown/cap server values |
| 21 | Tasks 1/4 no-edge/`Ask anyway` |
| 22 | Task 1/5 no-SSE source guard + existing SSE byte-stability test |
| 23 | Tasks 2/3 server grounding count/closed lookup tests |
| 24 | Task 4 unchanged prefill-withholding tests |
| 25 | Tasks 1/3 direct-vs-analysis export tests |
| 26 | Tasks 2/4 pinned response-persona tests |
| 27 | Task 2 scripted icon/simulated framing |
| 28 | Tasks 2/3/5 names/help/44px/focus tests |
| 29 | Task 5 mobile one-column/no-overflow |
| 30 | Task 5 token/motion/type guards + both schemes |
| 31 | Global backend no-op, source guard, existing shared-dialog test |
| 32 | Task 4 cancel/confirm pinned-card stability |

## Planning decisions and carry-forward

- One frontend track; no backend/conformance task.
- One dominant degraded reason with explicit precedence; all safety conditions still deny simulated actions.
- Direct request export only without a produced read; retained reads expose it inside analysis.
- MUI Drawer owns modal/focus/motion; no custom focus manager or animation.
- Existing API/types, request hook, export drawer, flow hook, stores, and shared dialog remain unchanged.
- The recorded baseline order-risk failure is not authorized scope. If still present, it blocks final verification rather than weakening AC-24.
