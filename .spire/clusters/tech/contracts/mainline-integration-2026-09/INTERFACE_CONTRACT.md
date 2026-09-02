# mainline-integration-2026-09 — interface contract

**Status:** locked 2026-09-01 (owner-directed integration; no council). This feature introduces **no new
FE↔BE field**. The single FE↔BE truth is the **union of the already-locked contracts** of the records it
lands: the six branch records under `contracts/_archive/` (day-replay-mock-adapter,
exchange-holiday-calendar, massive-flat-file-keep, research-lab-surface, session-day-tape-capture,
archive-coverage-guardrails-research-read) and the `main` line's archive-coverage-guardrails. The merged
backend must emit exactly what each of those contracts promised, at the same time.

## 1. Binding rule

- Every probe below is copied verbatim from a promoted conformance spec under
  `.spire/clusters/tech/state/conformance/`: day-replay-mock-adapter (branch, 5 probes); exchange-holiday-calendar (branch, 5 probes); massive-flat-file-keep (branch, 6 probes); research-lab-surface (branch, 7 probes); session-day-tape-capture (branch, 5 probes); archive-coverage-guardrails (branch, 5 probes); archive-coverage-guardrails (main, 1 probe).
- The per-feature JSONs stay authoritative and are ALSO run one by one at GATE Q with
  `interface_conformance --spec`; this block exists so one `--contract` run covers the whole
  regression surface of the merge.
- A FAIL on any probe is a GATE Z bounce to Backend (the merge dropped or reshaped a surface one of
  the two lines had shipped). Do not amend a probe to make it pass; the archived contract owns it.

## 2. Surfaces that must coexist after the merge

