# BACKLOG — idea pool + roadmap discovery (standing reference)

> The divergent half of roadmap-advancement. The Orchestrator's **GATE I** (see
> `.claude/ORCHESTRATOR.md` §3) grooms this pool, culls to ONE next feature, and emits that as a
> per-feature `BRIEF.md` that seeds the pipeline. This file holds the candidates; it is NOT a
> commitment — promotion to a feature folder happens only through GATE I.
>
> Seeded from the deferred/open items already in `OPEN_THREADS.md`. Keep it current: when a thread
> ships, migrate its "deferred seams" here; when an item is promoted, mark it `→ promoted`.

## How an item earns promotion (the cull, from GATE I)
1. **Decision-impact test** — name the *trading decision* it improves and *how you'd observe* the
   improvement. No answer ⇒ parked, not promoted. (Mirrors the "AC observable without code" rule
   and the AI over-trading gate — we resist shiny features the same way we resist over-trading.)
2. **Feasibility gate** — data coverage + math invariants. Blocked items name their blocker.
3. **Score** — Value (H/M/L to the trading edge) × Effort (S/M/L); flag any locked invariant touched.

## Standing harvest sources (where the next wave comes from)
- **Deferred items** — `OPEN_THREADS.md` §7 + the "deferred seams" line inside each shipped thread.
- **Open strategic questions** — `OPEN_THREADS.md` §1/§9 (vendor + overnight).
- **Usage friction** — what's painful in your own daily trading use (capture as you hit it).
- **Downstream-AI quality** — does the `strategy_prompt` / `reassessment_prompt` hand-off produce
  better calls? Gaps here are first-class features.
- **Lifted constraints** — when a data/vendor limit lifts (e.g. overnight coverage), the features it
  was blocking become buildable.
- **Nx workspace graph** *(project-specific harvest source)* — the Nx MCP (`nx_workspace` / `nx affected`)
  surfaces what projects/targets exist and what's changed; use it during GATE I to spot structural gaps
  or affected-but-untouched areas worth a feature. (Conductor-side at Discovery only — kept here in the
  project-owned backlog, NOT in the generic `ORCHESTRATOR.md`.)

---

## Harvest — 2026-09-08 (ticker fidelity repair: two wire fields the design draws and the API does not send)
<!-- atlas: theme=desk-fidelity horizon=next -->
Not a BRIEF. Filed by the conductor from the `/ticker` fidelity repair lane's GATE Z items (owner 2026-09-08:
"Do all four" — the fourth is this). Both are **`apps/api`** changes; that crate is frozen on
`spire/curvature-v2-foundations` (`apps/api` diff must stay 0), so they wait for the next backend lane on
`main`. Neither is faked in the meantime: the tape card ships without its spark, the masthead without a
change line or a name.

- **A short `net_flow` trail on the live SSE event.** `design/src/screens/desk.mjs:363-364` draws the Live
  tape's `FLOW` sparkline as a 30-point trail sampled every 10 s (`SPY · 30 × 10s`). `LiveUpdateBody`
  (`libs/api/src/generated/schema.ts:1550`) carries only the current scalar `net_flow`. Proposed shape:
  `net_flow_trail: number[]` (oldest → newest, ≤ 30 points) + `trail_window_s: number`, accumulated
  server-side per symbol and reset on the session boundary — keeps the eviction / reset rules in one place
  and off the client's stream-isolation seam (the lane's GATE Z reasoning, `RESUME.md`). Consumer:
  `pages/ticker/widgets/live-tape/LiveTape.tsx` adds the spark row under the 2×2.
- **Prior close, signed change and the instrument name on the ticker bundle.** The design's masthead reads
  `SPY 573.12 +1.84 · +0.32%` and `SPDR S&P 500 ETF`; `market_state` has `price` / `gex_spot` only (checked
  against the saved real bundle, `fidelity-audit-2026-09-08/_tools/spy-bundle-2026-09-08T1059Z.json`).
  Proposed: `market_state.prev_close`, `change`, `change_pct`, `name` — all nullable, vendor-sourced,
  never derived on the client. Consumer: `pages/ticker/widgets/chrome/TickerHeader.tsx` renders them
  only when present (the fidelity repair's F3 already omits rather than fakes them).

### Harvest addendum — 2026-09-08, visual-baseline receipt flow (filed by the conductor while preparing the flow the owner asked for)

- **The hosted Linux candidates workflow cannot complete as wired** (`.github/workflows/browser-visual-linux-candidates.yml`,
  never executed): `fetch-depth: 1` leaves `visual-update.mjs`'s `assertSourceScope` unable to resolve an ancestor
  `source_revision`; a receipt cannot live inside the commit it names; with a deeper fetch the retained evidence makes
  the receipt "stale" (only the receipt may differ since `source_revision`); and `validateStability` requires the two
  clean compare summaries to carry the acceptance's `source_revision`, which CI stamps as HEAD after the baselines are
  committed. The flow is a dirty-working-tree local procedure by construction (that is how the 2026-08-24 win32 flow ran).
  Options when this is picked up: (a) let the workflow accept a _branch_ whose HEAD holds evidence + receipt and diff against
  the receipt's `source_revision` with `fetch-depth: 0`, treating `visual-review/evidence/**` as receipt-scope; (b) define
  stability as two clean runs at the _baseline commit_ (the acceptance's revision is the candidate revision; stability's is
  its child) — a SPEC amendment either way, not a quiet tool fix. Until then Linux baselines come from a local Linux host
  (WSL2 x86-64 for CI parity). Runbook and drafting helper:
  `state/spire-curvature-v2-foundations/visual-baseline-receipts/`.
- **`validateStability`'s image-hash comparison is vacuous on pass runs** (`sha256 ?? actual_sha256` are both null when a
  compare passes); the check reduces to run id / status / revision / platform / retries. Worth a stronger field
  (the expected baseline hashes) when the SPEC is amended.

## Harvest — 2026-09-06 (owner direction: AI-powered Convexa)
<!-- atlas: theme=trust-the-signal horizon=next -->
Not a GATE I cull and **not** a BRIEF. Owner direction: *"I want Convexa to be an AI-powered artifact, for
example the AI rec panel for recommendations."* **Authorizes: nothing** on live score. Recorded so the
direction is dated and queued rather than re-derived.

**The template is the AI rec panel, and what makes it work is not that it calls an LLM.** It is that the
LLM is an **advisory consumer of already-computed state** — the shape `ai-external-no-llm` was *narrowed*
to permit (never a scoring / gate / fingerprint input, no recompute, off the SSE path, server-side key, no
auto-act, no real order), plus the **type register** carrying authorship (Mono = traced to a computed
bundle field, Plex Sans + dotted rule = the model's own number). Any new AI surface inherits both or it
stops being Convexa.

**Sequencing ruled by the conductor 2026-09-06 — phase 3 first, and it is a precondition, not a rival.**
Scanner, positions, settings and alerts have **zero `FigureCell`** between them (measured at GATE I of
`curvature-v2-surfaces`), so they cannot yet distinguish "Convexa's number" from "the model's number".
Adding AI there first would multiply untraceable assertions on the densest surfaces in the app — the exact
risk `ai-asserted-numbers-are-traceable` was promoted on, after **44.4% of asserted numbers measured
untraceable**.

**The AI surface to back next is already in this backlog:** `grounded-morning-snapshot` (line ~108) — an
AI briefing over already-computed scanner + event calendar + GEX, **every number cited**, no new vendor.
It reuses the grounding machinery `curvature-v2-desk-and-read` hardened (traced/untraced register,
grounding counts and the cited contract in the drawer) and touches no score. Timing fits: the
`keep-paid-books` corpus supports a real time-split ~**2026-09-23 → 10-07**.

**Culled from this direction (recorded so they are not re-proposed as new):**
- *An AI read per scanner row* — culled: multiplies untraceable assertions across the densest surface, and
  the failure mode is silent (a plausible number with no provenance looks identical to a computed one).
- *AI everywhere as a phase* — culled: **cost is metered per user** (see below), so every added surface
  raises the user's own bill and consumes their daily cap faster.
- *Ship it as an AI-powered Claude Artifact* — culled **as a product path**, viable as an internal
  prototype only. See the cost note.

**Cost / multi-user note (verified at source 2026-09-06, not assumed).** Two different models, and they
must not be conflated in any future brief:
| path | who pays | multi-user | where it runs |
|---|---|---|---|
| **Convexa product** (`features/auth/aiProviderLabels.ts`) | the **user's own provider API key** — `own_key` for Anthropic `sk-ant-…` / OpenAI `sk-…` / Grok `xai-…` / Gemini `AIza…`, or the one subscription path `grok_subscription` ("your Grok subscription") | yes — key stored **per user**, encrypted at rest (`secret-encrypted-at-rest`), with a **per-user daily cap + cooldown** enforced server-side | anywhere the app is served |
| **Claude Artifact `sample`** capability | **the viewer pays**, from their own Claude pool, consent-prompted on first call | yes — each viewer's own pool | only inside claude.ai, for people who can open the artifact |
**There is no Convexa-funded pool in either model**, and the codebase actively guards the copy against
implying one: `aiProviderLabels.ts:4` — *"never the BYO 'Grok' label, **never 'Convexa Grok pool'**"*.
The artifact path is therefore fine for an internal prototype and wrong for product delivery: it cannot
reach a trader who is not a claude.ai viewer, and an `mcp` grant additionally bars public sharing.

**PARKED 2026-09-06 (owner): revisit after the v2 redesign (phases 3–4).** Findings from the same day,
recorded so they are not re-derived — verified against primary sources, not assumed:
- **Provider rules, in writing.** Anthropic: *"does not permit third-party developers to offer Claude.ai
  login into their own applications, or to route requests through Free, Pro, or Max plan credentials on
  behalf of their users"* — API key required, no exception (Claude Code legal page; enforcement reported
  2026-04-04). OpenAI: "Sign in with ChatGPT" is identity only; the request to run the Codex SDK on a
  subscription was closed *not planned* (openai/codex#8494, 2025-12-23); general "subscription sharing"
  (ChatPass) is **unreleased** as of 2026-08-27 — **watch item**, dated.
- **The one sanctioned in-app path: the Codex app server** (`codex app-server`, JSON-RPC over stdio /
  experimental WebSocket; official doc: *"Embed Codex into your product with the app-server protocol"*).
  Runs on the **user's own machine**, signed in with their own ChatGPT account, so turns bill to **their**
  plan. Not hostable — *"Don't try to serve multi-tenant workloads with a single shared app-server
  instance"*. `turn/start` takes an `outputSchema`, so the read returns typed JSON and the panel keeps the
  type register. Candidate power path **`codex_local`** beside `own_key` / `grok_subscription`
  (`libs/api/src/lib/convexa.ts:1480`): ChatGPT subscribers only; user installs Codex; browser→loopback
  `ws://` works in Chrome/Firefox, **not Safari**; stdio via a small local companion is the supported shape.
  No Claude twin: Anthropic's carve-out is the *unmodified Claude Code binary* under Commercial ToS with
  "contact sales" — ask before building, do not build on it.
- **Correction to the table above:** a Claude Artifact cannot `fetch` Convexa's API, but the `mcp`
  capability is the sanctioned bridge to a Convexa **connector** — so the artifact becomes viable as an
  advisory **reach channel** (viewer's pool via `sample`) once an MCP server exists. Same for a ChatGPT App
  (Apps SDK: UI in an iframe inside chatgpt.com, `sendFollowUpMessage` → a ChatGPT turn on the user's
  plan). In both hosts the prose is the model's, so neither can enforce the register — advisory, read-only,
  `no-real-order-path` intact.
- **Shape if resumed:** phase 3 (register everywhere) → **`convexa-mcp-server`** (precondition for all
  three) → `codex_local` → the two hosts. `own_key` stays for Claude users, mobile, and anyone without Codex.
- Sources: learn.chatgpt.com/docs/app-server · learn.chatgpt.com/docs/auth · learn.chatgpt.com/docs/codex-sdk
  · code.claude.com/docs/en/legal-and-compliance · github.com/openai/codex/issues/8494 ·
  runtimewire.com/article/openai-is-building-subscription-sharing-for-ai-apps ·
  developers.openai.com/plugins/build/chatgpt-ui · issues.chromium.org/issues/40386732 ·
  developer.apple.com/forums/thread/120869.

---

## Harvest — 2026-09-03 (design re-baseline → Curvature Terminal v2)
<!-- atlas: theme=trust-the-signal horizon=next -->
Not a GATE I cull and **not** a BRIEF. Owner approved a site-wide redesign on a design canvas and ruled
that it supersedes the 2026-08-10 canon; `DESIGN_SYSTEM.md` is now **SET — Curvature Terminal v2**
(skeptic PASS WITH FINDINGS, no Critical; session `context/design-session/rebaseline-2026-09-03.md`).
Design source: `design/` (canvas + static site + `site/library.html` + `tokens/tokens.json` mirror).
**Authorizes: nothing** on live score — FE-only.

- **`curvature-terminal-v2-build`** — implement the v2 desk, AI read brief, nav + ⌘K palette, figure
  cells, responsive bands, and the site surfaces per the canon and `design/site/library.html` (React
  mapping table). *Decision-impact:* the trader finds the flip/walls and the AI verdict without scanning
  13 equal cards, and never mistakes a snapshot for live (one connection chip; gated liveness); observe via
  the AI-read state coverage, the no-overflow suite at 393/834/900/1280, and the desk task time.
  *Feasibility:* no backend change; canon amendments already ruled (StatTile → FigureCell, motion class,
  declared spacing/radius/breakpoints, nav shape); enforced specs to amend are listed in the canon's
  enforcement table. *Score:* Value **H** × Effort **L** (phased: primitives → desk + AI read → scanner /
  positions / settings / alerts → landing → responsive pass). *Invariants touched:*
  `live-vs-static-isolation` (strengthened), `theme-token-discipline` (seven additions land in
  `tokens.ts`), `single-shared-sim-entry-dialog` (unchanged). **Open owner question:** direct
  branch build vs the council pipeline (retire-or-stub for `docs/design/DESIGN_SYSTEM.md` ruled **A — stubbed**, 2026-09-03).

## Program — keep-paid-books (owner-directed 2026-08-19)
<!-- atlas: theme=prove-the-edge horizon=now -->
Grouping only — **not** a pipeline feature. Owner said put all seven briefing
recommendations in the pool and work them **one by one**. Each build still
earns its own `BRIEF.md` via GATE I. Theme: `prove-the-edge`.
Outcome: the $199 Options book we already fetch survives as a dated research
corpus, then we measure it; do **not** buy hist-chain to paper over prune.

| # | Item | Shape | Status |
|---|---|---|---|
| 1 | `session-chain-archive` — 1 book / symbol / ET day prune cannot delete | pipeline feature | **SHIPPED 2026-08-20** |
| 2 | `liquid-names-session-capture` — SPY/QQQ/IWM session book even if gex-cache is warm | pipeline feature | **SHIPPED 2026-08-20** |
| 3 | `paid-book-join-smoke` — run `batch-backtest` then `replay-outcome-join` on a real corpus | chore (no BRIEF) | **DONE 2026-08-20** |
| 4 | `weekly-digest-lab-ritual` — `join-outcomes` → `score-lab --horizon 1d` on SPY/QQQ/IWM | habit (runbook exists) | **RAN 2026-08-20** (keep weekly) |
| 5 | `session-corpus-wait` — 4–6 ET weeks of archived session books before a real time-split | wait / gate, not a build | **clock started 2026-08-20; first *reliable* production day is 2026-08-26** (see harvest 2026-08-28) |
| 6 | `ai-rec-lab-p4` — frozen AI export packs / multi-model lab | pipeline feature (later) | blocked-on boring P2–P3 + #5 |
| 7 | `chain-archive-object-store` — session bodies off app-Postgres BYTEA | pipeline feature (later) | **SHIPPED 2026-08-20** |
| 8 | `archive-coverage-guardrails` — detect missing/unreadable daily books without paid monitoring | backend/ops feature | **SHIPPED + ARCHIVED 2026-08-26** |

Do **not** bundle remaining items into one BRIEF. Do **not** start P7 vendor hist-chain.

> **Integrated 2026-09-01** (`mainline-integration-2026-09`): the entries from here down to the
> 2026-08-22 `api-contract-generation` ship were written on the `codex/browser-quality-gates` line and
> did not see main's 2026-08-25/26 merges (PR #31 capacity-baseline v1, PR #34 archive-coverage-guardrails).

## Harvest — 2026-08-28 (deep-research: next-focus, paid-data keep, replay)
<!-- atlas: theme=prove-the-edge horizon=now -->
Not a GATE I cull and **not** a BRIEF. Owner asked for independent research on what to
focus on next (personal tool *or* public trader product). Evidence pack:
`docs/briefings/product-roadmap-2026-08-28.html`. **Authorizes: nothing** on live score.

**Clock honesty (keep-paid-books #5).** The wait started 2026-08-20 in canon, but production
did not store session bodies until 2026-08-22, the first eligible ET session was **2026-08-24**,
and the ownership repair that stopped thousands of `Permission denied` writes landed
**2026-08-26**. Audit that day: **7 / 9** expected SPY/QQQ/IWM books; SPY 24–25 **gone for
good** (48-slot prune + Massive chain snapshot has **Plan History: not applicable**). Treat
the 4–6 week bar as starting **2026-08-26**, so a real time-split is ~**2026-09-23 … 2026-10-07**,
not mid-September off the 08-20 label.

**What the $199+$199 already buys that we still do not keep.**
Live Path-B snapshots (greeks/IV/OI) are unrecoverable after prune — that is why session
archive exists. Stocks **and** options Advanced plans already include **S3 flat files**
(trades/quotes/aggregates, next-day ~11:00 ET). We do not download them. SSE ticks are not
taped. Warmer refreshes are excluded from capture by design. Midnight-ET first-wins books
are **start-of-day**, not a full open-to-close stream.

**New pool items (one BRIEF each if promoted — do not bundle):**
| Item | Shape | Why it is here |
|---|---|---|
| `archive-coverage-guardrails` | backend/ops, no trader UI | **SHIPPED + ARCHIVED 2026-08-29.** Named by the 2026-08-26 audit. Missing books are silent $398 loss. |
| `massive-flat-file-keep` | backend/research | **SHIPPED + ARCHIVED 2026-08-31.** Download entitled daily S3 files for SPY/QQQ/IWM. Reconstructs **tape**, not greeks. Provenance-label; never fake a `live_massive` book. |
| `session-day-tape-capture` | backend | **SHIPPED + ARCHIVED 2026-08-30.** Append-only Path-A SSE + timed Path-B snapshots for a closed watchlist so a day is replayable after Massive is cancelled. |
| `day-replay-mock-adapter` | both lanes | **SHIPPED + ARCHIVED 2026-08-30.** Existing ticker SSE occupancy; clap `session-day-replay`; never `LiveMassive`. Distinct from `batch-backtest` (snapshot → score, no UI clock). |
| `research-lab-surface` | frontend first | **SHIPPED + ARCHIVED 2026-08-31.** Operator URL-only corpus browser of existing `_research` list/load + coverage. Not `/lab` demos. Pages still 404s `_research`. |
| `grounded-morning-snapshot` | both, later | AI briefing from **already computed** scanner + event calendar + GEX, every number cited. No Benzinga. No new vendor. |

**Parked by this harvest (do not re-derive as emergencies):**
squeeze/short-interest scanner (SI% not in-tier; OptionWalls squeeze median **+0.15% / 5d**);
Benzinga earnings add-on; news terminal; RL on the score; indices (`I:VIX`/`I:SPX`) product line;
P7 hist-chain; public SaaS before ledger N.

**Stale standing queue.** Pool §A still headlines the 2026-08-01 order
`index-first-defaults → SnapTrade → vol-normalized-gex → alerts`. Those four are
**shipped in code** (Webull, not SnapTrade, for broker v1). The live programs are
keep-paid-books wait + production-maturity #6 `remote-archive-body-store` + this harvest.
SnapTrade stays the later multi-broker arm, not the next personal-edge build.

**If the owner says `go` without naming:** the cull still applies.
`archive-coverage-guardrails` **SHIPPED 2026-08-29**. `session-day-tape-capture`
**SHIPPED 2026-08-30**. `day-replay-mock-adapter` **SHIPPED 2026-08-30**.
`massive-flat-file-keep` **SHIPPED 2026-08-31**. `research-lab-surface`
**SHIPPED 2026-08-31**. Strongest remaining **08-28** harvest survivor is
`grounded-morning-snapshot` (sequence “after the corpus is visible” is now true).
See **Harvest — 2026-08-31** below for the post-lab wave. Production-maturity #6
remains next **in that program's order**. Do not silently skip the wait on #5 to
reweight `opportunity_score`. Do not reopen blocked `supply-chain-automation`
as pick-next.

## Harvest — 2026-08-31 (post-lab: use the day, don't clone a terminal)
<!-- atlas: theme=trust-the-signal horizon=now -->
Not a GATE I cull and **not** a BRIEF. Owner asked for a fresh harvest after
`research-lab-surface` GATE S. Evidence pack:
`docs/briefings/harvest-2026-08-31.html`. **Authorizes: nothing** on live score.

**What changed since 28 Aug.** The 08-28 wave is executed: coverage, tape, replay,
S3 keep, and the operator corpus browser **all SHIPPED**. From this 08-31 pool,
`exchange-holiday-calendar` **SHIPPED 2026-08-31**. The leak is no longer
“CLI-only books.” Remaining 08-28 survivor: `grounded-morning-snapshot`, whose
own sequence note was “after the corpus is visible” — that gate is now open.

**Thesis.** You are not missing a news terminal. You are missing a *cited morning
read of numbers you already compute*, a *second partitioned card* for the research
HTTP you already serve, and *insurance for bodies*. Do not retune
`opportunity_score`. Do not lift the Pages `_research` 404. Do not occupy `/lab`.
Do not reopen `supply-chain-automation`. Do not skip keep-paid-books #5
(reliable clock **2026-08-26** → time-split ~**2026-09-23 … 2026-10-07**).

**If the owner says `go` without naming:** still **`grounded-morning-snapshot`**
(personal-edge, sequence unblocked). Production-maturity #6
`remote-archive-body-store` is next **in that program**. New 08-31 rows below
are pool, not a silent default change.

**New pool items (one BRIEF each if promoted — do not bundle):**
| Item | Shape | Why it is here |
|---|---|---|
| `grounded-morning-snapshot` | both, **now** | **Already named 08-28.** Cited briefing from scanner + calendar + GEX. No Benzinga. No new vendor. Corpus-visible sequence **holds**. Unnamed-`go` default. |
| `research-lab-sibling-reads` | frontend / ops | `/_ops/research` consumes books+coverage only. Live HTTP also has tape, snapshots, flat-files. Council admits **partitioned** sibling cards (same closed-deck discipline). Not a unified status column. Not `/lab`. Pages 404 stands. |
| `ops-metrics-sitting-origin` | frontend / ops | Metrics is still same-origin `GET /api/_metrics`. Research already has sitting API origin + token. Pages 404s `_metrics` too — a weekly operator on `convexa.pages.dev` cannot unlock metrics the way they unlock research. 2nd consumer of sitting-base; do not bake hosts. |
| ~~`exchange-holiday-calendar`~~ **SHIPPED 2026-08-31** | backend / ops | Repeat seam on tape, keep, coverage, scanner: weekends handled; **NYSE holidays are not**. Coverage “not yet due” vs empty extract vs missing is a fabricated claim on a closed weekday. |
| `tape-store-start-watermark` | backend | GATE Z residual on `session-day-tape-capture` AC-32: named past weekday with no container is `no session day tape`; no store-start watermark. Honesty of “we never taped that day.” |
| `score-lab-digest-surface` | frontend / ops, later | Read-only last score-lab / join artifact on `/_ops/*`. Weekly ritual without clap. **Not** score-lab HTTP compute. **Not** a retune. Sequence after #5 has more calendar, or beside the morning note. |

**Hygiene / system-of-building (not GATE I product; do not bundle into a BRIEF):**
`project-context-shard-sizes` (still unpaid) · `session-tape-structural-allowlist` (full
`nx test` 1 red in `session-day-tape-capture.structural.spec.ts`) ·
`deploy-cors-docs-alignment` (`ALLOWED_ORIGINS` docs vs live `ALLOWED_BROWSER_ORIGINS`) ·
`nx-worktrees-isolation` (`.worktrees/` collides with the main Nx graph) ·
`n1-push-deploys` (owner call) · `owner-device-signoff` (habit).

**Already-named, not new:** keep-paid-books #5 wait · #6 `ai-rec-lab-p4` (blocked-on #5) ·
production-maturity #6 `remote-archive-body-store` · `x1-snaptrade-readonly` (owner-named,
system-6) · `weekly-digest-lab-ritual` (habit, runbook exists) ·
`score-lab-b0b-outcomes` (never synthesize).

**Parked (do not re-derive as emergencies — evidence unchanged since 08-28):**
squeeze/SI scanner · Benzinga/news · RL on the score · indices `I:VIX`/`I:SPX` ·
P7 hist-chain · public SaaS before ledger N · Pages `_research`/`_metrics` proxy ·
`/lab` occupancy · `/_ops/replay` player chrome (shipped structural ban) ·
score-lab **compute** HTTP · `opportunity_score` reweight.

## Last GATE S — 2026-08-31 (`exchange-holiday-calendar` — NYSE full-day occupancy)
<!-- atlas: theme=prove-the-edge horizon=now -->
NYSE full-day weekday closures (2020..=2032) are ineligible like weekends, with a distinct
reason. Coverage empty-expected `not_due`. Tape/keep `ineligible holiday`. Ticker closed
all hours that ET date. Scanner badge Closed. GATE Q PASS **30/0/0**. Independent
conformance **5/5**. Archived to `_archive/exchange-holiday-calendar/`. Re-pin JSON
promoted to `state/conformance/exchange-holiday-calendar.json`. Unnamed next `go`
harvest default: `grounded-morning-snapshot`. Do not reopen blocked
`supply-chain-automation`. Production-maturity #6 stays next **in that program**.

## Last GATE I — 2026-08-31 (owner named → `exchange-holiday-calendar`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner said **do NYSE holiday** after Harvest 2026-08-31 (not unnamed `go`).
**Chosen → `exchange-holiday-calendar`.** Brief at
`.spire/clusters/tech/contracts/_archive/exchange-holiday-calendar/BRIEF.md`.
**Backend-primary; weekend gates already exist; holidays do not.**
**Why it won:** owner named it. Repeat seam: coverage `not_due` / tape ineligible /
keep ineligible / `MarketPhase::classify` / ensure / scanner hours are **Sat/Sun only**.
Keep already tests that a holiday weekday with zero rows is empty extract, not weekend.
Unnamed-`go` default `grounded-morning-snapshot` was culled for this ask. Do not reopen
`supply-chain-automation`. Do not skip keep-paid-books #5. Do not retune the score.

## Last GATE S — 2026-08-31 (`research-lab-surface` — operator corpus browser)
<!-- atlas: theme=trust-the-signal horizon=now -->
Operators type `/_ops/research` (off-shell, unlinked, not `/lab`) with a sitting API origin +
metrics token and list/open SPY/QQQ/IWM session books plus today’s coverage card. Empty
`apps/api` product diff. Pages `_research` 404 stands. GATE Q PASS **53/0/0**. Independent
conformance **7/7**. Archived to `_archive/research-lab-surface/`. Re-pin JSON promoted to
`state/conformance/research-lab-surface.json`. Unnamed next `go` harvest default:
`grounded-morning-snapshot`. Do not reopen blocked `supply-chain-automation`. Production-maturity
#6 stays next **in that program**.

## Last GATE I — 2026-08-31 (harvest default → `research-lab-surface`)
<!-- atlas: theme=trust-the-signal horizon=now -->
Owner said `go` after `massive-flat-file-keep` GATE S (unnamed ⇒ harvest
default). **Chosen → `research-lab-surface`.** Brief at
`.spire/clusters/tech/contracts/_archive/research-lab-surface/BRIEF.md`.
**Frontend-primary operator surface; `/lab` instrument demos must not be
occupied; Pages `_research` 404 stands.**
**Why it won:** coverage + tape + replay + S3 keep are CLI/`_research` only;
the operator still cannot *see* the $398 corpus weekly. First slice is a
URL-only off-shell browser of **existing** list/load (session books spine).
Do not bundle score-lab HTTP, ticker replay chrome, morning-note, remote
object-store, or lifting the Pages 404. Cite live `app.tsx` `/_ops/metrics`,
`LabIndex.tsx`, `functions/api/[[path]].ts`. `supply-chain-automation`
remains live and blocked — this `go` is pick-next, not reopen #4.
Production-maturity #6 stays next **in that program**.

## Last GATE S — 2026-08-31 (`massive-flat-file-keep` — entitled S3 trades/quotes extracts)
<!-- atlas: theme=prove-the-edge horizon=now -->
Operators keep next-day Massive stocks SIP **trades** and **quotes** extracts for SPY/QQQ/IWM
(`flat-files keep`; dedicated root; gzip discarded). Sibling `_research/flat-files`. Never
`LiveMassive` / coverage `present`. `NO_UI_CHANGE`. GATE Q PASS **61/0/0**. Independent
conformance **6/6**. Archived to `_archive/massive-flat-file-keep/`. Conformance JSON promoted
to `state/conformance/massive-flat-file-keep.json`. Unnamed next `go` harvest default:
`research-lab-surface`.

## Last GATE I — 2026-08-30 (harvest default → `massive-flat-file-keep`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner said `go` after `day-replay-mock-adapter` GATE S (unnamed ⇒ harvest
default). **Chosen → `massive-flat-file-keep`.** Brief at
`.spire/clusters/tech/contracts/_archive/massive-flat-file-keep/BRIEF.md`.
**Backend/research; trader UI NO_UI_CHANGE expected.**
**Why it won:** $199+$199 already includes unlimited S3 file downloads we do
not keep; they reconstruct **price/quote history**, not greeks; live tape +
replay now exist, so this is the remaining entitled tape, not a clock.
Files are next-day universe CSVs (`files.massive.com`), not REST
`/v3/trades`. Do not bundle OPRA, indices, hist-chain, lab UI, or Path-A
conversion. Cite live REST/WS + tape root + source kind — not briefing HTML.
`supply-chain-automation` remains live and blocked — this `go` is pick-next,
not reopen #4.

## Last GATE I — 2026-08-30 (harvest default → `day-replay-mock-adapter`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner said `go` after `session-day-tape-capture` GATE S (unnamed ⇒ harvest
default). **Chosen → `day-replay-mock-adapter`.** Brief at
`.spire/clusters/tech/contracts/_archive/day-replay-mock-adapter/BRIEF.md`.
**Both lanes; existing ticker SSE, no second live path.**
**Why it won:** the tape now exists; Fixture is a frozen snapshot, not a clock;
`batch-backtest` replays scores, not a day on the ticker. Insurance the owner
named: if Massive is cancelled, walk Tuesday as if live. S3 files are next-day
price history, not same-day greeks — sequenced after a clock exists. Do not
bundle object-store, hist-chain, or lab UI. Cite live tape + Fixture + hub.
`supply-chain-automation` remains live and blocked — this `go` is pick-next,
not reopen #4.

## Last GATE S — 2026-08-30 (`day-replay-mock-adapter` — walk a captured day on the ticker)
<!-- atlas: theme=prove-the-edge horizon=now -->
Operators walk a stored SPY/QQQ/IWM research day through the **existing ticker live path**
(`session-day-replay`; pace {1,4,10}). Occupancy `session_tape` / `live: false`. Production
unset still Massive; production-profile + replay arm refuses before bind. Never `LiveMassive`.
No `/_ops/replay`. GATE Q PASS **47/0/0**. Independent conformance **5/5**. Archived to
`_archive/day-replay-mock-adapter/`. Conformance JSON promoted to
`state/conformance/day-replay-mock-adapter.json`. Unnamed next `go` harvest default:
`massive-flat-file-keep`.

## Last GATE I — 2026-08-29 (harvest default → `session-day-tape-capture`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner said `go` after `archive-coverage-guardrails` GATE S (unnamed ⇒ harvest
default). **Chosen → `session-day-tape-capture`.** Brief at
`.spire/clusters/tech/contracts/_archive/session-day-tape-capture/BRIEF.md`.
**Backend / research; trader UI out of scope (`NO_UI_CHANGE` expected).**
**Why it won:** coverage now tells you a paid day is missing; it does not keep
the open-to-close stream. Path-A ticks still latest-wins in `PriceCache`;
warmer Path-B drops `_vendor` every 25s by design; session books are first-wins
start-of-day (QQQ/IWM 24–26 Aug had 0 trades). Replay is blocked-on this tape.
S3 flat files are next-day price history, not same-day greeks. Do not bundle
replay, object-store, or hist-chain. Cite live Rust. `supply-chain-automation`
remains live and blocked — this `go` is pick-next, not reopen #4.

