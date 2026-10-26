# Convexa AI Analyst — design and roadmap

_Proposal, 2026-10-18; revised the same day after an adversarial review (§9). Nothing here is built
yet. Items marked **[decide]** are the owner's call. Prices and licence terms were read on 2026-10-18;
every one is cited in [SOURCES.md](SOURCES.md)._

**Who it is for.** The live site's analyst is for the owner only. The staging demo shows the same
product on authored, mocked data. That choice decides most of the licensing and all of the
compliance below.

---

## 0. The short version

- **What it is.** An analyst that answers a fixed set of market questions from a **context package**
  Convexa assembles itself:
  - Every fact in the package carries its source, its as-of time and a state word.
  - Every answer to a scored question ends in a **simulated call**: a probability for a fixed event
    over a fixed horizon, so the market can score it later. Abstentions are logged, not dropped.
  - **Personas** are explicit configs that change emphasis and framing, never the facts.
- **Phase 1** is one question, end to end: *"What changed for X, and does it matter?"*
  - **The model's package** uses only SEC data Convexa already serves live, at no cost.
  - **It ships with** a golden-question eval, a citation check, and a paper record of forward calls.
  - **The one addition** is a free price key that only the local scorer uses, to resolve calls at
    their horizon. Production never sees it (§5.3).
  - No new source enters the package until the eval passes.
- **Cost at owner volume.**
  - **Model:** about **$50–105 a month** on Claude Opus 5.5 at 10–20 answers a trading day, or
    about $27–55 on Sonnet 5.5 (§6).
  - **Phase 1 data:** $0, provided the free price key checks out.
  - **The full desk later:** dealer structure and options flow add Massive's individual options and
    stocks plans (§6).
- **What the research changed:**
  1. **Licences rule out much of "everything".**
     - Cboe's VIX and put/call ratios, CNN's Fear & Greed, ICE's credit spreads and Reddit can't be
       sent to an AI without a licence.
     - X bars training; whether it allows inference is unclear.
     - So the fear gauge is built from public-domain inputs instead (the OFR Financial Stress Index
       and CFTC positioning, §2).
  2. **Personal-use plans are fine only behind an owner gate.**
     - Massive, Unusual Whales, Finnhub and the news APIs all restrict showing their data, or anything
       derived from it, to other people.
     - `convexa.pages.dev` is public, and the API has no owner role today, so Phase 0 adds one.
  3. **The existing AI read is a good base with gaps** (§3, §4):
     - the model sees only the persona's *name*;
     - nothing is stored or scored;
     - research notes and public data never reach the prompt;
     - there is no tool calling.
- **What the review changed** (§9): the cutoff and replay rules, the honest scoring timeline (years,
  not months), the cost figures, and a judge from another provider.

---

## 1. Decisions first: the questions

Each row is a question the owner actually asks, the decision it feeds, and the minimum evidence an
expert would want before answering. Horizon sets the paper-record window where the answer ends in a
call.

| # | Question | Decision it informs | Minimum evidence | Horizon |
|---|---|---|---|---|
| Q1 | What changed for X since I last looked, and does it matter? | Keep, add to or exit a thesis | New filings and 8-K items; Form 4 insider trades (open-market buys vs sales, clusters); 13F changes among the 12 managers Convexa reads; reported-figure changes (XBRL); the research note's kill criteria. Price move since: from Phase 3 (no price feed in the Phase 1 package) | 20 trading days |
| Q2 | What is dealer positioning saying for X? | Where moves stall or accelerate | Net GEX by strike, walls, gamma flip, distance from spot, vol regime, term structure, freshness | 1–5 days |
| Q3 | What's my pre-market plan for X? | Levels and triggers for the session | Q2, plus the overnight move, scheduled catalysts (earnings, macro), expected move from the ATM straddle | 1 day |
| Q4 | Hold X through earnings? | Keep, trim or hedge before the print | Earnings date; implied move vs the stock's past post-earnings moves; IV rank and past IV crush; the simulated position's exposure | Event |
| Q5 | Is fear elevated? What's the market regime? | Risk on or off; hedge or not | Stress composite and its components (§2), the Treasury curve and its change, Fed liquidity (H.4.1, RRP) | 5–20 days |
| Q6 | What's the macro risk this week? | Size down around events | Release calendar (FOMC, CPI, payrolls, GDP, refunding); rate-path context. Consensus forecasts are licensed data, an open gap | Week |
| Q7 | Is there unusual options activity in X, and does it matter? | Follow, fade or ignore | OPRA prints with condition codes; volume vs prior-day open interest; sweeps and blocks; aggressor side vs NBBO; premium; dealer context (Q2) | 1–10 days |
| Q8 | Are insiders or institutions buying X? | Conviction check | Form 4 open-market purchases and clusters, 13F changes, buybacks (8-K/10-Q) | 20–60 days |
| Q9 | Is X cheap or expensive? | Valuation entry or exit | XBRL fundamentals (revenue, margins, FCF), the note's DCF scenarios, peers, price | 60+ days |
| Q10 | What's the best way to express a view on X with options (simulated)? | Structure choice | IV rank, skew, term structure, expected move, liquidity (OI, spread), candidate contracts, max loss | Per structure |
| Q11 | What's the risk on my simulated book? | Concentration and event exposure | Positions, greeks, concentration, earnings and FOMC dates, max loss | — (descriptive) |
| Q12 | What do the news and filings say about X? | Read the narrative | 8-K text and press-release exhibits; transcripts; sentiment scored by a fixed rubric | 5–20 days |
| Q13 | Is there short-squeeze potential in X? | Avoid or ride | FINRA short interest, daily short volume, days to cover, float. Borrow fees are licensed data, an open gap | 5–20 days |
| Q14 | Was my last call right, and why? | Learn | The paper record: the call, the outcome at horizon, what changed | — |

**Q1 coverage caveats:**
- **TSM** is a foreign private issuer. It files 6-K and 20-F, with no Form 4s and no US-GAAP
  quarters, so its Q1 reads only those filings.
- **CBRS and SPCX** listed in 2026, so their history is short.

---

## 2. Raw sources

**How to read the table:**
- **Display** means display on the live site. That is the owner alone, behind the owner gate, except
  where a source is public domain or reuse-permitted.
