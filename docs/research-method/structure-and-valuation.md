# Meta brief: note structure and valuation method for Convexa research notes

Prepared 2026-10-12. This brief covers three cases:
- **Micron (MU):** a cyclical at peak margins.
- **CoreWeave (CRWV):** a levered, loss-making GPU cloud.
- **Cerebras (CBRS):** a young, recently listed AI-chip company.

It is about method only and is not investment advice. It complements `meta-perspectives.md`, which covers debiasing, calibration and the prediction ledger. Where the two overlap, this brief adds the valuation mechanics. Bracketed numbers refer to section F.

---

## A. Executive summary: the 10 highest-value improvements, ranked

**1. Pick the valuation method by life-cycle stage, and say why.**
Morningstar values every stock with a standard three-stage DCF. It argues the DCF suits cyclicals, high-growth firms and money-losing firms better than multiples, which it keeps only as cross-checks [1]. Damodaran treats young, cyclical and distressed firms as separate estimation problems [6][7][8]. The fit for each note:
- **MU:** a normalized DCF.
- **CBRS:** a narrative-driven DCF with a failure probability and dilution.
- **CRWV:** an enterprise DCF with a distress probability and contract-level economics.

**2. Open the valuation with "what the price implies", at enterprise level.**
Expectations Investing starts from the price and solves for the expectations it embeds. It then focuses on the driver with the largest effect on value (the "turbo trigger"), and acts only with a margin of safety [15]. Mauboussin splits a price into two parts [13]:
- **Steady-state value:** today's profit capitalized at the cost of capital.
- **Future value creation:** everything above that.

For the S&P 500, steady-state value has averaged about two-thirds of price [13]. For CRWV, solve on enterprise value (EV). The equity is a thin residual above the debt [1][8].

**3. Normalize MU. Never value it off peak margins.**
Micron's FQ4-26 gross margin was 87.0% [18]. In FY2023 it was −9.1% [19]. A base year near the peak overvalues the company. Damodaran normalizes earnings, reinvestment and the cost of capital together, and warns against double-counting the recovery growth [7]. The CFA Institute also lists projecting from a cycle's top or bottom as a common mistake [4].

**4. Put failure and distress in the cash flows, not the discount rate.**
- **Formula:** expected value = going-concern value × (1 − p) + distress value × p, where p is the probability of failure or distress [6][8].
- **Why not the discount rate:** Damodaran says a higher discount rate is a blunt way to capture failure risk [11].
- **For CRWV:** anchor p to credit pricing. CoreWeave's GPU-backed loans run from SOFR+225 bp, rated investment grade, to SOFR+550 bp, rated BB+ [23][24].

**5. Publish an uncertainty rating, with margin-of-safety bands.**
Morningstar has five levels, from Low to Extreme. The price thresholds for each level are [1][2]:

| Uncertainty | 5-star: price at or below | 1-star: price at or above |
|---|---|---|
| Low | 0.80 × fair value | 1.25 × fair value |
| Medium | 0.70 × | 1.35 × |
| High | 0.60 × | 1.55 × |
| Very High | 0.50 × | 1.75 × |
| Extreme | 0.25 × | 4.0 × |

Until July 2022, analysts set bull and bear cases so that each tail beyond them had a 25% probability. Since then, a suggested rating based on volatility comes first, and the analyst can override it [1][2].

**6. Check every growth assumption against base rates.**
The sample is the top 1,000 global companies from 1950 to 2015, with growth adjusted for inflation [14]:
- The median three-year sales growth rate (CAGR) was 5.4%.
- Growth above 45% a year occurred in 2.5% of three-year windows, 1.3% of five-year windows and 0.3% of ten-year windows.

Plot the growth implied by CRWV's and CBRS's prices against these tails. This overlaps item 3 of meta-perspectives.

