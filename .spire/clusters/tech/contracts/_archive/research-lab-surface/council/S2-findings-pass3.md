# S2 — skeptic findings: research-lab-surface (pass 3)

Fresh adversarial re-pass after R4 repaired pass-2 Criticals. Inputs: repaired `SPEC.md`, `INTERFACE_CONTRACT.md`, `BRIEF.md`, `council/conflicts.json` (13), `council/decisions.md`, R2-architect / R2-pm / R2-ux, `council/S2-findings.md`, `council/S2-findings-pass2.md`. Pass-2 Criticals re-checked against **body text**, not a repair note. Human ruling **A** still settled. Skill: `spire-tech-adversarial-spec-review`.

## Critical  (blocks — must loop back to R4)

- **Warm coverage-region unclassified fail is both coverage-unavailable and stale keep-last.** Ship-blocking AC-38 (and §4 flow 6, §5 Coverage-unavailable) always paint nested **`Coverage readout unavailable.`** with books kept and no `missing` matrix for list-200 + coverage transport / unclassified TypeError / unclassified 5xx — with **no cold-only carve-out**. The same failure, when coverage already succeeded this sitting, is also routed by §2 Warm vs cold (“same sitting for coverage” → stale for **that region only**: keep last body) and by the §4 coverage-card offline/stale cell (“Last matrix kept on **coverage-region stale only**”). One warm coverage Retry/refresh cannot be both unavailable copy and a kept success matrix. That merges classes §8 `absent-is-not-none` and AC-33 require to stay apart (`coverage-unavailable` ≠ `stale`). Compounding: the only stale chip copy is list-keyed **`Couldn't refresh — keeping the last list.`**, shown “when the list region is stale” — so a coverage-only keep-last path also has no operator-visible stale standing and reads as success. — evidence: `SPEC.md` §3 AC-38; `SPEC.md` §4 flow 6; `SPEC.md` §5 Coverage-unavailable; `SPEC.md` §2 Warm vs cold (coverage key / warm same-key); `SPEC.md` §4 coverage card offline/stale column; `SPEC.md` §3 AC-33; `SPEC.md` §8 `absent-is-not-none`

### Pass-2 Criticals — resolved (do not re-block)

- **Warm classified occupancy 500 → stale** — gone in body. §2 defines classified occupancy 500 vs unclassified 5xx; NotStoring / ListStoreError / Unreadable / coverage withheld are cold-or-warm and must not be stale; warm same-key stale is narrowed to unclassified network/TypeError/unclassified 5xx; AC-27 / AC-29 / AC-30 / AC-53 / §5 / §8 state the split explicitly.
- **Chip-switch / chip-follow keep-last of previous symbol’s rows** — gone in body. Chip-switch changes list key and is not a warm Retry; fail arms never restore the previous symbol’s rows or use AC-30 for that; AC-52 / AC-32 / §4 books+digest loading / §5 chip-switch rows require immediate hide + in-flight + new-symbol outcome only.

### Pass-1 Criticals — still gone

- **Warm classified CORS → stale** — still gone (cors-fault cold or warm; corpus hidden; stale chip forbidden).
- **AC-14 cookie-only unobservable under `credentials: 'omit'`** — still gone (GATE Q non-page cookie-without-token 401 probe; page fetches stay omit; no distinct cookie-only Alert).

## Important  (should fix)

- **`present` chip-follow + list occupancy 500 leaves the parallel load digest unspecified under page-level not-storing / list store-error.** Chip-follow issues a new list GET **and** a load GET. List occupancy 500 is page-level AC-27 / AC-53 (no books table, no success coverage matrix). §4 not-storing / list store-error rows never say whether a concurrent success digest, load-miss, or unreadable Alert from the load GET still paints. An implementer can show a success digest under `session archive not storing`, or hide digest with no warrant. — evidence: `SPEC.md` §2 Data flow (chip-follow list+load); `SPEC.md` §3 AC-52 / AC-51 / AC-27 / AC-53; `SPEC.md` §4 not-storing / list store-error rows; `SPEC.md` §5 Chip-switch list fail / Warm classified occupancy 500

