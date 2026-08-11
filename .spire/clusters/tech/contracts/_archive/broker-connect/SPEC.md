# broker-connect — spec

**Source brief:** .spire/clusters/tech/contracts/broker-connect/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 resolutions · decisions.md   (under council/)
**Status:** draft

## 1. Goal + scope

Convexa reads the OWNER's real Webull brokerage positions — read-only, absolutely — into the
Positions page's second tab (trader-visible label: **Broker**), behind a new **`PositionsProvider`
port** mirroring the `MarketDataProvider` port pattern. Adapter #1 is **Webull-direct via the
owner's own Individual OpenAPI keys** (BYO-credential, the byo-ai-key precedent; the owner already
holds approved keys as of 2026-08-01). The job-to-be-done: stop hand-mirroring the real book into
the sim book — hold/trim/exit/roll decisions and the reassessment/AI read finally run against the
risk actually carried, with an honest as-of stamp. Phase-1 user is the owner: one user, one Webull
account; every convenience-vs-safety trade goes to safety.

**In scope:**
- Connect / rotate / delete a single Webull credential (App Key + App Secret as ONE logical
  record) in Settings, signed-in only, server-enforced; write-only with masked hint — the
  byo-ai-key shape reused deliberately (Settings section "Brokerage", `#brokerage` anchor).
- The Broker tab replaces the zero-import LOCKED placeholder with the owner's actual Webull
  positions, read-only, rendered through the leg-first book model via the `PositionView`
  projection seam.
- On-open fetch + on-demand manual refresh (force-fetch semantics, server-throttleable). **No
  cadence, no background poller, no streaming in v1** — the envelope carries `as_of` + `basis` +
  server-declared `stale_after_seconds`; staleness is derived from age, never from a cadence
  (council C1, resolved by three-way convergence).
- The full closed set of Broker-tab states (§4): never-connected · first-sync ·
  populated · confirmed-empty · unknown · stale · degraded · reauth-required · first-load skeleton.
  (Signed-out is not a broker state: it renders the shared `SignInPrompt` pattern — §5's auth
  carve-out row — before any broker state is reachable.)
- **Dynamic Convexa-modeled real-time P/L on broker rows** (OWNER RULING 2026-08-01): broker legs
  flow through the existing FE mark-ladder valuation via `PositionView`; the figure is
  basis-labeled as Convexa-modeled everywhere it renders. If payload capture shows Webull supplies
  its own unrealized P/L, the adapter carries it verbatim (tri-state) and it may render as a
  static broker-reported reference beside the modeled read — two numbers, two named bases, never
  blended.
- Reassessment referencing a real holding — request-building and export only, carrying the real
  position's as-of basis. Advisory display; no Accept-into-store for a real position.
- Honest partial representation: unrepresentable positions render as explicit
  cannot-fully-display entries; facts the broker does not supply render the not-a-number
  vocabulary, extended with the fifth literal **`not provided`** (mapped from the tri-state
  broker-fact pattern).
- system-6 security review scoped and fired (§8.1) — first real-account connection.

**Out of scope:**
- **Any order/execution/write path to the broker.** Not "no functional order button" — no
  affordance at all: no disabled buttons, no greyed Close, no "coming soon" trade item, no copy
  implying an order path exists. The port has no write method to disable (§2).
- Any mutation of the sim book by real data; no import/merge/convert of real rows into sim
  positions.
- Real-book outcomes in the outcome ledger — **the ledger counts SIM outcomes only in v1** (PM
  ruling, flagged owner-contestable in §9; broker rows have no DecisionRecord provenance).
- Real positions as a scoring input — never (permanent, not phase-1).
- Multi-broker, multi-user, SnapTrade build, OAuth flows (designed-for at the port, zero code).
- Transaction history, cash balances, P&L *reconstruction* from history (carrying a
  broker-supplied P/L fact verbatim is IN, per the owner ruling; computing one from history is
  OUT).
- Durable persistence of the broker book, client or server — no `convexa.*` key gains broker
  data; server side is a short TTL process-local cache only, invalidated on credential delete.
- Any new entry surface (the narrowed `[single-shared-sim-entry-dialog]` rules: nothing on this
  surface opens or references `TradeEntryDialog` in any mode).
- Onboarding/help for obtaining Webull keys beyond a one-line pointer.

**Future (deliberately deferred):**
- SnapTrade adapter → external users, OAuth, multi-broker (the NAMED later adapter).
- Background cadence poller / any push channel — a named v2 seam; the cadence wire field and the
  scheduled-refresh copy return **together** with it.
- Real-book outcome attribution in the ledger (needs an entry-provenance story first).
- Accept-mapping / decision recording against real positions.
- Any real-money surface — GATE-Z reopening + a structurally separate component.
- Last-known-book-across-restart / broker history store — a new deliberately designed store,
  not scope creep here.

## 2. Architecture

The full FE↔BE surface (endpoints, envelope, record shapes, vocabularies) lives in
`INTERFACE_CONTRACT.md` and is not restated here — this section names the module shape only.

