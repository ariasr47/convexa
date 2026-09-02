# S2 — skeptic findings: day-replay-mock-adapter

## Critical  (blocks — must loop back to R4)

- None. Pass-1 Criticals were re-checked against the repaired SPEC/INTERFACE and are **actually gone**, not papered (see Checked and clean).

## Important  (should fix)

- **S1 chip empty-column invents a third shape for the same wire state as starting** — Loading / copy define `playing` + `tape_time_et` null as `session tape · starting…`. The S1 chip **empty** column instead says empty Path-A gets a “playing identity chip; omit tape-time until a stamp exists” — a `session tape · {SYM} · {humanSessionDate}` form that is not in the §4 copy table and collides with the starting definition for the same null-cursor playing payload. Implementers cannot tell which string to paint before the first stamp (including empty Path-A before the first Path-B mark). — evidence: SPEC.md §4 Component states “Ticker connection chip (S1 armed)” loading vs empty columns; §4 “S1 chip + tooltips” loading / starting row (`session tape · starting…`) vs playing row (requires `tape {HH:MM:SS}`).

- **`tape_time_et` across a PathAGap pulse is unspecified and can re-enter starting mid-walk** — Gap records have no `ts_ns`. Null-cursor cases are listed only as “first keep-alive; both-empty before ended,” but the gap producer “visits” a ts-less slot and later keep-alives return to `playing`. If the cursor is cleared on that visit, `playing` + null paints `session tape · starting…` in the middle of a day (loading rule), which is false standing. Spec must say the last vouched stamp is held across the gap pulse (or otherwise keep starting exclusive to pre-first-stamp). — evidence: SPEC.md §2.3 tape-cursor bullet (null only for first keep-alive / both-empty); §2.3 Phases gap row (ts-less visit, then later keep-alives are playing); §4 loading / starting = `playing` + `tape_time_et` null.

- **LiveTape “existing skeleton-first until first `data:`” overclaims a protection the shipped skeleton does not provide** — Page cold-load skeleton is REST `!data` (`TickerDashboard` `data-testid="cold-load"`). After the bundle lands, `LiveTape` mounts with hardcoded title `Live tape` and `!active → LIVE_TAPE_SUBTITLE_OFFLINE` until SSE arrives. On an armed walker, REST can succeed (ReplayHold / absent structure) while EventSource is still connecting, so the loading column’s “not `Live tape` / not `LIVE_TAPE_SUBTITLE_OFFLINE`” claim is false for that window unless the build adds an SSE-wait placeholder the SPEC never names. Say honesty begins at first `session_tape` payload, or specify a non-S0 SSE-wait state. — evidence: SPEC.md §4 LiveTape loading column; `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx` cold-load on `!data`; `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx` `title="Live tape"` + offline subtitle when `!active`.

## Minor / advisory

- **Conformance `required_when_armed.live` / `feed` / `phase` / `pace` are typed only** — FAIL prose bans `live: true` and `feed = live_massive`, and closed vocabularies name `session_tape` / phase set / pace `{1,4,10}`, but the machine map still pins `boolean` / `string` / `number`. Hermetic GATE Q is said to own value asserts; still weaker than the ship-gate claims. — evidence: INTERFACE_CONTRACT.md conformance JSON vs “Closed wire vocabularies” / “What a FAIL here means”.

- **SPEC tape-cursor “Omit / null” vs INTERFACE always-key JSON `null`** — Slot facts allow omit; INTERFACE `required_when_armed` requires `session_tape.tape_time_et` as `string|null`. Prefer the interface (always present, JSON null) so starting detection is one check. — evidence: SPEC.md §2.3 tape-cursor bullet; INTERFACE_CONTRACT.md additive occupancy table + conformance map.

- **Phases table lists client payload-gap as a drop “Producer”** — Client watchdog cannot write the occupancy slot; drop copy is consume-side and must not require wire `phase: drop` (already stated). Calling (b) a Producer invites a builder to hunt for a server write that cannot exist on a dead socket. — evidence: SPEC.md §2.3 Phases drop row vs client consume rule “Do not require wire `phase: drop`”.

