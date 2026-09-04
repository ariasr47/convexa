# R4 pass 2 — the eight SPEC.md edits (drafted by the synthesizer, recorded by the conductor)

The R4 synthesizer ran a second pass over the S2 findings, repaired `INTERFACE_CONTRACT.md` itself, and
**refused to write `SPEC.md`** — correctly. Its tool set is `Read`/`Write`/`Grep`/`Glob` with no `Edit`, so a
"surgical" change to an 85KB / 830-line file means re-emitting the whole file from context. Line 828 is a
single ~7,000-character JSON receipt carrying 32 SHA-256 ids that `contract_lint` recomputes from the R2
critique bytes and compares exactly; the prose carries dense symbol runs and nested-backtick spans; the file
exact tail bytes matter. One transposed hex character silently turns a 0-error lint into
`council folding receipt conflict id does not match the current R2 bytes`. It also had no `Bash`, so it could
not run the gate it was told to run before reporting. It stopped instead of shipping an unverifiable rewrite.

**Authorship of these edits is the synthesizer's.** This file is the conductor's transcription so the drafts
survive on disk rather than in a chat transcript, and so the agent that applies them works from a fixed plan.

**Binding constraints for whoever applies these:** edit only what is named; every other line stays
byte-identical; never touch the hidden folding receipt or any `<!-- spire:council-resolution:v1 … -->` marker,
and never move a `## N` section boundary (each marker must stay inside its cited section);
`node .claude/tools/gates.mjs contract_lint curvature-v2-foundations` must return **0 errors** afterwards.

| # | Anchor | Edit | Closes |
|---|---|---|---|
| 1 | §2.1, line 113 | `Two additions close that:` → `Three additions close that:`, plus a **per-name value-distinctness** clause: for each of the seven tokens, light ≠ dark unless the name appears on a short in-file *same-in-both-schemes* list with a one-line reason (`scrim` is the plausible member). Keeps §2.1 in step with the AC-41 repair. | Important 6 |
| 2 | §2.3, `register` bullet, line 175 | Add one sentence: `register` stays required when `value` is a `NotANumber` member but has **no effect on that render** (the literal branch is always Sans per AC-19). Required-and-ignored is deliberate, so a call site that later emits a real figure has already declared its register. | Minor 2 |
| 3 | §2.4, line 226 | Add one sentence: the new module is the **definition site**; `TickerHeader.tsx` and `CommandDeck.tsx` are both importers. `R3-ux.md` §3's `TickerHeader.tsx (definition)` parenthetical names the file the resolver moved *out of* and is superseded. | Minor 3 |
| 4 | §2.4, lines 252–257 | The union has no placeholder member, so re-entry means *discarding* a held `ConnectionState`; but the boundary — whether a `ConnectionState` exists yet — sits in the wrapper and is runtime logic a `never`-arm cannot see. Ruling 1's structural requirement stands unchanged; the proof the wrapper obeys it is **AC-7b**, not a corollary of AC-7. | Important 4 |
| 5 | §2.6, after line 338 | New paragraph naming the open→resolved window as the **LOADING class** (canon rule 3: cold skeleton ≠ offline ≠ unavailable), resolving **once** to rows or to AC-30's unavailable arm and never re-entered, citing the shipped precedent `useScan.ts:76-78`; the dialog stays usable throughout. Points at P2a and AC-29c. | Important 1 |
| 6 | §3.A | **AC-7** loses the latch clause (keeps the six-kind enumeration and its mutation proof). **New AC-7b (SB)** carries the latch with its own distinct evidence: latch a chip, then feed each re-entry candidate (gap, undefined payload, watchdog expiry) and assert the placeholder is absent and a chip state present on each. **AC-10** rewritten to the Ruling-1 shape — each of the five surfaces asserts a named content anchor **present first**, then the negative space, so a blank or crashed page fails on the positive assertion instead of passing by construction. | Important 2, Important 4 |
| 7 | §3.B / §3.C | **AC-21** narrowed to *ticker or positions*, with the app-wide Banned-table invariant recorded as carried-forward (Minor 1). **AC-26** promoted `review` → `test` with its own scrim-click arm; the false cross-reference *"AC-25 already covers the dismissal mechanism"* is replaced by the reason it does not — §2.6 hand-assembles the palette with a feature-owned `keydown` listener, so Escape and backdrop share no guaranteed path (Important 5). **New AC-29c** for the pending window: skeleton rows **present** (a positive observable), no tier/score/status and no `0`, a surface command still navigates, and after resolution the loading form is absent and does not reappear (Important 1). | Important 1, Important 5, Minor 1 |
| 8 | §3.F / §4.4 / §6 | **AC-41**'s evidence gains the per-name value assertion matching §2.1 — the key-set twin is structurally blind to `extrasLight.glass` copying `extras.glass`, the exact fallback the row forbids (Important 6). **§4.4** gains row **P2a** (palette open, ranked read in flight) between P2 and P3. **§6** loses the now-overstated *"pins the exact fields… so a silent wire change is caught at GATE Q"*, replaced by a pointer to the interface file's stated limits — otherwise §6 contradicts the rewritten `INTERFACE_CONTRACT.md`. | Important 6 |

