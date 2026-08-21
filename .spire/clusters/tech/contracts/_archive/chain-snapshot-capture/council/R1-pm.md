# R1 — pm position: chain-snapshot-capture

## Position

### 0. The product problem in one sentence

We already pay Massive ~$199 Stocks + ~$199 Options per month, fetch a full options chain (and the
stock bars that ride with it) for scan / serve work, then **throw the paid raw book away** after one
cycle — leaving only a digested structure diary and a latest-wins cache. Without a durable,
dated, research-only capture of that already-fetched book, we cannot later judge whether score /
structure / AI rec was any good on the **exact book we paid for**, and the P3 batch replay path stays
blocked. This feature exists so a second cycle does **not** erase the first, and so research can
reload a stored book with **no live Massive call**.

---

### 1. What ships

A **research/operator capture spine** for paid vendor books we already fetch:

1. **Append-dated raw snapshots** of the options chain and accompanying stock bars already pulled
   in a successful scan or serve cycle — not a second vendor purchase, not a digested-score row
   alone, and not an overwrite of the existing latest-wins per-symbol cache.
2. **Research load without a live Massive call** — an operator can select a stored dated snapshot
   and use it for later compute / replay prep with zero vendor round-trip for that load.
3. **Bounded retention** — storage does not grow forever; within the retention window, history is
   append-shaped (cycle N+1 does not destroy cycle N).
4. **Desk isolation** — capture is best-effort and off the trader request latency path; a capture
   write failure never fails bundle / scan / SSE for the trader.
5. **License & path honesty** — stored snapshots are **our research**, never redistributed on a
   trader route; no capture/read surface appears on the trader UI.

Score / tier / fingerprint stay byte-identical. No new Massive product. No trader chrome.

---

### 2. Scope

#### In

1. **Persist what we already paid to fetch** — after a successful cycle that already obtained the
   vendor options book (and the stock bars pulled with it), append a **dated** raw snapshot for
   that ticker/cycle so it remains available for research.
2. **Append identity** — a second successful cycle for the same ticker produces an additional
   dated snapshot; it does **not** erase or replace the prior dated snapshot inside the retention
   window. The existing latest-wins digested/cache behavior may continue for its own purpose; this
   feature does **not** overload that as history.
3. **Research/operator read of stored snapshots** — list / count / load by ticker + date (or
   equivalent operator-visible identity) with **no live Massive call** on the load path.
4. **Capture triggers on existing paid paths only** — write-through / side-store off the existing
   scanner sweep and/or serve cycles that already fetched; **no new vendor fetches** invented for
   capture itself. Multi-ticker capture stays on the existing bounded sweep worker; the trader
   request path remains single-ticker-on-demand.
5. **Bounded retention** — architect names the retention bound; product requires that retention is
   finite and that pruning is an explicit age/bound policy, not "keep only latest symbol."
6. **Best-effort isolation from the desk** — capture write errors, storage-full, and retention
   failures never turn into trader-facing bundle / scan / SSE failures.
7. **Score neutrality** — stored blobs are never a scoring input; opportunity score / tier /
   fingerprint remain byte-identical with capture on or off / succeeding or failing.
8. **Secret hygiene** — stored snapshot material contains **no** API keys or other secrets.
9. **Operator observability of capture health** — an operator can tell whether snapshots are
   accumulating (counts / presence after a known successful cycle) without opening the trader UI.
10. **Honest empty / missing / failure outcomes** for research reads (see degraded ACs) — never
    fabricate a chain, never silently hit Massive to "fill in."

#### Out

1. **Buying a new Massive product** (point-in-time historical options chains, historical IV,
   indices such as VIX/SPX, Benzinga earnings, etc.). Paying more on Stocks/Options does not buy
   those; they are different product lines.
2. **Inventing historical-chain vendor endpoints** or pretending live snapshot capture is vendor
   history.
3. **Any trader UI surface** for capture, browse, replay, or "historical chain" — unlinked,
   operator/research only (`operator-vs-trader-path-separation`).
4. **Redistributing stored snapshots on a trader route** (Massive license: research use, not a
   trader data product).
5. **P3 batch backtest CLI / multi-symbol replay reports** — blocked-on this feature; named Future,
   not absorbed here.
