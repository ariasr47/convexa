# R1 — ux position: liquid-names-session-capture

## Position

### Product surface verdict

**`NO_UI_CHANGE` for the trader product.** This ship guarantees a session-archive book for
**SPY, QQQ, and IWM** when they are in the paid-capture universe — including when gex-cache is
warm — so next week’s research join can load those names’ Tuesday books. It does **not** add a
route, component, token, motion, Settings row, Ask-AI line, Ticker chip, Scanner badge, or
`/_ops` health chrome. Anyone proposing “we now capture SPY/QQQ/IWM” UI is **re-scoping**.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The
Curvature Terminal). **Design direction:** does not apply — no trader presentation ships; no
`DESIGN_SYSTEM.md` amendment.

Closed operator vocabulary is **already shipped** by `_archive/session-chain-archive/SPEC.md`
§4. This feature **reuses** that vocabulary; it does **not** invent a second one.

### Intended user / primary job (operator research only)

| Axis | Binding |
|---|---|
| **Intended user** | Research operator / owner verifying session books via `/api/_research/session-books/...` (Railway-direct). **Not** the signed-in trader on Landing / Ticker / Positions / Scanner / Settings / Ask-AI. |
| **Primary job** | After an ET session where SPY / QQQ / IWM were scannable or servable, confirm research list/load for `(SPY\|QQQ\|IWM, D)` is a **hit** with mandatory `source_as_of`, zero Massive on the read, and no date substitution. |
| **Information structure** | Same HTTP wire as shipped session archive: hit envelope carries `framing`, `et_date`, `source_as_of`, `provenance`, `license`, `authorizes: nothing` (+ body on load); miss/404 is closed `detail` only. |
| **User vocabulary** | Exact §4 strings from `session-chain-archive` (below). Ban: renaming a miss as “not a lab name,” “lab-only,” “SPY not ensured,” or any warm-cache excuse phrasing. |

### Component states

**Trader path (S0) — one required state: unchanged.**

Warm-cache ensure success, warm-cache ensure skip (identity already present), ensure failure, and
extra off-path Massive (if any) are **all invisible** on Landing / Ticker / Settings / Ask-AI /
Scanner / Positions / shell nav. Trader empty/error/offline/`unavailable this cycle`/`—` copy
does not change.

**Operator research read (S1) — reuse shipped matrix; no new state names.**

| State | When (this feature) | What the operator sees | What must **not** happen |
|---|---|---|---|
| Default (session hit) | After ET day D where SPY/QQQ/IWM were in paid-capture universe, identity `(symbol, D)` exists — **including** when gex-cache was warm all day | Wire: `framing` = `RESEARCH READ — SESSION BOOK`, `et_date`, mandatory **`source_as_of`**, `provenance` = `loaded from session archive · no vendor call`, `license`, `authorizes: nothing` (+ market body on load) | Live badge; Massive on the read; treating warm-cache history as an excuse for miss; treating `source_as_of` as the identity key |
| Loading | **N/A** (HTTP request/response) | No loading field / phase line | Inventing a loading surface for ensure work |
| Empty — no session book | Ensure never produced an identity for `(symbol, D)` (or load before ensure completes / ensure failed best-effort) | **`no session book for <SYMBOL> on <ET_DATE>`** (dated load) / **`no session book for <SYMBOL>`** (list empty) | Renaming to “not a lab name”; fabricating an empty book; ring miss string; trader `—` / `unavailable this cycle` |
| Empty — empty/pruned ring (distinct) | Operator queries the **ring** vehicle and ring count is zero | Live **`no stored snapshot for <SYMBOL>`** | Aliasing ring miss ↔ session miss; inventing `empty 48-ring…` |
| Error — not storing | Archive disabled / unavailable | **`session archive not storing`** | Treating as miss; silent Massive recovery on the research read |
| Error — unreadable (load) | Identity present, body corrupt | **`session book unreadable: <reason>`** | Treating as miss / not-storing / list store-error |
| Error — list store fault | List metadata I/O failure | **`session archive store error: <reason>`** | Aliasing to unreadable |
| Same-day second ensure / capture | Ensure or later paid capture same ET day after identity exists | Still **one** `(symbol, et_date)`; first body retained | “v2 session book”; duplicate ET-date rows; Settings “recaptured” chrome |
| Post-prune retention | Ring pruned; session identity remains | Session book still loadable | Claiming research is gone because the ring pruned |
| Ensure off-path (invisible) | Bounded force-compute or ring promote for SPY/QQQ/IWM when no session identity yet | Operator eventually sees hit or honest miss; trader sees nothing | Sitting Massive I/O on the ticker request path; toasting ensure progress on trader UI |

### Closed vocabulary (binding — do not invent a second deck)

Reuse `_archive/session-chain-archive/SPEC.md` §4 exactly:

