# Convexa
## Quantitative review and path to revenue

Prepared for the founder | September 5, 2026

**Decision:** Keep one Convexa product and one shared analytics engine. Launch a small, paid market-structure workflow when its calculations and data rights are ready. Keep the advanced personal trading, broker, experimental scoring and AI trade-planning capabilities private until separately validated.

**First financial milestone:** Cover market-data APIs, hosting and AI development subscriptions. **Next:** $10,000 monthly revenue. **Stretch:** distinguish $1 million annualized revenue from $1 million collected in the first year.

Research reference: `C:\Dev\convexa`, branch `spire/curvature-v2-foundations`, commit `350ae973eada18183900a57aa15a63bb7285bd6e`. This was a read-only review while another session worked on the branch. No application code, QA files, infrastructure, subscriptions or production settings were changed by this research.

This report combines current Rust/React source, tests and dated research receipts with official provider, competitor, exchange and regulatory sources. It is a product and research assessment, not proof of investment performance. Live production behavior, account entitlements, customer demand and negotiated licensing remain unverified. Prices were checked September 5 Pacific / September 6 UTC, 2026, in USD, before tax.

### Read this first

- Convexa has useful infrastructure and a coherent vision. It is further along as a research workstation than as a validated trading signal or a sellable SaaS business.
- The core standard-contract GEX arithmetic is reasonable. Several surrounding behaviors are not: an absent gamma flip becomes current spot; explicit expiration selections are not forwarded to Rust analytics; walls can be reported without their expected sign; expiry clocks are unsuitable for precise 0DTE work.
- The score is an attention heuristic, not a probability. Existing research does not establish profitable options trading. There is also a path by which modeled simulated fills enter the ostensibly quoted-only outcome ledger.
- Sell a reliable preparation-and-review workflow, with transparent uncertainty. Do not base the initial offer on an AI that tells people what to trade or on an unproven win rate.
- Current competitors already sell GEX, scanners, explanations, community and AI. Your opportunity is a narrower customer job, demonstrable usability and accumulated trust. Those advantages still need customer validation.
- A paid pilot could be feasible in roughly 4-8 weeks after the essential fixes, a suitable license and access to prospects. With no audience or a difficult data contract, plan for 8-16 weeks or longer. These are planning estimates, not revenue promises.

### How the report is organized

1. The product you are actually building
2. Calculation audit: GEX, walls, magnets, flip and max pain
3. Backtesting, scanner and confidence
4. AI, positions and simulated trades
5. Data APIs and commercial rights
6. Competitors and a defensible offer
7. One product with public and private capabilities
8. Revenue math, distribution and launch timing
9. A 90-day action plan and release priorities
10. Evidence limits and source notes

<!-- pagebreak -->
## 1. The product you are actually building

### Your vision is coherent; the scope has accumulated

The source and decisions describe a consistent sequence: **understand options structure -> decide what deserves attention -> assess a position -> record what happened.** The early product was a single-ticker GEX dashboard. It evolved into a positions-centric assistant, then a scanner and research/replay platform, with substantial attention to trustworthy visual states. Those are related capabilities. The conflict comes from trying to prove, package and sell all of them at once.

The August roadmap recorded a personal-edge-first approach, approximately 10-25 hours a week, and willingness to spend up to roughly $1,000 monthly if justified. Later decisions prioritized preserving paid data, replay and a grounded morning read. Your current request changes the immediate commercial objective to covering operating and development-tool costs, then growing revenue. This report treats that new objective as the current direction; the old roadmap is historical context, not a restriction on exploring a paid analytics product.

Local evidence: `docs/ROADMAP_2026-08.md`; `.spire/clusters/tech/context/PROJECT_CONTEXT.md`; `BACKLOG.md`, August 19, 28 and 31 harvests; `DESIGN_SYSTEM.md`, Curvature Terminal v2 direction.

### Actual state versus the impression created by documentation

| Area | What the reviewed source supports | Commercial implication |
| --- | --- | --- |
| Analytics | Pure Rust quant library; live vendor adapter; cached bundles, structure, volatility and live-underlying context | Keep the architecture; correct semantics and input handling before selling reliability |
| Scanner and alerts | Implemented surfaces and background scanner, despite old README references to a stub | Useful launch material; simplify around a small, well-covered universe |
| Data preservation | Session books, timed chain snapshots, underlying tape, gap markers, replay and operator research browsing | Valuable research foundation; current production coverage still needs an audit |
| AI | Optional, user-key-powered recommendation flow; computed inputs, candidate contracts and partial grounding | Good basis for explanations; not a validated autonomous trader |
| Positions | Rich simulated book, order states, journal/outcomes and broker-shaped UI | Preserve for personal research; public experience can be much smaller |
| Brokerage | Rust selects a stub by default; Webull selection returns a typed placeholder fault | Do not market a functioning Webull integration from the old shipped-status notes |
| SaaS business | Accounts/settings exist; no production billing or subscription-entitlement implementation found in searched live app trees | Payment, authorization, support and licensing are separate launch work |
| Presentation | Strong instrument-oriented visual direction; current branch is under active redesign | Finish enough for a coherent task flow, not another full redesign before demand testing |

The Webull finding is direct: `apps/api/src/services/broker/mod.rs:98-124` selects `WebullPlaceholder`, whose book is `unknown` with `adapter_fault`. Historical Python-era statements that brokerage shipped do not establish that the Rust port works. Likewise, the README still describes a FastAPI backend and scanner stub, while live code uses Rust/Axum and an implemented scanner. Product promises should follow tested current behavior.

### The best initial customer

Start with an **intermediate, self-directed US retail trader who already uses a broker or charting platform, follows SPY/QQQ and a few liquid names, understands basic options, and wants a concise preparation and review process**. SPY, QQQ and IWM are ETFs, not the SPX/NDX/RUT index contracts. Do not imply index-option support merely because you support the ETFs.

A proposed customer job: “In a few minutes, show me the relevant options concentrations, what changed, which readings are uncertain, and what I should revisit after the session.” This is a hypothesis to test with interviews, not a discovered market demand.

Avoid trying to serve beginners seeking guaranteed entries, high-frequency 0DTE specialists, portfolio managers and API developers in the first release. Their data, latency, education, workflow and support needs differ substantially.

### Day trading versus swing trading

The existing 7-45 DTE framing fits swing-oriented context. A day trader may still use that context, but a true 0DTE product requires separate expiry clocks, same-day exposure slices, quote quality, intraday labels and execution assumptions. A faster refresh timer does not convert the current research into a validated day-trading system.

Use one engine with explicit horizons: session context; same-day options research; short swing context. Preserve the selected horizon throughout the displayed levels, scanner, AI explanation and evaluation. A day-trading profile can initially be private. Public launch should promise only the horizons that pass validation.

<!-- pagebreak -->
## 2. Calculation audit

### What GEX can and cannot tell you

For a standard 100-share option, a commonly used dollar-gamma exposure for a 1% underlying move is:

`GEX_i = gamma_i x open_interest_i x 100 x spot^2 x 0.01 x assumed_position_sign_i`

The units are the approximate change in dollar delta exposure for that move, not option premium, market capitalization or a directly observed future order. An option bought long has positive gamma whether it is a call or a put. The sign of a dealer's exposure depends on the dealer's position, not the option type. [OIC: Gamma](https://www.optionseducation.org/advancedconcepts/gamma), undated, accessed September 2026.

Convexa's calls-positive/puts-negative convention is an **open-interest-based positioning proxy**. Standard chain OI does not identify dealers' ownership, opening versus closing flow, multi-leg offsets or their hedges elsewhere. Recomputing gamma every second updates the model around old OI; it does not reveal new intraday dealer inventory.

Cboe's transaction-level SPX analysis explains why gross activity can coexist with small net market-maker exposure: customer purchases and sales can offset. Its findings apply to the studied SPX 0DTE sample and should not be generalized into “gamma never matters.” [Cboe, Mandy Xu: Much Ado About 0DTEs](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options), September 8, 2023.

Research on gamma fragility supports conditional relationships involving inventory proxies and liquidity; it does not validate Convexa's implementation, thresholds or executable returns. [Barbon and Buraschi: Gamma Fragility](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3725454), March 2021 revision; the abstract was available in research, but a direct full-paper retrieval failed. Treat its conclusions at that level of access.

### A. Gamma flip: fix false availability first

`libs/quant-engine/src/gamma_flip.rs:164-207` returns current spot when the IV-leg set is empty or when its searched curve has no crossing. That is not a neutral substitute: a call-only book can remain positive-gamma throughout the range yet report a flip exactly at current price. `signals.rs` then rewards proximity to a flip and may create a transition setup.

**Required behavior:** return a nullable level with a reason such as “no crossing in searched range” or “insufficient IV coverage.” A curve that is zero everywhere is not an isolated flip. If there are multiple crossings, identify the selection rule and preferably show alternatives. Missing levels must contribute no proximity points and must not enter AI as valid anchors.

The current solver samples 100 spots across +/-20%, about 0.404% spacing, then interpolates and reports cents. That presentation is more precise than the search grid and underlying model justify. Bracket and refine roots, test narrow/multiple crossings, and measure stability when IV, OI coverage and valuation conventions change. This is a source-level finding; the live UI was not exercised to reproduce it.

### B. Expiration selection: the production path drops explicit dates

The frontend sends selected expirations (`pages/ticker/useTickerBundle.ts:70`; `libs/api/src/lib/convexa.ts:1321`). Rust parses the query field (`apps/api/src/routes/market.rs:26`), but `get_ticker_bundle` forwards min/max DTE rather than selected dates (`:791`). `build_bundle` emits an empty expiration list (`:734`); analytics does not set the engine's supported expiration filter.

**Required behavior:** carry the exact requested dates into normalized inputs, cache identity, calculation and returned metadata. Verify a two-expiration fixture where selecting either date changes the known output. Return the actual included dates and coverage. A visible filter that does not change its intended calculation is a public-release blocker.

### C. Expiry clocks: unsuitable for precise 0DTE work

The analytic clock uses UTC midnight at the beginning of the expiration date (`greeks.rs:138`), then analytic gamma paths impose a one-day floor (`gamma_flip.rs:61`; `greeks.rs:86`). The 0DTE share uses less than one day remaining (`soa.rs:315`), which can include tomorrow's contracts during today's US session under that clock.

Use contract-specific last-trading and settlement timestamps, exchange timezones, holidays and half-days. Define 0DTE by the exchange session's expiration date, independently of a numerical floor. SPX and SPXW also have different expiration/settlement conventions; do not apply one equity-close rule everywhere. [Cboe: SPX product specifications](https://www.cboe.com/tradable-products/sp-500/spx-options/spx-specifications), current official specifications.

### D. Call walls and put walls: define the statistic honestly

Convexa selects the maximum and minimum **net GEX by strike** (`gex.rs:233-257`). That is a legitimate concentration statistic, but not necessarily the same as a provider's largest call-OI level, largest call-gamma level or proprietary resistance estimate. There is no universal vendor-standard definition.

The current code requires neither a positive maximum nor a negative minimum. It therefore creates a put wall in a positive-only book, and zero-OI books can still receive walls. Equal extrema depend on unordered map iteration.

**Required behavior:** choose and publish a definition, require meaningful sign and data coverage, and use deterministic tie handling. Consider reporting a tied region. Do not assume a put wall must always be below spot or a call wall above it unless that is an explicit, separate product rule. “Support” or “resistance” is a behavioral hypothesis requiring testing, not a consequence of an argmax.

### E. Magnet: concentration does not establish attraction

The magnet/peak is the strike maximizing `abs(call_GEX) + abs(put_GEX)` (`gex.rs:251`). Equal large call and put exposures can cancel net GEX while maximizing gross concentration. The signal copy also suggests stronger pinning when this peak and max pain coincide (`signals.rs:435`), without establishing the incremental predictive value of that overlap.

Default to **“largest gross gamma concentration.”** If retaining “magnet,” qualify it as a hypothesis and show its horizon and regime. Compare its touch/rejection rates against nearby round strikes, largest OI, largest absolute net gamma and random levels matched for distance. Otherwise the nearest large strike may appear predictive simply because nearby levels are easier to touch.

### F. Max pain: useful arithmetic, modest claim

For one expiration, the usual payout statistic minimizes:

`P(S) = 100 x sum[call_OI x max(S-K,0) + put_OI x max(K-S,0)]`

`max_pain.rs` implements this standard-contract calculation with deterministic ascending tie behavior. Selecting one expiration is preferable to combining unrelated tenors. The issues are calendar-adjusted expiration selection, settled contracts, missing/zero OI and flat minima that are properly ranges. The surrounding GEX early-return can also discard independently usable OI/max-pain information when gamma is unavailable.

This is aggregate intrinsic payout at expiration under the included OI, not traders' total realized pain: it excludes premiums paid, hedges, closing trades and later OI changes. Research documents strike-price clustering around option expiration, but that does not prove that this exact minimum predicts settlement or ordinary intraday targets. [Ni, Pearson and Poteshman: Stock price clustering on option expiration dates](https://experts.illinois.edu/en/publications/stock-price-clustering-on-option-expiration-dates/), Journal of Financial Economics, October 2005.

### G. Sign, metadata and model inconsistencies

| Finding | Source evidence | Action |
| --- | --- | --- |
| Public methodology reverses the implemented book | `methodology/copy.ts:34` says calls short / puts long; `types.rs:24` and `gex.rs:191` implement the opposite sign proxy | Publish exact weights and remove the contradiction |
| DEX does not use the GEX inventory weights | `gex.rs:174` sums raw signed option delta x OI; tooltip calls it dealer DEX | Use a consistent assumed portfolio or rename the statistic |
| Missing inputs become misleading zeros or disappear | `infrastructure/massive/rest.rs:978-1017` couples IV/delta to gamma availability and defaults missing OI to zero | Preserve missingness per field; compute independent measures independently |
| Contract metadata is lost | Normalization omits identity/deliverable and freshness details; core multiplier is fixed at 100 | Preserve raw identity; initially exclude unsupported adjusted contracts visibly |
| GEX and flip use different models | Current GEX uses vendor gamma; flip uses fixed-IV analytic BSM, 4.5% rate and default zero dividend yield | Measure current-spot reconciliation and model sensitivity before interpretation |

Adjusted contracts can contain cash or nonstandard deliverables; simply replacing 100 with a shares field is not sufficient in every case. [OIC: Splits, mergers, spinoffs and bankruptcies](https://www.optionseducation.org/referencelibrary/faq/splits-mergers-spinoffs-bankruptcies), current reference. Massive's historical methodology describes a binomial model with rates and dividends, which illustrates why its Greeks need not reconcile with Convexa's simpler analytic curve; confirm current model conventions with the provider. [Massive: Greeks and Implied Volatility](https://massive.com/blog/greeks-and-implied-volatility), March 22, 2022.

### H. Vol-normalized GEX is an experiment

`vol_gex.rs:116-121` divides GEX by annualized ATM IV, with HV fallback. That is a permissible feature transformation, but it is not automatically hedge dollars for a volatility-sized move. A first-order hedge-dollar estimate for a one-standard-deviation daily move would instead scale the 1% GEX by `(annual_vol / sqrt(252)) / 0.01`, under that time convention.

Because near-ATM gamma already varies approximately inversely with volatility, dividing again can amplify the volatility dependence. Any apparent improvement may come from IV itself. Compare raw GEX, IV alone, GEX/IV, GEX times daily IV and liquidity-normalized variants on the same future-only samples.

The earlier local market-reality report described naive GEX too categorically as discredited and claimed an independent normalized-GEX backtest without identifying the exact study/formula in its source list. The local X2 status also acknowledged that multiweek validation remained outstanding. **Do not carry those claims into marketing.** Use “GEX / IV, experimental” until Convexa's own results support a more specific statement. Local evidence: `docs/MARKET_REALITY_REPORT_2026-08-01.html`; `docs/research/X2_VOL_NORMALIZED_GEX_STATUS.md`.

### What mathematical verification should look like

Use independent known-answer fixtures, not only Python-to-Rust parity. Cover standard calls/puts, one-sided books, zero and absent OI, absent Greeks, selected expirations, today versus tomorrow, final-hour expiry, holidays, adjusted contracts and no/multiple roots. Check Greeks by finite differences and reconcile analytic and vendor spot exposures. Report excluded contracts and OI-weighted coverage. Parity tests can faithfully preserve an earlier mistake.

<!-- pagebreak -->
## 3. Backtesting, the scanner and confidence

### You have a research pipeline, not yet a validated trading strategy

The app has real strengths: pure shared scoring, replay through the same analytics path, captured timestamps, archived inputs, explicit exclusions and no automatic research-to-live retuning. Later work also retains underlying tape and timed chain inputs, with gap markers. These capabilities should be preserved.

However, **data capture, replay, score evaluation, probability calibration and executable strategy backtesting are different achievements.** Your current code is strongest in the first three. More elaborate UI and more rows do not close the remaining evidence gap.

### What the existing results actually say

| Dated evidence | Observed result | Correct interpretation |
| --- | --- | --- |
| August 11 deep dive | 221 rows from one ET date; score AUC 0.467 for large next-day absolute moves | Too little temporal breadth to establish skill or failure |
| Same deep dive, structure-event label | AUC 0.932, explicitly corrected for definitional coupling | The label reuses related structure; not independent alpha |
| August 20 local score-lab smoke | 1,246 samples loaded; 1,216 one-day pairs; pooled AUC 0.555, top-decile lift 1.525 | Exploratory diagnostics, not options P/L or independent trades |
| Same smoke, by symbol | IWM AUC 0.813; QQQ 0.369; SPY 0.603 | Large heterogeneity; pooled performance can hide contradictory behavior |
| Separate batch/join smoke | Mixed live and fixture books; only 2 of 18 horizon attempts paired | Pipeline smoke evidence; do not mix into the score-lab sample |

Sources: `docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md`; `data/research/score_lab_1d_smoke_20260820.json`; `batch_smoke_20260820.json`; `join_smoke_20260820.json`. The local smoke artifacts are dated evidence, not a claim about current production results.

The August 20 diagnostic counts eight ET calendar dates, including 21 one-day rows dated Saturday August 15. Its date helper counts calendar dates rather than exchange sessions. Many rows share the same subsequent close, and structure samples lack per-row vendor/fixture provenance. The effective independent sample size is unknown and far below 1,216 independent trades. Do not call those eight independent trading sessions or infer a statistically reliable edge from the row count.

The August 28 backlog put the reliable archive clock at August 26, with a proposed four-to-six-week collection milestone around September 23-October 7. That remains a **coverage checkpoint**, not proof that four weeks can validate every strategy. Audit current coverage before relying on this dated schedule.

### What the current score means

`libs/quant-engine/src/signals.rs:467-542` allocates up to 40 points for proximity to wall/flip, 25 for IV/HV deviation, 25 for setup count, 10 for near-flip and up to 6 for off-exchange confluence, subject to its final score logic. Several inputs reuse the same geometry. A cluster of points can therefore represent repeated evidence, not five independent confirmations.

Its score, tiers and hardcoded setup conviction should be presented as **attention/ranking heuristics**. A score of 80 does not mean an 80% win probability. The AI's confidence word is a different, model-generated judgment; it is not calibrated either.

Split the user-facing concepts into four distinct readings:

| Reading | Question answered | Initial implementation |
| --- | --- | --- |
| Data quality | Can I trust the inputs for this view? | Freshness, missingness, spread and coverage; hard eligibility gates |
| Setup attention | What deserves investigation? | Current explainable heuristic, corrected and decomposed |
| Forecast probability | How often does a precisely defined event occur? | Unavailable until trained/calibrated on the matching horizon and population |
| Trade feasibility | Can this proposed contract/structure plausibly be traded within the stated constraints? | Deterministic quote, liquidity, sizing and risk checks |

### Improve the scanner before retuning weights

First, suppress false precision: no fabricated flip points, no stale/uncovered row ranked as prime, and visible reasons for unavailable inputs. Show top score drivers, actual expiration set and last valid as-of. Keep stale rows visible if useful, but separate them from actionable sorting.

Second, organize by a small, liquid watchlist and explicit horizon. Add useful changes: a level moved materially, price entered a defined distance band, the regime estimate changed, or data quality recovered. Deduplicate correlated SPY/QQQ/megacap alerts so “more signals” does not mean more noise.

Third, measure which signal deserves additional weight. Distances expressed in expected move or recent volatility may transfer better than fixed percentages, but this is a hypothesis. Test each feature and its ablation against simple baselines. Avoid adding news, short interest, RL or a larger universe to compensate for unmeasured fundamentals.

### What the current backtester does not measure

`services/research/outcomes.rs:71-171` compares a capture price with the first/fifth subsequent daily close. Wall/flip labels use subsequent daily ranges, including a range initialized at the entry price. These are not same-day post-entry paths. They do not establish option returns after bid/ask, latency, slippage, fees, theta, IV changes, assignment or capital constraints.

The chronological split in `batch_backtest.rs:651-709` compares recomputed rows around a timestamp; it does not by itself fit on training data and evaluate a locked executable strategy on unseen data. The comparative module's “calibration” bins (`comparison.rs:280-309`) are score distributions without outcomes, unlike older outcome-rate bins. The large-move threshold also uses the whole evaluation sample's median (`labels.rs:92-116`). That is acceptable for descriptive diagnostics but not a future-deployable threshold fitted without leakage.

### A validation program that can change your decisions

1. **Repair and freeze.** Version formulas, universe, timestamp semantics, score weights, missing-data policy, prompts and labels. Keep old and new data distinguishable; do not silently recompute history into a better-looking version.
2. **Choose one research claim.** Example: at a fixed session time, does the corrected gamma proxy improve a 30-minute realized-volatility forecast beyond IV, prior realized volatility and time of day? Separately test level touches and rejection/breakout outcomes. Do not use “profitable” as an undefined label.
3. **Use fixed decision times and point-in-time data.** Store as-of/available-at timestamps, prior-known OI, contract identity and raw source. Add 5/15/30/60-minute horizons only where tape coverage supports them. Respect exchange calendars.
4. **Compare baselines and ablations.** Prior-day high/low, VWAP, round levels, distance-matched random levels, IV-only and existing rules are useful baselines. Evaluate GEX's incremental contribution, not only the full system.
5. **Validate through time.** Use rolling training/validation/test windows. Purge or embargo overlapping outcome horizons; keep a final untouched period and a prospective shadow period. Estimate uncertainty by session/week rather than treating correlated rows as independent.
6. **Measure the right quantity.** Ranking: lift/precision with deterministic tie handling. Probability: reliability curves, Brier/log loss and uncertainty. Trading: net expectancy, drawdown, turnover, liquidity, risk use and cost sensitivity. Report per-symbol and regime results.
7. **Promote only a defined improvement.** Compare against the frozen baseline on unseen periods and record failed experiments. Neither N=20, N=50 nor a single AUC threshold is a universal proof of a durable trading edge.

Rolling-origin methods ensure forecasts use earlier observations; repeated strategy searches can overfit even a reused holdout. [Hyndman/forecast: tsCV documentation](https://pkg.robjhyndman.com/forecast/reference/tsCV.html), current documentation; [Bailey, Borwein, Lopez de Prado and Zhu: The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf), revised February 27, 2015. These sources support the method, not Convexa's performance.

<!-- pagebreak -->
## 4. AI, positions and simulated trades

### The AI idea is good when its job is bounded

Use AI to explain a snapshot, contrast scenarios, summarize changes and help a user review a decision. The reviewed implementation already keeps AI downstream of the deterministic score and supplies computed context and candidate contracts. That separation is worth keeping.

Long-term value will come from the quality of the evidence, structured workflow, recorded context and evaluation. A provider/model choice or a fluent paragraph is easy to copy. Competitors already provide AI narratives and assistants.

A strong initial public output would say: **“These are the concentrations in the selected expirations. This changed since the prior snapshot. These inputs are missing. Here are conditions under which the current interpretation would become less useful.”** It should cite the actual snapshot, distinguish observations from inferences and abstain when the prerequisites fail.

### Current grounding is narrower than the word suggests

The LLM receives computed inputs, candidate contracts and a simulated-position digest; broker positions are explicitly excluded (`services/llm.rs:187-230`). Parsing remains permissive for several strategy fields (`:412-462`). Numeric grounding checks particular stops/invalidation against named levels and a target against an expected-move range (`rec_inputs/grounding.rs:212-287`). Max risk and position size are explicitly structurally unchecked. Cited-contract matching supports one strike/expiry/right, not full multi-leg correctness.

Grounding annotates the answer; it does not automatically veto all untraced recommendations. A target lying inside a range is not evidence that the trade direction is sensible, the contract exists, maximum loss is correct or expectancy is positive. Local source: `rec_inputs/cited.rs`; `recommendation.rs:781-865`.

**Recommended boundary:** deterministic code owns contract eligibility, price units, legs, side, quantities, maximum loss, liquidity and execution assumptions. The LLM explains the resulting structured plan. Validate the explanation and plan independently; unsupported numeric claims should produce abstention or an explicitly excluded draft.

### Measure AI as a product before measuring it as alpha

Create a frozen evaluation set spanning ordinary sessions, missing inputs, stale data, earnings, wide spreads, multi-leg positions and contradictory signals. Grade factual accuracy, citation support, invalid-contract rate, risk/size correctness, inappropriate certainty, abstention, stability, latency and cost. Compare a rules-only explanation, one low-cost model and one stronger model. Track version changes; a model update can alter behavior without a source-code change.

For an early release, reject any executable plan that violates deterministic validity checks; do not aim for a merely low average error rate on contract or maximum-loss validation. Track user usefulness separately through task completion, saved time and repeated use. Trading benefit requires an additional prospective comparison.

BYO keys are reasonable for your private lab and technical testers, but they add onboarding friction. A later public plan can include a bounded number of shared, cached explanations, provided the vendor contract permits transmitting the relevant inputs to an LLM and costs are metered. Do not offer unlimited personalized AI before its economics and controls are measured.

### Positions are useful; the public version can be small

Keep your personal positions workspace. It is where market structure becomes relevant to the risk you actually carry. For initial customers, a simple saved-thesis/journal and optional explicitly approximate paper position may be enough. Make it optional after the core scanner-to-ticker workflow, rather than an onboarding prerequisite.

Prioritize read-only broker import for yourself only if manual mirroring is a proven daily problem. The Rust Webull adapter needs real implementation and testing before being advertised. A portfolio-wide AI adviser or broker execution product creates much more operational, integration and regulatory work than a narrow analytics subscription.

### A consequential simulated-fill provenance defect

The order engine accepts modeled/theoretical option prices as live-resolvable marks (`orders/useOrderEngine.ts:36-60`). It then records an execution-mechanism label such as `limit_fill` or `trigger_fill` while discarding the original price basis. The outcome ledger treats those labels as quoted (`outcomes/ledger.ts:49-62`). The later ledger gate does not recover the missing original basis.

**Consequence:** a modeled entry can reach a quoted-only outcome summary. That undermines public performance claims even if the displayed P/L arithmetic is internally consistent. Preserve two independent fields: execution mechanism and price provenance. Classify the outcome using the worse provenance of entry and exit; keep modeled, quote-observed and actually executed records distinct.

The current mark approximation `mid + delta*dS + 0.5*gamma*dS^2` excludes time decay and volatility changes between snapshots (`model/mark.ts:112-118`). Fallback theoretical pricing floors expiry at a day. Limit orders cross a modeled mark rather than an executable bid/ask with size and queue assumptions, and frontend-driven order evaluation is limited by mounted ticker coverage. These are acceptable sandbox approximations when disclosed, but not evidence of a reproducible 0DTE trading return.

### Commercial and regulatory boundary

A disclaimer alone does not determine whether a paid service is investment advice. Personalized recommendations based on a subscriber's portfolio, risk budget or needs deserve a focused US securities-law review before public release. The SEC's publisher-exclusion guidance is fact-specific, including impersonality, bona fide analysis and general/regular circulation; a website or “educational” label does not settle it. [SEC: Jonathon Hendricks staff response](https://www.sec.gov/divisions/investment/noaction/2015/jonathon-hendricks-012615-202a.htm), January 26, 2015. Automated advice can still be advisory activity. [SEC: Robo-adviser guidance announcement](https://www.sec.gov/newsroom/press-releases/2017-52), February 23, 2017.

This is a scoping issue for the public product, not a conclusion that Convexa must register. Start with general analytics and factual explanations while obtaining advice on the actual offer, jurisdictions and communications. If regulated-adviser marketing rules apply, hypothetical performance has specific requirements; in every case keep performance descriptions complete and substantiated. [SEC: Investment Adviser Marketing compliance guide](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/investment-adviser-marketing), April 28, 2021, current official guide.

<!-- pagebreak -->
## 5. Data APIs: buy the capability you are missing

### Separate four different data requirements

- **Current structure:** complete eligible chains, OI as-of, gamma/IV, underlying price and model conventions.
- **Intraday inference:** time-stamped trades and quotes, corrections, signed-flow inference and ideally participant/open-close information. More frequent snapshots alone do not reveal inventory.
- **Research:** point-in-time historical chains, prior-known OI, Greeks or sufficient inputs to recompute them, underlying history and executable option quotes when testing returns.
- **Public delivery:** explicit rights for the particular raw/derived outputs, customer display, alerts, retention, exports and AI processing.

Do not replace a working live provider merely to obtain historical OI. A separate, bounded research dataset may solve that problem with much less integration risk. Keep the vendor port and raw provenance; freeze a comparison dataset before changing sources.

### Supplier shortlist

| Supplier | Best role for Convexa | Current cost/rights anchor | Important limitation |
| --- | --- | --- | --- |
| Massive | Lowest-migration live baseline; business analytics proposal | Personal Options Advanced $199/month. Options Business $1,999/month; raw delayed expansion +$499, real-time +$1,999 | Business analytics/FMV differs from raw quote access; scope the order form |
| ThetaData | Bounded historical OI/Greeks/quote evaluation | Retail options $40/$80/$160; commercial options advertised $1,600, startup as low as $500 | Retail is not business permission; Terminal/concurrency/model conventions matter |
| Databento | Reproducible raw live/history and your own Greeks | Historical usage-based access; current OPRA-specific commercial total requires quote | Generic $199 page is not a verified all-in OPRA public license; no precomputed Greeks |
| ORATS | Rich historical chains and derived analytics | Individual API $199 delayed, $299 live, $599 intraday, $899 all-in; commercial scope separate | Derived feed deliberately omits executable bid/ask/size and volume |
| Intrinio | Potential lower-cost public display MVP | Startup $333/month first six months, $666 next six, $999 thereafter; quarterly billing | OptionsEdge is synthetic/FMV; OI, exact instruments and historical fit need confirmation |

Official current pricing: [Massive personal options](https://massive.com/pricing?product=options), [Massive Business](https://massive.com/business-options), [ThetaData](https://www.thetadata.net/pricing), [Theta commercial](https://www.thetadata.net/commercial-use), [Databento](https://databento.com/pricing), [ORATS Data API](https://orats.com/data-api), [Intrinio](https://intrinio.com/pricing). These are list anchors, not a purchase recommendation or a negotiated all-in cost sheet. Commercial Theta billing commitment should be confirmed because page-toggle extraction was ambiguous.

### Massive: keep it while you test the actual gap

The app uses the current option-chain snapshot endpoint. Its OI represents positions at the previous trading day's close, and Greeks can be absent; underlying freshness depends on stock-data entitlement. Long trade/quote history does not establish that an old full chain with contemporaneous OI/Greeks can be retrieved. [Massive: Option Chain Snapshot](https://massive.com/docs/rest/options/snapshots/option-chain-snapshot), current documentation.

Massive's Business offering includes FMV, Greeks/IV, daily OI and files, with raw trade/quote expansions separately priced. It also advertises startup discounts. The order form and upstream agreements control the specific use; confirm your derived charts, alerts, archive retention and LLM inputs explicitly. [Massive Business terms](https://massive.com/legal/businesses-terms-of-service), current terms. The options business price alone does not establish the cost of your stocks/index requirements.

### ThetaData: promising history, with a 0DTE caveat

Historical OI is prior-day ending OI; the API documents publication timing. Its current historical all-Greeks model floors remaining time at one hour, while the older version uses a fixed 0DTE convention. Test the last hour instead of assuming third-party Greeks solve Convexa's clock issues. [Theta historical OI](https://docs.thetadata.us/operations/option_history_open_interest.html); [Theta all-Greeks history](https://docs.thetadata.us/operations/option_history_greeks_all.html), current v3 docs. Account concurrency is finite despite “unlimited requests.” Start with a few representative symbol/dates and an appropriate plan; do not subscribe broadly before confirming the required request types.

### Databento: strong raw architecture, more modeling work

Databento advertises OPRA history, instrument definitions and consistent live/historical formats; coverage start varies by schema. It does not provide precomputed Greeks, so rates, dividends, corporate actions, exact expiry and underlying synchronization become your responsibility. [Databento options data](https://databento.com/options), current page. Its pricing FAQ explicitly passes through the original publisher's restrictions. Retire the old roadmap's “$199 commercially clean” assumption; a June 2025 plan announcement is not a verified September 2026 public-display contract.

### ORATS and Intrinio: distinguish derived prices from executable quotes

ORATS' live-derived feed supplies analytics without raw OPRA bid/ask, sizes or volume; those fields are null, and its immediate underlying price can be parity-derived. This may suit structural analytics but cannot validate executable fills. [ORATS: Live Derived Data API](https://orats.com/docs/live-derived-data-api), current documentation.

Intrinio's Startup plan advertises commercial display rights, unlike its $150 personal plan. OptionsEdge supplies synthetic midpoint-style prices and Greeks but no historical OptionsEdge series. OI entitlement, SPX/SPXW coverage, historical chain fields and permission for Convexa's specific outputs remain open questions. [Intrinio OptionsEdge](https://intrinio.com/options/optionsedge), current product page. This is the most interesting lower-cost display proposal to qualify, not yet a verified complete replacement.

### Two secondary choices

Tradier can be useful for a personal brokerage workflow, but its documented Greeks update hourly and production market-data calls are rate-limited; it is not a free public-data workaround or a direct last-hour gamma solution. [Tradier market data](https://docs.tradier.com/docs/market-data); [rate limits](https://docs.tradier.com/docs/rate-limiting), current docs.

Cboe DataShop offers interval options quotes and optional OI/Greeks for a carefully scoped benchmark purchase. Index underlying data can require separate licensing. Its enhanced trade detail adds participant/open-close information for C1, delivered T+1; that is useful for testing inventory assumptions, not a consolidated real-time dealer book. [Cboe Option Quotes](https://datashop.cboe.com/option-quote-intervals); [enhanced trade detail](https://datashop.cboe.com/enhanced-us-options-trade-by-trade-execution-detail), current product pages.

### Commercial rights are a release dependency

The official OPRA schedule lists $1,500 monthly redistribution, with a $650 query-only category that excludes auto-refresh and has other conditions. Its redistribution line covers current **and delayed** data, with a historical-only exception. Non-display categories and per-user charges have separate definitions. Do not add every fee mechanically to every derived chart; get the precise classification. Equally, do not assume “15-minute delayed” means license-free. [OPRA Fee Schedule](https://cdn.opraplan.com/documents/OPRA_Fee_Schedule.pdf), current linked schedule, pages 1 and 6.

Theta's May 2026 explanatory article gives a more permissive delayed-data summary, conflicting with the original schedule's redistribution line. This report gives priority to OPRA and a written scoped contract. Vendor FMV/derived products can carry negotiated display rights; those rights do not make arbitrary calculations built on a retail feed automatically unrestricted.

### The concrete request for quotes

Obtain proposals from Massive Business, Intrinio Startup and one historical/derived specialist. Describe the same proposed product to each: a paid US-retail web app displaying GEX concentrations, walls, max pain, a scanner, alerts and cited AI explanations for an initial 3-10 symbols.

Ask for all-in costs at 25, 100, 500 and 1,000 users; separate vendor, stocks/options/index, display/non-display, redistribution, end-user, history, retention, overage and minimum-term charges. Require explicit permission for screenshots, email/push, exports, retained snapshots, public backtests and transmission to LLM providers. Confirm cancellation/retention rights and discount expiry.

Request representative chains around a normal session, stressed session, expiry, half-day and final 0DTE hour. Require quote and underlying timestamps, OI available-at/as-of, adjustment metadata and model versions. Compare coverage and outputs over roughly ten sessions. This sample length is an operational screen, not strategy validation. No vendors were contacted or purchases made during this research.

<!-- pagebreak -->
## 6. Competitors and what customers might pay you for

### FlashAlpha is the correct inspiration, but it is broader than a GEX calculator

FlashAlpha currently advertises GEX, other Greek exposures, 0DTE analytics, scanners, AI narratives and historical replay. Monthly API tiers are Basic $79, Growth $299 and Alpha $1,499; annual equivalents are lower. It explicitly excludes redistribution, embedding, white-label and publisher licensing across its plans. Use it as a reference or permitted personal research input, not the planned public Convexa backend. Its performance and historical-completeness claims were not independently benchmarked. [FlashAlpha pricing and licensing](https://flashalpha.com/pricing), current page.

### Current competitive reference points

| Product | Standard monthly anchor | What it sells beyond a static GEX chart |
| --- | --- | --- |
| SpotGamma | Essential $99; Alpha $299 | Interpreted levels, founder analysis and more advanced intraday tools |
| MenthorQ | Premium $129; Pro $349 | Quant models, platform integrations, education and higher-tier live guidance |
| Tradytics | Individual Pro $69; Discord-server plan $199 | Flow, scanners, AI ideas and a broad analytics/community workspace |
| Unusual Whales | Basic $50; Pro $75; Max $120 | Flow, GEX heatmaps, scanners and an AI analyst; API/business products separate |
| GammaEdge | $150, or $1,500 annually | Contextual market models, scanners, education and community |

Sources: [SpotGamma Support](https://support.spotgamma.com/hc/en-us/articles/1500002666102-What-is-the-cost-of-a-SpotGamma-Subscription), [MenthorQ pricing](https://menthorq.com/pricing/), [Tradytics pricing](https://tradytics.com/), [Unusual Whales plans](https://unusualwhales.com/pricing), [GammaEdge](https://www.gammaedge.com/), all current pages accessed September 2026. First-month offers, Labor Day promotions and annual equivalents are excluded from the table. Feature placement should be confirmed at checkout; marketing-page comparisons sometimes lose included/excluded styling when extracted.

### The implication is focus, not a price war

“GEX plus AI” is already available. Matching every competitor feature would leave Convexa with a large support burden and no demonstrated reason to switch. You need a repeated job customers say existing tools handle poorly, plus evidence that your version does it better.

Test these three propositions:

- **Faster preparation:** a compact, cited session brief with the relevant concentrations and limitations.
- **Useful change detection:** what changed since the trader last looked, with noise controlled and data freshness visible.
- **Honest review:** a saved snapshot and thesis that make it possible to revisit what the app knew at decision time, including misses and abstentions.

The distinctive advantage would be the joined workflow and trusted record, not a proprietary label on a familiar equation. Market it as a testable product promise. “Traders can prepare in five minutes and recover yesterday's reasoning” is easier to substantiate than “our magnet predicts price.”

### A proposed initial offer

**Convexa Session Desk:** an options-structure preparation and review workspace for a small, liquid universe. The customer gets a concise daily structure brief, selected-expiry profile, meaningful-change alerts, watchlist ranking with reasons, snapshot history and an optional journal. AI explains the evidence; it does not present unvalidated personalized orders as the main product.

Suggested message to test: **“Understand the options structure. See what changed. Keep a record of your reasoning.”** The current landing phrase “See the dealer positioning behind the price” should be qualified so it does not imply direct dealer-inventory observation. Local source: `pages/landing/Landing.tsx:86`.

The paid value is convenience, continuity and reliable interpretation. A static GEX calculator alone is a weak recurring subscription unless you possess demonstrably better data, an underserved niche or distribution. You can narrow the public experience without deleting the broader personal app.

<!-- pagebreak -->
## 7. One product, with public and private capabilities

### Recommended product boundaries

| Capability | Initial public product | Owner/private workspace |
| --- | --- | --- |
| Corrected structure, methodology and data freshness | Core | Same versioned engine |
| Small watchlist, scanner reasons and alerts | Core, bounded by the license | Wider experiments as useful |
| Cited explanations and snapshot history | Core or limited beta | Multi-model/prompt experiments |
| Saved thesis and simple journal | Optional | Full decision/outcome research |
| Advanced simulated orders and multi-leg sandbox | Later, clearly approximate | Keep and repair provenance |
| Broker positions and portfolio-specific AI | Later, after integration and scoped review | Owner-only once actually implemented |
| Experimental weights, 0DTE models, replay lab | Not a public reliability promise | Private research capabilities |
| Real order execution | Outside the proposed launch | A separate future decision, not an incidental toggle |

Use server-enforced capabilities such as `structure.read`, `history.read`, `alerts.create`, `ai.explain`, `owner.research` and `owner.broker`. These are proposed names, not existing entitlements. Enforce them at routes and data access, not only by hiding navigation. Keep owner brokerage credentials, books, research inputs and paid-user entitlements separately authorized. Background jobs also need the correct data-rights scope.

Your pure quant library and vendor port already support shared logic. Add a small, durable entitlement layer and audited owner role; avoid duplicating the engine into a second repository. Share model versions between personal and public evaluation so the public product does not drift into an untested fork.

Consider a separate deployment later if owner-only credentials, experimental dependencies or latency requirements materially differ. A separate product/code fork becomes worthwhile only when different buyers, workflows, economics and release cycles are demonstrated. It is not necessary merely because you want some features for yourself.

### What must exist before accepting subscriptions

For a paid analytics pilot, the essentials are corrected calculations, truthful method/freshness states, permission for the delivered data, stable account isolation, payment and cancellation, entitlements, bounded usage costs and a support channel. Validate backup/restore and the actual production data paths. The existence of auth and tests does not by itself prove these launch properties.

You do not need a profitable trading-strategy claim to charge for useful analytics software. You do need a dependable product that does what it promises. Validate willingness to pay for the workflow while separately studying predictive edge. The old rule “no business until 50 trades” should not become an excuse to avoid customer discovery; nor should 50 outcomes become permission to promise performance.

### Pricing experiment

Start with one paid plan. Test **$49/month founding access**, time-limited or clearly bounded, and **$79/month standard** after the product earns that price. These are hypotheses based on adjacent list prices and the proposed job, not a final price recommendation before licensing quotes. Avoid lifetime access and unlimited AI; both can lock in liabilities before costs are known.

Use a demonstration or a small historical sample for free acquisition, subject to rights. Do not fund an unlimited real-time free tier before understanding conversion and cost. A paid pilot can begin with manual onboarding and a standard hosted checkout, while access and cancellation remain correctly enforced.

Future revenue options, in order: expanded individual subscription; a licensed community/educator workspace after individual retention is proven; separately licensed business/API outputs only if demand and unit economics warrant them. Advertising and affiliate links should not be the core plan at small scale, and execution-linked incentives can conflict with the product's “trade less when evidence is weak” philosophy.

<!-- pagebreak -->
## 8. Revenue math and the path to customers

### Your first milestone is cost coverage

Include **market data + hosting/storage + all AI development subscriptions + monitoring/support tools** in the monthly fixed-cost baseline. Include variable AI, payment processing, per-user market-data fees and support as they grow. Founder labor, taxes and acquisition spending are additional costs; covering subscriptions is not the same as paying yourself a salary.

For planning only, assume a blended payment/billing/refund reserve of **4% of revenue plus $0.30 per subscriber-month**, and **$5 variable service cost per subscriber-month**. These are analyst assumptions, not a Stripe quote or a measured Convexa cost. Replace them with actual processor, license and usage costs.

`Monthly contribution/customer = price x 0.96 - 0.30 - 5`

`Break-even customers = ceiling(fixed monthly cost / contribution/customer)`

| Fixed monthly costs, including AI development tools | Customers at $49 | Customers at $79 |
| --- | --- | --- |
| $750 | 18 | 11 |
| $1,500 | 36 | 22 |
| $3,000 | 72 | 43 |

These scenarios are not estimates of your actual current bill. A commercial data license may move you from one row to another before the first sale. At $79, 25 customers produce $1,975 gross revenue and about $1,764 contribution under these assumptions: enough for the $1,500 scenario, not the $3,000 scenario. At a $2,000 fixed data cost alone, roughly 29 customers are needed at $79 under the same assumptions, before other fixed costs.

### $10,000/month and the million-dollar goal

| Revenue milestone | $49 average monthly revenue/customer | $79 average monthly revenue/customer |
| --- | --- | --- |
| $10,000 monthly recurring revenue | 205 active paying customers | 127 active paying customers |
| $1 million annualized recurring revenue | 1,701 active paying customers | 1,055 active paying customers |
| $1 million first-year revenue, simplified linear ramp from zero | About 3,402 customers at year end | About 2,110 customers at year end |

The annualized milestone means about **$83,333 monthly recurring revenue at the measurement date**; it does not mean $1 million already collected. The first-year illustration assumes a continuous linear net-customer ramp over all 12 months, constant realized price and no launch delay. Delays, discounts, refunds and churn make the required gross acquisition harder. With a three-month launch delay and a linear ramp over the remaining nine months, the $79 scenario would require about 2,813 active customers at year end. These are arithmetic illustrations, not forecasts.

Your $10,000/month target could support a focused indie business if retention and licensed costs work. A million-dollar first year requires a distribution engine, sustained conversion and much more customer acquisition; nothing in the repository proves those conditions. Treat it as a stretch scenario, not a reason to build a full terminal now.

### Distribution is the missing business system

There is no verified current audience, paying-customer count or conversion funnel in the materials reviewed, and you have not supplied those numbers. The plan therefore assumes distribution must be built. The earlier 10-25 hours/week capacity is also an assumption pending your current time budget.

Start with 15-20 conversations with traders matching the proposed customer. Ask them to show their last session-preparation process, tools they already pay for, what they ignore, what causes distrust and what they would cancel to pay for Convexa. Show the existing workflow; observe whether they can locate the relevant levels and explain uncertainty without you teaching every control.

Invite a small cohort to a licensed, supported pilot. Ask for payment after they experience the repeated job, not just compliments about a screenshot. Your strongest initial channel is likely consistent educational demonstrations and direct relationships in a narrow community, but this remains a channel hypothesis. Do not assume a follower threshold or viral post automatically produces sales.

Publish a regular, concise session review using data you are licensed to show: what the app knew, what changed, where the reading was weak and what happened. Include unhelpful days. Let customers try the same workflow with a historical example. Measure qualified visits -> activation -> paid conversion -> retained use -> referral. Avoid paid advertising until organic users renew and contribution margins are known.

### Growth arithmetic exposes the real constraint

At 5% monthly customer churn, 127 active customers require about seven new customers a month simply to remain level. At 1,055, about 53 replacements are needed before growth. The 5% assumption is illustrative, not an industry benchmark.

At a hypothetical 5% qualified-trial-to-paid conversion, 127 cumulative paid conversions require roughly 2,540 qualified trials before churn. If conversion is 2%, the requirement is 6,350. These scenarios show why spending all development time on features while postponing distribution makes revenue unlikely.

### When you can start earning

- **Weeks 1-2:** verify costs, fix the highest-risk semantics, request scoped data proposals and interview prospects. A waitlist is not revenue.
- **Roughly weeks 4-8:** first small paid analytics pilot is plausible if calculations, license, onboarding and access controls are ready and prospects are available. Do not charge for unlicensed access or promises you cannot deliver.
- **Weeks 8-16 or later:** more realistic if starting without an audience, migrating data or negotiating complex rights. Covering costs may require 11-72 customers in the illustrated scenarios, not merely the first sale.
- **Months 3-6 and beyond:** test whether a repeatable acquisition/retention process can support $10,000 MRR. That is a milestone to work toward, not an expected outcome from the code's maturity.

If public data economics make a small cohort uneconomic, the interim business test can be a narrower licensed historical/review product. That serves a different job from live day trading and must be marketed accordingly. Another option is a paid, clearly scoped setup/education service, where permitted, but it is labor-based income and does not establish SaaS retention.

<!-- pagebreak -->
## 9. A 90-day action plan

### Days 1-14: restore trust and test the offer

**Engineering:** fix no-flip availability, selected-expiration forwarding, wall definitions/sign/ties and contradictory methodology. Repair simulated fill provenance before any quoted-only performance claim. If same-day analytics will be shown, correct expiry conventions before that use. Add independent known-answer tests and freeze the resulting model version.

**Research:** audit the current corpus by actual exchange session, source, coverage, missingness and availability time. Reproduce the old smoke metrics with transparent exclusions; do not treat the old artifacts as a current benchmark.

**Business:** list the full monthly bill including AI subscriptions; obtain three scoped data proposals; conduct the first 10 qualified interviews. Test the Session Desk proposition and the $49/$79 price hypotheses. Define the first customer and horizon in one paragraph.

**Exit decision:** proceed if the core outputs can be made dependable, a viable rights/cost path exists and several prospects have a specific repeated job they want solved. Otherwise narrow the scope before adding features.

### Days 15-30: build the smallest paid experience

Finish scanner reasons and freshness states, a concise cited brief, useful change alerts and snapshot review for the initial universe. Enforce entitlements server-side, add payment/cancellation and instrument activation. Keep private tools available to you but out of the initial public task flow.

Recruit about five design partners as a proposed target. Watch them use the product across several sessions. Record support time and input-quality failures. Start a consistent public demonstration habit only with display rights. Run the initial supplier comparison if a migration is justified.

### Days 31-60: collect payments and credible evidence

Target an initial 10-25 paying customers as a learning objective, conditional on earlier gates. Track activation, weekly use, renewals, cancellations, support minutes, explanation cost and gross contribution. The exact thresholds are management decisions, not research findings.

In parallel, run one frozen time-based validation experiment. Separate technical correctness, ranking value, probability calibration and executable returns. Publish a methodology note and limitations; keep experimental strategy claims private.

### Days 61-90: choose expansion based on observed behavior

Continue if users repeatedly use the core workflow, renew at the intended price, trust the outputs and the unit economics cover the chosen data architecture. Expand the one feature most associated with retention: it may be alerts, replay, explanation or journal continuity, not a new Greek or broker connector.

If interviews are positive but paid retention is weak, investigate the recurring job and onboarding before adding breadth. If 20 qualified interviews and a supported pilot produce no meaningful willingness to pay, revise the customer/offer. If after 90 days neither commercial demand nor measurable personal decision benefit exists, pause expansion and reassess the premise.

### Priority order for the existing backlog

| Priority | Work | Observable completion |
| --- | --- | --- |
| P0: public trust | Missing flip, expiration filtering, wall semantics, copy/sign alignment | Independent fixtures pass and source-to-UI meaning is consistent |
| P0: evidence integrity | Preserve simulated price provenance | Modeled/theoretical entries cannot enter quoted-only rates |
| P0 for 0DTE | Correct clocks, settlement, same-day labels | Final-hour and next-day fixtures behave correctly across session boundaries |
| P1: input quality | OI/Greek identity, coverage, timestamps and adjusted-contract exclusions | Every displayed result declares eligibility, basis and exclusions |
| P1: business readiness | Scoped license, entitlements, checkout/cancel and cost controls | A paying user's allowed experience is verifiably authorized and supportable |
| P1: customer utility | Brief, meaningful changes and snapshot review | Pilot users complete the repeated job and return without intensive coaching |
| P2: validation | Future-only scoring experiment and conservative execution study | A dated, reproducible comparison with baselines and uncertainty |
| P2: personal tools | Broker import and advanced AI/sim work | Each solves an observed personal workflow problem without overstating evidence |

This is a recommended sequence, not an instruction to the active development session and not an implementation commitment. No fixes were applied in this review.

<!-- pagebreak -->
## 10. Evidence limits and final decision

### What is established

The app contains meaningful quant, scanner, journaling and research infrastructure. Several high-impact source-level correctness and provenance issues are identifiable. Competitors demonstrate an established category of paid options analytics, but their existence does not prove demand for Convexa. Official supplier pages establish that personal data access and public delivery are distinct commercial questions.

### What remains unknown

- Current production behavior, data completeness and the prevalence/magnitude of the identified failures; no app, test suite or vendor-quality benchmark was run during this read-only review.
- Your exact monthly bills, current weekly capacity, existing audience, customers and distribution reach.
- The executed market-data agreement, professional classification, current account entitlements and quote-specific derived/display/AI rights.
- A durable trading advantage, out-of-sample options returns, calibrated probabilities or a tested profitable acquisition channel.
- The exact externally referenced study supporting Convexa's GEX/IV transformation. Targeted research did not establish it.

Source-level findings were cross-checked on the most consequential paths: gamma-flip fallback, dropped expiration selection, wall construction, simulated-fill classification and the Webull placeholder. External high-impact claims were independently checked against OPRA, SEC, OIC/Cboe and current supplier pages. Competitor testimonials, user counts and claimed profitability were not accepted as proof.

Two archived August 24 UI evidence images, landing and scanner, were inspected to understand the existing product presentation. They contain fixtures and predate the ongoing redesign; they are not observations of current production market data or a full visual audit.

Research stopped after tracing the live calculation/validation paths, reconciling the important dated-document contradictions and checking the principal competitors and suppliers. The remaining consequential gaps require runtime reproduction, actual data samples, vendor contracts and customer behavior; more broad web searching would not resolve them.

### Source handling

Descriptive links beside claims identify the source title and publisher. Dates are given where available; otherwise provider/product/documentation pages are undated current pages accessed September 5-6, 2026. Local code references use the repository-relative path at the reference commit on the cover. Dated local research artifacts are identified by exact filename. Current source is authoritative over stale README, Python-era and earlier roadmap claims.

External numerical claims were limited to the verified scope of each page. Vendor models and pricing are not independent endorsements. The OPRA delayed-redistribution conflict remains explicitly bounded by the original schedule and the need for a written classification. The SSRN full-paper retrieval limitation is disclosed where used. No source materials or private trading records are embedded in this PDF.

### The recommended commitment

Commit to **one product, one narrow paid workflow and one private research workspace** for the next 90 days. Preserve the ambition through modular capabilities rather than presenting every experiment as a public feature.

The first win is a small group of people who renew because Convexa helps them prepare, interpret and review their decisions, while revenue covers data, hosting and development tools. The next win is a repeatable route to roughly 127 customers at $79/month. A million-dollar outcome requires the distribution and retention system to grow alongside the engineering; it will not follow automatically from more calculations, more AI or more tabs.

Your strongest next investment is to make the existing evidence trustworthy, choose the customer job and ask real prospects to pay for that job once it is deliverable.
