# Production session-book coverage audit — 2026-08-26

## Purpose

Read-only audit of Convexa's production session-book archive for `SPY`, `QQQ`, and `IWM`.
The audit answers four questions:

1. When was production actually capable of storing books?
2. Which eligible ET trading dates are present or missing?
3. Are the stored bodies readable and useful?
4. Can missing books be recovered without inventing historical data?

No vendor fetch or production write was performed by the research endpoints used here.
Secrets and credential values were not recorded.

## Expected coverage window

- The archive code first reached production on 2026-08-21, but that deployment logged
  `SESSION_CHAIN_ARCHIVE_BODY_ROOT unset`; the archive was not storing and the ensure worker did
  not start.
- A production deployment first opened the Postgres archive index with a filesystem body store on
  2026-08-22 at 07:59 UTC.
- 2026-08-22 and 2026-08-23 were weekend dates.
- Therefore the first eligible ET trading date was **2026-08-24**.
- As of the audit on 2026-08-26, the expected live matrix is 3 symbols × 3 weekdays = **9 books**.
- The `SPY` fixture dated 2020-01-02 is conformance data and is excluded from live coverage.

## Coverage result

| Symbol | Aug 24 | Aug 25 | Aug 26 | Live coverage |
|---|---:|---:|---:|---:|
| SPY | missing | missing | present | 1 / 3 |
| QQQ | present | present | present | 3 / 3 |
| IWM | present | present | present | 3 / 3 |
| **Total** | **2 / 3** | **2 / 3** | **3 / 3** | **7 / 9 (77.8%)** |

All seven live books and the one conformance fixture listed by production loaded successfully.
Every research read reported `vendor_called=false`.

## Stored-body profile

The sizes below are UTF-8 sizes of the operator API's decoded JSON response, so they are a close
logical-size estimate rather than an exact filesystem byte count.

| Symbol/date | Source time (UTC) | Contracts | Daily bars | Minutes | Trades | Approx. JSON |
|---|---|---:|---:|---:|---:|---:|
| SPY 2026-08-26 | 2026-08-26 18:24:21 | 13,288 | 277 | 2,246 | 38,193 | 7.38 MB |
| QQQ 2026-08-24 | 2026-08-24 04:00:42 | 11,510 | 275 | 1,828 | 0 | 3.55 MB |
| QQQ 2026-08-25 | 2026-08-25 04:00:27 | 11,186 | 276 | 1,822 | 0 | 3.36 MB |
| QQQ 2026-08-26 | 2026-08-26 04:01:00 | 11,260 | 276 | 1,816 | 0 | 3.38 MB |
| IWM 2026-08-24 | 2026-08-24 04:00:44 | 5,460 | 275 | 1,543 | 0 | 1.74 MB |
| IWM 2026-08-25 | 2026-08-25 04:00:29 | 5,312 | 276 | 1,531 | 0 | 1.67 MB |
| IWM 2026-08-26 | 2026-08-26 04:01:01 | 5,206 | 276 | 1,506 | 0 | 1.66 MB |

The seven live responses total approximately **22.74 MB**. The midnight-ET captures are valid
first-wins books, but they should be treated as start-of-day state, not as end-of-session state.

## Root cause of the two gaps

- On 2026-08-24 the archive repeatedly logged `Permission denied` while writing body files.
  The audited deployment contained 369 such failures from 04:00 through 17:51 UTC.
- The SPY ensure path repeatedly reported that the intraday append succeeded but the session archive
  remained missing.
- Later deployments produced at least 5,000 permission failures across 2026-08-24/25, 828 more into
  2026-08-26, and at least 5,000 more on 2026-08-26 before the ownership repair.
- Postgres also hit `No space left on device` on 2026-08-24 and then connection-pool timeouts. This
  amplified the incident, but the first SPY archive failure preceded the disk-full errors.
- The ownership repair deployed on 2026-08-26. A normal non-root restart then stored and loaded the
  current SPY, QQQ, and IWM books with no permission errors.

## Recoverability

### Exact SPY session books for Aug 24 and Aug 25

**Not recoverable from the currently retained Convexa data.** The intraday ring is capped at 48
snapshots per symbol. Production currently contains only Aug 26 SPY snapshots, so the Aug 24/25
bodies have already been pruned. The filesystem adapter rewrites the retained symbol file after
pruning; the operator API confirms the old identities are no longer loadable.

Massive's Option Chain Snapshot endpoint has no historical date parameter and its documentation
marks history as not applicable. It can return current chain state, Greeks, implied volatility,
quotes, trades, and open interest, but it cannot replay the exact chain snapshot Convexa would have
received on Aug 24 or Aug 25:

- https://massive.com/docs/rest/options/snapshots/option-chain-snapshot
- https://massive.com/docs/rest/options/snapshots/option-contract-snapshot

Exact recovery remains possible only if a separate pre-prune database/volume backup contains the
original serialized bodies.

### Partial historical reconstruction

Massive documents historical stock aggregates and per-contract options aggregates/trades/quotes:

- https://massive.com/docs/rest/stocks/aggregates/custom-bars
- https://massive.com/docs/rest/options/overview

Those endpoints could reconstruct underlying bars and selected contract activity, but not the exact
full-chain Greeks/IV/open-interest state or original `source_as_of`. Any such output must be stored as
a separately labeled reconstructed research artifact. It must **not** be inserted into the session
archive as a `live_massive` book, because that would falsify provenance and make backtests look more
complete than the evidence really is.

## Storage baseline

| Railway volume | Mount | Used | Capacity | Utilization |
|---|---|---:|---:|---:|
| Postgres | `/var/lib/postgresql/data` | 1,093 MB | 5,000 MB | 21.9% |
| API durable data | `/data` | 8,957.78 MB | 50,000 MB | 17.9% |

Production stores the bounded intraday ring at `/data/chain_snapshots` and session bodies at
`/data/session-chain-archive`. The live session-book responses account for only about 22.74 MB of
the 8.96 GB API volume. A directory-level measurement inside the mounted volume is still required
to attribute the remaining bytes exactly; architecture suggests the multi-symbol 48-entry rings are
the dominant contributor, but that is an inference rather than a measured directory breakdown.

## Recommended next implementation

Build `archive-coverage-guardrails` with no trader UI and no paid monitoring subscription:

1. Expose read-only operator metrics for expected/present/missing session identities, last readable
   book, and archive write failures for SPY/QQQ/IWM.
2. Emit one structured warning per symbol/session after a defined ET checkpoint, rather than allowing
   thousands of repeated permission messages to hide the incident signal.
3. Add a read-only local audit command that exits non-zero for a missing or unreadable expected book
   and prints the same coverage matrix used in this report.
4. Add a Railway volume check to the operations runbook with warning/critical thresholds for both
   Postgres and `/data`.
5. Keep reconstructed historical artifacts separate and provenance-labeled; never silently fill an
   exact-book gap with approximated vendor history.