| Concept | Approved term / exact string | Banned (this ship) |
|---|---|---|
| Prune-proof day identity | **session book** / **session archive** / `(symbol, et_date)` | “live book”, “lab book”, “raised 48-cap row” |
| When taken | **`et_date`** · **`source_as_of`** (mandatory on hit) | “last updated”, “fresh”, “current book”, “now”, “ensured at” |
| How obtained on read | **`loaded from session archive · no vendor call`** | “refreshed”, “force-captured for lab”, “synced from Massive” |
| Day with no capture / ensure miss | **`no session book for <SYMBOL> on <ET_DATE>`** / **`no session book for <SYMBOL>`** | **“not a lab name”**; “SPY/QQQ/IWM not in ensure set” as miss copy; ring miss string; trader literals |
| Store disabled | **`session archive not storing`** | treating as miss |
| Unreadable | **`session book unreadable: <reason>`** | treating as miss |
| Score posture | **`authorizes: nothing`** | implying live score uses archived books |
| License | **Our research · not redistributed on a trader route.** | “shareable feed” |

Four mandatory-distinct outcomes stay closed:
`no session book…` ≠ `no stored snapshot…` ≠ `session archive not storing` ≠
`session book unreadable: <reason>`.

**Hard ban — live-as-market-feed** and **hard ban — lab-rename:** do not brand a miss as
membership in a “lab names” set. Closed names SPY/QQQ/IWM are a **backend ensure scope**, not a
user-facing taxonomy.

### Flows (operator / research only)

1. Off-path ensure for SPY / QQQ / IWM when no session identity exists yet for ET day D
   (architect names promote-vs-force-compute; UX only requires the eventual research outcome).
2. Operator lists `GET /api/_research/session-books/{symbol}` → hit rows include `source_as_of`.
3. Operator loads `(symbol, et_date)` → session book + mandatory `source_as_of`; `vendor_called`
   false.
4. After 48-ring prune, the same identity still loads.
5. If ensure never wrote: dated load still returns exact **`no session book for <SYMBOL> on
   <ET_DATE>`** — never a fabricated empty book (`absent-is-not-none`).

### Acceptance criteria (UX-owned states + Verify by)

Actors: research operator / owner. Every user-visible row maps to S0 or S1 above.
**(SB)** = ship-blocking for this feature’s UX honesty surface.

| # | Story | Acceptance criterion | State(s) | Verify by |
|---|---|---|---|---|
| AC-U1 **(SB)** | US-T: As the desk owner, I want zero trader chrome for this ensure work. | `apps/dashboard` gains **no** new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, or tooltip mentioning SPY/QQQ/IWM session capture / “lab names” / warm-cache ensure. | S0 unchanged | test |
| AC-U2 **(SB)** | US-T | Trader empty / error / offline / `unavailable this cycle` / `—` copy is **byte-unchanged** by ensure success or failure. | S0 unchanged | test |
| AC-U3 **(SB)** | US-O: As the research operator, I want SPY/QQQ/IWM books even when cache was warm. | After an ET session D where symbol S ∈ {SPY, QQQ, IWM} was in the paid-capture / scannable universe, research load `(S, D)` is a **hit** (`store=hit`) with mandatory **`source_as_of`** present (RFC 3339 UTC). Warm gex-cache alone is **not** a permitted reason for miss. | S1 Default | test |
| AC-U4 **(SB)** | US-O | That hit load completes with **zero live Massive calls** (`vendor_called` false) and carries `framing` = `RESEARCH READ — SESSION BOOK`, `provenance` = `loaded from session archive · no vendor call`, `authorizes` = `nothing` — no Live badge. | S1 Default | test |
| AC-U5 **(SB)** | US-O | Successful **list** for S includes the `(S, D)` row with **`source_as_of`** on the row / envelope per shipped list shape; zero Massive on list. | S1 Default | test |
| AC-U6 **(SB)** | US-O / honesty | When no session identity exists for `(S, D)` (ensure not yet run, failed best-effort, or name never archived), dated load reports exactly **`no session book for <SYMBOL> on <ET_DATE>`** and does **not** call Massive to create one. | S1 Empty — no session book | test |
| AC-U7 **(SB)** | US-O / honesty | Miss `detail` for `(S, D)` is **never** rewritten to “not a lab name,” “outside ensure set,” “cache was warm,” or any synonym that renames absence as taxonomy. | S1 Empty — no session book | test |
| AC-U8 **(SB)** | US-O / honesty | The four shipped absence classes remain distinguishable end-to-end for these names: session miss ≠ ring `no stored snapshot…` ≠ `session archive not storing` ≠ `session book unreadable: <reason>`. | S1 Empty / Error rows | test |
| AC-U9 **(SB)** | US-O | A research miss does **not** silently substitute another date’s book; missing stays missing (no unlabeled substitution). | S1 Empty — no session book | test |
| AC-U10 **(SB)** | US-O | Same-ET-day second ensure / capture leaves **exactly one** session identity for `(S, D)` (first-wins); no “v2” labeling on the research read. | S1 Same-day second | test |
| AC-U11 **(SB)** | US-T / isolation | Ensure / archive failure produces **no** trader-visible chrome and does not change trader degraded-state wording. | S0 + S1 ensure invisible | test |
| AC-U12 | US-scope | No Settings / ops chrome lists “we now capture SPY/QQQ/IWM”; closed names stay an implementation scope, not a product surface. | S0 unchanged | review |
| AC-U13 | US-scope | No `DESIGN_SYSTEM.md` amendment; no new tokens/components/patterns claimed for this feature. | N/A (no UI) | review |
| AC-U14 | US-O | Operator verification remains available **without** the trader UI via `/api/_research/session-books/...`. | S1 Default / Empty | review |

