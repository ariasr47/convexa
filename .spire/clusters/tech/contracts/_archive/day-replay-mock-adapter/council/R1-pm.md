# R1 — pm position: day-replay-mock-adapter

## Position

### Who this is for, and what job it does

The buyer is the **research operator / owner walking a captured day**, not a public trader who
thinks the desk is on Massive. Capture already stores an open-to-close research tape for **SPY,
QQQ, IWM**. Frozen research snapshots already exist. Batch-backtest already replays **scores**.
None of those is this job. After Massive is cancelled, Tuesday is still a file unless someone can
**sit the existing ticker and watch that day unfold as if the clock were running**.

The job: **play one named locked-watchlist day through the same ticker live path the desk already
uses.** Path-A stock-path events (last trades and the quotes/mids already on that path) emit in
stored time order. Path-B structure appears as the clock passes each stored 5-minute mark. The
live scoring formula runs on those replayed inputs. Copy and provenance **never** say the feed is
live Massive. A missing tape is an honest miss, not a fabricated Tuesday. Production without an
explicit replay arm still talks to Massive.

This is a **clock on the existing ticker**. It is not a frozen snapshot, not a second live UI, not
an S3 reconstruct, not hist-chain, and not a score-weight change (`Authorizes: nothing`).

### Locked product rules (this slice)

| Lock | Product rule |
|---|---|
| **Who walks** | The **operator walks the existing ticker**. A hidden research-only clock that never reaches the ticker **fails the harvest** (we already have score replay and a frozen snapshot). No second ticker, no lab player, no `/_ops` walk surface. |
| **Who arms** | Replay is an **operator-explicit process arm at start**. Not a trader Settings toggle, not a ticker play button, not a runtime flip. Anyone who can hit that armed process’s ticker will see the walk — that is why production-profile cannot carry the arm, and why standing must be honest. |
| **Watchlist** | Closed trio **SPY, QQQ, IWM** only. One named symbol per arm. Expanding the list is an owner decision. |
| **Day identity** | Operator names **`(symbol, America/New_York calendar date)`**. Not “latest tape”, not “today”, not a date range, not “whatever is on disk”. Tuesday is walkable only as a named date. |
| **Eligible dates** | **ET weekdays** with a stored tape. Saturday/Sunday are **ineligible**, never an empty Tuesday. Future ET dates are **not elapsed**. Holiday weekdays follow the tape’s rule (eligible if a tape exists; empty if the tape is empty). |
| **Clock** | A real clock: events emit **as time advances**, not as a dump at start and not as a frozen bundle at a single instant. Default pace is **original 1×**. |
| **Multiplier** | Closed set **{1×, 4×, 10×}**, chosen **at arming**, not a free slider, not changeable mid-walk. 1× is default (walk as the session ran). 4× and 10× exist so an operator can finish a 04:00–20:00 ET tape in a sitting (16h → 4h or ~96 min). Not 60× (that is a scan, not a walk). An unnamed multiplier **refuses to start** — it does not silently become 1×. |
| **Order and stamps** | Emit in **stored time order**. Original captured timestamps remain the session time of the walked day. The operator’s wall clock is not presented as “the market is open now.” The multiplier compresses **waits between** occupants; it does not drop, reorder, or restamp the day as today. |
| **Start / stop** | Clock starts at the **earliest stored occupant** for that identity (Path-A event or Path-B mark). It does not invent a 04:00 open. It ends after the **last stored occupant** is emitted. No loop. No reverse. No skip-to-time. No pause/resume this slice (stop the process). |
| **Same live path** | The ticker’s **existing live contract** receives Path-A. The ticker’s **existing structure path** receives Path-B as the clock passes stored 5-minute marks. No second live contract. |
| **Structure is Tuesday’s** | Walked structure is **that day’s stored Path-B only**. A live or cached chain from another moment must not stand in. Price-on-Tuesday against Wednesday’s GEX is not walking Tuesday. |
| **Honesty** | Standing is **captured research day, not live Massive**. Never `live`, never live-paid session book, never a live vendor feed. End-of-tape is not “Massive dropped”. Replay-fault is not live-offline. |
| **Missing tape** | No stored identity → **refuse to start**. Do not invent ticks. Do not substitute a frozen snapshot. Do not fall back to Massive while claiming replay. |
| **Production** | **Unset arm → Massive** on every profile. **Silent Massive-down → tape is forbidden.** **Production-profile + replay arm → startup refuses.** The public desk cannot become a replay CDN from a leftover flag. The operator walks on a **non-production / research serve** with the arm explicit. |
| **Score** | Live formula on replayed inputs. **Authorizes: nothing** on weights, tier, gate, or fingerprint basis. |
| **License** | Replayed ticks stay **our research**. Never redistributed as a live vendor feed. |