- **AI** means sending the data to the model as context.
- **"Not addressed"** means the terms are silent. That is not permission; §8 lists the letters to
  write.

| Evidence | Rawest primary source | Convexa today | Cost / month | Display | AI | Questions |
|---|---|---|---|---|---|---|
| Filings, 8-K items and exhibits, Form 4, 13F, XBRL | SEC EDGAR | **Live** (`services/public_data/edgar.rs`, `insider_trades.rs`, `edgar_13f.rs`, `xbrl_frames.rs`) | $0 | Reuse permitted: sec.gov content may be copied and redistributed, credit requested. Filings and exhibits are company works, not "public domain" | Not addressed; reuse permitted | Q1 Q8 Q9 Q12 |
| Treasury yields, Fed H.4.1 | Treasury, Federal Reserve Board | **Live** (`treasury.rs`, `liquidity.rs`) | $0 | Public domain | Not addressed | Q5 Q6 |
| Reverse repo | NY Fed | **Live** (`liquidity.rs`) | $0 | Licensed with a credit line | Not addressed | Q5 |
| Futures positioning (TFF) | CFTC | **Live** for the 10-year note, E-mini S&P 500 and E-mini Nasdaq-100 (`cftc.rs:15-19`). VIX futures `1170E1` (Stress Gauge input 6) are not ingested | $0 | Public domain | Not addressed | Q5 |
| Release calendars | Fed, BLS, BEA, Treasury | **Live** (`calendar.rs`) | $0 | Public domain | Not addressed | Q6 |
| Financial stress (credit, volatility, funding, safe assets, equity) | OFR Financial Stress Index | No | $0 | Public domain | Not addressed | Q5 |
| Options chains, OI, greeks → dealer structure | OPRA via Massive | Integrated, **paused** (`infrastructure/massive/`) | Options $79 (15-min) / $199 (real-time), individual; **plus a stocks plan**, because the bundle also reads stock snapshots, aggregates and trades (`infrastructure/massive/rest.rs:334,433,496,565`). Stocks price not checked | Owner only. Massive bars showing data or "Derived Works" to third parties on individual plans | Not addressed → ask | Q2 Q3 Q4 Q10 |
| Option trades with condition codes → flow, sweeps, blocks, unusual activity | OPRA trades via Massive (the `conditions` field) | Not ingested | Trades on Developer and up; **aggressor side needs quotes, Advanced only** | Owner only | Not addressed → ask | Q7 |
| Pre-computed flow | Unusual Whales API | No | $150 Basic | Personal only | Bars sharing with any third party → likely no | Q7 (not recommended) |
| Off-exchange equity blocks | Massive stock trades | Built (`darkpool.rs`, `OffExchangeBlocks`) | Massive stocks plan; price not checked | Owner only | Not addressed | Q7 |
| VIX, VIX term structure, put/call | Cboe | No | Free download | **No** without a licence | **No** (Cboe 2026 AI guidance) | Excluded; Q5 uses OFR + CFTC instead |
| Fear & Greed | CNN | No | — | **No** | **No** | Excluded |
| Credit spreads (ICE BofA via FRED) | ICE | No | — | **No** (pre-approval) | **No** | Excluded; OFR's credit subindex instead |
| Anything on FRED | St. Louis Fed | No | $0 | Personal use, no caching or storage without consent | Training barred; prompt use not addressed | Avoid; use the original agencies |
| Market breadth (A/D, highs/lows) | NYSE/Nasdaq | No | No free licensed source found | — | — | Gap |
| Short interest, daily short volume | FINRA API | Built, **off** (`finra.rs:17`) | $0 (Public credential) | Non-commercial display with attribution | Not addressed → ask | Q13 |
| Press releases | 8-K Exhibit 99.1 on EDGAR | Filings live; text not fetched | $0 | Reuse permitted (company works) | Not addressed | Q12 |
| News headlines and articles | Massive news (+ Benzinga add-on $99), Finnhub (free, personal) | No | $0–99 | Personal / owner only | Not addressed → ask | Q12 |
| Earnings-call transcripts | API Ninjas | No | $149 Business (display and caching allowed) | Allowed | Only bars building a competing service → confirm | Q4 Q12 |
| Social sentiment | Reddit, X | No | Approval / per-read fees | Restricted | Training barred; inference unclear | Excluded |
| End-of-day prices (to score the record) | **[decide]** Recommended: a free Massive Basic key, used only by the local scorer CLI. **Unverified:** that the free tier still serves daily stock aggregates, and its terms | Integration exists (`join-outcomes`, `main.rs:912-931`, reads Massive daily bars); production has no key | $0 if verified | Never displayed by production | The model never sees it in Phase 1 | Scoring Q1–Q14 |
| Research notes | Convexa's own `research/` | **Built**, front-end only (`virtual:convexa-research`) | $0 | Own content | Own content | Q1 Q9 |

**Notes on the FINRA row:**
- The two FINRA datasets are read differently today, and both are out of terms for this use:
  - **Daily short volume** reads FINRA's website files (`finra.rs:37`), whose terms ban AI use.
  - **Short interest** calls `api.finra.org` without a credential (`finra.rs:28`), but the API terms
    require access through FINRA credentials.
- Both move to the credentialed API in Phase 2.

**Derived indicators are built, not bought.** The **Convexa Stress Gauge** replaces a fear index:

- **Inputs:** the OFR FSI's five subindices (volatility, credit, safe assets, equity valuation,
  funding) plus two CFTC weekly series: leveraged funds' net VIX-futures position and asset managers'
  net E-mini position, each as a share of open interest.
- **Scaling:** each input becomes a percentile over a trailing 3-year window. Inputs are flipped so
  100 means greed, equal-weighted, and only published when 5 of the 7 are fresh.
- **What the model sees:** the component table (raw value, as-of date, percentile, source credit),
  never only the score.
- **Licensing:** every input is public domain. AI use is not addressed by any of them.

