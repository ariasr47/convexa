# Memory index (cluster tech)

> **Boot surface — keep short.** Load this file within budget (≤200 lines **or** ≤25KB of body,
> whichever comes first). One pointer per line or tight bullet; move depth into `topics/` or
> `PROJECT_CONTEXT.md`. Do not paste binding rules here — graduate those via the Decision Ledger.
> Product truth is the seam files below; keep this file a map, not a second rulebook.

## How to use
- **Boot:** read this index after the invariant floor; open linked paths only when needed.
- **Topics:** put deep product lore in `topics/*.md`; link them from here.
- **Never:** second copy of a promoted invariant; secrets; machine-local absolute paths.

## Canon (always know these paths)
- [ ] `PROJECT_CONTEXT.md` — product ground truth (sharded; always-load = domain + key decisions)
- [ ] `DECISION_LEDGER.md` — compounding intake; promotions land in PROJECT_CONTEXT §5
- [ ] `OPEN_THREADS.md` — open items; **§9** promoted invariant pointers (boot-load §9 only)
- [ ] `BACKLOG.md` — idea pool / GATE I discovery surface
- [ ] `DESIGN_SYSTEM.md` — visual canon when Status: SET (UI work)
- [ ] `design/` (repo root) — design source the canon points to: canvas, static site + `site/library.html`, `tokens/tokens.json` mirror; regenerate with `node design/src/build.mjs`

## Topics (on demand — not auto-loaded)
> Add one bullet per file under `topics/`. Example:
> - [ ] `topics/domain-notes.md` — <one-line why it exists>
>
> _(none yet)_

## Hot work (pointers only — detail stays in RESUME / contracts)
> Refresh when GATE R or ship changes the picture. Prefer branch RESUME over duplicating state here.
- Active program: `production-maturity` — #5 `capacity-baseline` SHIPPED 2026-08-29; #4 still blocked; #6 next in program order
- Active feature: none in pipeline (unnamed `go` still `grounded-morning-snapshot`)
- Live contracts: `supply-chain-automation` (GATE Q FAIL; external/security blockers)
- Last ship: `exchange-holiday-calendar` GATE S 2026-08-31 (`_archive/`; re-pin JSON in `state/conformance/`)
- Research harvest 2026-08-28: coverage + tape + replay + S3 keep + operator corpus browser SHIPPED
- Harvest 2026-08-31 (post-lab): `docs/briefings/harvest-2026-08-31.html` — `exchange-holiday-calendar` SHIPPED; unnamed `go` still `grounded-morning-snapshot`; keep-paid-books #5 clock 2026-08-26

## Operator shortcuts
- Invariant floor: run the installed `gates.mjs context_for --print` (no feature)
- Continuity: run the installed `continuity.mjs list`
- Feature pack: run the installed `gates.mjs context_for {FEATURE} --write`
- Search memory (prefer before re-reading archives): run the installed
  `gates.mjs memory_query --q "terms" [--scope cluster,feature,branch,episodic]`
