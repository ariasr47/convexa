# INTERFACE CONTRACT — curvature-v2-surfaces (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/curvature-v2-surfaces/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be empty, measured three-dot

This phase is **frontend-only**. It introduces no endpoint, no payload field, no field-presence rule,
no query parameter, no route, no persistence shape, no score input and no change to streaming
behaviour. The `apps/api` diff for this feature is **empty**, enforced as a build step and measured
**three-dot against the merge base**:

```
git diff origin/main...HEAD -- apps/api      # must return ZERO lines
```

Three-dot is the contract, not two-dot: two-dot would also report changes that landed on `origin/main`
after this branch started and would fail a clean lane for someone else's work. `opportunity_score`,
`opportunity_tier` and `state_fingerprint` are **byte-identical** —
`[additive-keeps-score-byte-identical]`, SPEC §3 criterion 67. Nothing on the scanner, positions,
settings or alerts surfaces, and nothing in the eight quiet-band widgets, is a scoring input.

Every wire fact these four surfaces depend on already ships and is consumed exactly as it is today.
The existing contracts for the ticker bundle and the page stream are
`.spire/clusters/tech/contracts/curvature-v2-desk-and-read/INTERFACE_CONTRACT.md` (phase 2) and
`.spire/clusters/tech/contracts/curvature-v2-foundations/INTERFACE_CONTRACT.md` (phase 1); this file
pins the one read this phase newly *depends on for every figure it converts* — the **scanner sweep** —
plus the structural spine of the bundle the positions page reads, and documents the price stream whose
parsed shape decides SPEC §2.2's liveness ruling.

## Endpoints consumed (unchanged)

| Method | Path | Purpose in this phase | Auth | Error semantics |
|---|---|---|---|---|
| `GET` | `/api/scan` | **The sweep behind every scanner figure** — price, chg %, score, tier, regime, vol, flip, walls, both distances, status and as-of, plus the caller's effective view and the sweep heartbeat. Consumed via the shipped `getScan()` client from `useScan`, on a `SCAN_POLL_MS = 30_000` interval (`useScan.ts:60`). | **optional-session** (`apps/api/src/routes/scan.rs:318`) — anonymous-open, so it is **not** marked `auth` below | Best-effort at the client: a failed poll keeps the last-known rows and flips `degraded` (`useScan.ts:156-161`); the table never blanks and never throws. Absent computations are `null` per field, never an HTTP error. |
| `GET` | `/api/ticker/{ticker}` | The anchor bundle the **positions** page polls for marks (`PositionsPage.tsx:95` `getTicker(ticker)`). A failure leaves the prior bundle in place and degrades per-row marks; records never drop. | Anonymous-open | `404` only when the ticker has no chain at all. The full field list is pinned by phase 2's contract and is **not** restated here; this file pins only the structural spine positions binds to. |
| `GET` | `/api/stream/prices?symbols=…` (SSE) | The per-symbol live price overlay on the scanner (`useLivePrices.ts:57`). One `EventSource` for every rendered symbol, fanned out server-side. | Anonymous-open | Auto-reconnects; `onerror` flips `offline` (`:79-82`), plus a 45s silence watchdog (`:37,84-86`). Never blanks a row, never throws. The watchdog counts **price frames only**: this route's heartbeats are SSE *comments* (`stream.rs:434,446,500`) that `EventSource` never dispatches to `onmessage`, so a healthy stream on a quiet tape trips it. That is pre-existing, is **not** repaired here (the honest fix is a backend change criterion 67 forbids), and is named as carried debt in SPEC §2.2. **Not machine-checkable by `interface_conformance.mjs`** — the runner does not read event streams. **Not pinned below.** |
| `GET` | `/api/stream/{ticker}` (SSE) | The page-scoped tape the **positions** page opens for its live-derived cells (`PositionsPage.tsx:118` `streamTicker`; the client builds the URL at `libs/api/src/lib/convexa.ts:1290`). Consumed unchanged. | Anonymous-open | Gap watchdog flips `streamOffline`; live marks degrade to the retained/bare arms while durable records persist. **Not machine-checkable; not pinned below.** |
| `PUT` | `/api/scan/view` | The scanner's one gated, state-bearing action (save view). **Untouched by this phase.** | **session** (`scan.rs:343`) | `403 auth_required` signed-out, `422 validation` off-universe, `503` (**universe unavailable** — `state.universe` is `None`, `scan.rs:776-782`, a config/data-availability fault, **not** the auth service's own `auth_unavailable()`). **Deliberately NOT pinned**: it is a **mutating**, session-bound write that would persist a view against the caller's account on every conformance sweep. |
| `GET` | `/api/broker/credential`, `GET /api/broker/book` | The Broker tab's reads (`useBrokerBook.ts:62`, `renderState.ts:44`). This phase converts that tab's **figures** for register and vocabulary and touches **none** of its data. | **session** + a stored brokerage credential | **Deliberately NOT pinned**: SPEC §1 declares *no broker DATA work and no `/api/broker/*` change*; a sweep with a throwaway signup holds no brokerage credential, so pinning it would encode a configuration outcome as a contract FAIL. |

