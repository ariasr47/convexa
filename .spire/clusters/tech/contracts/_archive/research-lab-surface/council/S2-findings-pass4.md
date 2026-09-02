# S2 — skeptic findings: research-lab-surface (pass 4)

Fresh adversarial re-pass after extra R4 claimed to repair pass-3’s Critical. Inputs: current `SPEC.md`, `INTERFACE_CONTRACT.md`, `BRIEF.md`, `council/conflicts.json` (13), `council/decisions.md`, R2-architect / R2-pm / R2-ux, plus read-only `council/S2-findings.md`, `S2-findings-pass2.md`, `S2-findings-pass3.md`. Claims 1–5 and pass-3 Importants re-checked against **body text**, not a repair note. Human ruling **A** still settled. Skill: `spire-tech-adversarial-spec-review`.

## Critical  (blocks — must loop back to R4)

- None.

### Pass-3 Critical — gone in body (do not re-block)

- **Warm coverage-region unclassified fail is both coverage-unavailable and stale keep-last** — gone. Classifier Coverage-unavailable, Warm vs cold, AC-30, AC-38, §4 flow 6, coverage-card offline/stale (“**No coverage-region stale keep-last path**”), §5 Warm coverage unclassified fail, and §8 `absent-is-not-none` all send coverage unclassified transport / TypeError / unclassified 5xx to **`Coverage readout unavailable.`** cold or warm (including after a prior coverage 200), with **no** kept success matrix and **no** stale chip. Stale is **list-region AC-30 same-chip Retry only**.

### Extra R4 claims 1–5 — verified in body

1. Coverage unclassified → always AC-38; books stay when list legal; no success matrix; no coverage-region stale — **holds** (`SPEC.md` §2 Coverage-unavailable arm / Coverage GET bullets; §3 AC-38; §4 coverage card offline/stale; §5 Coverage-unavailable / Warm coverage unclassified fail).
2. Page `Retry` = selected-symbol **list GET + coverage GET** (never load); digest `Retry` = load only — **holds** (`SPEC.md` §2 Retry fan-out table; §3 AC-46; §5 Retry column).
3. Chip-follow + list occupancy 500 = **list-occupancy exclusive standing** (no concurrent load digest / load-fault) — **holds** (`SPEC.md` §2 List-occupancy exclusive standing; §3 AC-27 / AC-51 / AC-52 / AC-53; §4 not-storing / list store-error; §5 Chip-switch list fail).
4. Pass-1 Criticals still gone: warm classified CORS → cors-fault not stale; AC-14 = GATE Q non-page cookie-without-token 401 under page `credentials:'omit'` — **holds** (`SPEC.md` §2 / §3 AC-16 / AC-14; §5 Classified CORS / Cookie-only; `INTERFACE_CONTRACT.md` Standing rules 4–5).
5. Pass-2 Criticals still gone: warm occupancy-500 → occupancy arm not stale; chip-switch / chip-follow never keeps previous symbol’s rows via AC-30 — **holds** (`SPEC.md` §2 Warm vs cold / chip-switch bullets; §3 AC-27 / AC-30 / AC-52 / AC-53; §4 books+digest; §5).

### Pass-3 Importants — folded in body (see Checked and clean)

- Page Retry fan-out named (list+coverage vs digest load-only).
- Chip-follow + list occupancy 500 exclusive standing named (hides parallel load digest / load-fault).

## Important  (should fix)

- **Load-region unclassified transport is underspecified: cold open has no standing, warm path is silent keep-last with no distinguishable paint.** List and coverage both name cold/warm unclassified arms (AC-17 / AC-30 / AC-38). Load does not. §4 Load digest offline/stale only says “Last digest kept on **same-identity unclassified load fail only** (no stale chip — that copy is list-keyed AC-30)” — i.e. a failed re-open or failed Digest-region Retry can keep painting a success digest with **no** Alert, **no** chip, and **no** AC/§5 row. Cold first open that fails as unclassified TypeError / unclassified 5xx (not CORS, not miss, not unreadable) has **no** digest-region offline copy and is absent from §5. Digest-region `Retry` is only for unreadable / load invariant-fault; if that Retry then fails unclassified, §4 keep-last can restore a success digest that AC-29 just hid — failure reads as success. That is an `absent-is-not-none` honesty gap for the digest region, not a re-open of the repaired coverage-unavailable/stale collapse. — evidence: `SPEC.md` §4 Load digest offline/stale column; `SPEC.md` §2 Retry fan-out (Digest-region Retry); `SPEC.md` §3 AC-29 / AC-17 / AC-38 (no load-unclassified twin); `SPEC.md` §5 Unreadable / no “load unclassified” row; `SPEC.md` §8 `absent-is-not-none`

