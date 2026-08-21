# rec-plan-scope-caption — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/rec-plan-scope-caption/PLAN.md`.

**Goal:** On a produced non-`local_rules` **trade** recommendation, render exactly one quiet
section-level caption under the pinned DecisionCard plan row stating that the six plan fields are
not checked — and keep that caption off the affirmative `local_rules` path, `no_trade`, and every
non-rec panel state.

**Architecture:** Pure frontend presentation over the pinned `RecResponse` DecisionCard already
consumes. One closed copy constant (`PLAN_FIELDS_NOT_CHECKED`), one pure show/hide predicate over
`strategy.decision` + `grounding?.card`, one render site as a **sibling immediately after**
`DecisionMetadata` and **before** the thesis lead. `AnalysisSurface` may re-state plan labels but
must not gain a second `plan-fields-not-checked`. `apps/api` diff stays empty.

**Tech stack:** React 19 + Vite + MUI (`apps/dashboard`, `@convexa/dashboard`). Tests:
`npx nx test @convexa/dashboard` (or scoped `npx vitest run …`). Typecheck is required separately
(`npx nx typecheck @convexa/dashboard` / `tsc --build --force`). Vitest green ≠ types sound.

**Spec:** `.spire/clusters/tech/contracts/rec-plan-scope-caption/SPEC.md` (APPROVED 2026-08-17)
**Interface:** `.spire/clusters/tech/contracts/rec-plan-scope-caption/INTERFACE_CONTRACT.md`

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`) | **B1 only** — empty-diff / non-touch proof (no server implementation) | Parallel anytime |
| **Frontend** (`apps/dashboard`) | **F1 → F5** (strict order) | Owns all product code |
| **Verification** | **V1 → V5** after F5 | Read-only gates |

**Parallelism:** Backend B1 is a proof command and may run anytime. Frontend is ordered.
Verification runs after frontend lands.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Standing project constraints (each has bitten this repo):**

- **`nx typecheck` is mandatory before any green claim.** A green `nx test` does **not** mean the
  types are sound (Vitest transpiles without typechecking).
- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **`nx format:write` must ALWAYS be scoped with `--files=`.** Never bare. Prefer Prettier scoped to
  the files you touched.
- **Never write a literal NUL byte** (makes a file binary to git and grep).
- **Cite live files only after reading them.** Do not cite Python-era `AiRecPanel` line numbers.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, or any other feature folder. Do not invent
  backend wire/prompt/score/fingerprint/`grounding.card` changes.

**Feature hard rules (SPEC + D1–D4 settled — do not re-open):**

- Show predicate is **structural only** (D1): produced `strategy.decision === 'trade'` (plan section
  mounts) **and** `rec.grounding?.card !== 'local_rules'`. No content heuristics (stated plan field,
  risk clause present, empty strikes, etc.).
- Hide token is affirmative **`grounding.card === 'local_rules'` only** (D2). Never gate on
  `key_source`. Fixture for AC-2 **must** include non-`none` `key_source` (e.g. `shared_admin`).
- `grounding.card === 'not_applicable'` is **accept-show** (D4 / AC-2r). Missing `grounding` /
  unrecognized card → show. GATE Q must not treat show-on-`not_applicable` as a miss.
- Placement (D3 / AC-7): **one** caption on the pinned DecisionCard plan row. Drawer-only fails.
  Dual card+analysis fails.
- Caption is a **scope boundary**, never a diagnosis: fixed string; no interpolation of which fields
  were bare.
- Sibling honesty lines stay distinct: grounding card line, Class-A absence / `rec-not-actionable`,
  `REASONING_PROSE_NOT_CHECKED`. Do not merge.
- Score / tier / `state_fingerprint` / trading computation untouched (`additive-keeps-score-byte-identical`).
- Caption is static with the pinned rec (`live-vs-static-isolation`); SSE drop must not dim/blank it.
- Theme tokens only (`theme-token-discipline`); no new animation (`single-motion-moment`).
- Do **not** record `ai-rec-grounding` SPEC §9.5 closed until **all** ship-blocking ACs pass
  (AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-14, AC-15) — not only the shortened §3 close table.

**Attachment planning choice (locked for implementers):** render the caption as a **sibling after**
`{isTrade && <DecisionMetadata …/>}` and **before** the thesis lead — **not** as a child inside the
`DecisionMetadata` row `Stack` (`direction="row"`, `flexWrap: 'wrap'`,
`data-testid="decision-metadata"` in live `DecisionCard.tsx`). Putting a `display: 'block'` caption
inside that row makes it a seventh flex item. Assert placement with document order
(`decision-metadata` then `plan-fields-not-checked` then `decision-thesis` when thesis mounts),
**not** `within(decision-metadata).getByTestId('plan-fields-not-checked')`.

**Baselines:**

| Check | Expectation |
|---|---|
| Feature Vitest files named in F*/V* | exit 0 |
| `npx nx typecheck @convexa/dashboard` | exit 0 |
| `git diff --name-only -- apps/api` (vs pre-feature `BASE`) | **empty** |
| `decisionCard.structural.spec.ts` hex / animation / SSE guards | still green |

### Conformance spec

**None required for this feature.** Per the `NO_BACKEND_CHANGE` posture there is no new or changed
backend surface to machine-check, so **no live `endpoints` JSON block is emitted**. Correctness of
show/hide and copy is verified by the frontend test suite named in SPEC §7 against fixtures of the
**existing** rec payload (`grounding.card` as discriminator). Standing interface conformance of the
unchanged recommendation endpoint remains owned by the contracts that last extended it
(`ai-rec-grounding` / `rec-absence-literals-hole`), not by inventing a second live pin here.

---

## File ownership (frontend only)

| Path | Change |
|---|---|
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts` | Add `PLAN_FIELDS_NOT_CHECKED` beside `REASONING_PROSE_NOT_CHECKED` |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.ts` | **Create** — pure `shouldShowPlanFieldsNotChecked(rec)` |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts` | **Create** — predicate matrix |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx` | One caption render site (sibling after `DecisionMetadata`) |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx` | Presence / placement / chrome / local_rules / no_trade / not_applicable |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx` | **Create** — AC-1+2+2r+3+5 DOM integration (card ± analysis) |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts` | Append exact-string + disjointness + banned-word checks for the new constant |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.tsx` | **No caption instance** — do not add `plan-fields-not-checked` |
| `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/fixtures.ts` | Only if a fixture needs an explicit `key_source: 'shared_admin'` for AC-2 (prefer mutating in the test) |

**Do not touch:** `apps/api/**`, `libs/api/**`, `AiRecPanel.tsx` (unless a mount bug forces a
one-line pass-through — default is no), `TradeEntryDialog`, `prefill.ts`, `FigureClause.tsx`,
`GroundingNote.tsx`, `reasoning.tsx` (prose caption stays as-is), prompts, schemas, score paths.

**Live anchors already verified (do not re-derive from backlog prose):**

- `DecisionCard.tsx`: `DecisionMetadata` is the row Stack at `data-testid="decision-metadata"`;
  mount gate is `{isTrade && <DecisionMetadata …/>}` then `{reasoning.lead && … decision-thesis}`.
- `copy.ts`: `REASONING_PROSE_NOT_CHECKED` + `PLAN_FIELD_LABEL` already export; new constant is sibling.
- `AnalysisSurface.tsx`: re-states plan labels under `analysis-plan-fields` / structured summary;
  hosts `REASONING_PROSE_NOT_CHECKED` via `ReasoningSection` only.
- `reasoning.tsx`: prose caption pattern — `Typography variant="caption"` + `data-testid` +
  `sx={{ color: 'text.secondary', display: 'block' }}`.

---

## Backend track — EMPTY BY DESIGN

**There are no server implementation tasks.** `INTERFACE_CONTRACT.md` posture is
`NO_BACKEND_CHANGE`. This track exists solely as the empty-diff / non-touch proof.

### B1 — Empty `apps/api` proof (AC-14)

**Files:** none under `apps/api/`.

- [ ] **Step 1: Record BASE before any feature commit**

```powershell
git rev-parse HEAD
# record as BASE in lane notes; every empty-diff check uses $BASE, never bare main alone
```

- [ ] **Step 2: Confirm intent**

Do not open or edit any file under `apps/api/`. Do not change prompts, grounding producers,
`card_member`, score, tier, or `state_fingerprint`. If a task appears to need a backend change,
that is a **GATE Z** question — stop; do not invent a wire flag for a second hide token.

- [ ] **Step 3: Proof command (run at end of FE work and in V3)**

```powershell
git status --short apps/api
git diff --stat $BASE -- apps/api
git diff --name-only $BASE -- apps/api
```

**Expected:** empty output for all three.

**Commit:** none for backend.

---

## Frontend track

### F1 — Closed copy constant `PLAN_FIELDS_NOT_CHECKED` (AC-16)

**Files:**
- Modify: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts`
- Modify: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts`

**Reviewer probe:** string is exact byte match to SPEC §4; names all six `PLAN_FIELD_LABEL` values;
disjoint from `REASONING_PROSE_NOT_CHECKED`, `GROUNDING_BLOCK_ABSENT`, every `GROUNDING_CARD.*`
member, and absence literals (`—` / `not given` / `unavailable` / `unrecognized`); whole-word banned
set from `bannedWords.scan.spec.ts` is clean.

- [ ] **Step 1: Write the failing copy assertions**

Append to `copy.plan.spec.ts`:

```ts
import {
  GROUNDING_BLOCK_ABSENT,
  GROUNDING_CARD,
  PLAN_FIELD_COPY,
  PLAN_FIELD_LABEL,
  PLAN_FIELDS_NOT_CHECKED,
  REASONING_PROSE_NOT_CHECKED,
} from './copy';

it('PLAN_FIELDS_NOT_CHECKED is the SPEC §4 closed constant', () => {
  expect(PLAN_FIELDS_NOT_CHECKED).toBe(
    "Structure, Strike(s), Expiration, Entry trigger, Time horizon and Confidence aren't checked — only the stop, target and invalidation level are.",
  );
});

it('PLAN_FIELDS_NOT_CHECKED names every PLAN_FIELD_LABEL and stays disjoint from siblings', () => {
  for (const label of Object.values(PLAN_FIELD_LABEL)) {
    expect(PLAN_FIELDS_NOT_CHECKED).toContain(label);
  }
  expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(REASONING_PROSE_NOT_CHECKED);
  expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(GROUNDING_BLOCK_ABSENT);
  for (const line of Object.values(GROUNDING_CARD)) {
    expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(line);
  }
  for (const lit of [
    PLAN_FIELD_COPY.notGiven.text,
    PLAN_FIELD_COPY.unavailable.text,
    PLAN_FIELD_COPY.unrecognized.text,
    '—',
  ]) {
    expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(lit);
  }
  expect(PLAN_FIELDS_NOT_CHECKED.toLowerCase()).not.toMatch(
    /\b(verified|confirmed|validated|approved|safe|trusted|grounding|hallucinated|suspect|invalid)\b/,
  );
});
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts
```

**Expected:** exit 1 — `PLAN_FIELDS_NOT_CHECKED` unresolved / not exported.

- [ ] **Step 3: Implement the constant**

In `copy.ts`, immediately after `REASONING_PROSE_NOT_CHECKED`:

```ts
/**
 * rec-plan-scope-caption — section-level scope boundary for the six plan fields.
 * Permanent: none of the six enters figure-grounding clauses / counts.checked.
 * Sibling of REASONING_PROSE_NOT_CHECKED; never merged into grounding / absence / not-actionable.
 */