**Wire facts that are load-bearing for the SPEC.**

- **`/api/stream/prices` carries no session and no liveness flag — this is the fact behind D-A.** Read
  at source for this contract: `useLivePrices.ts:69` parses the frame as
  `JSON.parse(e.data) as { prices?: Record<string, LivePrice> }` **and nothing else**, and
  `LivePrice` is declared locally at `:24-27` as `{ price: number; ts: number }`. There is **no
  `market_session`** and **no wire `live` flag**. `isDeliveringLive`'s true arm
  (`liveClaim.ts:47-52`) reads exactly those two fields, so the branded predicate cannot produce a
  true claim from this stream, and `andPresent` can only narrow an existing one. That is why **no
  scanner figure carries a live mark this phase** (SPEC §3 criterion 11A, **OWNER — D-A**), and why
  adding the two fields here is named as the future phase that unlocks per-symbol marks. **Nothing in
  this phase changes this frame.**
- **The retained arm needs no new wire field — and it is NOT an age.** The scanner's
  `{ retained: boolean } | null` prop (SPEC §2.1) is computed at `Scanner.tsx:119-126` as
  `live.offline && live.prices[sym] != null ? { retained: true } : null` — the stream's own offline
  flag ANDed with the datum's provenance, which is exactly what the shipped prop shape means (outer
  null/non-null = the stream, inner boolean = the datum). It is **not** derived from the per-symbol
  `ts`: that field carries the server's `ev.ts_ns` (`stream.rs:454,480`), declared *"Vendor timestamp
  (nanoseconds when available; **0 if missing**)"* (`apps/api/src/domain/price.rs:18-19`), so an age
  taken against `Date.now()` would be off by 10⁶ and every symbol whose vendor omitted the timestamp
  would read permanently stale. SPEC §2.2 records that withdrawal. This is a client-side derivation
  over state the client already holds — **not** a wire change, and no second liveness answer.
- **`/api/scan`'s row fields are required keys with nullable values** (`ScanEnvelope` /
  `ScanRowDto`, `libs/api/src/generated/schema.ts:2235-2265`): `price`, `chg_pct`, `score`, `tier`,
  `regime`, `vol_regime`, `flip`, `call_wall`, `put_wall`, `dist_to_flip_pct` and
  `dist_to_wall_pct` are all `T | null`, while `symbol`, `status` and `as_of` are non-nullable. That
  nullability **is** the reason the scanner needs the closed nine at all: every one of those eleven
  columns can legitimately be absent, and SPEC §3 criteria 3, 4 and 17 govern what renders when it is.
  A change from `T | null` to `T` would not break a page; it would silently retire a rendering path
  the criteria assert, which is why the nulls are pinned rather than the values.
- **`sweep` is `null | SweepHeartbeatDto`** (`schema.ts:2237,2622-2628`). A null sweep is a real
  state — it is what the scanner's degraded banner reads — so it is pinned as nullable and never as
  required-present.
- **`view` is always returned, including anonymously** (`scan.rs:721`; `convexa.ts:1202-1204`:
  *"Anonymous ALWAYS gets a readable default; a READ is never gated"*). SPEC §3 criterion 19's
  empty-saved-view state is `view.symbols` being empty, not `view` being absent.

## Conformance spec

Machine-checkable. `interface_conformance.mjs` runs this against the live backend at G1. It pins the
existing wire this frontend-only phase binds to, so a silent field rename or a nullability change is
caught before GATE Q rather than as a blank column on `/scanner` or a dead mark on `/positions`.

