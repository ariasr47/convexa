# R1 — pm position: session-chain-archive

## Position

### 0. The product problem in one sentence

We already capture paid Massive options books into a dated research ring, but that ring’s dual
retention (48 per symbol **and** 14 days) fills in roughly one calendar day of traffic and then
**deletes the oldest paid book the same night we bought it**. Next week’s replay therefore cannot
load Tuesday’s book — not because we failed to fetch it, but because prune threw the invoice away.
This feature keeps **one paid book per symbol per ET trading session** in a separate archive the
existing 48-slot / 14-day prune **cannot delete**, so research can still load that session after the
intraday ring has rolled. Research only. Authorizes nothing on the live score. No trader UI.

---

### 1. What ships

A **session-level research archive** beside the existing intraday capture ring:

1. **One session identity per `(symbol, ET trading date)`** — after a symbol is captured during an
   ET session, a dated session-archive entry exists for that pair.
2. **Prune isolation** — running the existing 48-slot / 14-day prune (or filling the ring past its
   cap) must **not** remove or make unloadable that session identity.
3. **Zero-vendor research load after prune** — an operator can load Tuesday’s session book next week
   with **zero Massive calls**, even when that day’s intraday ring copies are gone.
4. **Same-day uniqueness** — a second capture the same ET day does **not** create a second session
   identity (architect names first-wins vs last-wins / when the copy is taken; product binds
   “exactly one”).
5. **Honest absence** — a day with no capture is **`no session book`**, and that state is distinct
   from an empty intraday ring and from a disabled / unavailable archive store.
6. **Desk isolation** — archive write failure never fails bundle / scan / SSE; stored books remain
   non-inputs to score / tier / fingerprint.

No raise of the 48 cap. No new Massive product. No force-capture of liquid names. No object-store
migration. No trader chrome.

---

### 2. Scope

#### In

1. **Session archive of books we already paid to capture** — copy or select from the existing
   paid-book capture path into a session-level archive; **no new vendor fetches** for archival.
2. **Session identity** — one durable research identity per symbol per **ET trading date**
   (America/New_York calendar day of the session), listable and loadable by that identity.
3. **Prune-proof retention relative to the 48 / 14-day ring** — the existing intraday prune must be
   structurally unable to delete session-archive entries (product outcome; architect names the
   side-store shape).
4. **Research list / load of session books** with **zero live Massive calls**, including after the
   corresponding intraday ring rows are gone.
5. **Same-ET-day uniqueness** — at most one session book per `(symbol, ET date)`; a later capture
   the same day does not mint a second identity (selection policy named by architect).
6. **Best-effort isolation from the desk** — archive write / store failures never fail trader
   bundle / scan / SSE.
7. **Score neutrality** — session blobs are never a scoring input; opportunity score / tier /
   fingerprint stay byte-identical with archive on or off / succeeding or failing.
8. **Secret hygiene** — stored session material contains **no** API keys or other secrets.
9. **Honest degraded outcomes** for research reads and archive writes (see ACs) — never fabricate a
   session book, never silently hit Massive to fill a miss, never collapse absence classes.
10. **Operator observability without trader UI** — list / load / presence checks available on the
    research/operator path only.

#### Out

1. **Raising the 48-per-symbol cap** (or widening 14-day retention) to “keep a day” by reprinting
   the afternoon — that is terabytes and still not a session archive.