The OFR file lags by two business days, so the gauge is slower than CNN's: that is the price of
public-domain inputs. Details in [SOURCES.md](SOURCES.md#stress-gauge).

---

## 3. The context package

**The model never assembles its own facts.** A deterministic builder in `api-rust` produces the
package. The model reads it and calls tools for depth. Numbers come from tools or the quant engine,
never from the model's arithmetic.

```ts
// The site's closed vocabulary (apps/dashboard/src/app/shared/dataState/vocabulary.ts), the words a fact can carry.
type StateWord = 'updated' | 'delayed' | 'computed' | 'lastGood' | 'sourceDown' | 'notSetUp' | 'off' | 'paused' | 'notLive' | 'sample';

type Fact = {
  id: string;              // stable: `${source}:${series}:${key}:${as_of}`
  label: string;           // what it is, e.g. "Open-market purchases, last 30 days"
  value: number | string | boolean;
  unit?: 'USD' | '%' | 'shares' | 'contracts' | 'bp' | 'ratio' | 'days';
  as_of: string;           // the data's own time: EDGAR acceptance time, release time, note commit time
  checked_at: string;      // when Convexa read it; excluded from package_id
  state: StateWord;        // 'computed' for derived values
  source: { id: string; url?: string; licence: 'public_domain' | 'reuse_permitted' | 'credit_required' | 'owner_only' };
  derived_from?: string[]; // fact ids for computed values
};

type ContextPackage = {
  schema_version: 1;
  package_id: string;      // sha256 of the canonical JSON minus checked_at: same inputs and cutoff, same id
  question: 'Q1' | 'Q2' | /* … */ 'Q14';
  ticker?: string;
  since: string;           // "since I last looked" (below)
  cutoff: string;          // no fact, and no tool result, with as_of after this time
  persona: PersonaConfig;
  sections: Record<string, { facts: Fact[]; tokens: number; truncated?: boolean }>;
  omitted: { section: string; reason: 'not_licensed' | 'stale' | 'off' | 'budget' }[];
  budget: { max_tokens: number; used: number };
};
```

### Point in time: one rule

**Rule:** every fact's `as_of` is at or before the cutoff. Each source applies it like this:

| Source | `as_of` is… | Today's code, and what changes |
|---|---|---|
| Every EDGAR filing, incl. 8-K, 13F and amendments | The **acceptance timestamp**. The latest version accepted by the cutoff is used | The code reads only `filingDate` (`edgar.rs:97-99`, `edgar_13f.rs:156`). **Add `acceptanceDateTime` parsing** |
| Form 4 trades | The Form 4's acceptance time, not the trade date, so a trade disclosed after the cutoff never counts | Trades are placed by trade date (`insider_trades.rs`) |
| XBRL facts | The acceptance time of the filing they came from. `filed` is a date only, so join on `accn` | The frames API returns the latest value and **is not point-in-time**. Q9 peers read company facts filtered by cutoff instead |
| Research notes | The note **as of the last git commit before the cutoff**, with the commit time as its `as_of` | Notes exist only from 2026-10-13 and were edited 10-15 and 10-16 |
| Prices (Phase 3+) | The last close strictly before the cutoff. Corporate actions are applied in the scorer | — |

**Lookback windows count back from the cutoff, not from today.** Today `WINDOW_DAYS = 90`
(`edgar.rs:22`) and `HISTORY_DAYS = 365` (`insider_trades.rs:23`) count back from now.

**Tools obey the same cutoff.**
- The server binds every tool call to the package's cutoff; the model never passes one.
- Every tool result is stored with the answer as canonical JSON plus a hash.
- **A replay** re-runs the model on the stored package and serves the stored tool results. It never
  touches today's data.

**What's stored.** Every package and every answer is kept in Postgres:
- **`context_packages`:** the canonical JSON and its `package_id`.
- **`analyst_answers`:**
  - the package id;
  - the model id, prompt version, persona version and effort;
  - token usage and cost;
  - the tool calls and their stored results;
  - the citation-check result;
  - the call, or the logged abstention.

**What Convexa keeps today:**
- **Chain snapshots:** 14 days or 48 per symbol, whichever comes first (`config.rs:480-482`), and
  nothing while the feed is paused. There is also a session archive and day tape for SPY/QQQ/IWM.
  Phase 3 builds on these.
- **The AI read is returned, never stored.** `generate_recommendation` (`services/recommendation.rs:640`)
  writes no store.
- **Its fingerprint** is too coarse to identify a snapshot (`libs/quant-engine/src/signals.rs:550-571`).

**"Since I last looked."**
- Stored per owner and ticker, and set when an answer is opened.
- It defaults to the previous answer's cutoff for that ticker, or 90 days back from the cutoff.

**Token budget and caching.**
- **Budgets:** each question type gets a core budget; Phase 1's is about 8k tokens. Anything beyond the
  core comes through tools, so a long filing never crowds out the facts that matter.
- **Order:** the tool definitions, the system prompt and the persona block form a static prefix with
  an explicit cache breakpoint. Automatic caching covers the growing tail of the tool loop.
- **The tool set is identical for every persona,** because tools render first in the cache order and
  a per-persona tool set would split the cache.
- **At owner volume most answers start cold:** gaps between answers exceed the 5-minute TTL, so the
  costs in §6 assume a cache write on every answer.

**Limits per answer:**
- at most 4 tool rounds;
- `max_tokens` on each request;
- a cost cap that ends the loop (proposed $0.75);
- streaming, replacing today's 60-second timeout (`llm.rs:241-245`), which is too short for four
  thinking rounds;
- a latency target of 90 seconds.

**Tools before MCP.** The analyst calls plain Messages-API tools defined in `api-rust`. Rust has no
official SDK, so it uses raw HTTP, as `services/llm.rs` already does. The Phase 1 tools (the cutoff
is implicit in all of them):

| Tool | Returns | Question |
|---|---|---|
| `get_filings(ticker, since, forms)` | Filing facts with acceptance times | Q1 |
| `get_filing_text(accession, items)` | 8-K item or exhibit excerpts with character offsets, for citations | Q1 Q12 |
| `get_insider_trades(ticker, since)` | Form 4 transactions with codes and clusters, by acceptance time | Q1 Q8 |
| `get_holders(ticker, quarters)` | 13F changes among the 12 managers read (`edgar_13f.rs:37`) | Q1 Q8 |
| `get_fundamentals(ticker, concepts, periods)` | XBRL facts with acceptance times | Q1 Q9 |
| `get_note(ticker)` | The research note at its last commit before the cutoff: stance, kill criteria, forecasts. Today notes exist only in the front-end build, so this needs an API read | Q1 Q9 |
| `get_paper_record(ticker?, persona?)` | Past calls resolved before the cutoff | Q14 |

Later phases add `get_stress_gauge`, `get_calendar`, `get_structure`, `get_flow` and `get_news`.

Because the live tool is owner-only, an **MCP server** over the same tools is worth adding later
(Phase 6). It would let the owner use Convexa's context from Claude's own apps. Inside the API it
would add a protocol for nothing.

---

## 4. Personas

The analyst has one user, so personas can describe the owner's own modes of thinking. If the analyst
were ever opened to others, they would have to become fixed, published lenses (§6).

The config **extends today's `PersonaDefinition`** (`libs/api/src/lib/convexa.ts:1495-1509`). That
type has `objective` (income, directional swing, hedging), `risk`, `reassessment_lean`,
`emphasis_note`, `dte_pref` and a numeric `version`. The new fields are added to it:

```ts
type PersonaConfig = PersonaDefinition & {
  horizon: 'intraday' | 'swing_2_10d' | 'position_1_6m' | 'long_term_1y_plus';
  style: 'momentum' | 'mean_reversion' | 'value' | 'event_driven' | 'volatility';
  instruments: ('shares' | 'long_options' | 'debit_spreads' | 'credit_spreads' | 'covered')[];
  limits: { max_loss_per_idea_pct: number; max_open_ideas: number; avoid_events: ('earnings' | 'fomc')[] };
  evidence_weights: Partial<Record<string, number>>; // section priority inside the token budget
  output: { length: 'brief' | 'full' };
};
```

**Migration.** Each built-in gets the new fields in Phase 0. Until the owner sets them, a custom
persona's fields are derived from its `objective`, `risk` and `dte_pref`.

| A persona changes… | How |
|---|---|
| Retrieval | `horizon`, `style` and `evidence_weights` decide which sections fill the token budget first and the lookback windows. `instruments` filters candidate structures. |
| The prompt | A persona block in the cached system prompt, one per persona version: what to prioritise, which tools to reach for first, how to frame risk, when to say "no trade". |
| **Never** | The tool set, the facts, the cutoff, the citation rule, the simulated-only rule, or the fact that every answer ends in a call or a logged abstention. |

**Today's gap, fixed in Phase 0:**
- **What reaches the model:** only the persona's *name* (`services/llm.rs:193`). A custom persona's
  UUID falls back to "Default (no persona)" (`services/recommendation.rs:302-319`).
- **What doesn't:** framing, risk calibration, emphasis and DTE preference.
- **What exists but is unused:** a persona-framed template, computed (`usePersona.ts:39`) and never
  rendered (`features/personas/template.ts:200-250`).
- **Where personas live:** only in the browser (`features/personas/store.ts`), so the server has none
  to send.

---

## 5. Proof it's right, without trusting the model or us

**What is truly independent of the model and the authors:** the deterministic citation check (§5.2)
and the forward record scored by the market (§5.3). The golden set is the owner's own judgment. It
is frozen and hashed before the first run, so the system can't be tuned to it after the fact.

### 5.1 A golden-question eval

**Items.** Phase 1 starts with **40 Q1 items** at frozen historical cutoffs between 2026-07-01 and
2026-10-12, across the 14 noted tickers. TSM's items read only its 6-K and 20-F filings. Each item has:
- a stored package id;
- the facts the answer **must** mention;
- the claims it must **not** make.

**What the items can and can't test.**
- **No research notes before 2026-10-13.** Those items run without a note, and say so.
- **Never accuracy.** Historical items test grounding, completeness, compliance and persona
  adherence. A hindsight label for "does it matter?" would be biased, and the model may already know
  those outcomes. "Right call" is judged only on forward calls (§5.3).

**Split.** 25 items are for tuning and 15 are held out. The exit bar is measured on the held-out 15
only, so a prompt tuned on the eval can't pass it by memorising.

| Dimension | Graded by |
|---|---|
| Grounded: every number traces to the fact it cites | Code (5.2) |
| Complete: the must-mention facts are present | Code first, then a judge |
| Compliant: simulated only, no real-order language, a call or logged abstention present | Code (patterns), then a judge |
| Persona adherence | A judge with a rubric |

**Judges:**
- **From another provider family.** A Claude judge would share the analyst's biases. `llm.rs:12-20`
  already supports OpenAI, xAI and Gemini; which one is **[decide]**.
- **One judge per dimension,** pointwise, against a reference answer and a written rubric.
- **Calibrated against at least 50 owner-graded answers,** with the agreement rate and its interval
  reported. 20 is too few: 16 of 20 agreeing has a 95% interval of about 58–92%.
- **Never allowed to check arithmetic.**

**Consistency** is measured as pass^3 on 10 items: all three runs must pass grounding and compliance.

**Phase 1 exit bar**, on the held-out items:
- 100% citation-check pass;
- ≥90% must-mention coverage;
- ≥85% on the judged dimensions, with ≥80% judge–human agreement on ≥50 items;
- 0 compliance failures;
- pass^3 on all 10 consistency items;
- every answer carries a well-formed call or a logged abstention;
- the owner signs off on 10 answers read in full.

### 5.2 A citation check

This is deterministic, in the spirit of `tools/research-notes/check-filings.mjs`. Today that checks
35 figures across 11 tickers, with none unexplained.

1. Every number and date in the answer must cite a fact (`[fact:id]`) or a stored tool result.
2. Each one must **equal that cited fact's value** after normalising units, sign and rounding. A
   matching number elsewhere in the package does not count, because a long filing excerpt holds many
   numbers.
3. Uncited numbers fail, except a documented allowlist: form names, item numbers, the horizon, and
   dates that are fact metadata.
4. A failing answer is shown as failed, not shown as an answer.

Anthropic's Citations feature returns valid pointers, but a valid pointer is not a correct number, so
the checker stays.

### 5.3 A point-in-time paper record

**Every Q1 answer emits a call**, so the analyst can't pick only the easy moments to forecast. A
declined call is a logged abstention, and the abstention rate is reported.

| Part of the call | Q1 definition |
|---|---|
| Event | X's split-adjusted price return beats SPY's by more than 2 points over 20 trading days |
| Start | The last close strictly before the cutoff |
| End | The close 20 trading days later. Both closes are read in one fetch at resolution, so split adjustments apply to both |
| Probability | 0–1 |
| Stored with it | The package id, persona, model and prompt version |

**The scorer** is a local CLI, extending `api-rust join-outcomes` (`main.rs:912-931`). It resolves
calls at their horizon using the free price key (§2), and production never holds the key. It
computes:

| Measure | What it is |
|---|---|
| **Brier score** | mean (p − outcome)²; 0 is perfect |
| **Brier skill** | against the base rate, the event's historical frequency for that ticker |
| **Baselines**, all scored on the same calls | the base rate; always 0.5; and **one deterministic rule on the same package** (an open-market insider cluster buy means 0.6, otherwise the base rate), so any skill can be credited to the LLM rather than to the data |
| **Reliability diagram** | once there are at least 200 resolved calls |

**Only forward calls count:** calls made after launch, and after the model's training cutoff.

**Expect a verdict in years, not months.**
- **Independent calls are scarce.** A call counts as independent only once per ticker per 20-day
  window. That is at most about 14 × 252 / 20 ≈ 176 a year.
- **The names move together.** Ten of the 14 are AI, semiconductor or cloud names, so the effective
  count is lower still.
- **Detecting an edge takes hundreds of calls.**
  - Beating the base rate's 50% hit rate with 55%, at 80% power, needs about 780 calls.
  - A ±5-point interval on a hit rate needs about 384.
- **The test is pre-registered now:** a paired comparison of the analyst's Brier score against each
  baseline, on the same calls. Comparisons between personas are corrected for multiple testing
  (Deflated Sharpe or PBO, SOURCES §6).
- **Until then the record says "too few calls to judge",** the same honesty as the outcome ledger's
  20-per-cell floor (`features/trading/outcomes/types.ts:20`).

**What's reused:**
- the outcome ledger's Wilson intervals (`features/trading/outcomes/ledger.ts:104`);
- `tools/research-notes/scoring.mjs`. It is a front-end build module, so its Brier rules are ported
  to the Rust scorer with one shared test fixture.

### 5.4 What else shows it's right

- **The market:** the record.
- **The sources:** the citation check.
- **A frozen, hashed eval** that every model, prompt or persona change must pass.
- **Cost and latency logs** per answer: if an answer costs more than it is worth, that is a result
  too.

---

## 6. The compliance line and the costs

**Compliance, owner-only.** With no other users there is no client relationship and no adviser
question. The disciplines kept anyway:

- **Simulated only.** No real orders; the broker connection stays read-only (existing invariant:
  `TradeEntryDialog` is sim-only).
- **AI answers say they are AI** and show their package's as-of time.
- **Everything is logged** (§3).
- **The staging demo stays impersonal and labelled Sample,** as it is today.

**If the live analyst were ever opened to others,** this reverses:
- personas become fixed, published lenses with no personal data;
- answers about positions stay descriptive;
- methodology and the full record are published;
- every licence is re-checked for commercial and public display (e.g. Massive Business at
  $1,999/mo).

The *Lowe* analysis is in SOURCES.md.

**Licence compliance: the owner gate (Phase 0).**
- **What it guards:** every route that serves owner-only data, and the analyst itself.
- **What it requires:** an **owner role**, which Phase 0 adds; the API has no roles today.
- **What exists now:** registration is closed by default (`config.rs:427-429`), but "signed in" is not
  "owner".

**What public pages show.** Production's public pages keep showing only public-domain or
reuse-permitted data with credit lines: SEC, Treasury, the Fed Board, the NY Fed and the CFTC. FINRA
is off. That is true today.

**Model cost.** Claude pricing per million tokens, from Anthropic's model reference as bundled with
Claude Code, read 2026-10-18:

| Model | Input | Output | Cached read | Cache write (5-min) |
|---|---|---|---|---|
| Opus 5.5 | $4 | $20 | $0.20 | $5 |
| Sonnet 5.5 | $2 | $10 | $0.20 | $2.50 |

**How a Phase 1 answer is built.** It is four requests: three tool rounds plus the final answer.
Each request re-sends everything before it:

| Request | Input | Output | Cache |
|---|---|---|---|
| 1 | 5.5k static prefix + 8k package | 1k | Written (cold) |
| 2 | Request 1, plus 1k + a 3k tool result | 1k | Read, and the new 4k written |
| 3 | Request 2, plus 1k + a 3k tool result | 1k | Read, and the new 4k written |
| 4 | Request 3, plus 1k + a 3k tool result | 2k | Read, and the new 4k written |

That totals 25.5k tokens written, 52.5k read and 5k output, thinking included.

| | Per answer (cold) | 10 / trading day | 20 / trading day | One full eval run |
|---|---|---|---|---|
| Opus 5.5 | ≈ $0.24 | ≈ $53 / mo | ≈ $106 / mo | ≈ $20 |
| Sonnet 5.5 | ≈ $0.12 | ≈ $27 / mo | ≈ $55 / mo | ≈ $13 |

**Caveats on these figures:**
- **Sonnet's output** is assumed equal to Opus's, but Sonnet 5.5 defaults to `high` effort, so it
  may think more.
- **What one eval run includes:**
  - 60 analyst runs: 40 items, plus 2 extra runs on each of the 10 consistency items;
  - 180 judge calls, priced at Sonnet-equivalent rates (≈ $6) until the judge provider is chosen.
- **The analyst loop can't use the Batch API.** Batch requests are single-shot, so a four-round loop
  would need four sequential batches. The judges can be batched.
- **These are estimates.** Phase 1 replaces them with logged usage.
- **[decide]** The default model is Opus 5.5; moving the analyst to Sonnet would roughly halve the
  cost.

**Data cost by phase:**

| Phase | Adds | Data cost / month |
|---|---|---|
| 1 | SEC (live); a free price key for the local scorer | $0, if the free tier verifies |
| 2 | OFR, CFTC (add VIX futures), Treasury, Fed, calendars; FINRA's credentialed API | $0 |
| 3 | Dealer structure (Massive options, owner-only) | Options $79 (15-min) or $199 (real-time), **plus a Massive stocks plan** (price not checked) |
| 4 | Options flow from OPRA prints | $0 more on Advanced; **+$120** if Phase 3 chose Developer, because aggressor side needs quotes |
| 5 | Transcripts (API Ninjas Business); news (Massive Benzinga add-on, optional) | $149 (+$99, which needs a Massive base plan) |

---

## 7. Roadmap

Every phase ships only when the eval for its questions passes. New sources come only after that.
**Each phase also adds authored sample packages and answers to the staging demo,** so the portfolio
shows the feature without live data.

| Phase | What ships | Exit gate |
|---|---|---|
| **0 · Groundwork** | An owner role and the owner gate. `context_packages` and `analyst_answers` tables. The persona config extension and migration (§4), sent in full to the server. A per-user AI cap instead of the global static counter (`recommendation.rs:40-53`). An API read of the research notes at a given commit. EDGAR acceptance-time parsing and cutoff-relative windows. The scorer's price key verified | Owner-only routes refuse other sessions (test). The builder, re-run on stored inputs and cutoff, reproduces the same `package_id` (test). A stored answer re-renders from its row |
| **1 · "What changed for X?"** | The Q1 package builder and the seven cutoff-bound tools (§3). Claude Opus 5.5 with tool use and the per-answer limits. The citation check. The golden set, frozen and hashed. Forward calls and the local scorer. A desk panel and an answers page | §5.1's bar on the held-out items; forward calls recorded on every answer |
| **2 · Regime and macro** | The Stress Gauge (OFR plus CFTC, with VIX futures `1170E1` added to `cftc.rs`). The calendar. The Treasury curve. Both FINRA datasets on the credentialed API, once the credential exists and AI use is confirmed | Q5, Q6 and Q13 added to the eval and passing |
| **3 · Dealer structure** | Massive options and stocks plans, owner-only. The existing `market_state` and signals feed the package. Chain snapshots give point-in-time. Prices enter the package (last close before the cutoff) | Q2, Q3 and Q10 passing; replay from snapshots works |
| **4 · Options flow** | Sweeps (ISO codes S/b/d across exchanges, with a documented grouping window). Blocks (floor and cross codes plus a documented premium threshold). Unusual activity (volume vs prior-day OI). Aggressor side vs NBBO. Cancels and late reports excluded; spread legs kept apart | Q7 passing; the thresholds published on the methodology page |
| **5 · News and transcripts** | 8-K text and exhibits. Transcripts, if AI use is confirmed. Rubric sentiment storing its rubric version and model. Q4's earnings comparison | Q4 and Q12 passing |
| **6 · MCP (optional)** | An MCP server over the same tools for the owner's Claude apps | — |

---

## 8. Open decisions and letters to write

1. **[decide] Approve Phase 0 and Phase 1.**
2. **[decide] The scorer's price source.** Recommended: a free Massive Basic key, used locally only.
   Verify its daily-aggregate access and terms first.
3. **[decide] Opus 5.5 or Sonnet 5.5** for the analyst (§6).
4. **[decide] The judge's provider** (OpenAI, xAI or Gemini), from outside the Claude family.
5. **Write to these vendors** and keep the answers in `docs/product/ai-analyst/licences/`:
   - **Massive:** may individual-plan data and derived values go to an LLM API for the subscriber's
     own answers?
   - **FINRA:** does the API Terms' "service providers acting on behalf of Developer" cover an LLM
     provider?
   - **API Ninjas:** AI use of transcripts.
   - **Unusual Whales:** only if it is still wanted.
6. **Move both FINRA datasets to the credentialed API.** Short volume reads the website files, whose
   terms ban AI use. Short interest calls the API without a credential.
7. **Open research:**
   - consensus estimates and earnings dates;
   - borrow fees;
   - a licensed market-breadth source;
   - the Massive stocks plan price.

---

## 9. Review log

**2026-10-18 — adversarial review of the first draft.** One reviewer checked every code claim against
the repo and every licence and price claim against the five research reports. It also re-read five
of the highest-stakes terms live: Massive's §5(c) and its Business §2.6/§6.1(j), FINRA's API terms,
OFR's legal notice, and SEC's reuse statement.

It found 28 issues: 2 critical, 14 major and 12 minor. All were accepted. The changes that matter:

| Finding | What changed |
|---|---|
| **Critical:** Phase 1 wasn't free. Q1 and the scorer need prices, and Convexa's only price path is Massive, whose key production no longer has (`main.rs:912`) | Price left Q1's Phase 1 evidence. The scorer gets a free key, used locally only, as the single, stated exception |
| **Critical:** tools took no cutoff, and replay re-called live tools | Tools are bound to the package cutoff on the server; tool results are stored and replayed |
| Point-in-time rules overstated what the code can do | §3's table names each source's `as_of` and the code to add |
| Cost assumed one pass; most answers start cold | Four-request model; Opus ≈ $0.24, Sonnet ≈ $0.12 per answer; judges counted; no Batch for the loop |
| "Significance in months" | Years; effective count; power; a pre-registered paired test; a deterministic baseline; every answer emits a call |
| Same-family judge; eval not independent of the authors | A judge from another provider; a frozen, hashed golden set; a held-out split; independence claimed only for the citation check and the record |
| Phase 0's byte-identical replay gate was impossible | Gate on a reproducible `package_id` and on re-rendering a stored answer |
| The citation check could match a number from anywhere | Each number must equal the value of the fact it cites |
| CFTC VIX futures, FINRA's keyless API, SEC "public domain", the missing owner role, the Massive stocks plan, quotes for aggressor side | Corrected in §2, §6 and §7 |

The research notes' late start (2026-10-13) and TSM's filing type now shape the golden set (§5.1).

_Sources and the full licence evidence: [SOURCES.md](SOURCES.md)._

---

## Amendments

Appended; the sections above stay as written. Where an amendment changes §3's types or rules, it
supersedes them from its date.

### 2026-10-25: Phase 0 slice 0a (spec 06)

Source: [spec 06](../specs/2026-10-21/06-analyst-phase0a-q1-package.md) and the owner's answers of
2026-10-25 ([README](../specs/2026-10-21/README.md), "Owner answers": every recommended answer).

1. **§8.1, Phase 0.** Slice 0a alone is approved (S6-Q1). It brings Phase 1's Q1 package builder
   forward, without the seven tools, the model or truncation, so Phase 0's exit gate "the builder,
   re-run on stored inputs and cutoff, reproduces the same `package_id`" has a builder to re-run.
   Slices 0b to 0f stay gated: the owner role and gate, the `context_packages` and
   `analyst_answers` tables, the persona config sent in full, the per-user AI cap, the notes read
   API at a commit, and the scorer's price key.
2. **What was built.** `api-rust package q1 <TICKER> --cutoff <RFC3339> [--save-inputs D | --inputs
   D] [--out F]` (`apps/api/src/services/analyst/`). A pure builder reads saved SEC responses by
   URL; a live run and a replay run the same function on the same bytes. No model call, route,
   table or UI.
3. **The timezone rule (§3, "Point in time").** EDGAR writes `acceptanceDateTime` with a `Z`, but
   the value is the true instant moved later by New York's UTC offset. The true instant is the UTC
   instant with the same digits as the value's New York wall time (`accepted_at` in
   `public_data/edgar.rs`): `2026-08-27T00:21:19Z` is 16:21:19 EDT on Aug 26.
   - **Evidence:** on the 1,000-row real NVDA index this reading puts 999 rows inside 06:00 to
     22:00 Eastern and 999 on or before their filing date. Reading the value as a true UTC instant
     leaves 326 rows outside; reading it as Eastern wall time leaves 954.
   - **Not yet confirmed against EDGAR's own headers.** Step 0's three header GETs
     (`0001045810-26-000073`, `0001045810-26-000019`, `0001197647-26-000011`) need the owner's
     `SEC_USER_AGENT`, which the build lane didn't have. If the headers disagree, they win.
   - **The standing check:** a live run aborts when more than 1% of the issuer's rows fall
     outside EDGAR's hours or after their filing date.