**Endpoint order is load-bearing, not cosmetic.** `/api/scan` runs first because it is the read this
phase's headline criteria depend on and it is answerable without any prior fetch. `/api/ticker/{ticker}`
follows and is pinned only at its structural spine — its full field list belongs to phase 2's contract
and is not duplicated here.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/scan",
      "path_params": {},
      "query": {},
      "required": {
        "view": "object",
        "view.source": "string",
        "view.authenticated": "boolean",
        "view.density": "string",
        "view.sort": "object",
        "view.sort.key": "string",
        "view.sort.dir": "string",
        "sweep": "object|null",
        "rows[].symbol": "string",
        "rows[].status": "string",
        "rows[].as_of": "number",
        "rows[].price": "number|null",
        "rows[].chg_pct": "number|null",
        "rows[].score": "number|null",
        "rows[].tier": "string|null",
        "rows[].regime": "string|null",
        "rows[].vol_regime": "string|null",
        "rows[].flip": "number|null",
        "rows[].call_wall": "number|null",
        "rows[].put_wall": "number|null",
        "rows[].dist_to_flip_pct": "number|null",
        "rows[].dist_to_wall_pct": "number|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "market_state": "object",
        "market_state.price": "number|null?",
        "signals": "object",
        "signals.opportunity_score": "number|null?",
        "signals.opportunity_tier": "string|null?"
      }
    }
  ]
}
```

**What this block buys, stated exactly, so no reader trusts it for more than it checks.**

- **Checked outright:** that `/api/scan` still answers `200` **without a session** and still returns a
  `view` **object** with its `sort` sub-object, and that `/api/ticker/{ticker}` still returns
  `market_state` and `signals` **objects**. Those are the structural spines the scanner table and the
  positions marks hang on.
- **Checked per row:** every `rows[].*` field is type-checked on **every** row the sweep returns. A
  rename (`chg_pct` → `change_pct`), a flattening, or a nullability tightening on any of the eleven
  columns is a FAIL — and each of those is a column that would otherwise go blank or silently lose its
  absent-value path.
- **Known limit, named rather than hidden:** the row fan-out proves nothing when `rows` is **empty**.
  An empty `rows` array is a legitimate state (a caller whose view holds no symbols), so this block
  cannot double as a data-presence check. SPEC §3 criterion 62 closes that hole on the side that
  matters — the e2e run is required to **seed a non-empty scan** and a non-empty alerts blob before it
  measures overflow, precisely because the shipped suite measures empty pages today.
- **Not caught by these pins:** a rename of an **optional** field on the ticker bundle — it reads as
  absence, which is a legal state there. That residual is closed elsewhere: `apps/api` is byte-frozen
  for this phase (criterion 67, proved by an empty three-dot diff), so no rename can originate here;
  and every field above is consumed through the generated wire types in
  `libs/api/src/generated/schema.ts`, so a rename landing from a later backend phase is a **compile
  error** caught by `npm run typecheck`, which criterion 68 already requires with its exit code
  recorded separately.
- **Not checked at all, by design:** both SSE streams (the runner does not read event streams), the
  mutating `PUT /api/scan/view`, and the two `/api/broker/*` reads (session-bound and
  credential-bound; see the table above).

No field above is new; nothing here authorises a backend edit. If the runner cannot reach a live
backend, this is a `NO_BACKEND_CHANGE` feature and the exemption stands — record it as such rather than
inventing a sample pass.

## Durable client stores — the other integration boundary

There is no server of record for any of these. `[loss-free-durable-migration]` is the BRIEF's **sharpest
risk on this surface set**, and it governs a boundary `interface_conformance.mjs` cannot see, so it is
written down here beside the wire.

**No key changes and no shape changes this phase.** The one repair is on a **read path**.

| Key | Declared at | This phase | Rule that binds it |
|---|---|---|---|
| `convexa.alerts.v1` | `features/alerts/types.ts:47` (`ALERTS_KEY`); state shape `AlertsState` at `:39-45`; `AlertEvent` at `:27-37` | **Read-path repair only.** `store.ts:59-68` degrades to `empty()` on a parse failure — correct, nothing is written — but the next `upsertRule` / `pushEvent` / `setNotifyBrowser` calls `persist` at `:41-49`, which `setItem`s the empty state over **the same key** the corrupt blob occupies. The **read-fault latch** (pm P4) makes `persist()` refuse to write to `ALERTS_KEY` for the session once the read has faulted. **No key change, no shape change.** | Read-new-else-old · promote-forward · **never-delete** · idempotent · never-throw. `message` (`types.ts:32`) is **never deleted** — history re-labelling is carried debt (SPEC §1), and if it is ever funded it is an **additive** field set with `message` retained as the fallback. SPEC §3 criteria 51, 52, 70, N-5. |
| `convexa.positions.v3` | `features/trading/positions/store.ts:60`, reading `…v2` (`:61`) and `…ghost-trade.v1` (`:62`) as sources | **Read and written exactly as it ships.** The positions conversion is presentational: register, states, marks and captions. No migration is authored, and `migrate.ts:58-65`'s `aborted` guard (which forbids writing v3 while any source is unread) is untouched. | Same rule; verified against a blob written **before** the phase (criterion 70). |
| `convexa.orders.v1` | `features/trading/orders/store.ts:19` | Untouched. The order engine still rides the positions page's focused-ticker stream; nothing in this phase changes what it writes. | Same rule. |
| `convexa.uiprefs.v1` | `features/auth/localPrefs.ts:15` | **Untouched.** This is the reason SPEC §3 criterion 39 forbids importing the settings canvas footnote `Saved to your account.` (`design/src/screens/settings.mjs:30`): theme and persona preferences live in this **browser-local** key and are not saved to any account. Shipping that sentence would be a false persistence claim. | Same rule; nothing to migrate. |

**No new durable key and no new persisted preference is created by this phase.** Any converted surface
that wants one is a GATE Z bounce, not a lane decision — it would pull
`[loss-free-durable-migration]` from *satisfied by absence* to the phase's sharpest live risk.
