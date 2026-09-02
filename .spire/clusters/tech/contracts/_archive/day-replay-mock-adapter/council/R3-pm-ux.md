# R3 — pm ↔ ux

One exchange. Three technical conflicts only: `4a022887…` (net-flow at 4×/10×), `e40af2a9…`
(Verify-by), `c9ae3bca…` (partial on ticker).

**Not this exchange and not reopened.** Process-start / CLI arm only — no operator start/stop page,
no `/_ops` walker (`f8d325a0…`, `1a021b3a…`, UX self-rev `96e2e86f…`). Empty Path-A walk **starts**;
`no path-a ticks…` is empty standing, not a miss refuse (`7a23ee55…`, `51e6698d…`, UX self-rev
`b211f952…`). Consume-path occupancy, ended vs live-offline, and gap occupancy are architect ↔ ux.

No product card. Pace set `{1×, 4×, 10×}` and “no second flow clock” stay as locked in R1. I am not
narrowing the ticker walk.

## Converged

### `4a022887…` — net-flow must not claim tape minutes at 4×/10×

**Quote contradicted:** “Aggressive buys minus sells over the tape’s last few minutes, from stored Path-A trades.”

**CONVERGED** on the rule I raised. 4× and 10× compress waits between occupants; they do not restamp
the day. A “tape’s last few minutes” claim at those speeds is not the stored session’s last few
minutes. That is a false walk of flow. I locked those speeds so a 16-hour tape can be sat through,
not so copy can lie about the window.

**Binding**

- At **1×**, a last-few-minutes net-flow read may stand. Original cadence is the stored session’s
  time.
- At **4× / 10×**, net-flow **must not claim tape minutes**. The existing number may still render.
  Drop the tape-time window from the tooltip, or say the read is compressed with the clock. UX owns
  the exact substitute English; both options are honest; a minutes window is not.
- **No second flow clock this slice.** I am not adding a tape-time flow accumulator so compressed
  speeds can keep a true “last few minutes of Tuesday” sentence.
- The live-tape “from the live trade tape” gloss stays banned on the armed walk at every speed
  (honesty, not this window).

**AC restated for synthesis (companion to AC-3; do not bury inside AC-3)**

> At 1×, net-flow may be described as a last-few-minutes read of stored Path-A trades. At 4× and
> 10×, visible copy does not claim tape minutes for that number. **Verify by: test** (window claim
> absent at 4×/10× — silent if a tooltip is reused). Exact substitute English **review**.

### `e40af2a9…` — banned live interpolations = `test`; exact standing prose = `review`

**Quote I withdraw the AC-14 half of:** “Exact English is UX; the closed standing class in AC-13/19/42 stays `test`.”

Standing **class** in AC-13 / AC-19 / AC-42 stays **`test`**. I do not withdraw that. What I withdraw
is parking **banned live interpolations** under AC-14 `review` as if they were exact English.

**CONVERGED.** UX is right on risk class (`spire-tech-risk-based-verify`). `Streaming live … ticks.`,
the live-session chip, `Live tape`, `Gamma flip (live)`, live pulse, and live fills can return while
a reviewer still sees a “session tape” chip. That is negative space: a human on a normal copy pass
will miss it. Exact standing prose is visible and intentional.

The gate is **Massive-classifier occupancy**, not a substring hunt. Approved standing that **negates**
live (“not a live vendor feed”, “not live Massive”) is exact English (`review`). It must not fail a
token scan of the word “live”. Banned interpolations and live-session meaning on an armed walk are
`test`.

**Binding Verify-by for synthesis** (fold UX ship-blocking silence rows; do not move them to review):

