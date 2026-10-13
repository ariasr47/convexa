# Meta-perspectives: making Convexa research notes more rigorous and less biased

**As of 2026-10-12.** Research brief on method, not on any stock. It contains no investment advice and no buy/sell view. Bracketed numbers [n] refer to section F. Where a source is secondary, thin or contested, the text says so.

**Fit with the repo.** Front matter keys are a closed list (`tools/research-notes/notes.mjs:42`), and any other key fails the build. So the probability fields below belong in the note body, unless the parser is deliberately changed. The build walks only uppercase ticker folders and skips `_`-prefixed names (`notes.mjs:556-568`), so a ledger at `research/_forecasts.csv` won't trip `npm run research:check`.

---

## A. The 10 most valuable additions, ranked

**1. "What the price already assumes", then the variant view.**
Before the thesis, state in numbers what today's price implies. A reverse DCF gives the revenue growth, margins and years of excess returns needed to justify the price. Then say where the note disagrees, why, and who is on the other side of that view. *Why:* Mauboussin and Callahan argue that beating the market needs a view different from what the market implies. They sort the sources of edge into behavioral, analytical, informational and technical [6]. Rappaport and Mauboussin's expectations investing starts from price-implied expectations, and they publish a free reverse-DCF spreadsheet [7]. Marks argues that consensus views are already reflected in prices [8]. *Present:* a table with columns Driver · Price implies · Note's view · Why different · Evidence that would settle it.

**2. Numeric, dated probabilities on scenarios and claims.**
Replace "likely", "could" and "may" with a number and a deadline. Bear, base and bull each get a probability, and the three sum to 100%. *Why:* in a survey of 1,700 people, the middle 90% of answers for "likely" ranged from 55% to 90% [27]. Sherman Kent hit the same ambiguity at the CIA in 1964 [26]. In a tournament with 764,448 forecasts, rounding numbers into coarse verbal bins measurably reduced accuracy [23]. Mauboussin and Callahan define value as a probability-weighted range of payoffs, not a point estimate [31]. Damodaran treats best/likely/worst scenarios as the simplest probabilistic tool. He reserves decision trees for sequential risks and simulation for continuous ones [33]. *Present:* Scenario · P · Value/share · Horizon · One-line causal story, then a probability-weighted value row.

**3. Outside view first: base rates for the key drivers.**
Before forecasting a driver, write the reference-class rate, then adjust from it. For example: how often have companies of similar size grown revenue at X% for three or five years? *Why:* Lovallo and Kahneman show the outside view is usually more accurate and far less prone to wildly unrealistic forecasts. Their method has three steps: pick a reference class, get its outcome distribution, then place the case within it [3]. *The Base Rate Book* gives empirical distributions for sales growth, EPS growth and margins, conditioned on starting size [4]. "Bayes and Base Rates" applies this to revenue forecasts using U.S. data from 1950 to 2024 [5]. This step matters most when a scenario needs growth far above the reference-class median. *Present:* Driver · Base rate (class, source) · Note's estimate · Reason for the gap.

**4. Kill criteria as measurable "states and dates".**
Rewrite "What would change the picture" as pre-committed triggers. Each trigger gets a metric, a threshold, a resolving source, a check-by date and the action it forces (change stance, retire the note). *Why:* Annie Duke argues that exit criteria have to be set in advance, because judgment degrades while you are losing [18]. The last step of Heuer's Analysis of Competing Hypotheses (ACH) is to name milestones that would show events diverging from the expected course [12]. *Present:* Trigger · Threshold · Source · Check by · Then.

**5. Pre-mortem, in both directions.**
Assume it is 12 months later and the thesis has failed, and write the most plausible story of why. Then do the same for the opposite stance. *Why:* Klein's premortem assumes the failure has already happened and asks what went wrong, which makes dissent safe to voice [1]. In his procedure, each person writes reasons independently for about two minutes, the reasons are pooled, and each one is rated for likelihood and impact. In the one controlled study he cites (Veinott, Klein & Wiggins 2010), the premortem reduced overconfidence more than pros-and-cons lists or critiques did [2]. Klein's later "double-barreled" variant also imagines the failure that comes from *not* acting, so the costs of acting and not acting are weighed together [30]. In a note, that is the opposite-stance pass. The evidence rests on that single study, so treat the premortem as cheap insurance rather than a proven method. *Present:* three "how this failed" bullets, each tied to a kill criterion or a risk.