**The port.** A new backend subpackage (structural sibling of `src/auth/`, `src/marketdata/`,
`src/scanstore/`): a **`PositionsProvider` ABC** with exactly two methods — `fetch_book(credential,
account_ref) -> BrokerBook` (one call returns the entire snapshot; the adapter absorbs vendor
paging; pagination never crosses the port) and `describe() -> ProviderCapabilities` (static
capability facts; how SnapTrade's different capability set arrives later without a port change).
**There is NO write method — nonexistent, not unused.** No `place_order`, no `cancel`, no generic
`execute(...)`: `[no-real-order-path]` is enforced by the port's type surface. An env-selected
factory (`POSITIONS_PROVIDER`, the `get_provider()`/`ACCOUNT_STORE` precedent) picks `webull`
today, `snaptrade` later, plus a stub adapter for keyless verification.

**Credential is an argument, not a dependency.** The port takes an in-memory credential value
object resolved per-request at the `main.py` orchestration boundary; the broker leaf never imports
the auth subpackage or any store (byo-ai-key's per-request resolution precedent). Storage extends
the existing **`UserCredentialStore` port with a credential-kind discriminator** — one store,
never a fork — Fernet via the existing `src/auth/crypto.py`, ciphertext-only persistence, crypto
boundary before the store, plaintext in request-scope memory only.

**Records defined against OUR leg-first model, not Webull's payload** — the load-bearing
insulation for the open payload question: a payload surprise is an adapter mapping problem, never
a port reopening. `BrokerLeg` (closed kind, signed quantity, explicit per-leg multiplier,
tri-state broker facts), `BrokerPosition` (stable broker id + mapping-fidelity marker
`exact|partial|unrecognized` — a book that silently drops an unparseable position is a fabricated
claim about risk carried), `BrokerBook` (the envelope; closed `state` enum `ok|empty|unknown` is
the sole disambiguator — both `empty` and `unknown` carry `positions: []`, so no consumer may
branch on length). **No strategy/structure field anywhere on the wire**: grouping into spreads is
the FE recogniser's job (`StructureKind` derived, never stored — one authority, not two).

**Import rules (structural, both directions):** `engine`/`signals`/`live`/`darkpool`/bundle/SSE
never import the broker leaf; the leaf never imports scoring anything — real positions are
structurally incapable of reaching score/tier/`state_fingerprint`. The Webull **SDK is imported by
the Webull adapter only**, and only its account/positions/quote read subset, never trade/order
modules — pinned by a source-scan violation test, not prose. **Frontend:** the Broker tab's data
module is import-isolated from the sim positions store — it never reads or writes
`convexa.positions.v3` or any `convexa.*` durable key. Sim and Broker share *render* capability only
through the **`PositionView` projection** (the §7x seam); `BrokerPosition` is a NEW type beside
the sim book.

**Refresh model (C1, binding):** v1 is on-demand fetch + a short server-side TTL process-local
cache + explicit user refresh with **force-fetch semantics** (C4): a refresh always requests a
fresh broker read; the server may throttle (the throttle protects the owner's own rate limits and
is not the user's to bypass); a throttled or failed refresh is visibly explained, never a silent
no-op. An *attempt* = actual broker contact (or pre-contact `credential_unreadable`);
cache-serve/throttle is NOT an attempt — `last_attempt_at` moves only on real attempts, which is
how the consumer distinguishes "server chose not to ask" from "server asked and failed" (C5). TTL
bounds serve-without-attempting only, not eviction: the last good book survives failed attempts
within a process lifetime; the cache is dropped on restart or credential delete. Nothing
broker-derived EVER rides the SSE payload.

**Where the modeled P/L lives (owner ruling):** broker legs project through `PositionView` into
the existing `features/trading/model/mark.ts` mark-ladder valuation — the sim book's engine, no
new math, no P&L reconstruction. The broker snapshot fields (quantities, as_of) are static reads;
only the modeled P/L is live-derived.

**Failure modes + isolation:** a broker failure of any kind degrades the Broker tab ONLY — bundle,
SSE, sim book, scoring, Ticker page byte-identical (one-way leaf makes it structural). Within the
broker surface, the auth carve-out applies: auth-gate refusals are real 401/403, but a broker-side
failure (outage, rate limit, bad payload, decrypt-fail) is a **typed `unknown` state or
`last_attempt_*` failure inside a 200**, never a 5xx — adapter/mapping exceptions are caught at
the surface boundary. A decrypt failure is no-usable-credential (`credential_unreadable`), never a
leak, and must never render as "Webull rejected your key". Credential delete invalidates the
server cache — a deleted credential never leaves a ghost book. Nothing here is ever partially
applied: a credential write is both halves (App Key + Secret) or nothing.

**Not buildable / rejected approaches (do not re-propose):**
- A `refresh_seconds` cadence wire field + scheduled-refresh copy (C1 — no scheduler backs it;
  returns only with the v2 poller).
- A wire `stale` boolean (freezes at serve time); an FE-invented staleness threshold (FE hardcoding
  a server-owned policy); no-stale-at-all (S6 needs the server's trip point). The server-declared
  `stale_after_seconds` riding the envelope is the one accepted shape.
- Heuristic composition of flat broker rows into multi-leg positions (C2 — the same fabrication
  class as flattening; grouping requires a payload grouping identity, else honest per-contract
  rows).
- A durable broker store (client or server), background poller, MQTT/streaming, broker data on SSE.
- Reusing the sim row component with write affordances propped off; a second credential form on the
  Positions page; a second credential store.
- Widening `SimPosition` or writing broker rows into the sim store "to reuse" anything.

## 3. Acceptance criteria (with user stories)

Final AC texts for AC-6a/6b and AC-8 are the binding R3 texts (AC-6a's verification split and the
AC-11/21 two-axis scoping are S2 loop 1 amendments, binding over R3 per decisions.md). Verification
is risk-based (qa-verify §4): `test` where silent regression is plausible; `review` for visible
intentional states. AC-21/22 realize the owner's P/L ruling (decisions.md, 2026-08-01); AC-23 is
the owner's cross-account isolation addition (S2 loop 1, 2026-08-01).

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1 As the owner I want to connect my Webull keys so Convexa can read my book | Signed in, the owner saves a Webull App Key + Secret in Settings; afterwards the UI shows only a masked hint (last-4 of the App Key). The full secret is never displayed again on any surface. | review |
| 2 | S1 | Rotate: saving a replacement credential updates the masked hint, and subsequent real-book fetches use the new credential (observable: fetches succeed after rotating from a dead key to a good one). | review |
| 3 | S6 As the owner I want to disconnect cleanly | Delete/disconnect returns the Broker tab to not-connected, and no real-position data remains visible anywhere in the app afterwards (server cache invalidated on delete). | test |
| 4 | S1 | Logged out (or with the client check bypassed), every broker surface — credential save, rotate, delete, real-book read, refresh — is refused server-side. | test |
| 5 | S1 | After save, the plaintext secret appears in no server response, no page source, no browser storage, and no log line; a server decrypt failure presents as "no usable credential", never as leaked content and never as a Webull rejection. | test |
| 6a | S2 As the owner I want to see my real book | *(unconditional)* With a connected broker and a non-empty Webull book, the Broker tab lists every position the broker reports — no reported holding absent, merged away, or altered, and any position count shown never understating the broker's book. **Test arm:** the tab renders every position present in the captured payload, unaltered, count never understating (assertions bind to the captured fixtures). **Review arm (one-time, owner):** symbols and quantities on the tab match what the Webull app shows — a human app-vs-tab comparison, named in §7's reviewed list; no automated test can observe the Webull app. | test + review |
| 6b | S2 | *(conditional on payload capture)* If the captured Webull payload carries a grouping identity for multi-leg options positions, the tab renders each such position as one position with its legs, not N unrelated rows. If the payload is flat with no grouping identity, the tab renders the per-contract rows honestly as separate contract rows — it never composes legs into a strategy by heuristic — and the grouped-rendering fallback goes to the owner as a named post-capture product decision (recorded, not defaulted). | test |
| 7 | S3 As-of honesty | Every Broker-tab render carries a visible as-of stamp and its read basis (on-demand snapshot). The trader-visible tab label reads "Broker"; the word "live" never appears on this surface as a freshness claim or descriptor (negation-only allowance in the header honesty line). The ban covers trader-visible rendered strings only: internal names, routes, and testids may keep `live` for continuity (decisions.md label ruling). | test |
| 8 | S3 | A manual refresh affordance exists and always requests a fresh broker read. On a successful fresh fetch, the as-of stamp advances. If no fresh read happens (server throttle, broker unreachable), the tab visibly states that the shown snapshot is unchanged and why — a cache-served or failed refresh is never a silent no-op, and the affordance never claims freshness the fetch did not deliver. | review |
| 9 | S5 Trust the failure modes | Not connected: the Broker tab shows an explicit not-connected state pointing to Settings — never an empty table that could read as an empty book. | review |
| 10 | S5 | Unknown vs empty: before any successful fetch (or when a fetch fails with nothing known) the tab shows a "not read / unavailable" state; a confirmed-empty broker book shows a "checked — no positions held" state. The two are textually and visually distinct, driven by the closed wire `state` enum via closed lookup — never derived from `positions.length` — and neither can be produced by the other's condition. | test |
| 11 | S3 | Stale (book-snapshot axis — scoped to broker-supplied snapshot fields): when the snapshot's age exceeds the server-declared `stale_after_seconds`, the position-set fields (legs, quantities, broker-reported facts, and the as-of stamp — under a confirmed-empty book, the check stamp) keep their last-known values, visibly marked stale with their timestamp — never blanked, never silently refreshed-looking. This AC governs snapshot fields only; the Convexa-modeled P/L figure is governed by the market-data axis (AC-21, §4 two-axis rule). Staleness derives from as-of age vs the server threshold, never from a cadence. | test |
| 12 | S5 | Broker outage/rate-limit: the failure degrades the Broker tab ONLY. In the same session, the Ticker page, SSE stream, sim tab, and scanner behave identically to a no-broker session. If the response carries a served snapshot (`state ∈ {ok, empty}` — the server retains the last good book within a process lifetime) it stays visible under an honest degraded banner (driven by `last_attempt_outcome`); if not (`state: unknown`), AC-10's unknown state shows. | test |
| 13 | S5 | Credential revoked/expired/invalid (`credential_rejected`): a distinct warning state naming the cause and pointing at rotate-in-Settings — distinguishable from AC-12's outage state and from a server-side `credential_unreadable` fault (which is presented as ours, not Webull's). | test |
| 14 | S2 | Unrepresentable position: a broker position the book model cannot faithfully render appears as an explicit cannot-fully-display entry. The tab never silently drops a position (a count shown never understates the book) and never flattens one into a plausible-looking wrong position. Missing broker-supplied facts render the not-a-number vocabulary (`not provided` for facts the feed never carried), never 0/blank. | test |
| 15 | Read-only absolutism | The Broker tab exposes zero order/trade/close/modify affordances — including disabled or "coming soon" ones — and no copy implying an order path exists or is planned on this surface. Nothing on this surface opens or references `TradeEntryDialog`. | test |
| 16 | Read-only absolutism | No flow exists that creates or alters a sim position from a real row. The sim tab's contents and the outcome ledger's every number are identical before and after connecting a broker (including one with closed positions in its history). | test |
| 17 | Isolation | A served bundle's score / tier / `state_fingerprint` are byte-identical with and without a connected broker (same ticker, broker connected vs credential deleted). | test |
| 18 | S4 Reassess the real thing | With a real holding present, a reassessment request can reference it, and the request/export visibly carries the real position's as-of basis — the AI is never handed a real position without its staleness disclosed. | review |
| 19 | S4 | A reassessment verdict on a real position offers no Accept-into-store or any other write action — advisory display only; the sim reassessment Accept flow is byte-identical to before this feature. | test |
| 20 | Honesty while waiting | The app fabricates nothing: no sample/demo positions presented as real anywhere; a connect attempt with a bad/unapproved key lands in AC-13's rejected state, not a hang or a fake success. | review |
| 21 | S2 P/L (owner ruling) | Broker rows show a Convexa-modeled P/L computed by the existing mark ladder, basis-labeled as Convexa-modeled everywhere it renders — never presentable as the broker's fact. The figure is governed by the market-data axis only (§4 two-axis rule): while the mark feed is up it updates as marks move; on an SSE drop it dims to last-known (⏸), never blanks, never freezes silently as if current. When the snapshot is stale while the mark feed is up, the figure keeps updating and its label names BOTH bases — model read and book as-of (`modeled now · on your book as of {time}`); a ticking figure over a stale book never renders with a single-basis label. The broker snapshot fields (quantities, as-of) stay rendered, governed solely by the book-snapshot axis (AC-11). | test |
| 22 | S2 P/L | *(conditional on payload capture)* If Webull supplies its own unrealized P/L, it is carried verbatim (never computed, never blended) and may render as a static broker-reported reference beside the modeled read — two numbers, two named bases. A dollar figure with an unnamed basis never ships. | review |
| 23 | Isolation (owner addition, S2 loop 1) | Cross-account isolation: a second, different signed-in account requesting the broker surfaces receives ONLY its own state (`unknown` / `no_credential_stored` on a fresh account) — never any field of another account's book, cache, credential hint (`last4`), or `account_ref`; an anonymous request receives the gate's 401/403, never data. Verified with two real accounts; the system-6 review (§8.1) re-verifies the same boundary adversarially (session fixation, cache key collision, log egress). | test |

## 4. UI + interaction

**Flows:**
1. **Connect:** Broker tab S1 empty state → CTA `Connect Webull` → deep-link Settings `#brokerage`
   → write-only App Key + Secret form → save → masked hint → back to Positions → first fetch (S2)
   → S3/S4.
2. **Read/refresh:** open the Broker tab → credential hint check (`GET /api/broker/credential` —
   how S2's "credential stored" is client-known) → on-open fetch (or cache-serve within TTL) → provenance
   header + read-only rows → manual `Refresh` → force-fetch → stamp advances, or an honest
   unchanged-and-why note.
3. **Reassess:** broker row → `Build reassessment` → the existing FE-assembled reassessment
   request referencing the real holding, as-of basis carried in → advisory verdict display only.
4. **Rotate / disconnect:** Settings `#brokerage` → `Replace keys` (overwrites) or `Disconnect`
   (inline confirm) → Broker tab returns to S1; no residual data.

**Render-state machine** — a closed lookup keyed on the wire (`state`, `reason`,
`last_attempt_outcome`, age vs `stale_after_seconds`), never on `positions.length`:

| # | State | Trigger (wire-visible) | Surface |
|---|-------|------------------------|---------|
| S1 | never_connected | `state: unknown`, `reason: no_credential_stored` | Full-tab designed empty state with connect CTA (replaces the LOCKED placeholder) |
| S2 | pending_first_sync | credential stored (client-known via `GET /api/broker/credential` → `set: true`), first fetch in flight | Skeleton rows + "Reading your Webull book for the first time…" — no numbers, no zero-count |
| S3 | ok | `state: ok` | Provenance header + read-only positions list |
| S4 | empty_confirmed | `state: empty` | Distinct confirmed-empty state with its check timestamp |
| S5 | unknown | `state: unknown`, `reason ∈ {broker_unreachable, rate_limited, adapter_fault}` | "We don't know" state — must never render as S4 |
| S6 | stale (modifier on S3/S4) | `now − as_of > stale_after_seconds` (client-derived, time-varying) | Snapshot fields stay rendered with the stale treatment, stamp foregrounds the age; the modeled P/L follows the market-data axis (two-axis rule below) |
| S7 | degraded | `last_attempt_outcome ≠ ok` while a snapshot serves | Tab-scoped info banner over last-known rows if the response carries a served snapshot (`state ∈ {ok, empty}`); else S5 copy — sim tab, bundle, SSE untouched |
| S8 | reauth_required | `credential_rejected` (as `reason` or `last_attempt_outcome`) | Warning-class banner + Reconnect CTA; last-known book stays below with its stamp *if the response carries a served snapshot (`state ∈ {ok, empty}`)* |
| S9 | first-load skeleton | tab mounted, state not yet known | Skeleton — visually distinct from S7 (cold-load ≠ offline-degrade ≠ unavailable) |

**Precedence (the lookup is a function, I-2):** `credential_rejected` → S8 and
`credential_unreadable` → its own warning-class render take precedence wherever they appear (as
`reason` or as `last_attempt_outcome`); S5 matches only the three remaining failure causes
(`broker_unreachable | rate_limited | adapter_fault`). No wire tuple matches two renders.

`credential_unreadable` renders warning-class with a `Replace keys in Settings` CTA and copy naming
the fault as Convexa's — never S8's "Webull stopped accepting" copy. S4-vs-S5 is
`[absent-is-not-none]` carried to the render: asserting an empty book nobody confirmed is a
fabricated claim about real money. S6/S7/S8 are not one "error state" — stale = the picture is old;
degraded = the last attempt failed; reauth = the credential is dead and the trader has a specific
action.

**Two degradation axes (C-1 controller ruling, binding — `[live-vs-static-isolation]` applied
twice, not a new rule).** Broker data is request/response REST (fetched, not pushed),
static-family; the Convexa-modeled P/L is mark-ladder-derived off the market feed. The two axes
are INDEPENDENT and both named:
- **Market-data axis (SSE):** governs the Convexa-modeled P/L figure ONLY. Feed up ⇒ the figure
  updates as marks move; SSE drop ⇒ it dims to last-known (⏸), never blanks — exactly the sim
  book's rule.
- **Book-snapshot axis (`now − as_of` vs `stale_after_seconds`):** governs the position-set fields
  ONLY (legs, quantities, broker-reported statics, the as-of stamp). Stale ⇒ the S6 treatment on
  those fields; they never look refreshed.

All four combinations, defined:

| Mark feed (SSE) | Snapshot | Render |
|---|---|---|
| up | fresh | Modeled P/L updates, labeled `Convexa-modeled`; snapshot fields normal |
| up | stale | Modeled P/L KEEPS updating, labeled with the dual basis `modeled now · on your book as of {time}` — never a single-basis label; snapshot fields get the S6 stale treatment |
| down | fresh | Modeled P/L dims ⏸ last-known, never blanks; snapshot fields normal |
| down | stale | Modeled P/L dims ⏸ last-known; snapshot fields get the S6 stale treatment |

**Component states** (template grid; the S-machine above governs):

| Component | default | loading | empty | error | snapshot stale (S6) | SSE drop |
|---|---|---|---|---|---|---|
| Broker tab | S3 rows + provenance header | S9 / S2 skeletons | S1 (no credential) / S4 (confirmed empty) | S5 unknown · S7 degraded banner · S8 reauth | S6 stale treatment on snapshot fields, age foregrounded | only the modeled P/L dims ⏸; all else untouched |
| Provenance header | Webull badge · as-of stamp · on-demand note | — (skeleton line) | present on S4 with check time | stays over S7/S8 banners | stamp foregrounds age | unaffected |
| Broker row | legs, quantities, modeled P/L (basis-labeled) | skeleton | — | fidelity `partial`/`unrecognized` → cannot-fully-display entry | snapshot facts stale-marked; modeled P/L per market-data axis (dual-basis label while the feed is up) | modeled P/L dims ⏸; snapshot facts stay |
| Settings "Brokerage" | masked hint `Webull · key ····{last4}` + Replace/Disconnect | saving spinner on the button | write-only two-field form | save/remove errors never echo any key fragment; storage-unavailable → contained info-note | — | — |

**Copy (exact strings; binding intent, wordsmithing open):**

- Provenance header: **`Webull · read-only · as of {time} · read on demand — a snapshot, never
  live.`** Stamp tooltip: `Your Webull positions are read when you open or refresh this tab, not
  streamed. This is the book as Webull reported it at this time — prices can have moved since.`
- S1 heading `Connect your brokerage`; body `Convexa can read your Webull positions with your own
  API keys — so decisions run against the book you actually hold, not a hand-copied one.
  Read-only, absolutely: Convexa never places, changes, or cancels an order.`; CTA `Connect
  Webull` (→ Settings `#brokerage`); sub-line `Keys are saved encrypted and never shown again. You
  can disconnect any time.`
- S2: `Reading your Webull book for the first time…`
- S4: `Webull reports no open positions.` + `Checked at {time}. This is a confirmed read — not a
  guess.`
- S5: `Convexa hasn't been able to read your Webull book yet. It won't show you an empty book it
  hasn't confirmed.` + `Try again`.
- S6 appended stamp clause: `as of {time} · {age} old — refresh for a current read.`
- S7 banner: `Couldn't reach Webull just now — showing your book as of {time}. Everything else in
  Convexa is unaffected.` (No served snapshot in the response — `state: unknown` — → body falls
  through to S5 copy. The conditional keys off the wire, never off client memory: a served book
  survives a page reload within a server process.)
- S8 banner: `Webull stopped accepting the saved key. Reconnect in Settings to resume reading your
  book` + (only when the response carries a served snapshot, `state ∈ {ok, empty}`) ` — your last
  confirmed book (as of {time}) stays below.` CTA `Reconnect in Settings`.
- `credential_unreadable`: `Convexa couldn't read your saved keys — a fault on our side, not
  Webull's. Replace them in Settings to resume.`
- Refresh throttled/cache-served: `Unchanged — still your book as of {time}. Webull wasn't asked
  again just now (protecting your rate limits).`
- `Custom` structure tip on a broker row: `Convexa doesn't have a name for this leg shape, so it
  shows the legs as Webull holds them. Nothing is wrong with the position — a name is a
  convenience, not a verdict.` No confidence measures, no "probably a condor", ever.
- Fifth not-a-number literal **`not provided`**, tip: `Webull's data for this position doesn't
  include this detail. Convexa won't guess it — nothing is missing from your account, only from
  the feed.` (Distinct from `not recorded`, which is about our own saved records; a tri-state
  `unparseable` fact renders the shipped `unavailable` family.)
- Modeled P/L tip: the existing mark-ladder basis copy plus the label `Convexa-modeled` — `our
  model's current read on this position — recomputed as prices move; not a Webull figure`.
  Broker-reported reference (if supplied): `Webull's own unrealized P/L, as of the stamp above.`
- Dual-basis modeled P/L label (snapshot stale + mark feed up, C-1 ruling): **`modeled now · on
  your book as of {time}`** — the figure keeps updating but its label always names the stale book
  basis. Tip appends: `Prices are current; the position list is as Webull reported it at {time}.
  Refresh for a current read of the book.`
- Settings section: heading `Brokerage`; helper `Connect Webull with your own Individual OpenAPI
  keys. Convexa reads positions only — it never places, changes, or cancels an order.`; saved
  state `Webull · key ····{last4}` + `Saved encrypted. The full keys are never shown again and
  never sent to this browser — only the last 4 of the App Key remain as the hint.`; Disconnect confirm — title `Disconnect Webull?`, body `Convexa deletes your keys and
  stops reading your positions. Nothing changes at Webull — this only removes what Convexa
  stored.`, confirm `Disconnect` / cancel `Keep connection`.

**Design direction** (DESIGN_RULES front half; `[theme-token-discipline]` — no new tokens, zero
hex):
- **Brief pin.** Subject: the owner's actual Webull book, rendered as a stamped snapshot ledger.
  Audience: one trader who lives in dark broker terminals and distrusts dashboards that lie.
  Single job: show the risk actually carried, and exactly how old that picture is.
- **Structure.** A provenance header (broker badge · as-of stamp · on-demand note) over the same
  leg-first table/card grammar the sim book uses, minus every write affordance — *same book
  grammar, different provenance*, not a new product area.
- **Color:** existing ink/panel canvas; the `Webull · read-only` badge is a neutral steel-outline
  chip (not amber — brand-structural; not green/red — reserved for P/L direction); burnt orange +
  icon for S8/`credential_unreadable` warnings only. No fear styling: real positions are never
  tinted or badged for being real.
- **Type:** existing stack; the as-of timestamp and every figure in the mono data face with
  `tabular-nums`; no stat value in a heading element.
- **Signature:** **the ledger stamp** — the mono `as of` provenance block, the surface's one
  memorable element and its core honesty mechanism.
- **Rejected defaults:** pulsing "Connected" dot (claims streaming — the dot is the Ticker's SSE
  vocabulary); a `LIVE` badge (forbidden word); red/danger framing for real money; padlock
  iconography; a perpetual sync spinner. READ-ONLY renders as absence, not disabled controls.
- **Quality floor:** keyboard focus on CTA/Try again/Reconnect controls, 44px targets, ≥11px
  labels, no 393px overflow (reuse the shipped `<sm` card collapse), reduced-motion respected by
  inheritance (no new motion).

## 5. Error handling

| Failure class | Wire truth | User sees | Logged / retries |
|---|---|---|---|
| No credential stored | `state: unknown`, `reason: no_credential_stored` | S1 connect empty state | Nothing sensitive; no retry |
| Server decrypt-fail | `credential_unreadable` (reason or attempt outcome) | Warning + Replace-in-Settings, framed as our fault | Fault logged WITHOUT key material; treated as no-usable-credential, never a leak |
| Broker rejected credential | `credential_rejected` | S8 warning + Reconnect CTA; conditional last-known clause | No auto-retry storm; user-initiated only |
| Broker unreachable / rate-limited | `broker_unreachable` / `rate_limited` in `last_attempt_*` (cached book keeps serving) or `reason` (no cache) | S7 degraded banner over last-known rows, or S5 | Server-side throttle owns retry aggression; the client never retries against the broker |
| Adapter/mapping exception | caught at surface boundary → `adapter_fault` | S7/S5; per-position faults → fidelity `partial`/`unrecognized` cannot-fully-display entries | Logged without payload secrets; never a 5xx |
| Throttled manual refresh | `basis: cache`, `last_attempt_at` unmoved | Honest "unchanged and why" note (AC-8) | Not an attempt; no broker contact |
| Anonymous / bypassed client gate | real 401/403 from the server (auth carve-out) | `SignInPrompt` pattern | Server is the boundary of record |
| Credential-store unavailable | 200 `set:false, storage_available:false` (byo-ai-key shape) | Contained info-note, never error-red, never a dead-end | — |
| SSE drop (page-level) | n/a (broker data is not on SSE) | Only the modeled P/L dims to ⏸ last-known; snapshot fields, stamp, rows stay | Existing stream watchdog; broker surface unaffected |

A broker fault can never unmount the Positions page or touch a shared endpoint: the failure domain
is the Broker tab's payload only.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/broker-connect/INTERFACE_CONTRACT.md`
**Summary for readers of this spec:** five NEW endpoints, all signed-in + server-gated — three
credential endpoints (`GET/PUT/DELETE /api/broker/credential`, the byo-ai-key write-only/masked
shape) and two book endpoints (`GET /api/broker/book`, `POST /api/broker/book/refresh` with
force-fetch semantics), the latter two returning the `BrokerBook` envelope (closed `state` enum,
`as_of`/`basis`/`stale_after_seconds`, `last_attempt_at`/`last_attempt_outcome`, `BrokerPosition[]`
with tri-state broker facts). No existing endpoint changes; nothing rides SSE. The authoritative
field list, vocabularies, and conformance block live in that file — never here.

## 7. Testing strategy

Risk-based (qa-verify §4) — invariants and negative space are automated; visible intentional
presence/wording is reviewed once. Not one-test-per-AC.

**Automated (`test`) — the invariants that must never silently regress:**
- Unknown ≠ empty: the closed render lookup cannot produce S4 from `state: unknown` and never
  branches on `positions.length` (AC-10) — the highest-severity honesty line in the feature.
- Score byte-identity broker-connected vs not (AC-17): the existing scoring characterization
  fixtures + an empty diff on scoring modules + a live A/B (the scanner worker-absent/present
  proof is the template).
- Isolation (AC-12/16): broker fetch failure leaves sim tab, bundle widgets, SSE rendering; sim
  store + ledger byte-identical across connect/disconnect.
- Server gate (AC-4): every broker endpoint refuses anonymous/bypassed clients server-side.
- Secret hygiene (AC-5): no plaintext secret in responses, logs, or browser storage; decrypt-fail
  path asserts no leak and no "Webull rejected" misattribution.
- Negative space (AC-15/19): no order/close/modify affordance on broker rows; no
  `TradeEntryDialog` import/reference on the broker surface (source-scan, the outcome-ledger
  one-way-leaf proof pattern); no write path from real rows to the sim store.
- Forbidden-word scan: "live" appears nowhere on the broker surface as descriptor (negation-only
  allowance in the header phrase). The scan covers trader-visible rendered strings only — internal
  names, routes, and testids may keep `live` (decisions.md label-ruling carve-out); it must not
  trip on module names or source identifiers.
- Stamp invariant: an as-of stamp is present whenever any broker datum renders (S3–S8).
- S7 ≠ S8 ≠ `credential_unreadable`: distinct renders off distinct wire values; a generic
  catch-all is the regression.
- Modeled P/L two-axis degradation (AC-21): SSE drop dims to ⏸ last-known, never blanks; snapshot
  fields unaffected by the SSE axis; snapshot-stale + feed-up keeps the figure updating ONLY with
  the dual-basis label (`modeled now · on your book as of {time}`) — a single-basis label over a
  stale book is the regression.
- Cross-account isolation (AC-23): a second real account sees only its own
  `unknown`/`no_credential_stored` state — no field of another account's book, cache, `last4`, or
  `account_ref`; anonymous ⇒ 401/403.
- Adapter mapping: **characterization tests over checked-in fixtures from the live payload
  capture** (build task #1 — the golden-fixture pattern the scoring path uses); tri-state facts,
  signed quantities, per-leg multiplier, fidelity markers each pinned. AC-6a/6b assertions bind to
  the captured shapes.
- SDK import-scope: a source-scan test pins "the Webull adapter imports only the read subset;
  nothing else imports the SDK".
- Refresh semantics: force-fetch advances `last_attempt_at`; throttle/cache-serve does not.

**Reviewed (`review`):** empty/degraded/reauth copy, CTA presence + deep-link target, badge
wording/placement, stamp format, tooltips, `not provided` + `Custom` tips, no-fear-styling
restraint, refresh unchanged-and-why note, masked-hint rendering, AC-20 fabrication check, and the
one-time AC-6a review arm: the owner's app-vs-tab comparison against the Webull app (the arm no
automated test can observe).

**FE tiers:** unit (state lookup, predicates: stale derivation, degraded derivation) · component
(the nine states rendered from wire fixtures) · integration (Positions page with the network
boundary mocked — ONLY the network boundary). Conformance: the interface's environment-independent
arms run via `interface_conformance.py --auth-signup`; the credential-dependent arms are covered by
the backend/adapter tests above (see the interface file's note).

## 8. Guardrails this feature must not break

- `[no-real-order-path]` — realized as the formal narrowing "read real positions OK, no real order
  execution" (formalize at GATE S per BACKLOG 2026-06-24). Structural: no write method on the
  port; adapter imports read-subset only; no order affordance, even disabled; no entry surface.
- `[secret-encrypted-at-rest]` — Webull App Key/Secret: Fernet ciphertext-only via
  `UserCredentialStore`, never logged/returned/browser-sent, masked hint + rotate/delete;
  decrypt-fail = no-usable-secret, never a leak.
- `[server-side-gate-enforcement]` — all five broker endpoints signed-in + server-gated; FE checks
  are UX only.
- `[best-effort-isolated-or-null]` — broker outage/limits degrade the Broker tab ONLY; broker code
  is a one-way leaf off the trading path. Auth carve-out: gate refusals are real 401/403;
  broker-side faults are typed states inside a 200.
- `[live-vs-static-isolation]` + `[model-read-carries-its-assumptions]` — every broker datum
  carries `as_of`/`basis`/`stale_after_seconds`; polled data never presented as live; the modeled
  P/L is declared live-derived and degrades accordingly; every P/L figure names its basis.
- `[absent-is-not-none]` — `state: ok|empty|unknown` closed enum is the sole disambiguator, typed
  on the wire; tri-state broker facts at field level; `not provided` at the render.
- `[loss-free-durable-migration]` — satisfied by migrating nothing: no durable key or shape
  changes; `PositionView` is the seam; `BrokerPosition` is a new type beside the sim book.
- `[single-shared-sim-entry-dialog]` (narrowed) — no entry surface here at all; any future
  real-money surface is structurally separate.
- `[additive-keeps-score-byte-identical]` — real positions are never a scoring input;
  score/tier/fingerprint byte-identical with and without a connected broker (leaf boundary +
  fixtures + live A/B).
- `[theme-token-discipline]` · `[digested-labels-not-raw-dump]` (wire enums authoritative, closed
  FE lookup, never re-derived).

### 8.1 system-6 security review — scope (fires HERE; first real-account connection)

The red team's remit — findings land as ACs on the credential/egress surface, not as scope
reopeners:
- **Credential storage:** Fernet key provenance/rotation story; ciphertext-only persistence proof;
  plaintext lifetime (request-scope only); masked-hint leak surface; per-user isolation;
  delete-really-deletes including server book-cache invalidation.
- **Egress:** the adapter contacts only the fixed Webull API hosts (testable allowlist);
  credentials/signatures never in URLs or query strings; TLS only; Webull request-signing computed
  in one place, the secret never entering any error message, exception string, or trace.
- **Logging:** no secret, signature material, account number, or position detail in logs at any
  default level; the broker surface's observability treatment decided deliberately (uninstrumented
  v1 — the SSE precedent — or timing-only with an explicit redaction rule; see §9); the structured
  trace emitter shown never to serialize the credential object.
- **Replay & abuse:** Webull signing timestamp/nonce + clock-skew tolerance; server-authoritative
  per-account refresh throttling so a hostile client cannot weaponize our server against the
  owner's broker rate limits; the new gated surface sits entirely behind the existing HMAC-signed
  session model.
- **Dependency:** the official Webull SDK pinned; import-scope rule confirmed; SDK transitive
  behavior (telemetry, retries, endpoints) checked against the egress allowlist.

## 9. Open questions

1. **The Webull options/multi-leg payload shape** — OPEN until the build lane's payload capture
   (task #1; keys approved 2026-08-01, so capture precedes build decisions). AC-6b and the
   tri-state facts absorb both outcomes; no lane commits per-field promises before capture.
2. **Flat-payload grouped rendering** — if capture shows no grouping identity, whether to visually
   group per-contract rows (by underlying+expiry) or keep honest flat rows is a named post-capture
   OWNER decision, recorded, not defaulted (C2).
3. **Does Webull supply an unrealized P/L figure?** — settled conditionally by the owner ruling
   (carried verbatim, may render as static reference); whether the payload carries it is a capture
   fact.
4. **Broker-surface observability** — uninstrumented (SSE precedent) vs timing-only with a
   redaction rule; a deliberate decision owed to the system-6 review, not a default.
5. **The ledger sim-only ruling** — PM ruled real-book outcomes OUT of the outcome ledger for v1
   on provenance grounds; flagged owner-contestable ("track my real results" is a plausible owner
   want; it requires an entry-provenance story first).
6. **The "Broker" tab label** — settled by the council (poll-honesty), but reversible copy: the
   owner may veto at any gate.
7. **Escape hatch (C3, moot in fact):** if payload capture somehow fails at GATE Q, the conductor
   presents the owner an explicit either/or — ship with AC-6a deferred to a named runtime
   follow-up vs hold GATE S; neither lane pre-decides.

## Appendix — S2 minors: declined

All S2 minors were folded (M-1..M-8) except:

- **M-9** (R2-pm's reason-vocabulary ask undocumented in R3-architect.md): declined — the
  resolution already lives in the contracts (`no_credential_stored` vs `unknown`+failure-cause vs
  client-known S2/S9); S2-findings.md M-9 is the durable record that it was answered, not dropped.
