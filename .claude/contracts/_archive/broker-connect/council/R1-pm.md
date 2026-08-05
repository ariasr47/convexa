# R1 — pm position: broker-connect

## Position

### Who this serves (phase 1)

**The OWNER. One user, one Webull account, their own Individual OpenAPI keys.** This is
BYO-credential self-service in the byo-ai-key mold: the owner pastes keys they obtained
themselves, and the product's obligations are honesty and safety, not onboarding polish.
External users are explicitly **Future** (SnapTrade adapter — designed-for, not built).
Every product decision below is allowed to trade convenience against safety in favor of
safety, because the phase-1 user is the person who wrote the invariants.

The job-to-be-done: **stop hand-mirroring the real book into the sim book.** Today every
hold/trim/exit/roll decision runs against a manually maintained copy whose fidelity decays
(the N2 friction). Success looks like: the owner opens Positions → Live, sees the risk
actually carried with an honest as-of stamp, and asks for a reassessment of a REAL holding.

### User stories

- **S1 — Connect.** As the owner, signed in, I enter my Webull App Key + Secret in Settings
  and from then on the app can read my brokerage positions. After saving I can never see the
  secret again — only a masked hint — and I can rotate (replace) or delete it.
- **S2 — See the real book.** As the owner with a connected broker, I open the Positions
  page's Live tab and see my actual Webull positions — including multi-leg options positions
  rendered as one position with legs, in the same leg-first book vocabulary the sim tab uses.
- **S3 — As-of honesty.** As the owner, every real-book render tells me its data basis: when
  it was fetched, whether it is stale, and never claims to be "live" when it is polled. I can
  ask for a refresh on demand.
- **S4 — Reassess the real thing.** As the owner holding a real position, I can build a
  reassessment request that references that real holding (with its as-of basis carried into
  the request), instead of a hand-mirrored sim copy.
- **S5 — Trust the failure modes.** As the owner, when Webull is down, my credential is
  revoked, or the data is stale, the Live tab tells me exactly which of those it is — and
  nothing else in the app (Ticker, SSE, sim book, scanner, score) changes at all.
- **S6 — Disconnect cleanly.** As the owner, deleting my credential returns the Live tab to
  its not-connected state and leaves no real-position data visible anywhere in the app.

### Scope — IN (v1)

1. **Connect / rotate / delete a single Webull credential**, in Settings, signed-in only,
   server-enforced (the FE check is UX, not the gate). Write-only with masked hint — the
   byo-ai-key product shape, reused deliberately.
2. **The Live tab becomes real** — it replaces the locked placeholder with the owner's actual
   Webull positions, read-only, rendered through the leg-first book model.
3. **On-open fetch + on-demand refresh.** The product requirement is truthfulness, not
   cadence: whatever the refresh mechanics, the as-of stamp is accurate, and a manual
   refresh affordance exists. Cadence/mechanics are the Architect's call.
4. **The full closed set of Live-tab states** (each is product behavior, each gets its own
   AC below): not-connected · fetching-with-nothing-known · confirmed-empty book ·
   populated · populated-but-stale · broker-unavailable (with and without last-known data) ·
   credential-rejected.
5. **Reassessment referencing a real holding** — request-building and export only. The
   verdict on a real position is advisory display/copy; there is **no Accept-into-store
   action for a real position in v1** (Accept-mapping mutates a sim record; a real position
   offers nothing the app may mutate, and the owner executes in Webull by hand). The sim
   Accept flow is unchanged.
6. **Honest partial representation.** If a broker position cannot be faithfully represented
   by the book model (the payload shape is an open question until capture), it renders as an
   explicit "cannot fully display this position" entry. Facts the broker does not supply
   render the shipped not-a-number vocabulary (`—` / `not recorded` family) — never 0, never
   blank, never a silent omission.

### Scope — OUT (absolute, v1)

- **Any order/execution/write path to the broker.** READ-ONLY is not "no functional order
  button" — it is **no affordance at all**: no disabled buttons, no greyed "Close" action, no
  "coming soon" trade menu item, no copy implying an order path exists. A disabled order
  button is a promise; this feature makes no such promise.
- **Any mutation of the sim book by real data.** Real rows cannot be imported into, merged
  with, or converted to sim positions. The sim store's contents are untouched by connecting.
- **Real-book outcomes in the outcome ledger.** My product ruling (argued, and flagged as
  contestable): **the ledger counts SIM outcomes only in v1.** The ledger's spine is the
  DecisionRecord — no record ⇒ not an outcome — and its purpose is validating the app's own
  score. Real positions arrive with no entry decision, no captured entry context, and no
  score provenance; counting their outcomes would pollute the exact honesty loop the ledger
  exists to protect. Real-book outcome attribution is Future and requires provenance an
  importer cannot supply retroactively.
- **Real positions as a scoring input — never.** Score/tier/fingerprint byte-identical with
  and without a connected broker; this is permanent, not phase-1.
- **Multi-broker, multi-user, SnapTrade build, OAuth flows.** Designed-for at the port, not
  built, not surfaced.