export const PLAN_FIELDS_NOT_CHECKED =
  "Structure, Strike(s), Expiration, Entry trigger, Time horizon and Confidence aren't checked — only the stop, target and invalidation level are.";
```

Do not interpolate. Do not branch on field state.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts
# expect exit 0
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts
git commit -m "feat(ai-rec): add PLAN_FIELDS_NOT_CHECKED closed caption constant"
```

---

### F2 — Pure show/hide predicate (AC-1, AC-2, AC-2r, AC-5 structural half)

**Files:**
- Create: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.ts`
- Create: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts`

**Interfaces:**
- Consumes: `RecResponse` (`strategy?.decision`, `grounding?.card` only).
- Produces: `shouldShowPlanFieldsNotChecked(rec: RecResponse): boolean`.
- Must **not** read `key_source`, plan field values, `field_reasons`, risk clauses, or React/theme/copy.

**Reviewer probe:** poison `key_source` on a `local_rules` fixture — still hide. Poison missing
`grounding` / `not_applicable` / unrecognized card — still show when `decision === 'trade'`. Source
of the function must not match `/key_source/`.

- [ ] **Step 1: Write the failing predicate matrix**

```ts
import { describe, expect, it } from 'vitest';
import {
  noTradeRec,
  recAllTraced,
  recBlockAbsent,
  recLocalRules,
  recLocalRulesNothingCheckable,
} from './fixtures';
import { shouldShowPlanFieldsNotChecked } from './planScopeCaption';

describe('shouldShowPlanFieldsNotChecked', () => {
  it('shows on produced trade with non-local_rules card (AC-1)', () => {
    expect(shouldShowPlanFieldsNotChecked(recAllTraced())).toBe(true);
  });

  it('hides on local_rules even with shared_admin key_source (AC-2 / D2)', () => {
    const rec = recLocalRules();
    rec.key_source = 'shared_admin';
    rec.remaining_free_uses = 2;
    expect(rec.grounding!.card).toBe('local_rules');
    expect(rec.key_source).not.toBe('none');
    expect(shouldShowPlanFieldsNotChecked(rec)).toBe(false);
  });

  it('shows on not_applicable accept-show residual (AC-2r / D4)', () => {
    expect(shouldShowPlanFieldsNotChecked(recLocalRulesNothingCheckable())).toBe(true);
  });

  it('shows when grounding block is missing (missing is never an exemption)', () => {
    expect(shouldShowPlanFieldsNotChecked(recBlockAbsent())).toBe(true);
  });

  it('hides on no_trade (AC-5)', () => {
    expect(shouldShowPlanFieldsNotChecked(noTradeRec())).toBe(false);
  });

  it('shows on unrecognized card token when trade plan would mount', () => {
    const rec = recAllTraced();
    (rec.grounding as { card: string }).card = 'future_unknown_token';
    expect(shouldShowPlanFieldsNotChecked(rec)).toBe(true);
  });

  it('does not read key_source (source pin)', () => {
    expect(String(shouldShowPlanFieldsNotChecked)).not.toMatch(/key_source/);
  });

  it('ignores bare/stated plan-field content (D1 — not a content heuristic)', () => {
    const bare = recAllTraced();
    bare.strategy = {
      ...bare.strategy!,
      structure: null,
      strikes: [],
      expiration: null,
      entry_trigger: null,
      time_horizon: null,
      confidence: null,
    };
    expect(shouldShowPlanFieldsNotChecked(bare)).toBe(true);
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts
```