- **AC-32 embeds `○` in the ended string while §4 copy keeps `dot` separate** — Harmless if TintChip owns the hollow mark, but the AC literal and the copy table disagree on the exact chip text. — evidence: SPEC.md §3 AC-32; §4 “S1 chip + tooltips” ended row + “`dot` is `○`”.

## Checked and clean

- **Pass-1 Critical (1) S1 loading = S0 — repaired, not papered** — Grep shows no remaining “S0 until playing is vouched”. Replaced by vouch-before-advertise (§2.3 steps 1–4; INTERFACE standing rule 3), loading chip `○ session tape · starting…` (§4 states + copy table), Gates ban on `liveStatus` / live-offline while `session_tape` present (including null cursor), AC-47, poison §2.8.17. First armed `data:` must already carry occupancy (AC-10 / method notes).

- **Pass-1 Critical (2) drop RecvError-only — repaired, not papered** — No SPEC remnant of “drop (RecvError/lag only)” (that wording survives only in historical R3). §2.3 drop phase (a)+(b), client consume rule, §4 states/copy, AC-13, AC-33, and INTERFACE “Drop on the consume path” all include client `STREAM_OFFLINE_MS` payload-gap while last phase was playing/gap, even when the last envelope still says `playing`.

- **Dropped conflicts** — All 17 `conflicts.json` ids are `disposition: folded` in the SPEC folding footer with matching `<!-- spire:council-resolution:v1 … folded -->` markers in §1/§2/§3/§4. §9 Open questions is empty; deferred work stays under Future. Honesty folds (`096836b6…`, `cc3e3ef5…`, `c0a10b7e…`, etc.) now have matching consume-path mechanism, not id-only markers.

- **Pass-1 Important bundle — repaired** — Refuse-before-bind (no walker socket; genuine S0 only on a different unset/`serve` process); both-empty starts then ended (AC-46); `market_session` null-cursor token `session_tape`; not-the-armed-day full slot table; Massive four-fetch ban = any ticker name on the armed process (SPEC + INTERFACE aligned); armed `feed` closed token `session_tape`.

- **Unobservable acceptance criteria** — Re-read §3 ship-blocking rows against outside-the-code oracles (SSE `data:` shape, CLI literals, vendor counter, coverage class, fixture copy). No SB AC found that only yields to reading source. Exact English stays `review` (38–39); banned interpolations / loading≠S0 / payload-gap≠live-offline stay `test` (31–36, 40, 47; fold `e40af2a9…`).

- **Unspecified component states** — §4 table covers S0/S1 chip, LiveTape, last-trade, net-flow, structure, orders, CLI, and non-surfaces; ended is first-class; not-the-armed-day has its own slot table. Residual holes are the Important chip-shape / gap-cursor / LiveTape-loading items above, not a missing state column.

- **Interface ↔ §2 / §4** — `session_tape` fields, `live: false`, `feed: session_tape`, null-cursor `market_session`, vouch-before-advertise, drop includes payload-gap, and any-name Massive ban match §2.3/§2.6/§4. No UI-consumed field missing from the additive object. Soft machine pins filed under Minor.

- **Internal contradiction** — No remaining refuse-vs-S0, feed-negation-only, or Massive-scope forks. Leftover contradictions are the Important empty-vs-starting chip and gap-cursor nullability items.

- **Guardrail breach (§8)** — Hard rules remain stated and poisoned in §2.8 (`present-is-live-paid-only`, exclusive construct, no `MarketDataPort::Replay`, no comment-only occupancy, loading≠live-offline, payload-gap≠live-offline, etc.). No new §8 violation found in the repaired text.

- **Hunt items still clean** — Empty Path-A starts (not refuse); no `/_ops/replay` / no HTTP Start-Stop arming; `Commands::Serve` grows no replay flag; production-profile+arm refuses before bind; silent Massive-down→tape forbidden.
