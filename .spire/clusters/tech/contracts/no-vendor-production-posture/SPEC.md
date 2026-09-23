# no-vendor-production-posture — SPEC

Owner 2026-09-23 chose A: "make production honest without a data vendor". This is a conductor-authored
SPEC. The owner approved the plan and the mock (`docs/mockups/2026-09-23-market-data-paused.html`), and
the full design council was skipped by design: this is one switch and one state on existing surfaces.
BACKLOG source: "Parked — 2026-09-22" `no-vendor-production-posture`, and the 2026-09-23 carry
`api-boot-dials-vendor-without-warm`.

## 1. Problem (measured 2026-09-23)

Massive is cancelled; the entitlement ended 2026-09-16. Production keeps contacting the vendor:

- the warmer every 25 s (switched off by `WARM_ENABLED=0` on 2026-09-23, step 1 of the owner's plan);
- the stock websocket every 60 s ("Your plan doesn't include websocket access"), because
  `state.rs:569-572` subscribes the warm symbols at boot whatever `WARM_ENABLED` says;
- the scanner sweeps during market hours (board: 69 rows, `by_status.error = 69`);
- every on-demand request. `GET /api/ticker/SPY` returns 502, and the desk shows `Couldn't load SPY.` ·
  `HTTP 502` · `Retry`. That is a transient-failure message for a permanent condition, and it is the
  first thing the new landing's primary CTA leads to.

## 2. The switch

A new environment variable, `MARKET_DATA_MODE`, takes `live` (the default when unset) or `paused`. Any
other value refuses to boot with a config error that names the variable. The mode is read once at boot.
There is no runtime toggle.

### When `paused` (backend)

- **B1 — no vendor contact.**
  - None of these run: the warmer, the scanner sweeps, the stock-stream hub (no boot subscription, no
    on-demand connect), and any flat-file or chain-archive fetcher.
  - No route makes a vendor REST call.
  - `MASSIVE_API_KEY` is not required to boot. It is still required in `live`, where behaviour is
    unchanged.
- **B2 — the paused reply.**
  - Every route that would need the vendor answers **HTTP 503** at once, without an outbound connect
    attempt. The body is exactly `{"detail":"Market data is paused.","code":"market_data_paused"}`.
  - The lane enumerates the vendor call sites. At minimum that covers `/api/ticker/{ticker}`,
    `/api/candidates/{ticker}`, `/api/contract/{ticker}` and `/api/stream/{symbol}` (no SSE stream is
    opened), plus the recommendation routes that need a fresh snapshot.
  - Routes served from persisted state, such as scan history or the board, keep working.
- **B3 — health says so.** `/api/health` gains `market_data: "live" | "paused"` in `HealthWire`, the
  closed schema (see the `health.rs:19-22` warning). In paused mode `warm.enabled` is false and the
  scanner block reports it is not sweeping.
- **B4 — the board says so.** `GET /api/scan` keeps serving the last persisted rows and gains a
  top-level `market_data: "live" | "paused"`.
- **B5 — typed error code.**
  - `AppErrorBody` gains an optional `code: string`. Only the paused reply sets it; every other error
    body is byte-identical to today's.
  - Regenerate the OpenAPI document and `libs/api/src/generated/schema.ts` through the repository's
    contract pipeline. Re-pin any artifact oracle that route or schema growth requires (ledger
    `route-growth-repins-api-artifact-oracle`).
- **B6 — the gates stay green in both modes.**
  - `.github/workflows/deploy-smoke.yml`'s ticker probe accepts a 200 bundle when health says `live`,
    and the paused 503 body when health says `paused`.
  - The same applies to any nightly conformance spec (`conformance.yml`) that touches a vendor route.
  - Re-scope them; never delete a probe.

### When `paused` (frontend)

- **F1 — the client carries the code.** `ApiError` (`libs/api/src/lib/convexa.ts:480`) gains an
  optional `code`. The fetchers for the B2 routes read the JSON body's `code` on a non-OK response. Add
  one exported predicate, `isMarketDataPaused(error)`.
- **F2 — the desk's paused state.** In the ticker desk's cold-start branch (`TickerDashboard.tsx:726`),
  a paused error renders the mock's panel:
  - info tone, a pause icon, `role="status"`;
  - title `Market data is paused.`;
  - body `Convexa isn't connected to a market-data feed right now, so this desk can't load prices or
    dealer structure. Nothing is broken, and retrying won't change it.`;
  - two links: `How the desk reads structure →` to `/methodology`, and `See an illustrative sample →` to
    the landing's sample section;
  - **no Retry and no HTTP line**. Curly apostrophes are U+2019, and quoted copy is byte-exact.
  - Any other error keeps today's warning panel exactly.
- **F2b — no retry loop.** Once the desk knows it is paused, it makes no further requests to B2 routes:
  no poll, no stream, no auto-retry. Changing the ticker makes one request, which gets the same reply.
- **F3 — the scanner line.** When `/api/scan` says `paused`, the signed-in scanner's cadence line reads
  `Market data paused · showing the last board, from <Mon D>`, using the last sweep's date. That replaces
  `Sweep last ran N d ago — showing the last known rows`. The rows are unchanged.
- **F4 — every other consumer of a B2 route** renders either the paused copy or its existing
  closed-vocabulary absent value. Never a Retry loop or a raw status for the paused code. The lane
  enumerates them.

## 3. Non-goals

- No change to live-mode behaviour: responses and UI are byte-identical when `live`.
- No copy change on the landing, blog, methodology, 404 or wall (their copy is pinned by
  `curvature-v2-landing-and-site`).
- No sample or fake data on the desk.
- No new route.
- No runtime toggle.

## 4. Acceptance criteria (observable)

| id | criterion | proof |
|---|---|---|
| AC-1 | With `MARKET_DATA_MODE=paused` and no `MASSIVE_API_KEY`, `serve` boots, and `/api/health` returns 200 with `market_data: "paused"`. An invalid value refuses to boot, naming the variable. | test |
| AC-2 | Paused, the process opens **zero** connections to vendor hosts, REST or WS, across boot plus 3 minutes idle plus one request to every B2 route. Point the vendor bases at a local recorder, which must record 0 connections. | test |
| AC-3 | Paused, every B2 route answers 503 with exactly `{"detail":"Market data is paused.","code":"market_data_paused"}`. | test |
| AC-4 | Paused, `GET /api/scan` returns the persisted rows plus `market_data: "paused"`. Scan history still works. | test |
| AC-5 | Live, the existing backend and frontend suites pass unchanged, `market_data: "live"` is reported, and non-paused error bodies are byte-identical. | test |
| AC-6 | The desk shows the F2 panel with byte-exact copy, no Retry, no HTTP line and `role="status"`. After the first 503 it makes no further B2 requests for 60 s, proven by a network assertion. | test |
| AC-7 | The scanner cadence line follows F3 when paused, and stays today's line when live. | test |
| AC-8 | A non-paused cold-start failure still shows today's warning panel with Retry. | test |
| AC-9 | Deploy smoke and the nightly conformance specs pass in both modes. | test |
| AC-10 | The paused panel passes axe in both schemes at 393 and 1280, with zero waivers. | test |

## 5. After merge (owner-approved 2026-09-23, plan A step 3)

Set Railway `MARKET_DATA_MODE=paused` on `api-rust` in production. Then verify:

- `/api/health` reports `market_data: "paused"`;
- the live `/ticker` shows the paused panel;
- Railway logs show no `massive` lines for 5 minutes.

To reverse it later, set `live` with a working key. No code change is needed.
