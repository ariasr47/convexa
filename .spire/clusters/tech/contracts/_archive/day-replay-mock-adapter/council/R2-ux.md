```json
{
  "role": "ux",
  "agree": [
    "A second in-process hub that the ticker page must also subscribe is a second live UI path — reject.",
    "Fixture, batch-backtest, and the capacity harness are **not** this replay.",
    "A hidden research-only clock that never reaches the ticker **fails the harvest** (we already have score replay and a frozen snapshot).",
    "Replay is an **operator-explicit process arm at start**.",
    "Never `live`, never live-paid session book, never a live vendor feed.",
    "End-of-tape is not “Massive dropped”.",
    "While armed, ticker standing is a captured research day and is **not** live and **not** live Massive.",
    "Closed set **{1×, 4×, 10×}**, chosen **at arming**, not a free slider, not changeable mid-walk.",
    "Empty tape is a quiet walk.",
    "No ticker player chrome (play / pause / scrub / skip / reverse / in-page date picker) and no new trader nav / Settings replay control is added."
  ],
  "conflicts": [
    {
      "quote": "Architect does not add a wire field; PM/UX must not treat recency-true as Massive-live.",
      "source": "architect",
      "why": "That sentence makes replay indistinguishable from live on the surface the desk already uses. Replay ticks **will** satisfy recency (`tick_age < 30s` wall). The ticker SSE envelope already sets `live` from that bit. The shipped client is `isLive = (live?.live ?? false) && !streamOffline`, and that boolean — not occupancy the page cannot read — gates `● live · ${session}`, `Streaming live ${feed} ticks.`, title `Live tape`, `Gamma flip (live)`, `liveDotPulse` / `widgetLivePulse`, and `evaluateOrder` fills. Process occupancy is not a field the UI consumes. Honest consume without a closed stream-basis on LiveUpdate is copy theater; recency-true is the paid-live classifier in chrome today.",
      "proposal": "Keep StreamEvent stamp-only if needed. The existing ticker SSE envelope must carry a closed stream basis the client branches on before `live` / `feed` interpolation; replayed updates keep `live: false`. Named consume facts (not a new socket): basis = session tape; `et_date`; vouched tape time ET (do not relabel wall `ts` / `Date.now()` as tape time); phase `playing` | `ended`. Display-active may move headline/tiles/flash; `isLive` stays false so fills, live pulse, and live-session chip meaning stay off. Poison: a fixture with `live: true` and session-tape basis that still paints live chrome.",
      "kind": "technical"
    },
    {
      "quote": "Recency (`last_tick_wall`) stays wall clock so end-of-tape still degrades in 30s of operator time.",
      "source": "architect",
      "why": "Stop-publish plus wall recency is the live-offline path, not an ended standing. The ticker watchdog is 15s of no payload (`STREAM_OFFLINE_MS`) → `⚠ Live offline — reconnecting…` / `OFFLINE_CHIP_TOOLTIP` (Massive reconnect). That fires before 30s recency and is a live-vendor claim the tape cannot carry. `live: false` without a vouched ended phase still falls through `liveStatus` to `○ overnight — no live data`, `○ market closed`, or `○ no live ticks` / “feed may be lagging.” Injecting tape-cursor `market_session` does not fix the chip if it still uses `liveStatus`.",
      "proposal": "Emit a vouched `ended` phase on the same ticker contract and do not let heartbeat silence be the ended classifier. S1 copy stays `○ session tape ended · {SYM} · {humanSessionDate}`; last tape numbers kept; structure stays snapshot; never live-offline, never overnight-no-live-data. SSE drop during replay is a distinct `⚠ Session tape stream dropped`. Replay-fault is a third standing if the envelope names it; otherwise it must not reuse live-offline.",
      "kind": "technical"
    },
    {
      "quote": "Start on Path-A zero shows `no path-a ticks for {SYMBOL} on {ET_DATE}` and refuses the walk.",
      "source": "ux",
      "why": "I cannot defend refuse-as-walk. No identity ≠ empty Path-A (`absent-is-not-none`). Architect starts EmptyWhileStoring with zero Path-A emits; PM locked a quiet walk. Refusing start renames a kept quiet day as missing. Fabrication is inventing ticks, not a clock that emits nothing. The `no path-a ticks…` line stays as empty standing, not a start-refuse.",
      "proposal": "No-identity / unreadable / not-storing still refuse; ticker stays S0. Stored identity with Path-A count 0: clock may start; operator/CLI shows `no path-a ticks for {SYMBOL} on {ET_DATE}`; S1 may show session-tape chrome with `Last trade — no tape print at this tape time` and no fabricated prints. Path-B empty with Path-A present still warns `no path-b snapshots…` and may walk Path-A. Retract AC-U11 refuse; keep the literal.",
      "kind": "product"
    },
    {
      "quote": "`/_ops/replay` is a **second unlinked operator route**, same chrome family as metrics (own AppBar, off `AppShell`, not in TopNav).",
      "source": "ux",
      "why": "PM locked process-start arming, no runtime flip, no ticker play button, no second route, no `/_ops` walker. A Start page is operator chrome the BRIEF does not require. I already allowed S2 visual to drop under CLI-only. Keeping `/_ops/replay` as required is re-scope. Ticker honesty (S0/S1) does not depend on that route.",
      "proposal": "No `/_ops/replay` this slice. Arming copy on the process/CLI twin (`session-day-replay` stdout + standing block; capture miss literals). No trader nav, no Settings toggle, no play/pause/scrub. S0 byte-identical when unset; S1 session-tape chip/widget/last-trade/fills split remains ship-blocking.",
      "kind": "product"
    },
    {
      "quote": "Exact English is UX; the closed standing class in AC-13/19/42 stays `test`.",
      "source": "pm",
      "why": "Standing class as `test` is right. Parking visible not-live wording as review-only (AC-14) leaves the live interpolations unguarded. `Streaming live ${feed} ticks.`, `● live ·`, `Live tape`, `Gamma flip (live)`, pulse, and fills follow `live.live` without a copy edit. That silently regresses; risk-based-verify is `test`, not exact-English review.",
      "proposal": "AC-14 / AC-U28 stay `review` for approved standing prose (session tape, research playback, glossary). AC-U3, AC-U4, AC-U6, AC-U7, AC-U9, AC-U27 stay `test`: banned tokens `live` / `LIVE` / `live_massive` / `this quote is live` on S1; no `Live tape` / `Gamma flip (live)` / `● live`; end-of-tape ≠ live-offline; `isLive` false; poison `live: true` + session-tape basis. Do not move those rows to review in SPEC §3.",
      "kind": "technical"
    },
    {
      "quote": "Path-A gap chip is `session tape gap · …` and does not use the live “feed may be lagging” tip.",
      "source": "ux",
      "why": "PathAGap has no `ts_ns` and is skip-emit. A ticker `session tape gap` chip with no vouched gap/phase on LiveUpdate is a label the consume path cannot support (defining failure). Inter-arrival waits are the clock, not a gap standing. Long silence still must not become live-offline (ended/drop conflict above).",
      "proposal": "Drop S1 `session tape gap` as a required chip phase unless a vouched gap lands on the envelope. Keep the negative: do not use live lag / reconnect copy for a recorded Path-A gap. Occupancy/CLI may still record PathAGap. Retract AC-U8 as a ticker-chip `test` of that string; keep “no live lag tip” inside AC-U3/U7 if a gap phase appears later.",
      "kind": "technical"
    },
    {
      "quote": "Standing includes **partial captured day**, never a full open-to-close claim.",
      "source": "pm",
      "why": "The negative is binding. The positive (“partial captured day” on the existing ticker) asserts completeness the LiveUpdate does not carry. No completeness field, no `{k} snapshots` health score, no “78% of Tuesday.” Printing partial on S1 is the same failure mode as printing complete.",
      "proposal": "Walk what was kept (PM AC-26). Ticker never claims full open-to-close and never prints partial/completeness %. Chip is `session tape · {SYM} · {humanSessionDate} · tape {time} ET` plus locked `{n}×` if armed. Operator/CLI may reuse capture occupancy. Ban “complete open-to-close” in S1/S2 copy.",
      "kind": "technical"
    }
  ],
  "asks": [
    "Architect: on the existing ticker SSE envelope the dashboard already consumes (LiveUpdate / LiveUpdateBody), will replay set `live: false` and add a closed stream basis plus vouched `et_date`, tape-time ET, and phase `playing`|`ended` the client can branch on before `feed` interpolation — yes or no?",
    "Architect: what vouched ended (and replay-fault, if distinct) signal prevents the 15s payload-gap watchdog from classifying end-of-tape as `⚠ Live offline — reconnecting…`?",
    "PM: at default 1×, should the S1 chip print ` · 1×` or omit speed until 4×/10× is armed?"
  ]
}
```
