# S2 — skeptic findings: curvature-v2-surfaces

Reviewer note: this review reads at a different provider tier than R4 (spire-tech-council-synthesizer)
by design — that is the whole point of this seat, not a fact to reconcile. Every finding below was
checked against the actual source file, not against the council's paraphrase of it, per the phase's own
`[cited-code-is-verified-not-assumed]` guardrail.

## Critical (blocks — must loop back to R4)

- **D-C's closed count ("all seven live `info=` sites") is wrong — there are eight, and the SPEC's own
  ship-blocking criterion U-32 inherits the miscount.** I enumerated every `<Widget ... info={…}>` call
  site in the current tree (`apps/dashboard/src/app/pages/ticker/widgets/**`):
  `off-exchange-blocks/OffExchangeBlocks.tsx:39`, `dealer-flow-projection/DealerFlowProjection.tsx:159`,
  `term-structure/TermStructure.tsx:34`, `market-context/MarketContext.tsx:417`,
  `fresh-positioning/FreshPositioning.tsx:38`, `iv-rank/IvRank.tsx:276`,
  `structure-hero/StructureHeroPanel.tsx:216`, **and `live-tape/LiveTape.tsx:179`** — eight, not seven.
  `straddle-move/StraddleMove.tsx:55`, `setups/Setups.tsx:31`, `read-strip/ReadStrip.tsx:37`,
  `structure-history/StructureHistory.tsx:25` and `ai-rec/AiRecPanel.tsx:258` pass no `info` prop, so they
  are correctly excluded. The council's own D-C fact statement (`decisions.md` §4: *"Widget.tsx:245-249
  renders info as a bare icon in a hover tooltip at seven live sites, one of them the desk hero
  (StructureHeroPanel.tsx:216)"*) undercounts the desk side by exactly one — it names the hero but misses
  `LiveTape.tsx:179`'s `info={info}`, which is unconditionally passed to the same shared `<Widget>`. That
  miscounted "seven" then rides unchanged into the OWNER ruling (D-C: *"at all seven live `info=`
  sites"*), into SPEC §1's in-scope bullet, and into criterion **U-32 (SB)**: *"…at **all seven** live
  `info=` sites…"*. §8's guardrail list claims *"six facts were re-read at source for this synthesis"* —
  this count evidently was not one of them. Practically: if the fix lands as a change to the shared
  `Widget.tsx` info-icon rendering (the mechanism the criterion itself names — *"using the ONE shipped
  focusable-help pattern"*), all eight sites likely get fixed together regardless of the stated count. But
  the SPEC's own idiom elsewhere is call-site enumeration (e.g. criterion 1's *"declares an explicit
  register at its call site"*, the `{ retained }` prop threaded per call site in §2.1), so a build or a
  GATE Q reviewer working literally off "seven, named" has a real chance of never touching
  `LiveTape.tsx:179` and closing the criterion anyway. Either way, a criterion whose own closed count is
  provably false against the source tree is a vacuous/incorrect gate under `[structural-over-prose-
  enforcement]`, on an OWNER-tagged ruling that is supposed to be the one thing everyone can trust without
  re-deriving. **Fix:** correct "seven" → "eight" in §1's in-scope bullet, in criterion U-32, and in
  `decisions.md` §4 D-C's fact statement; add `LiveTape.tsx:179` to the enumerated site list; and make
  explicit that the desk-spec re-run required by U-32 (a11y tree, focus order, single-motion-moment,
  live-dot census) covers `live-tape`'s specs as well as the hero's, not only the hero's.

## Important (should fix)

- **Criterion N-1's "keeping its mutation guard" reuses a guard that does not test either of the two new
  needles, risking a vacuous poison-proof.** `fonts.spec.ts:154-167` is real, is `?raw` over
  `/src/app/**`, and is mutation-guarded — but the guard at `:157-161` ("MUTATION GUARD: the face scan
  fails on an Inter literal") only proves the checker catches a *retired face literal* (`Inter`, `Roboto
  Mono`, `Cascadia Code`). It says nothing about "no closed-nine member inside a mono-bound `sx`" or "no
  font-family literal outside `tokens.ts`/the shared figure module" — N-1's two new needles. §7 and §8
  both name the exact failure mode this creates: phase 1 shipped two `expect(true).toBe(true)` bodies
  under a "MUTATION PROOF" heading (criterion 69 exists because of it), and `[structural-over-prose-
  enforcement]` requires every new rule to ship with its own red-going poison run. N-1's phrasing
  ("extended with two needles… keeping its mutation guard") reads as though the *existing* guard already
  covers the extension; it does not, and the SPEC should say the two new needles each need their own new
  mutation-guard test, not that the file "keeps" a guard that already exercises them. — evidence:
  `apps/dashboard/src/app/shared/theme/fonts.spec.ts:154-167` (read in full).

- **The `retained` staleness threshold that criterion 12/13/N-1's whole retained-vs-bare split rests on is
  never given a number.** §2.2 says F4 (`offline.retained`) is *"driven by the age of the per-symbol
  `ts`"* (`useLivePrices.ts:24-27`), replacing the broken blanket `offline` flag
  (`useLivePrices.ts:65-67`, confirmed at source: `setOffline(false)` fires unconditionally on any
  message, before the `prices` key is even checked). That repair is real and needed. But nowhere in SPEC
  or INTERFACE_CONTRACT is the actual staleness cutoff stated — is a price "retained" (dim + pause mark)
  the instant a newer poll would have ticked it, or only past the shipped 45s `SILENCE_MS` watchdog, or
  some third number invented at build time? Criterion 12 ("a price whose displayed value came from the
  now-dead stream renders…") is observable in principle, but the exact moment it must start being true is
  an unstated design decision with no cited authority, unlike every other numeric threshold in this SPEC
  (20/17/15px ladder, 44px floor, 11px floor, 45s watchdog) which is either declared or inherited from a
  named constant. — evidence: SPEC §2.2 ("driven by the age of the per-symbol `ts`"); `useLivePrices.ts:
  24-27,37,65-67` (read at source).

## Minor / advisory

- **INTERFACE_CONTRACT.md's `PUT /api/scan/view` row mislabels its 503 case.** It states *"503
  auth_unavailable"*, but the actual handler (`apps/api/src/routes/scan.rs:776-782`, read at source)
  returns `StatusCode::SERVICE_UNAVAILABLE` when `state.universe` is `None` — i.e. "scan universe
  unavailable," a config/data-availability fault, not the auth service's own `auth_unavailable()` (which
  is a distinct function in `services/auth/service.rs:165-171`, unrelated to this route). The 403
  `auth_required` and 422 validation cases *are* correct (`auth.rs:1298`→`service.rs:144-149`;
  `scan.rs:784-789`). Low impact — this endpoint is explicitly "Deliberately NOT pinned" and untouched
  this phase — but it is exactly the kind of citation `[cited-code-is-verified-not-assumed]` exists to
  catch, and it's easy to fix: say "503 (universe unavailable)" instead of "auth_unavailable."

- **`decisions.md`'s own headline undercounts its OWNER rulings.** The top of the file states *"3 product
  calls surfaced to the owner one at a time (one further product conflict collapsed into a self-revision
  + D-A, see §4)"*, but §4 documents **four** distinct, dated, OWNER-tagged rulings (D-A, D-B, D-C, D-D),
  each with its own "Ruling: … — OWNER, 2026-09-06" line. SPEC's own provenance banner correctly says
  "four OWNER rulings," so this isn't a SPEC defect — but SPEC's provenance claims are only as trustworthy
  as `decisions.md`'s bookkeeping, and this is a headcount the source document gets wrong about itself.

## Checked and clean

- **Dropped-conflict sweep.** All 27 `conflicts.json` entries (indices 0–26) traced to a disposition:
  7 self-revisions (§1: #7,#8,#14,#15,#24,#25,#26), 2 converged-by-self-revision (§2: #11,#12), 11
  exchanged-and-settled (§3: #0,#1,#2,#3,#4,#13,#16,#17,#21,#22,#23), and 7 routed to the owner/collapsed
  (§4: #5,#6,#9,#10,#18,#19,#20). None is silently absent from `decisions.md` or from SPEC §1/§9.
  Provenance tags (OWNER/CONDUCTOR) on SPEC rows match `decisions.md` §4 in every case I checked except
  the D-C count itself (Critical, above).
- **D-A mechanics, read at source.** `useLivePrices.ts` (whole file), `liveClaim.ts` (whole file),
  `liveClaim.spec.ts` (whole file), `Scanner.tsx` (whole file), `pages/scanner/labels.ts` (whole file):
  the frame genuinely carries no `market_session`/`live` field; `isDeliveringLive` genuinely cannot
  produce a true claim from it; the `setOffline(false)`-on-any-frame defect is real; the header/gloss
  strings quoted in §2.2/§4.2 are byte-identical to what ships today; the widened `liveClaim.spec.ts`
  glob and the `genuineIsLive` replacement target real call sites (`PositionsPage.tsx:31,88`, confirmed).
- **D-D mechanics, read at source.** `FigureCell.tsx:158-300`: `register` is required-no-default; the F9
  branch (`register === 'asserted'` and not-literal) is the only path that can emit
  `${assertedBy} · untraced`; setting `register: 'traced'` at a user-entered-value call site structurally
  routes into the F1/F3 branch instead, so F9 becomes unreachable for that input by construction, not by
  convention.
- **Positions register inversion.** Confirmed exactly one cell (`PositionRow.tsx:374-378`, `delta_entry`)
  renders a closed-nine member (`DASH`) inside a mono-bound `sx`; every other DASH-rendering branch in the
  same file (`pl`, `pl_pct`, `strike`, `right`, `expiry`, `dte`, `entry_time`, `stop`, `target`) is
  already Sans. `literal()` (`:145-153`), `dashCell` (`:167`, confirmed deliberately untestidded via its
  own `:69` comment), and the three testids (`:164,166,348`) match the shipped
  `positions.risk.spec.tsx:858,859,860,885` assertions.
- **Alerts durable-store defect and fix shape.** `store.ts:41-49,59-68,80-108` confirmed: `readAlerts()`
  degrades to `empty()` on a parse failure without writing, but the *next* `upsertRule`/`pushEvent`/
  `setNotifyBrowser` call reads that cached empty state and `persist()`s it over the same key — a real,
  reproducible loss path the read-fault latch is the correct fix for. `evaluate.ts:83,94` and
  `AlertsPage.tsx:189,192,193,225` confirmed byte-for-byte against SPEC's citations, including the bare
  `'level'` fallback (line 193) and the raw `r.kind` label (line 189) that criterion 45 targets.
- **Quiet-band copy freeze.** `_kit/copy.ts:355` (`MC_CELL_EMPTY`), `MarketContext.tsx:291,299,375`
  (value-slot usage, confirmed via `LabelRow`/`AtrRow`), `Setups.tsx:32,41,52`, `FreshPositioning.tsx:
  15,41-48,56-58`, `OffExchangeBlocks.tsx:24,46-55,79-81` all match their citations exactly, including the
  `'—'`-inside-a-mono-run defect and the never-checked/checked-and-empty split.
- **Durable-store key inventory.** `convexa.positions.v3`/`v2`/`ghost-trade.v1` keys
  (`positions/store.ts:60-64`) and `convexa.orders.v1` (`orders/store.ts:19`) match exactly; the
  union-runs-once / never-delete design in `store.ts`'s header comment is consistent with criterion 70's
  loss-free requirements.
- **Interface contract vs. generated schema.** `ScanEnvelope`/`ScanRowDto` nullability
  (`schema.ts:2235-2265`) matches the conformance block field-for-field; `scan.rs:318` confirms
  `optional-session` on `GET /api/scan`; `scan.rs:343` confirms `session` on `PUT /api/scan/view`
  (which is correctly left unpinned).
- **Rule 24's "ship on the positions and broker surfaces" — tested as asked.** Read at source
  (`DESIGN_SYSTEM.md:179`): the clause is followed immediately by the canon's own "accepted cost" sentence
  about `no basis` potentially appearing on an unlisted (ticker) surface, which it pre-approves as *"a
  per-surface subset, not a second vocabulary"* rather than treating as a violation. That framing reads as
  **descriptive** (naming where these three members originated and are proven non-synonymous today), not
  **exhaustive** (barring any other surface from ever using an existing member). Under that reading,
  SPEC §4.5's routing of `not recorded` onto alerts (a fourth surface, reusing an existing closed-nine
  member rather than minting a tenth) is consistent with the canon rather than in tension with it. I flag
  this as tested-and-resolved rather than open: if this synthesis wants belt-and-suspenders, recording
  this reading explicitly (rather than leaving §9 item 4 as a live contingency after this review) would
  remove the last reason criterion 47d's SB status could be second-guessed at GATE Q.
- **Canon amendments queued.** Exactly two rows in §4.7's table (rule 13's one-clause widening; the Icons
  row question), both correctly marked "not applied by the build," and rule 13's widening text is exactly
  the one clause D-D specifies — no drift beyond it.
- **Criteria/SB counts.** 95 criteria (verified by row count across §3 A–G, accounting for the two
  uppercase-suffixed rows `11A`/`37A` that a naive lowercase-only scan misses) and 53 SB-marked rows
  (verified independently by counting `**SB**` occurrences minus the one in the prose legend at line 506)
  both check out exactly as SPEC states. Spot-checked a sample of SB rows (5, 6, 24, 25, 44, N-1, 62, 67,
  70) against the "would regress invisibly" bar — all defensible, none reads as cosmetic-only.
- **Scope leakage.** No `/api/broker/*` touch, no backend diff, no new durable key, and no survival of the
  BRIEF's "snapshot surfaces" / "rail → tabs" wording found anywhere in SPEC — all three are explicitly
  and correctly corrected in §1.

## Verdict: PASS WITH FINDINGS