4. **`persona`** is `PersonaConfig | null`: `null` until slice 0c sends the persona in full
   (S6-Q3). Ids change once it is filled in, which is correct, because a persona changes retrieval.
5. **`omitted.reason`** gains `not_built`, for a section the server can't build yet (S6-Q2):
   `'not_licensed' | 'stale' | 'off' | 'budget' | 'not_built'`. The research note is
   `{ section: 'research_note', reason: 'not_built' }` until slice 0e. `off` stays "deliberately
   switched off".
6. **`coverage`** (S6-Q6). A section is `{ facts, coverage, tokens, truncated? }`. `coverage`
   records what the section couldn't read or place: a Form 4 that returned 404, a manager index
   or 13F table that couldn't be read, a company-facts point no filing in the index can place, a
   row without an acceptance time. A gap is part of the package, never only a log line, so it
   enters `package_id`.
7. **Three deviations from the point-in-time table (§3), accepted for 0a (S6-Q4):**
   - (a) 13F-HR/A and Form 4/A amendments aren't read, as on the site. Revisit only if a Phase 1
     eval item hits an amended 13F.
   - (b) The 13F change is in basis points of shares outstanding (`unit: 'bp'`), because the unit
     set has no "points".
   - (c) **Zero priors (README D3).** A manager whose prior-quarter 13F was read without the
     security gets a `13f.prior_absent` fact and no change fact: a zero prior may be a missed
     read, so it is not counted as buying. Totals sum only the facts emitted, so the package's
     total change can differ from the site's `total_change_pts`.