- **Page `Retry` does not name which GETs re-fire (list only vs list+coverage vs failed region only).** Warm coverage stale is only reachable if something re-fetches coverage after a success; AC-38 / coverage-unavailable Retry imply a coverage refresh exists; AC-30 describes Retry as same-symbol list. Until Retry’s fan-out is named, builders can “fix” the Critical above by never refreshing coverage — leaving §2/§4 coverage-region stale as dead letter — or by refreshing both and re-hitting the contradiction. — evidence: `SPEC.md` §2 Data flow (Unlock / symbol change / Retry / open); `SPEC.md` §3 AC-30 / AC-38 / AC-46; `SPEC.md` §5 Coverage-unavailable / Warm same-key rows

## Minor / advisory

- **Chip-switch re-entry to a previously successful symbol over-claims “cold”.** Warm definition is prior success for that list key; chip-switch prose says the switch “is cold for the new symbol’s list.” SPY→QQQ→SPY with a failed second SPY list is warm-by-key but chip-switch-by-path (offline, not AC-30 restore). Fail-path text wins; tighten the “cold” wording so it does not redefine warm. — evidence: `SPEC.md` §2 Warm vs cold (definitions + chip-switch paragraph); `SPEC.md` §3 AC-30 / AC-52

- **Deploy canon still names `ALLOWED_ORIGINS` while this slice keys `ALLOWED_BROWSER_ORIGINS`.** SPEC §2 already warns GATE Q / ops; residual doc drift only. — evidence: `SPEC.md` §2 CORS; `docs/DEPLOY_RUNBOOK.md` / `docs/CLOUDFLARE_PAGES_SETUP.md`

## Checked and clean

- **Dropped conflicts** — all 13 `conflicts.json` IDs remain folded in SPEC resolution markers / §9-folding JSON with body resolutions (ruling A coverage In; no export; page-memory only; origin-blocked on research base not `location.host`; runtime API origin; Verify-by dump/sibling `test`). Spot-checked R2-architect (4), R2-pm (5), R2-ux (4) against §1–§3 and `decisions.md`. §9 correctly empty.

- **Unobservable acceptance criteria** — pass-1 AC-14 stays repaired. Remaining ship-gate `test` rows name outside-the-code signals (titles/framing, network omission, columns, structural scans, GATE Q plants). AC-26 / present-click arms still allow honest UNVERIFIABLE. New Critical above is a contradiction between observable paints, not an unobservability gap.

- **Unspecified component states** — §4 matrix still covers default · loading · empty · error · offline/stale for page / gate / coverage / books / digest; gate arms, occupancy faults, load-faults, and envelope-scoped invariant-fault have copy. Pass-2 Important gaps (chip-switch in-flight hide, invariant-fault envelope copy, list store-error in AC-33/§1) are filled in body. Residual: coverage warm stale vs unavailable (Critical); present-click digest under list occupancy 500 (Important).

- **Interface mismatch** — conformance block still matches §2’s three existing GETs; coverage omits `et_date`; auth is metrics token not cookie `"auth": true`. Three GATE Q plants remain distinct. Standing rule 10 (classified occupancy 500 ≠ warm stale) matches the repaired list/load occupancy split. No new missing UI field on the wire.

- **Internal contradiction** — pass-2 occupancy-500-vs-stale and chip-switch-keep-last Criticals are repaired in body. New contradiction: warm coverage-region stale vs AC-38 / flow 6 (Critical above). No clash found on ruling A vehicle set, 404 split, Books `source` vs coverage `present`, cors-fault ≠ stale, classified list/load occupancy 500 ≠ stale, chip-switch ≠ previous-symbol keep-last, or NO_BACKEND_CHANGE / Pages 404.

- **Guardrail breach** — no requirement reopens `/lab`, AppShell wrap, TopNav operator entry, Pages `_research` proxy, export of load bodies, `present`/`kept` on the books table, minting coverage from list `source`, baking origin/token, or scoring from this surface. Live `absent-is-not-none` breach is the warm coverage-unavailable/stale collapse called Critical above; pass-1 cors and pass-2 occupancy/chip-switch collapses stay gone.
