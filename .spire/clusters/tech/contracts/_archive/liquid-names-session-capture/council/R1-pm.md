# R1 — pm position: liquid-names-session-capture

## Position

### 0. The product problem in one sentence

We already ship a prune-proof **session archive** and a zero-Massive research list/load, but
session capture still rides only the **cache-miss** paid-compute path. When the live cache stays
warm all day for the score-lab names, no paid book is handed to capture, so **SPY / QQQ / IWM** can
finish an ET trading day with an honest research miss (`no session book`) even though they were
scannable and servable. This feature closes that hole for those three names only: after an ET
session where they are in the paid-capture universe, each has a **loadable session-archive book for
that date**, warm cache or not. Research read stays zero-Massive. Honest `no session book` remains
when we truly never had a paid book. No trader UI. Authorizes nothing on the live score. Does not
absorb program #3–#7.

---

### 1. What ships

An **ensure-session guarantee** for the closed liquid set **SPY, QQQ, IWM**:

1. **Warm-cache is not an excuse** — after an ET trading day where those names were in the
   paid-capture universe and scannable/servable, research list/load for `(SPY|QQQ|IWM, D)` is a
   **hit**, not `no session book`, even if the live cache never missed that day.
2. **Research load stays zero-Massive** — a successful session-book load for those identities still
   carries mandatory provenance (`source_as_of`) and performs **zero** live Massive calls on the
   read.
3. **Prefer already-paid material** — when a same-ET-date paid book already exists in the intraday
   capture ring, ensuring the session archive must **not** invent an extra Massive purchase just to
   fill the archive (architect names promote-from-ring vs force-compute; product binds “no
   unnecessary second invoice”).
4. **Bounded off-path fill when nothing was kept yet** — if no session identity exists yet and the
   ring also has nothing to promote for that ET date, any paid fetch needed to create the book runs
   **off the trader request path**, and **at most once per name per ET day**.
5. **Honest true absence** — if capture/ensure is disabled, or we truly never obtained a paid book,
   research still reports **`no session book`** — never a fabricated empty book.
6. **Desk + score isolation** — ensure/capture failure never fails trader serve/scan/SSE; score /
   tier / fingerprint stay byte-identical; authorizes nothing on the live score.

Closed names this ship: **SPY, QQQ, IWM only** — not the whole paid-capture universe.

---

### 2. Scope

#### In

1. **Session-archive presence for SPY, QQQ, and IWM on each ET trading day they are in the
   paid-capture universe**, even when the live cache was warm all day (the defining fix).
2. **Reuse of the existing session-archive identity and research list/load** — one book per
   `(symbol, ET date)`; successful load still shows mandatory `source_as_of`; read path stays
   **zero Massive**.
3. **Ensure behavior that prefers already-paid material** when a same-day ring book exists
   (zero extra Massive for that ensure), and only then a **bounded off-path** paid fill when neither
   session identity nor promotable same-day material exists.
4. **At-most-once paid ensure per liquid name per ET day** when no session identity exists yet —
   no retry storm, no per-request Massive tax on the desk.
5. **Best-effort isolation from the desk** — ensure / force-compute / archive write failures never
   fail trader bundle / scan / SSE; trader request path does not await ensure Massive I/O.
6. **Score neutrality** — this feature writes nothing into live score / tier / gate / fingerprint;
   outcomes stay byte-identical with ensure on vs off / succeeding vs failing.
7. **Honest degraded outcomes** — disabled ensure, true never-captured, ensure failure, and
   research miss remain distinguishable and non-fabricating (`absent-is-not-none`).
8. **Operator observability without trader UI** — presence / miss for the three names remains
   checkable on the existing research/operator path.
9. **Secret hygiene** — any newly stored session material contains no API keys or other secrets.

#### Out

1. **Raising the 48-per-symbol cap** or stretching 14-day ring retention to fake multi-day keep.
2. **Buying Massive hist-chain / PIT history** (P7) or inventing vendor historical endpoints.
3. **Force-capturing the whole paid-capture universe** — this ship is the three lab names only.
4. **Program #3 `paid-book-join-smoke`** — chore sequenced after the names actually have books; not
   absorbed.
5. **Program #4 weekly digest ritual** — habit; not a build in this BRIEF.
6. **Program #5 session-corpus wait** — calendar wait; not a build.
7. **Program #6 AI-rec lab P4** — blocked-on corpus; not absorbed.
8. **Program #7 object-store / dedicated volume migration** — local archive first; not absorbed.
9. **Any trader UI**, trader route, nav item, Settings control, or redistribution of stored books as
   a trader feed (`operator-vs-trader-path-separation`; Massive license: research only).
