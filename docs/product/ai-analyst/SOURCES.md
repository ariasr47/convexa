# AI Analyst — sources and licence evidence

_Collected 2026-10-18 by five research passes for [DESIGN.md](DESIGN.md). Every page was read that
day unless marked otherwise. Licence terms from private companies are paraphrased with clause numbers;
check the exact wording at the link before relying on it. This is product research, not legal advice._

**"Not addressed" means the terms say nothing that was found, not that the use is allowed.** Where a
contract is silent about sending data to an AI model, the general bans on redistribution or "third
parties" are the clauses that would apply.

---

## 1. Options data and order flow

| Vendor | What you get | Price / month | Show it to others | Send it to an AI model |
|---|---|---|---|---|
| **Massive, individual plans** | Trades with integer `conditions` codes and exchange id (Developer and up); quotes on Advanced only; daily OI, greeks, IV | Basic $0, Starter $29, Developer $79 (15-min delayed), Advanced $199 (real-time, non-pros) | **No.** Market Data ToS §1: personal, non-business use, no apps for other users. §5(c): no redistributing or displaying the data or "Derived Works" to third parties (updated 2025-08-28) | Not addressed (Individuals ToS 2025-07-18; Market Data ToS) |
| **Massive, Options Business** | 10+ years of trades, 2.5 years of quotes, greeks; trades are end-of-day; real-time needs an "Expansion" (price not found) | $1,999 (or $19,188 / year) | **Yes.** §2.2(b) allows display inside products and websites; §6.1(d) bars passing it on as a feed or file (updated 2026-10-06) | **Yes, with limits.** §2.6 keeps data sent to "a Non-Massive Service, including an AI tool" under the agreement; §6.1(j) bars training, fine-tuning or distilling a model on it |
| Databento OPRA.PILLAR | Trades, BBO, statistics; **no OPRA sale conditions** (roadmap item "Accepted", not shipped) | Standard $199; Plus $1,500; Unlimited $4,000 | Standard: no distribution. Plus: commercial distribution | Not addressed |
| Cboe DataShop / LiveVol | Every OPRA print with the prevailing NBBO and condition id | Option Trades file $1,000 (cart subtotal); All Access API: Tier 3 $2,499, Tier 4 $4,599 (tiers 1–2 not found) | Historical only with a redistribution option, display only | Not addressed by name; §I.1(e)(ii) bars distributing to anyone not authorized |
| ThetaData | Trades with `condition` and `exchange`; NBBO; OI; greeks | Retail $40 / $80 / $160; commercial options $1,600 (annual) | Retail: no | Not addressed |
| Unusual Whales API | Pre-computed flow, `intermarket_sweep` and `cross_trade` flags | Basic $150, Advanced $375; historical trades +$250 | **No.** Personal use; products for end users need an enterprise licence | Not addressed by name; bars sharing the data "or any data derived from" it with any third party |
| Intrinio | Real OPRA feed only on Enterprise; lower tiers get Intrinio's own prices | Individual $150; Startup $333→$999; Enterprise $1,250+ | Individual: no. Startup: display rights | Pricing page lists "GenAI integration" as a feature, not a licence clause |
| Tradier | Broker API; chains with OI and ORATS greeks; time and sales has no condition codes | $0–35 brokerage plans | **No**, personal use unless a partner | Not addressed |
| ORATS | Derived chains; time and sales add-on from 2022-09 | $199–899; T&S +$299 | Individual: no (T&C §5.1) | Not addressed |

