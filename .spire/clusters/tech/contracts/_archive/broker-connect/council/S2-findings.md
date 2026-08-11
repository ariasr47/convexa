# S2 — skeptic findings: broker-connect

Reviewed: `SPEC.md` + `INTERFACE_CONTRACT.md` against `council/decisions.md` (binding),
`R3-pm.md`, `R3-architect.md`, `conflicts.json`, `R2-{pm,ux,architect}.md`, `BRIEF.md`,
`_context-pack.md`, and `.claude/tools/interface_conformance.py` (schema + `fetch()` behavior).

Severity map: **Critical** = must loop back to R4 synthesis · **Important** = Major, should fix
before GATE I closes · **Minor** = advisory.

---

## Critical (blocks — must loop back to R4)

### C-1. AC-11 (stale rows) and AC-21 (real-time modeled P/L) contradict on the same pixel; nothing rules the collision

**Text at fault — SPEC §3 AC-11:**
> "Stale: when the snapshot's age exceeds the server-declared `stale_after_seconds`, rows keep
> their last-known values, visibly marked stale with their timestamp — never blanked, **never
> silently refreshed-looking**." *(Verify by: `test`)*

**Text at fault — SPEC §3 AC-21:**
> "Broker rows show a Convexa-modeled **real-time** P/L computed by the existing mark ladder …"
> *(Verify by: `test`)*