### User stories

- **S1** — As the research operator, I want to **arm one named `(symbol, ET date)`** for SPY, QQQ,
  or IWM and **watch that day’s Path-A tape on the existing ticker**, in stored time order, at 1×
  or a locked multiplier, so that after Massive is cancelled I can still walk Tuesday as a day —
  not as a JSON file and not as a batch of scores.
- **S2** — As the research operator, I want **that day’s stored Path-B structure to appear as the
  clock passes each stored 5-minute mark** on the same ticker, so the GEX / IV / OI I am looking
  at is Tuesday’s unfolding structure under the **live** scoring formula, not today’s chain and
  not a frozen open snapshot.
- **S3** — As the research operator, I want the ticker’s standing to say this is a **captured
  research day** — never live, never live Massive — so I cannot brief or trade as if the vendor
  were still on.
- **S4** — As the research operator, I want **missing tape ≠ empty tape ≠ unreadable ≠ ineligible
  weekend ≠ not-elapsed ≠ not-in-watchlist ≠ end-of-tape ≠ replay-fault ≠ production-still-live ≠
  unauthorized**, so I never certify a day we did not keep and never confuse a quiet stored day
  with a clock that failed.
- **S5** — As the desk owner, I want **production without an explicit replay arm to still talk to
  Massive**, and I want **production-profile to refuse the arm at startup**, so a cancelled feed
  or a leftover flag cannot silently turn the hosted desk into Tuesday’s tape.
- **S6** — As the desk owner, I want replay **never to occupy a live paid session book**, never to
  mix Massive ticks with tape ticks on the armed identity, never to 5xx the desk when the clock
  faults, and never to change score weights, so walking a day cannot launder provenance or drift
  the formula (`present-is-live-paid-only`, `best-effort-isolated-or-null`,
  `additive-keeps-score-byte-identical`).
- **S7** — As a reviewer, I want **no second live UI, no S3 ingest, no hist-chain, no ticker
  player chrome, no watchlist expansion**, so this ship cannot absorb the next harvest cluster.

### Scope

#### In

- Operator-explicit **process-start arm** to walk **one** named locked-watchlist identity
  `(SPY|QQQ|IWM, ET weekday date)` that already has a stored tape.
- Existing ticker live path: Path-A events in stored time order; Path-B structure as the clock
  passes stored 5-minute marks (09:30…16:00 ET marks that exist on that tape).
- Clock: start at earliest stored occupant; end after last occupant; default **1×**; closed
  multiplier **{1×, 4×, 10×}** chosen at arming.
- Honest standing on the **existing ticker** while armed: captured research day, not live
  Massive. End-of-tape, missing, empty, unreadable, fault, and production-still-live are distinct.
- Zero vendor I/O for the walked day’s ticks and structure. Tape is the source.
- Live scoring formula on replayed inputs; score / tier / fingerprint **formula** unchanged.
- Isolation: replay fault does not fail the desk’s bundle / scan / other trader paths; live
  derived-from-tape fields degrade on drop or end; last structure is not blanked solely because
  the clock ended.
- Replay cannot write, promote, or occupy a session-archive identity as a live paid book.
- Production: unset arm still Massive; production-profile refuses the arm; no silent fallback.
- Operator tape read remains on the existing research/operator diagnostic family (token-gated,
  trader origin still refused). Arming is not a trader-session action.
- Hermetic GATE Q: planted tape walks in order at 1× and at a locked multiplier; missing/empty/
  unreadable/end/fault/unauthorized/production-unset split; no vendor calls; no live-paid
  insert; score formula identity on the same inputs; production-profile arm refused.

#### Out

- A **hidden research-only clock** that never feeds the existing ticker.
- A **second live UI path**: lab page, ticker player (play / pause / scrub / skip / reverse),
  Settings replay picker, nav item, `/_ops` walker.
- **S3 / next-day flat files** (`massive-flat-file-keep`).
- **Hist-chain** and any new paid vendor product.
- Changing live scoring **weights**, tier cutoffs, entry gate, or fingerprint basis
  (`Authorizes: nothing`).