**6. A steelmanned opposing case that passes an "ideological Turing test".**
Write the case against as its strongest holder would, with their best evidence. Test: would a committed bear sign it? *Why:* Mill argued that someone who knows only their own side of a question has little basis for their view [17]. Caplan's test asks whether you can state an opponent's view to that opponent's satisfaction [16]. Lord, Lepper and Preston found that an explicit "consider the opposite" instruction reduced biased assimilation of evidence more than an instruction to be fair [10]. Nickerson's review documents confirmation bias across many settings [11]. *Present:* a "Strongest case against" section with its own sources, about as long as the case for.

**7. A prediction ledger and score card across all notes.**
Each note logs three to five resolvable forecasts in the ledger. Score them with Brier scores, and publish calibration once enough forecasts have resolved. *Why:* in the Good Judgment Project, training, teaming and tracking all improved accuracy [21]. A 2025 reanalysis disputes how large the teaming and training effects were [22]. Good Judgment scores every forecast with a Brier score [28]. A decision journal keeps the reasoning made at the time, which separates decision quality from outcome and blocks flattering hindsight stories [19]. *Present:* a per-note Forecasts table, and later a site-level Track record page.

**8. A positioning and sentiment panel.**
Short interest, insider and 13F activity, options pricing and Convexa's dealer gamma, each dated. *Why:* these show who holds the other side and how crowded a view is [6]. Each has known lags and blind spots [35][39][41] (see D1 and E).

**9. A capital allocation, dilution and governance block.**
Covers share-count trend, SBC as a share of revenue, shelf/ATM capacity, lock-up expiries, voting structure, ROIC against cost of capital, and the M&A record. *Why:* Mauboussin and Callahan call capital allocation the CEO's most important job and count SBC as a real cost [50][51]. Lock-up terms appear in the prospectus, and the SEC tells investors to check when they expire [52]. Recent IPOs are the most exposed.

**10. Visible updates: a change log with probability deltas.**
Each `updated:` revision adds a dated line: the new evidence, the old and new probability, and why. Update in small steps; don't rewrite. *Why:* in Good Judgment data, the best forecasters revised often and in small increments. Weaker forecasters held their first view or made rare large jumps [24]. One of the "Ten Commandments" is to balance under- and over-reaction to evidence [20]. The README already keeps older notes visible, and this extends the same idea to probabilities.

---

## B. Debiasing checklist (run before publishing)

Answer each item yes or no. Record any "no" and the reason in the note's change log.

**Framing**
1. Did I state the market-implied expectation before my own view? [6][7]
2. Did I state the base rate and its reference class before the inside view? [3][4]
3. Is every vague probability word either turned into a number with a date or deleted? [26][27]

**Disconfirmation**
4. Did I list the evidence that would discriminate between the bull and bear stories, and go looking for it? ACH treats evidence that fits every hypothesis as having no diagnostic value. Its aim is to reject hypotheses, not confirm a favorite [12].
5. Is the opposing case written at full strength (item A6)? [10][16]
6. Is the pre-mortem done, with each failure story mapped to a kill criterion? [1][2]
7. Inversion: what would guarantee this thesis fails, and is the note quietly assuming any of it? Munger built his 1986 talk on solving problems backward [14].
8. Second order: ask "and then what?" about the main catalyst. For example, if demand surprises upward, what do competitors' capacity and pricing do a year later? [15]

**Incentives and process.** Items 9–13 are adapted from Kahneman, Lovallo and Sibony's 12-question decision review [9].