- **Onboarding/help for obtaining Webull keys** beyond a one-line pointer. Phase-1 user
  already has them.
- **Any new entry surface.** The `single-shared-sim-entry-dialog` narrowing already rules:
  no entry surface here at all.

### Scope — FUTURE (named, dated to "after v1")

- SnapTrade adapter → external users, OAuth, multi-broker.
- Real-book outcome attribution in the ledger (needs an entry-provenance story first).
- Accept-mapping / decision recording against real positions.
- Any real-money surface — a deliberate GATE-Z reopening plus a structurally separate
  component, per the narrowed `single-shared-sim-entry-dialog` canon.
- Streaming/live real-book updates (v1 is polled and says so).

### The approval-lag question (what ships if keys aren't approved yet)

Webull approval may lag the build. Product answer: **the feature ships complete except for
one explicitly deferred AC.** Every state except "populated with my actual positions" is
demonstrable without approved keys — not-connected, the connect flow, credential-rejected
(a wrong/unapproved key IS that state, exercised for real), empty/unknown distinction,
read-only structure, isolation, byte-identity. The single AC that needs a live book (AC-6)
is recorded at GATE Q as **blocked-on-approval, verified in a named follow-up runtime
check** — consistent with the BRIEF making payload capture the build lane's first task.
What is NOT acceptable: presenting sample/demo positions as real to fake the demo, or
declaring the "shows my actual positions" claim verified against a stub. The app fabricates
nothing while waiting.

### Acceptance criteria (observable without reading code)

Verification method is risk-based per qa-verify §4: automated tests where silent regression
is plausible (byte-identity, isolation, server-gate, no-plaintext-secret), review/app-run
for visible intentional states — never one-test-per-AC.

**Credential lifecycle**
- **AC-1** Signed in, the owner saves a Webull App Key + Secret in Settings; afterwards the
  UI shows only a masked hint (e.g. last-4). The full secret is never displayed again on any
  surface.
- **AC-2** Rotate: saving a replacement credential updates the masked hint, and subsequent
  real-book fetches use the new credential (observable: fetches succeed after rotating from
  a dead key to a good one).
- **AC-3** Delete/disconnect: removing the credential returns the Live tab to not-connected,
  and no real-position data remains visible anywhere in the app afterwards.
- **AC-4** Logged out (or with the client check bypassed), every broker surface — credential
  save, rotate, delete, real-book read — is refused server-side.
- **AC-5** After save, the plaintext secret appears in no server response, no page source,
  no browser storage, and no log line (spot-check observable via devtools/network capture; a
  decrypt failure on the server presents as "no usable credential", never as leaked content).

**Live tab — happy path**
- **AC-6** *(blocked-on-approval; verified in the named runtime follow-up)* With a connected
  broker and a non-empty Webull book, the Live tab lists the owner's actual positions —
  symbols and quantities matching what the Webull app shows — with a multi-leg options
  position rendered as one position with its legs, not N unrelated rows.
- **AC-7** Every Live-tab render carries a visible as-of stamp / refresh basis. The word
  "live" never appears as a freshness claim on polled real-book data (the scanner-table
  rule, applied here).
- **AC-8** A manual refresh affordance exists; using it updates the as-of stamp on success.

**Live tab — degraded/edge states (each distinct, each its own behavior)**
- **AC-9** Not connected: the Live tab shows an explicit not-connected state pointing to
  Settings — never an empty table that could read as an empty book.
- **AC-10** Unknown vs empty: before any successful fetch (or when a fetch fails with
  nothing known) the tab shows a "not fetched / unavailable" state; a **confirmed-empty**
  broker book shows a "checked — no positions held" state. The two are textually and
  visually distinct, and neither can be produced by the other's condition.
- **AC-11** Stale: when data is older than its declared basis, rows keep their last-known
  values, visibly marked stale with their timestamp — never blanked, never silently
  refreshed-looking.
- **AC-12** Broker outage/rate-limit: the failure degrades the Live tab ONLY. In the same
  session, the Ticker page, SSE stream, sim tab, and scanner behave identically to a
  no-broker session. If last-known data exists it stays visible under an honest banner;
  if not, AC-10's unknown state shows.
- **AC-13** Credential revoked/expired/invalid: a distinct state naming the cause and
  pointing at rotate-in-Settings — distinguishable from AC-12's outage state.
- **AC-14** Unrepresentable position: a broker position the book model cannot faithfully
  render appears as an explicit cannot-fully-display entry. The tab never silently drops a
  position (a count shown never understates the book) and never flattens one into a
  plausible-looking wrong position. Missing broker-supplied facts render the shipped
  not-a-number vocabulary, never 0/blank.

**Read-only absolutism**
- **AC-15** The Live tab exposes zero order/trade/close/modify affordances — including
  disabled or "coming soon" ones — and no copy implying an order path exists or is planned
  on this surface.
- **AC-16** No flow exists that creates or alters a sim position from a real row. The sim
  tab's contents and the outcome ledger's every number are identical before and after
  connecting a broker (including one with closed positions in its history).