2. **Buying Massive hist-chain / PIT history** (program P7) or inventing vendor historical endpoints.
3. **`liquid-names-session-capture`** (program #2) — force-capturing SPY/QQQ/IWM when the gex-cache
   is warm; queued next, **not** absorbed here. An empty session archive for those names is an
   honest follow-on, not a defect of this BRIEF.
4. **`chain-archive-object-store`** (program #7) — moving bodies off local / app storage; local
   prune-proof archive first.
5. **`paid-book-join-smoke`, weekly digest ritual, session-corpus wait, AI-rec lab P4`** — later
   program items / habits / waits; not this ship.
6. **Any trader UI**, trader route, nav item, or redistribution of stored books as a trader feed
   (`operator-vs-trader-path-separation`; Massive license: our research only).
7. **Changing live score / tier / gate / fingerprint** — archive authorizes **nothing** on the live
   score (`additive-keeps-score-byte-identical`, `score-change-is-deliberate-and-measured`).
8. **Replacing or deleting the existing 48 / 14-day intraday capture ring** — that store stays; this
   feature adds a session keep beside it.
9. **UI layout, theme, motion, or dashboard chrome** — there is no trader presentation to design.

#### Future-dated (named so they are not absorbed)

- **Force session capture for liquid names** even when cache-warm (program #2).
- **Object-store / dedicated volume** for session bodies (program #7).
- **Multi-week session corpus** before a real time-split / paid-book AUC (program #5 — wait, not a
  build).
- **Join-smoke / weekly digest / AI lab** over the growing session corpus (program #3–#4, #6).
- Vendor hist-chain **if** later purchased (separate GATE I).
- Optional operator dashboard for archive health (only under operator-vs-trader separation; not
  required to ship).

---

### 3. Product behavior

**Actors:** research operator / owner. **Not** the signed-in trader on Landing / Ticker /
Positions / Scanner.

**Happy path (observable without reading source):**

| Situation | What must be true |
|---|---|
| **Symbol T is captured during an ET trading session** (via the existing paid capture path) | After archival completes, a **session identity** for `(T, that ET date)` exists in the session archive. |
| **Intraday ring later prunes** that day’s copies (48-cap or age) | The session identity for `(T, that ET date)` **still exists and remains loadable**. |
| **Research load of that session identity** (including next week) | Load succeeds with **zero live Massive calls**. |
| **Second capture of T the same ET day** | Still **exactly one** session identity for `(T, that ET date)` — no second session row. |
| **List session archive for T** | Operator can see which ET dates have a session book, without using the trader UI. |
| **Trader desk during/after archival** | Bundle / scan / SSE behavior unchanged; archive is invisible on trader routes. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path):**

| Situation | Observable outcome |
|---|---|
| **No capture occurred for T on ET date D** | Research reports **`no session book`** for `(T, D)` — not “empty chain,” not a fabricated book, not a Massive fill-in. |
| **Intraday ring is empty for T** (nothing in the 48-slot store) | That empty-ring state is **observable and distinct** from `no session book` and from a disabled archive store. |
| **Session archive store disabled / not configured / unavailable** | Desk remains up; archival does **not** claim a false stored success; operator sees an honest **disabled / not storing** signal. |
| **Archive write fails** after a paid book was available to archive | Trader-facing scan/serve/SSE **still succeeds**; session archive does **not** gain a new identity for that failure; operator can detect the miss (still `no session book` or unchanged identity, not a silent “stored”). |
| **Requested session identity not found** (never archived, wrong date, etc.) | Research read reports **`no session book`** (or equivalent honest miss) for that identity — **no** vendor fill-in, **no** silent substitute of another date’s book. |
| **Stored session blob unreadable / corrupt** | Research read reports a **store error / unreadable** outcome — still **zero Massive calls**; not presented as `no session book` if the identity exists but cannot be read. |
| **Operator research read path** | Listing or loading session books performs **no vendor fetch**. |
| **Trader routes** | No session-archive browse, no historical-chain product, no redistribution of stored blobs to traders. |
| **Score path** | With archive enabled or disabled, succeeding or failing, score / tier / fingerprint for the same market inputs stay identical. |

**Closed product rules (binding):**

1. **Archive what we already paid for** — never an extra Massive purchase or new SKU.
2. **One session book per `(symbol, ET date)`** — uniqueness is the product; selection timing is
   architect-named.
3. **Prune of the 48-ring cannot delete a session identity** — structural, not prose.
4. **Research-only** — stored session books measure our compute later; not a trader feature.
5. **Desk-first** — when archive and desk disagree under failure, the desk wins.
6. **`no session book` ≠ empty 48-ring ≠ disabled store ≠ unreadable blob** — absence classes stay
   distinct all the way to the operator (`absent-is-not-none`).
7. **Authorizes: nothing** on the live score.

---

### 4. User stories

- **US-1** — As the research operator, I want **one paid options book kept per symbol per ET
  trading session** in an archive the 48 / 14-day prune cannot delete, **so that** Tuesday’s book
  still exists for next week’s replay after the intraday ring has rolled.
- **US-2** — As the research operator, I want to **load a session identity with zero live Massive
  calls** after the corresponding ring copies are gone, **so that** replay does not re-bill or
  depend on vendor availability.
- **US-3** — As the research operator, I want a **second capture the same ET day to leave exactly
  one session identity**, **so that** “Tuesday’s book” is a stable research noun, not a growing
  same-day pile.
- **US-4** — As the research operator, I want **`no session book`, empty intraday ring, disabled
  store, write failure, and unreadable blob** to be textually / observationally distinct, **so that**
  I never mistake “we never archived that day” for “the ring is empty” or trigger a silent vendor
  fetch.
- **US-5** — As the desk owner, I want archive failures to be **best-effort and isolated**, **so
  that** traders still get bundle / scan / SSE when research archival misbehaves.
- **US-6** — As the desk owner, I want the session archive **off every trader route and trader UI**,
  and **never redistributed** as a trader feed, **so that** we honor Massive license intent and
  `operator-vs-trader-path-separation`.
- **US-7** — As the desk owner, I want session blobs to be **non-inputs to scoring**, **so that**
  enabling the archive cannot drift score / tier / fingerprint and the feature authorizes nothing
  on the live score.
- **US-8** — As the owner, I want this ship to **keep the invoice without absorbing program #2–#7**,
  **so that** force-capture, object-store, join-smoke, and corpus-wait stay sequenced correctly.

---

### 5. Acceptance criteria

Every row is one observable outcome a stranger can check without reading source (operator list /
load results, presence after prune, vendor-call counters, desk still serving, no trader surface).
**(SB)** = ship-blocking. `Verify by` is risk-based: `test` where silent regression under an
unrelated change is plausible; `review` where the behavior is visible/intentional. Never
one-test-per-AC theater.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | After symbol T is successfully captured during ET trading date D (via the existing paid capture path) and archival completes, the session archive shows a **session identity** for `(T, D)`. | test |
| AC-2 **(SB)** | US-1 | Given a session identity for `(T, D)`, after the existing 48-slot / 14-day prune removes that day’s intraday ring copies for T (or the ring is force-pruned in verification), the session identity for `(T, D)` **still exists and remains loadable**. | test |
| AC-3 **(SB)** | US-1 | A verification that **poisons / forces the 48-ring prune** and then loads `(T, D)` still succeeds for the session identity — prune of the ring cannot delete the session book. | test |
| AC-4 **(SB)** | US-2 | Loading session identity `(T, D)` completes with **zero live Massive calls** (vendor-call counter for that load stays at 0), including when no intraday ring copy for that day remains. | test |
| AC-5 **(SB)** | US-2 | Listing session-archive identities for a symbol completes with **zero live Massive calls**. | test |
| AC-6 **(SB)** | US-3 | Given an existing session identity for `(T, D)`, after a later successful capture of T still on ET date D, the session archive still shows **exactly one** session identity for `(T, D)` — no second session identity is created. | test |
| AC-7 **(SB)** | US-4 | Requesting session identity `(T, D)` when no book was archived for that pair reports **`no session book`** (honest miss) and does **not** call Massive to create one. | test |
| AC-8 **(SB)** | US-4 | An **empty intraday ring** for T is observable as its own state and is **not** presented as `no session book`, and `no session book` is **not** presented as “empty ring.” | test |
| AC-9 **(SB)** | US-4 | When the session-archive store is **disabled / not configured / unavailable**, the trader desk remains available; archival does **not** report a false stored success; the operator can observe an honest **disabled / not storing** signal distinct from `no session book`. | test |
| AC-10 **(SB)** | US-4 / US-5 | If the archive write fails after a paid book was available to archive, trader-facing scan/serve/SSE still **succeeds**, and the session archive does **not** gain a new successful identity from that failed write. | test |
| AC-11 **(SB)** | US-4 | When a session identity exists but the stored material is **unreadable / corrupt**, the research read reports a **store error / unreadable** outcome (distinct from `no session book`) and performs **zero Massive calls**. | test |
| AC-12 **(SB)** | US-4 | A research miss for `(T, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing stays missing). | test |
| AC-13 **(SB)** | US-1 | Archival itself performs **no additional Massive fetches** beyond the paid capture the existing path already made. | test |
| AC-14 **(SB)** | US-5 | Enabling the session archive does not place archive work on the trader request latency path in a way that makes an archive stall fail or delay the trader response — archival remains side/best-effort relative to the desk. | test |
| AC-15 **(SB)** | US-6 | No trader UI route, nav item, or trader-facing screen exposes session-archive browse, historical chain replay, or stored-blob download. | review |
| AC-16 **(SB)** | US-6 | No trader-facing product path redistributes session-archive books as a market-data feed to end traders (research/operator surfaces stay off the trader origin the same way existing research capture does). | test |
| AC-17 **(SB)** | US-7 | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with session archive on vs off and with archive write succeeding vs failing; session blobs are not scoring inputs. | test |
| AC-18 **(SB)** | US-1 | Stored session material contains **no API keys or other secrets**. | test |
| AC-19 **(SB)** | US-1 | Archival does **not** raise the existing 48-per-symbol cap or rewrite retention so that “keeping a day” is achieved by enlarging the intraday ring instead of a session archive. | review |
| AC-20 | US-8 | This ship does **not** include force-capture of SPY/QQQ/IWM when cache-warm (program #2); absence of those names in the session archive when they were never captured remains honest `no session book`, not a silent defect to “fix” inside this feature. | review |
| AC-21 | US-8 | This ship does **not** include object-store migration (program #7), hist-chain purchase, join-smoke chore execution, or AI-lab work. | review |
| AC-22 | US-6 | Operator verification of the session archive (list / load / presence after prune) is available **without** using the trader UI. | review |
| AC-23 **(SB)** | US-7 | Every research run / load path that surfaces session books states or preserves the standing rule that this archive **authorizes nothing** on the live score (measurement / research corpus only). | review |

**Method notes (risk-based).**

- **`test` concentrates on silent money/correctness failures:** session identity creation (AC-1),
  prune isolation including a poison-prune proof (AC-2/3), zero-vendor list/load after prune
  (AC-4/5), same-day uniqueness (AC-6), distinct absence classes (AC-7–12), no extra vendor fetch
  (AC-13), desk isolation (AC-10/14), no trader redistribution (AC-16), score byte-identity
  (AC-17), no secrets (AC-18). These can die under a refactor while “a file was written somewhere”
  still looks fine — especially prune isolation, which must be structural.
- **`review` owns** absence of trader UI (AC-15), not raising the 48 cap (AC-19), program #2–#7 not
  absorbed (AC-20/21), operator-without-trader-UI check (AC-22), and the explicit “authorizes:
  nothing” research framing (AC-23). Visible/intentional; no trader chrome to snapshot.
- Prefer **one** high-level integration pass: capture during D → assert session identity → force
  48-ring prune → load `(T, D)` with vendor-call counter 0 → second same-day capture still one
  identity → force archive write fail and confirm desk still OK — over per-AC micro-harnesses.
- No DOM harness is required for ship; observability is operator list/load, store presence, desk
  behavior, and vendor-call counters.

**Ship-blocking set:** AC-1–AC-19, AC-16/17 already included. AC-20–AC-23 are required honesty /
scope checks (`review`).

---

### 6. Product decisions locked in this position

1. **This is research/operator archival, not a trader feature** — no trader UI this round.
2. **One session book per `(symbol, ET trading date)`** is the defining noun; architect names
   first-wins vs last-wins and when the copy is taken.
3. **The 48 / 14-day prune must not be able to delete a session identity** — prove it, don’t prose it.
4. **Load/list after prune never call Massive**; missing stays `no session book`.
5. **Absence classes stay split:** `no session book` ≠ empty ring ≠ disabled store ≠ unreadable.
6. **Archive yields to the desk** under failure (`best-effort-isolated-or-null`).
7. **Score / tier / fingerprint stay byte-identical**; blobs are non-inputs; **Authorizes: nothing**.
8. **Do not raise the 48 cap** to fake multi-day retention.
9. **Do not absorb program #2–#7** (force liquid names, object store, join-smoke, rituals, corpus
   wait, AI lab).
10. **Stored session books are not redistributed on trader routes** (license + operator separation).

---

## Risks I see

1. **Quietly raising the 48 cap** instead of building a session archive — reprints this afternoon
   and still fails next week’s Tuesday load. AC-19 + Out list.
2. **Prune prose without structural isolation** — session rows living in a store the 48-prune still
   touches. AC-2/3 exist to make that a failed check (`structural-over-prose-enforcement`).
3. **Same-day append pile** — treating session archive like the intraday ring and keeping every
   capture per day. AC-6.
4. **Collapsed absence** — presenting empty ring, disabled store, and never-archived as one “none”
   string so research cannot tell what to fix. AC-7–11 (`absent-is-not-none`).
5. **Silent vendor fill-in on miss** — “helpful” Massive fetch when Tuesday’s book is absent. AC-4/5/7/12.
6. **Archive failing the desk** — write on the ticker request path, or failing serve on storage
   errors. AC-10/14.
7. **Program absorption** — smuggling SPY/QQQ/IWM force-capture or object-store into “make the
   archive useful.” AC-20/21.
8. **Trader redistribution creep** — a historical-chain trader endpoint for “convenience.” AC-15/16.
9. **Score drift via “just one more input.”** AC-17 + Authorizes: nothing.
10. **Secrets in blobs.** AC-18.
11. **Selection-policy ambiguity left unowned** — if architect never names first-wins vs last-wins,
    “exactly one” can still thrash under concurrent captures; product requires a named stable rule
    even though the choice is technical.

---

## Assumptions I'm making about the other two lanes

**About the technical shape (architect):**

- A **side-store (or equivalent) the existing 48 / 14-day prune does not touch** can be named for
  session identities, without raising the intraday cap.
- Session identity can be keyed as **`(symbol, ET trading date)`** with ET meaning America/New_York
  calendar date of the session, and can be listed/loaded by that identity.
- Architect will **name first-wins vs last-wins (or explicit close / last RTH slow-lane)** for
  same-day selection so “exactly one” is enforceable, not racey.
- Archival can run as **copy/select off books already captured**, adding **no extra Massive calls**
  and not sitting on the trader request latency path.
- A research **list/load** path for session books can guarantee **zero vendor I/O**, including on
  miss (miss → `no session book`, never fetch-fill).
- **Poison-prune verification** is feasible: force the 48-ring prune and still load the session
  identity (`structural-over-prose-enforcement`).
- Archive write failures can be swallowed at the desk boundary so scan/serve/SSE still succeed.
- Session blobs can be kept out of scoring modules so score / tier / fingerprint stay byte-identical.
- Serialization can exclude secrets from stored session material.
- Citations for the existing ring / prune / capture spine will use **live Rust**
  `chain_snapshot` capture/store/pg + retention defaults — not Python-era assumptions
  (`cited-code-is-verified-not-assumed`).

**About the presentation (ux):**

- There is **no trader UI to design**; UX will not invent a session-history trader surface to “make
  the archive visible.”
- If UX speaks at all, it confirms **absence**: no nav entry, no ticker chrome, no settings toggle
  aimed at traders for this archive.
- Operator-facing clarity may lightly touch research/CLI wording so `no session book`, empty ring,
  disabled store, and unreadable stay distinguishable — but pixel layout, motion, and theme work
  are out of scope; my ACs bind operator list/load/desk observables, not screens.
- UX will not reframe this as a trader “historical chain” product story this round — license and
  operator separation forbid that.
- Dark/light / motion inventory constraints are irrelevant to ship criteria here because no new
  trader surface ships; I am not assuming new UI components.
