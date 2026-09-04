# Skeptic pass — Curvature Terminal v2 re-baseline (2026-09-03)

**Verdict: PASS WITH FINDINGS** — no Critical findings; one Major accuracy gap and one Minor wording
tension, both fixable without touching ruling fidelity, banned patterns, or single authority.

## Critical

None found.

## Major

**1. The e2e "checked widths" claim understates what's already enforced.**

- `DESIGN_SYSTEM.md:172`: "Checked widths: **393** (the width `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` already enforces) plus **834** and **1280**, to be added at build."
- `DESIGN_SYSTEM.md:197`: "amend at build: add 834 and 1280 to the existing 393."
- Both transcribe `rebaseline-2026-09-03.md:55` ("e2e no-overflow suite (add 834 and 1280 to 393)") faithfully — this is not a synthesis-fidelity error, it's an inaccuracy already in the session note that the canon carried forward uncorrected.
- Evidence against it: `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts:47-50` defines `WIDE_VIEWPORTS = [{width:900}, {width:1280}]`, and the file's own comment (lines 36-46) states these were added **2026-07-28** ("Until 2026-07-28 this suite asserted at 393px and NOTHING else"). **1280 is already enforced today.** Only 834 is genuinely new, and it's unclear from the canon whether 834 replaces the current 900 check or supplements it — none of the six declared v2 bands (1600/1300/1100/1000/768) is 900 or 834 exactly.
- Fix: correct both rows to state the suite today checks 393 + 900 + 1280, and add an explicit ruling on the 900 check's disposition (replace with 834, or keep both) rather than implying 1280 is new work.

## Minor

**2. "Grounding counts live in the drawer" is contradicted by the cited source's main panel.**

- `DESIGN_SYSTEM.md:171` (rule 16): "Prose, grounding counts, the cited contract and the as-sent inputs live in the drawer — the panel never grows to hold them."
- `design/src/screens/ai-read.mjs:48` — inside the **"Produced · trade"** panel (not the drawer card) — renders `"3 of 4 figures trace to Convexa. Within your per-trade cap ($500)."`, a grounding-count sentence, and line 49 renders a folded `<details>` "Why" block (prose) in the same panel. The separate "Full analysis drawer" card (lines 124-130) repeats a fuller breakdown: `"Checked 4 · traced 3 · untraced 1 · not checkable 0"`.
- The per-field check/dash "grounding line" the rule also describes is correctly in-panel; the issue is narrower — the aggregate count sentence and the folded prose both live in the panel too, not only the drawer. Likely intent: a one-line summary is allowed in-panel and only the *itemized* breakdown + full prose is drawer-only — the rule's wording doesn't say that.
- Fix: narrow the sentence to distinguish the one-line in-panel summary from the itemized breakdown reserved for the drawer, or cite the exact line that is/isn't allowed in-panel.

## What I checked

1. **Ruling fidelity** — all 8 numbered contradictions and the "carried forward unchanged" list in `DESIGN_SYSTEM.md`'s 2026-09-03 Amendments row, checked item-by-item against the contradiction table and carried-forward paragraph in `rebaseline-2026-09-03.md`; also the Rival-authority-dispositions and Enforcement-deferred sentences. All matched in substance.
2. **Generic AI-default clusters** — palette/type in `tokens.ts` and `tokens.json` against the four listed defaults (cream/terracotta, acid-green terminal, white broadsheet, Inter/purple SaaS): amber-dominant near-black canvas with green reserved for signed direction only, Archivo/Plex not Inter — none matched; each v2 addition cites a `design/src/components/*.mjs` or `CHANGELOG.md` source.
3. **Project Banned** — read the 17-row Banned table; grepped `design/` for `Inter`, `0d1117`/`161b22`, `f4f1eb` (no matches); manually inspected every `gradient` use in `design/src/lib.mjs` (sheen, button, wordmark, gamma-surface glow) — none binds a gradient to the wordmark or a CTA.
4. **Codify-only** — same item-by-item pass as (1); no contradiction was averaged rather than ruled.
5. **Thin honesty** — hand-reproduced `verify-tokens.mjs`'s comparison logic against `tokens.ts`/`tokens.json` (all 20 pairs match, supporting the "20/20" claim; could not execute the script, no Bash tool); confirmed `shape.borderRadius` is `10` at `tokens.ts:83` as claimed; confirmed the seven v2 tokens are genuinely absent from `tokens.ts`; verified "nine named states" against `design/src/screens/ai-read.mjs`'s `cards` array (exactly 9, header confirms "nine honest states") — accurate; found findings 1-2 above.
6. **Single authority** — read `docs/design/DESIGN_SYSTEM.md` (explicitly defers, flagged pending retire-or-stub at `DESIGN_SYSTEM.md:21,151`), `design/README.md` (reworded as claimed), `design/tokens/tokens.json` `$comment` (reworded as claimed), `design/CHANGELOG.md` (decision log, no rule claims), project `CLAUDE.md` (no design rules), `.spire/clusters/tech/context/INDEX.md` (pointer only), grepped `design/site/library.html` for authority language (none). No unresolved rival.

**Auxiliary:** Status line format matches the pre-existing two-line Status/maturity precedent set at the 2026-08-10 codify; scaffold headings unchanged. Could not `git show HEAD:.../DESIGN_SYSTEM.md` (no Bash tool available to this seat) to byte-diff the carried-forward Amendments/Wireframe rows against the pre-rebaseline file; instead cross-checked the new 2026-09-03 rows against the session note (matched) and spot-checked the older rows for internal consistency against known repo history.