6. **Changing score / tier / gate / fingerprint math** — capture is additive storage only.
7. **Replacing or deleting the existing digested structure diary / latest-wins cache** — those stay;
   this feature adds the missing raw-book history beside them.
8. **UI layout, microcopy polish, or new dashboard pages** — there is no trader presentation to
   design; operator CLI / ops checks are enough for observability this round.
9. **Deep cold-archive / object-store vendor migration projects** beyond whatever storage shape the
   architect names to meet append + retention + no-vendor-on-read — product binds outcomes, not
   the store brand.

#### Future-dated (named so they are not absorbed)

- **P3 batch backtest CLI** — replay from captured books; multi-symbol; artifact reports
  (explicitly blocked-on this capture).
- Point-in-time vendor historical chains **if** the owner later buys that Massive product line
  (separate decision; not unlocked by this feature).
- Longer / tiered cold retention and research warehouse exports.
- Joining raw captured books to outcome labels / score-lab beyond today's digested P0 spine.
- Optional operator dashboard for capture health (only if desk metrics patterns are reused under
  the same operator-vs-trader separation — not required to ship this feature).

---

### 3. Product behavior

**Actors:** research operator / owner. **Not** the signed-in trader on Landing / Ticker /
Positions / Scanner.

**Happy path (observable without reading source):**

| Situation | What must be true |
|---|---|
| **Successful scan cycle** that already fetched a paid options book for ticker T | After the cycle completes successfully, a **new dated snapshot** for T is present in the research store (count for T increases by one, or an operator list shows a new dated entry). |
| **Successful serve cycle** that already fetched a paid options book for ticker T (when capture is wired on that path) | Same append outcome as scan — dated snapshot exists; serve response to the trader is unchanged in success/failure semantics. |
| **Second successful cycle** for the same ticker | The first dated snapshot **still exists**; the second is an additional entry. "Latest wins" must not describe this store. |
| **Research load of a stored snapshot** | Operator can load that dated book and proceed with research/replay prep **without any live Massive call** for the load. |
| **Within retention window** | All appended snapshots for a ticker that have not aged out remain listable/loadable. |
| **Past retention bound** | Snapshots older than the named bound are gone; this is expected pruning, not silent corruption of newer rows. |
| **Trader desk during/after capture** | Bundle / scan / SSE behavior the trader already relies on continues; capture is invisible on trader routes. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path):**

| Situation | Observable outcome |
|---|---|
| **Capture write fails** (storage error, serialization failure, etc.) after a successful vendor fetch | Trader-facing scan/serve/SSE **still succeeds**; no trader error caused by capture. Operator can detect that a snapshot was **not** added (count unchanged / missing dated entry). |
| **Storage unavailable / not configured** | Capture does not pretend to persist; desk remains up. Operator-visible signal that capture did not store (not a silent "success"). |
| **Empty research store** (fresh install / nothing captured yet) | List/count shows **empty** honestly — not "no options on this ticker," not a fabricated book. |
| **Requested ticker has no stored snapshots** | Research read reports **none for this ticker** — and does **not** call Massive to invent one. |
| **Requested date / identity not found** (unknown as-of, pruned, never captured) | Research read reports **not found / missing** for that identity — no vendor fill-in, no substitute of "latest" without saying so. |
| **Original cycle never got a vendor book** (vendor failure / empty fetch upstream) | **No raw snapshot is invented** for that cycle; capture does not fabricate chain rows to keep counts pretty. |
| **Operator read path** | Loading or listing stored snapshots performs **no vendor fetch** (including "just to refresh"). |
| **Trader routes** | No capture browse, no historical-chain product, no redistribution of stored blobs to the trader UI or trader APIs. |
| **Score path** | With capture enabled or disabled, succeeding or failing, score / tier / fingerprint for the same market inputs stay identical. |

**Closed product rules (binding):**

1. **Persist-what-we-already-fetch** — capture never justifies an extra Massive purchase or a new
   Massive SKU.
2. **Append inside retention; prune by age/bound** — never "one row per symbol forever."
3. **Research-only** — stored books are for measuring our compute later, not a trader feature.
4. **Desk-first** — when capture and desk disagree under failure, the desk wins (capture yields).
5. **Absent ≠ empty book** — "we have no stored snapshot" must not be presented as "the chain had
   no contracts."