**Method notes (risk-based):**

- **`test`** — silent regressions: trader chrome absence (structural empty-diff / affordance scan),
  hit+`source_as_of` after warm-cache day, zero-vendor research read, exact miss string (including
  ban on “not a lab name”), four absence classes, no date substitution, first-wins uniqueness,
  trader copy byte-identity on ensure fail.
- **`review`** — intentional non-surfaces (no Settings “we capture…” chrome, no design-system
  amendment, positive operator path without trader UI).
- No DOM harness required for ship; trader silence is structural.
- Exact closed strings asserted by unit / GATE Q; do not invent parallel copy fixtures.

### Microcopy integrity (defining failure mode)

| Claim | Vouched by | Disposition |
|---|---|---|
| Hit shows a session book for `(SPY\|QQQ\|IWM, D)` | Research list/load `store=hit` + identity row | Allowed |
| Mandatory `source_as_of` on hit | Wire field present on successful list/load | Allowed — never optional |
| Miss means no archived identity | Exact `no session book…` detail | Allowed |
| “Not a lab name” / “we capture SPY…” | **No field** | **Withdrawn / banned** — renames absence or invents trader meaning |
| “Fresh / current / live book” | **No field** | Banned — `source_as_of` is provenance, not freshness marketing |
| Fabricated empty book when ensure failed | Would violate `absent-is-not-none` | Banned — still-missing stays miss |

### Out of UX scope (hand to other lanes)

- Promote ring snapshot vs bounded off-path force-compute mechanism (architect).
- Whether ensure runs from scanner warmer, cron, or another producer (architect).
- Rate / once-per-name-per-ET-day budget internals (architect).
- Product sequencing vs paid-book-join-smoke (PM) — UX only requires books exist under closed
  strings when the BRIEF’s decision-impact observation holds.

## Risks I see

1. **Vocabulary drift under “lab” pressure.** Implementers or sibling lanes may want miss copy that
   explains *why* (warm cache / not ensured yet / not a lab name). That renames absence and
   collapses `absent-is-not-none`. Exact shipped strings must stay.
2. **Settings / ops “helpfulness.”** A tempting Settings or `/_ops` line listing the three liquid
   names would violate `operator-vs-trader-path-separation` and `NO_UI_CHANGE`.
3. **False hit chrome.** Surfacing ensure-in-progress on any trader or research loading field
   invents a state the HTTP vehicle does not have (Loading = N/A).
4. **Silent date substitution** to “help” the lab when Tuesday’s book is late — forbidden; miss
   must stay miss until the identity exists.
5. **Claiming DESIGN_SYSTEM work.** Restating tokens in a future SPEC §4 or inventing an amendment
   for a no-UI ship creates dual authority for nothing.

## Assumptions I'm making about the other two lanes

- **Architect** will keep ensure **off the trader request path** so UX can assert S0 unchanged and
  zero Massive on research **reads** without a new trader latency or error surface.
- **Architect** will leave research list/load wire fields and closed miss `detail` strings
  **byte-compatible** with shipped `session-chain-archive` (including mandatory `source_as_of` on
  hit) — no new miss enum member for “warm cache” or “lab name.”
- **Architect** will treat still-missing after ensure failure as **no row** (honest
  `no session book…`), never a fabricated empty session body.
- **Architect** scopes ensure to **SPY, QQQ, IWM only** this ship; UX will not be asked to label
  “the rest of the universe” as a different miss class.
- **PM** will keep acceptance language aligned with **reuse** of session-book vocabulary rather
  than introducing user-visible “lab names” / “liquid ensure” product terms.
- **PM** will not require trader-facing confirmation that ensure ran (no Settings checklist, no
  Ask-AI disclosure) — decision impact stays operator list/load observation.
- **PM** will treat warm-cache-no-longer-excuses-miss as an **operator-observable** criterion
  (hit + `source_as_of`), not as a trader-visible status.
- **Both lanes** accept `NO_UI_CHANGE` + `NO` `DESIGN_SYSTEM` amendment as binding for this feature;
  any UI or canon amendment request is a product conflict for R2, not a silent SPEC §4 fill.