## Already done in pass 2 (no further action)

`INTERFACE_CONTRACT.md` was rewritten by the synthesizer and verified by the conductor: `NO_BACKEND_CHANGE`
marker present, conformance JSON parses, and `sweep.sweep_last_completed` is now genuinely pinned as
`number|null?`. The `?` is deliberate and reasoned: `scan.rs:84` types `sweep` as `Option<SweepHeartbeatDto>`,
so it is legitimately `null` on a cold store, and `interface_conformance.mjs:220-246` has no
required-only-when-parent-present form — an unmarked pin would FAIL every run against a backend whose scanner
never wrote a heartbeat, a false FAIL that routes GATE Q to the wrong lane. The prose now states exactly what
the pin buys (`rows[].as_of` outright; `sweep_last_completed` only when a heartbeat exists) and names the
compensating control for the residual rename risk: `apps/api` is byte-frozen by AC-51, and the field is read
through the generated `SweepHeartbeatDto` type, so a rename is a `typecheck` failure under AC-56.
`contract_lint`: **0 errors** after that rewrite (run by the conductor; the synthesizer has no `Bash` and
correctly declined to claim green).

## Size, recorded not acted on

`SPEC.md` is 85KB against the 40KB artifact budget. The weight sits overwhelmingly in **§3** (57 AC rows,
~140 lines, where the *Completion evidence* column is often longer than the criterion) and **§2** (~290 lines
of mechanism prose carrying most of the `file:line` citations); §4 adds ~150. Moving the evidence column to a
sibling file while keeping every criterion would recover most of the overage. **This is the owner's call and
is deliberately not bundled into this repair** — mixing a compression pass with these eight edits would make
the diff unreviewable.

## Correction (conductor, 2026-09-03)

The sentence above originally read *"ends `-->\\n\\n`, not `-->\\n`"* — transcribed from the synthesizer's
report and **wrong**. The scribe checked the bytes: the tail was `}]}\\n-->\\n` before the edits and is
byte-identical after. There is no trailing blank line and there never was. Corrected in place rather than
left to mislead a later reader. The caution it was offered in support of still stands, and the byte-level
care it argued for is exactly what kept the receipt intact.

## Applied (2026-09-03)

All eight edits transcribed with `Edit` only. `SPEC.md` 829 -> 872 lines (+43), 87,110 -> 94,218 bytes.
**Verified independently by the conductor, not taken on report:** `contract_lint` **0 errors**; 32 inline
resolution markers carrying 32 unique ids; the receipt's 32 rows carry exactly that same id set; and every
one of the 32 ids **re-derives from the live R2 critique bytes** (32/32 sha256 match). 0 NUL bytes.
The scribe also reflowed two lines of one paragraph to the file's wrap width after an edit left a
44-character orphan — content unchanged, and disclosed rather than buried.