- Using a **frozen snapshot** as the day (nearest sample at one instant is not a clock).
- Inserting tape, reconstructions, fixtures, or replay output as a **live paid session book**.
- Filling session-archive coverage holes; starting ensure; moving session-archive bodies.
- Auto-switching Massive-down → tape (that fabricates a live-looking desk).
- Mixing Massive ticks with tape ticks on the armed identity.
- Arming more than one identity, or walking a name outside SPY / QQQ / IWM.
- Runtime live↔replay flip; mid-walk multiplier change.
- Redistributing replayed ticks as a live vendor feed on the hosted trader origin.
- Batch-backtest / score-lab / replay-outcome-join changes (those already replay scores, not the
  ticker).
- Watchlist expansion, holiday calendar, named retention, research-lab browser, telemetry SLOs,
  Kubernetes/Kafka.

#### Future-dated

- Pause / resume, skip-to-mark, reverse, free-form speed, or in-ticker date picker.
- Walking more than one locked name at once.
- Watchlist expansion by explicit owner decision.
- S3 flat-file keep (price/quote history, never as live paid).
- Operator lab UI to browse and pick tapes.
- NYSE/exchange-holiday calendar.
- Runtime re-arm without process restart.
- Optional tighter Path-B grain if a later walk needs it.

### Product behavior

**Actors:** operator at a research/non-production serve, watching the **existing ticker** for the
armed symbol. **Not** the hosted production trader. **Not** a second surface.

**Happy path**

| Situation | What must be true |
|---|---|
| Research serve, explicit arm, named `(S, D)` is SPY/QQQ/IWM, ET weekday, stored tape has Path-A occupants | Operator opens the existing ticker for S. Path-A events arrive on the existing live contract **in stored time order**, paced at the locked multiplier (default 1×). Standing is captured research day, **not** live Massive. **Zero vendor calls** for those ticks. |
| Same walk, stored Path-B marks exist | As the clock passes each stored 5-minute mark, that mark’s structure becomes the ticker’s structure. Marks in the future of the clock are not dumped at start. Structure is **that day’s tape**, not a live/cached chain from another moment. |
| 4× or 10× chosen at arming | Waits between occupants compress by that factor. Order is unchanged. Captured timestamps still name Tuesday, not the operator’s now. |
| Last occupant emitted | Clock **stops**. Standing is **end of captured day**. No loop. Live-derived-from-tape fields degrade as ended, not as “Massive dropped”. Last Path-B snapshot may remain as last structure behind that standing. |
| Same replayed inputs through the live formula | Opportunity score, tier, and state fingerprint match the live formula on those inputs. Weights are the live weights. |
| Production serve, replay arm **unset** | Ticker live path still talks to **Massive**. No tape ticks. Standing may be live or honest live-offline — **never** a silent Tuesday. |
| Trader desk on production (arm refused / unset) | Bundle / scan / live stream unchanged by this feature’s existence. No replay chrome. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path)**

