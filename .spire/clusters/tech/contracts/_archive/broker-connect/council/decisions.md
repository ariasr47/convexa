# R3 decisions — broker-connect (council reconcile log)

> Every R2 conflict + cross-lane ask, with its resolution and who settled it. The R4 synthesizer
> folds these as BINDING over the R1 positions wherever they diverge.

## C1 (a/b/c) — the phantom `refresh_seconds` cadence — RESOLVED by three-way convergence (technical)
Raised independently by architect, PM, and UX (against UX's own R1 copy — UX self-flagged it).
**Resolution:** v1 is on-demand fetch + short server TTL cache + explicit user refresh; NO cadence
field, NO scheduled-refresh copy. The envelope carries `as_of` + `basis (fresh|cache)` +
server-declared `stale_after_seconds`. Header copy: "Webull · read-only · as of {time} · read on
demand — a snapshot, never live." S6 stales off age-vs-threshold; S7 drops "this cycle" for "on the
last attempt". The cadence field + scheduled copy return together only with the named v2 poller seam.

## C2 — AC-6 pre-capture multi-leg promise — RESOLVED (technical; architect→PM, PM ACCEPTED)
AC-6 split per R3-pm.md (final AC text there is binding): **AC-6a** unconditional (every reported
holding appears; symbols/quantities match; count never understates; nothing merged away or altered).
**AC-6b** conditional on payload capture (grouping identity present ⇒ one position with legs; flat
payload ⇒ honest per-contract rows, NEVER heuristic composition; the grouped-rendering fallback is a
named post-capture OWNER decision, recorded, not defaulted).

## C3 — ship-vs-hold on approval lag — MOOT IN FACT (product; overtaken by events)
The owner already holds approved Webull Individual API keys (2026-08-01), so payload capture cannot
lag the build. Escape hatch preserved: if capture somehow fails at GATE Q, the conductor presents the
owner an explicit either/or (ship with AC-6a deferred to a named runtime follow-up vs hold GATE S);
neither lane pre-decides.

## C4 — AC-8 refresh honesty — RESOLVED (technical; UX→PM, PM ACCEPTED + ruled semantics)
**Manual refresh has FORCE-FETCH semantics**: always requests a fresh broker read; the server may
throttle (the throttle protects the owner's own rate limits and is not the user's to bypass); a
throttled/failed attempt is visibly explained — never a silent no-op. Final AC-8 text in R3-pm.md is
binding. Wire truth backing it: `last_attempt_at` moves only on real attempts (see C5).

## C5 — degraded vs stale on the envelope — RESOLVED (technical; UX→architect, architect ACCEPTED + amended)
Additive `BrokerBook` fields `last_attempt_at` + `last_attempt_outcome`, with ONE shared closed
failure-cause set feeding both `last_attempt_outcome` and `unknown.reason` so they never drift:
`broker_unreachable | rate_limited | credential_rejected | credential_unreadable | adapter_fault`
(architect added `credential_unreadable` — a server-side decrypt-fail must never render as "Webull
rejected your key"). Attempt semantics: an attempt = actual broker contact (or pre-contact
credential_unreadable); cache-serve/throttle is NOT an attempt. Cache retention: TTL bounds
serve-without-attempting only, NOT eviction — last good book survives failed attempts within a
process lifetime; S7/S8 "last-known book stays below" copy is conditional on a confirmed book.
Final envelope field table in R3-architect.md is binding. Derived render predicates (never wire
fields): degraded := last_attempt_outcome ≠ ok; stale := now − as_of > stale_after_seconds.

## Label ruling — the trader-visible tab reads "Broker", not "Live" (UX raised; PM assented in R2)
Polled/fetched data may not sit under a "Live" label (the scanner poll-honesty precedent). Internal
names/routes/testids may keep `live` for continuity; the ban is on what the trader reads. Owner may
veto at any gate — reversible copy.

## Stale datum ruling (architect, answering PM's ask)
`stale_after_seconds`: server-owned, TTL-derived, rides every served snapshot. Stale is a
client-derived time-varying predicate. Explicitly rejected: a wire `stale` boolean (freezes at serve
time); an FE-invented threshold; no-stale-at-all.

## `unknown` reason vocabulary (architect, answering UX's ask) — CONFIRMED closed set of six
`no_credential_stored | credential_unreadable | credential_rejected | broker_unreachable |
rate_limited | adapter_fault`. `credential_rejected` is its own value with its own render (S8:
warning + Reconnect CTA), wherever it appears.

## P/L on broker rows — OWNER RULING (product, 2026-08-01): DYNAMIC, Convexa-modeled, real-time
The owner chose option B over the conductor's A recommendation, explicitly and informed (static-vs-
dynamic consequence laid out first). **Binding shape:**
1. Broker legs flow through the EXISTING FE mark-ladder valuation (the sim book's engine) via the
   PositionView projection — P/L on broker rows updates live off the SSE feed while the page is open.
2. The figure is **basis-labeled as Convexa-modeled** everywhere it renders
   (`[model-read-carries-its-assumptions]`): it is our model's live opinion of a real position,
   never presentable as the broker's fact and never implying Webull reported it.
3. If payload capture shows Webull supplies its own unrealized P/L, the adapter carries it VERBATIM
   as the additive tri-state field (R3-architect.md §P/L, technical half) and it may render as the
   static broker-reported reference beside the modeled read — two numbers, two named bases, never
   blended. Display details are UX's within this ruling.
4. Degradation inherits the sim book's rules (`[live-vs-static-isolation]`): SSE drop ⇒ modeled P/L
   dims to last-known (⏸), never blanks, never freezes silently as if current; the broker snapshot
   fields (quantities, as_of) are static reads and stay rendered.
5. The architect's non-goal stands: no P&L RECONSTRUCTION from transaction history; the model input
   is the mark ladder only, exactly as for sim rows.

## S2 loop 1 — Critical C-1 resolution (controller ruling under the owner's standing P/L decision)
The P/L ruling item 4 covered the SSE-drop axis only. **The two degradation axes are INDEPENDENT and
both named** (this is `[live-vs-static-isolation]` applied twice, not a new rule):
- **Market-data axis (SSE):** governs the MODELED P/L figure. Live ⇒ ticks; SSE drop ⇒ dims to
  last-known (⏸) exactly as sim rows do. (Unchanged.)
- **Book-snapshot axis (broker `as_of` vs `stale_after_seconds`):** governs the POSITION-SET fields
  (legs, quantities, broker-reported statics). Stale snapshot ⇒ the stale treatment on those fields
  and the S6 banner; the fields never look refreshed (AC-11's true scope).
**When the snapshot is stale but SSE is live, the modeled P/L KEEPS TICKING** — the owner ruled
dynamic — but its basis label must carry the book basis explicitly: "modeled live on your book as of
{time}". A ticking figure over a stale book is legal ONLY with that named dual basis; AC-11 is
scoped to snapshot fields, AC-21 to the model figure, and the §4 grid gains separate columns for the
two axes (all four combinations defined). Owner may veto (reversible; recorded as controller ruling
2026-08-01, derived from the owner's "dynamic real-time" decision).

## S2 loop 1 — Major dispositions (binding for the R4 amendment pass)
I-1 drop "live" from the tooltip copy (e.g. "our model's current read — recomputed as prices move");
the positive-"live" ban has no modeled-P/L exception. · I-2 state the S8-wins precedence rule
(`credential_rejected`/`credential_unreadable` render S8 wherever they appear; the lookup must be a
function). · I-3 rewrite the last-known conditional to the SERVER retention scope (a confirmed book
survives reload within a process; copy keys off the wire, not client memory). · I-4 restore the
internal-names carve-out (routes/testids/module names may keep `live`; the §7 scan targets
trader-visible strings only). · I-5 AC-6a's testable arm asserts tab-vs-captured-payload fidelity;
the Webull-app comparison is the human verification note, not the test. · I-6 `account_ref` gains a
rule: masked/opaque server-derived identifier, NEVER the raw account number, and either a consumer
(S2/S8 copy may name the account) or removal. Minors: fold where cheap, list any deliberately
declined in a SPEC appendix note.

## Owner addition (2026-08-01, during S2 loop 1) — cross-account isolation as an EXPLICIT AC
The owner asked, verbatim concern: other people must not see what they own. Already structural
(per-user credential resolution, server-gated endpoints, no durable book storage, no logging of
positions, opaque `account_ref`) — but it becomes an EXPLICIT acceptance criterion, not an
implication: **a second, different signed-in account requesting the broker surfaces receives ONLY
its own state (`unknown / no_credential_stored` on a fresh account) — never any field of another
account's book, cache, credential hint, or account_ref; and an anonymous request receives the
gate's 401/403, never data.** Test it with two real accounts. The system-6 review re-verifies the
same boundary adversarially (session fixation, cache key collision, log egress).

## Standing product context folded from R2 agrees (not conflicts, but binding for R4)
- No durable client store gains broker data in v1; server cache invalidated on credential delete
  (AC-3 verifiable; `loss-free-durable-migration` satisfied by migrating nothing durable).
- The outcome ledger counts SIM outcomes only in v1 (PM ruling, flagged owner-contestable; broker
  rows have no DecisionRecord provenance).
- READ-ONLY renders as ABSENCE (no disabled/coming-soon order affordances); the port has no write
  method to disable.
- Credentials live in Settings (`#brokerage` anchor, byo-ai-key pattern); the Broker tab's empty
  state carries the discovery CTA deep-linking there.
- One fetch returns the whole book at owner scale; pagination never crosses the port.
- The fifth not-a-number literal `not provided` maps to the tri-state broker-fact pattern.