**Expected:** exit 1 — unresolved `./planScopeCaption`.

- [ ] **Step 3: Implement exactly**

```ts
import type { RecResponse } from '@convexa/api';

/**
 * Structural show/hide for the plan-scope caption (SPEC §2.2 / D1–D4).
 * Show when plan section mounts (decision === 'trade') AND card is not affirmative local_rules.
 * Does not read key_source or field content.
 */
export function shouldShowPlanFieldsNotChecked(rec: RecResponse): boolean {
  if (rec.strategy?.decision !== 'trade') return false;
  return rec.grounding?.card !== 'local_rules';
}
```

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts
# expect exit 0, 8 passed
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.ts `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts
git commit -m "feat(ai-rec): add plan-scope caption show/hide predicate"
```

---

### F3 — Attach caption on DecisionCard (AC-7, AC-17)

**Files:**
- Modify: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx`
- Modify: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx`

**Reviewer probe:** DOM order is `decision-metadata` → `plan-fields-not-checked` → (`decision-thesis`
when lead exists). Caption is **not** inside `decision-metadata`, not inside any `clause-*`,
`grounding-card-line`, or `rec-not-actionable`. Chrome is quiet caption secondary text. Zero hex.
No `WarningAmberIcon` on this node.

- [ ] **Step 1: Write failing DecisionCard placement / chrome tests**