| Situation | Observable outcome |
|---|---|
| Named identity has **no stored tape** (no day container) | **Missing tape.** Replay **does not start**. No ticks invented. No frozen-snapshot stand-in. No Massive fallback while claiming replay. Distinct from empty. |
| Stored identity, Path-A record count **0** (quiet day / empty-while-storing) | **Empty tape.** Clock may start and has **nothing to emit** on Path-A. Distinct from missing (we kept a quiet day) and from unreadable. Ends as end-of-tape / empty-walk, not as a fabricated print. |
| Stored identity **cannot be loaded** (missing body, corrupt, unparseable) | **Unreadable.** Replay does not start. Not missing, not empty, not a partial walk of garbage. Zero vendor calls. |
| Path-A has occupants and Path-B is empty / not-capturing / all gaps (or the reverse) | Sides are **independent**. Present Path-A does not invent Path-B structure. Present Path-B does not invent Path-A prints. Missing Path-B is structure-unavailable for those marks, **not** “use the cache”. |
| A Path-A **gap** record is on the tape | The gap is **not filled**. No interpolated ticks. Clock continues. |
| A stored Path-B **mark gap** | That mark stays a gap. No fill fetch. No interpolation from neighboring marks presented as that mark. |
| Tape is **partial** (capture did not cover full RTH) | Walk **what was kept**. Standing includes **partial captured day**, never a full open-to-close claim. |
| ET Saturday or Sunday | **Ineligible.** Replay does not start. Not missing, not empty. |
| Named ET date **strictly after** today ET | **Not elapsed.** Replay does not start. Not missing. |
| Symbol **not** SPY, QQQ, or IWM | **Not in watchlist.** Replay does not start. Not an empty day that implies we tried. |
| Multiplier not in {1×, 4×, 10×}, or omitted into an invalid value | **Refuse to start.** Do not silently run 1× and report success. |
| Production-profile process started **with** the replay arm | **Startup refuses.** It does not serve tape as the desk. It does not serve Massive either until started correctly without the arm. |
| Production-profile or any profile, arm **unset**, Massive down | Honest **live-offline / vendor down** on the live path. **Not** auto-replay of the latest tape. |
| Research serve armed, operator asks a **different** symbol than the armed identity | That other ticker is **not** live Massive and **not** a second tape this slice. Honest not-the-armed-day — no mixed feed. |
| Replay **faults** mid-walk (store read fails, clock fails) | Desk **does not 5xx**. Standing is **replay fault**, distinct from end-of-tape and from live-offline. Live-derived-from-tape fields degrade; static last structure is not blanked **because** of the fault. No fabricated ticks to paper over the fault. |
| Ticker live contract **drops** during a walk | Live-derived-from-tape UI degrades (dim + offline, not blank). Structure/last bundle already shown remains. Distinct from end-of-tape (the clock may still be running). |
| End of tape vs stream drop vs Massive down | Three standings, three outcomes. End-of-tape **is not** live-offline. Replay-fault **is not** end-of-tape. |
| Networked tape read without the operator token when a token is required | **Refused.** No tape body. Arming is not granted by a trader session. |
| Hosted trader origin | **Does not** become a replay feed. Existing trader-origin refusal of research/operator diagnostics remains. Replayed ticks are not redistributed as live vendor data. |
| Replay path is asked to “just fetch Massive” or “just use the frozen snapshot” | **Does not.** Zero vendor I/O on the walk. Frozen snapshot is not the clock. |
| Session-archive coverage for `(S, D)` is missing | **Stays a hole.** Walking the tape does **not** insert a live paid book and does **not** flip coverage to present. |
| Tape-derived occupant offered as a live paid session book | **Never present** as a live paid book. This feature never inserts that occupant into the session archive. |
| Secrets in the environment | Walk output / ticker live contract / operator messages contain **no** secret values. |

**Closed product rules (binding)**

1. **Walk the existing ticker, or do not claim this feature shipped.** A CLI that prints ticks
   and leaves the ticker frozen is out. A frozen snapshot at one instant is out.
2. **Operator-armed, production-profile-refused.** Unset is Massive. Silent fallback is
   forbidden.
3. **One named identity.** Closed trio. Named ET date. One clock.
4. **1× default; {1×, 4×, 10×} only; original timestamps; stored order.**
5. **Path-A and Path-B both walk**, independently honest when one side is empty or gapped.
6. **Structure for the walked ticker is that day’s Path-B**, never a live/cached stand-in.
7. **Honesty is structural:** standing cannot be live Massive while armed; end ≠ drop ≠ fault ≠
   missing ≠ empty (`absent-is-not-none`, `live-vs-static-isolation`).
8. **Tape ≠ live paid book** (`present-is-live-paid-only`).
9. **Desk wins under replay fault** (`best-effort-isolated-or-null`).
10. **Authorizes: nothing** on the live score formula
    (`additive-keeps-score-byte-identical`, `score-change-is-deliberate-and-measured`).
11. **No second live path. No S3. No hist-chain. No player chrome.**
12. **Massive license:** replayed ticks remain our research, never a trader live feed.
13. **Single ticker on the request path.** The walk does not sweep the universe.
14. **Poison what the rule forbids and the gate goes red** (`structural-over-prose-enforcement`):
    missing tape must not emit ticks; production unset must not emit tape; production-profile
    plus arm must not bind as a walker; replay must not insert a live paid book; standing must
    not read live Massive.

### Acceptance criteria

