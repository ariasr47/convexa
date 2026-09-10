# curvature-v2-surfaces — brief

Goal:            Carry Curvature Terminal v2 onto the **four remaining product surfaces** — **scanner ·
                 positions · settings · alerts** — and **convert the eight ticker quiet-band widgets**
                 that phase 1 deliberately left hand-rolled. Concretely: (a) every figure on these
                 surfaces becomes a **`FigureCell`** (canon 13) so the **type register** carries
                 authorship (Mono = traced to Convexa's own computation, Plex Sans = asserted but
                 untraced) and liveness lives in the label row rather than in per-surface convention;
                 (b) the eight quiet-band widgets (`dealer-flow-projection`, `market-context`,
                 `iv-rank`, `straddle-move`, `term-structure`, `fresh-positioning`,
                 `off-exchange-blocks`, `setups`) gain **register enforcement and container steps** —
                 the two structural gaps phase 1's ruling 6 named and explicitly deferred to "the phase
                 that rebuilds them"; (c) the surfaces adopt the **declared scales** (4-pt spacing;
                 radius panel 12 / dialog 16 / control 8 / pill 999) and **panels-as-containers**
                 (canon 21) so a figure reads correctly in any cell or rail; (d) the **closed
                 nine-member not-a-number vocabulary** (canon 24) is enforced where it is most
                 load-bearing — canon 24 states `not recorded`, `not provided` and `no basis` "ship on
                 the **positions** and broker surfaces" with specs asserting non-synonymy; and (e) the
                 **settings rail → tabs at 900** and the **scanner's phone-width card fallback** are
                 brought under the same responsive discipline the desk now has.
                 **Explicitly NOT in this phase:** the landing page, the site/blog pages, and the
                 responsive sweep are **phase 4**, along with the structure field's point-by-point
                 **curve text-equivalent** (DELEGATED P1) and the **spacing-exemption remainder**. The
                 ticker **desk** is done (phase 2) and is not reopened. No backend change.
Decision impact: Today the register rule — the one that answers *"is this number Convexa's, or the
                 model's?"* — is enforced **only on the ticker desk**. A trader who scans, opens a
                 position, or sets an alert crosses into surfaces where the same question is answered by
                 per-surface convention, or not at all. That is the inconsistency the phase closes.
                 Observed when: every figure on scanner / positions / settings / alerts renders through
                 `FigureCell`, so its register and its liveness are in the same place they are on the
                 desk; the eight quiet-band widgets step their figures at the declared container
                 thresholds (20 → 17px under 360px of panel width → 15px under 280px) and can no longer
                 render an untraced figure in the mono register; every absent value on the positions
                 surface renders a **member of the closed nine**, with the specs asserting the three
                 positions-side members are **not synonyms** of each other; and the no-overflow suite
                 stays green at **393 in both schemes, 834 / 900 / 1280 in one** with the scanner's
                 11-column table falling back to cards at phone width and the settings rail collapsing
                 to tabs at 900.
