# R3 — ux ↔ pm

One exchange. Stay in UX lane. Three technical conflicts (`4a022887…`, `e40af2a9…`,
`c9ae3bca…`) plus the two PM asks (AC-U3 `live` token vs negation; S1 ` · 1×` vs omit).

Not this pair: consume-path occupancy / ended vs live-offline / keep-alive (architect ↔ ux);
empty Path-A walk and `/_ops/replay` (already folded). I do not invent a tape-time flow
accumulator, a completeness field, or a second live path.

## Converged

### `4a022887…` — net-flow tape minutes at 4×/10× (raised by pm against ux)

**Quote I withdraw as speed-agnostic copy:** “Aggressive buys minus sells over the tape’s last few minutes, from stored Path-A trades.”

**CONVERGED.** PM is right. 4× and 10× compress waits; they do not restamp the day. A
“tape’s last few minutes” claim at those speeds is not the stored session’s last few minutes.
That is a false walk of flow — my defining failure mode. I am not asking for a tape-time flow
accumulator this slice.

The tile already interpolates `flow_window_s / 60` into `Net flow (5m)`. Reusing that suffix
at 4×/10×, or inventing `20m` / `50m` from k×5 in the client, is the same lie: no consume
field vouches tape-window minutes. The signed `net_flow` number may still render while
display-active. The lie is the window, not the count.

**Binding copy (S1 net-flow tile only; S0 byte-identical)**

| Arm | Label | ⓘ |
|---|---|---|
| S0 unset | shipped `Net flow (${round(flow_window_s / 60)}m)` | shipped live-tape sentence |
| S1 **1×** | same window interpolation as S0 (`Net flow (5m)` when `flow_window_s` is 300) | `Aggressive buys minus sells over the tape’s last few minutes, from stored Path-A trades. Not a live vendor feed. Positive = buyers lifting the ask; negative = sellers hitting the bid.` |
| S1 **4× / 10×** | `Net flow` — **no** `(Nm)` suffix; do **not** interpolate `flow_window_s` as tape minutes; do **not** print k×5 | `Aggressive buys minus sells from stored Path-A trades. Not a live vendor feed. This number does not name a tape-time window. Positive = buyers lifting the ask; negative = sellers hitting the bid.` |

**SPEC §3 fold**

| Fold | Criterion | Verify by |
|---|---|---|
| **AC-U34 (SB)** | At 4×/10×, S1 Net-flow label/ⓘ do not claim tape minutes: no `Net flow (5m)` (or any `(Nm)`), no “last few minutes”, no invented k×5 tape window. | **test** |
| AC-U28 (add the 1× / 4× ⓘ strings above) | Exact English of the two tooltips. | **review** |

These rules apply when display-active shows `net_flow`. Gating the tile on `isLive` so it
reads `—` is a consume-path defect (architect ↔ ux), not a copy solution.

### `e40af2a9…` — Verify-by test vs review for live interpolations (raised by ux against pm)

**Quote I will not let park interpolations on review:** “Exact English is UX; the closed standing class in AC-13/19/42 stays `test`.”

**CONVERGED on a split, not a move-to-review.** Exact English of approved standing prose **is**
UX and **stays `review`** (AC-14 remainder / AC-U28). Closed standing class in AC-13 / 19 / 42
**stays `test`**. That sentence does **not** move AC-U3, AC-U4, AC-U6, AC-U7, AC-U9, or AC-U27
to `review`.

`Streaming live ${feed} ticks.`, `● live ·`, `Live tape`, `Gamma flip (live)`, pulse, and
fills follow `live.live` without a copy-table edit. A reviewer of standing-block English will
not see them. Silent-regression risk → `test` (`spire-tech-risk-based-verify`). Do not keep
PM AC-14 as the only honesty row.

| Fold | Criterion | Verify by | Why |
|---|---|---|---|
| PM **AC-13 / 19 / 42** | Closed standing class (not live Massive; end ≠ live-offline; classes distinguishable). | **test** | Unchanged. |
| PM **AC-14 remainder** / UX **AC-U28** | Approved standing prose, glossary, standing block, chip/tooltip English. | **review** | Intentional copy. **Does not certify** banned interpolations, `isLive`, pulses, or fills. |
| UX **AC-U3, U4, U6, U7, U9, U27** | Banned live occupancy on S1; end-of-tape ≠ live-offline; drop-during-replay ≠ live-offline; `isLive` false; poison `live: true` + session-tape basis still paints live chrome. | **test** | Code interpolations / gates; silently regress. |

Hollow “renders without throw” does **not** satisfy those `test` marks. Prefer **one** S1
fixture pass (playing / ended / drop / poison `live: true`), not one-test-per-AC. Harness
already in contract (Vitest jsdom + Playwright). No new DOM tier.