**7. Add a GAAP-to-adjusted bridge and an earnings-quality panel.**
- **CoreWeave Q2-26:** adjusted EBITDA was $1,510M, a 59% margin. Against that sat a $49M GAAP operating loss and $640M of interest [22].
- **Cerebras Q2-26:** GAAP operating margin was −265%, against −16% on the company's "core" basis [33]. Core figures exclude customer-warrant amortization, stock-based compensation (SBC) and pass-through revenue [34].
- **Micron:** its $12.7B of customer deposits must be returned over time. They arrive through financing cash flow, not free cash flow [18].

In a CFA Institute survey, investors said they reverse questionable adjustments. They also objected to companies excluding recurring costs such as stock compensation [39].

**8. Add a KPI dashboard of 4–6 "turbo trigger" metrics per note.**
The CFA Institute recommends industry-specific ratios [4]. Expectations Investing focuses analysis on the driver that moves value most [15]. The lists are in section D.

**9. Add a moat section that sets the fade period.**
Morningstar's Stage II is the stretch of years before excess returns fade to the cost of capital. It lasts from 1 year with no moat to 10–15+ years with a wide moat [1]. Morningstar names five moat sources: intangible assets, switching costs, network effects, cost advantage and efficient scale [1]. Mauboussin's checklist covers both the industry and the firm [13]. The notes discuss competition but never conclude how long excess returns will last. After margins, that is the biggest input in a DCF.

**10. Keep a target history and a change log, and put numbers on the risks to the target.**
FINRA Rule 2241 sets four requirements for sell-side research [5]:
- A reasonable basis for any price target.
- A clear explanation of the valuation method.
- A fair presentation of the risks.
- A price chart marking each target change.

Morningstar expects fair value to rise each year by the cost of equity, less dividends, when nothing else changes [1]. So the history should separate that automatic roll-forward from real revisions. This overlaps item 10 of meta-perspectives.

---

## B. Recommended note template

The template draws on four sources:
- **CFA Research Challenge:** the required sections and their scoring weights. Valuation and financial analysis carry 20 points each, and risks and ESG 15 each [3].
- **CFA Institute report essentials:** what each section should contain [4].
- **Morningstar:** its rating stack [1].
- **FINRA 2241:** the required disclosures [5].

**NEW** marks sections the notes lack today.

| # | Section | Contents | Best visual |
|---|---|---|---|
| 0 | Header strip **NEW** | Ticker, exchange, sector, price and date, market cap, EV, float and major holders [4]. Stance, fair value, uncertainty rating, horizon, last updated, author-holdings disclosure (Morningstar discloses analyst holdings [1]). | Stat tiles |
| 1 | TL;DR / investment summary | What the price is not discounting, and what event would make the market reprice the stock [4]. Fair value against price. The single biggest risk. | Gauge of price against the fair-value band |
| 2 | What the price implies **NEW** | Reverse-DCF outputs. Steady-state value against future value creation [13]. Implied growth against base rates [14]. The variant view: where the note's view differs from the price, and why [44]. | Split bar (steady-state vs growth value); implied growth on the base-rate histogram |
| 3 | Business and unit economics **NEW** | Revenue and cost drivers [4]. Economics per unit: per bit, per MW, per system [17]. | Revenue-mix stacked bars |
| 4 | Industry, competition and moat (merges "competition") | Industry structure, moat source and trend, ROIC against WACC [1][13]. | ROIC − WACC spread over time |
| 5 | Key numbers / KPI dashboard | The section D checklist for the industry. | Small multiples with sparklines |
| 6 | Financial analysis and earnings quality **NEW** | History and forecast. GAAP-to-adjusted bridge. Accruals, SBC, depreciation policy [4][39]. | Waterfall bridge |
| 7 | Backlog and customers | Remaining performance obligations (RPO, contracted revenue not yet recognized), conversion timing, conditions, concentration [22]. | Stacked bar of backlog by recognition year; concentration bar |
| 8 | Valuation **NEW** | Method and why. Scenario table (drivers, probabilities). Football field. Sensitivity grid. Fair value with uncertainty band. Target history [1][5]. | Football field, heat-map grid, fair-value band chart, target-history line |
| 9 | Bull vs bear | Each case tied to the scenario drivers it moves. | Two-column table |
| 10 | Risks to fair value **NEW** | Probability × impact, each with its model effect ("if X, fair value −Y%") [5]. | Tornado chart |
| 11 | Capital allocation and balance sheet **NEW** | Morningstar's three components: balance sheet, investment, distributions [1]. Debt-maturity ladder. | Maturity ladder |
| 12 | Governance and ownership **NEW** | Votes against economic ownership, lock-ups, insider sales, board [3][4]. | Ownership vs votes bars; lock-up calendar |
| 13 | Catalysts / what would change the picture | Dated catalysts. Damodaran's narrative break, shift or change triggers [9]. | Timeline |
| 14 | Change log and sources | Dated revisions, with roll-forwards separated from real revisions. Sources with access dates. | List |