8. **Citation check (§5.2, point 3).** The allowlist gains the rule name `10b5-1`: it names a rule
   and carries no value. Fact labels hold digits only in dates, form names, item numbers and
   `10b5-1`. Counts are spelled out, and role ordinals are letters ("Director C").
9. **Live SEC requests (S6-Q5).** A build lane may make only step 0's three header GETs, with the
   production `SEC_USER_AGENT`, and commit their slices as fixtures. The owner makes the live run
   of about 80 requests; no lane runs the package CLI live.

### 2026-10-25: the direction of a wrong timezone rule (spec 06 review, adds to item 3)

Item 3's facts stand. This corrects an inference in spec 06 ("Every wrong reading lands later than
the third one. A wrong rule therefore never leaks the future"), which the doc comment on
`accepted_at` repeated until this review. The inference holds only when a later reading replaces a
correct `accepted_at`. **The chosen rule is the earliest of the three readings, so if the headers
show it is wrong, it leaks the future.** It would date every filing 4 to 10 hours before EDGAR
accepted it, and a package cut in that gap would hold a filing nobody could read yet.

- **What stands in the meantime:** only the live guard. If EDGAR wrote its index as Eastern wall
  time, the guard would reject NVDA (55 of 1,000 rows outside, above 1%). But it counts one issuer
  at a time, so an issuer whose filings cluster between 14:00 and 22:00 Eastern could pass it, and
  a replay never runs it.