9. Self-interest: do I hold or plan to hold a position? Disclose it. Analysts are held to the same disclosure standard [43].
10. Have I fallen in love with the idea? Was dissent actively sought, through a red-team pass by another person or a prompted adversarial review? The UK MOD handbook presents a red-team mindset that individuals can apply to their own work [13].
11. Is the thesis built on a salient analogy ("the next X")? Test whether the analogy fits, and name the alternatives [9].
12. Halo: does confidence in management rest on the recent share price rather than on its capital-allocation record? [9][50]
13. Are competitors being underrated? [9]

**Evidence hygiene**
14. Are the sources independent, with primary filings ahead of coverage of them? [48]
15. Is each figure labelled as fact, calc or judgment? (The current briefs already mark "Calc".)
16. Did I rate each lens in section D separately before forming the overall stance? Kahneman, Lovallo and Sibony's Mediating Assessments Protocol (MAP) postpones the global judgment until the separate assessments are done [68].
17. Does positioning data carry timestamps, and is it kept out of the fundamental evidence (section E)?
18. When updating an older note: did I write today's estimate before re-reading the old one, and then reconcile the two? (This is a procedural suggestion, not a sourced finding.)

---

## C. Forecasting and calibration protocol

**C1. Write forecasts that can be resolved.**
- *Format:* question · resolution rule · resolving source · deadline · probability. Vague forecasts can't be scored, so be specific [19]. Illustrative shape, not a prediction: "Will <TICKER> report FQx revenue ≥ $Y in the 10-Q filed by <date>? Resolves on the 10-Q revenue line. P = 0.65."
- *Mix per note:* one or two fundamental thresholds, one catalyst ("happens by date"), one price-relative forecast (against an index or an implied range), and one positioning forecast (E4).
- *Granularity:* use 5-point steps between 10% and 90%, finer steps near the extremes, and never 0 or 100. Commandment 6 is to distinguish as many degrees of doubt as the problem allows, and no more [20]. Finer granularity carried real information in the tournament data [23].
- *Scenarios:* make them mutually exclusive and collectively exhaustive, summing to 100%. Give each a value and a horizon, and compute expected value. Add a confidence note on how firm the probabilities are. Mauboussin points out that two opportunities with the same discount to expected value can deserve different confidence [32].
- *Market benchmark:* compare the note's probability of reaching the target with the options-implied probability for the same horizon. The gap is the variant perception expressed as one number. Caveat: option-implied probabilities are risk-neutral. They include how investors value outcomes in different states of the world, so they are not pure forecasts [34].

**C2. Update.** Revise in small steps when evidence arrives. Log date · trigger · old → new [24]. Guard against both under- and over-reaction [20]. Supersede old entries and never delete them.