The CFA guidance treats a qualified audit opinion or a material weakness in internal controls as automatic red flags [4]. Show either one in section 6.

---

## C. Valuation playbook

### C.0 Shared core

**Market EV** = equity value + debt + leases + other debt-like items − cash − non-operating assets. For MU, count the $12.7B of returnable customer deposits as debt-like [18].

**Free cash flow to the firm (FCFF):** FCFF_t = Rev_t × m_t × (1 − τ) − ΔRev_t ÷ (S/C)
- **Rev:** revenue.
- **m:** operating margin.
- **τ:** tax rate.
- **S/C:** sales-to-capital, Damodaran's reinvestment driver [6][11].

**Terminal value:** TV_N = NOPAT_{N+1} ÷ WACC. This assumes new investment after year N earns exactly its cost of capital, as in Morningstar's Stage III [1].

**Steady-state value** = NOPAT ÷ WACC. **Future value creation** = EV − steady-state value [13].

**Reverse DCF.** There are two ways to run it:
- Fix WACC and margins, then solve for growth.
- Fix growth and margins, then solve for N, the market-implied forecast period. N measures the competitive advantage period [15][16].

**Discount rate.**
- **Morningstar:** sets the cost of equity at 7.5%, 9%, 11% or 13.5%, depending on its systematic-risk category [1].
- **Damodaran:** suggests using the 10th–90th percentile range of public-company costs of capital, rather than a precise point [11].

**Scenarios.**
- **Three cases:** bear, base and bull, each with explicit drivers. Set the tails so each has a 25% probability [2], and show the probability-weighted value.
- **Simulation:** for CBRS and CRWV, add a Monte Carlo distribution [10][11].

**Football field.** One bar per method [45]:
- The 52-week trading range.
- The reverse-DCF value.
- Bear, base and bull DCF values.
- A cross-check from multiples on normalized earnings.
- The failure-adjusted value (CBRS) or distress-adjusted value (CRWV).

The width of each bar shows how sensitive that method is.

**Sensitivity grid.** Put the turbo trigger on one axis. Put the discount rate or the next-biggest driver on the other [15].

**Horizon.** State whether the target is a 12-month price target or an intrinsic value. Morningstar expects price to converge on intrinsic value within about three years [1].

### C.1 Cyclical at peak margins: MU

**Methods.**
- **Primary:** a normalized DCF. Normalize earnings, reinvestment, growth and the cost of capital together [7].
- **Alternative:** project low or negative growth from the peak base, which models the downturn directly [7].
- **Cross-check:** multiples of normalized earnings [7].

**Inputs.**
- **Mid-cycle margin:** the average margin over at least one full cycle, applied to current or trend revenue. Average margins rather than absolute earnings, or a company that has grown will be understated [7].
- **Normalized capital intensity:** capex/revenue and working capital.
- **Industry bit growth against price:** Micron expects DRAM industry bit shipments to grow by the mid-20s % in CY2026 and the low-20s % in CY2027–28 [18].
- **Contract structure:** Micron has 26 strategic customer agreements, estimated at over 35% of revenue through 2030. Most have floor and ceiling prices. Customers have committed $32B, mostly as cash deposits [18]. This is the strongest case for shallower troughs. Test it as a scenario rather than assuming it.

**Formulas.**
- NOPAT_norm = trend revenue × mid-cycle margin × (1 − τ).
- V_op = FCFF_norm × (1 + g) ÷ (WACC − g), with reinvestment consistent with the growth rate g [7].