### `c9ae3bca…` — “partial captured day” on the ticker (raised by ux against pm)

**Quote I withdraw as S1 standing copy:** “Standing includes **partial captured day**, never a full open-to-close claim.”

**CONVERGED.** The **negative** is binding: never a full open-to-close claim. The **positive**
(“partial captured day” on the existing ticker) asserts completeness `LiveUpdate` does not
carry. No completeness field, no `{k} snapshots` health score, no “78% of Tuesday.” Printing
partial on S1 is the same failure as printing complete.

Walk what was kept (PM AC-26) stands as clock behavior. It does **not** mint a ticker standing
class named `partial captured day`.

- S1 chip stays `session tape · {SYM} · {humanSessionDate} · tape {time} ET` plus ` · {n}×`
  only when k ∈ {4, 10} (see 1× ask below).
- S1 copy **never** prints `partial captured day`, `complete open-to-close`, or a completeness %.
- CLI/startup **may** reuse capture occupancy (store-vouched Path-A / Path-B counts / existing
  capture literals). That is not a ticker health score and is not a new “partial” class.
- Do not invent `partial captured day` as a CLI standing token this slice if capture does not
  already print it.

| Fold | Criterion | Verify by |
|---|---|---|
| PM **AC-26** | Partial stored day walks what was kept (no invented prefix/suffix occupants) and is not claimed as a full open-to-close session. | **test** (clock + claim-negative). Unchanged. |
| UX **AC-U35 (SB)** | S1 never contains `partial captured day`, `complete open-to-close`, or a completeness %. | **test** (negative space). |
| AC-U28 | Exact chip English (no completeness words). | **review** |

### PM ask — AC-U3 token `live` vs “not a live vendor feed”

**The gate is occupancy of live-session standing, not a substring scan of the letters l-i-v-e.**

AC-U3 as written (“never contain `live`”) would fail the approved honesty strings. That
substring rule is **withdrawn**. The ban on occupying S0 live meaning is **not**.

**Banned as classifier / title / badge / interpolation** (AC-U3 / U4 / U9 / U27, **`test`**):
`● live ·`, `` `Streaming live ${feed} ticks.` ``, widget title `Live tape`,
`Gamma flip (live)`, `this quote is live`, `LIVE` as a feed badge, `live_massive` /
`LiveMassive` as provenance, `isLive === true`, `liveDotPulse` / `widgetLivePulse`, fills.

**Allowed as closed negation / definition only** (AC-U28, **`review`**):
`not a live vendor feed` · `not live Massive` · `never live_massive` · `Not live.` ·
`not a live feed` · `This is not a live feed lag, and it is not reconnecting to Massive.` ·
`This is not live Massive reconnecting.` · standing-block `NOT A LIVE VENDOR FEED` ·
glossary `Live is the genuine Massive stream when replay is unset.` / `Not used on this chip while session tape is playing.`

**AC-U3 restated for SPEC §3:** While replay playing / ended / dropped: S1 must not occupy
live-session standing (banned list above). Closed negations may contain the letters l-i-v-e.
**Verify by: test.** A GATE Q oracle that greps `live` and fails those negations is a bad
oracle.

Poison: S1 `● live` excused because a tooltip said “not live.” Poison: a scan that reds
`not a live vendor feed`.

### Chip ` · 1×` vs omit until 4×/10×

**Omit ` · 1×` on the S1 chip.** Print ` · 4×` / ` · 10×` when those are armed.

1× is the default original cadence. Printing `1×` burns the 393px budget and invites the
banned read “1× = live.” Overflow still drops tape-time first, then speed, never the words
`session tape` or the date.

CLI/startup standing **may** name `k = 1` as a process fact. The ticker chip does not.

**AC-U5 restated:** playing chip is `○` + `session tape · {SYM} · {humanSessionDate} · tape {time} ET`;
suffix ` · {n}×` only for armed k ∈ {4, 10}. `pulse` is false. Tone is not success/error
direction green/red. **Verify by: test** (suffix presence at 4×/10× and absence at 1× is
structural, not a copy-taste review).

### CLI-only (PM ask already folded — confirm)

Yes. `/_ops/replay` is out this slice. Miss / ineligible / unreadable / not-storing literals
bind on **CLI/startup**; the ticker stays S0 when the walk never starts. End / drop / fault
bind on **S1 ticker + CLI**. No Start/Stop page, no trader play/pause/scrub, no Settings
toggle. Ticker honesty (S0/S1) still ships.

## Still split

None on this pair. No product card. Consume-path occupancy remains architect ↔ ux.
)
