# R1 — pm position: chain-archive-object-store

## Position

### 0. The product problem in one sentence

We already keep one paid options book per symbol per ET day in a prune-proof session archive, and
we already force liquid names into that archive — but the **full chain bodies still live beside
identity in the app database / unbounded local workspace**, so **weeks of paid books make the
OLTP volume the retention policy**. Local unthinned ring traffic alone was multi-GB in a day;
session books are meant to accumulate for the corpus wait. This feature puts **bodies in object
storage or a dedicated volume**; the app database (or a thin index) keeps **identity + provenance +
list metadata**. Research still loads the book with **zero Massive**. A missing object is honest
**`session book unreadable` / `no session book`**, never a silent vendor refill. Research only.
Authorizes nothing on the live score. No trader UI.

---

### 1. What ships

A **body/index split** for paid research books so production can keep weeks of session corpus
without filling the app database:

1. **Session-archive bodies leave the app OLTP volume** — after archival, the chain body for a
   session identity is **not** retained as an unbounded blob in the app database; it lives in
   object storage or a dedicated volume. Identity + mandatory as-of provenance + list metadata
   remain queryable without loading the body.
2. **Research load still returns the book** — given a stored session identity whose body is
   present in the object/volume store, research load succeeds with the body, **mandatory as-of
   provenance**, and **zero live Massive calls**.
3. **Missing object is honest** — if the identity is absent → **`no session book`**; if the
   identity exists but the body object is missing/unreadable → **`session book unreadable`**
   (or the already-shipped unreadable class). **Never** a silent Massive refill to “help.”
4. **List stays metadata-cheap** — research list of session identities works from the thin index /
   metadata and does **not** require pulling every body, and still makes **zero Massive calls**.
5. **Desk isolation** — object-store I/O does **not** sit on the trader request path; store
   failures never fail bundle / scan / SSE; score / tier / fingerprint stay byte-identical;
   stored books remain non-inputs and authorize **nothing**.
6. **Ring bodies this ship — named decision, not silence** — product preference is that **any
   paid-book body class still living on the same app OLTP volume** also leaves that volume if it
   would otherwise remain the retention bottleneck. Architect **names** whether the 48-ring bodies
   move in this ship or stay; deferring ring must be an **explicit** residual risk, not an
   accidental narrowing of the BRIEF.

No raise of the 48 cap. No new Massive product. No trader chrome. No AI lab start. No rewrite of
Path-B research CLIs beyond what is required to open the **same** store the archive already uses.

---

### 2. Scope

#### In

1. **Move session-archive chain bodies off the app database / unbounded workspace blob store** into
   **object storage or a dedicated volume** so weeks of session books can accumulate without the
   app DB disk acting as retention policy.
2. **Thin durable index** for session identities — identity `(symbol, ET date)`, mandatory as-of
   provenance, and list metadata remain available without storing the full chain body in the app
   DB row (pointer-or-equivalent is fine; product binds “body not on OLTP,” not the pointer shape).
3. **Research list / load continue to work** after the split: load returns body + mandatory
   provenance with **zero Massive**; list remains zero-Massive and does not require bulk body pulls.
4. **Honest object-miss / unreadable / not-storing outcomes** — preserve the shipped absence
   classes (`no session book` ≠ `session archive not storing` ≠ `session book unreadable` ≠ empty /
   pruned intraday ring); a missing object never collapses into a silent vendor fill.
5. **Migration / cutover honesty for already-archived bodies** — after this ship, new session
   archives do not leave full bodies on the app OLTP volume; existing bodies either move or are
   otherwise made loadable under the same research contract (architect names cutover; product binds
   “research can still load what we claim to keep”).
6. **Best-effort isolation from the desk** — object I/O and archive/store failures never fail
   trader bundle / scan / SSE; object work stays off the trader request latency path.
7. **Score neutrality** — bodies / pointers are never scoring inputs; opportunity score / tier /
   fingerprint stay byte-identical with the object store on or off / succeeding or failing.
8. **Secret hygiene** — stored material (bodies and index) contains **no** API keys or other
   secrets; deploy artifacts still carry no secrets (`no-secrets-in-image`).
9. **Operator observability without trader UI** — list / load / miss / unreadable checks remain on
   the research/operator path only.
10. **Minimal Path-B continuity** — existing research tools that already open the session archive
    (or must, to keep replay/corpus work alive) continue to load books from the **same** store
    after the split; this ship does **not** invent a second corpus or require a CLI rewrite beyond
    opening that store.

#### Out

1. **Buying Massive hist-chain / PIT history** (program P7) or inventing vendor historical
   endpoints to paper over storage.
