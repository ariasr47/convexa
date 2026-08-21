# R1 — ux position: session-chain-archive

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here.** The BRIEF is explicit: this feature copies (or selects) a
session-level paid options book **off the trader path**, keeps it in an archive the existing
48-slot / 14-day prune **cannot delete**, and does **not** add a trader UI. Effort says
**no trader UI**. `[operator-vs-trader-path-separation]` is HARD — archive/read is research;
unlinked from trader UI; no vendor fetch on an operator read of stored blobs.

The user-facing surface I own is therefore:

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S0 | **Trader UI silence** — Landing, Ticker, Positions, Scanner, Settings, Ask-AI, shell nav | every trader | what must **never** appear: no archive badge, "session saved" toast, Settings toggle, nav link, corpus count, or Ask-AI framing that cites a session book as live grounding |
| S1 | **Research / operator wording** — any CLI, `_research` read, or unlinked operator check that mentions session books (vehicle is Architect's) | the operator / owner | every printed label, identity framing `(symbol, et_date)`, absence literal, and the ban on "live" / "empty ring" collapses |
| S2 | **Archive write silence on the trader path** — session copy after an already-paid capture | nobody on the trader path | trader experiences **zero** new chrome when the session archive write succeeds **or** fails (`[best-effort-isolated-or-null]`) |

**Design-system note (binding, for SPEC §4):** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is
`Status: SET` (The Curvature Terminal). This feature touches **no dashboard surface** — no route, no
component, no token, **no new motion** (`[single-motion-moment]`). SPEC §4 must carry
**`NO_UI_CHANGE`** and must not restate the token table. I request **no amendment** to
`DESIGN_SYSTEM.md`. Anyone proposing a Ticker "session archive" chip, a Settings research toggle, an
Ask-AI "we kept Tuesday's book" line, or a `/_ops` session-book browser is **re-scoping** — raise as
an R2 `product` conflict; do not fold it in.

**Explicit trader-product statement (carry into SPEC §4):** the trader UI does **not** gain chrome,
routes, badges, toasts, Settings controls, or Ask-AI disclosures for this archive. That is not a
deferral — it is the product shape of this BRIEF.

### 1. Intended user, primary job, information structure, vocabulary

- **User (S1):** the research operator / owner — needs Tuesday's paid book still loadable after the
  intraday 48-ring has pruned, with **zero Massive calls**.
- **User (S0):** the trader — must remain unaware that a session archive exists. Awareness on the
  trader path is a license and honesty failure, not a helpful tip.
- **Primary job (S1):** *"For symbol S on ET date D, is there a session book I can load from the
  archive without paying Massive again — and am I looking at a session identity, not the 48-ring,
  not a disabled store, and not a live book?"*
- **Failure I am designing against:** collapsing three different truths into one "no data" string —
  **no session book** vs **empty 48-ring** vs **disabled / unreadable store** — or labeling a
  session book as live / hist-chain / "we raised the 48 cap."

**User vocabulary — closed term set. These are the only words research/operator output may use for
these things** (extends capture + batch-backtest; does not rename them):

| Concept | Approved term | **Banned** (asserts meaning the data cannot carry) |
|---|---|---|
| The prune-proof day identity | **session book** · **session archive** · identity **`(symbol, et_date)`** | "live book", "today's chain" (without ET-date hedge), "hist-chain product", "raised 48-cap row" |
| The existing dual-retention ring | **48-ring** / **ring snapshot** / **stored chain snapshot** (capture's term) | calling the ring a "session archive"; calling a session book a "ring slot" |
| When the session identity was taken | **session date \<ET YYYY-MM-DD\>** · **archived from capture at \<UTC\>** (Architect names which clock fields exist; labels must not invent a second clock) | "last updated", "fresh", "current book", "now" |
| How obtained on read | **loaded from session archive · no vendor call** | "refreshed", "fetched", "synced from Massive", "filled from hist-chain" |
| The whole activity | **research read** / **session-archive read** | "market view", "ticker reload", "trader replay feed" |
| Day with no capture | **`no session book for <SYMBOL> on <ET_DATE>`** | "empty ring", "no options", "market closed", trader `—`, `unavailable this cycle` |
| Ring present but session identity absent | still **`no session book…`** — never "ring empty" unless the **ring** itself is empty | collapsing "ring has slots, no session row" into one "no data" |
| Empty 48-ring (distinct object) | **`empty 48-ring for <SYMBOL>`** (only when the ring list/count is actually zero) | using this string for a missing session identity |
| Store disabled / not configured / unreadable | **`session archive not storing`** / **`session book unreadable: <reason>`** (mirror capture's store-fault family; Architect may share or sibling the store — wording must stay in the fault family) | treating fault as miss; treating miss as "capture is off" without evidence |
| Second capture same ET day | **same session identity** (one `(symbol, et_date)` — Architect names first-wins vs last-wins; copy must not claim "two session books") | "version 2", "updated live book", inventing a second day row in operator chrome |
| After ring prune | **session book still loadable** · **48-ring pruned · session archive retained** | "snapshot deleted", "corpus gone", "nothing survived overnight" when the session identity remains |
| License posture | **our research · not redistributed on a trader route** | "shareable feed", "customer historical options API" |

**Hard ban — the word `live` as a market-feed claim:** on any research read of a session book, the
strings `live` / `LIVE` as a badge or "this quote is live" label are **forbidden**. Closed lineage
tokens from capture (e.g. `source: live_massive`) remain **provenance only** — never a Live chip.
Replayed / archived data is never live.

**Hard ban — silent rename of the three absences:** operator copy must never use one string for
`no session book`, `empty 48-ring`, and `session archive not storing` / `session book unreadable`.
That collapse is exactly the fabricated claim `[absent-is-not-none]` forbids, and the BRIEF names it
as the observed decision impact.

### 2. Trader UI silence (S0) — complete negative space

Nothing in this feature may surface on:

- **Ticker** (`/ticker/:symbol`) — no chip, banner, footnote, tooltip, widget, or freshness line about
  session archive, ET-date retention, or "saved overnight."
- **Settings** — no toggle, path, or "session archive / research corpus" section.
- **Ask-AI / recommendation** — session books are not a new grounding source in this feature; do not
  invent AI copy that cites "Tuesday's session book" as if it were the live bundle.
- **Scanner / Positions / Landing / shell nav** — no link, count badge, or status.
- **`/_ops/metrics`** — out of scope to extend here; if Architect later exposes an operator check for
  session books, it stays **unlinked** and off every trader route. I am **not** requesting an ops
  page in this feature.

Archive write success and archive write failure are both **invisible** on the trader path. Bundle /
SSE / score / tier / fingerprint experience is unchanged. That invisibility is the UX expression of
`[best-effort-isolated-or-null]` and `[additive-keeps-score-byte-identical]`.

### 3. Research-read information structure (S1)

Whatever vehicle Architect chooses (CLI stdout, JSON artifact, operator GET under `_research`), a
**successful** session-book read the operator sees must carry this information **in this order**,
before any chain/field dump:

1. **Framing line (mandatory):** `RESEARCH READ — SESSION BOOK` (or equivalent exact closed phrase).
   Never "Ticker", never "Live", never "48-ring slot."
2. **Identity line:** symbol · **session date \<ET YYYY-MM-DD\>** · store identity the read used
   (field names are Architect's; the label is mine: show it is **from session archive**).
3. **Provenance line:** `loaded from session archive · no vendor call`. If a vendor call occurred,
   that is a **defect**, not a success state to pretty-print.
4. **What this is / is not (one block):**
   - **Is:** one paid options book kept for that ET trading session so overnight prune of the
     48-ring cannot delete the day's research identity.
   - **Is not:** a Massive hist-chain product; not a raise of the 48 cap; not the digested structure
     history row; not the latest-wins `scan_bundles` cache; not a trader market view; not "every
     intraday ring slot that day."
5. **Payload / confirmation** that the session book loaded (Architect owns contents; I own that any
   human-visible summary does not relabel fields into live/score language).
6. **License one-liner:** `Our research · not redistributed on a trader route.`

Ordering is declared. Do not lead with raw JSON that a skimming operator can paste into a trader
context without the hedge.

### 4. Component states

Trader path (S0) has **one** required state: **unchanged** — no new default/loading/empty/error
chrome. The session archive is not a trader component.

Research / operator surfaces (S1) own this matrix. Feature-specific states are required by the BRIEF's
honest-absence triad — they are not ceremonial.

| State | When | What the operator sees | What must **not** happen |
|---|---|---|---|
| **Default (session hit)** | A session identity `(symbol, et_date)` exists and loads from the archive | §3 structure; framing + ET session date + `loaded from session archive · no vendor call` | Any `live` badge/word; any implication the book is the current desk feed; any Massive network call |
| **Loading** | Archive read in flight | A phase line that names **session-archive read** (e.g. `reading session book: TSLA 2026-08-19 …`) | Copy that says "fetching chain" / "refreshing from Massive" / "loading 48-ring" |
| **Empty — no session book** | No capture produced a session identity for that `(symbol, et_date)` (honest absence for the day) | Exact: **`no session book for <SYMBOL> on <ET_DATE>`** | `empty 48-ring…`, `no options`, `market closed`, trader `—`, `unavailable this cycle`, blank success |
| **Empty — empty 48-ring (distinct)** | Operator is inspecting the **ring**, and the ring list/count for the symbol is zero | Exact: **`empty 48-ring for <SYMBOL>`** — only when that is the object under query | Using this string for a missing session identity when the ring still has slots (or vice versa) |
| **Error — archive unreadable / not storing** | Session archive store disabled, unreachable, corrupt, or identity invalid | **`session archive not storing`** and/or **`session book unreadable: <reason>`** · research-only · does **not** fall back to live vendor | Silent fallback to Massive; treating fault as "no session book"; trader-shaped error chrome |
| **Same-day second capture** | Another paid capture occurs the same ET day after a session identity already exists | Operator still sees **one** session identity for `(symbol, et_date)`; copy does not announce a second session book (Architect owns first- vs last-wins bytes; I own that chrome does not invent two days) | "v2 session book", duplicate ET-date rows in list chrome, "updated live" |
| **Post-prune retention (disclosure)** | 48-ring has pruned the intraday slots, session identity remains | Explicit: session book **still loadable**; optional companion fact `48-ring pruned · session archive retained` when both facts are vouched | Claiming the day's research is gone because the ring pruned; claiming the ring still holds what only the archive holds |
| **Archive write skipped (operator log only)** | Session-archive write failed after a paid path that otherwise succeeded | Structured operator log — **not** trader UI. Wording family: `session archive write skipped — trader path unchanged` | Toast on Ticker; failing bundle / scan / SSE; presenting "save failed" to a trader |
| **Stale / aged (disclosure only)** | Session book exists; its capture clock is older than the operator's interest | Still **session archive**, still not live: keep ET date + capture UTC visible | Relabeling as `stale live` or dimming with trader "Live offline" chrome |
| **Offline (N/A as SSE)** | Not a trader stream feature | — | Inventing a "Live offline" chip for research CLI / `_research` |

**Research-read offline is not a license to hit Massive** — if the session archive cannot be read,
that is **Error (archive)**, not "go live." A vendor fetch on an operator read of stored blobs
violates the BRIEF invariant and is out of my state matrix on purpose.

### 5. Microcopy integrity rules (binding)

1. **Trace every label.** "Session book" only where a session-archive identity `(symbol, et_date)`
   was loaded or honestly missed. Do not put that label on a 48-ring row, `scan_structure_history`,
   or `scan_bundles`.
2. **No silent renames.** Do not call this "historical options," "hist-chain," or "we kept all 48
   slots longer" — those name other products / culled alternatives in the BRIEF.
3. **Three absences stay three strings.** `no session book…` ≠ `empty 48-ring…` ≠
   `session archive not storing` / `session book unreadable…`.
4. **Degraded trader path stays un-degraded.** Archive write failure must not reuse `⚠ Live offline`,
   `Couldn't refresh`, or `unavailable this cycle`.
5. **No new motion, no new tokens.** If any future operator chrome appears outside this BRIEF, it is
   an Amendments event on `DESIGN_SYSTEM.md` via R2 — not a silent SPEC §4 restatement. This feature
   asks for none.
6. **Withdraw undefeasible claims.** I do not assert first-wins vs last-wins, copy timing (last RTH
   slow-lane vs first vs explicit close), or archive backend shape — Architect names those. If a
   label would require one of those decisions, leave the label generic (`same session identity`)
   until the decision exists.

### 6. Acceptance criteria → states → `Verify by`

User-visible / user-silence criteria I own. `Verify by` per `spire-tech-risk-based-verify`.
(PM may renumber into SPEC §3; the marks travel with the rows.)

| ID | Acceptance criterion | State(s) | Verify by | Why this mark |
|---|---|---|---|---|
| UX-1 | SPEC §4 carries **`NO_UI_CHANGE`**; no dashboard route/component/token/motion is added for this feature | — (canon) | **test** | Silent `.tsx` / nav / Settings addition is invisible in a copy review; structural empty-diff on `apps/dashboard` is the invariant |
| UX-2 | Landing, Ticker, Settings, Ask-AI, Scanner, Positions, and shell nav show **no** session-archive status, ET-date corpus count, save toast, badge, or research-session affordance after archive write success or failure | S0 unchanged | **test** | Negative space — absence must be asserted; review cannot reliably notice what is not there across routes |
| UX-3 | A successful research read of a session book displays framing that includes **session book** / **session date \<ET\>** and **loaded from session archive · no vendor call**, and displays **no** `live` / `LIVE` badge or "this quote is live" label | default | **test** | "No live badge" is the honesty invariant; shared Live chrome import is green and wrong |
| UX-4 | Exact framing / banned-term table in §1 (wording of the mandatory lines) matches approved copy | default | **review** | Visible intentional wording |
| UX-5 | Day with no capture renders exactly **`no session book for <SYMBOL> on <ET_DATE>`** and never `empty 48-ring…` / `no options` / `market closed` / trader `—` / `unavailable this cycle` | empty — no session book | **test** | `[absent-is-not-none]` — wrong empty string is a fabricated market or ring claim |
| UX-6 | When the operator is querying the **48-ring** and it is empty, copy uses **`empty 48-ring for <SYMBOL>`**, distinct from UX-5 | empty — empty 48-ring | **test** | BRIEF's triad; silent synonymy is the defining integrity failure |
| UX-7 | Store disabled / unreadable renders **`session archive not storing`** and/or **`session book unreadable: <reason>`** and does **not** invoke or describe a live vendor fetch as recovery; fault ≠ miss | error — archive | **test** | Fallback-to-live is a silent BRIEF violation; miss/fault collapse fabricates "we never captured" |
| UX-8 | Loading copy names a **session-archive read**, never "fetching/refreshing from Massive" or "loading 48-ring" when the object is the session identity | loading | **review** | Short-lived copy; visible |
| UX-9 | After the 48-ring prune removes intraday slots, a previously archived `(symbol, et_date)` remains loadable with framing that the **session book** loaded (and does not claim the ring still holds it) | default + post-prune retention | **test** | Decision impact of the feature; silent "corpus gone" copy would lie when the archive still has the row |
| UX-10 | A second capture the same ET day does not present a **second** session identity in operator list/load chrome; copy speaks of one `(symbol, et_date)` | same-day second capture | **test** | Duplicate identity chrome silently re-scopes BRIEF "one … per symbol per ET trading session" |
| UX-11 | Archive write failure produces **no** trader-visible chrome and does not change trader error/empty/offline copy | archive write skipped + S0 | **test** | `[best-effort-isolated-or-null]` as experienced by the trader — must be automated |
| UX-12 | Research-read output never labels a 48-ring row, digested structure history, or latest-wins `scan_bundles` as a "session book" | default | **test** | Silent rename across different objects; mechanical string/fixture check |
| UX-13 | License one-liner present on research read: research use, not trader-route redistribution | default | **review** | Wording / presence |
| UX-14 | No new motion keyframes, arc spends, or hardcoded hex are introduced by this feature | — | **test** | Existing structural theme specs / dashboard empty-diff; `[single-motion-moment]` + `[theme-token-discipline]` |
| UX-15 | Operator verification of session-archive list/load is available **without** using the trader UI | S1 | **review** | Positive operator path presence is visible/intentional once Architect names the vehicle |

## Risks I see

1. **Someone "helpfully" surfaces archive health on Ticker or Settings.** Highest-probability
   product drift. UX-1/UX-2 exist so that impulse fails a test, not a debate.
2. **Collapsing the BRIEF's three absences into one "no data."** Operators will then "fix" a miss
   by hitting Massive or by staring at an empty ring. UX-5/UX-6/UX-7.
3. **Shared Live chrome reused on a session-book read.** One `LiveBadge` import is a license/honesty
   incident. UX-3.
4. **Calling the session archive a raised 48-cap or hist-chain.** Renames the feature into culled
   alternatives. UX-12 + banned table.
5. **Post-prune copy that says the day's book is gone** because the ring pruned, while the session
   identity still loads. Undermines the only decision impact that matters. UX-9.
6. **Same-day second capture presented as a second session book.** Quietly breaks "one per symbol
   per ET session" in the only place operators look. UX-10.
7. **My own failure mode, named:** inventing first- vs last-wins, capture-timing, endpoint paths, or
   retention numbers in operator copy. Those are Architect/PM. If the synthesized SPEC contains
   session-archive copy that asserts a clock or win-rule I authored without a vouched field, that is
   a defect — withdraw it.

## Assumptions I'm making about the other two lanes

- **PM keeps trader UI out of scope** exactly as the BRIEF states (no Ticker/Settings/Ask-AI session-
  archive surface). If PM's position adds a trader-facing control, badge, or status, I will file an
  R2 `product` conflict rather than design it.
- **PM's AC set includes ship-blocking rows** for: no trader UI; archive write failure does not fail
  bundle/scan/SSE (`[best-effort-isolated-or-null]`); score/tier/fingerprint byte-identical
  (`[additive-keeps-score-byte-identical]`); zero Massive on session-archive read; prune of the
  48-ring cannot delete a session identity — so UX-2/UX-9/UX-11 are backed by verified product
  criteria, not only UX prose.
- **Architect names session identity as `(symbol, et_date)` (or an equivalent pair the operator can
  print)** and exposes store outcomes that distinguish **session hit**, **no session book**,
  **empty 48-ring** (when the ring is the queried object), and **archive not storing / unreadable**
  — without that quartet UX-5/UX-6/UX-7 are unimplementable honestly.
- **Architect guarantees research/session-archive read makes zero Massive calls**, including on miss
  and fault — so "loaded from session archive · no vendor call" and the ban on vendor recovery copy
  are true, not aspirational.
- **Architect isolates the session archive from the 48-slot / 14-day prune** such that a poisoned or
  real prune still leaves the session identity loadable — UX-9 assumes that structural fact ships
  with a test, not a footnote.
- **Architect names first-wins vs last-wins for a second capture the same ET day** before SPEC locks;
  I assume exactly one session identity remains addressable, so UX-10 does not have to invent a
  versioning UI.
- **Architect/PM name when the session copy is taken** (last RTH slow-lane vs first vs explicit
  close) as a printable fact when it appears in operator logs — I will not invent the timing label.
- **Neither lane proposes live-badge chrome, new motion, DESIGN_SYSTEM tokens, hist-chain purchase,
  raising the 48 cap, or a trader-linked `/_ops` session browser** for this feature. My
  `NO_UI_CHANGE` / no-amendment position assumes agreement; those proposals are re-scope, not fold-ins.
- **License posture stays research-only** on any read surface Architect names — no trader-route
  redistribution of stored vendor payloads. UX-13 assumes PM/Architect treat that as an AC, not a
  footnote.
- **Existing capture miss/fault vocabulary remains authoritative for the 48-ring** (`no stored
  snapshot for <SYMBOL>`, `stored snapshot unreadable: …`); session-archive strings are a **sibling
  closed set**, not a silent overwrite of capture's ring strings.
