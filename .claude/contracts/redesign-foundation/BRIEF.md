# redesign-foundation — brief
Goal:            Adopt the Claude Design full-app visual redesign (exported as a standalone HTML bundle at
                 `C:\Users\rodri\OneDrive\Desktop\Convexa (standalone).html`) into the real React/MUI app —
                 starting with the SHARED FOUNDATION + first surfaces. Extract the export's design-token
                 system into `apps/dashboard/src/app/theme.ts` (+ shared primitives): darker base
                 `--bg #0a0f16`, a `--panel/--panel2/--raise` elevation ladder, a three-tier text hierarchy
                 `--tx/--tx2/--tx3`, the accents (blue `#4f9cff`, cyan `#38bdf8`, green `#2ecc71` calls,
                 red `#ff5c5c` puts, amber, violet `#7b5cff`), and **Roboto Mono for numerics**. Then reskin
                 the LANDING (`landing/`) and the persistent APP SHELL / nav (`shell/AppShell.tsx`) as the
                 first consumers. This establishes the token→theme mapping + the component-reskin pattern
                 (match the export visually while preserving every `data-testid`, behavior, and degraded
                 state) that the later per-surface redesign features (Ticker, Positions, Scanner,
                 Settings/auth) reuse. Purely visual — no product behavior, no backend, no scoring change.
Decision impact: N/A (UX / brand / first-impression class — like `rebrand-convexa` / `app-shell-landing`;
                 judged on product polish + brand coherence, not trading edge).
Feasibility:     pass — FE-only (`NO_BACKEND_CHANGE`, consumes existing endpoints). NOTE: the export is a
                 COMPILED SPA bundle (601 KB, "Bundled Page"), so it is a VISUAL REFERENCE to re-implement
                 in MUI, NOT drop-in source; the UX/FE lanes must render it (open in a browser / screenshot)
                 to read exact layouts. Token values + fonts already extracted at Discovery. The risk is
                 integration fidelity + not regressing the test suite / degraded states / isolation — owned
                 by the Architect's integration shape.
Effort:          L for the whole app — PHASED; THIS feature = foundation (theme tokens) + Landing + AppShell
                 only (M). Later surfaces are separate features (see Source / the program in BACKLOG).
Invariant watch: additive-keeps-score-byte-identical (visual only — `apps/api` untouched; score / tier /
                 `state_fingerprint` byte-identical; no datum/setting becomes a scoring input),
                 live-vs-static-isolation (every redesigned live tile keeps dim + `⏸ offline` degrade while
                 static reads keep rendering the last bundle — the reskin must not regress this),
                 no-real-order-path (SIMULATED labels + the honest non-navigating "coming soon"
                 brokerage/Scanner surfaces stay non-functional + visually honest),
                 operator-vs-trader-path-separation (`/_ops/metrics` stays off the shell + untouched),
                 loss-free-durable-migration (NO durable key/shape change — keys stay `convexa.*`),
                 server-side-gate-enforcement + secret-encrypted-at-rest (flagged for the PROGRAM — when
                 the Settings/auth surface is redesigned, the AI-key field stays write-only/masked + the
                 server gate holds; out of THIS feature's scope).
Context tags:    frontend,ui,conventions,features
Entry point:     architect-first — the pivotal call is the TECHNICAL SHAPE of folding an external compiled
                 design into a tested MUI app (token-extraction strategy, theme-level vs per-component,
                 refactor boundaries, `data-testid` / behavior / degraded-state preservation, the isolation
                 invariants), not product behavior (which barely changes).
Source:          Owner-directed (2026-06-29): "We had Claude Design redesign the whole website visually …
                 implement it." The Claude Design HTML export on the owner's Desktop. Feature 1 of a phased
                 UI-REDESIGN program: (1) foundation + Landing + AppShell ← THIS · (2) Ticker/GEX viewer ·
                 (3) Positions · (4) Scanner + Settings/auth.