---

### 4. User stories

- **US-1** — As the research operator, I want each successful paid fetch cycle to **leave behind a
  dated raw options book (+ accompanying stock bars)** for that ticker, **so that** the $199+$199/mo
  spend is not thrown away after one request.
- **US-2** — As the research operator, I want a **second cycle to keep the first snapshot**, **so
  that** I can compare or replay across time instead of only seeing latest-wins.
- **US-3** — As the research operator, I want to **load a stored dated snapshot with no live
  Massive call**, **so that** later compute / replay prep does not re-bill or depend on vendor
  availability.
- **US-4** — As the research operator, I want **honest empty / missing / write-failure** outcomes,
  **so that** I never mistake "nothing stored" for "empty chain" or trigger a silent vendor fetch.
- **US-5** — As the desk owner, I want capture failures to be **best-effort and isolated**, **so
  that** traders still get bundle / scan / SSE when research storage misbehaves.
- **US-6** — As the desk owner, I want capture to stay **off the trader UI and off trader
  redistribution**, **so that** we honor Massive license intent and
  `operator-vs-trader-path-separation`.
- **US-7** — As the desk owner, I want stored snapshots to be **non-inputs to scoring**, **so that**
  enabling capture cannot drift score / tier / fingerprint.
- **US-8** — As the research operator, I want **bounded retention**, **so that** history is useful
  without unbounded disk growth — without turning the store back into latest-wins.
- **US-9** — As the owner, I want this feature to **unblock P3 later without absorbing P3 now**,
  **so that** we keep the paid book first and build batch replay only once something durable
  exists.

---

### 5. Acceptance criteria