Append to `DecisionCard.spec.tsx` (reuse existing `renderCard` / `pres` helpers; import
`PLAN_FIELDS_NOT_CHECKED`, `recLocalRules`, `noTradeRec`, `recLocalRulesNothingCheckable`,
`recBlockAbsent`):

```ts
import { PLAN_FIELDS_NOT_CHECKED } from './copy';
import {
  noTradeRec,
  recAllTraced,
  recBlockAbsent,
  recLocalRules,
  recLocalRulesNothingCheckable,
} from './fixtures';

describe('plan-scope caption on DecisionCard', () => {
  it('renders exactly one caption after decision-metadata on a non-local_rules trade', () => {
    renderCard(recAllTraced());
    const caption = screen.getByTestId('plan-fields-not-checked');
    expect(caption).toHaveTextContent(PLAN_FIELDS_NOT_CHECKED);
    expect(screen.getAllByTestId('plan-fields-not-checked')).toHaveLength(1);
    const meta = screen.getByTestId('decision-metadata');
    expect(meta.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta.contains(caption)).toBe(false);
    expect(caption.closest('[data-testid^="clause-"]')).toBeNull();
    expect(caption.closest('[data-testid="grounding-card-line"]')).toBeNull();
    expect(caption.closest('[data-testid="rec-not-actionable"]')).toBeNull();
  });

  it('sits before decision-thesis when a lead exists', () => {
    const rec = recAllTraced();
    rec.strategy!.rationale = 'Lead sentence. More detail follows.';
    renderCard(rec);
    const caption = screen.getByTestId('plan-fields-not-checked');
    const thesis = screen.getByTestId('decision-thesis');
    expect(caption.compareDocumentPosition(thesis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses quiet caption chrome (AC-17)', () => {
    renderCard(recAllTraced());
    const caption = screen.getByTestId('plan-fields-not-checked');
    expect(caption.tagName.toLowerCase()).toBe('span'); // MUI Typography caption → span
    expect(caption).toHaveTextContent(PLAN_FIELDS_NOT_CHECKED);
  });

  it('is absent on local_rules with shared_admin key_source (AC-2)', () => {
    const rec = recLocalRules();
    rec.key_source = 'shared_admin';
    rec.remaining_free_uses = 1;
    renderCard(rec);
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
  });

  it('is present on not_applicable (AC-2r) and missing grounding', () => {
    renderCard(recLocalRulesNothingCheckable());
    expect(screen.getByTestId('plan-fields-not-checked')).toBeInTheDocument();
    cleanup();
    renderCard(recBlockAbsent());
    expect(screen.getByTestId('plan-fields-not-checked')).toBeInTheDocument();
  });

  it('is absent on no_trade and reserved dash treatment stays (AC-5)', () => {
    renderCard(
      noTradeRec(),
      pres({ resultState: 'no_trade', actions: actions({ reviewTrade: false, createOrder: false }) }),
    );
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
    expect(screen.queryByTestId('decision-metadata')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx
```