The reverse DCF should answer one question: how many years of today's margin does the price assume?

**Traps.**
- Reading a low P/E on peak earnings as cheap [4][7].
- Normalizing earnings but keeping peak capex or peak WACC [7].
- Normalizing earnings and then adding recovery growth on top [7].
- The false stability of EV/EBITDA or EV/sales [7].
- Capacity added near the peak, which deepens the trough [13].
- Counting debt-like deposits as cash [18].

**Presenting uncertainty.**
- **Margin band chart:** from FY2023's −9.1% to FQ4-26's 87.0% [18][19].
- **Side-by-side values:** at trough, mid-cycle and peak margins.
- **Uncertainty rating:** High. Morningstar weighs cyclicality and operating leverage when it sets this rating [1].

### C.2 Young, pre-profit, big backlog: CBRS

**Methods.**
- **Narrative-to-numbers DCF:** every number is tied to a claim in the story [9][11].
- **Revenue build:** top-down (market × share) or bottom-up (contracted MW × revenue per MW) [6].
- **Value:** a failure-adjusted expected value [6], plus simulation [10].
- **Terminal value:** never base it on a multiple [6][11].

**Inputs.**
- **Damodaran's six drivers:** revenue growth, target operating margin (taken from mature peers), sales-to-capital, cost of equity, cost of debt and probability of failure [11].
- **Falling cost of capital:** it should decline as the firm matures. In Damodaran's Uber example it goes from 12% to 8% [9].

**Formulas.**
- **Revenue and reinvestment:** Rev_t = market_t × share_t, and reinvestment_t = ΔRev_t ÷ (S/C).
- **Reinvestment check:** imputed ROIC_t = NOPAT_t ÷ (initial capital + cumulative reinvestment). If it sits far above both the industry and WACC, the model is reinvesting too little [6].
- **Expected value:** E[V] = V_going-concern × (1 − p_fail) + V_failure × p_fail [6].
- **Per share:** (equity − value of options and warrants) ÷ current shares. Forecast SBC as an expense. Capture dilution either through negative cash flows or through a larger share count, never both [12].
- **Backlog:** delivery-weighted backlog = Σ backlog_i × P(delivered_i), summed over contracts i.

Backlog only turns into revenue on delivery; CoreWeave's own definition says so [22]. Cerebras reported $25.4B of remaining performance obligations (RPO) and 600+ MW under contract [33]. That is about 29 times its 2026 core revenue guide of $880–890M [33]. Two UAE-linked customers made up about 86% of 2025 revenue, and the backlog is mostly OpenAI [32].

**Traps.**
- **Damodaran's three narrative failures [9]:**
  - The impossible "runaway story", which stops people asking questions.
  - The implausible "big market delusion".
  - The improbable "Willy Wonkitis".
- Ignoring the base rates for growth above 45% [14].
- Valuing on "core" figures that leave out the warrant contra-revenue [34][35].
- Excess detail, which adds false precision when uncertainty is high [6].

**Presenting uncertainty.**
- A histogram or fan chart of simulated values [10][11].
- A table mapping each part of the story to its number [9].
- An uncertainty rating of Very High or Extreme.

### C.3 Levered, loss-making infrastructure: CRWV

**Methods.**
- **Enterprise DCF:** FCFF discounted at WACC, minus all debt and leases [1].
- **Distress-adjusted expected value** [8].
- **Contract-level project values.**
- **Equity as a call option:** when leverage is extreme, value the equity as a call option on the firm [8].
- **Reverse DCF:** run it on EV.

**Inputs.**
- **Capacity:** 1.5 GW active against 3.7 GW contracted at Q2-26 [22]. How fast contracted power goes live drives revenue.
- **Asset life:** CoreWeave depreciates GPUs over 6 years and Nebius over 4 [26]. Some analysts expect industry lives to shrink toward 5 years [25].
- **Renewal pricing:** H100 spot rental fell from $6.62/hr in late 2023 to $2.83/hr in February 2026 [28].
- **Debt:** cost by facility, and term mismatch. One recent loan rests on contracts averaging about 3 years, against a maturity of about 5 years [24].
- **Concentration and backstops:** the top customer was 36% of Q2-26 revenue [29]. Nvidia has a $6.3B agreement to buy unsold capacity through April 2032 [27].