| line | surface | evidence |
|---|---|---|
| main | `/api/_metrics` session-archive coverage series; `archive-coverage-audit` and `capacity-baseline` CLIs | main promoted spec + CI job "Capacity baseline (Linux)" |
| branch | `/api/_research/session-archive/coverage`, `/api/_research/session-books/{symbol}[/book]`, `/api/_research/session-day-tape/{symbol}[/day]`, `/api/_research/flat-files/{symbol}[/extract]`; `archive-coverage`, `session-day-tape`, `session-day-replay`, `flat-files keep`, `capacity load|soak` CLIs | six branch promoted specs + their QA reports |

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}",
      "path_params": {
        "symbol": "NVDA"
      },
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "path_b_interval": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "count": "number",
        "days": "array",
        "detail": "string|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}/day",
      "path_params": {
        "symbol": "NVDA"
      },
      "query": {
        "et_date": "2020-01-02"
      },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "et_date": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "path_b_interval": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "detail": "string|null",
        "clock": "string|null",
        "path_a_trade_count": "number",
        "path_a_quote_count": "number",
        "path_a_detail": "string",
        "path_a_ticks": "array",
        "path_a_ticks[].kind": "string",
        "path_a_ticks[].ts_ns": "number",
        "path_a_ticks[].price": "number|null",
        "path_a_ticks[].size": "number|null",
        "path_a_ticks[].bid": "number|null",
        "path_a_ticks[].ask": "number|null",
        "path_a_ticks[].bid_size": "number|null",
        "path_a_ticks[].ask_size": "number|null",
        "path_a_gaps": "array",
        "path_a_gaps[].dropped": "number",
        "path_b_snapshot_count": "number",
        "path_b_gap_count": "number",
        "path_b_detail": "string",
        "path_b_snapshots": "array",
        "path_b_gaps": "array",
        "path_b_gaps[].mark": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}/day",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {
        "et_date": "not-a-date"
      },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": {
        "symbol": "ZZZZNOPE"
      },
      "query": {
        "et_date": "2000-01-01"
      },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbols": "array",
        "symbols[]": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].et_date": "string",
        "rows[].cell": "string",
        "rows[].last_readable": "string",
        "holes": "array",
        "holes[].symbol": "string",
        "holes[].et_date": "string",
        "holes[].class": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {
        "et_date": "2026-08-08"
      },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {
        "et_date": "2026-11-26"
      },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {
        "et_date": "not-a-date"
      },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/flat-files/{symbol}",
      "path_params": {
        "symbol": "NVDA"
      },
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "count": "number",
        "extracts": "array",
        "extracts[].symbol": "string",
        "extracts[].et_date": "string",
        "extracts[].class": "string",
        "extracts[].occupancy": "string",
        "extracts[].row_count": "number",
        "detail": "string|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/flat-files/{symbol}/extract",
      "path_params": {
        "symbol": "NVDA"
      },
      "query": {
        "et_date": "2020-01-02"
      },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "et_date": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "detail": "string|null",
        "trades_occupancy": "string",
        "trades_row_count": "number",
        "trades_extract": "string",
        "quotes_occupancy": "string",
        "quotes_row_count": "number",
        "quotes_extract": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/flat-files/{symbol}/extract",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {
        "et_date": "not-a-date"
      },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": {
        "symbol": "ZZZZNOPE"
      },
      "query": {
        "et_date": "2000-01-01"
      },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}",
      "path_params": {
        "symbol": "NVDA"
      },
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "path_b_interval": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "count": "number",
        "days": "array",
        "detail": "string|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "QQQ"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "IWM"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "ZZZZNOPE"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": {
        "symbol": "ZZZZNOPE"
      },
      "query": {
        "et_date": "2000-01-01"
      },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {
        "et_date": "2020-01-02"
      },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "et_date": "string",
        "source_as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "market": "object",
        "market.ticker": "string",
        "market.synchronized_spot": "number",
        "market.current_spot": "number",
        "market.timestamp": "number",
        "market.atm_iv": "number",
        "market.atm_iv_expiration": "string|null",
        "market.atm_iv_dte": "number|null",
        "market.market_phase": "string",
        "market.contracts": "array",
        "daily_bars": "array",
        "minutes": "array",
        "trades": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbols": "array",
        "symbols[]": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].et_date": "string",
        "rows[].cell": "string",
        "rows[].last_readable": "string",
        "holes": "array",
        "holes[].symbol": "string",
        "holes[].et_date": "string",
        "holes[].class": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}",
      "path_params": {
        "symbol": "NVDA"
      },
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "path_b_interval": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "count": "number",
        "days": "array",
        "detail": "string|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}/day",
      "path_params": {
        "symbol": "NVDA"
      },
      "query": {
        "et_date": "2020-01-02"
      },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbol": "string",
        "et_date": "string",
        "watchlist": "array",
        "watchlist[]": "string",
        "path_b_interval": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "detail": "string|null",
        "clock": "string|null",
        "path_a_trade_count": "number",
        "path_a_quote_count": "number",
        "path_a_detail": "string",
        "path_a_ticks": "array",
        "path_a_ticks[].kind": "string",
        "path_a_ticks[].ts_ns": "number",
        "path_a_ticks[].price": "number|null",
        "path_a_ticks[].size": "number|null",
        "path_a_ticks[].bid": "number|null",
        "path_a_ticks[].ask": "number|null",
        "path_a_ticks[].bid_size": "number|null",
        "path_a_ticks[].ask_size": "number|null",
        "path_a_gaps": "array",
        "path_a_gaps[].dropped": "number",
        "path_b_snapshot_count": "number",
        "path_b_gap_count": "number",
        "path_b_detail": "string",
        "path_b_snapshots": "array",
        "path_b_gaps": "array",
        "path_b_gaps[].mark": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-day-tape/{symbol}/day",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {
        "et_date": "not-a-date"
      },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": {
        "symbol": "ZZZZNOPE"
      },
      "query": {
        "et_date": "2000-01-01"
      },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbols": "array",
        "symbols[]": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].et_date": "string",
        "rows[].cell": "string",
        "rows[].last_readable": "string",
        "holes": "array",
        "holes[].symbol": "string",
        "holes[].et_date": "string",
        "holes[].class": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {
        "et_date": "2020-01-02"
      },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {
        "et_date": "not-a-date"
      },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": {
        "symbol": "SPY"
      },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": {
        "symbol": "ZZZZNOPE"
      },
      "query": {
        "et_date": "2000-01-01"
      },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_metrics",
      "path_params": {},
      "query": {},
      "required": {
        "session_archive_coverage.status": "string",
        "session_archive_coverage.status_detail": "string|null",
        "session_archive_coverage.data_stale": "boolean",
        "session_archive_coverage.activation_et_date": "string",
        "session_archive_coverage.checkpoint_et": "string",
        "session_archive_coverage.lookback_eligible_sessions": "number",
        "session_archive_coverage.evaluated_at_et": "string|null",
        "session_archive_coverage.last_verified_at_utc": "string|null",
        "session_archive_coverage.range.start_et_date": "string|null",
        "session_archive_coverage.range.end_et_date": "string|null",
        "session_archive_coverage.required_symbols[]": "string",
        "session_archive_coverage.counts.expected": "number|null",
        "session_archive_coverage.counts.present": "number|null",
        "session_archive_coverage.counts.readable": "number|null",
        "session_archive_coverage.counts.missing": "number|null",
        "session_archive_coverage.counts.unreadable": "number|null",
        "session_archive_coverage.counts.not_due": "number|null",
        "session_archive_coverage.books[].symbol": "string",
        "session_archive_coverage.books[].et_date": "string",
        "session_archive_coverage.books[].status": "string",
        "session_archive_coverage.books[].source_as_of": "string|null",
        "session_archive_coverage.per_symbol[].symbol": "string",
        "session_archive_coverage.per_symbol[].last_readable_et_date": "string|null",
        "session_archive_coverage.per_symbol[].last_readable_source_as_of": "string|null",
        "session_archive_coverage.per_symbol[].write_failures_since_observation": "number",
        "session_archive_coverage.observation.started_at_utc": "string",
        "session_archive_coverage.observation.write_failures_total": "number"
      }
    }
  ]
}
```

## What a FAIL here means

- A `/api/_research/*` probe failing: the branch line's research surface was lost or reshaped in the merge.
- The `/api/_metrics` probe failing: the main line's coverage series was lost while wiring the branch's coverage route.
- Both failing on the same coverage field: the two coverage implementations were merged into one that
  satisfies neither contract; bounce, do not pick a winner silently.