Every row is one observable outcome a stranger can check without reading source (CLI output,
stored-entry counts, presence/absence of dated entries, desk still serving, no trader surface).
**(SB)** = ship-blocking. `Verify by` is risk-based: `test` where silent regression under an
unrelated change is plausible; `review` where the behavior is visible/intentional. Never
one-test-per-AC theater.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | After one successful scan cycle that already fetched a paid options book for ticker T, the research store shows a **new dated snapshot** for T (operator list/count for T increases by one versus the pre-cycle baseline). | test |
| AC-2 **(SB)** | US-1 | When capture is also wired on serve, after one successful serve cycle that already fetched a paid options book for ticker T, the research store likewise shows a **new dated snapshot** for T. If serve-path capture is deferred this round, this row is marked **explicitly blocked-on / open** in the gate record — not silently dropped from product intent. | test |
| AC-3 **(SB)** | US-1 | A stored snapshot retained for research includes the **options chain book and the accompanying stock bars** that were already fetched for that cycle — not merely a digested score/levels summary row. | review |
| AC-4 **(SB)** | US-2 | Given an existing dated snapshot for T from cycle 1, after a later successful cycle 2 for T, **both** dated snapshots are still present (count for T is +1 vs post-cycle-1, and cycle 1's identity remains loadable). | test |
| AC-5 **(SB)** | US-2 | The research snapshot store is **not** "one row per symbol overwritten": overwriting or deleting cycle 1 as a side effect of writing cycle 2 inside the retention window fails this criterion. | test |
| AC-6 **(SB)** | US-3 | Loading a stored dated snapshot for research completes with **zero live Massive calls** for that load (vendor call count for the load path stays at 0). | test |
| AC-7 **(SB)** | US-3 | Listing or counting stored snapshots for a ticker completes with **zero live Massive calls**. | test |
| AC-8 **(SB)** | US-4 | On a fresh empty store, operator list/count reports **empty** (zero snapshots) without fabricating a chain and without calling Massive. | test |
| AC-9 **(SB)** | US-4 | Requesting snapshots for a ticker that has none reports **none for this ticker** (distinct from "empty chain book") and does **not** call Massive to create one. | test |
| AC-10 **(SB)** | US-4 | Requesting a specific dated identity that was never captured or has been pruned reports **not found / missing** for that identity and does **not** silently substitute another date's book without labeling the substitution (substitution is Out; missing stays missing). | test |
| AC-11 **(SB)** | US-4 | When the upstream cycle fails to obtain a vendor book, **no raw snapshot row is invented** for that failed cycle. | test |
| AC-12 **(SB)** | US-5 | If the capture write fails after a successful vendor fetch, the trader-facing scan/serve still **succeeds** (desk path not failed by capture), and the research store does **not** gain a new dated snapshot for that cycle. | test |
| AC-13 **(SB)** | US-5 | If research storage is unavailable / not configured, the trader desk remains available; capture does **not** report a false stored success. | test |
| AC-14 **(SB)** | US-5 | Enabling capture does not place capture work on the trader request latency path in a way that makes a capture stall fail or delay the trader response — capture remains side/best-effort relative to the desk. | test |
| AC-15 **(SB)** | US-6 | No trader UI route, nav item, or trader-facing screen exposes capture browse, historical chain replay, or stored-blob download. | review |
| AC-16 **(SB)** | US-6 | No trader-facing product path redistributes stored snapshots as a market-data feed to end traders. | test |
| AC-17 **(SB)** | US-7 | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with capture on vs off and with capture write succeeding vs failing; stored blobs are not scoring inputs. | test |
| AC-18 **(SB)** | US-1 | Capture itself performs **no additional Massive fetches** beyond the fetch the scan/serve cycle already made for its own work. | test |
| AC-19 **(SB)** | US-8 | Retention is **bounded**: snapshots older than the architect-named retention bound are no longer loadable, while newer snapshots inside the bound remain. | test |
| AC-20 **(SB)** | US-8 | Retention pruning removes aged snapshots by the retention policy; it does **not** collapse the store to a single latest row per symbol while younger history is still inside the bound. | test |
| AC-21 **(SB)** | US-1 | Stored snapshot material contains **no API keys or other secrets**. | test |
| AC-22 | US-9 | This ship does **not** include the P3 batch backtest CLI; P3 remains Future / blocked-on durable capture. | review |
| AC-23 | US-6 | Operator verification of capture (counts / list / load) is available **without** using the trader UI. | review |
| AC-24 **(SB)** | US-1 | Multi-ticker capture, if any, runs only via the existing bounded sweep worker path — not as an unbounded on-request market sweep from a trader action. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent money/correctness failures:** append-vs-overwrite (AC-1/4/5),
  serve-path honesty or explicit blocked-on (AC-2), zero-vendor-on-read (AC-6/7), empty/missing/
  no-fabricate (AC-8–11), desk isolation on write failure (AC-12–14), no trader redistribution
  (AC-16), score byte-identity (AC-17), no extra vendor fetch for capture (AC-18), retention
  append-shaped pruning (AC-19/20), no secrets in blobs (AC-21). These can die under a refactor
  while "a file was written somewhere" still looks fine.
- **`review` owns payload-composition intent (AC-3), absence of trader UI (AC-15), P3 not absorbed
  (AC-22), operator-without-trader-UI check (AC-23), and single-ticker-on-demand / sweep-only
  multi-ticker framing (AC-24).** Visible/intentional; brittle UI snapshots buy nothing here
  because there is no trader chrome.
- Prefer **one** integration pass: run two successful cycles → assert count + both identities
  loadable + vendor-call counter stays 0 on load + desk still OK when write is force-failed —
  over per-AC micro-harnesses.
- No DOM harness is required for ship; observability is CLI / store counts / desk behavior.

**Ship-blocking set:** AC-1, AC-2 (or honest blocked-on for serve-path), AC-3–AC-21, AC-24.
AC-22/23 are required honesty checks but are `review`.

---

### 6. Product decisions locked in this position

1. **This is research/operator capture, not a trader feature.** No trader UI unless a later owner
   decision reopens that under GATE Z — and BRIEF currently says no.
2. **Append-dated raw books we already paid for** — options chain + accompanying stock bars —
   beside the existing digested diary / latest-wins cache; do not overload latest-wins as history.
3. **Second cycle must not erase the first** inside the retention window — the defining observable
   of the feature.
4. **Load/list never call Massive**; missing stays missing.
5. **Capture yields to the desk** under failure (`best-effort-isolated-or-null`).
6. **No new Massive SKU** and **no P3 absorption** this round.
7. **Score / tier / fingerprint stay byte-identical**; blobs are non-inputs.
8. **Serve-path capture is in product intent** (BRIEF: scan or serve). If architecture cannot wire
   serve safely off the request path this round, mark AC-2 blocked-on — do not quietly redefine
   success as scan-only without a gate note.
9. **Retention is bounded and age-based**, not latest-wins-in-disguise.
10. **Stored snapshots are not redistributed on trader routes** (license + operator separation).

---

## Risks I see

1. **Latest-wins laundering.** Implementing "history" by writing into the existing one-row-per-symbol
   cache would ship the opposite of the BRIEF. AC-4/5/20 exist to make that a failed check.
2. **Silent vendor calls on research read.** A convenience "refresh if missing" on load would
   re-bill and hide gaps. AC-6/7/9/10.
3. **Capture failing the desk.** Putting capture on the ticker request path, or failing serve when
   storage errors, burns trader trust for a research nicety. AC-12–14.
4. **Scan-only quiet narrow.** BRIEF names scan **or serve**. Dropping serve without an explicit
   blocked-on note would under-capture paid ticker traffic. AC-2.
5. **Fabricated emptiness.** Treating "no stored blob" as "chain had zero contracts," or writing
   empty snapshots when the vendor fetch failed, poisons later research. AC-8/11 + absent≠empty.
6. **Trader redistribution creep.** A helpful "historical chain" trader endpoint would violate
   license intent and operator-vs-trader separation. AC-15/16.
7. **P3 scope absorption.** Batch backtest CLI is the thing people will ask for next; it is
   Future and blocked-on this. AC-22.
8. **Unbounded disk.** Append without retention recreates a different operational failure. AC-19/20.
9. **Score drift via "just one more input."** Any temptation to read blobs into signals breaks
   additive isolation. AC-17.
10. **Secrets in blobs.** Dumping env-bearing debug wrappers into stored JSON. AC-21.
11. **Inventing hist-chain products in prose.** Docs or ACs that imply we bought vendor PIT history
    when we only kept live snapshots — confuses the next GATE I. Out list + AC-18.

---

## Assumptions I'm making about the other two lanes

**About the technical shape (architect):**

- A **side-store with append identity** (ticker + dated cycle identity, not symbol-only PK) can be
  named and built without overloading the existing latest-wins per-symbol cache as history.
- Capture can run as **write-through / async side work** off cycles that **already** fetched the
  vendor book, adding **no extra Massive calls** and not sitting on the trader request latency path.
- **Serve-path capture** can either be wired under that same off-path rule this round, or the
  architect will explicitly mark it blocked-on — not leave product intent ambiguous.
- Multi-ticker capture, if present, stays on the **existing bounded sweep worker**; the request
  path remains one ticker.
- A research **load/list** path can return stored material with a hard guarantee of **zero vendor
  I/O**, including on miss (miss → empty/not-found, never fetch-fill).
- **Bounded retention** can be stated as a concrete bound and enforced so pruning is age/bound
  based rather than latest-wins collapse.
- Capture write failures can be swallowed at the desk boundary so scan/serve/SSE still succeed
  (`best-effort-isolated-or-null`).
- Stored blobs can be kept out of scoring modules so score / tier / fingerprint stay byte-identical
  (`additive-keeps-score-byte-identical`).
- Snapshot serialization can exclude secrets (`no-secrets-in-image` applied to stored research
  material).
- Citations for existing capture spine behavior will use **live Rust** scan/history/cache paths —
  not Python-era scanstore assumptions (`cited-code-is-verified-not-assumed`).

**About the presentation (ux):**

- There is **no trader UI to design** for this feature; UX will not invent a historical-chain
  trader surface to "make capture visible."
- If UX speaks at all, it confirms **absence**: no nav entry, no ticker chrome, no settings toggle
  aimed at traders for this store.
- Operator-facing clarity (CLI help text / ops check wording) may be lightly touched, but pixel
  layout, motion, and theme work are out of scope; my ACs bind CLI/count/desk observables, not
  screens.
- UX will not reframe this as a trader "data history" benefit in customer-facing copy this round —
  license and operator separation forbid that product story.
- Dark/light / motion inventory constraints are irrelevant to ship criteria here because no new
  trader surface ships; I am not assuming new UI components.
