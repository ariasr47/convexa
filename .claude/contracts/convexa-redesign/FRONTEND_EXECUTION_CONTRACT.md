# convexa-redesign — FRONTEND_EXECUTION_CONTRACT (GATE V cleanup pass, 2026-06-30)

> **Scope:** the token-binding/cleanup follow-ups from RESUME.md item 2 + BACKLOG §B. FE-only,
> **NO_BACKEND_CHANGE / NO_INTERFACE_CHANGE** — presentation-only, consumes existing endpoints/SSE
> unchanged. Bound to `PROJECT_CONTEXT.md` (no inbound interface change). Supersedes the prior draft
> (Ticker surface re-skin — that shipped: commits `e4a8eff` + `32d4027`).
>
> **This is a cleanup pass, not a new surface.** Make the smallest correct change for each item; do not
> re-skin, re-layout, or "improve" anything beyond what is listed. Every change is output-neutral to the
> rendered UI (same colors/sizes) — it only moves hardcoded values onto the single-sourced tokens and
> deletes dead code.

## Invariants (HARD — restate, do not touch)
- **`[additive-keeps-score-byte-identical]`** — pure FE cleanup; the scoring/bundle path is not imported
  or touched. No change to `apps/api`.
- **`NO_BACKEND_CHANGE`** — do not edit anything under `apps/api/`.
- **Token discipline** (the redesign's standing rule, `tokens.ts` header + `THEME_TOKENS.md`): never
  hardcode a hex in a component; change a token in `tokens.ts` (or Figma + re-sync) and reference it.
  `apps/dashboard/src/app/tokens.ts` is the single source; `theme.ts` consumes it.
- **`[live-vs-static-isolation]`** — untouched: do not alter any live/stale/offline degrade behavior.
- Tests stay green: `npx nx test dashboard` (was **412/412** at the Ticker commit) must still pass.

## Task A — remove the dead `HandoffDialog`
`apps/dashboard/src/app/personas/components.tsx` exports `HandoffDialog` (the AI hand-off viewer). The
owner removed the hand-off viewer during the Ticker re-skin; it is now **dead** — defined/exported but
**never imported or rendered** anywhere (verified: only `PersonaPicker` and `PersonaCustomizeForm` are
imported, by `TickerToolbar.tsx` and `TickerDashboard.tsx`).

1. Delete the `HandoffDialog` function (currently lines ~80–134) **and** its private-only helper
   `SectionBadges` (currently lines ~58–78, used solely inside `HandoffDialog`).
2. Prune the imports that become unused after the deletion — check each before removing, since
   `PersonaCustomizeForm` (kept) reuses many of them. Likely-now-unused: the `Handoff` and `TickerBundle`
   types from `@org/api`; and any MUI imports used ONLY by the deleted code (e.g. `Tabs`/`Tab`/`Snackbar`/
   `DialogActions` — but KEEP any still used by `PersonaCustomizeForm`). Let the TS build/lint tell you
   which are truly unused; do not guess-delete a still-used import.
3. Update the file's header doc comment (line ~2) to drop the `HandoffDialog (view/copy + …)` clause so
   the comment matches the file's actual exports (`PersonaPicker`, `PersonaCustomizeForm`).
4. Update the stale reference comment in `apps/dashboard/src/app/ai-rec/StateExportDrawer.tsx` (line ~3):
   it says the drawer is "Opened from `View what's sent` in the rec panel AND from the persona
   `HandoffDialog`". The `HandoffDialog` path no longer exists — reword to reflect that the drawer now
   opens only from the rec panel. (Comment-only; do not change `StateExportDrawer` behavior.)
5. Check the personas spec (`personas/*.spec.tsx`, if any) for `HandoffDialog` references and remove/adjust
   any test that exercised it (a test for deleted code is itself dead). Do NOT weaken tests for the kept
   components.

## Task B — de-drift the hardcoded token copies (output-neutral)
Replace hardcoded hex that **duplicates a value already in `tokens.ts`** with a reference to the token.
The rendered color must be **identical** — these are the same values, just single-sourced.

1. `apps/dashboard/src/app/auth/AuthDialog.tsx` (~line 131): `bgcolor: '#1c2330'` — the inline comment
   already admits this is `tokens.extras.panelRaised`. Import `extras` from `../tokens` and use
   `extras.panelRaised` (drop the now-redundant comment or keep a short one).
2. The hatch-pattern gradient `repeating-linear-gradient(135deg, #161b22 0 Npx, #14181f Npx 2Npx)` is
   copy-pasted in three files: `ui/ComingSoonBox.tsx`, `scanner/Scanner.tsx`, `positions/LiveTabPanel.tsx`.
   `#161b22` = `palette.dark.background.paper`; `#14181f` = `extras.hatchAlt`. Reference the tokens
   (`theme.palette.background.paper` and `extras.hatchAlt`) via a template string in each `sx`.
   **Keep each file's existing stripe widths** (ComingSoonBox/LiveTabPanel = 18px; Scanner = 20px) — do
   not unify the geometry, only the colors. (If `ComingSoonBox` is the shared component the others already
   render, only its gradient needs the token; confirm before touching all three.)
3. `apps/dashboard/src/app/ui/ValueCard.tsx` (~line 54): `linear-gradient(90deg, #4f9cff, #7b5cff)` —
   `#4f9cff` = `palette.dark.primary`, `#7b5cff` = `extras.accentViolet`. Reference the tokens.

## Out of scope — DO NOT change (legitimate / non-redesign)
- `tokens.ts` — the single source; hex literals belong here.
- `auth/GoogleButton.tsx` — Google's official brand colors (`#EA4335`/`#4285F4`/`#FBBC05`/`#34A853` + the
  mandated white button `#fff`/`#1f1f1f`/`#f1f3f4`). Google brand guidelines require these exact values;
  they must NOT be themed.