2. **Raising the 48-per-symbol cap** or stretching 14-day ring retention to fake multi-week keep.
3. **Starting `ai-rec-lab-p4`** or otherwise absorbing program #6 (still blocked-on corpus wait +
   boring P2–P3 use).
4. **Executing the session-corpus wait** (program #5) — clock already started; this ship enables
   accumulation, it does not declare the wait done.
5. **Join-smoke / weekly digest ritual work** as part of this feature — habits/chores stay outside.
6. **Any trader UI**, trader route, nav item, Settings control, or redistribution of stored books
   as a trader feed (`operator-vs-trader-path-separation`; Massive license: research only).
7. **Changing live score / tier / gate / fingerprint** — authorizes **nothing**
   (`additive-keeps-score-byte-identical`, `score-change-is-deliberate-and-measured`).
8. **Replacing prune-proof session identity semantics** — still one book per `(symbol, ET date)`;
   first-wins / uniqueness rules from the shipped session archive stay; this is a **storage locus**
   change, not a new archive product.
9. **Broad Path-B / batch-backtest / replay-outcome-join redesign** — only open-the-same-store
   continuity is In; no new CLI product surface is required to ship.
10. **UI layout, theme, motion, or dashboard chrome** — there is no trader presentation to design.

#### Future-dated (named so they are not absorbed)

- **48-ring body migration** if architect explicitly defers it this ship (residual OLTP risk must
  be named).
- **Multi-week corpus readiness gate** / paid-book AUC (program #5 wait completing on calendar).
- **AI-rec lab P4** over the growing corpus (program #6).
- Optional operator dashboard for object-store health / orphaned-pointer audits (only under
  operator-vs-trader separation; not required to ship).
- Lifecycle / cold-tier / delete policies beyond “bodies off app OLTP so weeks can accumulate.”
- Vendor hist-chain **if** later purchased (separate GATE I).

---

### 3. Product behavior

**Actors:** research operator / owner. **Not** the signed-in trader on Landing / Ticker /
Positions / Scanner / Settings / Ask-AI.

**Happy path (observable without reading source):**

| Situation | What must be true |
|---|---|
| **Session book for `(T, D)` is archived after this ship** | Research can list identity `(T, D)` from metadata; the **full chain body is not retained as an unbounded blob on the app database volume** (body lives in object storage / dedicated volume; index may hold only a pointer-or-equivalent). |
| **Research load of `(T, D)` when body is present** | Load succeeds with the book body, **mandatory as-of provenance**, and **zero live Massive calls**. |
| **Many session identities accumulate over weeks** | App-database growth for those identities does **not** scale with full chain-body size; retention is no longer “whatever fits on the OLTP disk.” |
| **Research list for T** | Operator sees which ET dates have a session book **without** pulling every body and **without** Massive. |
| **Trader desk during/after storage I/O** | Bundle / scan / SSE unchanged; object-store work is invisible on trader routes and does not stall trader responses. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path):**

| Situation | Observable outcome |
|---|---|
| **No session identity for `(T, D)`** | Research reports **`no session book`** — **zero Massive**; not a fabricated book. |
| **Identity exists but body object is missing** | Research reports **`session book unreadable`** (or equivalent unreadable class) — **distinct from `no session book`** — **zero Massive**; never a silent vendor refill. |
| **Body object corrupt / unreadable** | Same **unreadable** class — **zero Massive**; not presented as a successful book and not collapsed into “not storing.” |
| **Object / volume store disabled, misconfigured, or unavailable** | Desk remains up; archival does **not** claim a false stored success; operator sees honest **`session archive not storing`** (or store-error class) distinct from miss and unreadable. |
| **Index says “stored” but object put never completed (orphan pointer / partial write)** | Research load does **not** return a fake success; outcome is **unreadable / store error** (architect names exact class) with **zero Massive**; operator can tell the book is not safely loadable. |
| **Object store reachable but slow** | Trader request path still succeeds; object I/O does not fail or delay the desk response. |
| **Empty / pruned intraday ring for T** | Remains its own shipped ring-miss outcome — **not** rewritten as `no session book` and not used as a pretext to hit Massive. |
| **Score path** | With object store enabled or disabled, succeeding or failing, score / tier / fingerprint for the same market inputs stay identical. |
| **Trader routes** | No archive/object-store browse, no historical-chain product, no redistribution of stored blobs to traders. |

**Closed product rules (binding):**

1. **App DB is not the body retention volume** for session-archive books after this ship.
2. **Research load stays zero-vendor** — present body, missing identity, missing object, corrupt
   object, and not-storing alike: **never** a Massive fill-in.
3. **Absence classes stay split** — `no session book` ≠ `session book unreadable` ≠
   `session archive not storing` ≠ empty/pruned ring (`absent-is-not-none`).
4. **Mandatory as-of provenance on every successful load** — identity stays `(symbol, ET date)`;
   provenance remains visible (shipped session-archive rule; storage locus must not drop it).
5. **Desk-first** — when object store and desk disagree under failure, the desk wins
   (`best-effort-isolated-or-null`).
6. **Authorizes: nothing** on the live score.
7. **Research-only** — stored books measure our compute later; not a trader feature.
8. **Do not raise the 48 cap** or buy hist-chain to avoid doing the storage split.
9. **Ring-body move is named** — In this ship or explicitly deferred with residual OLTP risk stated.

---

### 4. User stories

- **US-1** — As the research operator, I want **session-archive chain bodies off the app database
  volume**, **so that** weeks of paid session books can accumulate in production without OLTP disk
  becoming the retention policy.
- **US-2** — As the research operator, I want to **load a session identity after the body/index
  split and still receive the book with mandatory as-of provenance and zero Massive calls**, **so
  that** replay / corpus work does not regress when storage moves.
- **US-3** — As the research operator, I want a **missing or corrupt body object to surface as
  honest `session book unreadable` (not `no session book`, not a Massive refill)**, **so that** I
  can tell “never archived” from “pointer without bytes” and never silently re-bill the vendor.
- **US-4** — As the research operator, I want to **list session identities from thin metadata
  without pulling bodies and without Massive**, **so that** corpus inventory stays cheap as the
  archive grows.
- **US-5** — As the desk owner, I want object-store I/O and failures to be **best-effort and off the
  trader request path**, **so that** traders still get bundle / scan / SSE when research storage
  misbehaves.
- **US-6** — As the desk owner, I want this storage split **off every trader route and trader UI**,
  and **never redistributed** as a trader feed, **so that** we honor Massive license intent and
  `operator-vs-trader-path-separation`.
- **US-7** — As the desk owner, I want bodies / pointers to be **non-inputs to scoring**, **so that**
  enabling the object store cannot drift score / tier / fingerprint and the feature authorizes
  nothing on the live score.
- **US-8** — As the owner, I want this ship to **solve the OLTP-retention failure without absorbing
  hist-chain, the 48-cap raise, AI lab, or the corpus-wait clock**, **so that** program sequencing
  stays honest.

---

### 5. Acceptance criteria

Every row is one observable outcome a stranger can check without reading source (operator list /
load results, vendor-call counters, desk still serving, app-DB vs body-store retention behavior, no
trader surface). **(SB)** = ship-blocking. `Verify by` is risk-based: `test` where silent regression
under an unrelated change is plausible; `review` where the behavior is visible/intentional. Never
one-test-per-AC theater.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | After a session book for `(T, D)` is successfully archived under the post-split store, the **full chain body is not retained as an unbounded blob on the app database volume** for that identity (body resides in object storage or a dedicated volume; the app DB / thin index may hold identity, provenance, list metadata, and at most a pointer-or-equivalent). | test |
| AC-2 **(SB)** | US-1 | Given many session identities archived under the post-split store, **app-database storage for those identities does not grow in proportion to full chain-body size** (body bytes accumulate off the OLTP volume). | test |
| AC-3 **(SB)** | US-2 | Loading session identity `(T, D)` when the body object is present returns the book body with **mandatory as-of provenance** and **zero live Massive calls**. | test |
| AC-4 **(SB)** | US-4 | Listing session-archive identities for a symbol completes with **zero live Massive calls** and does **not** require retrieving every chain body to produce the list. | test |
| AC-5 **(SB)** | US-3 | Requesting `(T, D)` when no session identity exists reports **`no session book`** and performs **zero Massive calls** (no silent vendor create). | test |
| AC-6 **(SB)** | US-3 | When a session identity for `(T, D)` exists but the body object is **missing**, research load reports **`session book unreadable`** (distinct from `no session book`) and performs **zero Massive calls**. | test |
| AC-7 **(SB)** | US-3 | When a session identity exists but the body object is **corrupt / unreadable**, research load reports the **unreadable** class (not a successful book, not `no session book`, not “not storing”) and performs **zero Massive calls**. | test |
| AC-8 **(SB)** | US-3 | When the object / volume store is **disabled / not configured / unavailable**, the trader desk remains available; archival does **not** report a false stored success; the operator can observe honest **`session archive not storing`** (or store-error) distinct from `no session book` and from unreadable. | test |
| AC-9 **(SB)** | US-3 | A **partial write** (index/pointer claims stored while body put did not complete, or equivalent orphan) does **not** produce a successful research load of a fabricated book; outcome is unreadable/store-error with **zero Massive calls**. | test |
| AC-10 **(SB)** | US-3 | A research miss or unreadable object for `(T, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing/unreadable stays missing/unreadable). | test |
| AC-11 **(SB)** | US-3 | Empty / pruned intraday-ring miss for T remains **observably distinct** from `no session book` and from `session book unreadable` (shipped ring wording preserved; not collapsed). | test |
| AC-12 **(SB)** | US-1 / US-2 | Cutover leaves previously claim-kept session books **loadable under the same research contract** (moved bodies or equivalent), or any identity that cannot be loaded is reported via the honest unreadable/miss classes — never a quiet Massive backfill. | test |
| AC-13 **(SB)** | US-5 | Object-store / volume I/O for archive or research load does **not** sit on the trader request path in a way that makes store stall fail or delay the trader response. | test |
| AC-14 **(SB)** | US-5 | If object-store write or read fails, trader-facing scan/serve/SSE still **succeeds**. | test |
| AC-15 **(SB)** | US-6 | No trader UI route, nav item, or trader-facing screen exposes object-store browse, session-archive download, or historical-chain replay. | review |
| AC-16 **(SB)** | US-6 | No trader-facing product path redistributes session-archive / object-stored books as a market-data feed to end traders (research/operator surfaces stay off the trader origin the same way existing research capture does). | test |
| AC-17 **(SB)** | US-7 | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with the object/volume store on vs off and with store I/O succeeding vs failing; bodies/pointers are not scoring inputs. | test |
| AC-18 **(SB)** | US-1 | Stored session material (bodies and index/metadata) contains **no API keys or other secrets**. | test |
| AC-19 **(SB)** | US-8 | This ship does **not** raise the existing 48-per-symbol cap or stretch 14-day ring retention as a substitute for moving bodies off the app OLTP volume. | review |
| AC-20 **(SB)** | US-8 | This ship does **not** include purchasing Massive hist-chain / PIT history. | review |
| AC-21 | US-8 | This ship does **not** start AI-rec lab P4, declare the session-corpus wait complete, or absorb join-smoke / weekly-digest chore execution. | review |
| AC-22 **(SB)** | US-8 | Architect (or decisions record) **explicitly names** whether 48-ring bodies also leave the app OLTP volume this ship; if deferred, the residual “ring still fills OLTP” risk is stated rather than silently dropped. | review |
| AC-23 | US-6 | Operator verification (list / load / miss / unreadable / not-storing) is available **without** using the trader UI. | review |
| AC-24 **(SB)** | US-7 | Every research run / load path that surfaces session books states or preserves the standing rule that this archive **authorizes nothing** on the live score (measurement / research corpus only). | review |
| AC-25 | US-2 | Path-B / corpus tools that must open the session archive continue to load books from the **same** post-split store without requiring a separate second corpus invent for this ship. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent money/correctness/retention failures:** bodies off OLTP (AC-1/2),
  successful zero-vendor load with provenance (AC-3), metadata-only list (AC-4), distinct absence /
  unreadable / not-storing / partial-write classes with **never-Massive** (AC-5–11), cutover honesty
  (AC-12), desk isolation (AC-13/14), no trader redistribution (AC-16), score byte-identity (AC-17),
  no secrets (AC-18). These can die under a “helpful” refetch or a BYTEA left behind while demos
  still look green.
- **`review` owns** absence of trader UI (AC-15), not raising 48 / not buying hist-chain (AC-19/20),
  program non-absorption (AC-21), explicit ring-body decision (AC-22), operator-without-trader-UI
  (AC-23), “authorizes: nothing” framing (AC-24), and Path-B same-store continuity at product level
  (AC-25). Visible/intentional scope checks.
- Prefer **one** high-level integration pass: archive `(T, D)` → assert body off OLTP + identity
  listable → load with provenance + vendor-call counter 0 → delete/omit object → unreadable +
  counter 0 → disable store → not-storing + desk still OK → force store stall and confirm trader
  path unaffected — over per-AC micro-harnesses.
- No DOM harness is required for ship; observability is operator list/load, storage-locus checks,
  desk behavior, and vendor-call counters.

**Ship-blocking set:** AC-1–AC-20, AC-22, AC-24 (AC-16/17 included). AC-21, AC-23, AC-25 are
required honesty / scope checks (`review`).

---

### 6. Product decisions locked in this position

1. **This is a storage-locus fix for research corpus retention, not a trader feature** — no trader
   UI this round.
2. **Session-archive bodies must leave the app OLTP volume** — that is the BRIEF failure mode.
3. **Research load/list remain zero-Massive**; missing/unreadable never refill from vendor.
4. **Absence classes stay split**, including the new dominant failure “identity without object.”
5. **Mandatory as-of provenance survives the move** on every successful load.
6. **Object I/O yields to the desk** under failure; never on the trader request path.
7. **Score / tier / fingerprint stay byte-identical**; **Authorizes: nothing**.
8. **Do not raise the 48 cap** or buy hist-chain instead of moving bodies.
9. **Ring-body migration is a named decision** this council — preferred In if it shares the OLTP
   retention failure; explicit deferral only with residual risk stated.
10. **Do not absorb** AI lab, corpus-wait completion, or chore rituals into this BRIEF.

---

## Risks I see

1. **Leaving BYTEA/body on OLTP while adding a pointer theater** — “object store” exists but bodies
   still fill Postgres. AC-1/2 exist to make that a failed check.
2. **Helpful Massive refill on missing object** — the most expensive honesty failure; “we had a
   pointer, fetch it again.” AC-5–7/9/10.
3. **Collapsed absence** — treating missing object as `no session book` so operators cannot tell
   orphaned pointers from never-archived days (`absent-is-not-none`). AC-6 vs AC-5.
4. **Object I/O on the trader path** — archive put/get inside request latency; desk stalls when
   storage hiccups. AC-13/14.
5. **Silent ring deferral** — session bodies move, ring bodies still dominate disk, and the BRIEF
   “weeks can accumulate” claim stays false. AC-22.
6. **Cutover amnesia** — new writes go to object store while old session books become unloadable
   without an honest unreadable signal. AC-12.
7. **Program absorption** — smuggling hist-chain, 48-cap raise, or AI lab into “make storage
   useful.” AC-19–21.
8. **Trader redistribution creep** — historical-chain trader endpoint for “convenience.” AC-15/16.
9. **Score drift via “just hydrate from store.”** AC-17 + Authorizes: nothing.
10. **Secrets in bodies or index.** AC-18.
11. **List that secretly loads every body** — works at three symbols, dies at weeks of corpus.
    AC-4.
12. **Path-B left pointing at the old blob locus** — research tools open a store that no longer
    holds bodies. AC-25 (and R2 if architect cannot keep one store).

---

## Assumptions I'm making about the other two lanes

**About the technical shape (architect):**

- A production **object-storage or dedicated-volume adapter** can be named for session-archive
  bodies (alongside any local/dev path already implied by the existing archive enum), configured
  at runtime without baking secrets into the image.
- The app database (or thin index) can retain **identity + mandatory as-of provenance + list
  metadata** without retaining full chain bodies on the OLTP volume after cutover.
- Architect will **explicitly name** whether **48-ring bodies** also move this ship; if not, the
  residual OLTP growth risk is recorded rather than implied away.
- Research **list** can be served from metadata alone (no bulk body fetch), and research **load**
  can return body + provenance with a hard **vendor-call counter = 0**, including on miss and
  unreadable.
- **Missing object vs missing identity** can be distinguished end-to-end as unreadable vs
  `no session book` without collapsing classes.
- Partial-write / orphan-pointer cases can be made to fail closed into unreadable/store-error
  rather than false success.
- Object I/O can stay **off the trader request await path**; archive/store failures can be
  swallowed at the desk boundary so scan/serve/SSE still succeed.
- Existing Path-B / corpus consumers can continue against the **same** logical session-archive
  store after the body locus moves, without a second parallel corpus for this ship.
- Citations for live archive/ring stores will use **current Rust** surfaces — not Python-era
  assumptions (`cited-code-is-verified-not-assumed`).

**About the presentation (ux):**

- There is **no trader UI to design**; UX will not invent an object-store browser, session-history
  trader surface, or Settings control to “make storage visible.”
- If UX speaks at all, it confirms **absence**: no nav entry, no ticker chrome, no trader-facing
  download of research books.
- Operator-facing clarity may lightly touch research wording so `no session book`,
  `session book unreadable`, and `session archive not storing` stay distinguishable when object
  miss becomes common — but pixel layout, motion, and theme work are out of scope; my ACs bind
  operator list/load/desk observables, not screens.
- UX will not reframe this as a trader “historical chain” product story this round — license and
  operator separation forbid that.
- Dark/light / motion inventory constraints are irrelevant to ship criteria here because no new
  trader surface ships; I am not assuming new UI components.