Feasibility:     pass. Frontend-only — no backend change, no vendor call, no math touched; the
                 `apps/api` diff must be **empty** measured **three-dot** (`git diff origin/main...HEAD
                 -- apps/api`) and `opportunity_score` / `opportunity_tier` / `state_fingerprint`
                 byte-identical. Five facts were **read at source** rather than assumed
                 (`[cited-code-is-verified-not-assumed]`), and one of them corrects a claim I made in
                 phase 2's brief:
                 (1) **These four surfaces have ZERO `FigureCell` between them.** Phase 1 landed the
                 primitive "at every existing `StatTile` call site", and every such site was
                 ticker-local — so scanner, positions, alerts and settings never received it. This is
                 the phase's largest single piece of work and it is a **conversion, not a re-skin**.
                 (2) **The eight quiet-band widgets are equally unconverted**, and this **corrects
                 phase 2's brief**, which asserted they "already consume `FigureCell` from phase 1".
                 They do not — zero of the eight import it. `MarketContext.tsx:440` states the true
                 position: *"one of the four hand-rolled StatTile-family widgets **ruling 6 keeps
                 unconverted** (not register-enforced, not container-stepped); adding `@container` here
                 is **a later phase's rebuild**."* Excluding them from phase 2 was still right — but
                 because they were untouched, not because they were done.
                 (3) **`StatTile` no longer exists as a component.** `_kit/index.ts:7` records
                 *"`StatTile` → `FigureCell` … no deprecation window"*; every surviving mention in the
                 tree is a **comment** naming the idiom, not a live import. Do not plan a migration
                 from a component that is already gone.
                 (4) **Settings is not a page.** It lives at `features/auth/SettingsPage.tsx`, not
                 `pages/settings/` — a plan that greps `pages/` for it will find nothing.
                 (5) **Alerts already ships.** `AlertsPage.tsx:24-49` composes a `level_touch` rule with
                 a price threshold and persists it to `ALERTS_KEY = 'convexa.alerts.v1'`
                 (`features/alerts/types.ts:47`). At 242 lines it is the smallest of the four surfaces
                 and the least likely to need re-composition — its work is register + scales, not
                 layout.
                 Open feasibility questions for the council, not for this brief: whether the scanner's
                 **11-column table** (`no-overflow.spec.ts:41`) can carry `FigureCell` per cell without
                 a per-row cost that shows at 1280 with a full scan set, or whether the table keeps a
                 lighter cell and only the **card fallback** (`:933`, "the 11-column terminal table does
                 not exist at phone width — cards do") adopts the primitive; and whether the eight
                 quiet-band widgets convert **in place** or are re-composed, given phase 1's ruling 6
                 deliberately preserved their current layout while fixing only their ⓘ affordances.
Effort:          L
Invariant watch: **live-vs-static-isolation** (the ledger key `one-liveness-predicate` — phase 2 branded
                 the claim and proved exactly one predicate answers "is this live?" on the desk; these
                 four surfaces must consume that same brand and never mint a second. Scanner rows and
                 positions rows are **snapshot** surfaces and must never wear a live mark) ·
                 **absent-is-not-none** (canon 24's closed nine; the positions surface is where
                 `not recorded` / `not provided` / `no basis` must stay **non-synonymous**, asserted by
                 spec, never collapsed) · **ai-asserted-numbers-are-traceable** + **digested-labels-not-raw-dump**
                 (the type register is how authorship is rendered; a scanner cell must not assert a
                 source it cannot trace, and a label comes from the wire's closed vocabulary rather than
                 being re-derived from the scalar) · **theme-token-discipline** (zero hardcoded hex —
                 and note phase 2 extended `hex-discipline.spec.ts` to catch `rgb(a)` literals and
                 narrowed its exemptions to **per-value**, so a whole-file waiver is no longer
                 available) · **structural-over-prose-enforcement** (every rule this phase lands ships
                 as a spec that red-builds when poisoned, and the poison is itself proven non-vacuous) ·
                 **single-shared-sim-entry-dialog** + **no-real-order-path** (positions entry opens the
                 ONE shared `TradeEntryDialog` as a variant, never a fork) ·
                 **additive-keeps-score-byte-identical** (FE-only; nothing here is a scoring input) ·
                 **loss-free-durable-migration** (**the sharpest risk on this surface set**: the alerts
                 store `convexa.alerts.v1` and the positions stores hold the user's own data with **no
                 server backup**, so any key or shape change is read-new-else-old, promote-forward,
                 never-delete, idempotent, never-throw) · **cited-code-is-verified-not-assumed**.
Context tags:    frontend,ui,conventions,decisions
Source:          `BACKLOG.md` → **Harvest — 2026-09-03 (design re-baseline → Curvature Terminal v2)**,
                 candidate `curvature-terminal-v2-build`; and the deferred phase-3 candidate named in
                 `contracts/curvature-v2-foundations/BRIEF.md` as `curvature-v2-surfaces`. Phase 2
                 closed at GATE S 2026-09-05 (**QA PASS 60/0/1**); its `_MANIFEST.md` carries the gate
                 trail, the four defects it found in previously-shipped code, and the carried-debt list.
                 **Phase 1's eight owner rulings still bind**, and **ruling 6 assigns this phase its
                 quiet-band work by name**. Phase 2 added four canon amendments (rules **11**, **14**,
                 **16**, **17**) and **seven DELEGATED calls** (P1–P5, D-14, D-15) that a later reader
                 must be able to tell apart from owner rulings — two of which were later found wrong on
                 their facts and corrected in `state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md`.
Considered:      curvature-v2-surfaces (**CHOSEN** — the four surfaces plus the quiet band share one
                 figure primitive, one register rule and one not-a-number vocabulary; converting them
                 together is what makes the register a **property of the app** rather than a property of
                 the ticker page) · scanner-only, then positions, then settings+alerts as three phases
                 (culled: each would re-argue the same three seams — register enforcement, container
                 steps, the closed vocabulary — and GATE Q would review the same decisions three times.
                 Phase 2 proved a multi-surface phase is reviewable when the criteria are per-surface) ·
                 leave the eight quiet-band widgets to a phase 5 (culled: phase 1's ruling 6 named
                 "the phase that rebuilds them", and after phase 2 rebuilt everything around them they
                 are the **only** unconverted figures left on the desk — deferring again would ship a
                 desk whose hero, ladder and strip enforce the register while the band beneath them
                 does not) · convert the quiet band but defer the four pages (culled — inverted
                 priority: the band is eight widgets on a page that is already v2, while the four pages
                 are where a trader spends the other half of the session with **no** register at all) ·
                 include the landing and site pages to finish v2 in one phase (culled: that is phase 4
                 by the program's own table, it carries the responsive sweep and the P1 curve
                 text-equivalent, and a five-surface-plus-marketing BRIEF has no reviewable acceptance
                 surface — the failure shape the phase-1 cull recorded against a one-shot rebuild) ·
                 re-skin the four surfaces in v2 tokens without adopting `FigureCell` (culled: tokens
                 alone leave the register unenforced, which is the entire decision impact — and it is
                 what phase 1 already did to these pages, so this option is **already shipped** and is
                 precisely the state this phase exists to end).