**Expected:** exit 1 — `plan-fields-not-checked` not found.

- [ ] **Step 3: Wire the render site**

In `DecisionCard.tsx`:

1. Import `PLAN_FIELDS_NOT_CHECKED` from `./copy` and `shouldShowPlanFieldsNotChecked` from
   `./planScopeCaption`.
2. Immediately after `{isTrade && <DecisionMetadata rec={rec} bundle={bundle} />}` and **before**
   the thesis lead block, insert:

```tsx
{shouldShowPlanFieldsNotChecked(rec) && (
  <Typography
    variant="caption"
    data-testid="plan-fields-not-checked"
    sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
  >
    {PLAN_FIELDS_NOT_CHECKED}
  </Typography>
)}
```

Do **not** put this inside `DecisionMetadata`. Do not gate on `presentation`, SSE, stale strips,
missing fields, or risk-clause presence. Stale / stale-born / superseded strips continue to own
freshness only — they must not remove this caption when the predicate holds.

- [ ] **Step 4: Update hierarchy order test if needed**

The existing `keeps the fixed hierarchy in DOM order` list in `DecisionCard.spec.tsx` currently
goes `decision-verdict` → `decision-metadata` → `decision-thesis`. Insert
`'plan-fields-not-checked'` **between** `decision-metadata` and `decision-thesis`. Ensure
`recAllTraced()` still produces a thesis lead (it does via rationale) so the chain remains valid.
If a fixture lacks a lead, the caption still mounts; only the thesis edge of the chain is skipped.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx
# expect exit 0
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx
git commit -m "feat(ai-rec): render plan-scope caption under DecisionCard plan row"
```

---

### F4 — DOM integration: presence · local_rules · single-instance · no_trade (AC-1, AC-2, AC-2r, AC-3, AC-5)

**Files:**
- Create: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx`
- Touch only if needed: `AnalysisSurface.spec.tsx` (assert zero `plan-fields-not-checked`)