**Isolation and scoring**
- **AC-17** A served bundle's score / tier / `state_fingerprint` are byte-identical with and
  without a connected broker (observable: same ticker, same values, broker connected vs
  credential deleted).

**Reassessment**
- **AC-18** With a real holding present, a reassessment request can reference it, and the
  request/export visibly carries the real position's as-of basis (the AI is never handed a
  real position without its staleness disclosed).
- **AC-19** A reassessment verdict on a real position offers no Accept-into-store or any
  other write action — advisory display/copy only; the sim reassessment Accept flow is
  byte-identical to before this feature.

**Approval-lag honesty**
- **AC-20** With no approved keys, the app fabricates nothing: no sample/demo positions
  presented as real anywhere, and the connect flow with an unapproved key lands in AC-13's
  rejected state, not a hang or a fake success.

## Risks I see

- **The payload-shape unknown lands on product honesty.** Options/multi-leg shape is an open
  question until capture. The failure mode I'm guarding: the build discovers Webull's shape
  is awkward and quietly narrows scope to equities-only or flattens spreads. AC-14 exists so
  that narrowing is impossible to do *silently* — an unrepresentable position must be
  visibly unrepresented. If capture reveals the model genuinely can't hold what Webull
  returns, that comes back to the council, not into a quiet cut.
- **Approval lag creates demo pressure.** The temptation to seed fake positions "just to
  show it working" is exactly the fabricated-claim failure `absent-is-not-none` exists to
  kill. AC-20 makes refusing that pressure a requirement, not a virtue.
- **The ledger ruling is contestable.** I ruled real-book outcomes OUT of the ledger for v1
  on provenance grounds. The owner might want the opposite ("track my real results"). That
  is a genuine product fork; if another lane assumed differently it should surface in R2 as
  a `product` conflict for the human.
- **Reassessment-verdict scope creep.** Once a real holding can be reassessed, "record my
  decision on it" is one small step away — and it drags decision records, and then the
  ledger, into the real book. I dated it Future deliberately; the build must not add it as
  a freebie.
- **State-explosion vs honesty.** Seven Live-tab states is a lot of UI. The risk is
  collapsing them ("something went wrong") and losing the unknown/empty/revoked/outage
  distinctions that carry the actual product value. The states are a closed set; collapsing
  any two is a spec change, not a simplification.
- **Read-only erosion by affordance.** The cheapest UI often reuses the sim row component —
  which carries write actions. One forgotten prop and the Live tab grows a "Close" button.
  AC-15 is written to fail on the affordance existing at all, not on it working.
- **Security scope (system-6) could stall the feature.** The red-team trigger fires here and
  rightly so, but its remit is the credential lifecycle and egress — if it expands into
  re-litigating whether read-only import should exist, phase-1 delivery slips. Product asks
  that its findings land as ACs on the credential/egress surface, not as scope reopeners.

## Assumptions I'm making about the other two lanes

- **Architect: the credential is stored server-side via the existing UserCredentialStore /
  Fernet pattern, one Webull credential per user account, and the browser never talks to
  Webull directly** — all broker traffic is server-mediated. AC-5 is unverifiable otherwise.
- **Architect: the real book is NOT written into any durable client store in v1.**
  `BrokerPosition` is a new server-side/ephemeral type surfaced through the `PositionView`
  seam; `convexa.positions.v3` gains no new shape and no migration. If the Architect plans a
  client-durable broker cache, `loss-free-durable-migration` fires and my AC-3 ("no residual
  data after disconnect") gets harder — I want to know in R2.
- **Architect: the wire distinguishes unknown-book from confirmed-empty-book in a closed
  state vocabulary a consumer cannot collapse** (the bundle-events precedent). AC-10 depends
  on this being structural, not FE-inferred from an empty list.
- **Architect: one fetch returns the whole book at owner scale** (tens of positions, not
  thousands) — so v1 needs no pagination, partial-page, or "load more" product states.
- **Architect: broker code is a one-way leaf off the trading path**, so AC-12's isolation
  and AC-17's byte-identity are structurally guaranteed and cheaply testable, not
  best-effort promises.
- **Architect: refresh is poll/on-demand, not streaming** — nothing broker-related rides
  SSE in v1. If streaming appears, my "never says live" AC-7 needs rewording, not deleting.
- **UX: the Live tab lives where the locked placeholder is today** — same Positions page,
  same tab structure, no new route, and the sim/live boundary stays visually unmistakable
  (a reader can never confuse which book they're looking at).
- **UX: the credential surface sits in Settings beside the existing AI-key section and
  reuses its write-only/masked/rotate/delete interaction pattern** — not a novel credential
  UI.
- **UX: the seven Live-tab states render via closed lookup with distinct copy** (the
  scanner-states precedent), and UX will resist collapsing unknown/empty/revoked/outage
  into a generic error treatment.
- **UX: no order affordance appears even as a disabled ghost or "coming soon" teaser** — I
  expect design pressure toward a greyed trade button "to show the roadmap"; AC-15 forbids
  it, and I'm assuming UX designs to that rather than around it.