**Formulas.**
- **Value per contract:** −capex_0 + Σ_{t≤T} (R − O)(1 − τ) ÷ (1 + WACC)^t + RV_T ÷ (1 + WACC)^T.
  - R: contract revenue.
  - O: operating cost.
  - T: contract term.
  - RV_T: residual value, the re-lease price × remaining economic life.
- **Distress:** E[V] = V_going-concern × (1 − Π_cum) + V_distress × Π_cum. Π_cum is the cumulative probability of distress. Use the cumulative figure because failing in year 3 loses every later cash flow [8].
- **Default probability from a bond price:** P = Σ C(1 − π)^t ÷ (1 + r_f)^t + F(1 − π)^N ÷ (1 + r_f)^N. Here π is the annual default probability, C the coupon, F face value, r_f the risk-free rate and N the years to maturity [8].
- **Default probability from the option view:** risk-neutral default probability = 1 − N(d2) [8].

**Traps.**
- Reading EBITDA as profit. It leaves out depreciation, the main economic cost, and interest [22].
- A book life longer than the economic life [25].
- Treating backlog as cash [22].
- Ignoring re-contracting risk [24].
- Adding SBC back [12].

**Presenting uncertainty.**
- **EV football field with a bridge to equity:** small changes in EV move the equity by a multiple.
- **Asymmetric bands:** Morningstar sets the 1-star price for debt-heavy Extreme stocks on a log-normal basis [1].
- **Grids:** renewal $/GPU-hour × economic life, and cost of debt × utilization.
- **Uncertainty rating:** Very High or Extreme.

---

## D. KPI checklists by industry

**Memory semiconductors (MU)**

| KPI | Why it matters | Source |
|---|---|---|
| Company bit shipments against industry bit growth (DRAM and NAND separately) | Share and supply discipline | [18] |
| Price per bit change, QoQ; contract-price trackers | Earnings swing; the second derivative turns before margins do | [18][20] |
| Industry supply growth against demand growth | Whether the cycle is tight or loose | [18][20] |
| Days of inventory (DIO; Micron 129) and channel/OEM inventory | Leading indicator of price cuts | [18][20] |
| Gross margin against its full-cycle range | Peak or trough check | [18][19] |
| Capex/revenue; cleanroom vs equipment capex | Future supply; capacity added at the peak | [13][18] |
| HBM share of revenue and bits; contracted coverage of next year's HBM; vendor share and HBM4 yields | Structural mix shift | [18][21] |
| Share of revenue under long-term agreements, price floors, customer deposits | How much the downside is damped | [18][20] |
| End-market mix (data center against PC/phone) | Mix of demand drivers | [18][20] |

**GPU cloud / AI infrastructure (CRWV)**

| KPI | Why it matters | Source |
|---|---|---|
| Revenue backlog/RPO, quarterly change, recognition timing, delivery conditions | Visibility, and how firm the backlog really is | [22] |
| Backlog conversion: revenue ÷ starting backlog; active ÷ contracted MW | Execution speed | [22] |
| Revenue per average active MW | Unit economics; use average MW, not period-end | [17][22] |
| Utilization and GPU-hour pricing (spot and renewal) | Residual value after contracts end | [28] |
| Customer concentration (top 1 and top 2) | Counterparty risk | [29] |
| Cost of debt by facility; rating; contract term against debt maturity | Cost of capital; refinancing risk | [23][24] |
| GAAP operating income ÷ interest, alongside adjusted EBITDA ÷ interest | Real coverage | [22] |
| Depreciation life against peers; EBIT restated at the peer-shortest life | Earnings quality | [25][26] |
| Capex, construction in progress, capitalized costs | Cash burn | [22] |
| Backstops, related-party demand, supplier financing | Whether demand comes from end users | [27] |

**AI-chip startups (CBRS)**