**C3. Track on disk.** Keep one CSV, `research/_forecasts.csv` (outside the build's scope, see the top of this brief). Columns: `id, ticker, note_file, made_on, question, resolution_rule, source, resolve_by, p, updates, outcome(1/0/void), resolved_on, brier`.

**C4. Score.**
- *Brier score (binary):* (p − o)², where o is 1 if the event happened and 0 if not. 0 is perfect; average over resolved forecasts. Good Judgment uses a two-sided version that sums over both outcomes and runs from 0 to 2 [28]. For a binary question that is exactly twice the one-sided score. Pick one convention and label it.
- *Benchmarks to beat:* always saying 50% scores 0.25. Always stating the base rate c scores c(1 − c), which is the "uncertainty" term in Murphy's decomposition [29].
- *Decompose:* Murphy splits the Brier score into reliability (calibration), resolution (discrimination) and uncertainty. The estimate depends on how forecasts are binned, so report the bins [29].
- *Multi-outcome scenarios:* score bear/base/bull with the multi-category Brier score: the sum of squared errors across categories, as in Good Judgment's Fed-rate example [28].
- *Diagnosis:* the BIN model splits error into bias, partial information and noise. Reducing noise was the most consistent lever across interventions [25], which argues for fixed checklists and templates.
- *Review cadence:* after each earnings report and at each `resolve_by` date. Write a short post-mortem that separates decision quality from luck [19].

**C5. Publish the record.** Once a meaningful number of forecasts has resolved, add a calibration table: stated-probability bucket against realized frequency, with the count in each bucket. Small buckets are noisy, so show the counts. Include the misses.

---

## D. Lens-by-lens guide

Format for each lens: **look at** · **free sources** · **compact presentation** · pitfalls.

**D1. Positioning and sentiment**
- *Short interest and days to cover.* Brokers report positions to FINRA twice a month. Data is published on the 7th business day after each settlement date [36]. Days to cover = shares short ÷ average daily volume [37]. FINRA warns that the daily short-sale *volume* file is a different dataset, and that sites often mislabel it as short interest [35]. Fails-to-deliver: the SEC posts them twice monthly and says they are not evidence of naked short selling [38]. *Present:* `SI 4.1% float · DTC 2.3 · as of 09-30 (pub 10-09) · 3-report trend ↑`.
- *Insiders.* A Form 4 is due within two business days. Transaction codes separate open-market purchases (P) and sales (S) from grants, exercises and tax withholding [39]. The 2022 Rule 10b5-1 amendments added 90–120-day cooling-off periods for officers and directors and revised Forms 4 and 5 to flag plan trades [40]. Insiders often sell for liquidity or diversification, which makes sales a weak signal [39]. *Present:* `6-mo open-mkt buys n/$ · sells n/$ · % of sales under 10b5-1`.
- *Institutions.* A 13F is filed quarterly, within 45 days of quarter-end, by managers with ≥$100M. It shows long positions only [41]. A Schedule 13D (any >5% holder) is now due within 5 business days [42]. *Present:* top-holder changes quarter over quarter, plus new 13D/13G filings.
- *Analyst revisions.* Track the direction of estimate changes over 30 and 90 days. Chan, Jegadeesh and Lakonishok found that analysts' forecasts react sluggishly to past news, alongside price and earnings-momentum drifts [44]. Research reports must disclose conflicts [43]. Free consensus data is patchy, so record the source and date of every consensus figure.
- *Options.* Look at the implied volatility (IV) level against its own history, the IV term structure around earnings, skew, and the expected move. IV is a forward-looking number backed out of option prices with a pricing model [45]. Skew is the slope of IV across strikes [46]. The OCC publishes volume, open interest and put/call ratios [47]. The 1σ expected move ≈ S·IV·√(days/365), and an ATM straddle ≈ 0.8 of that move [69]. *Present:* `IV 62% (1-yr pct 70) · implied move to post-earnings expiry ±9.5% · 25Δ put-call skew +6 pts`.

**D2. Management and capital allocation**
- *Look at:* ROIC against cost of capital over time; the mix of capex, M&A, buybacks and dividends; what executive pay rewards. Mauboussin and Callahan assess allocation through its history, ROIC, incentives and five principles [50].
- *Sources:* the 10-K MD&A and risk factors [48]; the compensation discussion in the DEF 14A proxy [49].
- *Present:* `3-yr uses of cash: capex x% · M&A y% · buybacks z% · ROIC vs WACC · pay tied to: …`.

**D3. Governance, dilution and SBC**
- *Look at:* voting structure and any sunset clause. The Council of Institutional Investors (CII) asks exchanges to require sunsets of seven years or less [53]. Also lock-up expiries, usually 180 days and disclosed in the prospectus [52]; remaining shelf/ATM capacity (dilution as the SEC defines it [54]); and SBC as a share of revenue and net of buybacks. SBC reached $270B in 2022, and young companies' shareholders bear more of the dilution [51].
- *Present:* `diluted shares +x% YoY · SBC y% rev · ATM left $z · lock-up dates · insider vote %`.

**D4. Macro and rates**
- *Look at:* discount-rate sensitivity. Long-duration (growth-heavy) equities are more sensitive to changes in discount rates [56]. A reverse DCF shows how much of the value sits in distant years [7]. *Source:* FRED DGS10, the daily 10-year Treasury yield from the Fed's H.15 release [55].
- *Present:* `+100 bp discount rate → −x% base value · main cyclical driver: … (source)`.

**D5. Supply chain, geopolitics and regulation**
- *Look at:* customer concentration (ASC 280 requires disclosure of any customer at ≥10% of revenue, and Reg S-K may require naming it [58]); single-source suppliers and the 10-K risk factors, which are generally listed in order of importance [48]; export controls on advanced computing chips, chipmaking equipment and high-bandwidth memory (BIS rules from October 2022 and October 2023, with later updates) [57].
- *Present:* `top customer x% · single-source: … · rule exposure: <rule, date, status>`.

**D6. Technical and price context**
- *Look at:* 3–12-month momentum and distance from the 52-week high, which are documented return patterns [59][60]; drawdown from peak; realized against implied volatility; relative strength against the sector.
- *Present:* one line plus a sparkline. Treat it as context, never as evidence for the thesis.

---

## E. Convexa's distinctive lens: dealer positioning (GEX)

**E1. What it adds.** Fundamentals say what something is worth. Dealer positioning says how the *path* may behave. When dealers are net long gamma, their hedging tends to cushion moves; when they are net short gamma, it tends to amplify them [62]. The evidence:
- Ni, Pearson, Poteshman and White find that delta-hedgers' net gamma is negatively related to stock volatility on all days, not only at expiration. The earlier work they build on found stock prices clustering at strikes on expiration dates [63].
- Barbon and Buraschi link negative gamma imbalance, combined with illiquidity, to intraday momentum and to the frequency of flash crashes in single stocks [64].
- Baltussen et al. tie short-gamma hedging to intraday momentum at the market level, which reverses over the following days [65].

**E2. Limits to state in every note.**
- *Who holds the position.* Open interest doesn't show who is long. Naive GEX assumes dealers are long calls and short puts; SqueezeMetrics later moved to estimating dealer direction [61][62]. Vendors model it differently [67].
- *Net, not gross.* Cboe's 0DTE analysis shows that balanced two-way flow leaves dealers with little net gamma [66]. Cboe has a commercial stake in that conclusion.
- *Staleness.* Open interest is updated end-of-day [47], and walls migrate as positions roll [67].
- *Horizon mismatch.* The documented effects run from intraday to a few days [64][65], while the theses run over quarters. GEX informs timing and path risk, not value.
- *Liquidity.* The effects are strongest in the least liquid names [64].

**E3. Presentation.** A "Dealer positioning" box, shown only when data is live:

| Field | Format |
| --- | --- |
| As of | timestamp · model · data source |
| Spot vs gamma flip | above/below · distance % |
| Call wall / put wall | strike · % from spot |
| Net GEX | sign · percentile against the name's own 1-yr history |
| Next big expiry / earnings | date · implied move to that expiry |
| Regime, one sentence | e.g. "Above the flip, hedging tends to damp moves between X and Y." |
| Does not say | direction, or anything about the thesis |

When data is paused, write "Positioning: unavailable (live data off since <date>)". Never fill the box from memory. This matches the site's existing paused-data state.

**E4. Make it testable: Convexa's own calibration loop.**
- Each note logs one positioning forecast in the ledger, e.g. P(close between the put wall and the call wall at the next monthly expiry) = 0.6. Brier scores then show whether Convexa's levels carry information for these names. SpotGamma's published call-wall breach statistics are one model for this kind of self-audit [67].
- Put the note's target probability next to the options-implied (risk-neutral) probability [34]. This uses the product's own data to quantify the variant perception from A1.
- In kill criteria, use GEX only for timing and risk. For example: "below the flip into earnings → expect a wider range; thesis unchanged."

---

## F. Sources (accessed 2026-10-12)

1. Klein, "Performing a Project Premortem," HBR, Sep 2007. https://hbr.org/2007/09/performing-a-project-premortem
2. Klein, "The Pre-Mortem Method," Psychology Today, Jan 2021. https://www.psychologytoday.com/us/blog/seeing-what-others-dont/202101/the-pre-mortem-method
3. Lovallo & Kahneman, "Delusions of Success," HBR, Jul 2003. https://hbr.org/2003/07/delusions-of-success-how-optimism-undermines-executives-decisions
4. Mauboussin, Callahan & Majd, *The Base Rate Book*, Credit Suisse, Sep 2016 (third-party mirror). https://sorfis.com/wp-content/uploads/2021/09/The-Base-Rate-Book-Integrating-the-Past-to-Better-Anticipate-the-Future-September-2016.pdf
5. Mauboussin & Callahan, "Bayes and Base Rates," Morgan Stanley IM. https://www.morganstanley.com/im/publication/insights/articles/article_bayesandbaserates_ltr.pdf
6. Mauboussin & Callahan, "Who Is On the Other Side?," Morgan Stanley IM. https://www.morganstanley.com/im/publication/insights/articles/article_whoisontheotherside.pdf
7. "Expectations Investing: A Q&A With Michael Mauboussin and Alfred Rappaport," Motley Fool, Jan 2022. https://www.fool.com/investing/2022/01/19/expectations-investing-qanda-mauboussin-rappaport/
8. Marks, "I Beg to Differ," Oaktree memo, Jul 2022. https://www.oaktreecapital.com/insights/memo/i-beg-to-differ
9. Kahneman, Lovallo & Sibony, "Before You Make That Big Decision…," HBR, Jun 2011. https://hbr.org/2011/06/the-big-idea-before-you-make-that-big-decision
10. Lord, Lepper & Preston, "Considering the opposite," JPSP 47(6), 1984 (abstract). https://causeweb.org/cause/node/7638
11. Nickerson, "Confirmation Bias: A Ubiquitous Phenomenon in Many Guises," 1998. https://pages.ucsd.edu/~cmckenzie/nickersonConfirmationBias.pdf
12. Heuer, *Psychology of Intelligence Analysis*, CIA CSI (ch. 8, ACH). https://www.cia.gov/resources/csi/static/Pyschology-of-Intelligence-Analysis.pdf ; step summary: https://en.wikipedia.org/wiki/Analysis_of_competing_hypotheses
13. UK MOD/DCDC, *Red Teaming Handbook*, 3rd ed., 2021. https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1027158/20210625-Red_Teaming_Handbook.pdf
14. Munger, "How to Guarantee a Life of Misery," 1986 (transcript). https://jamesclear.com/great-speeches/how-to-guarantee-a-life-of-misery-by-charlie-munger
15. Farnam Street, "Second-Order Thinking." https://fs.blog/second-order-thinking/
16. Caplan, "The Ideological Turing Test," EconLog, Jun 2011. https://econlib.org/archives/2011/06/the_ideological.html
17. Mill, *On Liberty*, ch. II (Project Gutenberg). https://gutenberg.org/files/34901/34901-h/34901-h.htm
18. Duke, TED podcast transcript on quitting. https://www.ted.com/podcasts/knowing-when-to-quit-with-world-poker-champion-annie-duke-transcript
19. Farnam Street, "Michael Mauboussin: Two Tips to Improve the Quality of Your Decisions" (decision journal; secondary). https://fs.blog/how-to-improve-the-quality-of-our-decision-making/
20. Good Judgment, "Ten Commandments for Aspiring Superforecasters." https://goodjudgment.com/philip-tetlocks-10-commandments-of-superforecasting/
21. Mellers et al., "Psychological Strategies for Winning a Geopolitical Forecasting Tournament," Psych. Science, 2014. https://journals.sagepub.com/doi/10.1177/0956797614524255
22. Hauenstein et al., "Rethinking the Role of Teams and Training in Geopolitical Forecasting," Psych. Science, 2025. https://journals.sagepub.com/doi/10.1177/09567976241266481
23. Friedman, Baker, Mellers, Tetlock & Zeckhauser, "The Value of Precision in Probability Assessment," ISQ, 2018. https://academic.oup.com/isq/article-abstract/62/2/410/4944059
24. Atanasov et al., "Small Steps to Accuracy: Incremental Belief Updaters Are Better Forecasters," OBHDP, 2020. https://faculty.wharton.upenn.edu/wp-content/uploads/2022/03/1-s2.0-S0749597819300949-main.pdf
25. Satopää, Salikhov, Tetlock & Mellers, "Bias, Information, Noise: The BIN Model of Forecasting," Mgmt. Science, 2021. https://faculty.wharton.upenn.edu/wp-content/uploads/2022/03/mnsc.2020.3882.pdf
26. Kent, "Words of Estimative Probability," CIA Studies in Intelligence, 1964. https://www.cia.gov/resources/csi/studies-in-intelligence/archives/vol-8-no-4/words-of-estimative-probability
27. A. & M. Mauboussin, "If You Say Something Is 'Likely,' How Likely Do People Think It Is?," HBR, Jul 2018. https://hbr.org/2018/07/if-you-say-something-is-likely-how-likely-do-people-think-it-is
28. Good Judgment, "Superforecaster Accuracy" and "Superforecasting the Fed's Target Range" (Brier 0–2; multi-category example). https://goodjudgment.com/wp-content/uploads/2022/10/Superforecaster-Accuracy.pdf ; https://goodjudgment.com/wp-content/uploads/2023/06/Superforecasting-the-Fed-Target-Rate_6_14_23.pdf
29. Murphy (1973) Brier decomposition, as presented in Arnold et al., "Decompositions of the mean continuous ranked probability score." https://arxiv.org/pdf/2311.14122 ; binning note: https://search.r-project.org/CRAN/refmans/scoring/html/brierscore.html
30. Klein, "Double-Barreled Pre-Mortems," Psychology Today, Jul 2025. https://www.psychologytoday.com/us/blog/seeing-what-others-dont/202507/double-barreled-pre-mortems
31. Mauboussin & Callahan, "Probabilities and Payoffs," Morgan Stanley IM, Feb 2025. https://www.morganstanley.com/im/publication/insights/articles/article_probabilitiesandpayoffs.pdf
32. Mauboussin & Callahan, "Confidence," Morgan Stanley IM. https://www.morganstanley.com/im/publication/insights/articles/article_confidence.pdf
33. Damodaran, "Probabilistic Approaches: Scenario Analysis, Decision Trees and Simulations," NYU Stern. https://pages.stern.nyu.edu/~adamodar/pdfiles/valrisk/ch6.pdf
34. Federal Reserve Bank of Minneapolis, "Current and Historical Market-Based Probabilities." https://minneapolisfed.org/banking/current-and-historical-market--based-probabilities
35. FINRA, "Short Interest" (investor insight). https://www.finra.org/investors/insights/short-interest
36. FINRA, Equity Short Interest data catalog. https://www.finra.org/finra-data/browse-catalog/equity-short-interest
37. Schwab, "Short Interest Monitor Explained." https://www.schwab.com/learn/story/short-interest-monitor
38. SEC, Fails-to-Deliver Data. https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data
39. SEC/Investor.gov, "Investor Bulletin: Insider Transactions and Forms 3, 4, and 5." https://www.investor.gov/news-alerts/investor-bulletins/investor-bulletin-insider-transactions-forms-3-4-5
40. SEC press release 2022-222, Rule 10b5-1 amendments. https://www.sec.gov/newsroom/press-releases/2022-222
41. SEC, "Frequently Asked Questions About Form 13F." https://www.sec.gov/divisions/investment/13ffaq
42. SEC press release 2023-219, beneficial ownership reporting. https://www.sec.gov/newsroom/press-releases/2023-219
43. Investor.gov, "Securities Analyst Recommendations." https://www.investor.gov/introduction-investing/investing-basics/glossary/securities-analyst-recommendations
44. Chan, Jegadeesh & Lakonishok, "Momentum Strategies," JF 51(5), 1996. https://ideas.repec.org/a/bla/jfinan/v51y1996i5p1681-1713.html
45. Cboe Options Institute, Options Trading Glossary (volatility, implied volatility). https://www.cboe.com/optionsinstitute/glossary/
46. Cboe, SKEW Index white paper. https://cdn.cboe.com/resources/indices/documents/SKEWwhitepaperjan2011.pdf
47. OIC/OCC, Market Data (volume, open interest, put/call). https://www.optionseducation.org/referencelibrary/market-data
48. Investor.gov, "How to Read a 10-K." https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k
49. Investor.gov, "Proxy Statements: How to Find." https://www.investor.gov/introduction-investing/investing-basics/glossary/proxy-statements-how-find
50. Mauboussin & Callahan, "Capital Allocation: Results, Analysis, and Assessment," Morgan Stanley IM, Nov 2025. https://www.morganstanley.com/im/publication/insights/articles/article_capitalallocation.pdf
51. Mauboussin & Callahan, "Stock-Based Compensation: Unpacking the Issues," Morgan Stanley IM, Apr 2023. https://www.morganstanley.com/im/publication/insights/articles/article_stockbasedcompensation.pdf
52. Investor.gov, "Initial Public Offerings: Lockup Agreements." https://www.investor.gov/introduction-investing/investing-basics/glossary/initial-public-offerings-lockup-agreements
53. IR Magazine, "CII petitions exchanges for dual-class sunsets." https://irmagazine.com/buy-side/cii-petitions-exchanges-dual-class-sunsets
54. SEC, Small business glossary ("dilution"). https://www.sec.gov/resources-small-businesses/glossary
55. FRED, DGS10 10-Year Treasury Constant Maturity. https://fred.stlouisfed.org/series/dgs10
56. Dechow, Sloan & Soliman, "Implied Equity Duration," RAST, 2004. https://deepblue.lib.umich.edu/bitstream/2027.42/47748/1/11142_2004_Article_5272372.pdf
57. BIS press release, Oct 17, 2023 (advanced computing and SME rules). https://www.bis.gov/media/documents/2023.10.17-bis-press-release-acs-sme-rules-final-js.pdf ; Oct 2022 rules: https://www.bis.gov/press-release/commerce-implements-new-export-controls-advanced-computing-semiconductor-manufacturing-items-peoples
58. Deloitte DART, ASC 280 "Information About Major Customers." https://dart.deloitte.com/USDART/home/codification/presentation/asc280-10/roadmap-segment-reporting/chapter-5-entity-wide-disclosures/5-7-information-about-major-customers
59. Jegadeesh & Titman, "Returns to Buying Winners and Selling Losers," JF, 1993. https://doi.org/10.1111/j.1540-6261.1993.tb04702.x
60. George & Hwang, "The 52-Week High and Momentum Investing," JF, 2004. https://doi.org/10.1111/j.1540-6261.2004.00695.x
61. SqueezeMetrics, "Gamma Exposure (GEX)" white paper. https://squeezemetrics.com/monitor/download/pdf/white_paper.pdf
62. SqueezeMetrics, Monitor guide (DDOI; positive/negative GEX). https://squeezemetrics.com/monitor/static/guide.pdf
63. Ni, Pearson, Poteshman & White, "Does Option Trading Have a Pervasive Impact on Underlying Stock Prices?," RFS, 2021. https://www.ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf
64. Barbon & Buraschi, "Gamma Fragility," SSRN, 2020/21. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3725454
65. Baltussen, Da, Lammers & Martens, "Hedging Demand and Market Intraday Momentum," JFE, 2021. https://www3.nd.edu/~zda/intramom.pdf
66. Cboe, "Volatility Insights: Much Ado About 0DTEs," 2023. https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options
67. SpotGamma, "Call Wall & Put Wall Explained" and option-wall stats. https://spotgamma.com/call-wall-put-wall-explained/ ; https://spotgamma.com/option-wall-stats/
68. Kahneman, Lovallo & Sibony, "A Structured Approach to Strategic Decisions," MIT SMR 60(3), 2019 (repository record). https://ses.library.usyd.edu.au/handle/2123/28501
69. Options Analysis Suite, "Expected Move" (straddle ≈ 0.8 × 1σ derivation; secondary). https://www.optionsanalysissuite.com/documentation/expected-move

**Verification notes.** The Morgan Stanley PDFs [5][6][31][32][50][51] and the Good Judgment Ten Commandments page [20] returned HTTP 403 to direct fetch. Their content above comes from search-indexed excerpts of those pages and from summaries, not from reading the full text. The same applies to the HBR articles [1][3][9][27], which are paywalled. The 30% "prospective hindsight" figure often attached to premortems is left out because it could not be traced to the primary study.