Observable from **the existing ticker’s live contract and structure updates, process start vs
refuse, vendor-call count, coverage class unchanged, score identity on the same inputs, and
operator-visible standing**. No source reading required. `Verify by` is risk-based: `test` where
silent regression is plausible; `review` where the behavior is visible/intentional. Never
one-test-per-AC. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | Given a research serve armed for locked name S on ET weekday D with a stored Path-A tape, the existing ticker live contract for S receives those Path-A events in stored time order. | test |
| **AC-2 (SB)** | S1 | Given two successive stored Path-A events with a positive timestamp gap, at 1× the second event is not emitted before that gap has elapsed (the walk is a clock, not a dump). | test |
| **AC-3 (SB)** | S1 | A 4× arm compresses waits by 4; a 10× arm compresses waits by 10; event order matches the tape in both cases. | test |
| **AC-4 (SB)** | S1 | Captured timestamps remain the walked session time; the operator’s wall clock is not presented as the session being live now. | review |
| **AC-5 (SB)** | S1 | An arm with a multiplier outside {1×, 4×, 10×} refuses to start and does not run 1× as a silent success. | test |
| **AC-6 (SB)** | S1 | The walk starts at the earliest stored occupant for `(S, D)` and does not invent ticks before that occupant. | test |
| **AC-7 (SB)** | S1 | After the last stored occupant is emitted, no further Path-A events arrive; the clock does not loop. | test |
| **AC-8 (SB)** | S1 | The walked ticker uses the existing live contract — no second live path is added. | review |
| **AC-9 (SB)** | S2 | As the clock passes each stored Path-B 5-minute mark, that mark’s structure becomes the ticker’s structure for S; later marks are not applied before the clock reaches them. | test |
| **AC-10 (SB)** | S2 | During an armed walk, the ticker’s structure for S is not a live or cached chain from another moment; it is that day’s stored Path-B (or honest structure-unavailable when Path-B is empty/not-capturing). | test |
| **AC-11 (SB)** | S2 | Path-B persistence/read on the walk performs **zero vendor fetches**. | test |
| **AC-12 (SB)** | S1 | Path-A emission on the walk performs **zero vendor fetches**. | test |
| **AC-13 (SB)** | S3 | While armed, ticker standing is a captured research day and is **not** live and **not** live Massive. | test |
| **AC-14 (SB)** | S3 | No operator- or trader-visible copy on the ticker claims the feed is live Massive during a walk. | review |
| **AC-15 (SB)** | S4 | Given no stored tape for `(S, D)`, replay does not start and **no** Path-A events are emitted for that arm. | test |
| **AC-16 (SB)** | S4 | Missing-tape refuse does not substitute a frozen snapshot and does not fall back to Massive while the arm claims replay. | test |
| **AC-17 (SB)** | S4 | Given a stored empty Path-A tape (identity exists, zero Path-A records), the outcome is empty-tape — not missing, not unreadable — and no fabricated prints are emitted. | test |
| **AC-18 (SB)** | S4 | Given `(S, D)` cannot be loaded, the outcome is unreadable; replay does not start; it is not classified missing and not classified empty. | test |
| **AC-19 (SB)** | S4 | After the last occupant, standing is **end of captured day**, and that standing is not the live-offline / vendor-down standing. | test |
| **AC-20 (SB)** | S4 | A Path-A gap on the tape is not filled with interpolated ticks. | test |
| **AC-21 (SB)** | S4 | A Path-B mark gap stays a gap: no fill fetch, no neighbor mark presented as that mark. | test |
| **AC-22 (SB)** | S4 | Path-A empty and Path-B empty/not-capturing are independently observable; one side does not stand in for the other. | test |
| **AC-23 (SB)** | S4 | An ET Saturday or Sunday arm does not start and is not classified missing-tape or empty-tape. | test |
| **AC-24 (SB)** | S4 | A named ET date strictly after today ET does not start and is not classified missing-tape. | test |
| **AC-25 (SB)** | S4 | A name other than SPY, QQQ, or IWM does not start and is not an empty-walk that implies we tried. | test |
| **AC-26 (SB)** | S4 | A partial stored day walks what was kept and is not claimed as a full open-to-close session. | test |
| **AC-27 (SB)** | S5 | Given production-profile (or any profile) with the replay arm **unset**, the ticker live path talks to Massive and does not emit tape ticks. | test |
| **AC-28 (SB)** | S5 | Given Massive is down and the replay arm is unset, the live path is honest vendor-down / live-offline and does **not** auto-start a tape walk. | test |
| **AC-29 (SB)** | S5 | Given production-profile **with** the replay arm set, the process **refuses to start** as a walker and does not serve tape on the ticker live contract. | test |
| **AC-30 (SB)** | S6 | Walking or loading tape does not insert a session-archive identity and does not classify that identity as a live paid **present** book. | test |
| **AC-31 (SB)** | S6 | Given coverage for `(S, D)` is missing, walking tape for `(S, D)` leaves that coverage cell missing. | test |
| **AC-32 (SB)** | S6 | An armed identity does not mix Massive ticks with tape ticks on its live contract. | test |
| **AC-33 (SB)** | S6 | If the clock or tape read faults mid-walk, the desk’s bundle / scan / unrelated trader paths still succeed (no 5xx caused by the replay fault), and standing is replay-fault — not end-of-tape, not live-offline. | test |
| **AC-34 (SB)** | S6 | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical when those inputs are applied through the live formula via replay vs via the live compute path; this feature does not change weights. | test |
| **AC-35 (SB)** | S6 | Enabling this feature with the arm unset leaves live score / tier / fingerprint byte-identical to pre-feature live behavior on live inputs. | test |
| **AC-36 (SB)** | S6 | A ticker live-contract drop during a walk degrades live-derived-from-tape fields without blanking already-shown structure. | test |
| **AC-37 (SB)** | S7 | When an operator token is required, a tape read without it is refused and returns no tape body. | test |
| **AC-38 (SB)** | S7 | A trader origin cannot obtain the tape body (refused the same way existing operator/research diagnostics are refused on that origin). | test |
| **AC-39 (SB)** | S7 | No ticker player chrome (play / pause / scrub / skip / reverse / in-page date picker) and no new trader nav / Settings replay control is added. | review |
| **AC-40 (SB)** | S7 | This ship does not download or ingest S3 flat files. | review |
| **AC-41 (SB)** | S7 | This ship does not add hist-chain, a second live UI path, or watchlist expansion beyond SPY, QQQ, IWM. | review |
| **AC-42 (SB)** | S4 | Missing, empty, unreadable, end-of-tape, replay-fault, ineligible-weekend, not-elapsed, not-in-watchlist, unauthorized, and production-unset-still-live outcomes are distinguishable without reading source. | test |
| **AC-43 (SB)** | S6 | Canary secret values present in the environment do not appear in walk output or ticker live-contract payloads. | test |
| **AC-44 (SB)** | S1 | Requesting the walk still computes **one** ticker — the armed name — not a universe sweep. | test |
| **AC-45** | S7 | Asking a different symbol than the armed identity on a research-armed process does not start Massive for that other symbol and does not start a second tape walk this slice. | test |

