# index-first-defaults — brief
Goal:            Point the app's defaults at the tickers where the dealer-positioning evidence is
                 strongest. Three moves, all FE-only presentation/config: (1) the default ticker
                 (bare `/ticker` and any unset default) becomes **SPY** instead of TSLA; (2) the
                 scanner's default view is pinned to an **indexes + liquid megacaps** ordering so
                 the first screen a session sees is the strong-signal set; (3) a **one-line honesty
                 caveat** surfaces on thin/illiquid single-name tickers ("single-name dealer
                 positioning is less reliable than index reads — treat levels as context"), rendered
                 via a closed rule (e.g. off the scanner universe membership or an options-liquidity
                 floor already in the bundle), token-compliant, dismiss-not-required, never blocking.
                 A user-set `default_ticker` preference ALWAYS wins over the new default.
Decision impact: Every session now starts on the surface where the documented edge actually lives
                 (index/megacap dealer positioning), and the app stops silently implying equal
                 signal quality on thin names. Observed: bare `/ticker` lands on SPY; the scanner's
                 first paint leads with the index/megacap set; the caveat renders on a thin name and
                 not on SPY/QQQ; a saved user preference still routes wherever the user chose.
Feasibility:     pass — FE-only (route default constant, scanner default view config, one
                 conditional caption). No endpoint, no scoring input, no schema change expected.
Effort:          S
Invariant watch: theme-token-discipline (caveat + any view chrome, dark/light parity) ·
                 additive-keeps-score-byte-identical (presentation/config only; empty `apps/api`
                 diff expected — NO_BACKEND_CHANGE) · model-read-carries-its-assumptions (the caveat
                 IS this rule applied to single-name GEX — advisory framing, no doom copy) ·
                 absent-is-not-none (liquidity/universe membership unknown ≠ thin; the caveat rule
                 must not fire on "we don't know") · loss-free-durable-migration (if the default
                 interacts with the stored `default_ticker`/uiprefs shape, existing prefs carry
                 forward untouched; changing the FALLBACK only).
Context tags:    frontend,ui,features
Source:          Roadmap N3 (`docs/ROADMAP_2026-08.md`, owner-adopted 2026-08-01); evidence:
                 MARKET_REALITY_REPORT §"Where GEX works" (index-first consensus; single-name is
                 the weak case; ~56% of retail volume ≤5 DTE is the noise the 7–45 DTE frame avoids).
