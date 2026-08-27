# Production session-book coverage audit — 2026-08-26

## Purpose

Read-only audit of Convexa's production session-book archive for `SPY`, `QQQ`, and `IWM`.
No vendor fetch or production write was performed. Secrets and credential values were not recorded.

## Expected coverage window

- Production first opened the archive index plus filesystem body store on 2026-08-22 at 07:59 UTC.
- August 22–23 were weekend dates, so the first eligible ET trading date was 2026-08-24.
- At audit time the expected matrix was 3 symbols × 3 weekdays = **9 live books**.
- The `SPY` fixture dated 2020-01-02 is conformance data and is excluded.

## Coverage result

| Symbol | Aug 24 | Aug 25 | Aug 26 | Live coverage |
|---|---:|---:|---:|---:|
| SPY | missing | missing | present | 1 / 3 |
| QQQ | present | present | present | 3 / 3 |
| IWM | present | present | present | 3 / 3 |
| **Total** | **2 / 3** | **2 / 3** | **3 / 3** | **7 / 9 (77.8%)** |

All seven live books and the conformance fixture loaded successfully. Every research read reported
`vendor_called=false`.

## Stored-body profile

| Symbol/date | Source time (UTC) | Contracts | Daily bars | Minutes | Trades | Approx. JSON |
|---|---|---:|---:|---:|---:|---:|
| SPY 2026-08-26 | 18:24:21 | 13,288 | 277 | 2,246 | 38,193 | 7.38 MB |
| QQQ 2026-08-24 | 04:00:42 | 11,510 | 275 | 1,828 | 0 | 3.55 MB |
| QQQ 2026-08-25 | 04:00:27 | 11,186 | 276 | 1,822 | 0 | 3.36 MB |
| QQQ 2026-08-26 | 04:01:00 | 11,260 | 276 | 1,816 | 0 | 3.38 MB |
| IWM 2026-08-24 | 04:00:44 | 5,460 | 275 | 1,543 | 0 | 1.74 MB |
| IWM 2026-08-25 | 04:00:29 | 5,312 | 276 | 1,531 | 0 | 1.67 MB |
| IWM 2026-08-26 | 04:01:01 | 5,206 | 276 | 1,506 | 0 | 1.66 MB |

The seven live responses total approximately **22.74 MB**. Midnight-ET captures are valid
first-wins books, but represent start-of-day rather than end-of-session state.

## Root cause

- The archive logged repeated filesystem `Permission denied` failures on August 24–26.
- The SPY ensure path reported successful intraday appends while the session archive stayed missing.
- Postgres later hit `No space left on device`, amplifying the incident after the first archive failure.
- The ownership repair deployed August 26; a normal non-root restart then stored and loaded all three
  current books without permission failures.

## Recoverability

The exact SPY books for August 24–25 are **not recoverable from retained Convexa data**. The bounded
ring now contains only August 26 SPY snapshots, and the filesystem adapter rewrites the retained file
after pruning. Massive's option-chain snapshot endpoint has no historical date parameter, so it cannot
replay the original full-chain Greeks, IV, open interest, or `source_as_of`.

Historical bars and selected contract activity could form a partial research reconstruction, but any
such artifact must be separately provenance-labeled and must never be inserted as a `live_massive`
session book.

## Storage baseline

| Railway volume | Mount | Used | Capacity | Utilization |
|---|---|---:|---:|---:|
| Postgres | `/var/lib/postgresql/data` | 1,093 MB | 5,000 MB | 21.9% |
| API durable data | `/data` | 8,957.78 MB | 50,000 MB | 17.9% |

The live books account for about 22.74 MB of the 8.96 GB API volume. Directory-level measurement is
still required to attribute the remaining bytes; the 48-entry multi-symbol rings are the leading
architectural hypothesis, not a measured conclusion.

## Recommended next implementation

Build `archive-coverage-guardrails` without trader UI changes or a paid monitoring subscription:

1. Read-only operator coverage metrics for expected/present/missing identities, last readable book,
   and write failures for SPY/QQQ/IWM.
2. One deduplicated structured warning per missing symbol/session after an ET checkpoint.
3. A local read-only audit command that prints the same matrix and exits nonzero for gaps/unreadable books.
4. Railway volume warning/critical thresholds in the operations runbook.
5. Strict separation and provenance labeling for any future partial reconstruction.