**Method notes (risk-based).**

- **`test` concentrates on silent honesty / desk / money failures:** time-order clock vs dump
  (AC-1/2), multiplier and invalid-multiplier refuse (AC-3/5), no invented prefix (AC-6), no
  loop (AC-7), Path-B as-the-clock-passes and no live-chain stand-in (AC-9/10), zero vendor
  (AC-11/12), standing not live Massive (AC-13), missing/empty/unreadable/end/gap splits
  (AC-15–26, AC-42), production unset still Massive and no auto-fallback (AC-27/28),
  production-profile arm refuse (AC-29), no live-paid insert (AC-30/31), no mixed feed
  (AC-32), fault isolation (AC-33), score formula identity (AC-34/35), drop isolation
  (AC-36), unauthorized (AC-37/38), secrets (AC-43), single-ticker (AC-44), no mixed second
  symbol (AC-45). These can die under a “helpful” Massive fallback, a Fixture dump labeled as
  a walk, a leftover production flag, or a score-weight tweak while demos still look green.
- **`review` owns** session-time-not-wall-clock copy (AC-4), no second live path (AC-8),
  visible not-live Massive wording (AC-14), no player chrome (AC-39), no S3 (AC-40), no
  hist-chain / second UI / watchlist expansion (AC-41). Exact English is UX; the closed
  standing class in AC-13/19/42 stays `test`.
- Prefer **one** hermetic pass: plant `(SPY, D)` Path-A two events + two Path-B marks → arm
  research 1× → events in order with gap honored, marks applied only when reached, vendor
  counter 0, standing not live Massive → 4× compresses the same gap → last event then
  end-of-tape standing ≠ live-offline → missing identity emits nothing → empty identity
  emits nothing and is not missing → unreadable refuses → weekend/future/NVDA refuse →
  unset arm on live profile still vendor, Massive-down does not auto-walk →
  production-profile plus arm refuses start → coverage missing stays missing → same inputs
  score triple identical → write/clock fault does not 5xx the desk — not a named
  micro-harness per row.
- GATE Q must show **both** a rejecting path (missing tape, production unset, production-profile
  arm, unauthorized, live-paid insert poison) **and** an accepting planted walk. A suite that
  only dumps a tape onto a hub has not proved a clock.
- No new DOM harness demanded. Ticker copy rows are `review` unless the standing class is
  already observable on the live contract (AC-13). Dashboard/Playwright may be used if already
  in the seam; do not invent one-test-per-AC e2e theater.
- S3, hist-chain, player chrome, and a hidden non-ticker clock fail this ship even as a
  “small hook.”

**Ship-blocking set:** AC-1–AC-44. AC-45 is a required mixed-feed honesty check (`test`).

### Product decisions locked in this position

