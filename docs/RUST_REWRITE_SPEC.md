# Convexa Backend — Full Rust Rewrite Specification

**Status:** Canonical  
**Date:** 2026-08-09  
**Goal:** High-performance, scalable, production-grade quant backend

This document is the source of truth for the complete rewrite of the Convexa backend (`apps/api`) in Rust.

---

## 1. Decision Summary

We are performing a **complete rewrite** of the backend in Rust.

### Goals
- Maximum performance and predictability
- Sub-20 ms warm ticker views
- Near-instant live price display
- High-throughput real-time scanner
- Clean, maintainable, production-grade architecture
- Compatible with existing NX monorepo and frontend
- Deployable on Railway

### Key Architectural Decisions
- Full Rust (Axum + Tokio)
- Dual-path design (live price vs analytics)
- SIMD-accelerated GEX engine
- Structure-of-Arrays (SoA) data layout
- Aggressive warm caching
- Massive REST + WebSocket as primary data source
- Keep frontend unchanged

---

## 2. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Frontend (existing)                                         │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Rust Backend (Axum)                                         │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Live Price   │    │ Analytics    │    │ Scanner      │  │
│  │ Path         │    │ Path         │    │ Engine       │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Redis (Hot State)                                   │   │
│  │  • price:{SYMBOL}                                   │   │
│  │  • gex:{SYMBOL}                                     │   │
│  │  • score:{SYMBOL}                                   │   │
│  │  • chain meta / TTL tracking                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Quant Engine (SIMD)                                 │   │
│  │  GEX • Max Pain • Walls • Flip • DEX • etc.         │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Massive Adapter                                     │   │
│  │  REST snapshots + Stocks WebSocket                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Dual-Path Design (Critical UX Requirement)

### Path A — Live Price (must feel instant)
- Massive Stocks WebSocket streams trades/quotes
- Every update writes to Redis: `price:{SYMBOL}`
- Ticker view reads price from Redis first
- **Target: 3–15 ms**

### Path B — Analytics (GEX + Score)
- Served from warm cache when possible
- On miss: fetch chain → run Quant Engine → store result
- Can arrive slightly after the price
- Frontend renders progressively (price first, analytics second)

This separation is mandatory.

---

## 4. Core Components

### 4.1 Quant Engine
Pure, side-effect-free library.

**Must compute:**
- Net GEX, Call GEX, Put GEX
- Call Wall, Put Wall
- Gamma Flip / Zero-gamma level
- Peak GEX strike
- Max Pain (prefer nearest monthly OPEX)
- DEX (recommended)
- Higher-order Greeks (Vanna, Charm, Volga) — optional but supported
- Strike profile
- Regime tag (positive / negative / neutral)
- 0DTE contribution percentage

**Input:** Normalized contracts + spot + optional DTE / expiration filters  
**Output:** Strongly typed `GexResult`

**Performance requirements:**
- Structure-of-Arrays (SoA) layout
- Explicit SIMD on the main GEX multiply-add + reduction
- 32-byte (or 64-byte) aligned hot buffers
- Target: **0.3–2 ms** for typical liquid chains
- Use Massive-provided gamma (do not recompute Black-Scholes gamma unless missing)

**Primary GEX formula (SpotGamma-style):**
```text
dollar_gex = gamma * oi * 100 * spot² * 0.01
calls: positive
puts:  negative
```

### 4.2 Massive Adapter
- REST: option chain snapshots (`list_snapshot_options_chain`), aggregates, reference data
- WebSocket: Stocks trades + quotes (respect 1-connection personal tier limit)
- Correct market-phase handling for spot selection (RTH / after_close / closed_pre)
- Robust reconnection, heartbeat, and gap handling
- Normalize vendor payloads into clean internal types

### 4.3 Scanner
Preserve the strong two-speed design from the current system:

- **Fast lane**: Price + move detection (≈ 15–30 s)
- **Slow lane**: Full chain + GEX + score (concurrency-bounded)
- Actively keep the hottest names warm in Redis
- Heartbeats + stale detection
- Latest-wins semantics for scan rows

### 4.4 Opportunity Score
- Port the current rule-based system first (regime + level proximity + IV/HV + confluence)
- Design the feature surface so a future trained model can replace or blend with it
- Emit opportunity score (0–100) + tier (`dormant | watch | actionable | prime`)
- Keep explainable setups / rationale for the AI layer

### 4.5 State Layer
- **Redis**: Hot prices, GEX profiles, scores, scanner rows
- **Postgres**: Durable data, auth, historical IV samples, etc.
- Clear TTLs and invalidation rules

### 4.6 API Surface
- REST endpoints compatible with current frontend contracts (or cleanly versioned)
- WebSocket for live price push + progressive analytics delivery
- Auth (port existing model)

---

## 5. Performance & Optimization Rules