- **The hand-built index fits the Eastern wall-time reading** (0 of 16 rows outside, against 1 of
  16 under the rule). Its times are illustrative, so this is a hint, not evidence.
- **Consequence:** step 0's three header GETs should come before the owner's live run (criterion
  14) and before any eval item is cut near an event. If the headers disagree with `accepted_at`,
  the rule changes, the fixture ids are re-baselined, and a further amendment records the outcome.

### 2026-10-25: §7 sequencing, the public fear–greed gauge before Phase 2 (spec 07)

Source: [spec 07](../specs/2026-10-21/07-stress-gauge.md), open question 4, answered yes by the
owner on 2026-10-25 ([README](../specs/2026-10-21/README.md), "Owner answers", S7-Q4). **The public
Stress section on Research → Markets and its inputs (the OFR Financial Stress Index reader and VIX
futures `1170E1` in `cftc.rs`) ship ahead of Phase 2, as the Treasury curve and the calendar did;
`get_stress_gauge` and the Q5 eval stay in Phase 2, and no model reads the gauge until that eval
passes.** §7's "New sources come only after that" still governs what a model may read.

### 2026-10-26: the owner gate shipped (slice 0b, the gate only)

Source: SEC-1 ([site audit 2026-10-25](../../quality/2026-10-25/SITE-AUDIT.md), commits `9d483d4d`
and `0fa92e31`) made the scan reads signed-in only. That still let any signed-in account read the
levels, and production may hold demo or QA accounts besides the owner's (from conformance
`--auth-signup` runs before the loopback guard). §6 "Licence compliance: the owner gate (Phase 0)"
says "signed in" is not "owner", so this builds the owner role and the gate. The rest of slice 0b
(`context_packages`, `analyst_answers`) stays gated, as amendment 2026-10-25 item 1 says.