## Last GATE S — 2026-08-29 (`archive-coverage-guardrails` — expected SPY/QQQ/IWM books as operator truth)
<!-- atlas: theme=prove-the-edge horizon=now -->
Operators can classify today’s SPY/QQQ/IWM session books after 16:00 ET (`present` /
`missing` / `unreadable` / `blocked occupancy` / `not yet due`). Named `archive-coverage`
+ `GET /api/_research/session-archive/coverage`. GATE Q PASS **54/0/0**. Independent
conformance **5/5**. Archived to `_archive/archive-coverage-guardrails/`. Conformance JSON
promoted to `state/conformance/archive-coverage-guardrails.json`. `NO_UI_CHANGE`.
`supply-chain-automation` remains live and blocked. Unnamed next `go` harvest default:
tape / day-replay.

## Last GATE I — 2026-08-29 (harvest default → `archive-coverage-guardrails`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner said `go` after the 2026-08-28 deep-research harvest (unnamed ⇒ harvest default).
**Chosen → `archive-coverage-guardrails`.** Brief at
`.spire/clusters/tech/contracts/_archive/archive-coverage-guardrails/BRIEF.md`.
**Backend / ops; trader UI out of scope (`NO_UI_CHANGE` expected).**
**Why it won:** production already archives session books, then fails silently —
26 Aug audit 7/9 expected SPY/QQQ/IWM books; SPY 24–25 unrecoverable after prune
(Massive chain snapshot Plan History = not applicable). The failure mode is a
**lost paid day**, not an unmeasured score. Tape/replay stay sequenced behind
coverage so a replay is not certified on a hole. Do not bundle object-store,
flat-files, or hist-chain. Cite live Rust. `supply-chain-automation` remains
live and blocked — this `go` is pick-next, not reopen #4.

## Last GATE S — 2026-08-29 (`capacity-baseline` — mocked-vendor load/soak harness)
<!-- atlas: theme=the-machine horizon=now -->
Maintainers have named `capacity load` / `capacity soak` against mocked vendors with locked harness
p95 fail-lines. Merge CI runs release load with `APP_ENV=dev`; soak is local + GATE Q only. GATE Q
PASS **49/0/0**. Archived to `_archive/capacity-baseline/`. `NO_BACKEND_CHANGE` of production HTTP —
no conformance JSON promoted. `supply-chain-automation` remains live and blocked. Program #6
`remote-archive-body-store` is next in the production-maturity sequence.

## Last GATE I — 2026-08-28 (production-maturity #5 → `capacity-baseline`; supply-chain still blocked)
<!-- atlas: theme=the-machine horizon=now -->
**Chosen → `capacity-baseline`.** `browser-quality-gates` shipped. `supply-chain-automation` remains
live and blocked (historical secret, RUSTSEC-2024-0436, hosted acceptance). Owner `go` after that
ship is treated as pick-next, not reopen #4. Production-maturity #5 is the next unblocked program
slice: a mocked-vendor API/SSE load/soak harness with checked thresholds. SnapTrade stayed parked
(explicit product go, not this drain). Brief:
`.spire/clusters/tech/contracts/_archive/capacity-baseline/BRIEF.md`.

## Last GATE S — 2026-08-28 (`browser-quality-gates` — named browser quality gates)
<!-- atlas: theme=the-machine horizon=now -->
Maintainers now have honest Chromium, Firefox/WebKit-journey, accessibility, and visual gates with
actionable artifacts. Product runtime/API/scoring stay unchanged except the closed D7/D8
accessibility repairs. GATE Q PASS **45/0/0**. Archived to `_archive/browser-quality-gates/`.
`NO_BACKEND_CHANGE` — no conformance JSON promoted. Three new watch-list keys
(`engine-claim-matches-executable-engines` · `visual-baseline-requires-human-authority` ·
`local-evidence-is-not-hosted-evidence`). `supply-chain-automation` remains live and blocked.

## Last GATE I — 2026-08-23 (owner redirect → `browser-quality-gates`)
<!-- atlas: theme=the-machine horizon=now -->
**Chosen → `browser-quality-gates`.** The owner explicitly selected the next recommended frontend
quality slice while GitHub-hosted supply-chain evidence is unavailable. The shipped Playwright suite
already provides 52 fast Chromium tests and explicitly records Firefox/WebKit as a separate follow-on;
this feature adds an explicit supported-browser policy, a bounded cross-engine journey matrix,
automated accessibility gates, and small deterministic visual baselines without changing product UI
or backend behavior. `capacity-baseline` remains queued as production-maturity item #5 — displaced,
not dropped. Brief: `.spire/clusters/tech/contracts/_archive/browser-quality-gates/BRIEF.md`.

## Last GATE S — 2026-08-22 (`api-contract-generation` — one executable Rust→TypeScript contract)
<!-- atlas: theme=the-machine horizon=now -->
The Rust/Axum route graph now deterministically produces OpenAPI 3.1 and the checked shared TypeScript
schema/client boundary. Immutable pre-cutover and generated-artifact manifests catch co-omission and
drift; schema-v2 evidence proves **52 operations, 181 response conversions, and 87 direct HTTP outcomes**
without changing endpoint, auth, SSE, scoring, or trader-visible behavior. Final fresh QA passed
**42/0/0**, independent live conformance passed **4/4**, and credential-bearing vendor diagnostics are
redacted at the request-failure boundary. Archived to `_archive/api-contract-generation/`; standalone
conformance promoted. Program advances to #4 `supply-chain-automation`.

## Last GATE I — 2026-08-26 (`archive-coverage-guardrails`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Production audit found 7/9 expected live SPY/QQQ/IWM books readable; SPY August 24–25 are exact,
unrecoverable gaps caused by archive body permission failures. **Chosen →
`archive-coverage-guardrails`**: read-only coverage metrics, deduplicated post-checkpoint warnings,
a zero-vendor failing audit command, and Railway volume thresholds. Backend/ops only;
`NO_UI_CHANGE`, no paid monitoring, no score/fingerprint/vendor-fetch change. Broader telemetry,
remote body storage, and partial reconstruction remain separate.

## Program — production-maturity (owner-directed 2026-08-21)
<!-- atlas: theme=the-machine horizon=now -->
Grouping only — **not** a pipeline feature. Owner approved the production-maturity
recommendations as a program and asked to implement all of them. Deliver one independently
verifiable slice per `BRIEF.md`; do not introduce Kubernetes, Kafka, a service mesh, GraphQL,
or microservices without a measured bottleneck and a separate owner decision.

| # | Item | Shape | Status |
|---|---|---|---|
| 1 | `production-runtime-guardrails` — fail-closed prod config, restricted CORS, stable/versioned secret keys | backend/infra feature | **SHIPPED + ARCHIVED 2026-08-22** |
| 2 | `postgres-release-safety` — real Postgres CI, migration serialization/atomicity, release migration command | backend/infra feature | **SHIPPED + ARCHIVED 2026-08-22** |
| 2a | `chain-snapshot-local-store` — move the bounded full-chain research ring from Postgres BYTEA to the API persistent volume | backend/infra incident feature | **SHIPPED + ARCHIVED 2026-08-24** |
| 3 | `api-contract-generation` — generated OpenAPI plus checked TypeScript client/types | both-lane tooling feature | **NEXT — owner directed; starts after #2 archive** |
| 4 | `supply-chain-automation` — dependency updates, review, Rust audit/deny, CodeQL-supported surfaces, image scan, SBOM | CI/security feature | queued after #3 |
| 5 | `capacity-baseline` — API/SSE load and soak harness with checked thresholds and mocked vendors | backend/test feature | queued after #4 |
| 6 | `remote-archive-body-store` — S3-compatible immutable body store behind the shipped body-store port | backend/infra feature | queued after #5; existing filesystem store remains fallback |
| 3 | `api-contract-generation` — generated OpenAPI plus checked TypeScript client/types | both-lane tooling feature | **SHIPPED + ARCHIVED 2026-08-22** |
| 4 | `supply-chain-automation` — dependency updates, review, Rust audit/deny, CodeQL-supported surfaces, image scan, SBOM | CI/security feature | **PROMOTED — GATE I 2026-08-22**; still live, GATE Q FAIL (external/security blockers) |
| 5 | `capacity-baseline` — API/SSE load and soak harness with checked thresholds and mocked vendors | backend/test feature | **SHIPPED + ARCHIVED 2026-08-29** |
| 6 | `remote-archive-body-store` — S3-compatible immutable body store behind the shipped body-store port | backend/infra feature | queued after #5 (now unblocked in program order); existing filesystem store remains fallback |
| 7 | `telemetry-slos` — trace correlation/export, service-level objectives, dashboards and alert runbook | backend/infra feature | queued after #6 |
| 8 | `replica-safe-workers` — API/worker process split, singleton/job coordination, distributed rate limiting | backend/infra feature | queued after #7 |
| 9 | `recovery-deployment-maturity` — backup/restore drill, staging/migration/smoke/rollback gates, declarative host config | ops feature | queued after #8; migrate `railway.json` watch paths to Railway IaC before 2026-12-01 once the translator preserves them |
| 10 | `resilience-and-quant-assurance` — standardized upstream resilience plus property/fuzz/benchmark regression gates | backend/quant feature | queued after #9 |

Current-state corrections folded into the program: CI/CD and production smoke already exist;
session bodies already sit outside app Postgres on a filesystem body-store. Their successors
harden those capabilities rather than rebuilding them.

## Last GATE S — 2026-08-22 (`postgres-release-safety` — serialized release migrations)
<!-- atlas: theme=the-machine horizon=now -->
Full pipeline completed with **GATE Q PASS 29/0/0**, independent live conformance 1/1, real
PostgreSQL 17 migration/refusal matrices, and a repository/process receipt matched to direct Railway
deployment evidence. The release image now exposes one canonical non-root executable; Railway runs
the exact migration command before one healthy replica starts, and production serve remains
read-only/fail-closed against schema drift. Archived to `_archive/postgres-release-safety/`;
standalone conformance promoted. Program advances to #3 `api-contract-generation`.

## Last GATE S — 2026-08-22 (`production-runtime-guardrails` — fail-closed production profile)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline completed with production deployment evidence: **GATE Q PASS 26/0/0**, independent
live conformance 2/2, same-SHA real-Postgres CI, one Railway startup owner, and a matching-hash
mounted-volume replacement drill. Archived to `_archive/production-runtime-guardrails/`; standalone
conformance promoted. No decision key graduated. Program advances to #2 `postgres-release-safety`.

## Last GATE I — 2026-08-20 (canon repair → `project-context-s2-is-python-era`)
<!-- atlas: theme=the-machine horizon=now -->
Owner picked Architecture canon after keep-paid-books builds drained.
**Chosen → `project-context-s2-is-python-era`.** Inline conductor repair (no council —
the file being repaired is what a council would read). `PROJECT_CONTEXT.md` §2 backend
rewritten against `api-rust` + `quant-engine`; Python named only as archived. §2 split
into `## 2` backend (~60 lines) + `## 2b` frontend (~131) for shard size.
**No product code.** Push still deploy.

## Last GATE S — 2026-08-20 (`chain-archive-object-store` — session bodies off OLTP)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (keep-paid-books #7) → council (D1=A exact shipped copy) → PLAN → both
lanes → **GATE Q PASS 25/0/0**. Archived to `_archive/chain-archive-object-store/`.
Conformance re-pin promoted. **No new canon graduation expected.** Working tree uncommitted;
push is deploy. Program remaining: #5 wait (clock 2026-08-20) · #6 P4 blocked-on #5.

## Last GATE S — 2026-08-20 (`liquid-names-session-capture` — SPY/QQQ/IWM despite warm cache)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (keep-paid-books #2) → council (D1=A same-day retry) → PLAN (B1–B8 · F1–F2)
→ both lanes → **GATE Q PASS 25/0/0**. Archived to `_archive/liquid-names-session-capture/`.
Conformance re-pin promoted. **No new canon graduation expected.** Working tree uncommitted;
push is deploy. **Next in program → `paid-book-join-smoke` (chore).**

## Last GATE S — 2026-08-20 (`session-chain-archive` — prune-proof session books)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (keep-paid-books #1) → council (D1=A mandatory `source_as_of`) →
PLAN (B1–B8 · F1–F2) → both lanes → **GATE Q PASS 27/0/0**. Archived to
`_archive/session-chain-archive/`. Conformance JSON promoted. **No new canon graduation
expected** (tally next). Working tree still uncommitted; push is deploy.
**Next in program → `liquid-names-session-capture`.**

## Last GATE I — 2026-08-20 (keep-paid-books #2 → `liquid-names-session-capture`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner `ship it and continue`. **Chosen → `liquid-names-session-capture`.** Brief at
`.spire/clusters/tech/contracts/liquid-names-session-capture/BRIEF.md`.
**Backend / research; trader UI out of scope.**
**Why it won:** #1 shipped a prune-proof archive, but a warm gex-cache never hands a
`VendorBundle` to capture — QA observed QQQ as honest `no session book`. The names
score-lab already uses are the ones missing paid session books. Do not bundle object-store
or hist-chain. Cite live Rust.

## Last GATE I — 2026-08-19 (keep-paid-books program → `session-chain-archive`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner: put all 7 briefing recommendations in the backlog and work them 1-by-1.
**Chosen → `session-chain-archive`.** Brief at
`.spire/clusters/tech/contracts/session-chain-archive/BRIEF.md`.
**Backend / research; trader UI out of scope (`NO_UI_CHANGE` expected).**
**Why it won:** the 48-slot cap is deleting paid Options books the same day we
fetch them. Nothing downstream (#2 force-capture, #3 join smoke, #5 weeks of
corpus, #7 object store) matters until a session copy outlives prune.
`project-context-s2-is-python-era` still unpaid — this BRIEF cites live Rust.

## Last GATE I — 2026-08-18 (d) (after back-test eval → `replay-outcome-join`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner said `go` (next **build**, not a docs runbook) after the P0–P3 evaluation.
**Chosen → `replay-outcome-join`.** **SHIPPED 2026-08-19** (see Last GATE S below).
Brief archived at `_archive/replay-outcome-join/BRIEF.md`.

## Last GATE S — 2026-08-19 (`replay-outcome-join` — labels on replayed paid books)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (`go` after back-test eval) → council (D1=A capture-time `p0`) →
PLAN (B1–B10 · F1) → crash-recovery GATE R → both lanes → **GATE Q PASS 35/0/0**.
Archived to `_archive/replay-outcome-join/`. Conformance re-pin of `_research` routes
promoted. **No new canon graduation expected** (tally next). Working tree still
uncommitted; push is deploy. Pipeline drained; next move is GATE I (`go`).

## Last GATE S — 2026-08-18 (`batch-backtest-cli` — P3 replay of stored books)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (`go` after capture) → council (D1=A refuse hollow split) → PLAN
(B1–B9 · F1) → both lanes → **GATE Q PASS 28/0/0**. Archived to
`_archive/batch-backtest-cli/`. Conformance re-pin of `_research` routes promoted.
**No new canon graduation.** Working tree still uncommitted; push is deploy.
Pipeline drained; next move is GATE I (`go`).

## Last GATE I — 2026-08-18 (c) (queue-drain after capture ship → `batch-backtest-cli`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Pipeline drained after `chain-snapshot-capture` GATE S. Owner said `go`.
**Chosen → `batch-backtest-cli`.**
**✓ SHIPPED + ARCHIVED 2026-08-18** → `_archive/batch-backtest-cli/`. Brief at
`.spire/clusters/tech/contracts/_archive/batch-backtest-cli/BRIEF.md`.
**Backend / research; trader UI out of scope.**
**Why it won:** capture exists so the $199+$199 subscriptions can be measured, not only
served live. P2 `score-lab` still ranks digested samples; it never reloads a stored chain.
P3 is now feasible. Do **not** buy hist-chain. `project-context-s2-is-python-era` still
unpaid — this BRIEF cites live Rust; do not bundle.

## Last GATE S — 2026-08-18 (`chain-snapshot-capture` — keep paid Massive snapshots)
<!-- atlas: theme=trust-the-signal horizon=now -->
Full pipeline: GATE I (owner-named) → council (D1=A every paid fetch; dual retention 14d+48) →
PLAN (B1–B9 · F1–F2) → both lanes → **GATE Q PASS 28/0/0**. Archived to
`_archive/chain-snapshot-capture/`. Conformance JSON promoted. **No new canon graduation.**
P3 batch-backtest CLI is now unblocked. Working tree still uncommitted; push is deploy.
Pipeline drained; next move is GATE I (`go`).

## Last GATE I — 2026-08-18 (owner: keep paid Massive snapshots → `chain-snapshot-capture`)
<!-- atlas: theme=trust-the-signal horizon=now -->
Owner-directed after `ai-providers` ship. **Chosen → `chain-snapshot-capture`.**
**✓ SHIPPED + ARCHIVED 2026-08-18** → `_archive/chain-snapshot-capture/`. Brief at
`.spire/clusters/tech/contracts/_archive/chain-snapshot-capture/BRIEF.md`.
**Backend / research; trader UI out of scope.**
**Why it won:** Stocks $199 + Options $199/mo is not sustainable without keeping what those
calls already return. P0 already saves a digested structure row and a latest-wins
`scan_bundles` cache; the live `VendorBundle` is discarded. Batch replay (P3) is blocked
on this. Do **not** buy a new Massive product; do **not** invent hist-chain endpoints.

## Last GATE S — 2026-08-18 (`ai-providers` — multi-provider keys + named model)
<!-- atlas: theme=trust-the-signal horizon=now -->
Full pipeline: GATE I (owner-named) → council (D1–D7; D7 = user's Grok subscription) → PLAN
(B1–B10 · F1–F9) → both lanes (FE crashed once at ~249k, resumed) → **GATE Q PASS 26/0/4**.
Archived to `_archive/ai-providers/`. Conformance JSON promoted. **No new canon graduation.**
New watch-list key `user-subscription-not-operator-pool`. AC-9/10/14/15 remain blocked-on
AC-27. Working tree still uncommitted; push is deploy — owner call. Pipeline drained;
next move is GATE I (`go`).

## Last GATE I — 2026-08-17 (b) (owner request: multi-provider keys + Grok pool + model choice → `ai-providers`)
<!-- atlas: theme=trust-the-signal horizon=now -->
Owner-directed after `rec-plan-scope-caption` ship. **Chosen → `ai-providers`.**
**✓ SHIPPED + ARCHIVED 2026-08-18** → `_archive/ai-providers/`. Brief at
`.spire/clusters/tech/contracts/_archive/ai-providers/BRIEF.md`. **Both lanes.**
**Why it won:** owner named it. Settings is still Anthropic-only; the server already
accepts `provider` on the key PUT and can call four vendors, but the trader cannot pick a
model and there is no Grok OAuth / Convexa sub-pool path. Decision-impact: which model's
read they act on, and whether they pay BYO when a cheaper pool was intended.
**Do not invent** an xAI SuperGrok-subscription protocol — the asked path is "log in with
Grok to use Convexa's cheaper pool." Architect names a buildable mechanism or blocks that
arm. `project-context-s2-is-python-era` still unpaid; this BRIEF cites live Rust paths.

## Hygiene 2026-08-20 (Vercel React review batch — not a pipeline feature)
<!-- atlas: theme=the-machine horizon=now -->
Owner asked for the hygiene batch after a Vite/React skill review. **Not GATE I.**
Paid in this pass: (1) Vite analogue of `optimizePackageImports` for `@mui/material`
(`tools/vite-mui-path-imports.mjs`); (2) `cargo fmt -p api-rust -p quant-engine` so
`--check` is green; (3) `ports:free` IPv6 (`netstat -ano` both families; never :8001);
(4) `ci-standing-red` retired — local `npm run ci` analogue + e2e 52/52 + cargo test
green 2026-08-20; origin Frontend job already green 2026-08-16.
**Follow-on four, owner-named same day:** `mui-dev-eslint-path-imports` (source rewrite
+ ESLint lock + VS Code auto-import exclude; Vite plugin stays out of `vite.config.mts`
because `tools/` is outside the dashboard module boundary) · `god-module-split-trade-entry-portfolio`
(FE only: `openTypes` / `useContractLive` / `FillModeToggle` / `AiRecPanelBlocks`) ·
`widget-variant-not-boolean` (`bodyPad` + `bodyVariant`, no `noBodyPad`) ·
`toSorted-on-new-sorts` (production sorts + `tsconfig` `lib: es2023`) ·
`light-theme-first-paint` (blocking `data-theme` + paper canvas) ·
`eslint-warning-hygiene` (dashboard lint 0 warnings). Remaining review
findings stay in §B (`hygiene-review-2026-08-20` cluster) so GATE I can resurface
them. `project-context-s2-is-python-era` was repaired the same calendar day (canon
§2 Axum/`api-rust`).

## Last GATE S — 2026-08-17 (b) (`rec-plan-scope-caption` — §9.5 half two closed)
<!-- atlas: theme=trust-the-signal horizon=now -->
Full pipeline: GATE I → council (7 conflicts, D1–D4, S2 Critical none) → PLAN (B1 · F1–F5 · V1–V5)
→ frontend only → **GATE Q PASS 19/19**. Archived to `_archive/rec-plan-scope-caption/`.
`NO_BACKEND_CHANGE` — no conformance JSON promoted. Product `fc3bb8c`–`a944bd2`.
**`ai-rec-grounding` SPEC §9.5 is now recorded closed** (half one at `rec-absence-literals-hole`;
half two here). S2 residuals (copy second clause vs sibling honesty lines; grid `Entry` halo)
shipped as written — they are not §9.5. Pipeline drained; next move is GATE I (`go`).

## Last GATE S — 2026-08-17 (owner-directed archive of two live FE folders)
<!-- atlas: theme=trust-the-signal horizon=now -->
Owner said `archive both` after a boot that had read stale GATE V / ship-HOLD sheets.
**`ticker-visual-collisions`** and **`ai-rec-decision-card`** moved to `_archive/`. Both are
`NO_BACKEND_CHANGE` (no conformance JSON to promote). Product already on `main`; HEAD `593f601`
CI Frontend + Conformance + Deploy smoke green (2026-08-16). **No new canon graduation** expected
(reaffirmations of already-promoted keys). **§9.5 half two stays open** — do not record it closed.
Pipeline drained; next move is GATE I (`go`) or a named feature.

## Last GATE I — 2026-08-17 (queue-drain cull → `rec-plan-scope-caption`; four stale alarms cleared)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/` + `_discovery-pack.md`; `IN_FLIGHT` empty;
`main` @ `593f601` = `origin/main`). Owner-directed archive of `ticker-visual-collisions` +
`ai-rec-decision-card` had just closed. Discovery pack again elided the BACKLOG **Pool (1173
lines)** and the **Ledger (601 lines)** as over-budget — escape hatch used; both read directly.
**Chosen → `rec-plan-scope-caption`.** **✓ SHIPPED + ARCHIVED 2026-08-17 (b)** →
`_archive/rec-plan-scope-caption/` (FE-only; GATE Q 19/19). Brief at
`.spire/clusters/tech/contracts/_archive/rec-plan-scope-caption/BRIEF.md` (full `Considered:`).
**Frontend-only expected (`NO_BACKEND_CHANGE`).**
**Why it won:** it is the only survivor whose failure mode is a **wrong trade**. Half one of
§9.5 (false `—` on absent plan fields) closed at `rec-absence-literals-hole`; half two — a
reader inferring *"no clause means checked"* onto **stated** structure / trigger / horizon /
conviction — was future-dated when that council cut the caption on line-budget. The
decision-card ship moved long-form into a drawer, which is new **placement** evidence; it did
**not** remove the always-on condition: `recommendation.rs:841-849` still emits `trade` with
empty strikes and a stated structure/trigger whenever a setup exists. That constraint binds
the design — the caption must not become standing chrome on `local_rules`.
**Queue honesty (code-verified this gate — do not re-open as stale):**
1. **S5c is NOT resolved on the live backend.** `docs/TECH_DEBT.md` ticks it at `86adf3b`,
   which patched Python `main.py` / `live.py`. Rust `config.rs` never reads
   `MAX_LIVE_SESSIONS` / `MAX_LIVE_SUBSCRIBERS` (decoy lines in `.env.example`).
   `routes/stream.rs` caps **symbols per request** (120), not concurrent subscribers.
   Strongest N/A-class runner-up; do not start it until `project-context-s2-is-python-era`
   is its own reviewable diff.
2. **`signed-out-refused-affordances` SHIPPED 2026-08-10** (IMPROVEMENT_BACKLOG 5.1,
   `shared/ui/Refused`). The §A "displaced to L4" row is stale.
3. **`split-decision-log` CLOSED.** `features/trading/model/store.ts` is a read-only
   legacy harvest source; write paths were deleted at the v3 cutover.
4. **The DTE `?` / containment caption is CLOSED** in `ai-rec-decision-card`
   (`dteWindowCaption` requires both finite bounds; wording is a request property).
**Flagged RISING for a FOURTH consecutive gate, still not chosen:**
`degradation-visibility` (decision-impact N/A). Do not re-derive a fifth time — it needs
an owner override if it is ever to run.
**Hygiene batch 2026-08-20:** `ci-standing-red` retired · `ports-free-is-ipv4-only` closed
· `cargo-fmt-whole-crate-drift` closed. The :8000 *access-denied orphan* can still outlive
`taskkill` (Windows file lock) — see §B `ports-orphan-access-denied`.
**X4 (ledger checkpoint) still blocked** on N≥20 closed outcomes.
**`project-context-s2-is-python-era` repaired 2026-08-20** (canon §2).

## Last GATE I — 2026-08-14 (pre-registered successor re-tested and CONFIRMED → `rec-absence-literals-hole`; scope revised UP to six fields + both lanes)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/`; `IN_FLIGHT.md` one row, `main` @ GATE S, no
overlap). **First gate run on spire-os 3.13.0** (the prior ship ran the 3.3.0 driver; the RESUME
overlay directed this gate to re-derive the catalog from the installed files rather than assume).
The prior gate and the 2026-08-13 RESUME both pre-registered **`rec-absence-literals-hole`** and
directed **re-test rather than inherit**. Re-tested and **CONFIRMED — with its scope revised UP.**
**Chosen → `rec-absence-literals-hole`.** **✓ SHIPPED + ARCHIVED 2026-08-14** →
`_archive/rec-absence-literals-hole/` (full pipeline both lanes; council 28 conflicts / 28 quotes
machine-verified / 9 self-revisions / 1 owner ruling + 1 at the review cap; S2 ×2 → R4 ×3; **GATE Q
PASS 47/47, 0 FAIL** with zero code defects — the one bounce was a canon row the conductor owed).
Conformance spec promoted to `state/conformance/rec-absence-literals-hole.json` (2 endpoints).
**GATE S graduated `ai-asserted-numbers-are-traceable`** (2 binding) — the key logged at 0 instances
2026-07-16 as aspirational; it reached the bar on ordinary recurrence, so the queued severity-path
question dissolved unasked. Canon folded: OPEN_THREADS §7af + PROJECT_CONTEXT §5/§6 + DESIGN_SYSTEM
Amendments (`unrecognized`). **⚠ §9.5 closes in HALF ONE ONLY** — half two survives until the
future-dated plan-row caption ships, and no report may record it closed before then.
*(original entry:)* Brief at `_archive/rec-absence-literals-hole/BRIEF.md`
(carries the full `Considered:` cull set). **Both lanes expected.**
**Why it won:** it is the only survivor whose failure mode is a **wrong trade** rather than a
degraded, slower or unmeasured one. `ai-rec-grounding` closed the numbers the AI **asserts**; this
closes the ones it **omits** — the other half of the same hole, and the residual that feature named
in its own SPEC §9.5. Every other candidate is decision-impact **N/A** by the cull's own test.
**Queue honesty (code-verified this gate — do not re-open as stale):**
1. **The entry's line numbers and lane are BOTH wrong** — the third time the "backlog code
   references go stale" rule has bitten. The file moved to `pages/ticker/widgets/ai-rec/AiRecPanel.tsx`;
   the bare `?? '—'` sites are **`:1081, :1084, :1090, :1100`**, not `753/1044/1053/1063`.
2. **It is SIX fields, not four.** `Time horizon` (`:1153`) and `confidence` (`:1158`) carry the same
   bare `?? '—'` and the 2026-08-13 entry named neither.
3. **It is NOT FE-only.** `apps/api/src/services/rec_inputs/field_reasons.rs:5` defines
   `RecField { MaxRisk | PositionSize | ExitTarget | ExitStop | InvalidationLevel }` — the risk/exit
   fields only. **No reason token exists on the wire for any of the six**, so the frontend cannot
   distinguish an omission from anything else without a backend addition. Backend lane required.
4. **The defect is sharper than the entry states.** All six sit in the **trade** branch
   (`AiRecPanel.tsx:997`), while `—` is defined at `:958` as the `no_trade` branch's *"No entry, so
   there is nothing to size."* So a card headed **`Trade · long`** can print `Strike(s): —` — the
   reserved no-entry literal on a card that just told you to enter. The fix mechanism already ships
   **in the same file**: `fieldLiteral` (`literals.ts:50`), a closed `FieldLiteral` union with a
   spec'd, tested five-member vocabulary.
**Runner-up:** the **S5c SSE connection ceiling** — the last genuine MEDIUM from the security review,
and the one that can take the **current single container** down now that the app is live. Pick it
next if an availability/backend fast-path is wanted.
**Flagged RISING for a THIRD consecutive gate, still not chosen:** **`degradation-visibility`**
(decision-impact N/A, so the cull cannot promote it) — it grew again this ship, since
`ai-rec-grounding` added more nullable best-effort fields to a system that still aggregates no null
rates. A rule that keeps rising and can never win the cull is worth an owner decision rather than a
fourth re-derivation.
**`project-context-shard-sizes` escalated by this gate's own evidence** (it was already superseded
by the 3.13.0 doctor's 100KB budget flags): the discovery pack elided the BACKLOG **Pool (1123
lines)** and the **Ledger (575 lines)** as over-budget — **discovery's own pack dropped the primary
discovery surface**, and both had to be read directly by targeted Read. The escape hatch worked as
designed and is recorded here as the signal to fix the pack, per ORCHESTRATOR §3 GATE I.
**Hygiene batch still unpaid** (`ci-standing-red` + `ports-free-is-ipv4-only` +
`cargo-fmt-whole-crate-drift` + the :8000 orphan) — carried from the prior gate, unchanged.

## Last GATE I — 2026-08-13 (pre-registered successor re-tested and CONFIRMED → `ai-rec-grounding`; its feasibility re-grounded UP)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/`; IN_FLIGHT showed no overlap). The prior gate and
the 2026-08-13 RESUME overlay both pre-registered **`ai-rec-grounding`** as the strongest successor and
directed this gate to **re-test rather than inherit** it. Re-tested and **CONFIRMED**.
**Chosen → `ai-rec-grounding`.** **✓ SHIPPED + ARCHIVED 2026-08-13** →
`_archive/ai-rec-grounding/` (full pipeline both lanes; GATE Q **PASS 68/68** after one GATE Z bounce
cycle; conformance spec promoted to `state/conformance/ai-rec-grounding.json`; see OPEN_THREADS §7ae).
**The number that justifies the feature: 44.4% of the AI's asserted numbers do not trace** to anything
Convexa computed — all of them rendered as fact before this ship. The prompt fix took `max_risk`
cap-checkability from **0 of 4 to 4 of 4**. *(original entry:)* Brief was at
`contracts/ai-rec-grounding/BRIEF.md` (carries the full `Considered:` cull set). Both lanes expected.
**Why it won:** it is the only survivor whose failure mode is a **wrong trade** rather than a degraded,
slower or unmeasured one. `[best-effort-isolated-or-null]` covers the AI *failing*; **nothing covers it
fabricating**, and `tradeable-rec-inputs` (shipped the day before) made the rec assert strictly MORE
numbers. It also promotes `ai-asserted-numbers-are-traceable` — a watch-list key deliberately parked at
**0 instances** since 2026-07-16 as aspirational — on real evidence rather than intention.
**Queue honesty (code-verified this gate — do not re-open as greenfield):**
1. **`ai-rec-grounding` is NOT greenfield — the verification seam SHIPPED last week and the §B entry
   (written 2026-07-16) predates it.** `apps/api/src/services/rec_inputs/` already contains
   `cited.rs` (a private-field `CitedKey` with **no partial constructor**, matching the rec's named
   contract against the candidate set under a closed `CitedState`), `cap_check.rs`, `max_risk.rs` (ONE
   parse for ONE consumer) and `field_reasons.rs` — whose `RecField { MaxRisk | PositionSize |
   ExitTarget | ExitStop }` already enumerates the exact four fields this feature must cover.
   **The precise gap:** `field_reasons` explains **absence** (`NotGiven`/`Unavailable`) and nothing
   verifies **presence** — `exit_plan.stop`, `exit_plan.target` and any price the prose names are
   rendered verbatim from the model. So this is an **extension of a live module**, not a new subsystem.
   Feasibility revised **M**, not the entry's implied larger build. FE precedent likewise exists,
   un-generalized: `ai-rec.risk.spec.tsx` §1 already guards "Levels in play is bundle-sourced".
