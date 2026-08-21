# R1 — ux position: chain-snapshot-capture

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here.** The BRIEF is explicit: capture/read is research; Effort says
**no trader UI**; `[operator-vs-trader-path-separation]` is HARD. The user-facing surface I own is
therefore the **negative space on every trader route** plus the **operator/research wording** on
whatever research-read path Architect/PM name (CLI and/or an unlinked operator check — never a
dashboard tile).

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S0 | **Trader UI silence** — Ticker, Positions, Scanner, Settings, Ask-AI, Landing | every trader | what must **never** appear: no capture chip, toast, badge, Settings toggle, Ask-AI framing, or "snapshot saved" affordance |
| S1 | **Research read** — load a dated stored snapshot for a ticker **with no live Massive call** (CLI and/or operator-only check; shape is Architect's) | the operator / owner | every printed label, as-of framing, absence literal, and the ban on "live" |
| S2 | **Capture side-effect silence** — write-through after an already-paid fetch | nobody on the trader path | the trader must experience **zero** new chrome when capture succeeds **or** fails (`[best-effort-isolated-or-null]`) |

**Design-system note (binding, for SPEC §4):** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is
`Status: SET` (The Curvature Terminal). This feature touches **no dashboard surface** — no route, no
component, no token, **no new motion** (`[single-motion-moment]`). SPEC §4 must carry
**`NO_UI_CHANGE`** and must not restate the token table. I request **no amendment** to
`DESIGN_SYSTEM.md`. Anyone proposing a Ticker tile, Settings control, Ask-AI disclosure, `/_ops`
chain browser, or a "live" badge on replayed/stored data is **re-scoping** — raise as an R2
`product` conflict; do not fold it in.

This is not a design vacuum. Honesty under replay is already product canon
(`SYSTEM_DESIGN_AND_BACKTEST.html`: *no live badge, no look-ahead*). My job is to make that
non-negotiable in copy and states for **stored** blobs.

### 1. Intended user, primary job, vocabulary

- **User (S1):** the operator (owner), researching whether score / structure / AI rec was any good
  on the **exact book we already paid for**. Time-poor; will paste a line into a later council or
  P3 replay note.
- **User (S0):** the trader — must remain unaware that capture exists. Awareness on the trader path
  is a license and honesty failure, not a helpful tip.
- **Primary job (S1):** *"Can I load the dated raw snapshot for this ticker without paying Massive
  again — and is what I'm looking at stored research, not a live book?"*
- **Failure I am designing against:** a stored / replayed chain being labeled, badged, or skim-read
  as **live**, or being confused with (a) the digested `scan_structure_history` row, or (b) the
  latest-wins `scan_bundles` cache. Those three are different objects; renaming any of them in copy
  invents meaning the data does not support.

**User vocabulary — closed term set. These are the only words research output may use for these things:**

| Concept | Approved term | **Banned** (asserts meaning the data cannot carry) |
|---|---|---|
| The persisted paid fetch | **stored chain snapshot** / **captured snapshot** | "live chain", "live book", "realtime options", "streaming chain", "Massive historical chain", "hist options product" |
| When it was taken | **captured at \<UTC\>** / **as-of \<UTC\>** | "last updated", "fresh", "now", "current book" (those imply live refresh) |
| How it was obtained on read | **loaded from store · no vendor call** | "refreshed", "fetched", "synced from Massive" (on a research read) |
| The whole activity | **research read** | "market view", "ticker reload", "dashboard snapshot", "live replay for traders" |
| Digested scanner row (existing P0) | **structure history sample** (digested) | "full chain", "raw snapshot" |
| Latest-wins cache (existing) | **scan bundle cache** (latest-wins, not history) | "history", "archive", "append log" |
| A miss in the store | **no stored snapshot** | "no options", "empty chain", "market closed", "nothing to trade" |
| A capture write failure | **capture skipped** (operator log only) | any trader-visible error, toast, or degraded ticker chrome |
| License posture | **our research · not for trader redistribution** | "shareable feed", "product historical API", "customer export of vendor chain" |

**Hard ban — the word `live`:** on any research-read of a stored snapshot, the strings `live`,
`LIVE`, and any "live" badge/chip are **forbidden**. Replayed / stored data is never live. If a
future P3/P6 surface needs a mode label, the only honest pair is **`stored` / `replay`** vs the
separate live vendor path — never a live badge on the stored arm. (I do not design P3 here; I lock
the vocabulary this feature's read must already obey so P3 cannot "inherit" a lie.)

### 2. Trader UI silence (S0) — complete negative space

Nothing in this feature may surface on:

- **Ticker** (`/ticker/:symbol`) — no chip, banner, footnote, tooltip, or widget about capture,
  retention, blob count, or "saved for research".
- **Settings** — no toggle, key, or "research capture" section.
- **Ask-AI / recommendation** — stored blobs are not a new grounding source in this feature; do not
  invent AI copy that cites "captured chain" as if it were the live bundle.
- **Scanner / Positions / Landing / shell nav** — no link, count, or status.
- **`/_ops/metrics`** — out of scope to extend here; if Architect later exposes an operator check,
  it stays **unlinked** and off every trader route (same separation as metrics). I am **not**
  requesting an ops page in this feature.

Capture success and capture failure are both **invisible** on the trader path. The trader's bundle /
SSE / score experience is unchanged. That invisibility is the UX expression of
`[best-effort-isolated-or-null]` and `[additive-keeps-score-byte-identical]`.

### 3. Research-read information structure (S1)

Whatever vehicle Architect chooses (CLI stdout, JSON artifact, operator GET), the **read** the
operator sees must carry this information **in this order**, before any chain/field dump:

1. **Framing line (mandatory):** `RESEARCH READ — STORED CHAIN SNAPSHOT` (or equivalent exact
   closed phrase). Never "Ticker", never "Live".
2. **Identity line:** symbol · **captured at** UTC · store identity the read used (path/key/id —
   field names are Architect's; the label is mine: show that it is **from store**).
3. **Provenance line:** `loaded from store · no vendor call`. If a vendor call occurred, that is a
   **defect**, not a state to pretty-print as success.
4. **What this is / is not (one block):**
   - **Is:** the already-fetched options snapshot (+ the stock bars pulled with it) kept for
     research replay.
   - **Is not:** a Massive point-in-time historical-chain product; not the digested structure
     history row; not the latest-wins `scan_bundles` cache; not a trader market view.
5. **Payload / confirmation** that the snapshot loaded (Architect owns contents; I own that any
   human-visible summary does not relabel fields into live/score language).
6. **License one-liner:** `Our research · not redistributed on a trader route.`

Ordering is declared. Do not lead with raw JSON that a skimming operator can paste into a trader
context without the hedge.

### 4. Component states

Trader path (S0) has **one** required state: **unchanged** — no new default/loading/empty/error
chrome. Capture is not a trader component.

Research read (S1) is the component with states:

| State | When | What the operator sees | What must **not** happen |
|---|---|---|---|
| **Default (stored hit)** | A dated snapshot exists for the requested ticker/identity and loads from store | §3 structure; framing + `captured at` + `loaded from store · no vendor call` | Any `live` badge/word; any implication the book is current; any Massive network call |
| **Loading** | Store read in flight | A phase line that names **store read** (e.g. `reading stored snapshot: TSLA …`) | Copy that says "fetching chain" / "refreshing from Massive" |
| **Empty** | No snapshot for that ticker/identity (never captured, or outside retention) | Exact: `no stored snapshot for <SYMBOL> [at <as-of>]` plus next research action if PM/Architect define one (e.g. wait for a scan/serve cycle) | `no options`, `empty chain`, `market closed`, `—`, or a blank that looks like a successful empty book |
| **Error (store)** | Store unreachable / corrupt / identity invalid | Named failure: `stored snapshot unreadable: <reason>` · research-only · does **not** fall back to live vendor | Silent fallback to live Massive; HTTP/trader error shaped like a ticker failure; a partial dump labeled as complete |
| **Stale / aged (disclosure only)** | Snapshot exists but its `captured at` is older than the operator's requested freshness **if** PM defines a freshness expectation for the read | Still **stored**, still not live: `stored snapshot · captured at <UTC> (<age> before this read)` | Relabeling aged stored data as `stale live` or dimming it with trader "Live offline" chrome — wrong vocabulary family |
| **Capture skipped (operator log only)** | Write-through failed after a paid fetch | Structured operator log / research counter — **not** trader UI. Wording: `capture skipped — trader path unchanged` | Toast on Ticker; failing the scan/serve/SSE; presenting "save failed" to a trader |
| **Retention pruned** | Snapshot existed once, removed by retention | Same family as Empty, but distinguishable when the store can say so: `no stored snapshot (pruned by retention)` vs never-captured empty | Collapsing pruned-vs-never into one lie that "we never paid for this" |

No trader `offline` / `success-toast` / `empty-list` states are introduced. **Research-read
`offline` is not a license to hit Massive** — if the store cannot be read, that is **Error
(store)**, not "go live". A vendor fetch on an operator read of stored blobs violates the BRIEF
invariant and is out of my state matrix on purpose.

### 5. Microcopy integrity rules (binding)

1. **Trace every label.** "Stored chain snapshot" only where an append-identity blob was loaded.
   Do not put that label on `scan_structure_history` (digested) or `scan_bundles` (latest-wins).
2. **No silent renames.** Do not call the feature "historical options" in operator copy — that
   names a Massive product this BRIEF explicitly does not buy.
3. **Empty ≠ none-in-market.** `no stored snapshot` never shares a string with trader "unavailable
   this cycle" or positions `—`.
4. **Degraded trader path stays un-degraded.** Capture failure must not reuse `⚠ Live offline`,
   `Couldn't refresh`, or `unavailable this cycle` — those mean other failures on other data.
5. **No new motion, no new tokens.** If any future operator chrome appears outside this BRIEF, it
   is an Amendments event on `DESIGN_SYSTEM.md` via R2 — not a silent SPEC §4 restatement. This
   feature asks for none.

### 6. Acceptance criteria → states → `Verify by`

User-visible / user-silence criteria I own. `Verify by` per `spire-tech-risk-based-verify`.
(PM may renumber into SPEC §3; the marks travel with the rows.)

| ID | Acceptance criterion | State(s) | Verify by | Why this mark |
|---|---|---|---|---|
| UX-1 | SPEC §4 carries **`NO_UI_CHANGE`**; no dashboard route/component/token/motion is added for this feature | — (canon) | **test** | Silent addition of a `.tsx` route or nav link is invisible in a copy review; structural scan / empty diff on `apps/dashboard` is the invariant |
| UX-2 | Ticker, Settings, Ask-AI, Scanner, Positions, Landing, and shell nav show **no** capture status, blob count, save toast, or research-snapshot affordance after capture success or failure | S0 unchanged | **test** | Negative space — absence must be asserted; review cannot reliably notice what is not there across routes |
| UX-3 | A successful research read of a stored snapshot displays framing that includes **stored** / **captured at** (UTC) and **loaded from store · no vendor call**, and displays **no** `live` / `LIVE` badge or label | default | **test** | "No live badge" is the honesty invariant; a refactor that adds a shared Live chip is green and wrong |
| UX-4 | Exact framing / banned-term table in §1 (wording of the mandatory lines) matches approved copy | default | **review** | Visible intentional wording |
| UX-5 | Empty store miss renders `no stored snapshot for <SYMBOL>…` and never `no options` / `empty chain` / `market closed` / trader `—` | empty | **test** | `[absent-is-not-none]` — wrong empty string is a fabricated market claim |
| UX-6 | Store read failure renders `stored snapshot unreadable: …` and does **not** invoke or describe a live vendor fetch as recovery | error | **test** | Fallback-to-live is a silent BRIEF violation |
| UX-7 | Loading copy names a **store read**, never "fetching/refreshing from Massive" | loading | **review** | Short-lived copy; visible |
| UX-8 | When retention can distinguish pruned vs never-captured, the two empty strings differ (`pruned by retention` vs plain miss); when it cannot, only the plain miss string is used — never a guessed prune claim | empty, retention pruned | **test** | Inventing "pruned" without store evidence is my defining failure mode |
| UX-9 | Capture write failure produces **no** trader-visible chrome and does not change trader error/empty/offline copy | capture skipped + S0 | **test** | `[best-effort-isolated-or-null]` as experienced by the trader — must be automated |
| UX-10 | Research-read output never labels digested structure history or latest-wins `scan_bundles` as a "stored chain snapshot" | default | **test** | Silent rename across three different objects; mechanical string/fixture check |
| UX-11 | License one-liner present on research read: research use, not trader-route redistribution | default | **review** | Wording / presence |
| UX-12 | No new motion keyframes, arc spends, or hardcoded hex are introduced by this feature | — | **test** | Existing structural theme specs / dashboard empty-diff; `[single-motion-moment]` + `[theme-token-discipline]` |

## Risks I see

1. **Someone "helpfully" shows capture health on Ticker or Settings.** Highest-probability product
   drift. UX-1/UX-2 exist so that impulse fails a test, not a debate.
2. **Shared Live chrome reused on a research read.** A common `LiveBadge` import on a stored payload
   is one line and a license/honesty incident. UX-3.
3. **Empty-store copy borrowed from trader "unavailable this cycle".** Reads as a market claim.
   UX-5.
4. **Operator read falls back to Massive on miss.** Turns research into a paid fetch and burns the
   reason this feature exists. UX-6 — out of my server lane to implement, in my lane to forbid in
   copy/states.
5. **Naming collision with P0 digested history and `scan_bundles`.** Operators will say "the
   snapshot" for all three; if our strings do too, replay work attaches to the wrong object. UX-10.
6. **P3 batch CLI inherits weak framing.** If this feature ships research reads without the
   stored/as-of hedge, P3 will paste numbers that look live. Lock vocabulary now.
7. **My own failure mode, named:** I must not invent retention windows, store keys, endpoint paths,
   or CLI flag names. If the synthesized SPEC contains operator copy that asserts a retention
   number or route I authored, that is a defect — those come from Architect/PM.

## Assumptions I'm making about the other two lanes

- **PM keeps trader UI out of scope** exactly as the BRIEF states (no Ticker/Settings/Ask-AI
  capture surface). If PM's position adds a trader-facing control or status, I will file an R2
  `product` conflict rather than design it.
- **PM's AC set includes trader-path non-impact** for capture write failure
  (`[best-effort-isolated-or-null]`) and score byte-identity
  (`[additive-keeps-score-byte-identical]`), so UX-9 is backed by a verified property, not only
  copy.
- **Architect provides a research-read path** (CLI and/or operator-only) that can load a dated
  snapshot **without** a Massive call, and exposes to that read at least: symbol, captured-at UTC,
  and a clear store-hit vs store-miss vs store-error distinction. Without those, UX-3/UX-5/UX-6
  are unimplementable.
- **Architect does not overload `scan_bundles` PK `symbol` as the append history** (BRIEF already
  forbids it). My vocabulary that distinguishes cache vs stored snapshot assumes the storage
  identity is append-capable and separately named.
- **Architect does not fall back to a vendor fetch on research read miss/error.** If the
  architecture includes that fallback, it contradicts UX-6 and the BRIEF invariant; I will contest
  it in R2 as `technical` with a verbatim quote.
- **PM defines whether retention-pruned is distinguishable from never-captured** at read time. I
  assume either a vouched distinction or an honest single empty string — I will not invent prune
  copy without evidence (UX-8).
- **Neither lane proposes live-badge chrome, new motion, or DESIGN_SYSTEM tokens** for this
  feature. My `NO_UI_CHANGE` / no-amendment position assumes agreement; a proposed `/_ops` chain
  browser is re-scope, not a fold-in.
- **License posture stays research-only** on any read surface Architect names — no trader-route
  redistribution of stored vendor payloads. UX-11 assumes PM/Architect treat that as an AC, not a
  footnote.
