# Convexa Roadmap — August 2026 (edge-first)

> Frame locked with the owner 2026-08-01: **my edge first, business later** · 10–25 h/wk ·
> willing to be the public face · minimize spend, flexible to ~$1k/mo if justified.
> Grounded in `docs/MARKET_REALITY_REPORT_2026-08-01.html` + the app's canon.
> Format: Now / Next / Later. Each item names its shape (pipeline feature vs habit vs chore),
> its cost, and the evidence for why it's on the list. The roadmap is zero-sum: what got cut
> is listed at the bottom.

## The strategy in three sentences

The app's only honest justification is the one it was built around: **measurably better
trading decisions for you** — so the next quarter optimizes signal quality on the tickers
where the evidence says the signal is real (SPX/SPY/QQQ + liquid megacaps), gets your REAL
positions into the app, and lets the outcome ledger accumulate the N that proves or refutes
the edge. The business option stays open but **gated on the ledger**: you don't sell it until
your own track record says it works — which is also the sharpest marketing story in this
market when the time comes. Distribution starts now anyway, as a cheap daily habit, because
an audience takes ~12–16 months to grow and compounds while you trade.

---

## NOW — weeks 1–2 (protect, ground, start the clock)

| # | Item | Shape | Status |
|---|------|-------|--------|
| N1 | **Deploy `main` to production** (manual runbook, set `ALLOWED_ORIGINS`, verify, then automate CD) | Chore, ~half day | Not started |
| N2 | **Trade through the app — every trade** (mirror every real trade as a sim position + decision record; the ledger can only validate what's recorded) | Habit, ~10 min/trade | Not started |
| N3 | **Index-first defaults** (default ticker SPY; scanner view pinned to indexes+megacaps; a one-line honesty caveat on thin single names) | Small GATE-V feature | Not started |
| N4 | **Start the public habit v0** (X account; one daily post: your morning read — screenshot + 3 lines; no build, hand-made) | Habit, 20–30 min/day | Not started |

Why these four: N1 is data-safety for YOUR trading history (two data-loss fixes and all
security hardening exist only on `main`; the live site is the June 29 build). N2 starts the
evidence clock — nothing downstream means anything without N. N3 is the cheapest
evidence-alignment move available (the documented edge is index-first; your app currently
defaults to single-name emphasis). N4 starts the 12-month audience compounding now at
near-zero cost, and the daily-read discipline sharpens your own trading (SpotGamma's
founder's note is the retained value of a $89–299/mo product — write yours for free, for you).

## NEXT — weeks 3–10 (edge features, through the normal pipeline)

Ordered; roughly one pipeline feature per 1–2 weeks at your capacity.

| # | Item | Shape | Why (evidence) |
|---|------|-------|----------------|
| X1 | **`broker-connect` via SnapTrade** — read-only import of YOUR real positions into the Live tab; recs/reassessment run against your real book | Full pipeline feature (council). Triggers the deferred **system-6 security review** per canon (first real-account connection) | The single biggest edge feature: the app finally sees the risk you actually carry. Cost collapsed to **$0** (SnapTrade free ≤5 connections; Webull officially partnered Dec 2025). The multi-leg model rebuild was sequenced exactly for this |
| X2 | **`vol-normalized-gex`** — vol-normalize the GEX read; intraday-recompute where the data allows; a public-ready "how we compute this & where it fails" methodology note | GATE-M-shaped (math, BE-heavy) | The independent backtest found raw GEX had NO predictive power while vol-normalized did; staleness is the market's #1 churn complaint. This moves you from the discredited version of the idea toward the defensible one |
| X3 | **`alerts` v1** — level-touch / tier-change / score-gate, delivered simply (browser + email or a personal Discord webhook) | Medium feature | For YOUR timing first (you can't watch the screen all day at 10–25 h/wk); later it's the table-stakes feature every rival has |
| X4 | **First ledger checkpoint** — at N≥20 closed outcomes: read the track record honestly; if (and only if) it justifies one, make the first deliberate score change (e.g. `iv_rank.band` into the score) under `[score-change-is-deliberate-and-measured]` | Analysis + possible GATE-M | The score's constants have never been validated against an outcome; the ledger was built to fix exactly this. This is the app eating its own cooking |

## LATER — months 3–6 (the business option, exercised only if gates pass)

| # | Item | Gate to start it |
|---|------|------------------|
| L1 | **Automate the daily artifact** (the app renders the morning read: levels + regime + event calendar → image/text you post in one tap) | N4 habit has held ~4+ weeks by hand |
| L2 | **Databento OPRA swap evaluation** ($199/mo; compute greeks in-house — unifies the two-gamma split, enables true intraday GEX, and is the licensing-clean path to commercialization) | X2 shipped; only commit if going commercial OR if in-house greeks measurably improve the read |
| L3 | **Public track-record page** (the outcome ledger, published: Wilson intervals, no window-shopping — "we publish our record, nobody else will") | Ledger N≥50 AND the record is honest enough to show (either direction — a published negative is still credible content) |
| L4 | **Free tier + billing + ToS/disclaimers** ($29–49 founding tier; AI framed as *explains*, never *tells you what to trade*) | X-follower/Discord pulse exists AND your own ledger says the app helps AND data licensing confirmed in writing |
| L5 | **TradingView level export** + account-scoped durable stores (tech-debt #21) | First external users exist |

## Budget — the two variants you asked for

| | **Cheap path (status quo)** | **Sub-$1k path** |
|---|---|---|
| Market data | Massive current plan (personal-use — **legal while it's just you**): ~$199 | Massive $199 **+ Databento OPRA $199** (in-house greeks, intraday GEX, commercial-clean); drop Massive after migration → settles back to ~$199–250 |
| History/backtests | — (60d bars in hand) | ThetaData Value/Standard $40–80 (optional, for validating X2 against history) |
| Broker import | SnapTrade **$0** (free ≤5 connections — covers all your own accounts) | Same, $0 |
| AI | BYO Anthropic key (your usage, ~$5–20) | Same |
| Hosting | Railway + Cloudflare Pages ~$10–25 | Same, maybe $25–50 with the worker on |
| **Total /mo** | **≈ $215–245** | **≈ $450–550 during migration, ~$250–350 steady-state** |

Both paths: **$0 on distribution** (X + Discord are free; the artifact is your own app's
output). The only trigger for spending beyond this is L4 — commercialization — which brings
the written-licensing requirement with it.

## Explicitly cut / parked (zero-sum honesty)

- **0DTE arms race** (per-second recalc à la Gexbot) — different product, different data bill; your 7–45 DTE frame is the niche.
- **Ticker breadth chasing** (3,500 tickers) — evidence says single-name GEX is the weak case; depth on few > breadth on many.
- **Direct broker integrations** (Schwab/IBKR/Webull-direct) — SnapTrade made them negative-ROI; Schwab's review specifically scrutinizes AI-rec apps.
- **Showing real-time quotes/chains to others** — structurally not an indie feature ($650–1,500/mo OPRA floor).
- **Real order execution** — `[no-real-order-path]` stands; read-only only.
- **`signed-out-refused-affordances`** (queued small fix) — displaced; it only matters when strangers use the app. Revisit at L4.
- **Mobile app** — PWA-polish at most, later.

## Kill / continue criteria (pre-committed)

- **Edge test (day ~90):** ledger N≥30 with the app-guided process ≥ your baseline (or clearly improving decision quality by your own read) → keep investing. Flat/negative → the app is a dashboard, not an edge; fix the signal (X2/X4) before adding anything else.
- **Business test (month ~4–6):** daily posting held ≥8 weeks AND ≥500 followers or ≥100 Discord members → exercise L3/L4. Otherwise stay edge-only; the instrument keeps its value either way.
- **Spend test:** any recurring cost above ~$550/mo needs either revenue or a measured edge improvement to justify it.

## This week, concretely

1. Deploy (N1) — run `docs/DEPLOY_RUNBOOK.md`, set `ALLOWED_ORIGINS=https://convexa.pages.dev`, verify, done.
2. Pick the X handle, post read #1 (N4). Imperfect is fine; the habit is the asset.
3. Mirror your next real trade in the app (N2).
4. Say `go` to the conductor to open GATE I on **N3 (index-first defaults)** — small, ships this week.
5. Then X1 (`broker-connect`/SnapTrade) goes to the council — the first big rock.