1. **The role.** `OWNER_EMAILS` (`apps/api/src/config.rs`, `OwnerEmails`) is a comma-separated
   allowlist. Each entry is trimmed and compared case-insensitively with the signed-in user's
   stored email. Absent or empty means no owner, and every owner-only route refuses everyone: the
   gate fails closed. Only the count is logged, never an address. `serve` logs the count at boot
   and never refuses to start; the owner sets the variable on Railway.
2. **The gate.** `OwnerUser` (`apps/api/src/routes/auth.rs`) sits beside `AuthUser` and runs before
   the handler, the path and the query. Signed out or with a forged cookie, the caller gets the
   existing 403 `auth_required`. Signed in but not the owner, it gets 403 `owner_only` ("Only the
   site owner's account can see this data."). The owner gets the data.
   `POST /api/recommendation/{ticker}` parses its body first, so it calls `require_owner` inline.
3. **The routes it guards.** These are the 14 operations in `OWNER_ONLY_OPERATIONS`
   (`apps/api/src/routes/mod.rs`). Each can return dealer levels or other values computed from the
   licensed options feed:
   - `GET /api/scan`, `/api/scan/all` and `/api/scan/{symbol}/history`;
   - `GET /api/ticker/{ticker}` and `/api/ticker/{ticker}/progressive`;
   - `GET /api/market-data`, `/api/signals` and `/api/strike-profile`;
   - `GET /api/contract/{ticker}` and `/api/candidates/{ticker}`;
   - `GET /api/stream/{ticker}`;
   - `POST /api/recommendation/{ticker}`, `GET /api/recommendation/export/{ticker}` and
     `GET /api/recommendation/status/{ticker}`.

   The contract documents each as `session` plus `x-convexa-access: owner`, with a 403 that names
   both refusals. A test walks the OpenAPI document and fails if any operation declaring a level
   field is neither owner-only nor behind the operator token.
4. **What stays open, and why.**
   - The scan universe is ticker names, and the scan view is the caller's saved layout.
   - Prices and the price stream are stock quotes; they never touch the options chain.
   - Personas are static. Public data comes from public-domain sources with credit lines.
   - Health stays open.
   - The caller's own book, broker and auth surfaces keep their session gates, and the sim-trade
     gate is a yes or no.
   - The demo page is static HTML.
   - The operator-token research and metrics routes keep the operator token.
   - Stock quotes from Massive are licensed too (§0, point 2). They stay out because this gate
     covers options-derived data, and production has no Massive key today, so they serve nothing
     live. If a live key returns, they need the same decision.
5. **Sign-up is part of the gate.** An allowlisted address is only as strong as sign-up. With
   `AUTH_REGISTRATION_OPEN` on, anyone could register an owner address nobody holds yet. Production
   keeps sign-ups closed, and boot warns when both are set.
6. **Local constructs.** The capacity harness serves synthetic fixture data. It provisions its own
   owner on its in-memory store and sends that session, so it still measures the router with the
   gate in place. The session-day replay serves recorded licensed data and reads `OWNER_EMAILS`
   like `serve` does. If the variable is unset, its ticker stream refuses everyone.
7. **§7 Phase 0's exit gate** says "Owner-only routes refuse other sessions (test)". For the gate,
   `api_contract_runtime_auth_research.rs` meets it with two tests:
   - `owner_only_routes_answer_the_owner_alone` covers every route listed in item 3. Signed out
     and forged cookies get `auth_required`, a non-owner gets `owner_only`, and the owner gets 200
     with the levels.
   - `owner_only_routes_fail_closed_without_owner_emails` covers the unset case.

### 2026-10-26: the owner match uses the account store's key (owner-gate review, amends item 1)

Item 1 said each `OWNER_EMAILS` entry is "compared case-insensitively" with the stored email. The
shipped code did that with Unicode lowercasing (`to_lowercase`), but the account store keys
addresses with ASCII lowercasing (`email_lower` = trim, then `to_ascii_lowercase`, in
`services/auth/store.rs` and `db/pg_auth.rs`; unique in Postgres). The two disagree on some
characters. KELVIN SIGN (U+212A) lowercases to ASCII `k`, and a non-ASCII capital such as `É`
lowercases to `é`, yet the store treats both as new addresses that anyone can register. **So a
second account, with the owner's address spelled with a Kelvin sign for its `k`, passed the gate as
the owner** and read the levels (two reviewers reproduced it: 200 with the flip and walls on
`GET /api/scan`, `/api/scan/{symbol}/history` and `/api/ticker/{ticker}`). This was not the
unregistered-address case in item 5; it shadowed an owner who had already registered.

- **The fix:** the gate now uses the store's own key (`normalize_owner_email` in
  `apps/api/src/config.rs` is trim, then `to_ascii_lowercase`). An entry matches exactly the one
  account the store keys to it. Trim and ASCII case still do not matter; any other difference is a
  different account.
- **Exposure:** it needed open sign-ups (`AUTH_REGISTRATION_OPEN`, or the Google sign-up path, which
  needs the same flag) and an owner address with a `k` or a non-ASCII letter. Production keeps
  sign-ups closed, so production was not exposed. Local runs, and `--auth-signup` conformance runs,
  had sign-ups open.
- **Proof:** the `owner_emails` unit test in `config.rs` now requires the Kelvin-sign and
  non-ASCII-capital spellings to be refused. `owner_only_routes_answer_the_owner_alone` signs up a
  Kelvin-sign lookalike after the owner and requires 403 `owner_only` from it on every owner-only
  route. Both tests fail (exit 101) with the old `to_lowercase`.
- **Not done:** sign-up still accepts non-ASCII addresses. Refusing them at sign-up and at Google
  account creation would be defence in depth; it changes who can register, so it is left for an
  owner decision.