2. **`rec-prompt-single-figure-max-risk` is FOLDED IN, not separately scheduled.** `max_risk.rs`
   returns `NotParseable` when the prose names two *different* dollar figures in one sentence — which
   the V10 harness measured on **4 of 4** after-arm trades, so the cap check ships delivering nothing on
   its headline path. Same surface, same session; splitting it means touching the rec twice.
   **The parser is correct and is NOT reopened** — the fix is the prompt, never a parser loosening.
**Runner-up:** `score-lab-b0b-outcomes` — S-sized backend fast-path, unchanged from the prior gate;
needs `MASSIVE_API_KEY` at run time and **never synthesizes outcomes** (if the key is unavailable it
waits). Pick it next if a backend fast-path is wanted.
**Two items flagged RISING, not chosen** (both decision-impact **N/A**, so the cull cannot promote them —
recorded so a later gate does not re-derive the judgement): **`degradation-visibility`**, which grew more
valuable *this ship* because tradeable-rec-inputs added several nullable best-effort fields to a system
that still aggregates no null rates; and the **S5c SSE connection ceiling** (§C Stage 3 / `docs/TECH_DEBT.md`),
which stopped being theoretical when the app went live — it is the one remaining MEDIUM that can take the
**current single container** down. **Hygiene batch worth one pass:** `ci-standing-red` +
`ports-free-is-ipv4-only` + the :8000 orphan — the last feature lost time to all three, one QA pass having
to **rename a running binary** to get a trustworthy measurement.

## Last GATE I — 2026-08-12 (runner-up promoted; sequencing deferral re-tested and overturned → `tradeable-rec-inputs`)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/`). The prior gate pre-registered its runner-up —
*"`tradeable-rec-inputs` Tier 1 (items 1+2+3) … deferred on **sequencing not merit**. Pick it next."*
— and the RESUME overlay directed this gate to **re-test that sequencing rather than inherit it**.
Re-tested and **OVERTURNED**. **Chosen → `tradeable-rec-inputs` (Tier 1: items 1+2+3).**
**✓ SHIPPED + ARCHIVED 2026-08-13** → `_archive/tradeable-rec-inputs/` (full pipeline both lanes;
QA PASS 100/100 after one GATE Z bounce cycle; see OPEN_THREADS §7ad).
**Why the deferral no longer held:** the stated objection — "enriches inputs to a headline judgment
whose ranking value was just measured as unestablished" — conflated the composite `opportunity_score`
(what the score lab measures) with the **AI recommendation** (what Tier 1 feeds — a different
judgment, measured by the outcome ledger, not the lab). The lab's own question needs weeks of diary
accumulation regardless (B0b open), so holding the strongest product candidate behind it idled
product progress for nothing. Both source caveats carried as binding framing and were **borne out at
ship**: the real before/after run produced 0/5 no_trade→trade flips and 1/5 trade→no_trade with a
stated reason — better-argued, not more trades.
**Queue honesty (disk-verified this gate — do not re-derive):**
1. **N3 `index-first-defaults` is NOT "Not started" — it SHIPPED + ARCHIVED 2026-08-01** (verified:
   `_archive/index-first-defaults/_MANIFEST.md`, QA PASS 6/6). The 2026-08-12 RESUME overlay inherited
   the stale label from `docs/ROADMAP_2026-08.md`; it was removed from this cull set. Correct the
   roadmap doc's label when next touched.
2. ~~**N1 (deploy) still outstanding — 5th consecutive gate flag.**~~ **WRONG — RETIRED 2026-08-13.**
   The owner challenged this and was right: full CI/CD exists (built in Grok CLI sessions) and
   **push = deploy** — Railway auto-deploys the backend, Cloudflare Pages builds the frontend from git.
   Verified by live probes: this very feature was serving on `convexa.pages.dev` within the hour of its
   push, front and back. The "June 29 build / applied by hand" claim had survived multiple "verified"
   RESUME notes — a stale-canon lesson: **a standing flag repeated across gates is a claim to re-probe,
   not a fact to inherit.** See OPEN_THREADS §8's superseded CI/CD bullet for the full correction.
**Runner-up:** `score-lab-b0b-outcomes` — S-sized, unlocks V3b + the lab's full-power cells; needs
`MASSIVE_API_KEY` at run time; fits a quick backend fast-path whenever the owner wants it.
**Also close:** `ai-rec-grounding` — Value H, and now strictly MORE valuable post-ship (the rec
asserts more numbers to trace); natural successor.

## Last GATE I — 2026-08-11 (b) (roadmap queue drained → `score-lab-signal-comparison`; two more stale alarms cleared)
<!-- atlas: theme=prove-the-edge horizon=now -->
Pipeline drained again (`contracts/` held only `_archive/`), and this time **the 2026-08-01 roadmap
queue itself is exhausted**: X1/X3-adjacent items shipped, X2 + `alerts` are shipped-in-code, and
**X4 (ledger checkpoint) is blocked** on N≥20 closed outcomes via owner habit N2 — deferred by the
owner 2026-08-01. So this gate chose what comes AFTER the standing order rather than executing it.
**Chosen → `score-lab-signal-comparison`.** Brief at
`.spire/clusters/tech/contracts/score-lab-signal-comparison/BRIEF.md` (carries the full `Considered:`).
Backend-only expected (research CLI + report; no UI, no trader route). Make the weekly score-lab
**comparative and per-symbol by default** — rank vol-norm GEX and level geometry beside
`opportunity_score` on the same KPI — so the accumulating diary answers *which* signal ranks
magnitude, not just whether the composite one does.
**Why it won:** the freshest evidence in the repo (`docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md`,
dated this day) measured the app's headline judgment as **worse than chance** at ranking large moves
on its first slice (AUC 0.467, lift@top10 0.17, Pearson ≈ −0.02) while `structure_event` scored
AUC 0.932 — and the two most decision-relevant findings in that document (the per-symbol inversion
SPY +0.51 / QQQ −0.31, and the structure-event contrast) were produced **by hand for the write-up**,
not by the tool. It is also the only survivor whose value **decays weekly**: the diary accumulates
daily, and each week the lab runs non-comparatively answers a question already answered.
**Queue honesty (code-verified this gate — do not re-open as greenfield):**
1. **The deep dive's "autonomous follow-up (code)" is ALREADY SATISFIED.** It asks that the slow-lane
   append copy `row.score_drivers` into structure history. That path is complete in current code —
   `projection.rs:126` populates drivers from signals, `store.rs:129` (`from_row`) copies them,
   `pg_scan.rs:426` persists them, and `store.rs:944` tests it — **all landed 2026-08-10 in
   `13656ad`**, before the doc was written. The `n = 0` attribution cells are **older captures**, which
   the doc itself hedged and which must not be repaired ("do not invent drivers for past null rows").
   **Genuine residual is one S-sized piece:** nothing logs when an ok row yields null drivers, so a
   live regression would look identical to a pre-fix row. Folded into the chosen feature.
2. **The backlog's code references are STALE — the backend is Rust, not Python.** Many §B/§C entries
   cite `main.py` / `signals.py` / `engine.py` / `live.py` / `interface_conformance.py`; `apps/api` is
   **Axum/Tokio Rust** (crate `api-rust`) and the Python tree is retired under `archive/api-python/`
   (`RETIRED.md`). Feasibility notes resting on those paths must be re-grounded before they are
   trusted — this gate re-grounded only the chosen feature's.
3. **`sources.ts` NUL bytes — CLEARED.** §8 flags literal NULs making the file binary to grep; byte
   scan at this gate returns **0**. Stale; do not re-schedule.
**Runner-up:** `tradeable-rec-inputs` Tier 1 (items 1+2+3) — the strongest **product** candidate,
passes the cull emphatically, deferred on **sequencing not merit** (it enriches inputs to a headline
judgment whose ranking value was just measured as unestablished). Pick it next.
**Also flagged, not a pipeline feature:** the live site `convexa.pages.dev` is still the
**2026-06-29 build**, so the 2026-08-06 private-testing lockdown (§7ac — signups closed, scan routes
gated) **is not live**; sign-ups remain open in production. Owner habit N1 (deploy runbook).

## Last GATE I — 2026-08-11 (queue honesty after drain → `recent-ticker-chips`; X2/X3/split-log no longer greenfield)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained after `distance-to-level-tiles` SHIPPED + ARCHIVED + prod deploy. Owner chose
track **A** (next product feature). Full harvest against standing queue + code reality (not the
stale roadmap labels alone).
**Chosen → `recent-ticker-chips`.** Brief at
`.spire/clusters/tech/contracts/recent-ticker-chips/BRIEF.md` (carries full `Considered:`). FE-only
expected (`NO_BACKEND_CHANGE`). Highest remaining Ticker UX quick win after distance-to-level tiles.
**Queue honesty (code-verified this gate — do not re-open as greenfield):**
1. **`vol-normalized-gex` (X2) — already in production code.** `libs/quant-engine` vol_gex + Path B
   analytics + `MarketState.vol_normalized_gex?` + DealerPositioning “Vol-norm GEX” tile +
   methodology copy. Status note: `docs/research/X2_VOL_NORMALIZED_GEX_STATUS.md`. Residual =
   score-lab coupling / hist A/B research — **not** a rebuild. Mark X2 **shipped in code** in the
   standing queue; thin Spire archive optional later.
2. **`alerts` (X3) — already in production code.** `/alerts` route + TopNav, client durable rules,
   pure evaluate + vitest, ticker evaluate-on-snap, optional browser Notification. Webhook delivery
   remains deferred optional. IMPROVEMENT_BACKLOG 5.5 checked 2026-08-10.
3. **`split-decision-log` — RESOLVED** at positions v3 cutover: ghost `appendDecision` / write path
   deleted; `model/store` is read-only harvest; single positions decision log. BACKLOG §B entry is
   **stale alarm** — leave for cleanup, do not re-schedule as emergency.
**Runner-up:** sticky condensed header (still deferred Ticker UX). **Blocked:** ledger checkpoint
X4 on N≥20 closed outcomes (habit N2). **Not chosen:** re-implementing X2/X3.

## Last GATE I — 2026-08-06 (queue-drain cull → `broker-option-grouping`; the owner pick held, one entry re-assessed DOWN)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline was **drained** (`.spire/clusters/tech/contracts/` held only `_archive/`); ran the full harvest → cull
rather than rubber-stamping the queue. **Chosen → `broker-option-grouping`** (roadmap queue item 3,
owner-chosen 2026-08-05 off the live broker verify). Brief at
`.spire/clusters/tech/contracts/broker-option-grouping/BRIEF.md` — it carries the full `Considered:` cull set;
not restated here. FE-only expected (empty `apps/api` diff); the seam is `brokerView.ts`, already a
pure `BrokerBook → PositionView[]` projection, so grouping is a pure layer over its output.
**The cull did not just confirm the queue — it changed two things:**
1. **`split-decision-log` RE-ASSESSED DOWN (§B).** Its entry reads as an evidence-leak emergency
   ("half the decision records written to a dead-letter key"), which would outrank a UI feature
   outright given the roadmap's edge test depends on ledger N. But the entry's own interim note
   settles it: **outcome-ledger's reader unions both durable logs and de-dupes**, so the ledger is
   **not losing evidence today**. Remaining harm = store-split integrity + a migration hazard
   (`[loss-free-durable-migration]` is binding when it IS fixed). **Value M–H → M.** Recorded here
   so the next GATE I does not re-derive the alarm from the entry's framing.
2. **`responsive-layout`'s data-loss alarm is STALE — cleared, not acted on.** §B still warns the
   branch "exists ONLY on this machine — never pushed" and recommends pushing it. **Verified at this
   gate:** `origin/feat/responsive-layout` exists at `a7b92eb`, identical to local, 0 ahead / 0
   behind. The chore is done; §B corrected in place. What actually remains is the owner **device
   review** (notch safe-areas, fluid type, <375px polish) — a real parked item, not a risk.
**Runner-up if a different shape is wanted:** `vol-normalized-gex` (X2 — strongest decision impact
in the pool, heavier GATE-M math track, the roadmap's own next-in-line). §B **distance-to-spot level
tiles** **SHIPPED + ARCHIVED 2026-08-11** as `distance-to-level-tiles`.
**Non-blocking, folded into the BRIEF rather than asked here:** §7z's UNRULED `Build reassessment`
on `partial` option rows carrying `position: null` sits on exactly the rows this feature
restructures → routed as a council R3 **product** conflict so the surface is touched once.

## Last GATE I — 2026-08-01 (OWNER ROADMAP ADOPTION: edge-first — `docs/ROADMAP_2026-08.md` is the standing order)
<!-- atlas: theme=prove-the-edge horizon=now -->
**Owner-directed, off the deep-research cycle** (evidence: `docs/MARKET_REALITY_REPORT_2026-08-01.html`,
4 sourced research tracks + canon; frame locked by owner Q&A 2026-08-01: *my edge first, business later* ·
10–25 h/wk · owner will be the public face · minimize spend, ~$1k/mo ceiling). **The roadmap doc is the
standing order for sequencing** — this entry records the queue + what it displaces; the doc carries the
rationale, budget variants, and the pre-committed kill/continue gates.
**Strategy in one line:** prove the edge on the owner's own trading first (the outcome ledger is the
judge); commercialization (L3/L4) is **gated on ledger evidence + licensing-in-writing** — never before.
**Queue (in order):**
1. **`index-first-defaults` (N3) — ✓ SHIPPED + ARCHIVED same day (2026-08-01, `832f0a7`).** GATE V
   fast-path; QA PASS 6/6 (de-correlated Sonnet); suite 1104/99 the new baseline; empty `apps/api`
   diff; no new ledger rows (all touched keys already canon). Seams → OPEN_THREADS §7y (the
   hand-mirrored `INDEX_MEGACAP_SYMBOLS` maintenance contract). *(original entry:)* default ticker →
   SPY (pref wins), scanner zero-state leads indexes+megacaps, single-name honesty caption.
2. **`broker-connect` (X1) — ✓ SHIPPED + ARCHIVED (2026-08-05).** Read-only real Webull positions;
   owner live-verified against their actual 13-position book. QA PASS after one GATE Z security
   cycle; **system-6 fired and closed** (1C+3H+2M fixed, each with a regression test).
   `[no-real-order-path]` narrowing FORMALIZED and made structural. Seams → OPEN_THREADS §7z.
   New ledger candidate `vendor-contract-verified-not-faked` (3 instances in one feature).
   *(original entry:)* **⏭ was NEXT — `broker-connect` (X1)** — READ-ONLY real positions behind the **`PositionsProvider` port**,
   two candidate adapters the council must weigh (CORRECTED 2026-08-01 after owner question): (a)
   **Webull-direct via the owner's own Individual OpenAPI keys** (free; 1–2 day individual application;
   account+positions endpoints + official Python SDK; no intermediary; BYO-credential pattern = byo-ai-key
   precedent; verify options/multi-leg payload shape at application time) — likely v1 for the edge-first
   personal phase; (b) **SnapTrade** (free ≤5 connections, then ~$1–2/user/mo; OAuth UX; multi-broker;
   Webull officially partnered 2025-12-16) — the named adapter for the later external-users phase. The
   earlier "Webull-direct is dead" verdict applied only to third-party/platform access, NOT self-use.
   Full council. **Fires the deferred system-6 security review** (first real-account connection — the
   long-standing trigger; broker App Secret ⇒ `[secret-encrypted-at-rest]`).
   `[no-real-order-path]` narrowing (read OK, no execution) formalizes at its GATE S as planned.
