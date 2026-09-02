# exchange-holiday-calendar — R3 decisions

Folded 2026-08-31. Self-revisions first (no exchange). Remaining product questions go to the operator one at a time.

## Self-revisions (folded)

- **`407aec2952f454518340579eab6515f5c811e9fcb8a4fe6751bb5513573a52bf`** (architect) — retract only “FE ↛ a second holiday table.” Canonical set stays the Rust domain module. Dashboard `marketSessionPhase` may consume a **generated or pin-equality-tested replica** of that set for the scanner badge only. No `GET /api/holidays`, no bundle calendar field, no calendar UI. Ticker chip binds SSE `market_session === 'closed'`. quant-engine / Massive / tape↛coverage edges stand.
- **`0a53712f4e05a54c0fafb645b0b163d48feb33a8109f2d672209f4b3cc3e51bf`** (pm) — withdraw AC-4 as a coverage-HTTP requirement to print the word holiday. Coverage uses the same no-expected envelope as weekend: empty rows, not three cells, not a pass, no holiday cell, no holiday name. Must not print weekend on a holiday Thursday. Tape/keep print ineligible holiday vs ineligible weekend.
- **`c74ceda679f2e4044fae63e8f9655ffa95c1c12de53e22d4bcc74325629eadcf`** (pm) — withdraw serve-time “holiday cannot be evaluated.” Compiled table is total on a parsed date. Unlisted dates, including outside 2020..=2032, are not holidays. Invalid et_date stays existing unparseable/coverage-failed. Scanner fail-open remains `SCAN_MARKET_HOURS_ONLY` false.
- **`ac0fa767366017c0fa6bc18f621b87e611f7b228210c42a46d2c6d18da659328`** (pm) — withdraw holiday-vs-session-weekday score identity. Honest ClosedPre on a holiday changes spot vs today’s false RTH. Empty `quant-engine` diff; calendar is not a scoring feature. Do not require Thanksgiving output to equal a session Tuesday when standing is correctly closed vs RTH.
- **`cd986e5279da257d9dd73fb3fef0cc6d61a5c041caab418514c4e19b48016fcd`** (ux) — retract “same strings as Sat/Sun.” Same **layout** still stands (empty rows, no sixth cell, no `[PASS]`, no Thanksgiving name). Strings vs sibling `framing` on the existing field is queued as a product question after scanner-in-scope.

## Folded without exchange (retraction already meets the attack)

- **`eb4c1c049de515d3ee3962f88a5be5051aad1e6e00155e575a6d3cb0e08c85e1`** (architect → pm, technical) — PM self-revised the “cannot be evaluated” class. Membership is `fn(NaiveDate) -> bool`. No planted unreadable set.

## Technical CONVERGED (architect ↔ ux, 2026-08-31)

- **`27ff0c5386600ffaf9c526c8fb9cbc76739b896a651d06e15f85b8aeb4473639`** — leave `holiday_weekday_zero_rows_is_empty_extract_not_weekend` on **2026-08-10** (ordinary Monday → EmptyExtract). New **2026-11-26** Thanksgiving fixture: ineligible-holiday, gate before GET, not EmptyExtract / not Miss / not IneligibleWeekend.
- **`073800100cc7492d580b1fc6571cf94ba1dd1630a3a613cc7eef90707c98f1cd`** — calendar does not write `live: false`. `market_session === 'closed'` is evaluated before the live short-circuit (never `● live · closed`).

## Human ruling A — scanner badge in this slice (2026-08-31)

**`3671f1d48874189277d6d111661d44216b18e02e3e1bf97d888fb6b18e7c3fcd`** — Include the `/scanner` session badge. Holiday weekday 10:00 ET shows **Closed**, not RTH. Canonical set stays the Rust domain module. Dashboard `marketSessionPhase` consumes a **generated or pin-equality-tested replica** of that same set, used only by the scanner session badge. No `GET /api/holidays`, no bundle calendar field, no calendar editor. Ticker chip still binds SSE `market_session === 'closed'`, not the replica.

## Folded by that ruling

- **`b8528be68d983637b120d82e0a74846b6459714428b17e57317fb69366ca74c9`** (ux → architect, technical) — editor and holiday HTTP stay out. Same closed-set membership is compiled into existing pure `marketSessionPhase` from one generated source (not hand-pasted). Worker idle + ticker `closed` are not enough without the badge.

## Coverage framing (default-with-veto, 2026-08-31)

**`554bc47f0c0defb761ba68a6c108eb4694c804f7bf6f1330f72c507280c82584`** — Coverage holiday D uses the **existing** no-expected envelope string (`RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`). That string does **not** contain the word weekend. Key it off **not a session day** (holiday or Sat/Sun), **not** by setting `weekend: true` on a Thursday. Empty rows, not three `missing` cells, not a pass, no holiday cell, no holiday name. Tape/keep print `ineligible holiday` vs `ineligible weekend`. Operator: say `framing-split` to override and mint a third framing literal.

## Session-day gate (folded, 2026-08-31)

On a full-day holiday civil date, `MarketPhase` / `market_session_at` are **closed / ClosedPre for every clock hour that ET date** (session-day gate before time-of-day). Holiday 17:00 ET is not `AfterClose`. Holiday 21:00 ET is not overnight-as-session-weekday.

## Still open

- none — ready for R4.