| KPI | Why it matters | Source |
|---|---|---|
| Revenue share of the top 1 and top 2 customers; share of backlog by customer | Concentration | [32] |
| RPO, contracted MW, delivery schedule | Conversion risk | [33] |
| New design wins and new logos outside the top two | Diversification of the business | [32] |
| GAAP gross margin against core; hardware vs cloud mix | Margin path | [33][34] |
| Customer-warrant amortization booked as a reduction of revenue | Real price after incentives | [34][35] |
| Dilution: share count change, SBC/revenue, options and warrants outstanding | Value per share | [12] |
| Cash against burn; pass-through revenue | Funding runway | [33][34] |
| Lock-up release dates | Supply of shares coming to market | [40] |

---

## E. Quality and governance checklist

**Earnings quality**
- [ ] **Accruals ratio:** (net income − operating cash flow) ÷ average assets. Sloan (1996) found that earnings built on accruals persist less than earnings backed by cash, and that prices behave as if investors miss this [37].
- [ ] **Cash conversion:** FCF ÷ net income. Flag items routed through financing instead, such as MU's customer deposits [18].
- [ ] **GAAP-to-adjusted bridge:** line by line, with every exclusion labeled. Investors cite weak reconciliations and excluded recurring costs as concerns [39].
- [ ] **SBC:** treat it as an expense; never add it back. Track SBC/revenue and the net change in share count. Value options and subtract them [12].
- [ ] **Customer warrants:** under ASC 606 these reduce revenue unless the company receives a distinct good or service in return. ASC 718 governs how they are measured [35][36]. Use GAAP revenue for multiples.
- [ ] **Depreciation life:** state the policy and any recent changes, and show EBIT at peers' asset lives [25][26].
- [ ] **Capitalized costs:** internal-use software, interest, and the growth in construction in progress [22].
- [ ] **Beneish M-score:** a screen, not proof. Its eight indices include receivables, margins, asset quality and accruals [38].
- [ ] **Audit:** the auditor's opinion and any material weaknesses [4].
- [ ] **Circular arrangements:** a supplier that is also investor, customer or backstop [27].

**Governance and ownership**
- [ ] **Share classes:** compare voting power with economic ownership. CoreWeave's Class B shares carry 10 votes each. One analysis puts them at about 17% of shares but 67% of votes as of July 2026 [30]. The Council of Institutional Investors (CII) wants dual-class structures to sunset within about seven years [42]. Damodaran gives a formula for per-share value when share classes carry a voting premium [12].
- [ ] **Lock-ups:** the terms are in the prospectus, and 180 days is typical [40]. One study finds a 1–3% price drop and about 40% higher trading volume around expiry [41]. Put the release dates on the catalyst timeline.
- [ ] **Insider selling:** directors and officers trading under 10b5-1 plans face a cooling-off period of at least 90 days [43]. Show sales relative to holdings. CoreWeave's founders sold more than $2.3B after the lock-up expired [31].
- [ ] **Capital allocation:** rate it Exemplary, Standard or Poor, based on the balance sheet, investment and shareholder distributions [1].
- [ ] **Ownership disclosure:** float, major holders and the author's own position [1][4].

---

## F. Sources (all accessed 2026-10-12)

**Notes on access:**
- **Skipped:** SEC EDGAR, because it requires an identifying header.
- **Mirrors:** Morgan Stanley's site blocked automated fetches, so the Mauboussin papers were read from public mirrors where noted.
- **Secondary figures:** some company figures come from secondary coverage, marked "secondary". Check them against filings before publishing.