**Why a dedicated render spec:** SPEC §7 prefers one focused DOM integration covering
AC-1+AC-2+AC-3+AC-5. Mounting `DecisionCard` alone cannot prove analysis has no second instance;
mounting `AnalysisSurface` alone cannot prove the card instance. This file mounts both.

**Reviewer probe:** with analysis open, `getAllByTestId('plan-fields-not-checked')` length is 1 on
non-local_rules trade and 0 on local_rules. Analysis may still show `reasoning-prose-not-checked`.

- [ ] **Step 1: Write the failing integration**

```tsx
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisSurface } from './AnalysisSurface';
import { DecisionCard } from './DecisionCard';
import { PLAN_FIELDS_NOT_CHECKED, REASONING_PROSE_NOT_CHECKED } from './copy';
import {
  noTradeRec,
  recAllTraced,
  recLocalRules,
  recLocalRulesNothingCheckable,
} from './fixtures';
import type { AiRecPresentation } from './presentationPolicy';

afterEach(cleanup);

const actions = (o: Partial<AiRecPresentation['actions']> = {}) => ({
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

function renderCardAndAnalysis(rec: ReturnType<typeof recAllTraced>, presentation = pres()) {
  return render(
    <ThemeProvider theme={theme}>
      <DecisionCard
        rec={rec}
        bundle={null}
        presentation={presentation}
        dataAge="older data"
        onReview={vi.fn()}
        onCreateOrder={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />
      <AnalysisSurface
        open
        ticker="TSLA"
        rec={rec}
        bundle={null}
        onClose={vi.fn()}
        onViewExport={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('plan-scope caption · DOM integration (AC-1+2+2r+3+5)', () => {
  it('AC-1 — exactly one caption with exact copy on non-local_rules trade', () => {
    renderCardAndAnalysis(recAllTraced());
    const nodes = screen.getAllByTestId('plan-fields-not-checked');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toHaveTextContent(PLAN_FIELDS_NOT_CHECKED);
    expect(screen.getByTestId('ai-rec-decision-card').contains(nodes[0])).toBe(true);
  });

  it('AC-2 — local_rules + shared_admin → zero instances on card and open analysis', () => {
    const rec = recLocalRules();
    rec.key_source = 'shared_admin';
    rec.remaining_free_uses = 2;
    renderCardAndAnalysis(rec);
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('AC-2r — not_applicable still shows exactly one caption', () => {
    renderCardAndAnalysis(recLocalRulesNothingCheckable());
    expect(screen.getAllByTestId('plan-fields-not-checked')).toHaveLength(1);
  });

  it('AC-3 — analysis open never duplicates; prose caption remains distinct', () => {
    const rec = recAllTraced();
    rec.strategy!.rationale = 'Thesis lead. Detail.';
    renderCardAndAnalysis(rec);
    expect(screen.getAllByTestId('plan-fields-not-checked')).toHaveLength(1);
    const prose = screen.getByTestId('reasoning-prose-not-checked');
    expect(prose).toHaveTextContent(REASONING_PROSE_NOT_CHECKED);
    expect(prose.textContent).not.toBe(PLAN_FIELDS_NOT_CHECKED);
  });

  it('AC-5 — no_trade → absent', () => {
    renderCardAndAnalysis(
      noTradeRec(),
      pres({
        resultState: 'no_trade',
        actions: actions({ reviewTrade: false, createOrder: false }),
      }),
    );
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED then GREEN**

```powershell
npx vitest run src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx
```

If F3 landed correctly, AC-1/2/2r/5 should already be green; AC-3 fails only if `AnalysisSurface`
incorrectly gained a second instance (it must not — do not add one). If AnalysisSurface already has
zero instances, the whole file goes green on first run after F3 — that is acceptable; the file still
locks the regression.

- [ ] **Step 3: Confirm AnalysisSurface source has no `plan-fields-not-checked`**

```powershell
rg "plan-fields-not-checked" apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.tsx
```

**Expected:** no matches. Do not add any.

- [ ] **Step 4: Commit**

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx
git commit -m "test(ai-rec): lock plan-scope caption presence and single-instance"
```