1. **Audience = operator walking the existing ticker.** Hidden research-only clock is a failed
   ship. Hosted production trader is not the walker.
2. **Arming = process-start, explicit, research/non-production.** Production-profile refuses the
   arm. Unset is Massive. No runtime toggle. No ticker play button.
3. **Watchlist = SPY, QQQ, IWM.** One named identity per arm.
4. **Day = named America/New_York calendar date.** Not latest, not today-implicit, not a range.
5. **Pace = 1× default, closed {1×, 4×, 10×}.** Original timestamps. Stored order. No slider,
   no mid-walk change, no pause/scrub this slice.
6. **Start = earliest stored occupant. End = after last occupant. No loop.**
7. **Path-A + Path-B both walk.** Structure is that day’s Path-B only. Independent emptiness.
8. **Honesty standing is mandatory on the existing ticker.** UX owns the words; product owns
   the distinctions and the ban on “live Massive.”
9. **Missing tape refuses.** Empty tape is a quiet walk. Unreadable refuses. No frozen-snapshot
   or Massive substitute.
10. **Score formula unchanged.** Replayed inputs may change the **numbers** for that walked
    moment; weights / tier / fingerprint **basis** do not move.
11. **Do not absorb** S3, hist-chain, lab UI, player chrome, watchlist expansion, or
    batch-backtest.

### Binding constraints restated

- **`operator-vs-trader-path-separation`:** tape **read** stays research/operator; trader origin
  still fails closed. Replay **may** feed the existing ticker live contract and **must not**
  pretend that feed is live Massive. This is the brief’s carve-out; I am not silently putting
  the clock on a hidden path to satisfy a stricter reading.
- **`present-is-live-paid-only`:** replayed tape is never a live paid session book.
- **`live-vs-static-isolation`:** live-derived-from-tape degrades on drop / end / fault; last
  structure is not blanked; end-of-tape ≠ live-offline.
- **`best-effort-isolated-or-null`:** replay fault never 5xx the desk.
- **`additive-keeps-score-byte-identical` / `score-change-is-deliberate-and-measured`:**
  Authorizes: nothing on the formula.
- **`production-fails-closed`:** production construct does not silently become replay;
  production-profile plus arm refuses startup.
- **`absent-is-not-none`:** missing ≠ empty ≠ unreadable ≠ end ≠ fault ≠ ineligible ≠
  unauthorized ≠ still-live.
- **`single-ticker-on-demand`:** one armed name on the request path.
- **`no-secrets-in-image`:** no secrets in artifacts or walk output.
- **`cited-code-is-verified-not-assumed`:** this position does not assert reusable source
  locations. Mechanism reuse is an architecture assumption below.
- **`structural-over-prose-enforcement`:** poison missing-tape emit, unset-arm tape emit,
  production-profile walk, live-paid insert, live-Massive standing → gate red; poison tests
  non-vacuous.
- **`local-evidence-is-not-hosted-evidence`:** a local planted walk is not “production walked
  every Tuesday.”
- Massive license: replayed ticks remain our research, never a hosted live vendor feed.

## Risks I see

- **Hidden clock ships instead of the ticker walk.** Then the harvest item’s failure mode is
  intact: Tuesday is saved and still not walkable as a day. AC-1/8.
- **Frozen snapshot labeled replay** (one bundle at one instant, or “Fixture with a moving
  label”). That is not a clock. AC-2/9.
- **Dump-at-start** of the whole tape so a demo looks busy. AC-2/9.
- **Silent Massive-down → tape** so the desk never “goes dark.” That fabricates live. AC-28.
- **Production leftover arm** serves Tuesday to the hosted origin as if it were the vendor.
  License + honesty failure. AC-29/13.
- **Price walk on a live/cached chain** so GEX is not Tuesday’s. AC-10.
- **Missing collapsed into empty** (or the reverse): operator cannot tell “we never kept
  Tuesday” from “Tuesday was quiet.” AC-15/17/42.
- **End-of-tape copy reused from live-offline** — operator thinks Massive dropped and waits.
  AC-19.
- **Helpful interpolation** across Path-A or Path-B gaps. AC-20/21.
- **Score weights “tuned while we’re here.”** Forbidden. AC-34/35.
- **Replay insert counted as a live paid present book** so coverage greens a hole. AC-30/31.
- **Fault 5xx’s the desk** or papers over with live ticks. AC-33/32.
- **Player chrome / lab / S3 / hist-chain absorbed** because they sit next in the harvest.
  AC-39–41.
