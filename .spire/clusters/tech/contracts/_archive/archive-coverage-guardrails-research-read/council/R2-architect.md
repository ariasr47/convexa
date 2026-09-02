```json
{
  "role": "architect",
  "agree": [
    "The buyer is the **operator / owner of the paid session archive**, not the trader on Landing / Ticker / Positions / Scanner.",
    "Coverage never fetches the vendor, never fills a gap with reconstructed history, never writes a live paid book, never changes live score, and never appears in trader UI.",
    "Exchange-holiday weekdays stay **expected** this slice (same eligibility the liquid-name ensure already uses: ET weekdays).",
    "4. **Checkpoint = 16:00 America/New_York.**",
    "On an eligible ET weekday before 16:00 America/New_York, that calendar date’s SPY/QQQ/IWM identities are not yet due: they are not classified missing, and they do not emit a hole warning, and they do not by themselves fail the audit.",
    "Transport (existing operator diagnostics vs sibling research read) is architecture’s choice; both must stay operator-token, zero-vendor, unlinked from trader UI.",
    "There is **no trader screen here.**",
    "SPEC §4 must carry **`NO_UI_CHANGE`** and must **not** restate the token table.",
    "Do **not** fire before checkpoint, on `ineligible` dates, on the seed fixture, or when the store is `session archive not storing` (that is the error state, not a per-cell warning storm).",
    "`/_ops/metrics` gains **no** coverage matrix, coverage chip, or stage named from this feature.",
    "Human print, any JSON twin, hole list, and **CLI exit code must agree**.",
    "A reconstructed / flat-file artifact is **never** classified `present` and **never** labeled `live_massive`."
  ],
  "conflicts": [
    {
      "quote": "**Winner: 10:00 ET.**",
      "source": "architect",
      "why": "I cannot name a mechanism by which 10:00 America/New_York beats 48-slot prune on a polled liquid name. The ring is 48 snapshots per symbol; a 60s ticker poll can rotate it in tens of minutes, so 10:00 is not prune-salvage. Ensure at 16:00 is also not still in its first MASSIVE_RETRY_SPACING_SECS=300 window (Massive has been open since 04:00 ET per OPEN_THREADS §2). The 10:00 lock was a prune-margin claim I can no longer defend.",
      "proposal": "Lock the due clock at 16:00 America/New_York (PM). Keep the injected DateTime<Utc>. Before that instant a today weekday cell is NotYetDue and does not warn. Named residual: same-day notice is not ring salvage; a missing persist can lose the ring copy hours before 16:00.",
      "kind": "technical"
    },
    {
      "quote": "Identity date = `today_et_date(now)` unless the CLI names another `YYYY-MM-DD` via `parse_et_date`.",
      "source": "architect",
      "why": "A default-today matrix on 2026-08-26 would classify only the 26th and could exit 0 while SPY 24–25 were already missing — the incident this BRIEF exists to catch. Last-readable of a present today points at today and hides those holes. Weekend default today_et_date → empty expected set → exit 0 has the same blindness for Friday. I withdraw one-D-as-the-matrix.",
      "proposal": "Derive accepts an explicit ET date range. Default until = last due date (today after 16:00 ET, else yesterday). Worker warning pass classifies only identities due at this injected now (three loads per tick), not the full range. HTTP/CLI materialize the range on demand. Default since is PM’s call — not inferred from min(present).",
      "kind": "technical"
    },
    {
      "quote": "5. **Storing window** starts the first ET weekday this environment was actually storing — the 21 Aug “unset root” days must not count as missing.",
      "source": "pm",
      "why": "SessionChainArchive::list/load return metas and bodies, not an archive-enabled-at watermark. min(LiveMassive et_date) is the first present book and would omit leading misses (24–25 if 26 is the first present). Walking every weekday while the store is enabled would classify 21 Aug unset-root as missing. Those are the only oracles in the live store; neither implements this sentence. Baking 2026-08-26 into code would violate cited-code-is-verified-not-assumed.",
      "proposal": "Multi-date window start is an explicit since (CLI flag and/or runtime env). Dates before since are not expected. A currently disabled store is StoreDisabled (matrix withheld, CLI non-zero, no per-cell warnings), not a missing grid. No inferred first-storing weekday from list().",
      "kind": "technical"
    },
    {
      "quote": "Each due identity is exactly one of **present** · **missing** · **unreadable**.",
      "source": "pm",
      "why": "insert_if_absent is first-wins on (symbol, et_date). A Fixture (or any non-LiveMassive) row occupies the slot with a body that may deserialize. That is not Missing (index row exists) and not Unreadable (load may be Ok(Some) plus deserialize_capture Ok). Folding it to present is the reconstruction lie. Forcing it into missing or unreadable collapses absent-is-not-none. Seed exclusion only removes (SPY, 2020-01-02); it does not cover a Fixture planted on a live weekday.",
      "proposal": "Due derive stays four mutually exclusive arms: Present | Missing | Unreadable | RejectedSource. CLI exit 0 only when every due identity is Present. Operator copy must not say present; do not reuse missing. UX already has a blocked/reconstructed family — use that rather than widening unreadable to “body loaded but source rejected.” One checkpoint warning for that identity.",
      "kind": "technical"
    },
    {
      "quote": "`cargo run -p api-rust -- archive-coverage` (or Architect’s renamed clap that still prints this title) prints the matrix and exits **non-zero iff** any **due** expected identity is `missing` or `unreadable`.",
      "source": "ux",
      "why": "The iff is bidirectional. A due identity occupied by Fixture/non-LiveMassive is neither missing nor unreadable, so this sentence makes archive-coverage exit 0 on the first-wins occupancy poison. Structural enforcement is Insert Fixture → status ≠ Present → CLI ≠ 0. PM’s “0 only when every due expected identity is present” is the exit rule that matches that poison.",
      "proposal": "Exit 0 only when every due identity is present. Non-zero on missing, unreadable, RejectedSource/blocked occupancy, StoreDisabled, or derive failure — distinguishable, not aliases. Vacuous/not-due window (zero due identities) still exits 0 as NOT DUE, not as n/n present.",
      "kind": "technical"
    },
    {
      "quote": "CLI **does not wait** for checkpoint: the operator asked *now*.",
      "source": "architect",
      "why": "If this means today’s load miss is a CLI hole before the due clock, the audit is a different matrix than HTTP NotYetDue and a daytime run always fails today’s trio. BRIEF requires the same matrix. PM AC-8 already forbids today’s pre-checkpoint identities from failing the audit by themselves. Non-blocking I still defend: the command must not sleep until 16:00.",
      "proposal": "CLI runs immediately (no sleep). It uses the same derive as HTTP and the warning emitter: pre-checkpoint today is NotYetDue and does not fail the process by itself. A named date still classifies due vs not-yet-due against the injected now.",
      "kind": "technical"
    },
    {
      "quote": "**Last readable:** latest `present` identity for that symbol inside the archive that is **not** the seed fixture.",
      "source": "ux",
      "why": "Newest present anywhere in the archive can be after row D (D2 missing, D3 present → global latest is D3). PM AC-5 requires D2’s last-readable on or before D2. Printing a later date on an earlier hole invents a prior success the row did not have. Seed remains excluded; another symbol’s date remains forbidden; Unreadable candidates are skipped, not treated as last-readable.",
      "proposal": "Last-readable for symbol S at date D is the newest Present LiveMassive identity with et_date <= D, seed skipped, Unreadable skipped, walk capped at 60 index rows. A trailing column prints that value at the window’s last due date. Typed absence if none qualify — not a fabricated date.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: When since is omitted, what is the default window start — last due date only, a required env/flag that blocks the run if missing, or another explicit calendar date? Do not ask derive to infer it from min(present).",
    "PM: What operator-visible token is a first-wins Fixture/non-LiveMassive occupant on a due weekday — a fourth class, UX’s blocked/reconstructed family, or a fold you will own?",
    "PM: Is a 60-row last-readable walk cap acceptable for v1, knowing a match older than 60 index rows becomes typed absence?",
    "UX: Confirm last-readable is on or before that row’s D (trailing column = last due date’s value), not global latest in the archive.",
    "UX: Will AC-U13’s iff missing|unreadable become exit 0 only when every due identity is present, so blocked/RejectedSource occupancy fails the command?"
  ]
}
```