**Why.** The two ACs describe the same row under the same condition and demand opposite renders.
The modeled P/L is declared live-derived off the SSE mark feed (SPEC §2 "only the modeled P/L is
live-derived"; §4 "Broker data is polled REST … **except** the Convexa-modeled P/L figure"). So
when the broker snapshot goes stale (S6), the quantity/as-of fields freeze while the dollar figure
beside them keeps ticking. That row is *exactly* "silently refreshed-looking" — a moving number on
a position set nobody has re-read. It is also an unnamed hybrid basis: current marks × stale
quantities, labeled only `Convexa-modeled`, which the owner's ruling rails ("named basis") do not
cover.

The contracts never rule it. `decisions.md` §"P/L on broker rows" item 4 specifies degradation for
**SSE drop only**. §4's state machine gives S6 the surface "Data stays rendered, frozen, stamp
foregrounds the age" — "frozen" contradicts a ticking P/L — while the component grid's Broker-row
`offline/stale` cell says only "modeled P/L dims ⏸; snapshot facts stay", which is the *SSE-drop*
behavior filed under the *stale* column. The two degradation axes (snapshot stale vs mark feed
down) are conflated in one grid cell and separated nowhere.

A build lane cannot pick: both ACs are `test`, and whichever it implements, the other's test fails.
This is a product/honesty call above a lane's authority.

**Smallest fix.** Add one binding rule (SPEC §4 S6 row + a clause on AC-11 or AC-21) stating what
the modeled P/L does when `now − as_of > stale_after_seconds`: either (a) it degrades on stale the
same way it degrades on SSE drop — dim + ⏸ last-known, since a live mark on a stale book is not a
current read of the position; or (b) it keeps updating and AC-11's "never silently
refreshed-looking" is explicitly scoped to *broker-supplied* fields, with the P/L's basis label
extended to name the stale-quantity input. Then split the component grid's `offline/stale` column
into "snapshot stale (S6)" and "SSE drop", which are currently one cell holding two behaviors.

---

## Important (Major — should fix)

### I-1. The one trader-visible tooltip that uses "live" as a descriptor sits on the broker surface, violating AC-7 and the §7 forbidden-word scan

**Text at fault — SPEC §4 Copy:**
> "Modeled P/L tip: the existing mark-ladder basis copy plus the label `Convexa-modeled` — `our
> model's **live** read on this position, not a Webull figure`."

**Why.** AC-7 (`test`): "the word 'live' never appears on this surface as a freshness claim or
descriptor (**negation-only allowance in the header honesty line**)." §7 automates it: "Forbidden-word
scan: 'live' appears nowhere on the broker surface as descriptor (negation-only allowance in the
header phrase)." The P/L tip is neither the header nor a negation — it is a positive descriptor in
trader-visible copy on the Broker tab. The SPEC ships a copy string that fails its own automated
test. (`decisions.md` label ruling: "the ban is on what the trader reads.")

**Smallest fix.** Reword the tip to drop the word, e.g. `our model's current read on this position,
not a Webull figure`. §4 already declares wordsmithing open.

### I-2. The "closed lookup" in §4 is not a function — S5, S8 and `credential_unreadable` match the same wire tuple with no precedence rule

**Text at fault — SPEC §4 render-state machine:**
> S5 · unknown · Trigger: "`state: unknown`, **any failure reason**"
> S8 · reauth_required · Trigger: "`credential_rejected` (as `reason` or `last_attempt_outcome`)"
> and below the table: "`credential_unreadable` renders warning-class with a `Replace keys in
> Settings` CTA …"

**Why.** `state: unknown, reason: credential_rejected` satisfies S5's trigger *and* S8's. The same
holds for `credential_unreadable` (S5 vs the warning-class render). §4 claims "a **closed lookup**
keyed on the wire" and §7 makes "S7 ≠ S8 ≠ `credential_unreadable`: distinct renders off distinct
wire values" an automated test — but the mapping as written is ambiguous, so which render wins is
a lane improvisation. `R3-architect.md` is explicit that "S8 keys off `credential_rejected`
wherever it appears", i.e. S8 must win; the SPEC never says so.

**Smallest fix.** Narrow S5's trigger to `reason ∈ {broker_unreachable, rate_limited,
adapter_fault}` and state that `credential_rejected` → S8 and `credential_unreadable` → its own
render take precedence wherever they appear.

### I-3. The last-known-book conditional is written in client-session terms while the wire truth is server-process-scoped — a page reload produces the wrong copy over a book the server is still serving

**Text at fault — SPEC §4 (S7, S8) and §4 Copy:**
> S7: "Tab-scoped info banner over last-known rows **if a confirmed book exists this session**;
> else S5 copy"
> S8: "last-known book stays below with its stamp *if one exists **this session***"
> Copy: "(No confirmed book **this session** → body falls through to S5 copy.)"

**Why.** `R3-architect.md` (binding) scopes cache retention to the **server process**: "the cached
book is dropped only on process restart or credential delete … 'your last confirmed book stays
below' is server-true within a process lifetime". After a browser reload (or a fresh tab) inside the
same server process, the wire still returns `state: ok` + a failed `last_attempt_*` — but there is
no book "this session" in client memory, so an implementation following the copy literally falls
through to S5 ("Convexa hasn't been able to read your Webull book yet") while a real, server-served
book sits in the payload. That is both a false statement and a violation of §4's own rule that the
lookup is keyed on the wire, never on client state.

**Smallest fix.** Restate the conditional as the wire predicate it actually is: "if the response
carries a served snapshot (`state ∈ {ok, empty}`)" — replacing every "this session" occurrence in
S7/S8 and their copy.

### I-4. `decisions.md`'s internal-naming carve-out for `live` is dropped, making the §7 forbidden-word scan over-broad against the SPEC's own module names

**Binding text dropped — `decisions.md`, Label ruling:**
> "**Internal names/routes/testids may keep `live` for continuity**; the ban is on what the trader
> reads."

**Why.** Neither AC-7 nor §7's forbidden-word scan carries the carve-out. AC-7 says "the word
'live' never appears **on this surface**" and §7 says "'live' appears **nowhere on the broker
surface** as descriptor" — scoped to neither rendered strings nor source identifiers. A source-scan
implementation (the pattern §7 uses elsewhere) would trip on the SPEC's own §2 module list
(`engine`/`signals`/`live`/`darkpool`), on route/testid continuity names, and on the words
`live-derived`/`live A/B` in the spec itself. A binding ruling clause that survives only in
`decisions.md` will not survive the build.

**Smallest fix.** Add to AC-7 and §7: "scan covers rendered strings only; internal
names/routes/testids may keep `live` (decisions.md label ruling)."

### I-5. AC-6a is marked `test` but its load-bearing clause is a human comparison against a third-party app

**Text at fault — SPEC §3 AC-6a:** *(Verify by: `test`)*
> "…the Broker tab lists every position the broker reports — **symbols and quantities matching what
> the Webull app shows**, and any position count shown never understating the broker's book."

**Why.** No automated test can observe "what the Webull app shows". §7 states "AC-6a/6b assertions
bind to the captured shapes" — but the captured fixture comes from the *API*, so a fixture test can
only prove tab-vs-payload fidelity, never payload-vs-app fidelity. The clause that carries the whole
"nothing is missing from your book" claim is unverifiable as classified, and per checklist item 2
an AC that cannot be checked from outside the code is a defect.

**Smallest fix.** Split the verification: `test` for "the tab renders every position present in the
captured payload, unaltered, count never understating" (mechanically checkable), plus a named
one-time `review` step for the owner's app-vs-tab eyeball, referenced in §7's reviewed list.

### I-6. `account_ref` ships a broker account identifier to the browser with no opacity rule, while §8.1 classes account numbers as sensitive — and no surface consumes it

**Text at fault — INTERFACE_CONTRACT §2:**
> "| `account_ref` | string (opaque) | present whenever a stored credential resolves one … |"

**Text in tension — SPEC §8.1 Logging:**
> "no secret, signature material, **account number**, or position detail in logs at any default
> level"

**Why.** "opaque" describes how the *client* must treat it, not what the *server* may put in it —
nothing forbids the adapter passing the raw Webull account number straight through. The contract
therefore treats an account number as too sensitive to log while shipping one to the browser on
every book read. Compounding it: no state in §4, no copy, and no AC consumes `account_ref`, so the
field earns nothing in exchange for the exposure. system-6 fires on exactly this surface (§8.1
"Credential storage … masked-hint leak surface").

**Smallest fix.** Either add to the field's presence rule "a server-generated non-reversible handle
— never the raw broker account number", or drop the field until a consumer needs it.

---

## Minor / advisory

- **M-1.** SPEC §2: "Sim and **Live** share *render* capability only through the `PositionView`
  projection" — stale pre-rename nomenclature; everywhere else the surface is "Broker".
- **M-2.** SPEC §4 Settings copy: "Saved encrypted. Never shown again, **never sent to this
  browser**." renders directly beside `Webull · key ····{last4}`, which *is* App Key material sent
  to the browser. The masked hint is sanctioned by `[secret-encrypted-at-rest]` ("masked hint
  only"), so the practice is fine — the sentence is literally false as written. Suggest "never sent
  to this browser in full" or scoping the sentence to the secret.
- **M-3.** INTERFACE_CONTRACT §5: the PUT row's "200 response" column hardcodes
  `{"set": true, …, "storage_available": true}`, contradicting the same section's prose
  "Storage-unavailable ⇒ 200 `set:false, storage_available:false`". The table reads as the only 200
  shape.
- **M-4.** SPEC §4 S2 trigger "credential stored, first fetch in flight (**client-known**)" never
  names how the client knows — it requires `GET /api/broker/credential` (`set: true`), which flow 2
  in §4 does not include. Worth naming so the Broker tab's data module is specified to call it.
- **M-5.** §1 calls §4 "the full closed set of Broker-tab states" (nine), but there is no signed-out
  state; §5 covers it ("`SignInPrompt` pattern") and §4 does not. Either state is closed or it is
  not.
- **M-6.** AC-11's "rows keep their last-known values" is vacuous under S4 (`state: empty`, no
  rows), yet §4 declares S6 a modifier on S3 **and** S4. Harmless, but the AC text and the state
  table disagree about S6's domain.
- **M-7.** Conformance block: `POST /api/broker/book/refresh` is safe under `--auth-signup` (no
  credential ⇒ no broker contact), but run with `--auth-cookie` on the owner's real session the same
  block fires a force-fetch against the owner's Webull rate limits. The prose scopes the block to
  `--auth-signup`; nothing enforces it. Consider stating "never run this block with `--auth-cookie`
  against a credentialed session".
- **M-8.** SPEC §4: "Broker data is **polled** REST, static-family" — "polled" in a no-poller v1 is
  loose (the intent is request/response vs push). `decisions.md` uses the same word, and this is
  internal prose, not trader copy, so advisory only.
- **M-9.** R2-pm's third ask ("does the closed reason vocabulary expose 'credential stored, never
  successfully read' distinctly from 'no credential' and from 'fetch in flight'?") is never answered
  in `R3-architect.md`. The contracts *do* answer it — no-credential is `no_credential_stored`,
  never-read is `unknown` + a failure-cause reason (with `account_ref` present), in-flight is S2/S9
  marked client-known — so there is no gap, only an undocumented resolution. Noted so it is not
  mistaken for a dropped ask later.

---

## Checked and clean

1. **Dropped conflicts (checklist #1, run first).** All six `conflicts.json` entries resolve in the
   contracts: **C1a/b/c** → SPEC §2 "Refresh model", §1 scope ("No cadence, no background poller, no
   streaming in v1"), §4 header copy, §2 + IC §2 rejected lists, §9 nothing outstanding. **C2** →
   AC-6a/6b + §9 OQ1/OQ2. **C3** → §9 OQ7 (escape hatch preserved verbatim). **C4** → AC-8 +
   IC §6 force-fetch semantics. **C5** → IC §2 `last_attempt_at`/`last_attempt_outcome` +
   attempt semantics + cache-retention rule. Every R2 `asks` entry is also answered except the one
   noted in M-9.
2. **Binding-text fidelity.** AC-6a, AC-6b and AC-8 are reproduced from `R3-pm.md` **verbatim**, with
   the sole change "the Live tab" → "the Broker tab" — mandated by `decisions.md`'s label ruling,
   which is binding over R3. The `BrokerBook` envelope table in IC §2 matches `R3-architect.md`'s
   final table row-for-row (names, types, presence, including `as_of` **absent** under `unknown`).
   The five-value failure-cause set and the six-value `reason` vocabulary are reproduced exactly.
   The attempt-semantics rule ("cache-serve/throttle is NOT an attempt") is stated consistently in
   SPEC §2, SPEC §5 (Throttled-refresh row), IC §2, IC §6 and §7's test list — no contradiction found.
3. **`[no-real-order-path]` (structural).** No write method on the port (IC §1: "nonexistent, not
   unused"; adding one is a GATE-Z event); SDK import-scope pinned by source scan; AC-15 forbids
   disabled/coming-soon affordances *and* `TradeEntryDialog` reference; IC §7 restates the absence;
   `POST /api/broker/book/refresh` is a server-side read trigger, not a broker write. No implied
   write surface found anywhere in either file.
4. **`[absent-is-not-none]` end-to-end.** `state` is the sole disambiguator with `positions: []`
   under both `empty` and `unknown` (IC §2); "no consumer may branch on `positions.length`" is
   restated in SPEC §2, §4 (state machine preamble), AC-10 and §7's highest-severity test. Tri-state
   `BrokerFact` carries it to field level; `not provided` is correctly the **fifth** literal (the
   canon slice records four today: `—` · `unavailable` · `not recorded` · `no basis`), and the
   `unparseable` → `unavailable` mapping is stated. Under `unknown` no cached book is served (the
   server serves last-good as `state: ok` + failed `last_attempt_*`), so the two paths cannot
   collide.
5. **`[secret-encrypted-at-rest]`.** No response shape in IC §5 carries key, secret or ciphertext;
   `last4` is App-Key-only and matches the sanctioned "masked hint only" carve-out; decrypt-fail →
   `credential_unreadable` with the misattribution ban stated three times (SPEC §2, §4, §5, IC §3).
   AC-5 + §7 automate it. Only the copy nit in M-2.
6. **`[additive-keeps-score-byte-identical]`.** One-way-leaf import rules in both directions
   (SPEC §2), "Nothing broker-derived EVER rides the SSE payload", IC §7's explicit exclusion, AC-17
   plus §7's three-part proof (characterization fixtures + empty diff on scoring modules + live A/B).
   No path found by which broker data reaches signals/score/`state_fingerprint`.
7. **Owner P/L ruling rails.** Items 1, 2, 3 and 5 of the `decisions.md` ruling are faithfully in
   AC-21/AC-22, SPEC §1, §2, §4 copy and IC §4 (`unrealized_pl` carried **verbatim**, tri-state,
   "no computation, no blending"; the modeled figure explicitly NOT a wire field). Item 4 (SSE-drop
   degradation) is present but incomplete — see C-1.
8. **On-demand model / no cadence leak.** Grepped both contracts for
   `schedul|automatic|cadence|every \d|periodic|poll`: every hit is a *negation* or a rejected-list
   entry. No scheduled-refresh claim survives in copy, wire, or ACs. "Live" as trader-visible copy:
   one violation only (I-1); the header's "never live" is the sanctioned negation.
9. **Conformance block validity** (checked against `interface_conformance.py`'s docstring schema and
   `fetch()`): the JSON parses, uses only supported keys (`method`/`path`/`auth`/`required`), only
   supported typespecs (`string`, `array`, `number?`, `string?`, `string|null`), and `fetch()` passes
   `method=` explicitly so the POST arm is issued as a real POST. Environment-independence holds: a
   `--auth-signup` throwaway account deterministically yields `state: unknown` +
   `reason: no_credential_stored`, so the two non-optional fields (`reason`, `positions`) are always
   present, and every credential-dependent field is correctly marked `?`. `last4` is correctly
   required-but-nullable. PUT/DELETE correctly excluded (a sweep must not mutate credential state).
   Auth arms match the `[server-side-gate-enforcement]` canon: all three marked `"auth": true`,
   anonymous ⇒ real 401/403 per IC §5/§6, FE checks declared UX-only in SPEC §8.
10. **Component states (checklist #3).** All nine S-states named in §1 have a trigger and a surface
    in §4; the template grid covers default/loading/empty/error/offline-stale for all four
    components; §5's failure table maps every failure class to wire truth, user-visible render, and
    logging. Gaps found are C-1 (stale × live P/L), I-2 (overlapping triggers) and M-5/M-6.
11. **Interface mismatch (checklist #4).** Every wire field the §4 state machine and copy consume
    (`state`, `reason`, `last_attempt_outcome`, `as_of`, `basis`, `stale_after_seconds`, `fidelity`,
    `unrealized_pl`, leg fields, `last4`) is promised by the interface; the only field promised and
    not consumed is `account_ref` (I-6). SPEC §6's pointer summary matches IC §5/§6 exactly and
    restates no field list, per the contract-separation rule.

---

## Verification pass (S2 loop 1 — post-R4-amendment; loop cap reached)

Re-read: amended `SPEC.md`, amended `INTERFACE_CONTRACT.md`, and `decisions.md`'s three new
sections (C-1 two-axis ruling · Major dispositions · owner cross-account-isolation AC).
Verdicts are verification only — no re-litigation of resolved design choices, no new hunting.

### Critical

| # | Verdict | Evidence in the amended contracts |
|---|---|---|
| **C-1** | **FIXED** | The collision is resolved by naming both axes, not by picking a side. SPEC §4 gains "**Two degradation axes** (C-1 controller ruling, binding)" with the market-data axis governing the modeled P/L ONLY and the book-snapshot axis governing the position-set fields ONLY, plus an explicit **all-four-combinations table**. AC-11 is now scoped ("Stale (book-snapshot axis — scoped to broker-supplied snapshot fields) … This AC governs snapshot fields only"). AC-21 is scoped to the market-data axis and carries the new rule: "a ticking figure over a stale book never renders with a single-basis label", with the dual-basis label `modeled now · on your book as of {time}` given as exact copy in §4. The component grid's old conflated `offline/stale` column is split into **`snapshot stale (S6)`** and **`SSE drop`**. §7's test is rewritten to assert the dual-basis label ("a single-basis label over a stale book is the regression"). S6's surface cell and §5's SSE-drop row are consistent with the four-combination table. No contradiction survives. |

### Important (Major)

| # | Verdict | Evidence |
|---|---|---|
| **I-1** | **FIXED** | The tooltip now reads `our model's current read on this position — recomputed as prices move; not a Webull figure` (SPEC §4 Copy). Re-grepped the SPEC: every remaining `live` is either the sanctioned header negation ("a snapshot, never live"), the rejected-defaults note ("a `LIVE` badge (forbidden word)"), or internal prose (`live-derived`, `live A/B`, `live payload capture`, the `engine/signals/live/darkpool` module list) — all now explicitly outside the scan's scope per I-4. No positive trader-visible "live" remains. |
| **I-2** | **FIXED** | SPEC §4 gains a named precedence block: "**Precedence (the lookup is a function, I-2):** `credential_rejected` → S8 and `credential_unreadable` → its own warning-class render take precedence wherever they appear … S5 matches only the three remaining failure causes". S5's trigger cell is correspondingly narrowed to `reason ∈ {broker_unreachable, rate_limited, adapter_fault}`. Re-checked exhaustively: all six `reason` values and the S7-vs-S8 `last_attempt_outcome` overlap now map to exactly one render. |
| **I-3** | **FIXED** | Every "this session" is gone. S7 trigger: "if the response carries a served snapshot (`state ∈ {ok, empty}`)"; S8 the same; S7 copy adds "The conditional keys off the wire, never off client memory: a served book survives a page reload within a server process." AC-12 restated to match ("If the response carries a served snapshot (`state ∈ {ok, empty}` — the server retains the last good book within a process lifetime)"). Now matches R3-architect's server-process retention scope. |
| **I-4** | **FIXED** | Carve-out restored in both places it must live: AC-7 ("The ban covers trader-visible rendered strings only: internal names, routes, and testids may keep `live` for continuity (decisions.md label ruling)") and §7's forbidden-word scan ("it must not trip on module names or source identifiers"). |
| **I-5** | **FIXED** | AC-6a is split into a **Test arm** ("the tab renders every position present in the captured payload, unaltered, count never understating — assertions bind to the captured fixtures") and a **Review arm** ("one-time, owner … no automated test can observe the Webull app"), with `Verify by: test + review`. §7's reviewed list names it: "the one-time AC-6a review arm: the owner's app-vs-tab comparison against the Webull app". |
| **I-6** | **FIXED** | IC §2's `account_ref` row now reads "string (opaque, **server-derived**) … **A server-generated non-reversible handle (e.g. a keyed hash) — NEVER the raw broker account number or any reversible encoding of it** (§8.1 classes account numbers as sensitive; opacity is a server obligation, not just a client treatment)", and the orphan-field half is closed by naming a consumer: "Consumer: SPEC AC-23 (cross-account isolation) asserts it is per-account and never another account's". |

### Minors — dispositions confirmed

**Folded (8):** M-1 SPEC §2 now reads "Sim and **Broker** share *render* capability" · M-2 Settings
copy now "The full keys are never shown again and never sent to this browser — only the last 4 of
the App Key remain as the hint" · M-3 IC §5's PUT row now carries both 200 shapes ("the success
shape is not the only 200") · M-4 flow 2 and S2's trigger both name `GET /api/broker/credential` →
`set: true` as how "credential stored" is client-known · M-5 §1 adds "Signed-out is not a broker
state: it renders the shared `SignInPrompt` pattern — §5's auth carve-out row" · M-6 AC-11 now names
the S4 domain ("the as-of stamp — under a confirmed-empty book, the check stamp") · M-7 IC
conformance prose adds "**Never run this block with `--auth-cookie` against a credentialed
session**" · M-8 §4 now says "request/response REST (fetched, not pushed)".

**Declined (1):** **M-9** — recorded in the SPEC's new "Appendix — S2 minors: declined" with the
reason "the resolution already lives in the contracts … S2-findings.md M-9 is the durable record
that it was answered, not dropped." Accepted: M-9 was filed as advisory-only ("there is no gap,
only an undocumented resolution"), and the appendix is the documentation it asked for.

### New defects introduced by the amendment

**None at Critical severity.** Checked the amended surface specifically: the two-axis rule and its
four-combination table are internally consistent with S6, §5's SSE-drop row and the component grid;
the narrowed S5 trigger plus the precedence block leave no `reason`/`last_attempt_outcome` tuple
unrendered and none double-matched; the new dual-basis label introduces no forbidden word; AC-23 is
externally observable and covered by a named §7 test; the conformance JSON block is byte-unchanged
and still valid, environment-independent, and correctly `--auth-signup`-scoped.