## Minor / advisory

- **Deploy canon still names `ALLOWED_ORIGINS` while this slice keys `ALLOWED_BROWSER_ORIGINS`.** SPEC §2 already warns GATE Q / ops; residual doc drift only. — evidence: `SPEC.md` §2 CORS; `docs/DEPLOY_RUNBOOK.md` / `docs/CLOUDFLARE_PAGES_SETUP.md`

- **AC-38’s Retry sentence names coverage GET recovery and defers fan-out; a hurried reader could miss that the same control also re-lists.** Not a contradiction (AC-46 / §2 table are binding), but the AC-38 shorthand is thinner than the table. — evidence: `SPEC.md` §3 AC-38 vs AC-46; `SPEC.md` §2 Retry fan-out

## Checked and clean

- **Dropped conflicts** — all 13 `conflicts.json` IDs remain in SPEC resolution markers and §9 folding JSON with `source` filenames `R2-architect.md` / `R2-pm.md` / `R2-ux.md` (not bare role). Body resolutions still hold: ruling **A** coverage In; no export; page-memory only; origin-blocked on research base not `location.host`; runtime API origin; Verify-by dump/sibling `test`. Spot-checked R2-architect (4), R2-pm (5), R2-ux (4) against §1–§3 and `decisions.md`. §9 correctly empty. Hashes not recomputed (no Bash); each conflict has a body resolution.

- **Unobservable acceptance criteria** — pass-1 AC-14 stays repaired (non-page probe + structural omit). Remaining ship-gate `test` rows name outside-the-code signals (titles/framing, network omission, columns, structural scans, GATE Q plants). AC-26 / present-click arms still allow honest UNVERIFIABLE. Residual Important above is missing load-unclassified standing, not an unobservable ship-gate AC.

- **Unspecified component states** — §4 matrix still covers default · loading · empty · error · offline/stale for page / gate / coverage / books / digest; gate arms, occupancy faults, load-faults, envelope-scoped invariant-fault, Retry fan-out, and list-occupancy exclusive standing have copy. Pass-3 Important gaps (Retry fan-out; chip-follow digest under list occupancy 500) are filled. Residual: load-region unclassified / silent digest keep-last (Important above). Pass-3 Minor “chip-switch over-claims cold” wording is gone (chip-switch prose no longer calls re-entry “cold”).

- **Interface mismatch** — conformance block still matches §2’s three existing GETs; coverage omits `et_date`; auth is metrics token not cookie `"auth": true`. Three GATE Q plants remain distinct. Standing rules 10–12 (classified occupancy 500 ≠ stale; coverage transport fail ≠ keep-last; list occupancy 500 hides concurrent load) match the repaired SPEC. No new UI field consumed off-wire.

- **Internal contradiction** — pass-3 coverage-unavailable vs coverage-region stale Critical is repaired in body (claims 1–2). Pass-1 cors≠stale and pass-2 occupancy-500≠stale / chip-switch≠keep-last stay consistent across §2 / §3 / §4 / §5 / §8. Pass-3 Importants (Retry fan-out; exclusive standing) are named and aligned. No clash found on ruling A vehicle set, 404 split, Books `source` vs coverage `present`, or NO_BACKEND_CHANGE / Pages 404. Residual: load silent keep-last vs distinguishable failure (Important above) — not a re-collapse of AC-38.

- **Guardrail breach** — no requirement reopens `/lab`, AppShell wrap, TopNav operator entry, Pages `_research` proxy, export of load bodies, `present`/`kept` on the books table, minting coverage from list `source`, baking origin/token into storage/query, or scoring from this surface. Coverage-unavailable ≠ stale and list-occupancy ≠ concurrent digest stay explicit under `absent-is-not-none` / `present-is-live-paid-only` / `operator-vs-trader-path-separation` / `server-side-gate-enforcement` / `structural-over-prose-enforcement`. Residual digest silent-keep honesty is Important above, not a Critical guardrail reopen of the repaired classes.