10. **Changing live score / tier / gate / fingerprint** — ensure authorizes **nothing** on the live
    score.
11. **Rewriting Path-B / batch-backtest / replay-outcome-join CLIs** onto a new vehicle — existence +
    loadability of the three names’ session books is enough.
12. **UI layout, theme, motion, or dashboard chrome** — there is no trader presentation to design.

#### Future-dated (named so they are not absorbed)

- Join-smoke on real Tuesday books once SPY/QQQ/IWM reliably archive (program #3).
- Weekly score-lab ritual growth on those books (program #4).
- Multi-week corpus before a real time-split / paid-book AUC (program #5 — wait).
- AI-rec lab P4 after corpus (program #6).
- Object-store migration for session bodies (program #7).
- Expanding ensure beyond SPY/QQQ/IWM (separate scope decision; not this ship).
- Vendor hist-chain **if** later purchased (separate GATE I).

---

### 3. Product behavior

**Actors:** research operator / owner. **Not** the signed-in trader on Landing / Ticker /
Positions / Scanner / Settings / Ask-AI.

**Happy path (observable without reading source):**

| Situation | What must be true |
|---|---|
| **ET trading day D** where SPY, QQQ, and IWM are in the paid-capture universe and were scannable/servable, **even if live cache stayed warm all day** | After ensure/archival for D completes, research list/load for each of `(SPY, D)`, `(QQQ, D)`, `(IWM, D)` is a **hit** — a loadable session-archive book exists for each. |
| **Successful research load** of one of those identities | Load returns the session book with mandatory **`source_as_of`**, and the load performs **zero live Massive calls**. |
| **Research list** for one of those symbols | Listing session identities performs **zero live Massive calls**. |
| **Same-ET-date paid material already sits in the intraday ring** for that name | Ensuring the session archive for D does **not** require an additional Massive fetch (promote/reuse already-paid material). |
| **Session identity already exists** for `(name, D)` | A later ensure the same ET day does **not** create a second session identity and does **not** spend another paid fetch for that identity. |
| **Trader desk during/after ensure** | Bundle / scan / SSE behavior unchanged; ensure is invisible on trader routes. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path):**

| Situation | Observable outcome |
|---|---|
| **Capture / ensure disabled** (or otherwise configured off) for the day | Research for `(SPY\|QQQ\|IWM, D)` remains honest **`no session book`** — **not** a fabricated empty book, **not** a silent Massive fill-in on the research read. |
| **Ensure / off-path paid fill fails** after a warm day with no promotable material | Trader serve/scan/SSE still **succeeds**; session archive does **not** gain a fabricated success identity from that failure; research miss stays **`no session book`** (or unchanged prior identity). |
| **No session identity yet and no promotable same-day ring material** | At most **one** paid ensure attempt per liquid name per ET day runs **off the trader request path**; the trader HTTP path does not await that Massive I/O. |
| **Requested identity still missing** (never archived) | Research reports **`no session book`** for that pair and does **not** call Massive on the read to create one. |
| **Session archive store disabled / not storing** | Desk remains up; operator sees the existing **not storing** class — distinct from `no session book` and from unreadable. |
| **Session identity exists but stored material is unreadable** | Research reports the existing **unreadable** class — distinct from `no session book` / not-storing — with **zero Massive** on the read. |
| **A non-liquid ticker** (outside SPY/QQQ/IWM) stays cache-warm all day | This ship does **not** promise a session book for that ticker; its warm-cache miss remains an honest follow-on, not a defect of this BRIEF. |
| **Score path** | With ensure on or off, succeeding or failing, score / tier / fingerprint for the same market inputs stay identical; feature authorizes nothing on the live score. |
| **Trader routes** | No ensure control, no session-archive browse, no historical-chain product, no redistribution of stored blobs to traders. |

**Closed product rules (binding):**

1. **Warm cache must not erase Tuesday’s SPY/QQQ/IWM books** — that is the ship.
2. **Research reads never buy Massive** — miss stays miss; hit carries `source_as_of`.
3. **Prefer already-paid material; invoice at most once per name per ET day** when a fill is still
   required — and never on the trader request await path.
4. **True absence stays honest** — disabled / never-had-a-paid-book → `no session book`, never a
   fabricated empty book (`absent-is-not-none`).
5. **Closed set** — SPY, QQQ, IWM only this ship.
6. **Desk-first** — when ensure and desk disagree under failure, the desk wins
   (`best-effort-isolated-or-null`).
7. **Authorizes: nothing** on the live score (`additive-keeps-score-byte-identical`).
8. **Do not absorb program #3–#7.**

---

### 4. User stories

- **US-1** — As the research operator, I want **SPY, QQQ, and IWM each to have a loadable
  session-archive book for ET date D** after a day they were in the paid-capture universe,
  **even when the live cache stayed warm**, **so that** next week’s paid-book join can load those
  lab names’ Tuesday books.
- **US-2** — As the research operator, I want **research list/load of those session books to stay
  zero-Massive** and to carry **mandatory `source_as_of` on every successful load**, **so that**
  replay does not re-bill or pretend provenance is optional.
- **US-3** — As the desk owner, I want any paid fill required for ensure to run **off the trader
  request path** and **at most once per liquid name per ET day**, **so that** fixing the archive
  hole does not tax ticker latency or retry-storm the vendor.
- **US-4** — As the research operator, I want ensure to **prefer already-paid same-day material**
  when it exists, **so that** we do not buy a second Massive book just because the cache was warm.
- **US-5** — As the research operator, I want **`no session book` to remain honest** when capture /
  ensure was disabled or we truly never obtained a paid book, **so that** absence is never a
  fabricated empty book and never collapsed into “not storing” or “unreadable.”
- **US-6** — As the desk owner, I want ensure failures to be **best-effort and isolated**, **so that**
  traders still get bundle / scan / SSE when research ensure misbehaves.
- **US-7** — As the desk owner, I want this feature **off every trader route and trader UI**, and
  **never redistributed** as a trader feed, **so that** we honor Massive license intent and
  `operator-vs-trader-path-separation`.
- **US-8** — As the desk owner, I want ensure/session blobs to be **non-inputs to scoring**, **so
  that** enabling ensure cannot drift score / tier / fingerprint and the feature authorizes nothing
  on the live score.
- **US-9** — As the owner, I want this ship to **close only the three-name warm-cache hole** and
  **not absorb program #3–#7**, **so that** join-smoke, rituals, corpus-wait, AI lab, and
  object-store stay sequenced correctly.

---

### 5. Acceptance criteria

Every row is one observable outcome a stranger can check without reading source (operator
list/load results, vendor-call counters, desk still serving, no trader surface). **(SB)** =
ship-blocking. `Verify by` is risk-based: `test` where silent regression under an unrelated change
is plausible; `review` where the behavior is visible/intentional. Never one-test-per-AC theater.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | After ET trading date D on which SPY is in the paid-capture universe and was scannable/servable, **even when the live cache for SPY stayed warm all day**, research list/load for `(SPY, D)` is a **hit** — a loadable session-archive book exists. | test |
| AC-2 **(SB)** | US-1 | Same as AC-1 for **QQQ** on `(QQQ, D)`. | test |
| AC-3 **(SB)** | US-1 | Same as AC-1 for **IWM** on `(IWM, D)`. | test |
| AC-4 **(SB)** | US-2 | A successful research **load** of `(SPY\|QQQ\|IWM, D)` completes with **zero live Massive calls** and surfaces mandatory **`source_as_of`**. | test |
| AC-5 **(SB)** | US-2 | Listing session-archive identities for SPY, QQQ, or IWM completes with **zero live Massive calls**. | test |
| AC-6 **(SB)** | US-4 | Given a same-ET-date paid book already present in the intraday capture ring for a liquid name on D, and no session identity yet, ensuring the session archive for that name on D creates the session identity **without an additional Massive fetch**. | test |
| AC-7 **(SB)** | US-3 | When neither a session identity nor promotable same-day ring material exists for a liquid name on D, any paid fill required to create the session book runs **off the trader request path** (trader HTTP does not await that Massive I/O). | test |
| AC-8 **(SB)** | US-3 | For a liquid name on ET date D with no session identity yet, paid ensure performs **at most one** Massive fetch that day for that name (no per-request / retry-storm second invoice under repeated ensure triggers). | test |
| AC-9 **(SB)** | US-1 / US-3 | Given an existing session identity for `(SPY\|QQQ\|IWM, D)`, a later ensure the same ET day leaves **exactly one** session identity for that pair and does **not** spend another paid fetch for that identity. | test |
| AC-10 **(SB)** | US-5 | When capture/ensure is **disabled** for the day, research for `(SPY\|QQQ\|IWM, D)` reports honest **`no session book`** and does **not** fabricate an empty book or call Massive on the research read to create one. | test |
| AC-11 **(SB)** | US-5 / US-6 | If ensure / off-path paid fill / archive write **fails** after a warm day with no promotable material, trader-facing serve/scan/SSE still **succeeds**, and the session archive does **not** gain a fabricated successful identity from that failure. | test |
| AC-12 **(SB)** | US-5 | A research miss for `(SPY\|QQQ\|IWM, D)` reports **`no session book`** and performs **zero Massive calls** on the read — miss does not silently fill from vendor. | test |
| AC-13 **(SB)** | US-5 | When the session-archive store is **disabled / not storing**, the operator observes the existing **not storing** outcome — distinct from `no session book` and from unreadable — and the trader desk remains available. | test |
| AC-14 **(SB)** | US-5 | When a session identity exists but stored material is **unreadable**, the research read reports the existing **unreadable** outcome — distinct from `no session book` and not-storing — with **zero Massive calls**. | test |
| AC-15 **(SB)** | US-5 | A research miss for `(name, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing stays missing). | test |
| AC-16 **(SB)** | US-6 | Ensure work does not place Massive I/O or archive I/O on the trader request latency path in a way that makes an ensure stall fail or delay the trader response. | test |
| AC-17 **(SB)** | US-8 | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with liquid-name ensure on vs off and with ensure succeeding vs failing; ensure/session blobs are not scoring inputs. | test |
| AC-18 **(SB)** | US-7 | No trader UI route, nav item, or trader-facing screen exposes ensure controls, session-archive browse, historical chain replay, or stored-blob download. | review |
| AC-19 **(SB)** | US-7 | No trader-facing product path redistributes session-archive books as a market-data feed to end traders (research/operator surfaces stay off the trader origin the same way existing research capture does). | test |
| AC-20 **(SB)** | US-1 | Stored session material written by this feature contains **no API keys or other secrets**. | test |
| AC-21 **(SB)** | US-9 | This ship does **not** raise the existing 48-per-symbol cap or rewrite ring retention so that “keeping a day” is achieved by enlarging the intraday ring instead of ensuring the session archive. | review |
| AC-22 **(SB)** | US-9 | This ship’s ensure guarantee applies to the closed set **SPY, QQQ, IWM only** — it does **not** promise warm-cache session books for the rest of the paid-capture universe. | review |
| AC-23 | US-9 | This ship does **not** include program #3 join-smoke execution, #4 weekly ritual, #5 corpus wait, #6 AI-rec lab P4, #7 object-store migration, or hist-chain purchase. | review |
| AC-24 | US-7 | Operator verification of SPY/QQQ/IWM session-book presence / miss is available **without** using the trader UI. | review |
| AC-25 **(SB)** | US-8 | Every successful research list/load that surfaces these session books preserves the standing rule that this archive **authorizes nothing** on the live score. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent money/correctness failures:** warm-cache still yields session
  books for each of the three names (AC-1–3), zero-vendor research list/load with mandatory
  `source_as_of` (AC-4/5), promote-without-second-invoice (AC-6), off-path + at-most-once paid fill
  (AC-7/8), same-day uniqueness without re-fetch (AC-9), honest disabled/miss/failure classes
  (AC-10–15), desk isolation (AC-11/16), no trader redistribution (AC-19), score byte-identity
  (AC-17), no secrets (AC-20). These can die under a refactor while “cache still serves tickers”
  looks fine — especially the warm-cache hole this feature exists to close.
- **`review` owns** absence of trader UI (AC-18), not raising the 48 cap (AC-21), closed three-name
  scope (AC-22), program #3–#7 not absorbed (AC-23), operator-without-trader-UI check (AC-24), and
  the explicit “authorizes: nothing” research framing (AC-25). Visible/intentional; no trader chrome
  to snapshot.
- Prefer **one** high-level integration pass: warm-cache day for SPY/QQQ/IWM → assert three session
  identities → load each with vendor-call counter 0 + `source_as_of` present → ring-present promote
  path spends 0 Massive → ring-empty path spends ≤1 Massive off trader await → disable ensure and
  confirm honest `no session book` → force ensure fail and confirm desk still OK — over per-AC
  micro-harnesses.
- No DOM harness is required for ship; observability is operator list/load, vendor-call counters,
  desk behavior, and structural trader silence.

**Ship-blocking set:** AC-1–AC-22, AC-25. AC-23–AC-24 are required honesty / scope checks
(`review`).

---

### 6. Product decisions locked in this position

1. **This is a research/operator ensure for three lab names, not a trader feature.**
2. **Warm cache must not be a reason for `no session book` on SPY/QQQ/IWM** after an ET day they
   were in the paid-capture universe.
3. **Research list/load stays zero-Massive**; successful load keeps mandatory `source_as_of`.
4. **Prefer already-paid same-day material**; paid fill only when needed, **≤1 per name per ET
   day**, **off the trader request path**.
5. **True absence stays honest** — disabled / never-had-a-paid-book → `no session book`, never a
   fabricated empty book.
6. **Closed set = SPY, QQQ, IWM** — not the whole universe.
7. **Ensure yields to the desk** under failure.
8. **Score / tier / fingerprint stay byte-identical**; **Authorizes: nothing**.
9. **Do not absorb program #3–#7.**
10. **Do not raise the 48 cap** to fake the keep.

---

## Risks I see

1. **Silent re-narrowing** — shipping “document that warm cache skips capture” instead of actually
   ensuring the three names get books. AC-1–3 exist to make that a failed check.
2. **Putting paid fill on the ticker request path** — “fix” the hole by forcing compute inside
   serve latency. AC-7/16.
3. **Second invoice habit** — ensure always re-fetches Massive even when the ring already holds a
   same-day paid book. AC-6/8/9.
4. **Retry storms** — every scanner tick or health loop re-bills Massive for the same name/day.
   AC-8.
5. **Fabricated empty books** — writing a hollow session identity so research no longer says
   `no session book` when we never had a paid book. AC-10/11 (`absent-is-not-none`).
6. **Collapsed absence** — disabled ensure, never-archived, not-storing, and unreadable presented as
   one “none.” AC-10–14.
7. **Silent vendor fill-in on research miss** — “helpful” Massive fetch when Tuesday’s book is
   absent. AC-4/5/12.
8. **Universe creep** — expanding ensure to the whole paid-capture set inside this BRIEF. AC-22.
9. **Program absorption** — smuggling join-smoke, object-store, or hist-chain into “make the books
   useful.” AC-23.
10. **Trader redistribution / UI creep** — a settings toggle or historical-chain trader endpoint.
    AC-18/19.
11. **Score drift via “just one more input.”** AC-17 + Authorizes: nothing.
12. **Treating cache-warm miss as already solved by session-chain-archive** — #1 proved prune
    isolation; it explicitly left this hole open. This position refuses to redefine that miss as
    out-of-scope honesty.

---

## Assumptions I'm making about the other two lanes

**About the technical shape (architect):**

- Architect can name a mechanism that **ensures session identities for SPY, QQQ, and IWM on ET date
  D even when live cache never missed**, without raising the 48-cap or rewriting Path-B CLIs.
- When a same-ET-date paid book already exists in the intraday ring, architect can **promote/reuse
  that material into the session archive with zero additional Massive calls**.
- When the ring also has nothing to promote and no session identity exists yet, architect can name a
  **bounded off-path paid fill** that runs **outside the trader request await path**.
- Paid ensure for a liquid name on ET date D can be bounded to **at most one Massive fetch that
  day** when no session identity exists yet.
- Ensure/archive failures can be swallowed at the desk boundary so serve/scan/SSE still succeed
  (`best-effort-isolated-or-null`).
- Ensure/session blobs can be kept out of scoring modules so score / tier / fingerprint stay
  byte-identical (`additive-keeps-score-byte-identical`).
- Research list/load for session books continues to guarantee **zero vendor I/O**, including on
  miss (miss → `no session book`, never fetch-fill), with mandatory `source_as_of` on successful
  load.
- The ensure set can be structurally limited to **SPY, QQQ, IWM** this ship (not an accidental
  whole-universe force-capture).
- Citations for the warm-cache hole and capture spine will use **live Rust** session-archive /
  capture / analytics cache-hit behavior — not Python-era assumptions
  (`cited-code-is-verified-not-assumed`).
- If the technical shape cannot deliver warm-cache session books for the three names without
  putting Massive on the trader request path, architect will surface that conflict rather than
  silently narrowing the product outcome.

**About the presentation (ux):**

- There is **no trader UI to design**; UX will not invent an ensure control, session-history trader
  surface, or Settings toggle to “make capture visible.”
- If UX speaks at all, it confirms **absence**: no nav entry, no ticker chrome, no trader-facing
  ensure affordance.
- Operator-facing clarity may lightly restate that research miss remains `no session book` when
  ensure was disabled / never paid — but pixel layout, motion, and theme work are out of scope; my
  ACs bind operator list/load/desk observables, not screens.
- UX will not reframe this as a trader “historical chain” or “always-fresh liquid names” product
  story this round — license and operator separation forbid that.
- Dark/light / motion inventory constraints are irrelevant to ship criteria here because no new
  trader surface ships; I am not assuming new UI components.