- **1×-only without a closed multiplier** makes a 16-hour Path-A window unusable; **free-form
  speed** makes it a scan. I will not pre-concede the closed set at R2 without a measured
  bound that 4×/10× cannot pace the existing live contract.
- **Unobservable criteria.** If synthesis rewrites rows into “replay works” intentions that
  require reading source, those rows should be cut or restated — not kept for theater.

## Assumptions I'm making about the other two lanes

- The architecture lane can **emit stored Path-A occupants onto the existing ticker live
  contract** in stored time order, as a clock (gaps honored at 1× and compressed at 4×/10×),
  **without** a second live contract, **without** a second vendor socket, and **without**
  dumping the tape at start (AC-1, AC-2, AC-8). If the only shippable mechanism is a hidden
  non-ticker clock or a frozen snapshot, architecture must contradict S1 at R2 — I will not
  silently drop the ticker walk.
- The architecture lane can **apply stored Path-B marks as the clock reaches them** on the
  existing ticker structure path, with **zero vendor I/O**, and can **keep a live/cached chain
  from standing in** for that day’s structure (AC-9–11). If structure cannot unfold without a
  second UI or a live fetch, that is an R2 conflict — I will not walk price on Wednesday’s GEX.
- The architecture lane can **inject a clock** so 1× gap-honor, 4×/10× compression, end-of-tape,
  and “mark not applied early” are testable without waiting wall-clock hours, and so that clock
  follows **America/New_York session time on the tape**, not the host’s local zone.
- The architecture lane can **refuse production-profile when the replay arm is set**, keep
  **unset = Massive** on every profile, and **forbid Massive-down auto-fallback to tape**
  (AC-27–29). If production-profile cannot be distinguished from research serve, architecture
  must say so at R2 rather than shipping a silent hosted walker; I will not weaken
  `production-fails-closed` to get a demo on Railway.
- The architecture lane can keep **missing / empty / unreadable / ineligible / not-elapsed /
  not-in-watchlist** as distinct start-refuses or empty-walks **without emitting fabricated
  ticks**, and can name an observable **end-of-tape** vs **replay-fault** vs **live-offline**
  standing on the existing live contract (AC-15–19, AC-33, AC-42). If those classes collapse
  at the boundary, that is an R2 conflict with `absent-is-not-none` — I will not accept one
  “failed” bucket.
- The architecture lane can prove **replay cannot occupy a live paid session book**, **cannot
  mix Massive with tape** on the armed identity, and **cannot 5xx the desk** on clock/read
  fault (AC-30–33). If isolation requires dropping the ticker walk, that is an R2 conflict —
  I will not take down the desk to ship the clock.
- The architecture lane can prove **score / tier / fingerprint formula identity** on the same
  inputs (replay vs live compute) and **byte-identical live behavior with the arm unset**
  (AC-34/35), with **zero vendor calls** on the walk, without Massive credentials in the build
  environment.
- The architecture lane will verify **live tape store + existing ticker live contract + frozen
  snapshot is-not-a-clock**, citing live sources — not Python-era paths, not briefing HTML
  (`cited-code-is-verified-not-assumed`). This position does not assume filenames, types, or
  route strings.
- The architecture lane treats **{1×, 4×, 10×}** as the product-closed set. If 10× (or 4×)
  cannot pace the existing live contract without dropping or reordering events, architecture
  must contradict AC-3 at R2 with a measured bound — not a quiet 1×-only ship and not a free
  slider.
- The UX / tech-writer lane will put **honest not-live standing on the existing ticker** and
  will **not** add player chrome, a second route, a Settings picker, or a lab browser this
  slice (AC-14, AC-39). If UX proposes play/pause/scrub/date-picker as the walk surface, that
  contradicts S7 and “no second live path,” and I will raise it as a conflict at R2.
- The UX / tech-writer lane owns exact wording for: captured research day · not live Massive ·
  missing tape · empty tape · unreadable · partial captured day · end of captured day · replay
  fault · live-offline / vendor down (unset arm only) · ineligible · not elapsed · not in
  watchlist · unauthorized. I own only that those distinctions exist, are mutually
  distinguishable as words, that end-of-tape **cannot** reuse live-offline copy, and that
  armed standing **cannot** read as live Massive.
- The UX / tech-writer lane can keep copy from implying a hosted production walk, a
  score-weight authorization, a live vendor feed, or that a session-archive hole was filled.
- The UX / tech-writer lane will not specify layout, motion, or a new ticker placement beyond
  standing on the existing live-derived chrome; I am not locking chip placement, color, or
  type hierarchy.
