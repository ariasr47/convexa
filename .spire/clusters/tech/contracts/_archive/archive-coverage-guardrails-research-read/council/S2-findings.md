# S2 — skeptic findings: archive-coverage-guardrails

Pass 2 of 2.

## Critical  (blocks — must loop back to R4)

- None. Pass-1 Criticals re-checked and closed:
  - **Cell taxonomy:** §1 In scope now lists `blocked occupancy` among closed operator cells with §4 / INTERFACE `cell` / AC-1 — evidence: `SPEC.md` §1; `SPEC.md` §4 Closed cell literals; `INTERFACE_CONTRACT.md` Closed wire vocabularies `cell`
  - **Future-D `not_due`:** §2.1 + INTERFACE `verdict` + AC-31 + CLI exit notes all name named future ET weekday as `not_due` / `[NOT DUE]` — evidence: `SPEC.md` §2.1 Due clock; `SPEC.md` §3 AC-31; `INTERFACE_CONTRACT.md` Endpoints §1 `verdict`
  - **AC-27 vs `holes[]`:** AC-27 is identity+class only; blocked gloss and unreadable reason are CLI-only; INTERFACE `holes[]` has no detail/message — evidence: `SPEC.md` §3 AC-27; `SPEC.md` §4 Hole list; `INTERFACE_CONTRACT.md` Response `holes[]` + Standing rule 8

## Important  (should fix)

- **§4 Glossary contradicts §2.1 on what “expected identity” means.** Glossary: “expected identity = `(SPY|QQQ|IWM, ET weekday)` **after checkpoint**.” §2.1 builds the expected set from weekday+seed rules **before** the due clock; checkpoint only flips due vs `not yet due`. AC-53 treats glossary sentences as approved copy, so review can bless the wrong definition while AC-10 still requires pre-checkpoint cells. — evidence: `SPEC.md` §4 Glossary; `SPEC.md` §2.1 Expected set / Due clock; `SPEC.md` §3 AC-53 / AC-10

- **Future weekday `not yet due` cells are prose-locked but not ship-gate tested.** Repair correctly added future-D to INTERFACE verdict/rows and AC-31 exit/verdict, but AC-10 only covers **today** before 16:00. A build that treats a named future weekday like weekend (`rows: []`, `NO EXPECTED IDENTITIES`) or emits `missing` can still satisfy AC-31’s exit/`not_due` clause. — evidence: `SPEC.md` §3 AC-10 vs AC-31; `SPEC.md` §2.1; `INTERFACE_CONTRACT.md` Response note “named future ET weekday: `not yet due` rows … framing **without** `NO EXPECTED IDENTITIES`”

- **§2.2 exit parenthetical blurs PASS vs `[NOT DUE]` after the future-D fold.** It says exit 0 when “every **due** expected identity is `Present` (**including** pre-checkpoint today and a named future weekday…)”. Those windows have **zero** due identities; reading “including” as a Present/PASS path fights the next sentence and AC-31. Tighten so vacuous/not-due cannot be mistaken for the all-present branch. — evidence: `SPEC.md` §2.2 CLI / HTTP exit-equivalent; `SPEC.md` §3 AC-31; `SPEC.md` §4 CLI verdicts Pass vs Not due

## Minor / advisory

- **`[PASS]` line still omits `0 blocked occupancy`** while counts now define `n = p+m+u+b`. Exit/ACs keep blocked from a true PASS, but the receipt text only asserts `0 missing · 0 unreadable` — weaker than R3’s “cannot hide behind that line” intent. — evidence: `SPEC.md` §4 CLI verdicts Pass; `SPEC.md` §3 AC-49; `council/R3-ux-architect.md` `4d21ed8a…`

- **CLI component-state “empty” equates `[NOT DUE]` with weekend-only.** Today-before-checkpoint / future weekday are also `[NOT DUE]` but still print `not yet due` cells (default column), not the empty weekend shape. — evidence: `SPEC.md` §4 Component states; `SPEC.md` §3 AC-10 / AC-31

- **`decisions.md` hole-line gloss is slightly behind the AC-27 split.** decisions still writes the operator hole line with `— occupant is not a live paid session book`; SPEC/INTERFACE make that gloss CLI-only. SPEC is authoritative; tidy the decision note so GATE Q does not chase decisions as HTTP copy. — evidence: `council/decisions.md` Wrong-source occupancy; `SPEC.md` §4 Hole list; `INTERFACE_CONTRACT.md` Explicit non-endpoints

## Checked and clean

- **Dropped conflicts** — all 20 `conflicts.json` IDs are present in `SPEC.md` folding metadata with matching § loci; §9 empty and correctly claims D1/D2 + R3 closed them (including one-D over architect range, named-date false-missing residual over UX “not missing”). Spot-checked R2-architect (7), R2-pm (6), R2-ux (7) quotes against fold comments + `decisions.md`.
- **Unobservable acceptance criteria** — ship-gate `test` rows checked for external observability (matrix cells, CLI exit/lines, warning text, token 401, Pages 404, score/bundle isolation, store before/after for no-insert). No remaining hollow “renders without throw” SB AC. (Future-D **cell** coverage gap called Important above; AC-31 itself is observable.)
- **Unspecified component states** — §4 table still covers trader UI, `/_ops/metrics`, CLI, Coverage HTTP for default/loading/empty/error; S2 latch in §2.4/§5. No new unnamed operator surface.
- **Interface mismatch** — conformance block fields match INTERFACE Response table; §2 derive → HTTP/CLI twin holds; `NO_UI_CHANGE` so no UI field consumes an unpromised DTO. Prior provenance / count / gloss mismatches from pass 1 are repaired (`no vendor call` on `rows: []`; `expected_due = p+m+u+b`; CLI-only gloss).
- **Internal contradiction** — prior §1/§4 cell split and AC-27/holes phrasing clash are gone. Remaining glossary / §2.2 blur called Important above; no other section-pair disagreement found on clock, weekend, StoreDisabled, last-readable, or blocked occupancy.
- **Guardrail breach** — no requirement reopens trader UI, nests coverage on `_metrics`, calls Massive on coverage, scores from coverage, redistributes chain bodies, or treats local CLI as hosted evidence. Spot-checked cited Rust: `ENSURE_SYMBOLS`, seed symbol, `is_et_weekday`, two-arm `MarketDataSourceKind`, `load_missing_object_behind_locator_is_err_not_none`, Pages `/api/_research` 404, `metrics_token_ok`, `Capacity` `ExitCode` seam.

---

**Produced:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/council/S2-findings.md` (pass 2 of 2).

**Decided:** none (skeptic reviews only). Prior Criticals verified closed; no new Criticals.

**Carry forward:** 3 Important (glossary vs §2.1 expected-identity; future-D cell AC gap; §2.2 PASS/`[NOT DUE]` parenthetical) and 3 Minor for R4 polish if a repair loop runs; otherwise build may proceed with Critical=0.

**Unresolved:** none blocking. Count — **Critical 0 / Important 3 / Minor 3**.