1. Use **Structure-of-Arrays (SoA)** for all hot numerical work
2. Apply **explicit SIMD** on the GEX kernel (portable `std::simd` or equivalent)
3. Target **AVX2**-level SIMD — do **not** depend on AVX-512
4. Align hot buffers to 32 or 64 bytes
5. Prefer cache hits over recomputation
6. Keep the live price path completely independent of the GEX path
7. Measure everything (compute time, cache hit rate, end-to-end latency)

### Target Latencies (Warm)
| Path                         | Target      |
|-----------------------------|-------------|
| Live price                  | < 15 ms    |
| Full ticker view (price+GEX)| < 25 ms    |
| GEX compute (liquid chain)  | < 2 ms     |

---

## 6. Caching Strategy

| Key              | Content                          | Policy                          |
|------------------|----------------------------------|---------------------------------|
| `price:{SYM}`    | Last price, bid, ask, timestamp  | Overwrite on every update      |
| `gex:{SYM}`      | Full `GexResult`                 | 5–15 s (tiered by liquidity)   |
| `score:{SYM}`    | Opportunity score + tier         | Same as GEX                    |
| `chain:{SYM}`    | Optional normalized chain        | Short TTL                      |

The scanner must actively refresh the top tier of names so the most important tickers stay warm.

---

## 7. Project Structure

```text
apps/
  api-rust/                     # Main Axum service
    src/
      main.rs
      routes/
      handlers/
      services/
        scanner/
        price_stream/
        ticker/
      domain/
      infrastructure/
        massive/
        redis/
        postgres/
    Dockerfile
    Cargo.toml

libs/
  quant-engine/                 # Pure compute crate (highly recommended)
    Cargo.toml
    src/
      lib.rs
      gex.rs
      max_pain.rs
      types.rs
      simd.rs
```

Start with `quant-engine` as a separate crate so it can be tested in isolation with golden fixtures.

---

## 8. Technology Choices

| Concern              | Choice                                      |
|----------------------|---------------------------------------------|
| Web framework        | Axum                                        |
| Async runtime        | Tokio                                       |
| Serialization        | serde + serde_json                          |
| HTTP client          | reqwest                                     |
| WebSockets           | tokio-tungstenite                           |
| Redis                | redis or fred                               |
| Postgres             | sqlx                                        |
| Logging              | tracing + tracing-subscriber                |
| Error handling       | thiserror + anyhow                          |
| SIMD                 | std::simd (portable) + scalar fallback      |
| Config               | dotenvy + figment/config                    |

---

## 9. Implementation Phases

### Phase 0 – Preparation
- Freeze major feature work on Python backend
- Extract golden test fixtures (existing signals_*.json etc.)
- Document current API contracts and WebSocket message shapes
- Define floating-point parity tolerances

### Phase 1 – Quant Engine (Highest Priority)
1. Core types (`Contract`, `GexResult`, etc.)
2. Scalar `process_gex_profile` with full parity
3. Max pain, walls, gamma flip, peak GEX
4. SoA layout + alignment
5. Explicit SIMD on hot loops
6. Comprehensive golden tests

### Phase 2 – Massive Adapter + Price Stream
- REST chain snapshots + supporting endpoints
- Stocks WebSocket → Redis price cache
- Market-phase logic
- Reconnection & resilience

### Phase 3 – Dual-Path Ticker + Caching
- Instant price from Redis
- Progressive GEX/score loading
- Warm-cache population by scanner

### Phase 4 – Scanner
- Two-speed loop
- Concurrency control
- Heartbeats & stale handling

### Phase 5 – Remaining API + Auth
- Route parity with current frontend
- Auth port
- AI context pack assembly

### Phase 6 – Hardening & Cutover
- Full parity + load testing
- Railway deployment
- Traffic switch

---

## 10. Railway Deployment Notes

- Multi-stage Dockerfile (`cargo build --release`)
- Target x86_64
- Do **not** require AVX-512
- Redis + Postgres as Railway plugins/services
- Horizontal + vertical scaling supported
- Hybrid Python+Rust also works, but this project is full Rust

**GPU offloading is not available on Railway and is out of scope.**

---

## 11. Success Metrics

- Warm ticker price visible in < 15 ms
- Warm full analytics (price + GEX + score) in < 25 ms
- GEX compute routinely < 2 ms on liquid names
- Scanner maintains a large liquid universe with high freshness
- Stable under concurrent users
- Quant outputs match (within tolerance) the current Python engine on golden fixtures

---

## 12. Explicit Non-Goals (Initial Rewrite)

- GPU offloading
- Full opportunity-score model training (keep rule engine; design for later replacement)
- Frontend changes (beyond consuming new/updated contracts)
- Changing Massive data vendor

---

## 13. Key References from Prior Analysis

- Current Python engine correctly uses Massive-provided gamma
- Max pain is already implemented as a per-expiration concept (prefer monthly OPEX)
- Opportunity score is currently rule-based and explainable
- Scanner two-speed design is strong and should be preserved
- Determinism and fingerprinting were important in the Python version — preserve the spirit of this

---

**This document is the canonical specification.**  
All implementation work should follow it unless explicitly amended.