---

### F5 — SSE isolation + structural non-touch + lane close (AC-8, AC-14 FE half)

**Files:**
- Modify: `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx`
  (or `DecisionCard.spec.tsx`) for AC-8 re-render stability
- Rely on existing `decisionCard.structural.spec.ts` (already bans `LiveUpdate|streamOffline|EventSource|SSE`
  and hex / keyframes in the ai-rec production tree)

**Reviewer probe:** caption source path never reads live/SSE. Re-render with identical `rec` leaves
caption text + plan field values byte-identical. `apps/api` still untouched.

- [ ] **Step 1: AC-8 stability test**

```ts
it('AC-8 — re-render / parent update leaves caption and plan values unchanged', () => {
  const rec = recAllTraced();
  const view = renderCardAndAnalysis(rec);
  const beforeCaption = screen.getByTestId('plan-fields-not-checked').textContent;
  const beforeMeta = screen.getByTestId('decision-metadata').textContent;
  view.rerender(
    <ThemeProvider theme={theme}>
      <DecisionCard
        rec={rec}
        bundle={null}
        presentation={pres()}
        dataAge="older data"
        onReview={vi.fn()}
        onCreateOrder={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />
      <AnalysisSurface
        open
        ticker="TSLA"
        rec={rec}
        bundle={null}
        onClose={vi.fn()}
        onViewExport={vi.fn()}
      />
    </ThemeProvider>,
  );
  expect(screen.getByTestId('plan-fields-not-checked').textContent).toBe(beforeCaption);
  expect(screen.getByTestId('decision-metadata').textContent).toBe(beforeMeta);
});
```

(Optional stronger arm: extend `ai-rec.absence.spec.tsx` SSE `onerror` path to also assert
`plan-fields-not-checked` text unchanged when present — only if the absence harness is already
open for an unrelated edit; do not expand scope.)

- [ ] **Step 2: Structural + banned-word suites still green**

```powershell
npx vitest run `
  src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts `
  src/app/pages/ticker/widgets/ai-rec/bannedWords.scan.spec.ts `
  src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts `
  src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx `
  src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx `
  src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts
echo "EXIT=$LASTEXITCODE"
```

**Expected:** exit 0. New constant must not trip `bannedWords.scan.spec.ts` (it already scans all
ai-rec string literals).

- [ ] **Step 3: Typecheck (mandatory)**

```powershell
npx nx typecheck @convexa/dashboard
echo "EXIT=$LASTEXITCODE"
```

If phantom TS2353/TS6305 from stale `dist`/`*.tsbuildinfo`: delete
`apps/dashboard/dist`, `apps/dashboard/out-tsc`, and `*.tsbuildinfo`, then rebuild
`tsconfig.app.json` before `tsconfig.spec.json` (`tsc --build --force`).

- [ ] **Step 4: Empty api proof + scoped format**

```powershell
git diff --name-only $BASE -- apps/api
# expect empty
npx prettier --write `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.ts `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx `
  apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx
# NEVER: nx format:write without --files
```

- [ ] **Step 5: Commit lane close**

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/ai-rec/
git status --short apps/api
git commit -m "test(ai-rec): plan-scope caption SSE isolation and lane close"
```

---

## Verification track

Run after F5. Read-only except recording receipts/notes under this feature folder if GATE Q asks —
this planner track does not edit product code.

### V1 — Feature Vitest files

```powershell
npx vitest run `
  src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts `
  src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts `
  src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx `
  src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx `
  src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts `
  src/app/pages/ticker/widgets/ai-rec/bannedWords.scan.spec.ts
echo "EXIT=$LASTEXITCODE"
```

**Expected:** exit 0. Maps to automated ACs: AC-1, AC-2, AC-2r, AC-3, AC-5, AC-8 (stability),
AC-16 (copy), structural halves of AC-14 / AC-17.