1. Morningstar, *Equity Research Methodology* (Sept 2022). https://www.morningstar.com/content/dam/marketing/shared/research/methodology/705988Morningstar_Equity_Research_Methodology.pdf
2. Morningstar, *Uncertainty Rating Methodology Update – FAQ* (2022). https://advhypo.morningstar.com/Enterprise/VTC/URFAQ.pdf
3. CFA Institute Research Challenge, written report guidelines and evaluation form (2024). https://www.cfainstitute.org/sites/default/files/-/media/documents/support/research-challenge/challenge/rc-written-report-guidelines.pdf
4. CFA Institute, *Equity Research Report Essentials* (Sept 2020). https://www.cfainstitute.org/sites/default/files/-/media/documents/support/research-challenge/challenge/rc-equity-research-report-essentials.pdf
5. FINRA Rule 2241 text, (c)(1)(B) and (c)(3). https://www.finra.org/sites/default/files/RegulatoryNotice15-30-Rule-2241-Equity-Research-Rule-text.pdf
6. Damodaran, *Valuing Young, Start-up and Growth Companies* (May 2009). https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/younggrowth.pdf
7. Damodaran, *Ups and Downs: Valuing Cyclical and Commodity Companies* (Sept 2009). https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/commodity.pdf
8. Damodaran, *Valuing Distressed and Declining Companies* (June 2009). https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/NewDistress.pdf
9. Damodaran, *Narrative and Numbers* slides. https://pages.stern.nyu.edu/~adamodar/pdfiles/eqnotes/narrativeandnumbers.pdf
10. Damodaran, *Living with Noise: Valuing Young Companies* (CFA, 2022). https://pages.stern.nyu.edu/~adamodar/pdfiles/country/YoungCoforCFA2022.pdf
11. CFA Institute Enterprising Investor, "Tell Me a Story: Aswath Damodaran on Valuing Young Companies" (May 2022). https://rpc.cfainstitute.org/blogs/enterprising-investor/2022/tell-me-a-story-aswath-damodaran-on-valuing-young-companies
12. Damodaran, "Share Count Confusion" (July 2018). https://aswathdamodaran.blogspot.com/2018/07/share-count-confusion-dilution-employee.html
13. Mauboussin and Callahan, *Measuring the Moat* (Oct 2024). Original: https://www.morganstanley.com/im/publication/insights/articles/article_measuringthemoat.pdf. Read via mirror: https://readwise-assets.s3.amazonaws.com/media/wisereads/articles/measuring-the-moat/article_measuringthemoat.pdf
14. Mauboussin, Callahan and Majd, *The Base Rate Book* (Credit Suisse, Sept 2016). Mirror: https://sorfis.com/wp-content/uploads/2021/09/The-Base-Rate-Book-Integrating-the-Past-to-Better-Anticipate-the-Future-September-2016.pdf
15. Expectations Investing, "The Approach". https://www.expectationsinvesting.com/about
16. Hedge Fund Alpha, review of *Expectations Investing*, defining the market-implied forecast period (Nov 2021). https://hedgefundalpha.com/education/expectations-investing/
17. Mauboussin and Callahan, *Trading Stages in the Company Life Cycle* (cited from its search abstract only). https://www.morganstanley.com/im/publication/insights/articles/article_tradingstagesinthecompanylifecycle.pdf
18. Micron, FQ4-26 earnings call prepared remarks (Sept 30, 2026). https://s25.q4cdn.com/621799436/files/doc_financials/2026/q4/Q4-FY26-Prepared-Remarks.pdf
19. Micron, FQ4-23 results (FY2023 revenue $15.54B, gross margin −9.1%; secondary summary of the release). https://micron.gcs-web.com/node/45791
20. TrendForce, 4Q26 memory contract-price outlook (Sept 30, 2026). https://www.trendforce.com/presscenter/news/20260930-13258.html
21. TrendForce, HBM4 share news (Aug 10, 2026). https://www.trendforce.com/news/2026/08/10/news-samsungs-hbm4-yield-reportedly-hits-80-as-race-to-supply-vera-rubin-heats-up-sk-hynix-labor-talks-add-a-twist/
22. CoreWeave, Q2 2026 results (Aug 11, 2026). https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx
23. CoreWeave, $8.5B investment-grade GPU-backed facility (SOFR+225 bp; secondary summary). https://investors.coreweave.com/news/news-details/2026/CoreWeave-Closes-Landmark-8-5-Billion-Financing-Facility-Achieving-First-Investment-Grade-Rated-GPU-backed-Financing/default.aspx
24. Converge Digest, CoreWeave $2.6B loan (SOFR+550 bp, contracts about 3 years; secondary). https://convergedigest.com/coreweave-2-6b-loan-gpu-ai-infrastructure-financing/
25. SiliconANGLE, "Resetting GPU depreciation" (Nov 2025). https://siliconangle.com/2025/11/22/resetting-gpu-depreciation-ai-factories-bend-dont-break-useful-life-assumptions/
26. Bizety, "GPU Depreciation: CoreWeave vs. Nebius" (Sept 2025). https://bizety.com/2025/09/23/gpu-depreciation-coreweave-vs-nebius/
27. RCR Wireless, Nvidia's $6.3B commitment to buy CoreWeave's unused capacity. https://www.rcrwireless.com/?p=424411
28. IntuitionLabs, data-center GPU pricing 2026 (cites SemiAnalysis). https://intuitionlabs.ai/articles/data-center-gpu-pricing-2026
29. sec-api.io, CoreWeave customer concentration (secondary). https://sec-api.io/insights/coreweave-crwv-2026-revenue-analysis-top-customer-concentration-exposure
30. sec-api.io, CoreWeave ownership and votes (secondary). https://sec-api.io/insights/coreweave-crwv-ownership-and-votes
31. GuruFocus, CoreWeave executives' sales after the lock-up (secondary). https://www.gurufocus.com/news/8907358/coreweave-crwv-executives-sell-over-23b-in-stock-following-lockup-period
32. Barchart via Yahoo Finance, Cerebras IPO (May 16, 2026). https://finance.yahoo.com/markets/stocks/articles/cerebras-biggest-ipo-buy-cbrs-153002579.html
33. The Energy Mag, Cerebras Q2 2026 results (Aug 12, 2026). https://theenergymag.com/news/market-news/cerebras-systems-reports-180-million-q2-2026-revenue-following-ipo
34. Cerebras, Q2 2026 release and definitions of "core" metrics (Aug 12, 2026; read via search summary). https://investors.cerebras.ai/news-releases/news-release-details/cerebras-systems-fast-inference-cloud-business-nearly-quadruples
35. PwC Viewpoint 4.6, consideration payable to a customer. https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/revenue_from_contrac/revenue_from_contrac_US/chapter_4_determinin_US/46consideration_paya_US.html
36. FASB, ASU 2019-08. https://storage.fasb.org/ASU%202019-08.pdf
37. Sloan (1996), *The Accounting Review* 71(3); summary from Berkeley Haas. https://newsroom.haas.berkeley.edu/research/prof-richard-sloan-honored-top-accounting-award-3/
38. Beneish M-score (FAJ, 1999), course handout. https://bpb-us-w2.wpmucdn.com/u.osu.edu/dist/3/40936/files/2016/12/M-Score-pa6gdy.pdf
39. CFA Institute, *Investor Uses, Expectations, and Concerns on Non-GAAP Financial Measures* (2016). https://rpc.cfainstitute.org/-/media/documents/support/advocacy/investor-uses-expectations-concerns-on-non-gaap.pdf
40. Investor.gov, IPO lock-up agreements. https://www.investor.gov/introduction-investing/investing-basics/glossary/initial-public-offerings-lockup-agreements
41. Ofek and Richardson, lock-up expirations (NYU). https://archive.nyu.edu/handle/2451/27072
42. IR Magazine, CII petitions exchanges for dual-class sunsets. https://irmagazine.com/buy-side/cii-petitions-exchanges-dual-class-sunsets
43. K&L Gates, Rule 10b5-1 amendments (Dec 2022). https://www.klgates.com/thought-leadership/SEC-Adopts-Amendments-to-Rule-10b5-1-Insider-Trading-Plans-and-Related-Matters-12-20-2022
44. CFA Institute Enterprising Investor, "The Five Dimensions of Variant Perception" (2015). https://rpc.cfainstitute.org/blogs/enterprising-investor/2015/the-five-dimensions-of-variant-perception
45. Corporate Finance Institute, valuation methods and the football field chart. https://corporatefinanceinstitute.com/resources/accounting/valuation-methods/
