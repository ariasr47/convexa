# redesign-ticker — brief
Goal:            Reskin the **Ticker / GEX viewer (`/ticker/:symbol`)** to the new Convexa (Claude
                 Design) visual language established by `redesign-foundation` — match the canonical
                 design (DESIGN_HANDOFF §3 "Ticker / GEX viewer"; reference screenshots
                 `02-ticker.png`, `10-ticker-offline.png`, `11-ticker-stale.png`,
                 `12-ticker-trade-dialog.png`; standalone `Convexa (standalone).html`). **Re-lay-out
                 only — KEEP the existing SSE/poll lifecycle, payload-gap watchdog, skeleton-first
                 cold-load, and live-vs-static isolation entirely.** In scope (reskin only — preserve
                 every `data-testid`, behavior, tooltip string, degraded state):
                 - **Control bar** (Ticker input, Expirations multiselect, Persona picker, "View AI
                   hand-off", Dark-pool switch). **Do NOT build the prototype's "Connection (demo)"
                   segmented control — it is demo-only; the real live/stale/offline states come from
                   the stream.**
                 - **Status row:** regime chip + exactly one connection chip (live cyan-pulsing /
                   stale amber banner+session chip / offline amber "⚠ Live offline — reconnecting…").
                 - **Headline** `TSLA · $386.23` (mono) + `(levels @ … · expirations)` + the
                   display-only **last-trade readout** (`● Last trade $386.01` / `⏸` dimmed offline /
                   honest "no recent print") — last-trade NEVER feeds the anchor.
                 - **Tiles split into two labeled groups** (redesign delta — today one grid): **Live
                   tape** (Net flow 5m, Spread, Gamma flip live, VWAP, Last trade — degrade on
                   offline) and **Dealer positioning** (Call/Put wall, Net GEX, Net DEX, Max pain,
                   IV/HV, Vol/OI, IV skew, Term structure, Opportunity — snapshot, never live). Each
                   tile: 3px left accent, label + existing `ⓘ` tooltip (verbatim), 19px mono value.
                 - **GEX strike profile** (`gex-profile-chart.tsx`, recharts) — horizontal
                   net-GEX-by-strike, green call-dominated / red put-dominated, wall hairline,
                   spot/flip/live reference lines labeled at the right edge, legend, optional DEX
                   series.
                 - **Term structure** card + **AI recommendation** card side-by-side (persona select,
                   "View what's sent", signed-out → "Sign in to ask AI" CTA that **opens the auth
                   modal** — owned by the parallel `redesign-auth` session, do not touch it; signed-in
                   → rec/no_trade states). Keep `AiRecPanel` + `useAiRecommendation` wiring.
                 - **"View what's sent" tray** (`StateExportDrawer`) — right slide-out, privacy line,
                   Copy all + 3 COPY sections; read-only, no LLM call.
                 - **Fresh positioning (Vol/OI)**, **Off-exchange blocks**, **Setups** (severity-badge
                   cards) — keep data + copy.
                 - **Open-simulated-position dialog** (shared `ghost-trade/TradeEntryDialog.tsx`) —
                   reskin; SIMULATED, paper-only disclaimer, **no real-order affordance ever**.
                 OUT: the embedded **Positions portfolio + ghost-trade panel** internals (line 153 —
                 "render as today"; reskinned later in feature 3 `redesign-positions`); the **auth
                 modal** (parallel `redesign-auth` session). Files: primarily
                 `apps/dashboard/src/app/ticker/TickerDashboard.tsx` + `gex-profile-chart.tsx`, plus
                 the ticker-rendered cards (`ai-rec/AiRecPanel.tsx`, `ai-rec/StateExportDrawer.tsx`)
                 and the shared `ghost-trade/TradeEntryDialog.tsx`.
Decision impact: N/A (UX / brand class — like `redesign-foundation`; judged on product polish + brand
                 coherence, not trading edge).
Feasibility:     pass — FE-only **NO_BACKEND_CHANGE** (consumes existing `/api/ticker` + `/api/stream`
                 + AI-rec endpoints unchanged). Architecture settled by `redesign-foundation` (token
                 reuse + the reskin convention). Canonical design = standalone HTML + DESIGN_HANDOFF
                 §3 + the 02/10/11/12 screenshots — the UX/FE lanes render them for exact layout. Risk
                 is integration fidelity + NOT regressing the ticker suites (`ticker-invariants`,
                 `ticker-load-experience.flow`/`.spec`) or the live-vs-static degrade machinery (the
                 densest, most stateful surface in the program).
Effort:          M–L (the richest live surface — dual tile groups, the recharts GEX profile with 3
                 reference lines, the AI tray, the full live/stale/offline/cold-load state matrix).
Invariant watch: **`live-vs-static-isolation` (HARD — the headline invariant for this surface):** live
                 tape tiles dim to ~0.45 + `⏸ offline` on stream drop, the chart live-line is removed,
                 the stale banner shows on `freshness.stale`, and the skeleton cold-load stays a
                 DISTINCT state from offline + from "unavailable this cycle"; dealer-positioning /
                 chart / static reads keep rendering the last bundle. `additive-keeps-score-byte-
                 identical` (visual only — `apps/api` untouched; no control becomes a scoring input).
                 `best-effort-isolated-or-null` (each metric independently nullable → its own
                 "unavailable this cycle"). **`live-spot=NBBO-mid`** (the last-trade readout is
                 display-only — the mid stays the anchor for headline/levels/flip). `no-real-order-
                 path` (the trade dialog stays SIMULATED + disclaimer). `server-side-gate-enforcement`
                 (the "ask AI" gate must not be weakened — the CTA opens the auth modal; the server
                 stays the boundary). `operator-vs-trader-path-separation` (do NOT add the demo
                 connection control). `loss-free-durable-migration` (no durable key/shape change).
Context tags:    frontend,ui,ticker,observability,conventions,features
Entry point:     **GATE V fast-path** (UX → Frontend; skip PM/Architect/math) — a visual reskin of an
                 existing, fully-built surface, NO_BACKEND_CHANGE, architecture already settled by
                 feature 1.
Source:          Owner-directed (2026-06-29): "we will do ticker" (corrected from an earlier
                 misstatement of "positions"). Feature 2 of the phased UI-REDESIGN program (BACKLOG):
                 (1) `redesign-foundation` (theme + Landing + AppShell) ← built, in owner preview · (2)
                 **`redesign-ticker` ← THIS** · (3) `redesign-positions` · (4) `redesign-scanner-
                 settings`. The auth modal is a parallel `redesign-auth` session (OUT of this scope).