- `auth/avatar.ts` + `auth/AccountControl.tsx` — the avatar gradient is a **documented permitted literal**
  (see `avatar.ts` header comment). Leave it. (Optional, low priority: it could reference
  `extras.accentViolet`/`palette.dark.primary` — only if trivial and the comment is updated; otherwise skip.)
- `operator-metrics/*` — the `/_ops/metrics` operator surface uses a deliberately **non-semantic** chart
  palette and is OFF the redesign/trader scope (`[operator-vs-trader-path-separation]`). Do not touch.

## Task C — QA the global `theme.h6` override (verification, not a change)
The Ticker re-skin set a global `theme.h6` = `{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.25 }`
(Inter Semi Bold 16) in `theme.ts` for section/card titles. Confirm this global override did **not**
regress section titles on the **Positions**, **Settings**, and **Landing** surfaces (which may have
relied on MUI's default h6 of 20px/500). This is a check — only change something if you find a real
regression (and if so, fix it the minimal way: a local `variant`/`sx` on the affected title, not by
reverting the global token).

- Run `npx nx test dashboard` — expect the full suite green (was 412/412).
- Render-verify the three surfaces' section titles via the preview MCP (`preview_start dashboard` on
  :4300; `preview_snapshot`/`preview_eval` — Ticker screenshots can hang, but Positions/Settings/Landing
  are fine for a screenshot). Note any title that looks oversized/wrong vs the rest of the redesign.
- Report findings in your hand-back (PASS, or the specific regression + the minimal fix you applied).

## Definition of done
- `HandoffDialog` + `SectionBadges` gone; no unused imports; both stale comments updated; build + lint clean.
- The four de-drift sites reference `tokens.ts`; **no behavioral/visual change** (same colors).
- `npx nx test dashboard` green (≈412, minus any HandoffDialog-only tests legitimately removed).
- `theme.h6` QA reported (PASS or fix-applied).
- A grep for `#[0-9a-fA-F]` under `apps/dashboard/src/app` (excluding `tokens.ts`, `auth/GoogleButton.tsx`,
  `auth/avatar.ts`, `auth/AccountControl.tsx`, `operator-metrics/`, and `*.spec.tsx`) returns **zero**.
- Hand back: files changed, test count, the h6 QA verdict, and confirmation NO `apps/api` file was touched.
- **Do not commit** — the conductor commits on the branch after verifying.