| Fold | Observable | Verify by | Why |
|---|---|---|---|
| PM AC-13 **(SB)** | While armed, ticker standing is a captured research day — **not** live, **not** live Massive. | test | Standing class. Unchanged. |
| PM AC-19 **(SB)** | After the last occupant, standing is end of captured day, not live-offline / vendor-down. | test | Standing class. Unchanged. |
| PM AC-42 **(SB)** | Missing, empty, unreadable, end-of-tape, replay-fault, ineligible, not-elapsed, not-in-watchlist, unauthorized, and production-unset-still-live are distinguishable without reading source. | test | Class split. Unchanged. |
| PM AC-14 **remainder** **(SB)** | Approved standing prose on the ticker while armed (session tape / research playback / glossary). This row does **not** certify absence of live interpolations. | review | Exact English. Visible on a normal pass. |
| UX AC-U28 | Standing block, chip/tooltip strings, widget title swap, glossary, banned-term table as approved copy. | review | Exact English. Unchanged. |
| UX AC-U3 **(SB)** | While armed (playing / ended / dropped, and gap if that phase appears): visible copy never occupies live-session classifier tokens `live` / `LIVE` / `live_massive` / `this quote is live` as Massive meaning. Approved negations are not this row. | test | Silent interpolation. |
| UX AC-U4 **(SB)** | Armed walk does not render `Streaming live … ticks.`, live-session chip (`● live ·`), `Live tape`, or `Gamma flip (live)`. | test | Named interpolations follow the live classifier without a copy edit. |
| UX AC-U6 **(SB)** | End-of-tape is not live-offline reconnect copy. Last tape values are kept, not blanked. | test | End vs vendor-down. |
| UX AC-U7 **(SB)** | Stream drop **during** the walk is not live-offline copy. Unset arm still uses today’s live-offline copy. | test | Drop vs live-offline. |
| UX AC-U9 **(SB)** | Orders / marks treat the walk as **not live**: no limit fill, no live-cross, no live pulse. Live-session meaning stays off. | test | Fills can green a demo while copy looks honest. |
| UX AC-U27 **(SB)** | A walk that still paints live-session chrome (pulse, live-tape title, fills) fails. Poison: session-tape standing that still occupies live-session meaning. | test | Discriminator poison. Hollow “renders” does not satisfy. |

**Already `test` and not reopened:** AC-1–3, 5–7, 9–12, 15–18, 20–38, 43–45 (clock, refuse splits,
production, score, isolation).

**Already `review` and not reopened:** AC-4 (session time, not wall, as session-now), AC-8 (no second
live path), AC-39–41 (no player chrome / S3 / hist-chain / watchlist expansion).

**GATE Q method.** Prefer **one** hermetic armed-walk pass: banned interpolations absent, live-session
meaning off, end ≠ live-offline, plus the planted clock already named in R1. Not one-test-per-AC.
No new DOM harness. Dashboard tests already in the seam may cover ticker copy; hollow “renders
without throw” does not satisfy AC-U3 / U4 / U9 / U27. Exact standing block / glossary remains a
review pass.

**AC-14 remainder, restated for synthesis**

> Approved standing prose on the ticker while armed names a captured research day / session tape /
> research playback and does not use live-Massive wording. This row does not certify absence of
> live interpolations, live-tape title, live pulse, or live fills. **Verify by: review.**

Original AC-14 as the home for “no live interpolations” is **not** kept. That observable travels
with UX AC-U3 / U4 / U9 / U27 as `test`.

### `c9ae3bca…` — ticker never prints partial / completeness %

**Quote I withdraw the positive half of:** “Standing includes **partial captured day**, never a full open-to-close claim.”

**CONVERGED.** The **negative** stands: never a full open-to-close claim. The **positive** (“partial
captured day” on the existing ticker) asserts completeness the walk does not carry. Printing
partial is the same failure mode as printing complete. No “78% of Tuesday.” Snapshot counts are a
store fact, not a ticker health score.

**Binding**

- Walk **what was kept** (AC-26 clock half). Occupants that exist still emit in stored order. Gaps
  stay gaps. No fabricated fill to look complete.
- Ticker standing **never** claims a full open-to-close session and **never** prints partial or
  completeness percent.
- Operator / CLI may reuse **capture occupancy**. That is store standing, not a ticker completeness
  score.
- Ban “complete open-to-close” on armed ticker copy and on operator/CLI success copy.

I withdraw “partial captured day” from the UX wording list I asked them to own. Distinctions that
remain: captured research day · not live Massive · missing · empty · unreadable · end of captured
day · replay fault · live-offline (unset arm only) · ineligible · not elapsed · not in watchlist ·
unauthorized. Completeness is not a standing class on the ticker.

**AC-26 restated for synthesis**

> A stored day that did not cover a full regular session walks the occupants that were kept. The
> existing ticker does not claim a full open-to-close session and does not print partial or
> completeness percent. **Verify by: test.**

Exact standing English remains UX `review` (AC-14 remainder / AC-U28). The completeness negative is
`test` because a helpful percent or “partial” badge can land while the walk still looks honest.

### Related ask (UX → PM) — 1× on the standing

Omit a speed badge at default **1×**. Print locked **`{n}×` only when 4× or 10× is armed.** A printed
`1×` invites reading original cadence as a live synonym (already banned). Compressed speeds must be
named so the operator can see the clock is not 1×. Not a product card; pace lock already closed.

## Still split

None. Net-flow window copy at 4×/10×, Verify-by for banned interpolations vs standing prose, and
ticker completeness are settled. Nothing here needs a product card.