3. **`broker-option-grouping` — ✓ SHIPPED + ARCHIVED (2026-08-06)** → `_archive/broker-option-grouping/`.
   Full pipeline, single-lane (FE-only, `NO_BACKEND_CHANGE`, empty `apps/api` diff): GATE I → C (council
   R1–R3, 25 conflicts / 25 quotes verified / 0 technical unresolved / 2 owner rulings; R4 ×3, S2 ×2) →
   PLAN → FE ×3 phases → **Q FAIL → Z → Q PASS**. Final **49 PASS / 0 FAIL / 1 UNVERIFIABLE**
   (AC-1b owner-only); conformance backend PASS · QA PASS agreeing; dashboard **122 files / 1439 tests**
   (from 116/1291), e2e **41** (from 37), api 272 unchanged, lint 0/0, typecheck 0.
   **GATE S graduated TWO keys:** `structural-over-prose-enforcement` (4 features — held back three times
   for lacking a statable violation test; this ship supplied it) and `single-motion-moment` (2 binding —
   **crossed at redesign-stage-3 2026-07-22 and was missed at that GATE S**, surfaced by `ledger_tally`).
   **Two canon errors corrected at this ship:** the captured book is 14 holdings / 3 groups + 2 lone legs,
   not "13 positions / 4 verticals + 1 lone" (and TSLA's +10/−4/+4 makes the rejected pairing heuristic
   wrong on the owner's *actual* book today); and the rendered group nets are Convexa's composition
   (META 3,805.00 / NVDA 7,890.00), **not** Webull's raw `total_cost` (3,802.00 / 7,889.00) which the app
   never displays. Seams → OPEN_THREADS §7ab. *(original entry:)* **⏭ was NEXT — `broker-option-grouping`** (owner-chosen 2026-08-05, straight off the live verify).
   Collapse a ticker's option legs into ONE expandable row with the NETTED entry cost, and
   **never name the structure** — Webull supplies no strike/expiry/right, so the app cannot prove
   which legs pair; grouping by underlying is a FACT, calling it a vertical is a GUESS. Rejected
   alternatives (recorded so they aren't re-litigated): inferring spreads from matching qty +
   opposite side (works on today's book, silently merges the wrong legs the day two same-sized
   spreads exist on one ticker) and manual user pairing (never wrong, but manual forever).
   Upgrades automatically to real structures if a contract-detail lookup ever lands (see §7z's R7
   probe: `/trade/instrument` is LIVE but echoes — a parameter/entitlement question for Webull).
   **Invariant watch:** `absent-is-not-none` (a group is a count + a net, never an unearned label) ·
   `model-read-carries-its-assumptions` · `theme-token-discipline`. FE-only expected.
4. **`vol-normalized-gex` (X2) — ✓ SHIPPED IN CODE** (verified GATE I 2026-08-11; see
   `docs/research/X2_VOL_NORMALIZED_GEX_STATUS.md`). Math + wire + UI + methodology present; residual
   research/score-lab coupling only.
5. **`alerts` v1 (X3) — ✓ SHIPPED IN CODE** (IMPROVEMENT_BACKLOG 5.5, 2026-08-10; re-verified GATE I
   2026-08-11). In-app rules + browser Notification; webhook optional later.
6. **Ledger checkpoint (X4)** at N≥20 closed outcomes → first deliberate score change only if justified,
   under `[score-change-is-deliberate-and-measured]`. **Still the next edge-program gate once N is real.**
7. **`recent-ticker-chips` — ✓ SHIPPED + ARCHIVED 2026-08-11** → `_archive/recent-ticker-chips/`
   (GATE V + PLAN + FE; QA PASS 8/8; `NO_BACKEND_CHANGE`).
**Owner habits (not pipeline features, tracked in the roadmap):** N1 deploy (runbook, `ALLOWED_ORIGINS`) ·
N2 mirror every real trade · N4 daily public read on X — **DEFERRED by owner 2026-08-01 until personal
testing shakes out the quirks** (business-path gates slide with it; edge test unaffected).
**Displaced (not dropped):** `signed-out-refused-affordances` — it only matters when strangers use the
app; revisit at L4 (first external users). **Explicitly cut:** 0DTE arms race, breadth chasing, direct
broker APIs, real-time quote display to others, real order execution (invariant stands).
<!-- atlas: theme=trust-the-signal horizon=now -->
**Chosen → the redesign program (Q4 decided (a), full direction)** — owner-directed off the decision
queue, not a harvest cull. Evidence chain: `DESIGN_REVIEW_2026-07-22.md` (structural) →
`verification-2026-07-22/` (eyes-on, every hard-floor finding CONFIRMED: scrollWidth 580 vs 393, no
mobile nav, near-zero `:focus-visible`, 29 `<h6>` stat values, 9px deltas) →
`BRAND_TOKENS_PROPOSAL_2026-07-22.md` (the direction + §6a canon pre-flight rulings). **Four stages,
each its own GATE V program** (FE-only, `NO_BACKEND_CHANGE` throughout): **Stage 0** floor repair
(fold in `feat/responsive-layout` — needs rebase; focus rings; semantics; touch/type floors; copy
fixes) → **Stage 1** token swap (new palette/type into `tokens.ts`/`theme.ts` + theme-audit gaps +
blog re-skin via the GENERATOR) → **Stage 2** signature (mark, hero curve-draw, arc dividers; SEO
prerender re-derives AFTER) → **Stage 3** surface sweep (+ motion consolidation superseding the
stagger, tests REPLACED not deleted). **Rule-of-record for every lane: the `convexa-design` skill**
(+ frontend-design, web-design-guidelines, vercel-react-best-practices, composition-patterns,
webapp-testing per the owner's skill-stack directive). **Invariant watch:** theme-token-discipline
(the migration rail) · additive-keeps-score-byte-identical (presentation-only; empty `apps/api` diff
per stage) · live-vs-static-isolation (3 distinct degraded states survive the re-skin) ·
model-read-carries-its-assumptions + digested-labels (contract copy, not decor) ·
single-shared-sim-entry-dialog (restyle, never fork) · no-real-order-path (honest landing copy) ·
loss-free-durable-migration (if any durable pref key/shape moves). **Stage 3 (surface sweep) -> SHIPPED + ARCHIVED same day** (`0cd0901`; QA PASS 36/36; suite 73/606
the new baseline; motion set-equality pinned; the proximity-chip green-reservation latent fix) —
**PROGRAM COMPLETE: all 4 stages shipped 2026-07-22.** **Stage 2 (the signature) -> SHIPPED + ARCHIVED same day** (`51b9d7e`; QA PASS de-correlated Sonnet;
arc-in-exactly-3-places set-equality enforced; suite 69/563 the new baseline; QA also caught the
conductor's under-spec render pass - closed with Web-Animations-API draw proof). **Stage 1 (token swap) → ✓ SHIPPED + ARCHIVED same day** (`5846864`; QA PASS de-correlated Sonnet,
all 19 contrast ratios independently recomputed; suite 63/523 — the new baseline; blog-artwork residual
→ §7u seam). **Stage 0 → ✓ SHIPPED + ARCHIVED same day** (`35fef23`; QA PASS 6/6 + 15/15 de-correlated Sonnet;
393px 580→378 + drawer nav + focus rings + 0 h6 stat values + floors + honest copy; suite 58/493;
see OPEN_THREADS §7u). **NEXT in program: Stage 1** (token swap). **`scanner` displaced a 7th time —
owner-directed, never dropped** (system-12 doc reconciliation still precedes its eventual GATE U·X).

## Last GATE I — 2026-07-16 (CANON REVIEW: the score is frozen + unvalidated → `outcome-ledger`)
**Chosen → `outcome-ledger` — ✓ SHIPPED + ARCHIVED (2026-07-16)** → `_archive/outcome-ledger/`. Full
pipeline, **single-lane fan-out** (`NO_BACKEND_CHANGE` ⇒ no backend lane): GATE I → A·X → P·X → **Z×4** →
U·X → FE → **Q**. **QA PASS 46/46 ACs, 0 FAIL, 0 UNVERIFIABLE** (fresh de-correlated Sonnet, every gate
re-run independently; conductor cross-checked the AC coverage 1:1 against the contract and caught a `52`
arithmetic slip in the QA headline — corrected, coverage was always complete). `nx test dashboard`
**804/804** (674 baseline + 130) · `tsc -b --force` clean · lint 0 · `apps/api` diff **empty** (conductor-
and QA-verified). Conformance **n/a and correctly absent** (consumes **no endpoint** ⇒ no FE↔BE surface;
**system-12 does not bite this feature — it still lands on `scanner`**).
**GATE S tally: NO new graduations** — all 12 keys are already canon. `loss-free-durable-migration` **1→2**
· `model-read-carries-its-assumptions` **3→4** · `digested-labels-not-raw-dump` **2→3** ·
`score-change-is-deliberate-and-measured` **0→1** (its first instance, as the rule's *enabler*). New
watch-list key **`structural-over-prose-enforcement`** (1 instance, not promoted).
**The severity path validated itself:** `loss-free-durable-migration` was promoted **at 1 instance on
severity** this same day, over the objection that recurrence was unmet — and the very next feature became
its **2nd binding instance**, in the sharpest way possible (it had to **REFUSE an import** rather than let
the store APIs rewrite an unreadable blob). Under recurrence-only it would still have been on the watch
list *while the feature that needed it was being built*.
**The amendment loop fired 4× (A1/A2/A3/§11.6) + 2 UX copy rulings — every one a real defect, every one
raised by a DOWNSTREAM lane refusing to decide out of its own lane.** Sharpest: **A3** — the naive widen of
the close-bearing event set is *verifiably wrong* (`:342` gates the roll close on `rec.replacement_contract`,
so a **replacement-less Roll writes `accept` + `ai_verdict:'Roll'` WITHOUT closing**). Seams →
OPEN_THREADS §7t; the **`split-decision-log` live bug** stays open in §B. *(original cull entry:)*
Not a harvest-and-cull discovery — a **canon review** the owner requested
("are any invariants not well conceived? what am I missing?"), which surfaced a structural gap the ordinary
GATE-I sources could not: **the project compounds BUILD wisdom (`DECISION_LEDGER.md`) and has NO loop for
TRADING wisdom.** Owner agreed on every point and directed all of it.

**The finding (ground-truthed in code + git, not impression):** `_opportunity_score(dist, ivhv, setups,
near_flip)` + a capped dark-pool bonus is the app's entire headline judgment — it drives the tier, the Prime
banner, and `DEFAULT_GATE_SCORE = 50` (the gate deciding when the AI may speak). It was last substantively
changed at `d3aeb4f` on **2026-06-22 — 210 commits ago**. Since then **eight** enrichment features shipped
(dex/vol-oi/skew/term · dealer-flow-projection · ai-context-pack · iv-rank · ATR) and **not one can reach
it** — every one was routed around the score into the LLM prompt. Sharpest instance: the score rewards vol
*extremity* via `abs(IV/HV − 1.0)`, so **rich and cheap premium score identically**, while `iv_rank.band`
(`premium_rich|premium_cheap`) — the metric we shipped *because* it "drives strategy selection" — sits in the
payload structurally unable to inform it. The weights (`40/25/25/10`, `8.0`/setup) and the gate threshold are
hand-tuned constants **never validated against a single outcome**. `additive-keeps-score-byte-identical` was
well-conceived for its job (stop *accidental* drift) but, lacking a counterpart, hardened into a **de-facto
freeze**.

**Canon changes made this review (see DECISION_LEDGER):**
1. **NEW `score-change-is-deliberate-and-measured`** (owner canon review) — the score MAY evolve, but only
   deliberately: explicit feature + stated rationale + **before/after on real tickers** + fingerprint-basis
   version bump. Never a side effect; never unmeasured. Fills the gap; does not weaken the additive rule.
2. **NEW severity promotion path** — recurrence is a *proxy* for importance and was mis-ranking: it had made
   a **dialog** constitutional law at 2 instances while `loss-free-durable-migration` waited at 1, guarding
   the user's entire trading history. A catastrophic+irreversible key now promotes at 1 (or 0 by owner
   decision). ⚠ Framework divergence logged — `ORCHESTRATOR.md` is a kit file; flows back via KIT_BACKLOG.
3. **PROMOTED `loss-free-durable-migration`** via that path (severity, 1 instance).
4. **NARROWED `single-shared-sim-entry-dialog` → SIM-ONLY** — un-narrowed it was on a collision course with
   `no-real-order-path`: the README literally said "the ONE shared **sim/live** entry surface", which would
   have pushed `broker-connect`'s real-money entry into the paper-trade dialog as an "additive variant".
   Real entry MUST be a separate component. README corrected; no code change (broker-connect is unbuilt —
   which is exactly why this was free to fix now).
5. **PROPOSED `ai-asserted-numbers-are-traceable`** (watch list, **0 instances — deliberately not promoted**;
   an aspirational rule is not canon).

**Decision impact (the cull):** passes strongly — it improves the meta-decision conditioning every other
decision (*which of our own signals deserve trust*), and it is the **only honest input** to (1) above: you
cannot improve a score you cannot measure. Feasibility **pass with 3 architect cruxes** (storage locus /
capture extension / small-sample honesty) — see the BRIEF; "by tier" is **retroactively analyzable on
existing data** (`DecisionRecord.tier` is already recorded), while by-score/setup/persona needs accumulation
(the iv-rank shape). Effort **L** · entry = **architect-first**.
**Displaces `scanner` a 6th time — deliberate + reversible:** scanner scales an unmeasured judgment across N
tickers; this measures whether it is worth scaling. `scanner` keeps its BRIEF + manifest, stays queued, **not
dropped**. Brief at `.spire/clusters/tech/contracts/outcome-ledger/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-07-06 (b) (owner pick: iv-rank; market-backdrop parked blocked-on plan upgrade)
**Chosen → `iv-rank` — ✓ SHIPPED + ARCHIVED (2026-07-07)** → `_archive/iv-rank/`. Full pipeline both lanes
(architect → PM → UX split → parallel lanes → GATE Q); QA PASS 19/19 (de-correlated Sonnet); conformance new
standalone spec `iv_rank.json` (live + offline); `nx test dashboard` 685/685. **GRADUATED
`digested-labels-not-raw-dump`** (2 binding: ai-context-pack + iv-rank's rich/cheap band); `model-read-carries-
its-assumptions` → 3rd instance. Established the project's **first persistent market-data store**
(`apps/api/src/marketdata/`: on-disk-SQLite default `IV_STORE=disk` + Postgres prod adapter behind the same
port). Score/tier/fp byte-identical (SPY 83/prime/`0e8884cc0a03`). Seams → OPEN_THREADS §7r. No GATE Z bounce
(clean first-pass builds). *(original cull entry:)* **Chosen → `iv-rank`** (IV Rank / IV Percentile) — owner
pick off the enrichment pool after `ai-context-pack` shipped. THE options metric the app lacks; drives **strategy selection** (rich→sell /
cheap→buy premium). Rides `market_state` as additive AI-context + a Ticker display, **never a scoring
input**. **The crux (architect-first):** the vendor provides **no historical IV**, so IV Rank's compelling
form is **blocked-on accumulation** — the feature must **accumulate a daily IV sample into a persistent
store** and rank over the accumulated window, with an honest "building history" state until enough days.
Architect must resolve: what IV to sample (existing `atm_iv` vs constant-maturity ~30d), the accumulation
mechanism (write-through-on-serve w/ a once-per-session guard vs a job; no backfill possible), the
**storage** (a NEW market-data time-series store/port — NOT the `src/auth/` leaf — with an in-memory/SQLite
default for local + Postgres for prod behind the same port; **dev box has no local Postgres**, so build+verify
on the non-Postgres default), and rank-vs-percentile + window + minimum-sample floor. Effort **M–L** ·
Value **H**. **Invariant watch:** `additive-keeps-score-byte-identical` (HARD), `best-effort-isolated-or-
null` (store outage / insufficient history → null/"building", never an HTTP error; writes best-effort),
`live-vs-static-isolation` (STATIC daily read), `theme-token-discipline`, **`model-read-carries-its-
assumptions`** (now promoted — the rank carries its window / sample-size / IV-basis visibly),
`digested-labels-not-raw-dump` (rich/cheap band = a digested label). First **persistent market-data** store
(distinct from the auth state store) — architect states its relation to the "stateless trading path"
narrowing. Entry = **architect-first**. Brief at `.spire/clusters/tech/contracts/iv-rank/BRIEF.md`; routing to the
Architect (GATE A·X).

**`market-backdrop` → PARKED, blocked-on a Massive plan upgrade (feasibility RESOLVED 2026-07-06).** The
GATE-I vendor probe found the account is **`NOT_AUTHORIZED` for ALL index data** (`I:VIX`/`I:VIX9D`/`I:VIX3M`/
`I:SPX`/`I:NDX` → "upgrade your plan"); equity ETF snapshots (SPY/QQQ) + options chains ARE in-tier. So the
CBOE-VIX-+-SPX form is blocked-on a plan upgrade. **Reshape available (owner-deferred, not chosen now):** a
SPY/QQQ ETF proxy + SPY options-derived ATM-IV level & IV term-structure regime (via the existing
`compute_term_structure`/`compute_iv_skew`) delivers the same "calm-contango vs stressed-backwardated tape"
read fully in-tier. Owner chose iv-rank first; market-backdrop stays queued (build the reshape, or wait for
the index-data plan upgrade to get the real VIX). Do NOT re-probe — the entitlement result is recorded here.

## Last GATE I — 2026-07-06 (owner pick: TI regime bundle + AI context-scalars pack, bundled)
**Chosen → `ai-context-pack` — ✓ SHIPPED + ARCHIVED (2026-07-06)** → `_archive/ai-context-pack/`. Full
pipeline both lanes; QA PASS 26/26 (de-correlated Sonnet); conformance new spec + 8-spec sweep; `nx test
dashboard` 658/658. GRADUATED `model-read-carries-its-assumptions` (2 binding); new watch-list
`digested-labels-not-raw-dump`. Both lanes were cut off by an API session limit before self-reporting →
conductor re-ran the gates + fixed 3 FE test-only defects (`?raw` idiom / 20→23 count / over-broad auth
regex) + cleaned a stale `libs/api/dist`. Latent seam → OPEN_THREADS §7q. *(original cull entry:)*
Owner-directed pick off the standing 2026-07-02 AI-enrichment pool
(no fresh harvest needed; the pool's cull verdicts stand). **Bundles the two parked S-effort items**
— the **AI context-scalars pack** (GEX shape scalars · flow-vs-positioning divergence · multi-horizon
ATR) + the **technical-indicator regime bundle** (EMA stack + ADX + RSI → DIGESTED regime labels) —
into one feature, exactly the "later AI context pack" fold the 2026-07-02 verdict anticipated. Same
shape throughout: derive from data already in hand (daily bars / the computed GEX profile / existing
flow+OI) → additive nullable `market_state` fields → AI state-export CONTEXT + Ticker display, never
a scoring input. *Decision improved:* entry/exit confluence (trend-vs-chop conditions the
mean-reversion read) + realistic ATR-based stop/target sizing + conviction on flow-vs-positioning
disagreement; observed when the AI rec cites regime/ATR/shape/divergence and the labels render on the
ticker page. Feasibility **pass** — one named architect constraint: daily-bar history is ~60d
(CONTEXT §4), so the EMA stack must fit the window or the daily-bars fetch extends (a parameter
decision, not a new vendor dependency). Effort **S–M** (bundled) · Value **M–H** combined.
**Invariant watch:** `additive-keeps-score-byte-identical` (HARD), `best-effort-isolated-or-null`,
`live-vs-static-isolation` (the divergence read must declare its flow basis),
`theme-token-discipline`, `model-read-carries-its-assumptions` (candidate), the binding
**digested-labels-not-raw-dump** design rule (SMALL orthogonal set, labels not raw values, OUT of the
score), `gamma-sourcing-split` NOT touched. ATR is also the enabler for the deferred distance-to-level
tiles (§B Ticker UX quick wins — stays out of scope here, seam only). Entry = **architect-first**.
Brief at `.spire/clusters/tech/contracts/ai-context-pack/BRIEF.md`; routing to the Architect (GATE A·X).
`iv-rank` / `market-backdrop` / `scanner` stay queued (displaced, not dropped).

## Last GATE I — 2026-07-02 (owner: enrich the downstream-AI's inputs — derived data, TIs)
**Chosen → `dealer-flow-projection`** (charm/vanna projected dealer hedging flow). Owner-directed
discovery off the "what other derived data helps the AI?" conversation. Harvest source =
**downstream-AI quality** (a first-class feature source). All candidates share one binding frame:
they enrich the AI's **state export + display as CONTEXT**, never a scoring input
(`additive-keeps-score-byte-identical`) — the AI is an advisory consumer of already-computed state.

**Scored pool (Value × Effort; explicit cull verdicts for later audit — the conductor holds both the
choose + route pens, so verdicts are written down):**
- **`dealer-flow-projection` (charm/vanna flow) — ✓ SHIPPED + ARCHIVED (2026-07-02, `ca6abae`).** Full
  pipeline both lanes; QA PASS 17/17 (Sonnet); folded in the BACKLOG §B determinism fix; render-pass catch
  fixed inline. Seams → OPEN_THREADS §7o. *(original cull entry:)* Turns the net charm + net vanna we
  ALREADY compute (currently display-only, CONTEXT §3) into a forward-looking, assumption-explicit
  "expected dealer hedging flow into the next OPEX / on a vol move" read. *Decision improved:*
  entry/exit TIMING + conviction around dealer-flow catalysts (OPEX charm bleed, vanna-on-vol) —
  distinct from the static GEX levels (where price is pulled); this is WHEN/WHY dealers push.
  *Observed:* the AI cites "charm flow supports drift into Friday's OPEX"; a projected-flow read shows
  on the ticker page. Value **H** · Effort **M** · data risk **low** (reuses computed greeks; no new
  vendor dependency). Most on-brand + lowest-risk of the pool → picked first.
- **`iv-rank` (IV Rank / IV Percentile) — QUEUED (runner-up).** THE options metric we lack; drives
  strategy selection (long vs short premium). Value **H** but the compelling 52-week form is
  **blocked-on IV-history**: we don't persist IV. Options — accumulate IV daily into the now-shipped
  Postgres store (rank improves over time), OR a weak 60d-window percentile now (likely re-done). A
  data-accumulation design, not a rush → sequenced right after / bundled with a small persistence step.
- **`market-backdrop` (SPY/QQQ + VIX level & term structure) — QUEUED, feasibility-gated.** Conditions
  EVERY read (calm-contango vs stressed-backwardated tape). Value **H** · Effort **S–M** · **blocked-on
  verifying Massive index/VIX coverage** (a vendor-capability check; one extra fetch if present).
- **AI context-scalars pack (GEX shape scalars · flow-vs-positioning divergence · multi-horizon ATR)
  — PARKED as a cheap bundle.** Each Value **M** · Effort **S**; ATR also unblocks the deferred
  distance-to-level tiles (an enabler, not a standalone). Fold into a later "AI context pack."
- **Volume profile (POC / value area) + CVD — PARKED.** Non-gamma horizontal S/R = independent
  confluence + an order-flow read from the tape we already consume. Value **M–H** · Effort **M–L**.
- **Technical-indicator regime bundle (EMA stack + ADX + RSI → DIGESTED labels) — PARKED (confluence
  tier).** Owner-framed correctly as confluence, not the edge. Value **M** · Effort **S** (all from
  bars we pull). Binding design rule if built: a SMALL orthogonal set, pre-digested into regime labels
  (not raw values), kept OUT of the score — else signal overload degrades the AI.
- **News / sentiment — PARKED (owner: future).** Slots in as another isolated one-way-leaf context
  stream, same "context not score" discipline; sentiment scoring likely a separate provider/classifier.

**Cull rationale (why `dealer-flow-projection` over the owner's co-favourite `iv-rank`):** both are
Value-H; charm/vanna is **buildable now, lowest data/math risk, reuses computation in hand, and is the
most differentiated** (no retail tool surfaces dealer charm/vanna flow) — while IV Rank's compelling
form is blocked on an IV-history strategy that deserves deliberate sequencing, not a rushed weak
version. So: charm/vanna first, IV Rank next (with the persistence step). **Invariant watch** (see the
BRIEF): `additive-keeps-score-byte-identical` (HARD — AI-context/display only), `best-effort-isolated-
or-null`, `live-vs-static-isolation`; **`gamma-sourcing-split` NOT touched** (a new derived read over
the analytic greeks we already run — does NOT reopen the walls/flip gamma source). Ties BACKLOG §B
"Engine higher-order-greek determinism" (elevating net_charm/net_vanna is the pull to fix the float
jitter). Entry = **architect-first**. Brief at `.spire/clusters/tech/contracts/dealer-flow-projection/BRIEF.md`;
routing to the Architect (GATE A·X). **Note:** `scanner` (the prior NEXT) is **displaced, not dropped**
— queued behind this owner redirect, as it was behind the 2026-06-25 ticker-load redirect.

## Last GATE I — 2026-07-01 (OWNER DIRECTIVE: 5-item product program)
Owner handed the conductor five sequenced items (screenshots of broken light-mode attached to the ask):
1. **`light-mode-parity`** — ✓ SHIPPED same session (`8abae03`, GATE V fast-path): mode-aware `extras`
   (`extrasFor(theme)`), ONE shared hatch, mode-aware ticker chrome; dark byte-identical; render-verified
   both modes; 486/486 + tsc/lint/build green.
2+3. **`sim-entry-unification`** — ✓ SHIPPED + ARCHIVED (2026-07-01, `d704193`) →
   `_archive/sim-entry-unification/`: one shared `app/trading/TradeEntryDialog` on both pages; old
   dialogs + `GhostTradePanel` deleted (zero-importer proven); `app/README.md` map. Conductor gates +
   render pass green. **GATE S graduated `single-shared-sim-entry-dialog`** (with item 4's variant).
4. **`ai-rec-backtest-orders`** — ✓ SHIPPED + ARCHIVED (2026-07-02, `5391517`) →
   `_archive/ai-rec-backtest-orders/`. Full pipeline, both lanes in parallel: the scripted scenario
   harness (`src/core/ai_scenarios.py`, 9-entry registry behind the `LLMProvider` seam,
   `AI_REC_SCENARIOS_ENABLED` default OFF, keyless + meter-bypassing, auth/readiness-gate real) +
   FE-local simulated orders (`convexa.orders.v1`, pure live-cross engine on the NBBO mid, Orders
   widget/panel on both pages, Act via the order variant of the shared dialog, rec→order→position
   provenance + decision records). Score/tier/fp byte-identical. QA PASS 48/48 (de-correlated Sonnet);
   +103 tests → 595. **SUBSUMED** the §B "AI-rec Accept → tracked position" item. One post-QA render
   catch fixed inline + guarded (keyless-deployment scenario run). Seams → OPEN_THREADS §7n.
5. **`scanner`** — **✓ SHIPPED + ARCHIVED (2026-07-26)** → `_archive/scanner/`. Full pipeline, both lanes,
   delivered as **4 sequenced phases each with its own execution contract + GATE Q** (P1 store `7269fa2` ·
   P2 worker `9d92fed` · P3 read API `eb478df` · P4 page `e094bd1`). **QA PASS all four (de-correlated
   Sonnet) — 13/13 ACs, 0 FAIL, 0 UNVERIFIABLE**; `nx test @convexa/dashboard` 645; e2e 15/15; conformance 2/2
   live. **GATE S formally NARROWED "single-ticker, on-demand"** (request path stays single-ticker; the
   sweep is the bounded off-request-path worker) — descriptive narrowing, not a demotion. **No new ledger
   graduations** (all 8 touched keys already canon); `structural-over-prose-enforcement` → 2 instances,
   held on the watch list. v1 ships **NO AI** (v2 seam). Seams → OPEN_THREADS §7v. *(original entry:)*
   Promotes the long-queued Track-A item
  <!-- atlas: theme=breadth horizon=now -->
   WITH the owner's expanded scope: durable custom watchlist, simplified per-ticker read (score/tier),
   AI-seeded watchlists, multiple views, ticker-page links, batch AI recs on all/selected. **Invariant
   watch:** revisits the locked "single-ticker, on-demand" decision — the architect must re-justify
   with a perf design (batch/throttle/cache; the ticker-load-experience chain-store + coalescing are
   the building blocks); AI batch respects the existing cooldown/cap + key-resolution.
   Brief at `.spire/clusters/tech/contracts/scanner/BRIEF.md`.

## Last GATE I — 2026-06-29 (infra program, step 2: persistent datastore)
**Chosen → `persistent-db`** (step 2 of the infra/deploy program). Swap the in-memory SQLite auth stores
for **persistent Postgres** behind the existing ports (`UserStore`/`SessionStore`/`UserSettingsStore`/
`UserCredentialStore`) so accounts/sessions/settings/encrypted-AI-keys **survive restarts + span replicas**
— the must-do-before-deploy step (the §4 "externalize your state" lesson). New adapter selected by the
existing env factory (`ACCOUNT_STORE=postgres` + `DATABASE_URL`); in-memory stays the local/test default.
Decision-impact cull **N/A** (deploy-readiness). Feasibility **pass to BUILD** — the ports + env-factory
already exist (provider pattern), so it's a contained adapter + schema/migrations; **runtime-verify needs a
Postgres instance** (dev box has none) → deferred like Docker. Effort **L** · entry = **architect-first**
(adapter shape raw-SQL-vs-ORM + async/sync, schema + migrations, pooling, the **DB-outage fail mode** — auth
fails closed, trader/bundle path stays up, the best-effort carve-out, ciphertext-only AI-key boundary).
**Invariant watch:** `additive-keeps-score-byte-identical` (storage-only, trading path untouched),
`best-effort-isolated-or-null` (DB outage degrades auth, not the anonymous bundle/SSE), `secret-encrypted-at-
rest` (ciphertext-only in the DB), `no-secrets-in-image` (`DATABASE_URL` via runtime env). No interface/UI/
scoring change. **Recommended target: Postgres** (deploy-ready; SQLite-file is a single-instance dead-end).
Brief at `.spire/clusters/tech/contracts/persistent-db/BRIEF.md`; routing to the Architect (GATE A·X). **Then:** `deploy`
→ Security/red-team (system-6) at go-live.

**HOST DECISION (owner, 2026-06-29) — scopes the `deploy` feature:** backend → **Railway** (container +
managed Postgres → `DATABASE_URL`; long-running/SSE; runtime env for all secrets); frontend → **Cloudflare
Pages** (static Vite build; generous/commercial-OK, no egress fees). This is a **SPLIT-host** deploy, so the
`deploy` feature must wire the **cross-origin `/api`**: the Cloudflare-served SPA calls the Railway backend
on a different origin → either **CORS** on FastAPI (allow the Pages origin) OR a **Cloudflare Pages proxy/
rewrite** of `/api/*` → the Railway URL (preferred — keeps same-origin + no CORS), plus the frontend build
needs the backend base URL (build-time env / rewrite). Note: the shipped `apps/dashboard/Dockerfile` +
nginx-proxy is now the **local-`docker compose` + optional single-host** path; for the Cloudflare path,
Pages builds the static output directly (the container isn't used). All deferred to the `deploy` feature.

## Last GATE I — 2026-06-29 (owner request: infrastructure — containerize, then deploy)
**Chosen → `containerize-apps`** (step 1 of the infra/deploy program) — owner-directed. Author Docker
artifacts: a `Dockerfile` for the FastAPI backend (non-root, env-injected config) + a multi-stage
`Dockerfile` for the dashboard (Nx/Vite build → static-serve) + a root `docker-compose.yml` (one-command
local full-stack) + `.dockerignore`s. Promotes the standing §B "Containerize each app" candidate. Decision-
impact cull **N/A** (deploy-readiness/infra). Feasibility **pass to AUTHOR** — **Docker is NOT installed
here**, so artifacts are written correct-by-construction + reviewed; runtime build-verify (`docker build`/
`compose up`) is **deferred to a Docker Desktop install** (owner). Effort **M** · entry = **architect-first,
GATE-M-style infra fast-path** (skip PM/UX, no interface change). **Invariant watch:** additive/no app
change; **image-hygiene floor** (no secrets baked — `.dockerignore` excludes `.env`/`.venv`/`token.txt`/
`node_modules`/`data/`; env at runtime; non-root). **Known follow-on:** in-memory state resets per container
→ the `persistent-db` swap is the NEXT feature; deploy + host-pick follow that. Brief at
`.spire/clusters/tech/contracts/containerize-apps/BRIEF.md`; routing to the Architect (GATE A·X).
**Program sequence:** `containerize-apps` → `persistent-db` (in-memory → managed Postgres behind the
existing store ports; set a stable `AI_KEY_ENCRYPTION_KEY`) → `deploy` (host pick: backend on Railway/Fly,
frontend on Cloudflare/Vercel, Postgres on Neon; CI/CD) → **activate Security/red-team (system-6)** at
go-live.

## Last GATE I — 2026-06-28 (owner request: hybrid bring-your-own AI key)
**Chosen → `byo-ai-key`** — owner-directed. **Hybrid** AI-key model: each signed-in user stores their own
Anthropic key (encrypted at rest) and the in-app AI rec calls with THEIR key; the shared `ANTHROPIC_API_KEY`
gives a free allowance **only to ADMIN users (3/day) — regular users get 0** (must BYO). Introduces a
**minimal admin concept** (no roles today) + **per-user metering** (today's cap is process-global) + **4
distinct gated states** (no-key-no-allowance / admin-with-uses-left / admin-exhausted / has-own-key).
Decision-impact cull **N/A** (enabler/cost-control — serve AI to many users without the owner bearing
per-user LLM cost). Feasibility **pass** (builds on the isolated `ai_recommendation.py` `LLMProvider` seam +
the shipped accounts system + a new encrypted `UserCredentialStore`; realizes the deferred BYO-key seam,
THREADS §7b). Effort **L** · entry = **architect-first** (per-request key-resolution seam, encryption-at-rest
seam + write-only/masked-reveal, admin mechanism, per-identity metering, the 4-state machine). **Invariant
watch:** `additive-keeps-score-byte-identical` (AI rec stays an isolated leaf), `best-effort-isolated-or-null`
(key/decrypt/LLM/over-limit failure → rec-surface-only `status`, never breaks bundle), `no-real-order-path`,
**security floor** (user keys ENCRYPTED not hashed — recoverable; server-side encryption key; never
logged/returned/in-browser; masked-reveal + rotate + delete), new `minimal-admin-not-RBAC`. **system-6
(Security/red-team) DEFERRED** by owner (encrypt+hygiene now); re-fires at the persistent/multi-user/public
trigger — BYO-key is its eventual first client. Brief at `.spire/clusters/tech/contracts/byo-ai-key/BRIEF.md`; routing to
the Architect (GATE A·X).

## Last GATE I — 2026-06-28 (owner request: complete the Convexa rebrand)
**Chosen → `rebrand-convexa`** — owner-directed. Extend the rebrand from **UI-only to the whole codebase**:
rename ~71 `gammaflow` refs (apps/api comments/log-prefixes/title, apps/dashboard, libs/api incl. the
`gammaflow.ts` client + identifiers, docs, CLAUDE.md/AGENTS.md) → Convexa/convexa, set `project.json`
`project_name`, rename the GitHub repo `gammaflow → convexa`, and **migrate the 4 durable localStorage keys**
(`gammaflow.{positions.v2,ghost-trade.v1,personas.v1,uiprefs.v1}`) → `convexa.*` **loss-free**. **REVERSES
the locked "Convexa = UI-only" decision** (app-shell-landing GATE S; CONTEXT §1/§5, THREADS §7d) — a
deliberate owner GATE-Z reversal, formalized in canon at this feature's GATE S. Decision-impact cull **N/A**
(brand/infra class). Feasibility **pass** (no package renames — scope is `@org/*`; repo rename = `gh repo
rename` w/ redirect; storage migration reuses the proven positions v1→v2 pattern; backend refs look
cosmetic/no-interface-change). Effort **M** · entry = **architect-first** (rename map, the loss-free
migration seam, NO_BACKEND_CHANGE confirmation, non-goals — local working-folder NOT renamed; archived
contracts/ledger keep historical "GammaFlow" as record). **Invariant watch:** `[loss-free durable
migration]` (HARD — no saved data lost), `additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`.
Brief at `.spire/clusters/tech/contracts/rebrand-convexa/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-06-25 (owner request: user accounts / login / sessions / settings)
**Chosen → `user-accounts`** — owner-directed (not a queue-drain cull): add **email/username+password
signup & login + "Continue with Google" (OAuth) + a persisted server-side session**, backed by an
**in-memory SQLite** credential/settings store (prototype — resets on restart; designed with a
persistent-DB swap seam). Store **per-user settings — basics + light prefs only** (active persona /
default ticker / theme). **Hybrid access model (owner clarification):** the app stays usable
anonymously for browsing (Landing / Ticker-GEX viewer / Scanner stub), but **the sim Positions tracker
+ the in-app AI-rec "ask AI" call require a signed-in session.** Passwords **hashed (bcrypt/argon2),
never plaintext/never logged**; Google client secret + session key **server-side only** (env, like
`ANTHROPIC_API_KEY`). Decision-impact cull: **N/A** (enabler/infra class — judged on product value:
unlocks per-user persistence + gating + the **Track B `broker-connect` prerequisite**). Feasibility:
**pass**, config-gated for Google (needs a Google Cloud OAuth client; new backend deps → `requirements.txt`
+ `.venv`). Effort **L** · entry = **architect-first** (session mechanism, in-memory-SQLite + swap seam,
OAuth Authorization-Code flow, auth↔bundle isolation + auth's own real-HTTP-error class, per-user settings
store, the gated-surface enforcement boundary). **Invariant watch:** `additive-keeps-score-byte-identical`
(auth never touches scoring/SSE; no setting is a scoring input), `best-effort-isolated-or-null` (CARVE-OUT:
bundle path stays best-effort/None; **auth endpoints legitimately return 401/403/409** — the null-not-error
rule governs added *bundle computations*, not an auth surface), `no-real-order-path` (HONORED — accounts add
no broker/order path; Positions stays `SIMULATED`), `operator-vs-trader-path-separation` (kinship: auth must
not gate/perturb the anonymous trader path). **NEW note:** first stateful backend surface + first credential
store → narrows the "stateless server" property to the *trading path*; likely a GATE S ledger note, not a
GATE Z reversal. **Security:** red-team (**system-6**) DEFERRED by owner (in-memory = pre-live); re-activates
on real persistence / public exposure — the hygiene floor above is mandatory regardless. Brief at
`.spire/clusters/tech/contracts/user-accounts/BRIEF.md`; routing to the Architect (GATE A·X). *(Note: `scanner` +
`gamma-unification` stay queued behind this owner redirect — not dropped.)*

## Last GATE I — 2026-06-25 (owner request: ticker-page load UX + latency; gamma question raised)
**Chosen → `ticker-load-experience`** — owner-directed redirect (displaces `scanner` as the next Track-A
item; scanner stays queued, not dropped). Make `/ticker/:symbol` load fast + feel instant + show a trusted
price. Three additive moves: (1) **skeleton-first load** (replace the single full-page spinner —
`TickerDashboard.tsx:497,512` — with per-component skeletons that render independently); (2) **latency**
— parallelize the 3–4 **sequential** vendor fetches (`main.py:261-267` + `off_exchange`; vendor I/O is the
dominant cold-miss cost) + trim on-path `persist`, measured against `/_ops/metrics` p50/p95; (3) **live
last-trade** readout alongside the mid (surface `live.py:160`'s already-tracked `last_trade_price`, never
broadcast today) + reflect the **real-time options tier** in freshness/cache config. Decision-impact cull:
passes (speed + trust of the primary surface; observable via TTFMP + a measured `vendor_fetch` drop + a
visible broker-matching last-trade). Feasibility pass (skeletons = MUI; parallelize = `asyncio.gather` over
existing `to_thread`; last-trade = surface one field; config = env — magnitude needs a live key, the
architecture doesn't). Effort M · entry = **architect-first** (skeleton-vs-split [split is a trap w/o
request-coalescing — `_serve` has no in-flight dedup], fetch-parallelization shape, last-trade as a
display-only sibling of the mid). **Invariant watch:** `additive-keeps-score-byte-identical`,
`best-effort-isolated-or-null`, `live-vs-static-isolation`; **`live-spot=NBBO-mid` HONORED** (last-trade is
additive display — mid stays the levels anchor; carve-out, not a reversal); **`gamma-sourcing-split` NOT
touched** (→ Track 2). Brief at `.spire/clusters/tech/contracts/ticker-load-experience/BRIEF.md`; routing to the
Architect (GATE A·X).

**New parked track → `gamma-unification` (measure-first; see §C below).** Owner asked: with the advanced
real-time tier + full chain, compute our OWN analytic gamma for the walls so they're consistent with the
flip. Finding: the engine **already** computes analytic BS gamma (`engine.py:_calc_gamma`/`_gex_curve`) for
the flip + vanna/charm/volga; only the walls/net-GEX use **vendor** gamma (`engine.py:316`). Unifying =
point the walls at the math we already run. **Owner decision (2026-06-25): MEASURE FIRST** — spike that
computes analytic gamma alongside vendor gamma and quantifies wall/flip divergence on real tickers, BEFORE
any canon change. Honors the standing "measure the divergence before calibrating" rule (§9). Only after the
numbers: a GATE Z reopen/demotion of the locked **`gamma-sourcing-split`** rule, then a GATE M
implementation. Not bundled into `ticker-load-experience` (different risk class — core math).

## Last GATE I — 2026-06-24 (OWNER PIVOT: positions-centric, brokerage-connected, multi-page) — PROGRAM
**Strategic repositioning.** GammaFlow shifts from a single-ticker GEX dashboard into a **multi-page
product**: connect your brokerage positions → get **AI recommendations** built on the GEX profile +
heuristics we compute per ticker. Surfaces: a **landing/splash** page (brand/hooks), a **Ticker viewer**
(today's GEX dashboard, relocated), a **Scanner** (multi-ticker), and a **Positions** page (the shipped
sim portfolio, expanded, + AI-recs-on-positions + open-sim-trade), eventually fed by **real broker
positions**.

**Owner decisions (this GATE I):**
1. **Order boundary — narrowed, not full.** Connect a broker to **read real positions** (+ AI recs on
   them); **trades stay simulated — no real order execution.** This **narrows the promoted
   `no-real-order-path` canon** to "no real order *execution*" (reading real positions is now permitted).
   *Pending formal demotion at the broker feature's GATE S* (precedent: `ai-external-no-llm`); Track A does
   NOT exercise it (stays fully simulated/sim-only).
2. **Broker integration — direct per-broker, Webull first** (not an aggregator). Feasibility-gated:
   Webull third-party positions access is uncertain/region-gated → the broker feature is **blocked-on**
   verifying Webull API access; design a **`PositionsProvider` port** (mirroring the market-data provider
   port) so the broker is a contained adapter.
3. **Sequence — Track A first.**

**Security / going-live (system-6 activation):** connecting a real account is the **"going live" trigger**
the roadmap waited for → re-promote the deferred **Security/red-team role (system-6)** + first-class
credential handling when **Track B** starts. Track A (no real account) does not trigger it.

**Decomposition (groom + run ONE at a time through the pipeline):**
- **Track A — buildable now, NO broker, mostly FE:**
  - `app-shell-landing` ← **CHOSEN FIRST**: multi-page routing shell + nav/layout + **landing/splash**
    page; relocate the existing GEX dashboard → `/ticker` and the positions portfolio → `/positions`
    unchanged; `/scanner` nav stub. FE-only restructure + one new page; reuses every shipped feature.
  - `scanner`: multi-ticker scan page. **Invariant watch:** revisits the locked "single-ticker,
    on-demand" decision (the watchlist scan was dropped for being too slow) — must re-justify + design for
    perf (batch/throttle/cache). Promotes the parked §D multi-ticker-scanner item.
  - `positions-page-expansion`: expand the sim portfolio into the full Positions page + **AI recs on
    positions** (reuse `ai-recommendations` + the deferred position-aware `reassessment_prompt` seam) +
    open-sim-trade.
- **Track B — gated on decisions 2 + security:**
  - `broker-connect`: Webull-direct, **read-only** real positions via the `PositionsProvider` port; lands
    in the shipped positions "Live" tab seam; triggers the `no-real-order-path` narrowing + system-6.

Brief for the chosen first feature at `.spire/clusters/tech/contracts/app-shell-landing/BRIEF.md`; routing to the
Architect (GATE A·X).

## Last GATE I — 2026-06-24 (owner request: positions portfolio)
**Chosen → `positions-portfolio`** — owner-directed: evolve the shipped ghost-trade tracker from a single
open sim position into a **multi-position portfolio** — a central all-positions view + per-ticker filtered
view, each position tracking its own P/L **and the change in it**, modern/organized/customizable
(columns/sort/filter, grouping, layout+density, durable saved views). Two view tabs: **Simulated**
(functional paper-sim) and **Live** (a present-but-**LOCKED** real-broker placeholder — no broker, no
order path, reflected in the UI but not implemented). Options contracts; the simulator fills at a
user-input price OR via market/limit on the live price. Decision-impact cull: passes (improves
hold/trim/exit position management). Feasibility pass (reuses mark/store/`TradeEntryDialog`/`GET
/api/contract`; Live is a stub ⇒ no vendor dependency). Effort L · entry = architect-first. **Invariant
watch:** `no-real-order-path` HONORED (Live is non-functional, no order path), `additive-keeps-score-
byte-identical`, `best-effort-isolated-or-null`, `live-vs-static-isolation`. Brief at
`.spire/clusters/tech/contracts/positions-portfolio/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-06-23 (owner request: in-app AI recommendations)
**Chosen → `ai-recommendations`** — owner-directed (not a queue-drain cull): an in-app query to a
downstream LLM (latest Claude) for a **risk-first ENTRY recommendation**, fed the active persona's
assembled prompt + a **JSON export of the ticker's computed state**, rendered in the dashboard; the
manual hand-off is retained + augmented by the same JSON export; on-demand with `ai_eval` guardrails.
**Reverses promoted canon `ai-external-no-llm` by explicit owner decision** (GammaFlow may now call an
LLM via an isolated, gated, consumer-only path) → pending formal demotion at GATE S. Trading-decision
cull: passes (improves the entry decision). Effort L · entry = architect-first. Brief at
`.spire/clusters/tech/contracts/ai-recommendations/BRIEF.md`; routed to the Architect (GATE A·X).

## Last GATE I — 2026-06-23 (pull: local latency visualization)
**Chosen → `latency-visualizer`** — carve the *visualization* slice out of §D "Observability
extensions," pulled by a concrete need (watch the already-measured bundle-stage latency locally +
free, pre-live). Brief at `.spire/clusters/tech/contracts/latency-visualizer/BRIEF.md`; entry = architect-first
(stateless-client vs persisted-history is the pivotal call). Trading-decision cull N/A (operator
tooling — judged on operational value). The export/alerting/persistence rest of §D stays parked.

## Last GATE I — 2026-06-22 (pipeline had drained; 4 features archived)
**Chosen → `trader-personas`** (the only candidate clearing both decision-impact + feasibility;
Value H × Effort M). Brief at `.spire/clusters/tech/contracts/trader-personas/BRIEF.md`; entry = architect-first.
Cull verdicts (so the next discovery doesn't re-litigate):
- **Parked, cleanliness/no observed friction:** flip-anchoring (user confirmed flip is fine),
  wall-distance guard (hasn't shown up live).
- **Blocked-on a decision/measurement (not a build):** vendor/overnight (cost-eval decision first),
  flip fixed-IV modeling (measure the divergence first).
- **Parked, scope/justification:** ghost-trade→real path (scope shift off paper-sim), multi-session
  dark-pool (dark-pool is locked context-only, never directional — §8), observability extensions
  (operator-facing, not a trading decision), multi-ticker scanner (revisits the single-ticker
  decision; needs re-justification).

## Pool

### A. Queued / in-mind (decided to build next)
> **⏭ SUPERSEDED AS THE STANDING NEXT-BUILD ORDER — harvest 2026-08-28.**
> The 2026-08-01 roadmap (`docs/ROADMAP_2026-08.md`) still records the *strategy*
> (edge first, business later). Its **build queue**
> `index-first-defaults → broker-connect (SnapTrade) → vol-normalized-gex → alerts → ledger
> checkpoint` has largely **shipped in code** (broker v1 is Webull-direct, not SnapTrade;
> X2 and X3 are in production). Live programs after `capacity-baseline`: keep-paid-books #5
> wait (reliable clock 2026-08-26) · production-maturity #6 `remote-archive-body-store` ·
> harvest items in the 2026-08-28 table above. Ledger checkpoint X4 still blocked on N≥20
> closed outcomes (habit N2). Items below remain in the pool as provenance, not as the next
> `go` default.
- **✓ SHIPPED 2026-08-10 — `signed-out-refused-affordances`** (IMPROVEMENT_BACKLOG 5.1;
  `shared/ui/Refused` on signed-out write CTAs). The L4-displacement row below is provenance only.
  *(original entry:)* **DISPLACED to L4 (was ⏭ NEXT) — `signed-out-refused-affordances`** (owner-directed 2026-07-28, straight off the
  `positions-legs` manual-verification recon). **Small, FE-only, GATE-V shaped.**
  **The defect:** on `/positions` while signed out, `+ Open simulated position` renders as a **normal,
  fully-enabled CTA** — not greyed, focusable, no tooltip. Clicking it calls
  `PortfolioPanel.tsx:59 requestOpenEntry()` → `gate.prompt(AUTH_COPY.positions.gateTrack)`, whose text is
  **already permanently on screen** in the `positions-signin-prompt` banner (measured: banner top 227 ×
  1192 wide; CTA top 450, far right; **page-text diff across the click = 0 characters**). So the handler is
  not empty — it re-asserts a message you are already reading, and the click is a **visual no-op**.
  **Why it matters:** it is the same failure class `positions-legs` just closed one level over — a control
  that **looks usable, accepts the click, then declines silently**, which SPEC §2.9's *"visibly refused
  rather than accepting input and failing after the fact"* exists to prevent. The faulted store now obeys
  that rule; this signed-out path predates it and does not.
  **Proposed fix (small):** route the CTA through the **`Refused` primitive `positions-legs` already
  built** (the shared wrapper all eight refused controls use) — reduced-emphasis token treatment while
  signed out, `aria-disabled` **and still focusable**, tooltip carrying the reason; the existing **Sign in**
  button in the banner stays the real path forward. One call site, no new component, no new copy pattern.
  **Decision impact:** a trader who cannot tell a refused control from a live one mis-reads the app's state
  at the exact moment it is refusing to record something — observable as: signed out, the control now looks
  refused **before** the click, and the reason is reachable by hover **and** keyboard.
  **Do NOT touch the server-side gate.** `handleConfirm` must keep awaiting
  `POST /api/positions/sim-trade/gate` before any local write — that is `[server-side-gate-enforcement]`
  canon. This item is purely about the affordance being honest before it is touched.
  **Invariant watch:** `theme-token-discipline` (tokens only, dark/light parity) ·
  `server-side-gate-enforcement` (unchanged) · the `aria-disabled`-not-`disabled` rule (an HTML `disabled`
  button swallows pointer events, making the tooltip unreachable — the exact defect GATE Q caught).
  **Sweep the other gated CTAs while in there** — the same pattern likely affects every signed-out write
  affordance, not just this one. **Source:** `docs/VERIFY_POSITIONS_LEGS.md` §0.3.
- **Dashboard folder restructure + Cypress swap + kit sync** — `✓ SHIPPED (2026-07-16, on main)`.
  **Owner-directed maintenance, NOT a conductor pipeline feature** (no BRIEF / no contracts / no GATE Q —
  logged here for provenance because it moved canon-relevant structure). Three parts:
  (1) **Cypress replaces Playwright** (`e38328e`) — `@nx/cypress/plugin` in `nx.json` (same `e2e` target
  name), `apps/dashboard-e2e/cypress.config.ts` auto-serves `@convexa/dashboard`, smoke ported to
  `src/e2e/app-loads.cy.ts`; Playwright deps/config removed. Component/integration testing stays Vitest.
  (2) **Dashboard folder restructure** (7 commits `e5ce5fb`→`b194bdc`) — `src/app/` reorganized by KIND into
  `pages/` · `features/` · `shared/` · `shell/` + folder-per-widget, `@/*` alias; `apps/dashboard/src/app/
  README.md` is the authoritative map; PROJECT_CONTEXT §2 updated to match (2026-07-16).
  Presentation-only — score/tier/`state_fingerprint` untouched, **674/674 green on `main`**.
  (3) **Delivery-kit sync** — the risk-based QA rule mirrored into `C:/Dev/delivery-kit` via `extract.mjs`
  (kit_lint clean), released **v0.3.2** (`d661250`), pushed to `origin/master`.
  Decision-impact cull **N/A** (build-system / maintainability class). Deferrals it left → §B
  ("Restructure deferrals", "Dead-code sweep", "Test-migration").
- **`deploy`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/deploy/` (artifacts + hardening; the live
  deploy is owner-applied via the runbook). Step 3 of the infra program. Backend → Railway (Dockerfile +
  managed Postgres), frontend → Cloudflare Pages, cross-origin `/api` via a streaming Pages Function. Repo
  R1–R4 (`$PORT` CMD, env-gated CORS, the Pages Function, `/api/_metrics` edge-block). **system-6
  Security/red-team FIRST ACTIVATION** (different model) = GO-WITH-REQUIRED-FIXES → **3 HIGH closed**
  (metrics token-gate `METRICS_SECRET_TOKEN`; per-IP rate-limit `PUBLIC_RATE_LIMIT_PER_MIN` on the anon
  ticker/SSE endpoints; stable-key startup WARNING); 3 MED + 3 LOW fast-follows in `SECURITY_REVIEW.md`.
  No scoring change. **GATE S graduated `no-secrets-in-image`** (3 binding). **✅ LIVE 2026-06-29:**
  https://convexa.pages.dev (Cloudflare Pages) → Pages Function proxy → https://convexa-production.up.railway.app
  (Railway, app on `$PORT`=8080) + managed Postgres; smoke test PASS (SPA 200, proxied `/api` returns real
  backend JSON). Post-launch hardening pending: `ALLOWED_ORIGINS`, the 6 MED/LOW security fast-follows, CI/CD,
  custom domain, prerender/SEO.
  Seams → OPEN_THREADS §7k. **Fast-follows queued (§B):** the 6 MED/LOW security items; a CI/CD workflow; a
  custom domain; centralizing the per-replica metering counters.
- **`persistent-db`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/persistent-db/`. Step 2 of the
  infra program (backend infra fast-path). Added a **persistent Postgres adapter** (`src/auth/postgres_store.py`,
  psycopg3 sync raw-SQL behind the existing 4 auth ports; pool; idempotent bootstrap; ciphertext-only) selected
  by `ACCOUNT_STORE=postgres`+`DATABASE_URL` (**in-memory stays default**); `service.py`/`router.py` settings
  fail-closed hardening; deps `psycopg[binary]`+`psycopg-pool`; `.env.example` stable-key block. So
  accounts/sessions/settings/encrypted-AI-keys **survive restarts + span replicas** (the externalize-state
  step). DB-outage = auth fails closed (503/anon), trader path stays up. **No interface/UI/scoring change**
  (in-memory conformance PASS, no regression). **Live-Postgres verify DEFERRED** (no Postgres in dev box) —
  verified by parity review + the in-memory regression proof. **GATE S graduated `secret-encrypted-at-rest`**
  (2 binding); `no-secrets-in-image` held to `deploy`. Deferred seam: per-admin metering counters are
  process-local (not shared across replicas). Seams → OPEN_THREADS §7j. **Next:** `deploy`.
- **`containerize-apps`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/containerize-apps/`. Step 1 of
  the infra/deploy program (GATE-M-style infra fast-path; PM/UX skipped). Authored 7 Docker artifacts:
  `apps/api/Dockerfile` (python:3.12-slim, non-root uid 10001, explicit COPYs, socket healthcheck, uvicorn
  0.0.0.0 no-reload), `apps/dashboard/Dockerfile` (multi-stage: `nx build @convexa/dashboard` at repo-root
  context → unprivileged nginx serving `dist` + SSE-safe `/api` proxy), `nginx.conf`, root + `apps/api`
  `.dockerignore`, root `docker-compose.yml` (one-command local stack, runtime env_file, stateless documented),
  `apps/api/.env.example` (value-less; gitignore negation `!apps/api/.env.example` added to track it).
  **No app code / requirements changed.** **Image-hygiene floor verified** (no secrets baked — conductor
  static review PASS). **Docker NOT installed here** → runtime build-verify (`docker compose up --build`)
  **deferred to a Docker Desktop install** (owner). New ledger watch-list key `no-secrets-in-image`. Seams →
  OPEN_THREADS §7i. **Next:** `persistent-db` (in-memory → managed Postgres; stable `AI_KEY_ENCRYPTION_KEY`)
  → `deploy` → system-6.
- **`byo-ai-key`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/byo-ai-key/`. Hybrid per-user AI key:
  each user stores their own Anthropic key (encrypted, Fernet, write-only/masked) and the AI rec calls with
  THEIR key (own-key-first); the shared key gives admins only a free allowance (`AI_REC_ADMIN_EMAILS`,
  default 3/day); regular users 0 → must BYO. 5 resolution states incl. `shared_key_unconfigured`. New
  `UserCredentialStore` + `src/auth/crypto.py`; per-request resolution at the `main.py` boundary; AI rec
  stays an isolated leaf (score byte-identical). QA PASS (Sonnet, de-correlated; AC-19 named-test gap caught
  & fixed → re-run 26/26; security floor clean; dashboard 313/313 + `@convexa/api` 13/13). **GATE S graduated
  `server-side-gate-enforcement`** (2 binding) into canon; new watch-list key `secret-encrypted-at-rest`.
  Realizes the deferred ai-rec BYO-key seam. `system-6` still deferred (credential custody → its eventual
  first client). Seams → OPEN_THREADS §7h.
- **`rebrand-convexa`** — `✓ SHIPPED + ARCHIVED (2026-06-28)` → `_archive/rebrand-convexa/`. Completed the
  GammaFlow→Convexa rebrand from UI-only to the whole codebase (134 refs / 51 files): identifiers, the
  `gammaflow.ts`→`convexa.ts` client, backend logger/title, docs/README/CLAUDE.md, `project.json`, the
  GitHub repo (`gammaflow`→`convexa`), and a **loss-free migration of the 4 durable localStorage keys**
  `gammaflow.*`→`convexa.*` (reusable `resolveDurable` helper composing with the positions v1→v2 chain).
  **REVERSED the app-shell-landing "UI-only" decision** (updated in place, not a Promoted-canon demotion).
  Cosmetic to the engine — score/`state_fingerprint` byte-identical. QA PASS (Sonnet, de-correlated —
  23/23 ACs; dashboard 283/283 + `@convexa/api` 7/7). New watch-list key `loss-free-durable-migration`. STAYS:
  `@org/*` scope, `DATA_DIR`, local folder, archived history. Seams → OPEN_THREADS §7g.
- **`user-accounts`** — `✓ SHIPPED + ARCHIVED (2026-06-25)` → `_archive/user-accounts/`. Both lanes: the
  project's first stateful backend surface — email/username+password auth + server-side sessions + per-user
  light prefs (active persona / default ticker / theme) over in-memory SQLite behind a 3-port swap seam
  (`src/auth/` one-way leaf; resets on restart); **Google OAuth wired but config-gated OFF** (enable via env,
  no rebuild); **hybrid access** (anonymous browsing open; sim Positions WRITE actions + "ask AI" require a
  session, server-enforced). Additive — score/tier/`state_fingerprint` byte-identical. QA PASS (Sonnet,
  de-correlated; AC-E7 server-gate FAIL bounced+fixed → GATE Q re-run 30/30, conformance 2/2, `dashboard`
  246/246 + `@convexa/api` 7/7). GATE S: narrowed the "stateless server" property to the trading path; new
  watch-list key `server-side-gate-enforcement`. Seams → OPEN_THREADS §7f. **Unblocks Track B
  `broker-connect`** (the accounts prerequisite is now met; broker-connect stays gated on the Webull-access
  verification + the system-6 go-live trigger).
- **`ticker-load-experience`** — `✓ SHIPPED + ARCHIVED (2026-06-25)` → `_archive/ticker-load-experience/`.
  Both lanes (commit `10971f3`): chain pre-warm (cold 7.8s→1.2s on an active session) + 3-fetch concurrency
  + request-coalescing + skeleton-first load + live `last_trade` readout + real-time freshness config.
  Additive — score/tier/`state_fingerprint` byte-identical. QA PASS (Sonnet, de-correlated — 26/26 ACs,
  conformance 2/2, 196/196 tests). **GATE S narrowed** the `live-spot=NBBO-mid` resolved decision (system-7:
  mid stays the anchor; display-only last-trade readout added). Seams → OPEN_THREADS §7e.
- **OWNER PIVOT program (positions-centric, multi-page):** Track A = `app-shell-landing` ✓ SHIPPED →
  `scanner` (still queued, was-next; deferred behind the owner's 2026-06-25 ticker-load redirect) →
  `positions-page-expansion`; Track B (gated) = `broker-connect`. See the "Last GATE I — OWNER PIVOT" note.
- **app-shell-landing** — `✓ SHIPPED + ARCHIVED (2026-06-24)` → `_archive/app-shell-landing/`. FE-only
  rebrand → **Convexa** (UI-only) + multi-page IA: `/` landing, `AppShell` nav, relocated `/ticker/:symbol`
  + `/positions`, static `/scanner` stub. Page-scoped SSE; store persists across nav; `NO_BACKEND_CHANGE`.
  Frontend `e8f8c06`; QA PASS (Sonnet, de-correlated — 42/42 ACs, 171 tests, no regression). GATE Z
  (wording) resolved as a carve-out. Feature 1 of the pivot. Seams → OPEN_THREADS §7d.
- **positions-portfolio** — `✓ SHIPPED + ARCHIVED (2026-06-24)` → `_archive/positions-portfolio/`. FE-only
  (`NO_BACKEND_CHANGE`) multi-position evolution of the ghost-trade tracker: central all-positions +
  per-ticker views, per-position P/L + Δ + trend sparkline, grouping + subtotals, customization + durable
  saved views, closed/history; entry simulator with manual/market/limit fills (resting limit fills only on
  a live cross); **Simulated** functional + **Live** zero-import LOCKED placeholder. Frontend `f7334e2`;
  QA PASS (Sonnet, de-correlated — 41/41 ACs, 130 tests). **GATE S graduated `no-real-order-path`** into
  canon (2 binding). Seams → OPEN_THREADS §7c.
- **ai-recommendations** — `✓ SHIPPED + ARCHIVED (2026-06-23)` → `_archive/ai-recommendations/`. In-app
  downstream-LLM query for a risk-first **entry** rec (active-persona prompt + JSON state export →
  rendered rec; Accept → paper-sim ghost trade; manual export floor). GammaFlow's first LLM call —
  isolated/gated/advisory consumer; score byte-identical. **DEMOTED `ai-external-no-llm`** (system-7,
  narrowed). Backend `eec3a3a`; frontend `42212f5`+`a2f6ae3`. QA PASS (Sonnet, de-correlated; E3 traceability
  catch resolved). Seams → OPEN_THREADS §7b. GATE Z reconciled the conformance-spec convention → system-12.
- **latency-visualizer** — `✓ SHIPPED + ARCHIVED (2026-06-23)` → `_archive/latency-visualizer/`.
  FE-only (`NO_BACKEND_CHANGE`): a local, ephemeral `LatencyTrend` card atop `/_ops/metrics` that
  trends the existing `GET /api/_metrics` windowed snapshots (per-stage/total/cache/vendor-latency
  p50/p95/max + headroom) via one stable poll loop (the page's single fetcher) + a bounded in-browser
  ring buffer; honest gaps / restart-break / stale-repeat, non-alerting, local Export only. Held
  `[operator-vs-trader-path-separation]` + `[best-effort-isolated-or-null]` (both logged at GATE S).
  **Parked (rest of §D):** OTel/Prometheus export, latency/headroom alert thresholds, persisted/
  cross-restart history, server-side store.
- **trader-personas** — `✓ SHIPPED + ARCHIVED (2026-06-22)` → `_archive/trader-personas/`. Both lanes
  landed (backend `1026190`; frontend `6dcdbe1`/`1233718`); persona reframes the AI hand-off only,
  gate/score/tier/fingerprint byte-identical, FE-rendered assembly. Seams it left → section D.
  (`OPEN_THREADS` §7)

### B. Ready candidates (feasible, small, unscheduled)
- **`archive-coverage-guardrails` — expected/present/missing session books as operator truth** —
  **→ SHIPPED + ARCHIVED 2026-08-29** (`_archive/archive-coverage-guardrails/`). GATE Q 54/0/0.
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `NEW 2026-08-28 (deep-research harvest)`. Specified by `docs/research/ARCHIVE_COVERAGE_AUDIT_2026-08-26.md`.
  Read-only coverage matrix + one structured warning per symbol/session after 16:00 ET + a local
  audit command that exits non-zero on a due SPY/QQQ/IWM hole. No trader UI, no paid monitor.
  Decision-impact: you notice a lost paid day **the day it is lost**, not three days later when
  prune has already eaten the ring. *Value H · Effort S–M.*
- **`massive-flat-file-keep` — download the S3 files the $199+$199 already include** —
  **→ SHIPPED + ARCHIVED 2026-08-31** (`_archive/massive-flat-file-keep/`). GATE Q 61/0/0.
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `NEW 2026-08-28`. Stocks and Options Advanced include unlimited file downloads (trades / quotes /
  aggregates; next-day ~11:00 ET). We currently keep REST snapshots and throw the tape. Flat files
  reconstruct **price/quote history**, not snapshot greeks/IV/OI (chain snapshot Plan History =
  not applicable). Store provenance-labeled, never insert as `live_massive`. *Value H · Effort M.*
- **`session-day-tape-capture` — a replayable open-to-close tape for a closed watchlist** —
  **→ SHIPPED + ARCHIVED 2026-08-30** (`_archive/session-day-tape-capture/`). GATE Q 66/0/0.
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `NEW 2026-08-28`. Path-A SSE ticks currently hit the price cache and die. Path-B warmer is
  excluded from snapshot capture. Session books are first-wins, often midnight-ET start-of-day
  (QQQ/IWM 24–26 Aug had **0 trades**). Owner-named: if Massive is cancelled, replay a collected
  day as if live. Distinct from the 48-slot ring (intraday reprints) and from `batch-backtest`.
  *Value H · Effort M.* Depends on a bounded watchlist, not the whole universe.
- **`day-replay-mock-adapter` — Fixture port + SSE hub that plays a captured day into the UI** —
  **→ SHIPPED + ARCHIVED 2026-08-30** (`_archive/day-replay-mock-adapter/`). GATE Q 47/0/0.
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `NEW 2026-08-28`. `MarketDataPort::Fixture` already resolves a frozen `VendorBundle` at `as_of`.
  That is snapshot replay, not a clock. This item emits price ticks (and periodic structure
  snapshots) through the **same SSE contract** the ticker page already consumes, at original
  timestamps or a speed multiplier. Frontend should not grow a second live path.
  *Value H · Effort M.* Tape **SHIPPED 2026-08-30**; this clock **SHIPPED 2026-08-30**. Distinct
  from S3 reconstruction. Do not insert tape as `live_massive`.
- **`research-lab-surface` — make the corpus visible instead of CLI-only** —
  **→ SHIPPED + ARCHIVED 2026-08-31** (`_archive/research-lab-surface/`). GATE Q 53/0/0.
  <!-- atlas: theme=trust-the-signal horizon=now -->
  `NEW 2026-08-28`. `/api/_research/*` is 404 from Pages by design. The trader cannot see the
  $398 of books, the score-lab, or a replay. A first slice can be operator-gated (same pattern
  as `/_ops/metrics`). Decision-impact: you use the lab weekly instead of once per research
  binge. *Value M–H · Effort M.* Do not expose raw vendor payloads on the public origin.
- **`grounded-morning-snapshot` — cited AI briefing from data already on the board** —
  <!-- atlas: theme=trust-the-signal horizon=now -->
  `NEW 2026-08-28`. Scanner + event calendar + GEX walls/flip/vol-norm already exist. SpotGamma's
  retained value is the **written morning note**. Viral-adjacent if posted (habit N4 still owner-
  deferred). Every figure must trace (`ai-asserted-numbers-are-traceable`). No Benzinga, no
  indices add-on, no "AI says buy". *Value M · Effort M.* Sequence after the corpus is visible
  — **that gate opened 2026-08-31** (`research-lab-surface` SHIPPED). Unnamed-`go` default
  at Harvest 2026-08-31.
- **`research-lab-sibling-reads` — partitioned tape / snapshots / extracts on `/_ops/research`** —
  <!-- atlas: theme=trust-the-signal horizon=now -->
  `NEW 2026-08-31 (post-lab harvest)`. Live HTTP already has session-day-tape, chain-snapshots,
  and flat-files list/load. The page consumes books+coverage only. Council admits sibling
  **partitioned** cards (closed decks; never mint `present` from `kept` / tape). Not a unified
  status column. Not `/lab`. Pages 404 stands. Do not bundle with morning-note or replay-arm.
  *Value M–H · Effort M.*
- **`ops-metrics-sitting-origin` — Operator Metrics uses the same sitting API origin as research** —
  <!-- atlas: theme=the-machine horizon=now -->
  `NEW 2026-08-31`. Metrics is relative `GET /api/_metrics`; Pages 404s that prefix too. Research
  already has tab-memory origin + token. 2nd consumer of sitting-base — do not bake `VITE_*` hosts.
  *Value M · Effort S–M.* Decision-impact: the operator can read metrics from the Pages SPA
  the same week they read books.
- ~~**`exchange-holiday-calendar` — NYSE holidays are not “not yet due” by accident**~~ —
  **SHIPPED + ARCHIVED 2026-08-31.** Full-day weekday closures (2020..=2032) are empty-expected
  coverage / tape-keep `ineligible holiday` / ticker `closed`. Half-days Future.
- **`tape-store-start-watermark` — named past weekday with no container is not a silent miss** —
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `NEW 2026-08-31`. GATE Z residual (`session-day-tape-capture` AC-32). *Value M · Effort S.*
- **`score-lab-digest-surface` — last lab artifact, read-only, `/_ops`** —
  <!-- atlas: theme=prove-the-edge horizon=later -->
  `NEW 2026-08-31`. Weekly ranking without clap. Authorizes: nothing. Not score-lab HTTP compute.
  Not a retune. *Value M · Effort M.* Sequence after more calendar on #5, or beside the morning note.
- **`project-context-shard-sizes` — split PROJECT_CONTEXT §5/§6** — `RAISED 2026-08-13, still
  <!-- atlas: theme=the-machine horizon=next -->
  unpaid after the 2026-08-20 hygiene batch (that batch did Vite barrels / cargo fmt /
  ports IPv6 / retired ci-standing-red — **not** this split). §5 and §6 still exceed the
  150-line shard; packs balloon when a feature tags into them. *Value M · Effort S–M.*
  Decision-impact cull **N/A** (system-of-building). Hygiene-review leftover #5.
- **`mui-dev-eslint-path-imports` — optional follow-on to the Vite barrel rewrite** —
  **✓ CLOSED 2026-08-20 (hygiene follow-on)** — dashboard source rewritten to
  `import Box from '@mui/material/Box'` (one-shot `tools/rewrite-mui-path-imports.mjs`);
  ESLint `@typescript-eslint/no-restricted-imports` forbids `@mui/material` and
  `@mui/icons-material` barrels (`allowTypeImports: true`); `.vscode/settings.json`
  `typescript.preferences.autoImportSpecifierExcludeRegexes` = `^@mui/[^/]+$`.
  `useTheme` / `ThemeProvider` come from `@mui/material/styles` (those paths are not
  under `@mui/material/`). Vite transform plugin is **not** wired into
  `vite.config.mts` (`tools/` import violates `@nx/enforce-module-boundaries`);
  the lock is source + ESLint. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=later -->
  `NEW 2026-08-20 (Vercel review)`. Transform plugin is in; source still writes
  `from '@mui/material'`. Optional: ESLint `no-restricted-imports` on `^@mui/[^/]+$` plus
  VS Code `autoImportSpecifierExcludeRegexes` so new files don't re-feed the barrel.
  Not required for prod (Rolldown tree-shakes). *Value L · Effort S.*
- **`ai-key-status-inflight-dedupe` — one in-flight GET /api/auth/ai-key per page** —
  **✓ CLOSED 2026-08-21** — `getAiKeyStatus()` shares one Promise while a GET is in
  the air; `finally` clears it. Overlapping boots (Strict Mode, remount, two tabs)
  hit the network once. Sequential calls after settle refetch (not a TTL cache;
  post-save GET still waits for a fresh bootstrap). Failures do not stick.
  *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=next -->
  `NEW 2026-08-20 (Vercel client-swr-dedup analogue)`. Settings + Ask-AI both call
  `getAiKeyStatus()`. No SWR (canon: no wholesale query-lib). A module-level in-flight
  Map on that one endpoint is enough. *Value L–M · Effort S.* Decision-impact **N/A**.
- **`light-theme-first-paint` — anonymous/light-pref users can flash dark** —
  **✓ CLOSED 2026-08-20 (hygiene follow-on)** — blocking inline script in `index.html`
  sets `html[data-theme]` + `theme-color` from `convexa.theme-paint` (last resolved
  mode) else `convexa.uiprefs.v1` / legacy `gammaflow.*`. `styles.css` paints paper
  when `data-theme=light`, ink otherwise (AC-A3 anonymous / no-JS stays dark).
  `AppThemeProvider` writes the paint cache after who-am-I (not into uiprefs, AC-F2).
  Static meta remains `#0B0F17`. Hexes pinned to palette canvas tokens in
  `firstPaintTheme.spec.ts`. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=next -->
  `NEW 2026-08-20 (Vercel rendering-hydration-no-flicker analogue; CSR not SSR)`.
  `index.html` is dark; `AppThemeProvider` applies the pref after who-am-I. Tiny blocking
  script on `<html>` class + `theme-color` would close it. *Value L · Effort S.*
- **`s5c-live-subscriber-caps` — Rust stream still caps symbols-per-request, not subscribers** —
  **✓ CLOSED 2026-08-21** — `LiveCapacity` on both SSE routes. `MAX_LIVE_SUBSCRIBERS`
  (default 500, 0=off) counts live SSE clients; `MAX_LIVE_SESSIONS` (default 50, 0=off)
  refuses only when a request would add a *new* ticker to the shared hub. Over either:
  503 + `Retry-After: 30`, not 429. Slot released on disconnect. `MAX_SYMBOLS=120`
  still truncates one URL's symbol list. TECH_DEBT's Python tick is no longer the
  live truth. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=next -->
  `RECONFIRMED 2026-08-20`. TECH_DEBT ticks S5c at a Python patch; `routes/stream.rs`
  caps 120 symbols per request. Do not inherit the Python-era "fixed" tick.
  *Value M · Effort S–M.*
- **`god-module-split-trade-entry-portfolio` — leftover 3.4** —
  **✓ CLOSED 2026-08-20 (hygiene follow-on, FE)** — extracted
  `positions/openTypes.ts` + `positions/useContractLive.ts` from `usePortfolio.ts`
  (hook re-exports types/refusals); `tradeEntry/FillModeToggle.tsx` from
  `TradeEntryDialogView.tsx`; `ai-rec/AiRecPanelBlocks.tsx` from `AiRecPanel.tsx`.
  `usePortfolio` still re-exports so callers do not fork. **Still unpaid:**
  `services/recommendation.rs` (~1866 lines) — split on next churn, not this pass.
  *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=later -->
  `NEW 2026-08-20`. Ticker path already split. Remaining: `TradeEntryDialogView.tsx`,
  `usePortfolio.ts`, `AiRecPanel.tsx`, `recommendation.rs`. Split **on churn**, not
  aesthetics. *Value L until a feature has to edit them · Effort M.*
- **`god-module-split-recommendation-rs` — leftover of leftover 3.4** —
  <!-- atlas: theme=the-machine horizon=later -->
  `NEW 2026-08-20`. FE god-modules split same day. `apps/api/src/services/recommendation.rs`
  is still ~1866 lines. Split **on churn**, not aesthetics. *Value L until a feature
  has to edit it · Effort M.*
- **`eslint-warning-hygiene` — 149 dashboard warnings, lint still exits 0** —
  **✓ CLOSED 2026-08-20 (hygiene follow-on)** — 0 warnings. Specs: `no-non-null-assertion`
  + `no-explicit-any` off (query-then-`!` is a test idiom). Product: unused disable,
  unused bindings, real `!` narrowed (WebGL `requireGL`, rec.strategy guards, term
  structure, create-order `onAct`), exhaustive-deps either used or explained
  (`spotRef`). A new warning is now a new warning. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=later -->
  `NEW 2026-08-20`. Almost all test `!` and a few exhaustive-deps. Not CI-red; still
  trains people to ignore the log. *Value L · Effort S–M.*
- **`toSorted-on-new-sorts` — dashboard has zero `toSorted()`** —
  **✓ CLOSED 2026-08-20 (hygiene follow-on)** — production dashboard sorts converted
  to `toSorted()` (orders store, grouping, derive/view, scanner, ticker, portfolio
  hooks, archive, charts). Remaining `.sort(` is test-assertion only.
  `tsconfig.app.json` / `tsconfig.spec.json` `lib` now include `es2023` so the
  method types exist (was `es2022`/`dom` only). New sorts stay copy-safe by
  convention. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=later -->
  `NEW 2026-08-20 (Vercel js-tosorted)`. `orders/store.ts` sorts a fresh `Object.values`
  array today (safe). Prefer `toSorted()` on any **new** sort of props/state.
  *Value L · Effort S (convention, not a bug).*
- **`widget-variant-not-boolean` — next Widget flag is a variant, not a fifth boolean** —
  **✓ CLOSED 2026-08-20 (hygiene follow-on)** — `noBodyPad?: boolean` removed.
  Independent named variants: `bodyVariant?: 'flush' | 'inset'` (surface) and
  `bodyPad?: 'default' | 'none'` (padding). Call sites: GEX/term-structure/history
  use `bodyPad="none"`; inset widgets keep `bodyVariant="inset"`. Widget spec
  mutation-guards the prop names. `live?` stays a data-signal boolean, not a
  variant. Next Widget flag is still a named variant, not a new boolean.
  *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=later -->
  `NEW 2026-08-20 (Vercel composition)`. `live?` / `noBodyPad?` / `span?` / chrome quiet
  are fine. The *next* boolean on Widget becomes `Widget.Inset` / `Widget.Flush`.
  Standing rule, not a feature. *Value L.*
- **`owner-device-signoff` — IMPROVEMENT_BACKLOG 5.6 still open** —
  <!-- atlas: theme=the-machine horizon=now -->
  Hardening shipped; e2e 393 is green; **owner phone + notch sign-off** is the hole
  (`docs/DEVICE_REVIEW.md`). Habit/chore, not GATE I. *Value M · Effort S (owner).*
- **`n1-push-deploys` — local main is ahead + dirty; push still deploys** —
  <!-- atlas: theme=the-machine horizon=now -->
  `REMINDER 2026-08-20`. Roadmap N1. Owner call, not a build. Do not push from a
  hygiene pass.
- **`x1-snaptrade-readonly` — SnapTrade import of the owner's real accounts** —
  <!-- atlas: theme=prove-the-edge horizon=next -->
  `NEW 2026-08-20 (roadmap X1 remainder)`. `broker-connect` shipped Webull-direct 2026-08-05;
  SnapTrade (≤5 connections free, multi-broker) is the remaining rock. Triggers system-6
  security review (first real-account connection). *Value H · Effort M.* Next real product
  feature when the owner says go — not hygiene.
- **`session-chain-archive` — one paid book per symbol per ET day, prune-proof** —
  <!-- atlas: theme=prove-the-edge horizon=now -->
  **✓ SHIPPED + ARCHIVED 2026-08-20** → `_archive/session-chain-archive/`.
  Program `keep-paid-books` #1. GATE Q 27/0/0. Conformance promoted.
- **`liquid-names-session-capture` — SPY / QQQ / IWM always get a session book** —
  <!-- atlas: theme=prove-the-edge horizon=now -->
  **✓ SHIPPED + ARCHIVED 2026-08-20** → `_archive/liquid-names-session-capture/`.
  Program `keep-paid-books` #2. GATE Q 25/0/0. Live hits SPY/QQQ/IWM 2026-08-20.
- **`paid-book-join-smoke` — first honest paid-book join on files we already have** —
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `NEW 2026-08-19 (keep-paid-books #3)`. **Chore, not a pipeline feature.** Run
  `batch-backtest` then `replay-outcome-join` on IWM (25 live books) or a 19 Aug
  subset. Expect 5d not-computable. Paste the tool evidence. Authorizes: nothing.
  *Value M · Effort S.* Queued after #1 (can use today's books; still sequenced).
- **`weekly-digest-lab-ritual` — keep ranking the nine-day digest** —
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `NEW 2026-08-19 (keep-paid-books #4)`. **Habit.** Runbook already at
  `docs/research/WEEKLY_SCORE_LAB_RUNBOOK.md`. `join-outcomes` →
  `score-lab --horizon 1d` on SPY/QQQ/IWM. Paste, don't retype. Only series
  that can grow 5d labels in the next two weeks. *Value H · Effort S (ops).*
- **`session-corpus-wait` — four to six ET weeks of archived session books** —
  <!-- atlas: theme=prove-the-edge horizon=next -->
  `NEW 2026-08-19 (keep-paid-books #5)`. **Wait, not a build.** Time-split and
  a paid-book AUC are hollow until the archive has calendar. Blocked-on #1
  landing plus elapsed sessions. Do not promote as a BRIEF.
- **`ai-rec-lab-p4` — frozen export packs / multi-model AI lab** —
  <!-- atlas: theme=prove-the-edge horizon=later -->
  `NEW 2026-08-19 (keep-paid-books #6)`. Blocked-on boring P2–P3 use **and** #5.
  Do not start. SYSTEM_DESIGN P4. *Value M · Effort L.* Parked.
- **`chain-archive-object-store` — session bodies off app-Postgres BYTEA** —
  <!-- atlas: theme=prove-the-edge horizon=next -->
  `NEW 2026-08-19 (keep-paid-books #7)`. Local JSON was 3.77 GB for **one
  unthinned day**. Session archive belongs in object storage / a dedicated
  volume; Postgres keeps metadata + labels. Blocked-on #1 (local prune-proof
  folder first). Do **not** raise the 48 cap to fake 14 days. *Value H · Effort M.*
- **`rec-plan-scope-caption` — the §9.5 half-two plan-row caption** —
  <!-- atlas: theme=trust-the-signal horizon=now -->
  `✓ SHIPPED + ARCHIVED 2026-08-17 (b)` → `_archive/rec-plan-scope-caption/`. Frontend-only.
  Closed `ai-rec-grounding` SPEC §9.5 half two. Must not become standing chrome on `local_rules`
  (held).
- **`project-context-s2-is-python-era` — the canon's Architecture section describes a backend that no
  <!-- atlas: theme=the-machine horizon=now -->
  longer exists** — **✓ REPAIRED 2026-08-20** (`PROJECT_CONTEXT.md` §2 backend = `api-rust` /
  `quant-engine`; Python archived; §2 / §2b split). Original:
  `SURFACED 2026-08-14 (rec-absence-literals-hole GATE PLAN; the planner refused to
  trust the pack and said so — then conductor-verified)`. **`PROJECT_CONTEXT.md` §2 "Architecture"
  documents the FastAPI/Python backend** — `main.py`, `src/providers/base.py` (ABC port),
  `src/core/{engine,signals,live,darkpool,observability}.py` — while the shipped backend is **Axum/Tokio
  Rust**, crate `api-rust`, under `apps/api/src/services/*.rs`. Measured: **23 Python-era markers** in
  that section. The Python tree is archived at `archive/api-python/` (CLAUDE.md records the move).
  **Why this is worse than an ordinary stale doc:** §2 carries the shard tags
  `architecture,backend,frontend,api,engine,signals,live,sse,providers,observability,ui` — **eleven of
  the most-used tags in the system**. So *any* feature whose BRIEF tags into the backend receives, as
  its ground truth, a description of a backend that was deleted. `context_for` is working exactly as
  designed; the source it shards is wrong.
  **The connection worth recording:** this is a plausible root cause of the new watch-list key
  `cited-code-is-verified-not-assumed` (DECISION_LEDGER, 1st instance = this same feature, 3 false
  claims about existing code in one council). Voices that reason from canon rather than from the tree
  are being handed Python. The council caught all three only because R1 was explicitly pointed at
  `.rs` paths and the reviewer read source.
  **Scope:** rewrite §2's backend half against the Rust tree; keep the frontend half (verified current).
  Re-tag or split while in there — §2 is also **178 lines, over the 150-line shard threshold**
  (`contract_lint` warns every run), so it pairs naturally with `project-context-shard-sizes`.
  *Value H (it silently poisons every backend feature's ground truth) · Effort S–M.* Decision-impact
  cull **N/A** (system-of-building class). **Do NOT bundle with a product feature** — canon repair
  wants its own reviewable diff.
- **`rec-absence-literals-hole` — ~~four~~ **SIX** AI-rec fields print an out-of-set bare `—`** —
  <!-- atlas: theme=trust-the-signal horizon=now -->
  `NEW 2026-08-13 (raised by the UX voice at ai-rec-grounding R1, code-verified; deliberately cut
  from that feature)` → **✓ PROMOTED at GATE I 2026-08-14** (brief at
  `.spire/clusters/tech/contracts/rec-absence-literals-hole/BRIEF.md`).
  ⚠ **This entry's specifics are CORRECTED by that gate — read the 2026-08-14 GATE I note above
  before trusting the text below.** Three corrections, all code-verified: the file moved to
  `pages/ticker/widgets/ai-rec/` and the sites are **`:1081/:1084/:1090/:1100`**, not the ones named
  below · **`Time horizon` (`:1153`) and `confidence` (`:1158`) carry the same defect**, making it six
  fields · and it is **NOT FE-only** — `field_reasons.rs:5`'s `RecField` covers only the five
  risk/exit fields, so **no wire reason token exists for any of the six** and a backend lane is
  required. Effort **S–M**, both lanes. *(original entry:)*
  `Structure`, `Strike(s)`, `Expiration` and `Entry trigger` render `—` via bare `?? '—'` /`fmtNum`
  (`AiRecPanel.tsx:753`, `:1044`, `:1053`, `:1063`) — **outside** the closed not-a-number vocabulary,
  where `—` is defined as "No entry, so there is nothing to size." So a model that simply omitted the
  field renders identically to a genuine no-trade not-applicable. A pre-existing `absent-is-not-none`
  defect; `ai-rec-grounding` neither created nor worsened it and deliberately attached **no** grounding
  clause, marker, tint or tooltip to those four so nothing grounds a mis-stated absence (`Invalidation`
  was taken in scope and fixed). **Closing this also closes SPEC §9.5's halo residual** — the reason
  that residual is open is that a reader may generalize "no marker = checked" from the fields that do
  carry a clause. *Value M–H · Effort S.* Decision-impact cull **N/A** (data-honesty class).
  **Invariant watch:** `absent-is-not-none` (HARD) · `digested-labels-not-raw-dump` ·
  `theme-token-discipline`.
- **`cargo-fmt-whole-crate-drift` — `cargo fmt -p api-rust -- --check` is non-zero on ~54 files** —
  **✓ CLOSED 2026-08-20 (hygiene batch)** — `cargo fmt -p api-rust -p quant-engine` applied;
  `--check` green. Future drift: keep fmt in the same PR as the Rust it touches, or a
  dedicated fmt-only commit. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=next -->
  `SURFACED 2026-08-13 (ai-rec-grounding backend lane + QA, both verified it is pre-existing)`. The
  drift spans files no recent feature touched (`config.rs`, `db/*`, `routes/*`, `cited.rs`, …). **Not
  currently a CI gate**, which is the only reason it is not urgent — but it means no lane can use
  `cargo fmt --check` as a signal, so the one cheap check that would keep Rust formatting honest is
  permanently red and therefore ignored. Same alarm-fatigue shape as `ci-standing-red`. A blanket
  `cargo fmt` produces an unreviewable diff, so do it as its own commit with **no other change** in it.
  *Value M · Effort S.* Decision-impact cull **N/A** (tooling/hygiene). **Pairs naturally with
  `ci-standing-red` and `ports-free-is-ipv4-only` as one hygiene batch.**
- **`project-context-shard-sizes` — three sections exceed the shard threshold** — `NEW 2026-08-13
  <!-- atlas: theme=the-machine horizon=next -->
  (contract_lint warns on every run; measured at ai-rec-grounding GATE I)`. `PROJECT_CONTEXT.md` §2
  (178), §5 (211) and §6 (530+ lines) are each >150, so **any feature tagging into them loads the whole
  section** and the system-5 sharding stops paying. Measured cost: `ai-rec-grounding`'s pack was
  **971 of 1110 lines (13% smaller)** until the `personas` tag — the tag on the 530-line §6 — was
  dropped, after which it fell to **441 lines (60% smaller)**. So the tag-to-section mapping, not the
  canon's size, is doing the damage. Fix is to split §6 by capability era or re-tag it more finely.
  *Value M · Effort S–M.* Decision-impact cull **N/A** (system-of-building class).
- **`score-lab-b0b-outcomes` — freeze `slice_current`'s outcomes** — `NEW 2026-08-12`
  <!-- atlas: theme=prove-the-edge horizon=now -->
  Carried out of `score-lab-signal-comparison` GATE S as **B0b, open**. `slice_current/outcomes.json` was
  never produced — no `MASSIVE_API_KEY` in the build environment — so **V3b never ran** and **no slice in
  the tree can yet produce a cell above both power floors**. The guards SKIP **loudly** rather than passing
  vacuously and **nothing was synthesised**, which is why this blocks nothing. Value: it is the only way the
  vol-normalized-GEX candidates get exercised against real outcomes at full power. **Never synthesise
  outcomes** — if the key is unavailable, the item waits.
- **`score-lab-symbols-dedup`** — `NEW 2026-08-12` — S —
  <!-- atlas: theme=prove-the-edge horizon=now -->
  `--symbols " SPY , SPY "` is not de-duplicated → 15 duplicate `(group,candidate,label)` keys and the SPY
  block printed twice. **Every number stays correct** (pooled 74, not double-counted), so this is cosmetic,
  and it **predates** the feature's fix passes. One `dedup()`. Found by QA at GATE Q pass 3.
- **`ci-standing-red` — the CI frontend job + conformance local leg are standing-red (pre-existing,
  NOT from tradeable-rec-inputs)** — `NEW 2026-08-13, gh-run-verified` · **✓ CLOSED 2026-08-20
  (hygiene batch)** — origin Frontend job green 2026-08-16 (`593f601`); local 2026-08-20:
  lint 0, format:check 0, typecheck 0, Vitest 1985/1985, e2e 52/52, cargo test api-rust +
  quant-engine 0, release+postgres build 0. Warnings remain (see `eslint-warning-hygiene`);
  they do not fail the job. Do not resurrect this item from the 08-13/14 log lines below
  without a new failing run. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=now -->
  Both were red on the pre-feature push too (backend job green both times). (a) `ci.yml` Frontend job:
  `@convexa/dashboard:lint` fails under the warnings policy — `pages/lab/StructureField{Lab,WebGL}.tsx`
  (exhaustive-deps + non-null assertions) and a `useAlerts.ts:26` unused directive — and the test step
  carries the 5 accepted pre-existing red spec files (see §7ad baseline). (b) `conformance.yml` "Local
  API + auth-gated" leg exits **2 (config class)** at its signup-bootstrap step — the prod
  public-surface leg PASSES. Value M–H (a standing-red CI trains everyone to ignore it — the classic
  alarm-fatigue failure) · Effort S–M. The 2 unused directives our feature added to
  `riskInputs.spec.tsx` were fixed same-day (post-ship cleanup commit).
  **NEW INSTANCE + a named line, 2026-08-14 (`rec-absence-literals-hole` GATE Q):** `nx lint` is red at
  **`stage3-headings.spec.tsx:278` — "Unexpected empty arrow function."** QA proved it **pre-existing**
  (empty diff vs the lane's `$BASE`; reproduces in a pristine `5f16202` worktree), so it was not a
  bounce — **but the build lane had reported "lint green," which was an unverified claim and wrong.**
  That is the precise cost of a standing red: it stops being read, so a lane reports the colour it
  expects. **`npm run ci` cannot be green today.** The lint fix itself is one line.
  **Verification-integrity lesson from the same pass, worth keeping regardless of this item:**
  QA found `nx typecheck` returned a **cache hit (34 ms)**, and even `--skip-nx-cache` did no work
  (245 ms). **A cached green is not an observation.** Only a forced `tsc --build --force` is evidence
  (it was green). Any gate claiming a typecheck as runtime evidence must force the build or say it
  did not.
- **The :8000 orphan rewrites `data/scan.json`** — `NOTE 2026-08-12`, sits beside the existing
  `ports:free` IPv4-only entry below —
  <!-- atlas: theme=the-machine horizon=now -->
  An orphaned `api-rust` (PID 58588, `taskkill /F` **access-denied**) holds :8000 and rewrites
  `data/scan.json` **several times a minute** with nothing else running. Two separate QA passes had to work
  around it — one by **renaming the locked binary** (Windows permits renaming a running exe →
  `target/debug/api-rust-orphan-locked.exe`), then rebuilding and serving on its own port. **Any future pass
  doing a naive before/after byte check on that file will get a false failure.** Leftover after the
  IPv6 sweep: `ports-orphan-access-denied`.
- **`rename-org-scope-to-convexa` + local folder** — `✓ CLOSED (2026-08-10)` —
  <!-- atlas: theme=the-machine horizon=done -->
  Package scope is `@convexa/*` (`@convexa/source`, `@convexa/api`, `@convexa/dashboard`,
  `@convexa/dashboard-e2e`); GitHub remote is `ariasr47/convexa`; local working folder is
  `C:\Dev\convexa` (was `C:\Dev\gammaflow-web`); Spire registry project name/root updated to match.
  **Still intentionally unrenamed:** `gammaflow.*` durable localStorage keys (loss-free migration),
  archived "GammaFlow" brand history in ledgers/contracts, and kit `banned_tokens` that keep
  framework files project-neutral.
- **`ports-orphan-access-denied` — Windows can refuse `taskkill` on an orphan api-rust** —
  <!-- atlas: theme=the-machine horizon=next -->
  `SPLIT 2026-08-20 from the closed IPv6 gap`. IPv6 sweep is closed; this leftover is the
  PID that `taskkill /F` **access-denied** while still rewriting `data/scan.json`. Workaround
  remains rename-the-locked-exe. *Value M · Effort S–M (Windows).*
- **`ports-free-is-ipv4-only` — the tool written to prevent the stale-server trap does not prevent it** —
  **✓ CLOSED 2026-08-20 (hygiene batch)** — `tools/free-ports.mjs` now parses `netstat -ano`
  (both families), matches on local-address *port* (not `includes(':${port} ')`), Unix
  `lsof -iTCP` LISTEN, never touches :8001. Tests in `tools/free-ports.spec.mjs`. CLAUDE.md
  trap updated. Leftover: `ports-orphan-access-denied`. *(historical body retained:)* —
  <!-- atlas: theme=the-machine horizon=now -->
  `SURFACED 2026-08-06 (broker-option-grouping GATE Q re-run, finding R-5; QA-measured, not inferred)`.
  **`npm run ports:free` reported "all clear" while three IPv6-only orphans were live** —
  `[::1]:4200`, `[::1]:4300`, `[::1]:4301` — one of them **answering 200 on :4300**. QA had to kill them
  with `taskkill /T /F` and restart with `--strictPort` before any measurement was trustworthy.
  **Why it matters more than its size:** `CLAUDE.md` documents "orphaned dev servers hold ports and serve
  STALE code" as a hard-won trap and names `ports:free` as *the* remedy — so the trap is still fully
  reachable **through the tool written to close it**, and worse, the tool now returns a confident
  all-clear that suppresses the manual check a careful session would otherwise do. Vite binds IPv6 on this
  box (already recorded: use `localhost:4300`, not `127.0.0.1`), so the IPv6 case is the **common** one
  here, not an edge case. A verification pass fed by a stale server is exactly how a previous session's
  build once got certified.
  **Fix:** make the port sweep resolve both address families (`netstat -ano` already lists `[::]`/`[::1]`
  rows — the filter is what drops them), and consider having it exit non-zero when it kills something, so
  a caller can tell "nothing was running" from "I just cleaned up after you". Keep the existing guard that
  never touches the owner's `pdf-translator` on 8001.
  *Value M–H (verification integrity, and it silently degrades every run-the-app gate) · Effort S.*
  Decision-impact cull **N/A** (tooling/correctness class). Ties `CLAUDE.md`'s traps section, which should
  be corrected in the same change.
- **`scanner-market-hours-gate` — ✓ SHIPPED 2026-08-06 (`797e801`), owner-directed, no pipeline.**
  Built and deployed **before the worker's first deploy**, exactly as this entry recommended — the
  owner chose it over deploying the worker ungated. `src/scanner/session_gate.py` + both lanes in
  `loop.py`; `SCAN_MARKET_HOURS_ONLY` **defaults ON**, fails **OPEN** on a session-lookup error, and
  the fast lane keeps writing the heartbeat every `SCAN_IDLE_INTERVAL_SECONDS` while idle so a
  resting worker stays distinguishable from a dead one (carrying `sweep_last_completed` forward
  unchanged). api 326 (+24). ⚠ **Holidays are NOT covered** — `classify_session()` has no holiday
  calendar, so a market holiday sweeps as its weekday session; weekends are covered. Closing that
  needs a real exchange calendar and is the remaining piece of this item.
  Also of note: the deterministic bounded test path in `loop.run` is deliberately exempt from the
  gate — with it on, every existing scanner test would idle forever whenever the suite ran outside
  04:00–20:00 ET, turning them into time-of-day flakes.
  *(original entry:)* **`scanner-market-hours-gate` — the sweep worker runs 24/7 with no session awareness (deployed-cost gap)** —
  <!-- atlas: theme=the-machine horizon=next -->
  `SURFACED 2026-07-26 (post-ship, conductor-verified in code)`. **Not a bug — a deployment-cost gap the
  v1 scope never covered.** `apps/api/src/scanner/loop.py` + `worker.py` contain **no** session /
  market-hours / weekend / holiday gating (grep-verified: zero matches for `market_session|is_open|rth|
  closed|weekend|holiday`). The two-speed loop simply runs forever at its configured cadence.
  **Why it matters only when deployed:** locally the worker is started and stopped by hand, so nobody
  notices. On Railway it is an always-on second service, and **PROJECT_CONTEXT §4 records that the vendor
  has NO overnight coverage (8pm–4am ET)** — so roughly a third of every day the worker re-fetches ~69 full
  option chains to recompute values that cannot have changed. Order of magnitude at N=69 with the observed
  ~2-min pass: ~30 passes/hour ≈ 2k chain fetches/hour ≈ 50k/day, ~16k of them overnight dead weight
  (**estimate, not a measurement** — worth instrumenting before sizing the fix).
  **Shape of the fix (small, fits the existing seams):** the codebase already has a session classifier in
  `src/core/live.py`; the worker consults it to **idle the slow (structure) lane outside 4am–8pm ET** — and
  probably the fast lane too, since quotes are equally absent. Keep writing the **heartbeat** on a slow tick
  while idle so the page stays honest rather than looking dead: the shipped worker-down banner + per-row
  `stale` states already degrade gracefully, so **no UI change is required**. Gate behind an env knob
  (`SCAN_MARKET_HOURS_ONLY`, default ON in prod) alongside the existing `SCAN_*` cadence vars. Weekends +
  market holidays are the same predicate. **Invariant watch:** `additive-keeps-score-byte-identical`
  (scheduling only — `compute_ticker` untouched), `best-effort-isolated-or-null` (a session-lookup failure
  must fall back to sweeping, never to silently stopping — failing OPEN is the safe direction here),
  `model-read-carries-its-assumptions` (an intentionally idle overnight worker must remain distinguishable
  from a dead one — that is exactly what the heartbeat is for).
  *Value M (pure cost/quota, no user-visible gain) · Effort S.* **Infra/cost class:** trading-decision cull
  **N/A**. **Sequencing:** cheap and worth doing **before** the scanner is first deployed — it is far easier
  than reading a surprising vendor bill and back-deriving the cause. Ties `deploy` (owner runbook) and
  OPEN_THREADS §7v.
- **`auth-schema-migrations` — adopt a real schema-evolution mechanism for the auth Postgres store** —
  <!-- atlas: theme=the-machine horizon=next -->
  `SURFACED 2026-07-24 (scanner P3 Plan-3 authoring; conductor-verified in code)`. **The seam fired.**
  `apps/api/src/auth/postgres_store.py:105-107` carries an explicit note: *"SCHEMA-EVOLUTION SEAM
  (ARCHITECTURE §3.7): the FIRST future schema change adds a tiny `schema_version` table + ordered
  idempotent steps here, OR adopts a migration tool then. This feature ships the fresh schema only."*
  **Scanner P3 IS that first schema change** (the D1 per-account view = an additive nullable `scan_view`
  column on the `settings` table).
  **Conductor ruling (2026-07-24, default-with-veto — applying the owner's system-12 preference: unblock
  the feature, do the infra fix deliberately):** P3 ships the **minimal loss-free path** — an idempotent
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS scan_view TEXT` in the same bootstrap, which is
  multi-replica-safe, matches the existing `CREATE TABLE/INDEX IF NOT EXISTS` philosophy exactly, is
  self-describing (needs no version counter for a single additive nullable column), and **does not
  foreclose** adopting `schema_version` later. **What is deferred to THIS item:** the real mechanism —
  a `schema_version` table + ordered idempotent steps (or Alembic/yoyo) — which becomes genuinely
  necessary at the first **ordered/stateful** change (a backfill, a column drop, a type change), where
  `IF NOT EXISTS` stops being sufficient. Note the live-Postgres path is **parity-reviewed, not
  live-verified** here (no local Postgres — the iv-rank/persistent-db precedent), so this item should be
  scheduled alongside the next real Postgres exercise. *Value M · Effort S–M.* **Build-system/infra
  class:** trading-decision cull **N/A**.
- **`split-decision-log` — ~~LIVE bug~~ ✓ CLOSED (v3 cutover)** —
  `CORRECTED 2026-08-17 (GATE I):` `features/trading/model/store.ts` is a **read-only** legacy
  harvest/migration source; `putTrade` / `clearTrade` / the second `appendDecision` are deleted.
  The stranded-write hole cannot recur from current code. Outcome ledger still unions both blobs
  as harvest. *(original entry:)* **`split-decision-log` — the append-only decision log is SPLIT across two durable stores (LIVE bug)** —
  <!-- atlas: theme=trust-the-signal horizon=now -->
  `SURFACED 2026-07-16 (outcome-ledger GATE A·X; conductor-verified in code)`. **Pre-existing +
  feature-independent — NOT an outcome-ledger regression.**
  **The defect:** `appendDecision` is defined **twice** — `features/trading/model/store.ts:59` writes to
  **`convexa.ghost-trade.v1`**, `features/trading/positions/store.ts:171` writes to
  **`convexa.positions.v2`**. `pages/ticker/TickerDashboard.tsx:101` → `useGhostTrade` is **LIVE code**
  (not dead — `GhostTradePanel` was deleted, but the hook survives and the Ticker still drives it) and
  still appends to **v1**, while the positions store reads v2 and only falls back to v1 via
  `resolveDurable` **when no v2 blob exists**. So once a user has ANY v2 blob (from Positions, or the demo
  seed), **every Ticker-page ghost-trade decision record is written to a key nothing reads** —
  permanently stranded. The Ticker's ghost trade and the Positions book are effectively **two parallel
  universes**; `sim-entry-unification` unified the **dialog**, never the **stores**.
  **Why it matters beyond outcome-ledger:** decision records are the app's only audit spine and the raw
  material of any edge measurement — half of them are being written to a dead-letter key today, silently.
  Compounds with `[loss-free-durable-migration]` (promoted 2026-07-16): the stranded v1 blob is exactly the
  data a careless future migration would "clean up."
  **Open question for the owner/architect — is the split INTENDED?** Plausibly yes-by-history (v1 = the
  single-trade ghost engine, v2 = the multi-position book; the migration was meant as a one-time upgrade).
  If intended, the fix is **documentation + a union read**; if not, it is a **store unification** (a real
  refactor touching a durable key ⇒ `[loss-free-durable-migration]` is binding — never-delete,
  promote-forward, idempotent). **Decide before, or as part of, outcome-ledger's fan-out.**
  **Interim (already handled):** outcome-ledger's architecture **unions both logs + both position maps and
  de-dupes** (migration-copied records exist in both blobs), so the feature is correct either way — but the
  underlying split remains.
  *Value M–H (audit-spine integrity) · Effort S (union+document) to M (unify).* Decision-impact cull **N/A**
  (data integrity). **Invariant watch:** `loss-free-durable-migration` (HARD),
  `additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`.
- **`test-seed-writes-a-fabricated-closed-position` (sub-item of the above)** — `positions/testSeed.ts`
  seeds a CLOSED position (`realized_pl_dollar: 196`, `realized_pl_pct: 48.4`, `status: 'closed'`) via
  `putPosition` and **never calls `appendDecision`**. Harmless today (it is a dev/demo seam, gated on the
  `demo@convexa.io` account, non-destructive + one-time), but it means **a durable store contains a
  fabricated outcome with no decision record** — any naive "closed position = outcome" analysis would count
  a 48.4% winner that never happened. outcome-ledger excludes it **structurally** (DecisionRecord-as-spine,
  no record ⇒ not an outcome). *Fix (optional): have the seed emit matching decision records, or mark
  seeded positions explicitly.* *Value L–M · Effort S.*
- **`ai-rec-grounding` — every AI-asserted number traceable to a computed field** — `RAISED 2026-07-16
  <!-- atlas: theme=trust-the-signal horizon=now -->
  (canon review; owner agreed)` → **✓ PROMOTED at GATE I 2026-08-13** (brief at
  `.spire/clusters/tech/contracts/ai-rec-grounding/BRIEF.md`; folds in the §7ad
  `rec-prompt-single-figure-max-risk` seam). ⚠ **This entry's framing is now partly stale — it predates
  `tradeable-rec-inputs` (2026-08-13), which shipped the verification seam.** See the 2026-08-13 GATE I
  note above: `apps/api/src/services/rec_inputs/{cited,cap_check,max_risk,field_reasons}.rs` already
  verifies ONE assertion class (the named contract) and already enumerates the four fields; the gap is
  that `field_reasons` explains **absence** while nothing verifies **presence**. Effort **M**, as an
  extension of a live module — not the greenfield build the text below implies. *(original entry:)*
  **The gap:** `best-effort-isolated-or-null` covers the AI **failing**;
  **nothing covers it fabricating.** The rec emits strikes / stops / targets / levels as fact, and
  `model-read-carries-its-assumptions` disciplines *our* model reads, not the LLM's output. **Scope:** every
  number the rec asserts must resolve to a bundle field (or the rec's own echoed input), verified
  server-side at serialization; an untraceable number is **not rendered as fact** (drop it, or mark it
  unverified — the PM/UX call). **Precedent in hand:** ai-rec-backtest-orders already renders
  **bundle-sourced** "levels in play" — the instinct is there, un-generalized; the `ScenarioLLMProvider`
  registry (`AI_REC_SCENARIOS_ENABLED`) is a **ready-made harness to test fabrication deterministically** —
  add a scripted "hallucinated level" scenario. *Value H · Effort M.* Decision-impact cull: passes (a
  fabricated strike is a *wrong trade*, not a cosmetic bug) — **and** it is a **liability** item, not only a
  quality one: see §C monetization (the securities-counsel consult on AI-rec framing). **Invariant watch:**
  `ai-asserted-numbers-are-traceable` (its **first instance** — promotes on ship), `additive-keeps-score-
  byte-identical`, `best-effort-isolated-or-null`, `digested-labels-not-raw-dump`.
- **`degradation-visibility` — measure the nulls that best-effort creates** — `RAISED 2026-07-16 (canon
  <!-- atlas: theme=trust-the-signal horizon=next -->
  review; owner agreed)`. **The gap this closes is one WE created:** `[best-effort-isolated-or-null]` is
  correct and load-bearing, but it makes every failure **silent** — a field degrades to null and the UI says
  "unavailable this cycle" **forever**, with nothing aggregating null rates. Observability measures
  **latency / cache / vendor**, never **correctness or nullness**; `latency-visualizer` is explicitly
  **non-alerting** and alerting is parked in §D. So a permanently broken IV or greeks feed would render
  politely and indefinitely, and **nobody would know**. The two invariants are a pair and only half exists.
  **Scope:** per-field null/degradation rates in the existing `/api/_metrics` rollup + an operator readout;
  optionally a threshold notice. *Value M–H · Effort S–M* (the observability spine + ring buffer already
  exist). Decision-impact cull **N/A** (operational correctness). **Invariant watch:**
  `operator-vs-trader-path-separation` (**operator** surface — `/_ops/metrics`, off the trader routes,
  read-only + side-effect-free), `additive-keeps-score-byte-identical`, `best-effort-isolated-or-null` (the
  measurement must not itself become a failure path).
- **`responsive-layout` — PARKED MID-FLIGHT on a local-only branch** — `RAISED + PARKED 2026-07-16 (owner:
  <!-- atlas: theme=reach horizon=next -->
  "pausing to think")`. ~~⚠ **`feat/responsive-layout` exists ONLY on this machine — never pushed.**~~
  **CORRECTED 2026-08-06 (GATE I): the branch IS pushed** — `origin/feat/responsive-layout` @ `a7b92eb`,
  identical to local, 0 ahead / 0 behind. The data-loss risk is gone; only the owner device review
  remains. 2 commits,
  both green: `d2bac85` responsive top nav (hamburger + drawer < `md`, 48px targets) · `a7b92eb` positions →
  cards < `md` + TradeEntryDialog/AuthDialog → fullScreen < `sm`. **Already fine, no change needed:** landing
  + ticker (container queries; bento 1-col; 0 overflow). **NOT done (needs owner device review):**
  `viewport-fit=cover` + safe-area insets for notched phones; fluid typography scale; visual polish < 375px.
  **Env constraint:** the preview pane clamps ~390–497px and screenshots hang → true phone width **cannot be
  visually verified here**; the work was verified **structurally** (JS overflow probes + tests). Owner has a
  manual checklist (DevTools device toolbar; or `nx serve dashboard --host` + LAN IP:4300). Resume:
  `git checkout feat/responsive-layout`. ~~**Recommended: `git push -u origin feat/responsive-layout`** — a
  local-only branch is one disk failure from gone.~~ (Done — see the 2026-08-06 correction above.)
  *Value M–H (mobile usability) · Effort S–M remaining.*
  Decision-impact cull **N/A** (UX/platform-reach class). **Invariant watch:** `theme-token-discipline`.
- **Restructure deferrals** — `RAISED 2026-07-16` → **GROOMED 2026-07-16 (hygiene batch): (a) CULLED,
  <!-- atlas: theme=the-machine horizon=later -->
  (b) stands, (c)+(d) re-scoped to one branch.**
  (a) ~~`OpportunityTier` → a ticker widget~~ — **CULLED as half-impossible** (verified in code): the `WORD`
  map is imported by `features/trading/outcomes/ledger.ts:20`, and `features/` may never import `pages/**`
  (downward-only), so the data **cannot move**; and the component isn't a bento widget anyway — it renders
  as page CHROME (props into `CommandDeck`) + an inline `PrimeBanner` alert. Only legal remnant: move the
  `PrimeBanner` JSX to `widgets/chrome/` **if ever touched**; not worth a standalone change.
  (b) **`/settings` as its own page** — stands as written (revisit if it grows).
  (c)+(d) **rename `features/` → `domains/` + flatten `app/` → `src/`** — still owner-endorsed; **do BOTH
  in ONE dedicated branch** to pay the churn once. Measured blast radius: 148 `@/features/` imports across
  52 files · 3 alias configs (`tsconfig.app.json`/`tsconfig.spec.json`/`vite.config.mts`) · the README map ·
  **⚠ `shared/theme/hex-discipline.spec.ts` hard-anchors its globs at `/src/app/{pages,features,shell,
  shared/ui}/**` and its vacuity guard will fail loudly if the roots go stale — update in lockstep** (the
  one coupling a naive find-replace misses). Windows gotcha: kill dev servers before the physical moves
  (dir-rename locks). *Value L–M · Effort S–M (branch).*
- **Dead-code sweep** — `✓ COMPLETED 2026-07-16 (hygiene batch)`. The "~80 unused exports" claim was
  **ts-prune noise, not dead code** — measured: 329 flags = 99 `(used in module)` false positives + ~180
  barrel re-export blind spots (131 in `_kit/index.ts` alone — consumers deep-import past it, but the
  barrel IS live: `TickerDashboard.tsx:61` imports from it, and widget barrels are the documented house
  pattern) + ~11 router-rendered page defaults + test-only consumers ts-prune can't see. **Genuinely dead
  (verified zero references incl. specs): 12 symbols — all deleted** (`ACTION_VIEW_ORDER`,
  `POSITION_FROM_ORDER`, `deriveRows`, `distinctTickers`, `distinctExpirations`, `SUBTOTAL_TIP`,
  `GROUP_TIP`, `HISTORY_EMPTY`, `contractLine`, `PRIME_BANNER_TOOLTIP`, `DEFAULT_PERSONA_ID`,
  `prefillChip`). Gates green after (typecheck · tsc-app · 467/467 cold · lint 0).
- **Test-migration to the risk-based rule** — `✓ COMPLETED 2026-07-16 (owner-directed, whole suite in one
  pass; commit 05702e9)`. The owner gated it open ("replace the old tests everywhere"); the owner's own
  Landing rewrite (15→4) was the calibration exemplar. Six cluster migrations (fresh `delivery-frontend`
  lane each): **807/807 (70 files) → 467/467 (52 files)**, cold-run verified; **product-source diff EMPTY**
  (test-only, verified structurally). 28 specs deleted · 20 rewritten · 10 new.
  **Conductor course-corrected two lane drops** (both restored): the 2026-07-02 **keyless-scenario
  regression guard** (a regression that actually shipped is exactly what risk-based keeps — incl. the
  `ai_scenario` marker surviving to the join the outcomes ledger's exclusion consumes) and the
  **`theme-token-discipline` hex scans** (consolidated into ONE repo-wide vacuity-guarded
  `shared/theme/hex-discipline.spec.ts` — a glob, not an enumeration, so new files are covered by default;
  it immediately found **2 real hex violations** in operator-metrics, exempted as visible
  `TODO(theme-token-discipline)` debt).
  **Gaps FILLED that the old suite never had:** `model/mark.spec.ts` (the P&L/mark-ladder engine — the most
  depended-on pure module in the app, previously untested directly) · `model/store.spec.ts` · the ai-rec
  **grounding** centerpiece (rec claims 999 for every level; the bundle's numbers win) · `windowedStrikes`
  + `humanAge` units · `/blog` + `/settings` in the route walk (the old spec predated both).
  **Vacuous tests caught + removed:** style assertions via `getAttribute('style')` (always-empty under MUI
  `sx`), one asserting against the stale `gammaflow.positions.v2` key, stale-banner tests asserting the
  absence of UI removed a month earlier, fixture-echo tests asserting the mock against itself.
  **Flags left open:** *(vol_regime RESOLVED 2026-07-16 — see the traced verdict below)* `signals.vol_regime` renders NOWHERE on the ticker page (possible product gap —
  surfaced by the ticker lane refusing to write a fake test for it) · the 2 operator-metrics hex TODOs.
  *(original entry:)* The 2026-07-13 `qa-verify.md` §4 amendment replaced per-AC test mirroring with
  **risk-based** testing. **Note:** this amendment is what obsoleted the original **system-10** (§E), now
  **re-scoped 2026-07-16 to an AC↔verification-EVIDENCE check** — the re-scoped form **supports** this
  migration (it accepts `review` as evidence, so trimming a spec no longer trips it).
- **AI input-enrichment pool** — `RAISED 2026-07-02 (owner; "what derived data helps the AI?")`. The
  <!-- atlas: theme=breadth horizon=later -->
  scored survivors from the 2026-07-02 GATE I (full verdicts in that note above): `iv-rank` (Value H;
  blocked-on IV-history persistence — accumulate into the shipped Postgres store), `market-backdrop`
  SPY/QQQ+VIX (Value H; blocked-on a Massive index/VIX coverage verify), the AI context-scalars pack
  (GEX shape scalars + flow-vs-positioning divergence + multi-horizon ATR — cheap bundle; ATR also
  unblocks the distance-to-level tiles), volume-profile POC/value-area + CVD (independent non-gamma
  confluence), and the technical-indicator regime bundle (EMA/ADX/RSI digested-to-labels, confluence
  tier). **All ride as AI state-export CONTEXT, never scoring inputs** (`additive-keeps-score-byte-
  identical`). `dealer-flow-projection` ✓ SHIPPED + ARCHIVED (2026-07-02), `ai-context-pack` ✓ SHIPPED
  (2026-07-06), **`iv-rank` ✓ SHIPPED + ARCHIVED (2026-07-07)** — the pool has now shipped three; remaining
  live candidates: `market-backdrop` (parked, blocked-on plan upgrade), volume-profile POC/CVD, or resurface
  `scanner`. News/sentiment stays
  owner-future (§D-class). Decision-impact cull: each names the rec-quality lift it gives; judged on
  downstream-AI-quality, the first-class harvest source. **2026-07-06: the AI context-scalars pack +
  the TI regime bundle → ✓ SHIPPED + ARCHIVED (bundled) as `ai-context-pack`** (owner pick; QA PASS
  26/26; see "Last GATE I — 2026-07-06" above + OPEN_THREADS §7q). **2026-07-06 (b): `iv-rank` CHOSEN →
  in pipeline** (architect-first; BRIEF at `.spire/clusters/tech/contracts/iv-rank/BRIEF.md`; see "Last GATE I —
  2026-07-06 (b)" above). **2026-07-07: `iv-rank` ✓ SHIPPED + ARCHIVED** (QA PASS 19/19; graduated
  `digested-labels-not-raw-dump`; established the first persistent market-data store; see "Last GATE I —
  2026-07-06 (b)" above + OPEN_THREADS §7r). **`market-backdrop` PARKED — blocked-on a Massive plan upgrade** (feasibility
  probe: index data `NOT_AUTHORIZED`; a SPY/QQQ-ETF-proxy reshape is buildable in-tier if resurfaced).
  Remaining parked in the pool: volume-profile POC/CVD, news/sentiment (owner-future). **ATR unblocked
  distance-to-level tiles — those SHIPPED + ARCHIVED 2026-08-11** as `distance-to-level-tiles`.
- **Fix the broken `@convexa/dashboard:typecheck` Nx target** — `✓ COMPLETED 2026-07-16 (hygiene batch)`.
  The "~960 errors" claim had gone **stale**: the `tsconfig.spec.json` fix (DOM lib + jest-dom types) was
  already applied by commit `8637435`, leaving exactly **ONE** error — a bad cast in
  `captureDigest.spec.ts:73` (`vi.spyOn(globalThis, 'fetch' as never)` collapsed the spy's type so
  `.mockRestore()` wouldn't typecheck). Fixed (dropped the cast); **`npx nx run @convexa/dashboard:typecheck`
  is GREEN for the first time** and now belongs in the standing gate battery alongside
  `tsc -b tsconfig.app.json`. *(original entry: ~960 errors, jest-dom/DOM-lib gap — Seams →
  OPEN_THREADS §7p.)*
- **AI-rec "Accept" → tracked position — full build-out** — `✓ SUBSUMED by ai-rec-backtest-orders
  (SHIPPED 2026-07-02)`: "Act as sim order" delivers the full read→track loop (rec structure/strikes/
  expiry/stop/target → confirmed SimOrder → live-cross fill → tracked Position with decision-record +
  `pinned_fingerprint` linkage; Accept stays as the immediate pre-fill path). *(original note, retained:)*
  `RAISED 2026-07-01 (owner; during the AI-rec
  structured-display polish)`. Wire the AI recommendation card's **Accept into ghost trade** action into the
  positions/ghost-trade tracker end-to-end. Today Accept opens a pre-filled entry dialog (`AiRecPanel` →
  `onAccept` → `prefill.ts` → the positions entry dialog); the full flow — mapping the rec's structure /
  strikes / expiration / stop / target into a real tracked `Position`, the mandatory confirm, a decision
  record linking the rec `pinned_fingerprint` to the opened position, and the no_trade / absent-Accept rule —
  needs to be built out and QA'd as its own feature. **Held OUT of the structured-display change** (owner:
  "don't wire Accept yet"). Sim-side precursor to §D "Ghost-trade → real path". *Value H (closes the
  read→track loop) · Effort M.* Decision-impact cull: passes (turns an AI read into a tracked, reviewable
  paper position). **Invariant watch:** `no-real-order-path` (sim-only), `additive-keeps-score-byte-identical`,
  `best-effort-isolated-or-null`.
- **Convexa-redesign — full FE re-skin program** — `✓ SHIPPED + ARCHIVED (2026-06-30)` → `_archive/convexa-redesign/`; merged to `main` (GATE S). All surfaces re-skinned to the Figma DS + theme/token bridge + app-wide contained-button treatment; `NO_BACKEND_CHANGE`; QA PASS (nx test 425/425, `nx build` green, invariants hold). Owner-dropped the `/auth` full-page route. Deferred quick wins → §B "Ticker UX quick wins". Owner Figma follow-up (publish/update the MUI kit + dark-mode frames) is design-file work, not code. Seams → OPEN_THREADS §7l. *(historical scope notes below, retained:)*
  The `convexa-redesign` branch now re-skins the **Ticker** surface to the Figma DS in code: `TickerDashboard`
  componentized into `ticker/sections/*` (Toolbar, Header, LiveTape, DealerPositioning, GexStrikeProfile,
  TermStructure, FreshPositioning, OffExchangeBlocks, Setups, StatTile, TintChip) + the AI-rec panel re-skin
  (signed-in + signed-out states). GEX is a **vertical** diverging bar chart; Term-structure sits **side-by-side
  with AI-rec** (equal-height row); section titles use the DS size via `theme.h6` (Inter Semi Bold 16).
  `nx test dashboard` 412/412, lint clean. **Pending follow-ups:**
  - **MUI-kit publish/update (OWNER UI — can't be scripted):** Foundations is now the full MUI palette (76 vars,
    Dark/Light) and the kit's `palette/*` aliases it. Owner must **Publish** the MUI kit (file `eJ9qzhA6rNxwk2KVQA9AvU`)
    → **Update** the library in the design file → then set the `Screens - *` frames to the kit's **dark** mode.
    Until then, MUI-kit instances on the screens don't inherit the brand theme.
  - **Token-binding retrofit + cleanup:** bind the remaining ticker/shell components to Foundations `color/*` +
    `Type/*` per `THEME_TOKENS.md` (Toolbar is the done template); **remove the now-dead `HandoffDialog`** in
    `personas/components.tsx` (AI-rec no longer opens it — the hand-off viewer was removed per owner); **update
    `THEME_TOKENS.md`** to record the expanded Foundations + kit aliasing; **QA the global `theme.h6` 16/600 change**
    for regressions on Positions/Settings/Landing section titles.
  - **Ship:** a fresh **QA pass** vs `design_handoff_convexa_redesign/README.md` ACs + the 8 invariants;
    **merge `convexa-redesign` → main** (GATE S). *(Full-page `/auth` route DROPPED by owner 2026-06-30 —
    the existing `AuthDialog` modal stays the sign-in/signup surface; never built, nothing lost.)*
    *(GATE V cleanup pass committed `82f63ee` 2026-06-30: token de-drift ×4 + removed dead HandoffDialog;
    `nx test dashboard` 412/412. All code surfaces now done.)*
  - **Intentional Figma deviations (record, don't "fix"):** GEX is a **vertical** diverging bar chart (not the
    horizontal Figma `149:172`) — owner UX call (wider/shorter); the AI-rec **hand-off viewer** + the ticker's
    **portfolio/ghost-trade panels** were **removed** per owner. *Value H (ship the redesign) · Effort M.*
    Decision-impact cull **N/A** (FE redesign program; judged on design-conformance + ship-readiness).
- **`vol_regime` — a display gap, NOT dead wire (do not "clean it up")** — `TRACED 2026-07-16 (hygiene
  <!-- atlas: theme=trust-the-signal horizon=later -->
  batch), reclassified from the test-migration's "gap or dead wire?" flag`. End-to-end verdict:
  `vol_regime` (`iv_rich`/`iv_cheap`/`neutral` off IV/HV, `signals.py:129-135`) is **computed and consumed
  three real ways** — (1) **folded into `state_fingerprint`** (`signals.py:271` — so REMOVING it changes
  the fingerprint, which `[score-change-is-deliberate-and-measured]` forbids as a side effect); (2) shipped
  verbatim in the **AI export** the LLM reads (`ai_recommendation.py:497-499`; the glossary tells the model
  to read it); (3) **captured in the outcome-ledger `entry_context` digest** (`captureDigest.ts:85`). The
  ONLY missing consumer is a UI surface — no widget renders it. **If wanted:** a small labeled read beside
  the IV-skew/vol tiles (a natural GATE V quick win; the closed-lookup + `[digested-labels-not-raw-dump]`
  pattern applies — render the wire token, never re-derive from IV/HV). *Value M-low · Effort S.*
  **⚠ Standing guard: any future "dead code" sweep that proposes deleting it is wrong** — the fingerprint
  coupling makes removal a scoring-basis change.
- **Ticker UX quick wins (deferred set)** — `RAISED 2026-06-30 (owner; "any quick ux improvements?")`. Small,
  <!-- atlas: theme=trust-the-signal horizon=now -->
  FE-only, display-only usability touches on the Ticker page. **Big-number formatting + a freshness indicator
  were BUILT this session** (GATE V on `convexa-redesign`); the owner deferred the rest here:
  - **Distance-to-spot on the key levels** — ✓ **SHIPPED + ARCHIVED 2026-08-11** as
    `distance-to-level-tiles` (QA PASS 5/5; prod on `main`).
  - **Recent / quick-pick ticker chips** — ✓ **SHIPPED + ARCHIVED 2026-08-11** as
    `recent-ticker-chips` (QA PASS 8/8; pins SPY/QQQ/NVDA + durable recents under Command Deck).
  - **Sticky condensed header on scroll** — pin a slim ticker + price + live-status bar once the user scrolls
    into the chart/tables, so the anchor context isn't lost on a long page. *Value M · Effort S–M.*
  - **Ticker input ergonomics** — auto-uppercase, Enter-to-load (already wired via `onSubmitSymbol`?), focus
    state, maybe `/`-to-focus. *Value M-low · Effort S.*
  Decision-impact cull **N/A** (UX-polish class; judged on daily-use friction). All honor display-only +
  `[live-vs-static-isolation]` (live values still freeze/dim on an SSE drop).
- **Prerender public pages (SSG) + SEO hygiene** — `RAISED 2026-06-29 (post-launch optimization; SSR evaluated
  <!-- atlas: theme=reach horizon=later -->
  + rejected)`. Optimize first-paint + SEO for the PUBLIC pages WITHOUT full SSR (which was evaluated and
  rejected: a Vite-SPA→Next/Remix/Vite-SSR migration + a per-request render server would break the free
  static Cloudflare Pages model, and the app's value — live GEX charts/SSE/per-user positions/auth — is
  inherently client-side/private and can't/shouldn't be crawled, so it hydrates client-side regardless).
  **Scope:** (1) **prerender the landing page** (and the `docs/blog` post if we surface it) to static HTML at
  build time — e.g. `vite-react-ssg` or a small prerender step — so it's crawlable + paints instantly, while
  the app pages (ticker/positions/settings) stay the CSR SPA; (2) **SEO hygiene** regardless of rendering:
  per-page `<title>` + meta description, **Open Graph/Twitter-card tags** (link previews), `sitemap.xml`,
  `robots.txt`, semantic HTML on the landing page. Stays free-static on Cloudflare Pages (no render server);
  Pages supports adding true SSR via Functions later if ever needed. *Impact:* the landing page is the only
  SEO-relevant surface (the app is a private/interactive tool) — this captures ~all the SEO + first-paint
  upside at a fraction of SSR's cost. Decision-impact cull **N/A** (UX/marketing/infra class). *Value M (SEO/
  first-impression) · Effort S–M.* **Do after launch** (deploy first). Origin: owner SSR question 2026-06-29.
  **SCOPE REDUCED 2026-07-16 (the /blog ship changed the math):** Phase 1 (meta/OG/robots/sitemap) is
  SHIPPED. The checkpointed Phase-2 plan (`~/.claude/plans/we-are-concerned-with-shiny-pnueli.md`) weighed
  two forks — the invasive `vite-react-ssg` route (`RouteRecord[]` rewrite of `app.tsx`, the entry every
  test renders through, + a hand-written Emotion SSR collector) vs a lightweight custom prerender script.
  The `vite-react-ssg` fork was justified by "a growing marketing section" — but **the blog now ships as
  static HTML in `public/blog/` (already crawlable, no pipeline)**, so Phase 2's real remaining target is
  **the landing page alone**, which strengthens the lightweight fork: a small prerender step for `/` only,
  router untouched, tests unthreatened. The Emotion critical-CSS collector is still the hard part either
  way. Do on a branch; update the checkpointed plan when picked up. (The plan's "og-image.png never
  created" note is itself stale — the file exists in `public/` since 2026-07-13, 85KB. Verified.)
- **Containerize each app (Dockerfile per deployable) + deployment readiness** — `RAISED 2026-06-25
  (owner; hosting/deploy planning)`. One `Dockerfile` per deployable — the **FastAPI backend** (`apps/api`,
  uvicorn) and the **React/Vite frontend** (`apps/dashboard` → static build, served via a CDN/static host
  or an nginx container) — plus an optional `docker-compose.yml` for a one-command local full-stack run. In
  the **Nx monorepo** each app sets its own build context/root. *Impact:* makes the **host a swappable
  decision** (the same container runs on Railway / Render / Fly.io / Cloud Run / a Hetzner VPS) — the key
  anti-lock-in move; **prerequisite for any real deployment.** *Value M (deployment readiness) · Effort M.*
  **Build-system/infra class — trading-decision cull N/A** (judge on deploy portability, not trading edge).
  **Context:** **GitHub** chosen as the remote git host (2026-06-25; *remote not yet created/pushed* — the
  repo is still local-only). Relates to the **go-live trigger** (re-promotes the Security/red-team role
  system-6) + the hosting options weighed this session (Cloud Run / Railway / Fly / Hetzner+Coolify;
  frontend on Cloudflare Pages / Vercel / Firebase Hosting). Follow-on: a GitHub Actions CI/deploy workflow
  (run `nx test` + conformance on push, then deploy).
- **Live gamma-flip anchoring** — outside RTH, anchor the flip search to `gex_spot` (close) not the
  live mid, so a gapped pre-market anchor can't select a different crossing; also drop the per-tick
  `Gamma flip $…` INFO log to debug. *Impact:* a steadier, more consistent displayed flip across
  sessions. *Value M-low (you've said the displayed flip is fine) · Effort S.* Cleanliness. (`OPEN_THREADS` §7)
- **Wall-selection distance/DTE guard** — keep a deep-OTM round-number LEAP strike from becoming
  "the wall" far from spot. *Impact:* wall levels stay near the tradable zone. *Value M · Effort S.*
  **Invariant watch:** walls stay the gamma-based max/min net-GEX strike — a guard, not a redefinition.
  Bite only if it shows up live. (`OPEN_THREADS` §7)
- **Decision-Ledger crossing-detection hook** *(methodology/tooling — not a trading feature)* —
  <!-- atlas: theme=the-machine horizon=later -->
  mechanize the DETECT step of compounding memory: a `settings.json` hook (or small script) that
  tallies `DECISION_LEDGER.md` keys and flags when one crosses the promotion threshold (≥3 shipped
  features / ≥2 if binding), so at GATE S the Orchestrator is *told* "key X just crossed" instead of
  tallying by hand. *Impact:* orchestration reliability — a promotion can't be silently missed; the
  compounding loop fires even on a tired/long session. *Value M · Effort S.* **Note:** the
  decision-impact cull (trading-decision test) is **N/A** here — judge it on loop-fidelity, not edge;
  the promotion *judgement* + prose still stay with the Orchestrator (the hook only counts). Follow-on
  to the just-shipped Decision Ledger (`.spire/clusters/tech/context/DECISION_LEDGER.md`; ORCHESTRATOR §3a).

- **Engine higher-order-greek determinism** — `✓ RESOLVED 2026-07-02 (folded into dealer-flow-projection)`:
  the charm/vanna/volga aggregation moved from naive `+=` to `math.fsum` (order-independent), scoped away
  from every scoring sum; byte-identity re-proven. Retired the latent item — elevating net_charm/net_vanna
  into an AI-consumed projection was the pull. *(original note:)* `SURFACED
  2026-06-25 (ticker-load-experience GATE Q)`. `engine.process_gex_profile` shows ~9th-significant-digit
  float reduction-order jitter in `net_vanna`/`net_charm`/`net_volga` across identical inputs (a pre-existing
  Python accumulation-order artifact, independent of the pre-warm/concurrency work). *Impact:* none observed
  on the trading path — `opportunity_score`, all score inputs (`net_gex`/`gamma_flip`/walls/`max_pain`/
  `put_call_ratio`), and `state_fingerprint` are byte-stable; only the three display-only higher-order greeks
  jitter sub-visibly. *Fix:* a deterministic reduction (e.g. sorted/Kahan/`fsum` accumulation) in the GEX
  pass. *Value L · Effort S.* **Decision-impact cull N/A** (correctness hygiene). Park until it ever surfaces
  visibly; not blocking.

### C. Strategic / blocked (high value, gated on a decision or heavy lift)

- **Parked cluster (deep-research 2026-08-28) — do not re-derive as emergencies** —
  <!-- atlas: theme=trust-the-signal horizon=later -->
  Squeeze / short-interest scanner (SI% not in-tier; OptionWalls squeeze ≥70 median **+0.15% / 5d**);
  Benzinga earnings add-on (dates for the 69-name universe are already curated JSON);
  breaking-news / press terminal (new vendor + liability);
  RL on `opportunity_score` (N is a rounding error; non-stationary; costs eat the edge);
  indices asset class (`I:VIX`/`I:SPX` — ETF proxies instead);
  P7 vendor hist-chain (snapshot Plan History = not applicable; do not buy a second options history product
  to paper over prune);
  public SaaS / billing before ledger N and written licensing.
  Full scoring: `docs/briefings/product-roadmap-2026-08-28.html`.

- **HORIZONTAL SCALE — get the caches out of the process** *(owner-raised 2026-07-28; **owner flagged
  STAGE 3 as the one they were thinking about**)* —
  <!-- atlas: theme=the-machine horizon=later -->
  Captured from a design conversation so it can be picked up cold. The owner's question was: *"Can't we
  just save the results of the Massive calls? How will my app ever be scalable?"*

  **First, a correction that changes the framing.** The security review and my own earlier summary
  described unthrottled vendor routes as a risk to "the Massive bill". `OPEN_THREADS` §1 says Massive is
  **~$200-400/mo FLAT per asset class**, not metered per call. So the real exposure from abuse is
  **exhausting the vendor's rate limit** — which breaks the app for real users while it happens — not a
  runaway invoice. Fix it for availability, not for cost.

  **WHAT ALREADY EXISTS (four layers, verified in code 2026-07-28):** `_cache` — the finished bundle,
  keyed `(ticker, min_dte, max_dte)`, **60s TTL, in-memory** · `_snapshot_cache` — full chain per ticker,
  in-memory · `chain_store` — the chain a live SSE session already fetched, reused by cold page loads
  (this is what took a cold load **7.8s -> 1.2s**), **process-local by its own docstring** · `_inflight` —
  request coalescing, so 50 simultaneous SPY requests cost **one** vendor call · `ScanStore` — the
  scanner's rows, **disk SQLite (default) or Postgres, i.e. the ONLY cross-process persistent one.**

  **THE ACTUAL BLOCKER — and it is not the vendor.** Every layer above except `ScanStore` lives inside
  ONE Python process. With one Railway container that is fine. With two: each has its own cold cache so
  vendor calls **double**, two users get **different answers** depending which container they hit, and
  every deploy throws all of it away. **The app cannot scale horizontally today** because the memory is
  in the wrong place, not because Massive is slow.

  **Separate the three problems people conflate as "scale":** (1) *vendor pressure* — how often you ask
  Massive; caching solves it, largely DONE. (2) *latency* — how fast one user gets an answer; caching
  solves it, largely DONE. (3) *concurrency* — how many users at once; **caching does not touch this.**

  **THE STAGES, in the order to actually do them:**
  - **Stage 1 — move the bundle cache out of the process** (Redis, or a Postgres table). One vendor call
    then warms EVERY replica, restarts stop going cold, answers become consistent across containers.
    The single unlock, and smaller than it sounds: `_cache` is already cleanly keyed and coalescing
    already exists. *Value H · Effort M.*
  - **Stage 2 — precompute the popular set.** Generalise the pattern already shipped twice: the scanner
    sweep worker computes off the request path into a store. Keep the top ~50 tickers permanently warm so
    a user request is a STORE READ, not a vendor call. **Already blessed by canon** — the narrowed
    "single-ticker, on-demand" decision says the request path computes one ticker while multi-ticker
    compute happens in a bounded off-request worker writing a side-store (`OPEN_THREADS` §9).
    *Value H · Effort M.*
  - **Stage 3 — SSE fan-out. <- THE OWNER'S INTEREST.** Each live ticker holds a Massive websocket **per
    process**, so three replicas = three sockets for the same symbol. Pattern: ONE subscriber process per
    ticker publishing to Redis pub/sub, web processes merely relay. This is also where the still-open
    **S5c SSE connection ceiling** lands (`docs/TECH_DEBT.md`; the last genuine MEDIUM from the security
    review, and the one that can take the CURRENT single container down). *Value H · Effort L.*
  - **Stage 4 — leftovers.** Per-admin AI metering counters are process-local (already noted, §7j).
    Positions/saved views are still browser-local and unsynced (§7c).

  **THE CONSTRAINT THAT MUST SURVIVE ALL OF IT:** do not buy scale with staleness. This is a trading app —
  a ten-minute-old gamma profile presented as current is **worse than a slow one**. The shipped design
  already takes this seriously (stale flags, freshness metadata, `[live-vs-static-isolation]`). A shared
  cache must store **data plus its age**, and the UI must keep telling the truth about it.

  **Decision impact:** none today — it improves no trading decision at one user. It is a *capacity*
  item, and the honest trigger is **a second replica or genuine concurrent users**. Doing Stage 1 now
  would be premature; doing Stage 3 now is premature EXCEPT for its safety half (the S5c ceiling), which
  protects the single container that exists. **Recommended order if picked up: S5c ceiling first (small,
  protects today), then Stage 1 (the unlock), then 2, then the rest of 3.**
  **Invariant watch:** `additive-keeps-score-byte-identical` (a shared cache must not become a second
  transform — `compute_ticker` stays the sole one, same `market_data` in => byte-identical bundle out) ·
  `live-vs-static-isolation` · `best-effort-isolated-or-null` (a cache miss/outage degrades to a vendor
  fetch, never an error).
- **`tradeable-rec-inputs` — the AI cannot fill its own output schema (24-item program)** —
  <!-- atlas: theme=trust-the-signal horizon=next -->
  `LOGGED 2026-07-27 (owner-supplied downstream-AI analysis + conductor viability triage)`. **Source:** a
  downstream AI session that consumed real bundles (TSLA/NVDA) and reported back what it could not answer.
  **Tier 1 (items 1+2+3) → ✓ SHIPPED + ARCHIVED 2026-08-13** as `tradeable-rec-inputs` (chosen at GATE I
  2026-08-12; OPEN_THREADS §7ad). Items 5 (liquidity hard filter), typed machine-readable size, per-quote
  age, and the broker-book source were explicitly future-dated at that ship; the rest of the program
  stays pooled here and graduates via the normal cull.
  **The core finding (accepted as correct):** the rec output schema demands `max_risk`, `position_size`,
  `exit_plan.target`, `exit_plan.stop`, and **the bundle contains nothing that can fill them with a real
  number** — no candidate option prices, no account size, no expected move. *"That's not a tuning problem,
  it's a missing-input problem."* Everything in Tier 1 exists to close that gap.
  **⚠ Two caveats the source flagged and this entry preserves as binding framing:** (1) **more data should
  NOT convert most `no_trade`s into trades** — at least two of three observed `no_trade`s were correct on
  the merits; better inputs should mostly make `no_trade` *better-argued*. **If adding fields suddenly makes
  everything a trade, something is wrong.** (2) Once outcome data exists, **overfitting becomes the main
  risk** — with 24 new inputs and a few hundred verdicts you can find a rule that fits all of them and
  generalizes to nothing. Hold out data, prefer few parameters, distrust any setup whose hit rate improves
  every time a condition is added. *(This is the same discipline `score-change-is-deliberate-and-measured`
  encodes.)*

  **CONDUCTOR VIABILITY TRIAGE vs Massive usage (the owner's question).** Headline: **most of this needs NO
  new vendor spend.** The chain snapshot we ALREADY pull per ticker carries **OI + greeks (Δ/Γ/Θ/V) + IV**
  (CONTEXT §4) and **per-contract NBBO** (`OptionContract.quote` off Massive `last_quote`, added at
  trade-tracker-sim **with no new fetch**), and daily bars were extended **60→400 sessions** at
  ai-context-pack. So the dominant Tier-1 blocker is an **EXPOSURE + PAYLOAD problem, not an API-quota
  problem** — we are already paying for the data and discarding it at serialization.
  - **✅ Viable now, no new vendor call — derive/expose from the chain + bars already fetched:**
    **1** candidate quotes/greeks (the "single largest blocker" — it is re-exposing what
    `/api/contract/{ticker}` already resolves, widened from one held contract to a ±15% strike band; the
    real cost is **bundle size + AI context window**, and it likely needs its own endpoint rather than
    riding the bundle) · **3** expected move (ATM straddle, computed from the chain) · **5** liquidity gate
    (spread% from the NBBO already on the port — a **hard filter**, not context) · **6** historical move
    distribution (400d of bars) · **7** `local_net_gex` · **8** gamma-pocket structure · **9**
    outlier-robust HV (pure math on bars) · **11** enforced DTE window · **13** net sign carried with
    `peak_gex_strike`.
  - **✅ Viable, no vendor dependency at all (our own state):** **2** account/risk block (owner-entered;
    `open_positions[]` largely exists client-side in the sim portfolio — **note it must NOT drag in a real
    order path**, `no-real-order-path` still binds) · **12** level persistence/age · **14** day-over-day ΔOI
    · **16** skew rank · **17** variance-risk-premium history · **18** multi-session GEX history · **21**
    level-test history. **All of these are ACCUMULATION features** — they need a persistent side-store, and
    the pattern is already shipped twice (`src/marketdata/` for iv-rank, `src/scanstore/` for scanner). Cost
    is storage + a write-through, not API calls.
  - **⛔ NOT viable as specified — hard vendor blocker (recorded, do not re-probe):** **10** IV-rank
    *backfill* of 252 sessions. **Massive provides NO historical IV** (the exact finding that forced iv-rank
    into live accumulation). The compelling form is unreachable; the only path is to keep accumulating in
    the existing `IV_STORE` and wait. The item's *underlying* complaint stands though — until `iv_rank`
    populates, `vol_regime` rests on one fragile HV comparison, which is precisely why **9** should come
    first.
  - **⚠ Reshape required — index data is `NOT_AUTHORIZED` on this plan:** **19** index/sector context.
    `I:VIX`/`I:VIX9D`/`I:VIX3M`/`I:SPX`/`I:NDX` all return "upgrade your plan" (probed 2026-07-06 — **do NOT
    re-probe**). **ETF proxies ARE in-tier**: SPY/QQQ for index regime, **SMH for NVDA's sector** (already
    in the scanner universe). This is the same reshape already recorded for the parked `market-backdrop`
    item — the two should be built together.
  - **⛔ PARTIALLY BLOCKED — probed live 2026-07-27, result recorded (do NOT re-probe):** **4** event
    calendar. The SDK exposes `list_benzinga_earnings`, but our plan is **`NOT ENTITLED`** —
    `BadResponse: {"status":"ERROR", "error":"You are not ent[itled]..."}`, the same class of block as the
    index data. **`list_dividends` returned OK**, so **ex-div dates ARE in-tier**; `list_splits` /
    `get_market_holidays` / `list_tmx_corporate_events` are adjacent and presumably in-tier (untested).
    **Scheduled macro (FOMC/CPI/PCE/NFP) is not a Massive product** in any case. So item 4 splits:
    **ex-div ✅ now · earnings ⛔ (plan upgrade OR a second source) · macro ⛔ (second source)**. Earnings is
    the *highest-value* piece — it is the dominant scheduled vol event for a single name and the whole point
    of flagging "this expiration contains an event." **Knock-on: 15 (event-adjusted forward IV) inherits the
    block**, since stripping event premium requires knowing the event. Treat 4+15 as one **blocked-on-vendor**
    cluster alongside `market-backdrop`.
    **⚠ CORRECTED 2026-07-27 (owner) — this is NOT a "tier upgrade" and must not be recorded as one.** The
    owner already holds the **top personal plan on both lines he needs — Stocks $199/mo AND Options
    $199/mo**. Paying more on those lines buys nothing here. Massive/Polygon sells **per-asset-class
    subscriptions plus add-on data products**, and the two rejections are *different product lines*, not
    higher tiers of the ones we own: **indices** (`I:VIX`/`I:SPX`/`I:NDX`) is a **separate asset-class
    subscription**, and **Benzinga earnings is a separate add-on entitlement**. Our probe evidence matches
    exactly that shape — the same key succeeds on every stocks + options endpoint and is rejected on
    precisely those two. So the real decision is **"buy an additional product line?"**, and for both the
    answer is probably **no**, because the workarounds are strong:
    · **Index/sector context (19) → use ETF proxies** (SPY/QQQ + SMH), already the recorded `market-backdrop`
    reshape and already in the scanner universe. Full coverage, zero new spend.
    · **Earnings dates (4) → owner-curated config.** Earnings dates are not exotic data. For a **bounded
    69-name universe** this is the *same shape as `universe.json`* — a checked-in, git-reviewed file
    refreshed roughly quarterly — or a cheap second source. Note this also **decouples the event calendar
    from Massive entirely**, which is the more robust outcome regardless of entitlement.
    Only **historical average move per event type** (the enrichment half of item 4) genuinely wants a data
    provider; the *dates* do not.
  - **🔁 Substantially ALREADY SHIPPED — do not rebuild:** **22/23/24** (outcome logging, setup hit rates,
    gate backtest). `outcome-ledger` shipped 2026-07-16 and already computes hit rate + mean per-trade
    return + dispersion by **tier · AI-rec · setup · IV-rank band · persona**, with `N_min=20` + Wilson
    intervals and a deliberate anti-window-shopping design. The genuine gaps vs this ask are: keying
    verdicts to `state_fingerprint` with **+1/+5/+10-day and expiry marks**, and **feeding the resulting
    base rates back into the prompt** (23) — currently the ledger is deliberately **off the AI prompt in
    v1**, so that is a scope reversal to make consciously, not incidentally.
  - **🐞 Bug, not a feature:** **20** — `net_flow` reported **null**. `src/core/live.py` computes a rolling
    signed net flow and it is a shipped SSE field; if it is null in the bundle export that is a **defect to
    diagnose before designing signed-flow enrichment**. (The *aggressor-estimate upgrade* — trade vs
    bid/ask — is separately viable: we already consume both the trade tape and NBBO.)

  **Recommended build order (source's, adjusted for the triage):** **1 + 2** first (the difference between
  "no trade with reasoning" and "trade with a number") → **3** (makes targets defensible; **4** slips behind
  it pending the probe) → then the three concrete bugs the snapshots exposed: **7** (the NVDA
  chain-wide-positive / locally-negative inversion), **9** (TSLA — one session was ~39% of HV30 and flipped
  `vol_regime` on an artifact), **11** → then **20**'s defect → then **22/23** on top of `outcome-ledger`.
  **Invariant watch for any feature cut from this:** `additive-keeps-score-byte-identical` (every item is
  AI-context/display unless an explicit score-changing feature is declared — see
  `score-change-is-deliberate-and-measured`) · `best-effort-isolated-or-null` · `digested-labels-not-raw-dump`
  (**Tier 1 item 1 is in direct tension with this** — a ±15% strike band across expirations is close to the
  raw dump the rule forbids; it likely belongs behind its own endpoint the AI pulls deliberately, NOT on the
  bundle) · `model-read-carries-its-assumptions` (expected move, distributions and hit rates must each carry
  window/basis/sample count) · `no-real-order-path` (item 2 adds sizing context, never execution).
  *Value **H** (this is the gap between advisory prose and an actionable, risk-sized rec) · Effort **XL** as
  a program; several items are individually **S**.* Trading-decision cull: **passes emphatically** — it is
  the difference between a rec you can act on and one you cannot.
- **Business viability / monetization de-risking** — `RAISED 2026-06-30 (owner; carried from RESUME 7m
  <!-- atlas: theme=go-live horizon=later -->
  closeout)`. Before monetizing (freemium SaaS, serious-small-business ambition), 3 cheap de-risk actions,
  research done: (1) get **Databento/ORATS commercial derived-data redistribution** terms — the current
  Massive/Polygon license **forbids** the redistribution a paid product needs (the hard blocker); (2) a
  **securities-counsel consult** on the AI-rec framing (impersonal-advice / publisher's-exclusion posture);
  (3) a landing-page **waitlist demand test** (cheapest signal, do first, pairs with the §B prerender/SEO
  item). *Impact:* determines whether/how the product can be sold at all. *Value H · Effort S–M (mostly
  legal/comms, not build).* **Decision-impact cull N/A** (business/strategy class). **Blocked-on:** owner
  pursuing the vendor-license + counsel conversations — a decision/diligence gate before any monetization build.
- **Data-vendor decision + overnight coverage** — Massive vs Databento (Blue Ocean overnight, full
  <!-- atlas: theme=go-live horizon=later -->
  OPRA) vs Webull (cheap overnight underlying, no options). *Impact:* unlocks the overnight price gap
  — the core coverage hole. *Value H · Effort L.* **Blocked-on:** the cost/eval decision itself
  (verify whether Databento Standard $199 includes Blue Ocean). This is a *decision* before a build.
  (`OPEN_THREADS` §1/§2/§9)
- **Multi-session dark-pool accumulation map** — beyond the current bounded recent window; needs a
  <!-- atlas: theme=breadth horizon=later -->
  heavier batched pull. *Impact:* see block accumulation across sessions, not just the last hour.
  *Value M · Effort L.* Future. (`OPEN_THREADS` §7/§9)
- **Flip fixed-IV-under-spot-move modeling** — the latent choice of holding IV fixed while repricing
  <!-- atlas: theme=trust-the-signal horizon=later -->
  across the spot grid in the flip search. *Impact:* flip fidelity. *Value TBD · Effort L.*
  **Blocked-on:** measure the divergence first before any calibration (per §9 — judged immaterial so far).
- **`gamma-unification` — own analytic gamma for the walls (consistent flip)** — `RAISED 2026-06-25
  <!-- atlas: theme=trust-the-signal horizon=later -->
  (owner); MEASURE-FIRST`. Today walls/net-GEX use **vendor** gamma (`engine.py:316`) while the flip +
  vanna/charm/volga use our **analytic** BS gamma (`engine.py:_calc_gamma`/`_gex_curve`) — the documented,
  locked `gamma-sourcing-split`. Owner wants them unified (one gamma model → walls & flip consistent),
  enabled by the advanced real-time tier (full chain + fresh IV) and de-blocking the Databento path (no
  vendor greeks). *Impact:* consistency + vendor independence. *Value M-H · Effort M (impl) + S (spike).*
  **Step 1 (owner-decided): a MEASUREMENT SPIKE** — compute analytic gamma alongside vendor gamma, quantify
  wall/net-GEX/flip divergence on real tickers (needs a live `MASSIVE_API_KEY`). **Then** GATE Z reopen/
  demotion of `gamma-sourcing-split` → GATE M implementation. **Risk:** American-exercise/illiquid-IV model
  fidelity; reopens locked core-math canon (CONTEXT §3 / THREADS §9). Honors §9's "measure before calibrating."

### D. Shipped-feature seams (park until a concrete need pulls them)
- **Ghost-trade → real path** — broker `FillSource`/`PositionStore`, `BundleFeed`+clock replay,
  recorded-verdict reassessment, server-side trade store. *Note:* implies leaving paper-sim for a real
  order path — a deliberate scope shift, not an increment. Park until going live. (`OPEN_THREADS` §5)
- **Observability extensions** — OTel/Prometheus export, latency/headroom alert thresholds,
  persisted cross-restart baselines. *Value M · Effort M.* Pull when operating the service in earnest.
  (`OPEN_THREADS` §6) **Note:** the *local visualization* slice was carved out → `latency-visualizer`
  (§A, promoted 2026-06-23); what remains here is **export + alerting + cross-restart persistence**
  (the parts that imply external infra / going-live ops).
- **Multi-ticker scanner** — the observability baseline data supports it. *Value M · Effort M-L.*
  **Invariant watch:** revisits the deliberate "single-ticker, on-demand" decision (the watchlist scan
  was dropped for being too slow) — re-justify before promoting. (`OPEN_THREADS` §6, `PROJECT_CONTEXT` §5)
- **Persona data single-sourcing (FE↔BE reconciliation)** — the backend ships the canonical
  decomposed template + 7 presets at `GET /api/personas` (transport filed as a late interface
  amendment, after the FE froze), but the FE **embeds** a faithful copy and assembles client-side, so
  the canonical preset/prompt data is **dual-sourced** (drift risk). *Impact:* an operator edit to a
  preset/prompt would reach the AI briefing instead of silently diverging — concrete need = first time
  presets are edited server-side. *Fix:* FE hydrates presets/template from `GET /api/personas`, keeping
  the embedded copy as offline/assembly-failure fallback. *Value M · Effort S.* Behaviour is correct
  today; not blocking. (`OPEN_THREADS` §7)
- **Persona conservative-disposition cleanup** — UX/FE gave `conservative` the *softened* disposition
  text, but the backend Verification required it to contain "prone to greed"; resolved pragmatically as
  a **superset** (harsh phrase + map text). *Fix:* decide whether conservative should be softened-only
  and amend the prompt template + contract if so. *Value L · Effort S.* (`OPEN_THREADS` §7)
- **Persona deferred extensions** — multi-device sync, operator-shared persona library, richer
  customization knobs, per-persona acceptance analytics (decision-history harvest). *Value M · Effort
  M.* Park until a concrete need pulls them. (`OPEN_THREADS` §7)

### E. Methodology / system-of-building improvements *(improve the AI-role system itself, not the trading product)*
- **`contract_lint` M3/M8 deadlock a GATE-I folder** — `NEW 2026-08-12`, **kit-owned** —
  <!-- atlas: theme=the-machine horizon=now -->
  A fresh feature folder at GATE I legitimately holds only `BRIEF.md` + `_MANIFEST.md`; M3/M8 (kit
  v1.0.0) ERROR on the missing `SPEC.md`/`INTERFACE_CONTRACT.md` — the artifacts **GATE C itself
  produces** — so the lint can never pass on the route INTO the council. Observed at
  `tradeable-rec-inputs` GATE I (2 ERRORs, BRIEF/manifest checks clean; judged non-blocking, recorded).
  Kit fix: stage-aware severity — a manifest whose `Stage:` is GATE I downgrades M3/M8 to warn.
  Propose in `KIT_BACKLOG.md`; do NOT edit `contract_lint.mjs` in place.
  **SECOND OBSERVATION 2026-08-14** (`rec-absence-literals-hole` GATE I, **on spire-os 3.13.0** — so
  ten versions did not fix it): byte-identical symptom, 2 ERRORs (M3 `SPEC.md` + M8
  `INTERFACE_CONTRACT.md`), BRIEF and manifest checks clean, judged non-blocking again. The cost is
  not the false ERROR itself but that a **GATE-I folder can never be gate-green**, so the one
  mechanical signal guarding the route into the council is trained to be ignored there — the same
  alarm-fatigue shape as `ci-standing-red`. Recurrence now recorded twice; propose upstream.
- **⚠ `git stash` while lanes run DESTROYS sibling uncommitted work** — `NEW 2026-08-13`, earned the
  hard way at `tradeable-rec-inputs` —
  <!-- atlas: theme=the-machine horizon=now -->
  A build lane hit a stash/pop conflict mid-build, recovered its OWN files via
  `git checkout stash@{0} -- <its files>`, and dropped the stash — which silently destroyed the
  conductor's uncommitted planning-surface edits riding in the same working tree (BACKLOG /
  DECISION_LEDGER / RESUME / IN_FLIGHT — all rewritten from conductor context at GATE S; contracts
  folder survived as untracked). Rule: **no `git stash` in this repo while any other lane or the
  conductor may hold uncommitted work**; prefer targeted `git checkout -- <file>` or a worktree.
  CLAUDE.md trap entry added at the same ship.
  <!-- atlas: theme=the-machine horizon=now -->
  The regex is anchored to the **whole file** (no `m` flag), while `.claude/council/R2-critique.md` only
  forbids content *after* the fenced block. So an `# R2 — …` title fails the gate; two of three voices hit
  it at `score-lab-signal-comparison` GATE C. Stripping the titles then **invalidated the SPEC receipt's
  `conflict_id` hashes** (they hash the R2 **bytes**), needing a second fix round. Either the regex gains
  `m`/a leading-content allowance or the authoring doc forbids a title — one of the two, not both.
  **Propose in the kit's own `KIT_BACKLOG.md` (`C:\Dev\delivery-kit`), not here; do NOT edit
  `contract_lint.mjs` in place** — `kit_lint` aborts an extract on re-coupling. Retained here as this
  project's instantiation + provenance, per the note below.
- **PLAN.md's V5 isolation claim was overstated** — `NOTE 2026-08-12` —
  <!-- atlas: theme=the-machine horizon=now -->
  At `score-lab-signal-comparison`, V5 asserted the `loop.rs` isolation diff carried only the `warn!`; it
  also carried **five cargo-fmt reflow hunks**. Documentation accuracy, not a code defect — but a
  verification step that describes its own expected diff imprecisely is a step that can pass while lying.
> Source: `docs/SYSTEM_ANALYSIS.md` (2026-06-23). The trading-decision cull is **N/A** for this class —
> judge each on **correctness, throughput, or cost of the build system**, not trading edge (same
> convention as the §B Decision-Ledger hook). Sibling already in the pool: the **Decision-Ledger
> crossing-detection hook** (§B) is the DETECT-step mechanization and belongs to this class.
>
> **Roadmap home moved (2026-06-24, system-13):** the **project-neutral** framework roadmap now lives in
> the kit's `KIT_BACKLOG.md` (`C:\Dev\delivery-kit`) — that is the framework's own GATE I pool, groomed
> via the kit-evolution loop (`docs/AUTHORING.md` there). The `system-N` entries below are **retained as
> GammaFlow's instantiation + provenance** (the evidence that earned each one); generic framework
> improvements are proposed/culled in `KIT_BACKLOG.md`, not here.
> **Binding sequencing:** *system-1 … system-6 land before system-9* — automating the conductor before
> the mechanical gates + adversarial roles removes the human review that currently provides
> error-correction (SYSTEM_ANALYSIS §7).

- **system-1 · Interface-conformance check** — `✓ LANDED (2026-06-23, runtime variant) →
  .claude/tools/interface_conformance.py`. Each `INTERFACE_CONTRACT.md` embeds a machine-checkable
  `## Conformance spec` ```json block (endpoints → required field paths/types/presence); the tool hits
  the live backend (`--url`) — or a captured `--sample` for CI/offline — and validates the emitted JSON
  against it (dot-paths, `name[]` array fan-out, `type|null` unions, `?` optional). A FAIL = the live BE
  omits/mistypes a field the interface promises (= what the FE consumes). Wired into **GATE Q** (QA runs
  it; FAIL → GATE Z to Backend) + GATE U·X (interface must embed the spec) + the §3 linter (WARNs if a
  locked interface lacks the block — system-3 ensures the spec EXISTS, system-1 ensures the live
  response MATCHES it). Tested vs the real `/api/_metrics` shape (pass / array-fanout / drift-fail).
  *Value H · Effort M.* **Deferred:** static FE-type cross-check (`@convexa/api` TS vs the interface) — the
  runtime path already proves BE-emits ⊇ interface; FE-consumes ⊆ interface is held by the FE binding +
  the linter's interface-binding check.
- **system-2 · QA / Verify role (a 6th role, with teeth)** — `✓ LANDED (2026-06-23)`: new **GATE Q**
  (ORCHESTRATOR §3, between the executioners and GATE S) + role launch prompt (`ROLE_LAUNCH_PROMPTS.md`
  §6) + subagent (`.claude/agents/qa-verify.md`, tools: Read/Grep/Glob/Bash/Write — no Edit) + manifest
  `QA (GATE Q):` field + the §6 invariant "GATE S requires a passing `QA_REPORT.md`." A fresh session
  confirms each AC point-by-point, **fixes nothing**, bounces gaps via GATE Z; GATE Q re-runs on the
  fix. *Impact:* ends "builders mark their own homework." *Value H · Effort M.* **Invariant watch:** QA
  stays in lane (verifies, never repairs). **Best run on a DIFFERENT model** than the builders — partial
  down-payment on system-6 (correlated-error fix).
- **system-3 · Contract linter (mechanical gate-check)** — `✓ LANDED (2026-06-23) →
  .claude/tools/contract_lint.py`; wired into ORCHESTRATOR §0 step 7 (runs every gateway, ERROR blocks
  the handoff). **Implemented checks:** _MANIFEST present + required keys; files the manifest marks
  locked/draft exist; execution contracts bind to INTERFACE_CONTRACT (NO_*_CHANGE stubs exempt); BRIEF
  has all required fields; NEW-endpoint-in-architect/PM-lane flagged (existing endpoints exempt via
  ground-truth); server-internals-in-FE / UI-in-BE lane-purity warns; promoted-canon single-source
  (every ledger Promoted key has prose in PROJECT_CONTEXT §5). *Value M · Effort M.* Pairs with the
  §B ledger-crossing hook (same script surface). **Deferred extensions:** AC↔component-state mapping
  check (now tracked + broadened as **system-10**, re-scoped 2026-07-16 to AC↔verification-**evidence**);
  optional `settings.json`
  PreToolUse/Stop hook to auto-run it (offer made); the legacy 4 archived features predate `_MANIFEST.md`
  (flag only on `--all`, not on live gating).
- **system-4 · Lane enforcement via role subagents** — `✓ LANDED (2026-06-23, tools-allowlist half)`:
  `.claude/agents/{delivery-architect,delivery-pm,delivery-ux,delivery-backend,delivery-frontend}.md`
  + the earlier `qa-verify.md`. Contract authors (architect/pm/ux) + QA have **no `Edit`/`Bash`** (cannot
  modify or run code); executioners get the build toolset (Read/Grep/Glob/Edit/Write/Bash). Wired into
  ROLE_LAUNCH intro + ORCHESTRATOR §1/§6. *Value M · Effort M.* Keeps each role's fresh-context
  isolation (subagents start clean).
- **system-4b · PreToolUse path-guard hook** — `✓ LANDED (2026-06-23) → .claude/tools/path_guard.js +
  .claude/settings.json`. `↻ UPDATED by the monorepo merge (2026-06-24)`: now a single **workspace
  fence** (`path_guard.js`; the Python `path_guard.py` is retired as a tool). A PreToolUse hook on
  `Write|Edit|MultiEdit|NotebookEdit` blocks any write whose resolved target is OUTSIDE the monorepo
  root (exit 2), with carve-outs for `~/.claude/projects/**/memory` and `~/.claude/plans` (Reads are
  never blocked). Tested; fail-open on malformed input. **Scope honesty:** a session-global hook can't
  see WHICH role/subagent is active, so it enforces the **out-of-workspace** fence robustly but NOT
  per-role intra-lane rules (e.g. "the architect can't touch `src/`") — that residual stays on the
  tool-allowlist (no `Edit`) + the role prompt. **Cross-repo fence + the convexa mirror are now
  N/A** — both lanes share one repo, so there is no second repo to fence against or mirror into.
  Lane separation between `apps/api` and `apps/dashboard` is instead reinforced mechanically by the
  ESLint `@nx/enforce-module-boundaries` rule on the project tags. *Value M · Effort S.*
  **Activation:** new `settings.json` ⇒ open `/hooks` once or restart.
- **system-5 · Ground-truth + ledger sharding (retrieval)** — `✓ LANDED (2026-06-23, logical-slice) →
  .claude/tools/context_for.py`. Each `## N.` section in `PROJECT_CONTEXT.md` carries an inline
  `<!-- shard: tags=...; always -->` annotation; the tool assembles the minimal pack from the BRIEF's
  `Context tags:` (+ Invariant-watch keys) + the always-load invariant floor (§3 math, §5
  decisions/promoted invariants). `--print` emits the pack; `--stat` shows savings (39–72% on current
  features, growing with the canon). **Single-source kept** (logical slice, no physical split → no drift,
  unlike the rejected fork). Added a `Context tags:` BRIEF field (ORCHESTRATOR §4a); wired into
  ROLE_LAUNCH intro + §6 invariant. *Value H (cost) · Effort M–L.* **Invariant honored:** §3+§5 are
  `always` — sharding never drops a binding rule. **Deferred:** ledger sharding (the Promoted-canon
  index is already compact, so minor); auto-deriving `Context tags` from the BRIEF's free text.
- **system-6 · Adversarial Security/red-team role (different model)** — `⏸ DEFERRED until live
  (decided 2026-06-23)`: pre-live, a different-model red-team adds model cost/overhead with low payoff —
  no real data, no external exposure, no untrusted input surface yet. **Re-promote on the "going live"
  lifted-constraint trigger** (handling real funds/data, public exposure, or untrusted external content).
  A session whose whole mindset is "what could be made to go wrong?": least-privilege per role, injection
  from fetched/external content, data leakage — run on a **different base model** so its blind spots
  don't correlate with the builders'. *Impact:* the only structural fix for correlated error (one model,
  all hats — SYSTEM_ANALYSIS §5). *Value H (correctness, once live) · Effort M.* **Note:** the QA role's
  "run on a different model" guidance is a partial pre-payment on the de-correlation benefit.
- **system-7 · Promoted-canon demotion path** — `✓ LANDED (2026-06-23)`: the inverse of graduation. A
  promoted invariant contradicted by reality (an accepted **GATE Z** amendment, or a **GATE Q**
  QA/conformance FAIL proving it false/over-general) is **demoted** — prose removed/narrowed in
  PROJECT_CONTEXT §5 + OPEN_THREADS §9, key moved to the DECISION_LEDGER "Demoted" table with the
  contradicting evidence (earning rows retained as provenance). `contract_lint.py`'s canon check follows
  automatically (a demoted key leaves Promoted-canon). Wired: DECISION_LEDGER "Demoted" section + GATE Z
  "Demotion check" step + §6 invariant. **Bar mirrors promotion:** a one-off feature carve-out is an
  *exception*, not a demotion. *Impact:* stops compounding memory from calcifying a wrong-but-repeated
  decision into law (SYSTEM_ANALYSIS §4.5). *Value M · Effort S–M.*
- **system-8 · Close the flywheel (observability → GATE I)** — add the shipped metrics as a first-class
  <!-- atlas: theme=the-machine horizon=later -->
  GATE I harvest source so Discovery grooms from measured reality, not guesses. *Impact:* the
  build→measure→discover loop becomes real. *Value M · Effort S.* **Depends-on:** `latency-visualizer`
  / the observability readout (§A/§D).
- **system-9-lite · fresh-subagent-per-gateway** — `✓ ADOPTED (2026-06-23)`: run each role as a FRESH
  spawn of its `.claude/agents/delivery-*` subagent (+ `context_for.py` pack), discarded after each
  handoff — instead of long-lived role terminals that accumulate context. Captures the freshness +
  lane-fencing win with **no new infra and human review intact** (the conductor is still you). Wired into
  `ROLE_LAUNCH_PROMPTS.md` ("Running a role — the LITE path"). The on-ramp to full system-9.
- **system-9 · Orchestrator-as-subagent-pipeline + parallel feature lanes** — automate the conductor so
  you *approve* gates instead of *running* them, and run several feature lanes at once (shared
  OPEN_THREADS to avoid collisions). *Impact:* removes the human-as-bottleneck. *Value H · Effort L.*
  **Binding:** do NOT promote before system-1…system-6 land (see the sequencing note above) — this one
  removes the human review the system currently leans on for correctness; the **lite path above is the
  adopted interim** until then.
- **system-10 · Contract-linter AC↔verification-EVIDENCE check** *(was: AC↔test traceability)* —
  <!-- atlas: theme=the-machine horizon=next -->
  `PROPOSED (2026-06-23)` → **✓ RE-SCOPED 2026-07-16 (OWNER DECISION: option (b)); unscheduled.**
  **Why the original went obsolete:** system-10 existed to MECHANIZE the rule "every AC maps to ≥1 named
  colocated test" — but the **2026-07-13 `qa-verify.md` §4 risk-based amendment REPLACED that rule**.
  Verification stays mandatory for every AC; an automated *test* is now required only per the risk-based bar
  (test the invariants / negative space / silently-regressing behaviors; verify visible/intentional things —
  copy, presence — by review/QA, recorded as such). A linter that FAILED an AC lacking a named test would
  enforce **exactly the rule the project deliberately dropped**, re-imposing per-AC mirroring by the back
  door and fighting the in-flight test-migration (§B). *(Rejected alternative, recorded so a later session
  doesn't re-litigate: **(a) CULL** — defensible, since QA judgment + the risk-based bar are the intended
  mechanism; owner chose to keep the mechanization, re-aimed.)*
  **DECIDED SCOPE (b) — evidence, not tests.** Do NOT demand a *test* per AC. Demand that every AC carry a
  **recorded verdict + evidence** in `QA_REPORT.md`: `PASS|FAIL|UNVERIFIABLE` + an **evidence kind** —
  `test:<name>` | `review` | `runtime`. An AC with **no recorded verdict** fails the check; an AC verified
  `review` **passes** (that is the whole point of the amendment). This mechanizes what the amendment
  actually wants — **no AC silently unverified** — without mandating a test.
  *Value M · Effort M.* **Build-system class:** trading-decision cull **N/A** — judge on build-system
  correctness.
  **Sub-steps (in order):**
  1. **AC-id/anchor convention** in `PRODUCT_CONTRACT.md` (stable ids, e.g. `AC-E7`) — the prerequisite;
     the ids already appear informally in QA reports (`AC-E7`, `AC-19`), so this is codifying practice.
  2. **`QA_REPORT.md` evidence schema** — a machine-readable verdict table (id · verdict · evidence-kind ·
     evidence-ref). The current reports are already close to this shape.
  3. **Linter mode** — a QA-invoked mode of `contract_lint.py` that cross-checks every `PRODUCT_CONTRACT`
     AC id against the `QA_REPORT.md` table; unrecorded ⇒ ERROR.
  **Design notes:** runs at **GATE Q (post-build)**, not the inter-role handoffs — it reads the QA report,
  so it can only run once QA has produced one; complements the runtime conformance check (system-1).
  The linter, the FE specs, and the reports live in **one repo** post-merge — no cross-repo read.
  **Precedent that it would have caught:** `byo-ai-key`'s AC-19 named-test gap and `user-accounts`' AC-E7
  server-gate FAIL were both caught by QA judgment alone. Origin: follow-on to the (now-amended) FE-tests
  rule + system-2/3; resurrects system-3's deferred AC↔component-state mapping extension.
- **system-11 · Cross-repo role-context on dispatch** — `✓ RESOLVED by the monorepo merge (2026-06-24)
  — dissolved, not implemented`. The whole problem was an artifact of the two-repo split: dispatching a
  FRONTEND executioner required `spawn_task --cwd` (the Agent tool couldn't cross the path_guard
  cross-repo fence), which **bypassed the role framework** (no `delivery-frontend` subagent, no
  `context_for.py` pack, no role launch prompt, chip named by action not role). Folding the backend
  into the Nx workspace put **both lanes under one repo root**: the frontend lane now spawns as a
  `delivery-frontend` **Agent subagent** with automatic report-back — same role/context discipline as
  every other lane, no `spawn_task`, no polling. The "spawn_task drops the role context" hole is gone
  because spawn_task-for-frontend is gone (ORCHESTRATOR §2). *Outcome:* the parked question is moot.
  **Origin:** raised 2026-06-23 after two *maintenance* tasks were dispatched ad-hoc; the merge
  (plan `ok-let-s-do-option-dapper-treasure`) was the chosen structural fix.
- **system-12 · system-1 standalone-spec standardization** — `DECIDED 2026-06-23 (standalone = canonical),
  <!-- atlas: theme=the-machine horizon=now -->
  partial`. The conformance spec drifted: docs say "embed a `## Conformance spec` ```json block in
  INTERFACE_CONTRACT.md," but the shipped precedent (`.spire/clusters/tech/state/conformance/api_metrics.json`) and the
  ONLY runnable form is a **standalone flat-schema file**. The UX (following the docs) embedded a rich
  nested block the tool can't run — heading `## 3. Conformance spec` breaks system-1's `##\s*Conformance
  spec` regex (yet system-3's linter accepted it: the two **disagree** on detection), and the nested
  enums/conditional/forbidden_fields schema isn't the tool's flat `{path_params,query,body,required}`.
  **Owner decision (2026-06-23):** the runnable spec is a committed standalone `.spire/clusters/tech/state/conformance/
  {feature}.json`; the interface's `## Conformance spec` section REFERENCES it (rich content stays as QA
  reference). **Done:** ai-recommendations interface points at its standalone spec; the backend added
  POST-body support to `interface_conformance.py` (additive, kept; `api_metrics.json` still passes).
  **Remaining (do before the next GATE U·X) — ⚠ THIS LANDS ON `scanner`'s FAN-OUT** (scanner is the standing
  NEXT and is a both-lanes feature, so its GATE U·X is the next fan-out that will hit this; the docs still
  tell the UX to embed a block the tool cannot run, so an un-reconciled scanner interface would repeat the
  ai-recommendations GATE-Z bounce). Reconcile the authoring docs — `COMPRESSOR_PROMPTS #3`,
  `delivery-ux.md`, `ORCHESTRATOR §6 / GATE U·X / GATE Q`, `BACKLOG system-1` — to the standalone
  convention; tighten `contract_lint` M7 to verify the interface references an EXISTING standalone spec
  (it currently only string-matches "Conformance spec"); align the system-1 heading regex with system-3's
  looser detection so they agree. *Value M · Effort S–M.* **Build-system class:** trading-decision cull
  N/A. Surfaced by the backend executioner at the ai-recommendations fan-out (GATE Z).
  **Precedent to copy:** `iv-rank` (the most recent both-lanes feature) shipped a standalone spec
  `.spire/clusters/tech/state/conformance/iv_rank.json` — that IS the convention; the docs are what lag.
  **⚠ REGRESSION 2026-07-27 — kit v1.0.0 INVERTED this, and it now breaks shipped features.** The kit
  sync (`5fcc65a`, made by another session) shipped a rewritten `contract_lint.py` whose **M7 is now an
  ERROR** unless `INTERFACE_CONTRACT.md` carries an **embedded** parseable fenced-JSON block under a
  heading matching `##\s*Conformance spec` — i.e. the linter now *mandates* the very convention the
  owner's 2026-06-23 decision retired. Consequences observed:
  · **Already-shipped, already-QA-passed features now FAIL lint** — `scanner` (2 errors) and `iv-rank`
  (2 errors, its referencing prose parsing as invalid JSON). Nothing about them changed; the gate did.
  · The linter and the runner **still disagree, now in the opposite direction**: `interface_conformance.py`
  supports **both** `--spec` (standalone) and `--contract` (embedded), so standalone specs remain fully
  runnable — only the *linter* rejects them. That is the same system-3-vs-system-1 detection split this
  item was opened for, re-created at higher severity (ERROR, not WARN).
  · v1.0.0 also newly requires a **`SPEC.md`** per feature folder (M8: must carry an "Acceptance criteria"
  section; M3: must name `INTERFACE_CONTRACT.md`) — a reasonable addition, but it retroactively fails
  every archived feature too.
  **Conductor workaround used on `bundle-events` (2026-07-27), NOT a resolution:** the interface keeps the
  standalone spec as canonical and embeds a **`$ref` POINTER object** under a bare `## Conformance spec`
  heading — valid JSON, satisfies M7, and **does not duplicate the spec**, so no dual-source drift.
  Two sharp edges found the hard way and worth knowing: the M7 regex matches a *literal* fenced-json
  marker appearing anywhere in the file's prose (so discussing the rule in prose can hijack detection),
  and it will not match a **numbered** heading like `## 4. Conformance spec`.
  **Real fix (kit-owned, flows via `KIT_BACKLOG`, do NOT edit `contract_lint.py` in place):** teach M7 to
  accept a standalone `.spire/clusters/tech/state/conformance/{feature}.json` as satisfying the rule — ideally by
  checking the referenced file EXISTS, which is the stronger gate this item originally asked for and
  which the current rule still does not provide.
- **system-13 · Framework portability — the delivery-kit extraction** — `✓ LANDED (2026-06-24)`.
  Extracted the reusable framework (orchestrator + role subagents + tools + commands + compressor /
  role-launch docs) out of GammaFlow into a standalone, updatable **delivery-kit** (its own repo at
  `C:\Dev\delivery-kit`), with GammaFlow as **consumer #1**. The decoupling rule: **framework files are
  byte-identical across projects** — all per-project coupling moved into one project-owned seam,
  `.spire/clusters/tech/project.json` (backend/frontend dirs, ports, serve/test commands, interpreter, context
  filename, optional lane-purity), plus `PROJECT_CONTEXT.md` (renamed from the old context file). Tools
  read the seam programmatically; agents/commands read it at runtime; agents renamed `gammaflow-*` →
  `delivery-*`. `install.mjs` / `extract.mjs` forward + sync the framework as a **plain folder copy**
  (the payoff of full externalization), and `kit_lint.mjs` is the **mechanical decoupling guarantee** —
  a banned-token scan that ABORTS an extract if any project specific re-coupled a framework file (the
  same move as `contract_lint` / `path_guard`: mechanize the trusted invariant; it caught a real
  re-coupling during the build). *Impact:* the methodology now compounds **across projects**, not just
  across features within one — a refinement made in any consumer flows back to the kit and out to all
  (a sibling to the Decision Ledger's "get wiser per feature"). *Value H (reuse / maintainability) ·
  Effort L.* **Build-system class:** trading-decision cull **N/A** — judge on framework
  reusability/maintainability.
  **⚠ NEW divergence (2026-07-16, canon review) — the SEVERITY promotion path.** The project's
  `DECISION_LEDGER.md` (project-owned) now promotes a **catastrophic+irreversible** key at 1 instance (or 0
  by owner decision), while the kit's `ORCHESTRATOR.md` §3a/§6 still states the **recurrence-only** rule
  (≥3, or ≥2 if binding). `ORCHESTRATOR.md` is a **framework file — byte-identical across consumers — so it
  was deliberately NOT edited here** (editing it in place is exactly the re-coupling `kit_lint.mjs` aborts
  on). **Action:** propose the severity path in `C:\Dev\delivery-kit\KIT_BACKLOG.md` (the framework's own
  GATE I pool), amend `ORCHESTRATOR.md` there, release, and re-install so the consumer's copy is
  byte-identical again. **Note the write-fence:** `path_guard.js` blocks Write/Edit outside the workspace —
  **touch the kit via Bash.** The generic lesson worth flowing back: *recurrence is a proxy for importance;
  when severity is known, don't wait for the proxy.* Until then the ledger is **ahead of** the framework
  prose — a benign, logged divergence, but it is exactly residual (b) below (divergence reconciliation)
  showing up for real.
  **Open residuals (logged, not built):** (a) **no version-skew signal** —
  `.claude/kit.version` records what a consumer is on, but nothing alerts when it's behind the kit;
  (b) **no divergence reconciliation** — if two consumers refine the same framework file, `extract` is
  last-writer-wins; (c) **`project.json` is a new single point of misconfiguration** the conductor +
  tools now depend on (a wrong/empty seam silently degrades the gates — a `project.json` validator is
  the obvious follow-on); (d) the kit ships **no tests of its own scripts** (install/extract/kit_lint
  verified by hand at extraction). **Relation:** orthogonal to system-9 — portability, not conductor
  automation; **enabled by** the monorepo merge (system-11): one repo root ⇒ no cross-repo fence ⇒ the
  framework is a clean folder. **Origin:** owner request post-merge (2026-06-24).