### V2 — Full dashboard suite + typecheck

```powershell
npx nx test @convexa/dashboard
echo "TEST_EXIT=$LASTEXITCODE"
npx nx typecheck @convexa/dashboard
echo "TYPE_EXIT=$LASTEXITCODE"
```

**Expected:** both exit 0. Do not claim green on printed pass counts alone.

### V3 — Empty `apps/api` diff (AC-14)

```powershell
git diff --name-only $BASE -- apps/api
git diff --stat $BASE -- apps/api
```

**Expected:** empty. Also confirm no edits under `libs/api/**` for this feature.

**Interface conformance:** do **not** invent a live `endpoints` JSON block. The Global Constraints
`## Conformance spec` text is authoritative — none required. GATE Q must not fail this feature for
a missing `conformance-receipt.json` endpoints pin; standing recommendation contracts remain owned
by `ai-rec-grounding` / `rec-absence-literals-hole`.

### V4 — Review checklist (AC-1f, AC-4, AC-6, AC-7, AC-9…AC-13, AC-15…AC-17)

Observe against a running dashboard when practical (`npx nx serve @convexa/dashboard` → :4200;
api on :8000 only if exercising a live rec — fixtures suffice for most rows):

| AC | Check |
|---|---|
| AC-1f | Primary wrong-trade fixture narrative: stated plan field + risk clause + caption present (review; not a gate predicate) |
| AC-4 | No per-field marker/tint/clause/tooltip added to the six plan slots; values unchanged |
| AC-6 | Loading / error / cooldown / cap / no-key / signed-out / empty: no caption ghost |
| AC-7 | Caption on pinned DecisionCard plan row; not drawer-only |
| AC-9 | Stale strip changes only freshness chrome; caption remains when predicate holds |
| AC-10 | Grounding card line still present when applicable and textually ≠ `PLAN_FIELDS_NOT_CHECKED` |
| AC-11 | With analysis open, both plan-scope and `REASONING_PROSE_NOT_CHECKED` can appear; distinct; no second plan-scope in drawer |
| AC-12 | Absence literals / Class-A standing line / Accept empty-with-reason unchanged |
| AC-13 | `dteWindowCaption` still requires both finite bounds; no new `?` |
| AC-15 | No BACKLOG / ledger / gate report records §9.5 closed **before** SB ACs pass; after they pass, records **may** |
| AC-16 | Copy exact; no banned trust/accusation wording about the plan |
| AC-17 | Quiet `text.secondary` caption; not inside clause / grounding-card-line / rec-not-actionable; zero hex; no new motion |

### V5 — Hygiene close-out

```powershell
git status --short
git diff --name-only $BASE -- apps/api libs/api
# expect no api/lib api paths from this feature
```

Confirm unrelated workspace changes from other lanes were not reverted. Do not `git stash`.

---

## Dependency map

```
B1 (proof; anytime)
F1 (copy) → F2 (predicate) → F3 (DecisionCard wire) → F4 (DOM integration) → F5 (SSE/close)
F5 → V1 → V2 → V3 → V4 → V5
```

Backend and frontend tracks share **zero files**. Frontend does not wait on B1 beyond recording
`BASE` once at session start.

---

## Self-review (planner)

- SPEC §1–§2 → F1–F3 file list and attachment choice.
- SPEC §3 test ACs → F2/F4/F5 + V1; review ACs → V4.
- SPEC §4 copy/chrome/placement → F1/F3 verbatim.
- SPEC §5 error table → F2 matrix (missing grounding, not_applicable, local_rules, unrecognized).
- SPEC §6 / INTERFACE → Global Constraints Conformance spec copied verbatim; empty backend track.
- SPEC §7 → prefer one DOM integration (F4); structural SSE (F5).
- SPEC §8 / BRIEF invariants → Global Constraints + structural specs.
- D1–D4 → F2 predicate; not re-opened.
- S2 Important residuals → **not fixed in this plan** (copy second-clause tension, grid Entry halo,
  §9.5 close-table omission of AC-4/AC-7). Ship-blocking ACs remain plannable as written; AC-15
  process rule in Global Constraints requires **all** SB ACs including AC-4 and AC-7 before §9.5
  may be recorded closed.