Sources:
[Massive options pricing](https://massive.com/pricing?product=options) ·
[Massive trades endpoint](https://massive.com/docs/rest/options/trades-quotes/trades) ·
[Massive Market Data ToS](https://massive.com/legal/market-data-terms-of-service) ·
[Massive Individuals ToS](https://massive.com/legal/individuals-terms-of-service) ·
[Massive Business](https://massive.com/business) ·
[Massive Business ToS](https://massive.com/legal/businesses-terms-of-service) ·
[Databento pricing](https://databento.com/pricing#opra) ·
[Databento agreement](https://databento.com/legal/databento-user-agreement) ·
[Databento roadmap item](https://roadmap.databento.com/b/n0o5prm6/feature-ideas/include-opra-trade-conditions) ·
[Cboe Option Trades](https://datashop.cboe.com/option-trades) ·
[Cboe All Access](https://datashop.cboe.com/cboe-all-access-api) ·
[Cboe DataShop licence](https://datashop.cboe.com/documents/Cboe_LiveVol_DataShop_License_Agreement.pdf) ·
[ThetaData pricing](https://www.thetadata.net/pricing) ·
[ThetaData terms](https://www.thetadata.net/terms-and-conditions) ·
[Unusual Whales API](https://unusualwhales.com/public-api) ·
[Unusual Whales terms](https://unusualwhales.com/terms) ·
[Intrinio pricing](https://intrinio.com/pricing) ·
[Tradier FAQ](https://docs.tradier.com/docs/faq) ·
[ORATS data](https://orats.com/data-api) ·
[ORATS terms](https://orats.com/terms-conditions)

### OPRA's own fees

From the [OPRA Fee Schedule](https://cdn.opraplan.com/documents/OPRA_Fee_Schedule.pdf) and the
[Vendor Agreement](https://cdn.opraplan.com/documents/OPRA_Vendor_Agreement.pdf):

- **Subscribers:** professional $31.50 per device; non-professional $1.25 per user.
- **Redistribution:** $1,500 a month ($650 query-only), for current *or delayed* data. It does not
  apply to "historical" data, which begins at the next session's open (footnote 6). Vendor Agreement
  §3(e) lets historical data go to anyone.
- **Non-display use** (which includes "investment analysis"): $2,000 per enterprise per category.
  Category 1 is waived for a single natural person who is not a broker-dealer.
- **AI:** none of the three documents mentions it.

For the owner-only design, the vendor's subscriber agreement (Massive's) carries these fees; Convexa
does not redistribute.

### How flow signals are computed from raw prints

Condition codes come from the [OPRA Pillar Output Spec v6.4b](https://cdn.opraplan.com/documents/OPRA_Pillar_Output_Specification.pdf),
Category a:

| Signal | Rule |
|---|---|
| **Sweep** | ISO-coded prints: `S` (ISOI), `b` (SLAI) and `d` (SCLI). Vendors also group same-contract prints hitting 2+ exchanges at nearly the same time. Intrinio uses a $3,000 minimum and stamps the first print. No source publishes its grouping window, so Convexa must pick one and document it. |
| **Block** | OPRA has no block code. Use the floor codes (`e` SLFT, `i` MLFT) and cross codes (`c` SLCN, `h` MLCT) plus a size or premium threshold Convexa sets and documents. |
| **Unusual activity** | Today's volume ÷ open interest. OI is a once-a-day figure (pre-market), so the comparison is against yesterday's OI. Unusual Whales flags a ratio above 1.0. |
| **Aggressor side** | Compare the print with the NBBO at that moment. |
| **Exclusions** | Cancels (`A` `C` `E` `G`), late reports (`B` `D`), and extended hours (`v`) are dropped. Multi-leg prints (`f`–`i`, `n`–`s`) are kept apart, because spread legs inflate premium totals. |

Supporting pages: [Intrinio knowledge base](https://intrinio.com/knowledge-base/market-data-stock-prices-options-etc),
[Intrinio real-time options](https://intrinio.com/products/options-realtime),
[Unusual Whales API docs](https://api.unusualwhales.com/docs).

---

## 2. Filings, news, transcripts and sentiment

| Source | Content | Price / month | Show it to others | Send it to an AI model |
|---|---|---|---|---|
| **SEC EDGAR** | Every filing: 8-K text and exhibits, Form 4, 13F, XBRL | $0 (10 requests a second; a User-Agent naming you and an email is required) | **Reuse permitted, credit requested.** The SEC says filing content is free to access and reuse, and sec.gov content may be copied and redistributed. It never calls filings "public domain", and exhibits such as 99.1 press releases are company works | Not addressed; reuse is permitted |
| Massive news | Title, description, URL, per-ticker sentiment; the Benzinga add-on adds full articles | Individual plans; Benzinga add-on $99 | Personal use; §5 bars displaying data or derivatives to third parties. Whether "Market Data" covers news is ambiguous | Not addressed |
| Finnhub | Company news, filings; social sentiment on All-in-One | $0; All-in-One $3,500 | Personal only; no sharing data or "derived results" with third parties without approval | Not addressed |
| FMP | News; transcripts on Ultimate | $29 / $69 / $139 | Needs a separate display licence | Not addressed |
| Tiingo | Headlines and tags, no body | $30 individual; $50 commercial internal | Internal use only | Not addressed |
| NewsAPI.org | Headlines and links, no full text | Business $449 | Commercial production use allowed; no republishing copyrighted material | Not mentioned |
| PR Newswire RSS | Headlines and snippets | $0 | Personal, non-commercial; no storing or passing to third parties | Bans using content to train an AI system |
| **API Ninjas transcripts** | Full call text, 8,000+ companies, hours after the call | Developer $59 (no caching); **Business $149** (caching allowed) | Paid plans allow commercial use and display; no reselling the API (§3.2, §7.3; terms 2026-09-13) | Only bars using output to build a *competing* service (§3.3) |
| Seeking Alpha transcripts | — | No public API | Bans scraping and republishing | Not mentioned |
| Reddit | Posts and comments | Commercial price not found | Every API use needs approval; deletions must be purged | No commercialization or AI training without written approval |
| X | Posts | $0.005 per post read | Posts intact, takedowns within 24 h | Bans training a foundation model on X content (§(k), 2026-04-27); inference not addressed |

**Press releases come through EDGAR.** Earnings releases are usually filed as Exhibit 99.1 to an 8-K
under Item 2.02, due within four business days. That gives press-release text with reuse permission
and no vendor contract.

**Sentiment methods.**

| Method | Licence | Caveat |
|---|---|---|
| FinBERT | Weights are CC BY-NC-SA 4.0 (non-commercial) | Trained on news sentences |
| Loughran–McDonald dictionary | Academic use only; commercial needs a licence | Word counts miss negation |
| **LLM with a fixed rubric (chosen)** | Convexa's own prompt | Look-ahead and company-knowledge bias (Glasserman & Lin): store the rubric version, model id and source text with every score |

Sources:
[SEC: accessing EDGAR data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) ·
[SEC privacy and copyright](https://www.sec.gov/privacy) ·
[SEC webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) ·
[SEC 8-K timing rule](https://www.sec.gov/rules-regulations/2004/03/additional-form-8-k-disclosure-requirements-acceleration-filing-date) ·
[Massive news](https://massive.com/docs/rest/stocks/news) ·
[Massive Benzinga](https://massive.com/partners/benzinga) ·
[Finnhub pricing](https://finnhub.io/pricing) ·
[Finnhub terms](https://finnhub.io/terms-of-service) ·
[FMP pricing](https://site.financialmodelingprep.com/pricing-plans) ·
[Tiingo news](https://www.tiingo.com/products/news-api) ·
[NewsAPI pricing](https://newsapi.org/pricing) ·
[PR Newswire terms](https://www.prnewswire.com/terms-of-use/) ·
[API Ninjas transcripts](https://api-ninjas.com/api/earningscalltranscript) ·
[API Ninjas pricing](https://api-ninjas.com/pricing) ·
[API Ninjas terms](https://api-ninjas.com/tos) ·
[Seeking Alpha terms](https://about.seekingalpha.com/terms) ·
[Reddit Data API wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki) ·
[Reddit builder policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) ·
[X pricing](https://docs.x.com/x-api/getting-started/pricing) ·
[X developer agreement](https://docs.x.com/developer-terms/agreement) ·
[FinBERT](https://huggingface.co/ProsusAI/finbert) ·
[Loughran–McDonald](https://sraf.nd.edu/loughranmcdonald-master-dictionary/) ·
[LLM headline sentiment](https://arxiv.org/abs/2304.07619) ·
[Glasserman & Lin](https://arxiv.org/abs/2309.17322)

---

## 3. Fear, macro and short interest

| Source | Raw data | Price | Show it to others | Send it to an AI model |
|---|---|---|---|---|
| **OFR Financial Stress Index** | [fsi.csv](https://www.financialresearch.gov/financial-stress-index/data/fsi.csv): OFR FSI plus Credit, Equity valuation, Safe assets, Funding, Volatility, and 3 regions; from 2000-01-03; 2-business-day lag | $0 | **Yes.** No copyright in work by federal employees ([legal notices](https://www.financialresearch.gov/legal-notices/)); credit requested | Not addressed (public domain) |
| **CFTC COT / TFF** | [TFF futures-only API](https://publicreporting.cftc.gov/resource/gpe5-46if.json), incl. VIX futures `1170E1` and E-mini S&P 500 `13874A`; Fridays 3:30 p.m. ET with Tuesday's data | $0 | **Yes.** Public domain ([web policy](https://www.cftc.gov/WebPolicy/index.htm)); acknowledgement requested | Not addressed |
| **Treasury yields** | Already ingested | $0 | **Yes.** 17 U.S.C. §105 | Not addressed |
| **Fed Board (H.4.1)** | Already ingested | $0 | **Yes.** Public domain unless marked ([disclaimer](https://www.federalreserve.gov/disclaimer.htm)) | Not addressed |
| NY Fed (RRP) | Already ingested | $0 | Yes, with a credit line ([terms](https://www.newyorkfed.org/privacy/termsofuse)) | Not addressed |
| **FINRA API** (short interest, Reg SHO daily short volume) | FINRA Query API | Public credential $0 | Non-commercial redistribution, on four conditions: name FINRA as source, charge nothing for it, no onward redistribution, end-user terms ([equity terms](https://developer.finra.org/specific-terms-equity-data)) | Not addressed. API ToS §3.2 counts "service providers acting on behalf of Developer" as authorized users, which plausibly covers an LLM provider; **confirm with FINRA** ([API ToS](https://developer.finra.org/finra-api-terms-service)) |
| FINRA website files (what `finra.rs` reads for daily short volume) | `cdn.finra.org/equity/regsho/daily/…` | $0 | **No.** Personal or professional use only | **No.** Restriction (m) bars use with any AI program ([terms](https://www.finra.org/terms-of-use)) |
| Cboe VIX, VIX term structure, put/call | Free CSVs (put/call history ends 2019-10-04) | $0 to download | **No.** One personal copy; anything else needs written consent ([terms](https://www.cboe.com/terms)) | **No.** [Advisory C2026013000](https://cdn.cboe.com/resources/market_data/2026/Guidance-Regarding-Use-of-Cboe-Data-in-AI-Solutions.pdf): AI use must be in a Data Order Form accepted by Cboe |
| CNN Fear & Greed | No feed | — | **No** (§3) | **No** |
| FRED | API | $0 | Personal, non-commercial. **Item (p): no storing or caching** without written consent ([API terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html)) | Training barred; prompt use not addressed |
| ICE BofA HY OAS (via FRED) | `BAMLH0A0HYM2` | — | **No**, pre-approval required | **No** |
| AAII sentiment | Members only for history | $199 / year | **No** (ToS §6) | **No** |
| NAAIM exposure | Paid since 2026-08-01 | $600–1,500 / year | Paid tiers with attribution | Not addressed |
| NYSE/Nasdaq breadth | **No free licensed source found** | — | — | — |

**Getting the FINRA credential** ([docs](https://developer.finra.org/docs)): create an Individual API
User in the API Console, provision a **Public** credential, set a client secret, then authenticate
with OAuth 2.0 client credentials (token about 30 minutes). Limits: 1,200 sync requests a minute per
IP. FINRA says Individual accounts are not intended for commercial use "at this time".

**What Convexa does today, and why it changes.** `finra.rs` is off (`finra.rs:17`), but when on it
reads the two datasets two ways:
- **Daily short volume** comes from the website files (`finra.rs:37`), which ban AI use.
- **Short interest** comes from `api.finra.org` without a credential (`finra.rs:28`). The API ToS
  (updated 2026-03-19, re-read live 2026-10-18) §3.4 requires access through FINRA credentials.

Both move to the credentialed API.

### Stress gauge

The **Convexa Stress Gauge** replaces CNN's Fear & Greed with public-domain inputs: display is allowed, and none of them addresses AI use.

| # | Component | Raw input | Stands in for CNN's | Higher raw value means | Cadence |
|---|---|---|---|---|---|
| 1 | Volatility | OFR FSI `Volatility` | VIX vs 50-day MA | Fear | Daily (T-2) |
| 2 | Credit | OFR FSI `Credit` | Junk-bond demand | Fear | Daily (T-2) |
| 3 | Safe haven | OFR FSI `Safe assets` | Safe-haven demand | Fear | Daily (T-2) |
| 4 | Equity stress | OFR FSI `Equity valuation` | Momentum (imperfect: valuation stress, not trend) | Fear | Daily (T-2) |
| 5 | Funding | OFR FSI `Funding` | — | Fear | Daily (T-2) |
| 6 | Vol positioning | CFTC TFF VIX futures: leveraged funds (long − short) ÷ OI | Put/call | Net long vol = fear | Weekly |
| 7 | Equity positioning | CFTC TFF E-mini S&P 500: asset managers (long − short) ÷ OI | Strength / breadth | Greed | Weekly |

- **Scaling.** Each input is a percentile over a trailing 3-year window (756 trading days, or 156
  weeks). Inputs are flipped so that 100 = greed. Percentiles are bounded, hold up in fat-tailed
  spikes, and explain themselves ("credit stress is higher than 91% of the last 3 years").
- **Weighting.** Equal weights; the mean of the components fresh that day. Nothing is published when
  fewer than 5 of 7 are fresh. A daily input is stale after 5 business days, a weekly one after 14
  days, which covers CFTC releases delayed by a holiday.
- **Bands** (Convexa's own, not CNN's): 0–25 Extreme Fear, 25–45 Fear, 45–55 Neutral, 55–75 Greed,
  75–100 Extreme Greed.
- **Tradeoffs:**
  - 5 of 7 inputs come from the OFR, which concentrates both method and outage risk.
  - The OFR subindices are blends of 33 variables (OFR working paper 17-04), not raw prints.
  - The gauge's as-of date is the OFR date, two business days back, so each component shows its own
    as-of date.
- **Later (FINRA credential):** market-wide short-volume share, 5-day average, credited "Source:
  FINRA".
- **Credit lines:** "Source: Office of Financial Research, OFR Financial Stress Index"; "Source: CFTC
  Commitments of Traders (TFF)".

CNN's own method, for reference ([FAQ](https://www.cnn.com/markets/fear-and-greed)): seven equally
weighted indicators on 0–100 — S&P 500 momentum, NYSE new highs vs lows, McClellan volume summation,
5-day put/call, VIX vs its 50-day MA, stocks vs Treasuries over 20 days, and junk-bond spreads.

---

## 4. Claude API: prices and the facts the design relies on

From Anthropic's model reference, as bundled with Claude Code on 2026-10-18.

| Model | Input / MTok | Output / MTok | Cache read / MTok | Notes |
|---|---|---|---|---|
| `claude-opus-5-5` | $4 | $20 | $0.20 | The default model. Effort is the only thinking control (default `medium`); forced `tool_choice` returns 400 |
| `claude-sonnet-5-5` | $2 | $10 | $0.20 | Cache writes $2.50 (5-min) or $4 (1-hour) |
| `claude-haiku-5-5` | $0.10 | $0.50 | — | $0.50 / $2.50 above 100K-token prompts |

**Prompt caching** ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)):

- Cache writes cost 1.25× input for 5 minutes or 2× for 1 hour.
- Up to 4 breakpoints; prefix order is tools → system → messages, and changing tools invalidates
  everything after.
- The 5-minute cache pays for itself from the second request.

**Other facts the design relies on:**

- The Batch API costs 50%.
- [Citations](https://platform.claude.com/docs/en/build-with-claude/citations) are guaranteed to point
  at the provided documents, but are **incompatible with structured outputs** (400).
- The MCP spec is [2026-07-28](https://modelcontextprotocol.io/specification/latest).

---

## 5. Compliance: why owner-only matters

Summarised from primary sources. The live analyst has one user, so none of this binds today; it
decides what would change if anyone else were let in.

- **Advisers Act §202(a)(11).**
  - It covers advice given *for compensation* by someone *in the business* of advising.
  - SEC Release IA-1092 (1987) reads compensation as any economic benefit
    ([PDF](https://www.sec.gov/files/rules/interp/1987/ia-1092.pdf)).
  - Convexa has no revenue and no other users.
- **The publisher's exclusion.**
  - *Lowe v. SEC*, 472 U.S. 181 (1985)
    ([text](https://law.resource.org/pub/us/case/reporter/US/472/472.US.181.83-1911.html)): impersonal,
    bona fide, regular publications are excluded. Advice "attuned to any specific portfolio or to any
    client's particular needs" is not.
  - *Lingley v. Seeking Alpha* (S.D.N.Y. 2024) held that alerts filtering general content did not
    defeat the exclusion. The court noted the plaintiffs had not alleged content created for one user
    and delivered only to them.
  - A per-request LLM answer is exactly that kind of content, so the exclusion is **untested** for
    an interactive analyst.
- **SEC guidance.**
  - [IM Guidance 2017-02](https://www.sec.gov/investment/im-guidance-2017-02.pdf) on robo-advisers:
    questionnaires on horizon and risk tolerance are what an adviser collects. That is almost the
    persona schema.
  - The 2023 predictive-analytics proposal was **withdrawn on 2025-06-12**.
  - [FY2026 exam priorities](https://www.sec.gov/files/2026-exam-priorities.pdf) review AI claims
    for accuracy.
  - AI-washing settlements: [Delphia and Global Predictions](https://www.sec.gov/news/press-release/2024-36).
- **If it were ever opened to others:**
  - fixed, published persona lenses, with no personal data collected;
  - descriptive answers on positions, and no sizing;
  - published methodology and the full record, losses included;
  - disclosure that AI is used;
  - every data licence re-checked.

---

## 6. Evaluation method

| Practice | Source |
|---|---|
| Start with 20–50 tasks; code graders first; one judge per dimension; calibrate judges against humans; pass^k for consistency | [Anthropic: develop tests](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests), [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) |
| Judge biases (position, verbosity, self-preference, weak maths) and their mitigations | [Zheng et al. 2023](https://arxiv.org/abs/2306.05685) |
| Numeric QA over filings is hard: GPT-4-Turbo with retrieval was wrong or refused on 81% of a FinanceBench sample | [FinanceBench](https://arxiv.org/abs/2311.11944), [FinQA](https://aclanthology.org/2021.emnlp-main.300), [TAT-QA](https://aclanthology.org/2021.acl-long.254) |
| Claim-level grounding | [FActScore](https://arxiv.org/abs/2305.14251), [ALCE](https://arxiv.org/abs/2305.14627) |
| Look-ahead and company-knowledge bias; entity masking | [Glasserman & Lin](https://arxiv.org/abs/2309.17322) |
| Survivorship bias from missing delisting returns | [Shumway 1997](https://ideas.repec.org/a/bla/jfinan/v52y1997i1p327-40.html) |
| Brier score | [Brier 1950](https://doi.org/10.1175/1520-0493(1950)078%3C0001:VOFEIT%3E2.0.CO;2) |
| Multiple-testing correction across personas | [Deflated Sharpe Ratio](https://papers.ssrn.com/abstract=2460551), [PBO](https://papers.ssrn.com/abstract=2326253) |
| Context budget, "context rot", tools vs one prompt | [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Lost in the middle](https://aclanthology.org/2024.tacl-1.9/) |
| Retrieval over long text | [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) |

---

## 7. Not verified

**Prices and terms not found:**

- Massive's real-time options Expansion price.
- The terms and price of an end-of-day stock-price source for scoring.
- Benzinga direct pricing.
- Reddit's Data API terms (blocked to the research tools).
- Quartr's AI clause.
- Business Wire's live terms (an archived 2026-04-17 copy was read).

**Legal points not settled:**

- No court has applied *Lowe* to an interactive LLM.
- The *Lingley* outcome after leave to amend is unknown.

**Read second-hand, or not opened:**
- The wording of SEC Release IA-1092 came from a secondary PLI summary; the SEC's scan is poor.
- The 8-K "four business days" rule came from a sec.gov search summary; the page wasn't opened.
- The ThetaData tier grid was read by a fetch tool, which inferred the column alignment.
- Cboe All Access API tiers 1 and 2 weren't found.
- FINRA API history depth wasn't checked.
- Massive's stocks plans weren't checked: neither their price nor whether the free tier serves daily
  aggregates. DESIGN.md's Phase 1 scorer and Phase 3 depend on both.

**Unknown everywhere:** no vendor's terms address *inference* use (sending data to a model as
context) explicitly. Every "not addressed" above is a question to put to that vendor in writing
(DESIGN.md §8).
