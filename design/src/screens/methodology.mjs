// Methodology — the trust surface. Copy is the product's own (pages/methodology/copy.ts), laid out as a document.
import { footer, icon, nav, structureField } from '../lib.mjs';

export const METHOD_CSS = `
  .doc-grid { display: grid; grid-template-columns: 220px minmax(0, 760px); gap: 48px; align-items: start; }
  .toc { position: sticky; top: 76px; display: flex; flex-direction: column; gap: 2px; }
  .toc a { display: block; padding: 7px 12px; border-radius: 8px; font-size: 12.5px; color: var(--steel); text-decoration: none; }
  .toc a.on { color: var(--phosphor); background: var(--raised); font-weight: 600; }
  .doc h2 { font-size: clamp(20px, 1.8vw, 24px); margin: 36px 0 10px; letter-spacing: -0.015em; }
  .doc p { margin: 0 0 12px; font-size: 14.5px; line-height: 1.65; color: var(--phosphor); text-wrap: pretty; }
  .doc p.muted { color: var(--steel); }
  .tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .tbl th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--steel); padding: 8px 10px; border-bottom: 1px solid var(--line-2); }
  .tbl td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  @media (max-width: 899px) { .doc-grid { grid-template-columns: 1fr; gap: 16px; } .toc { position: static; flex-direction: row; overflow-x: auto; scrollbar-width: none; } .toc a { white-space: nowrap; } }
`;

export function methodologyBody({ minHeight = 2300 } = {}) {
  const toc = ['Two data speeds', 'Dealer structure', 'Flip vs walls', 'Score and tier', 'Advisory reads', 'AI read and grounding', 'Simulation', 'Fear–greed gauge', 'Where the read is weak', 'What Convexa never does', 'Vocabulary'];
  return `<div style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);">
    ${nav({ active: '' })}
    <section class="wrap" style="padding-top: 32px;">
      <span class="caps" style="color: var(--amber-text);">Methodology</span>
      <h1 class="display" style="margin: 8px 0 0; font-size: clamp(28px, 3vw, 40px); letter-spacing: -0.02em;">How Convexa works</h1>
      <p style="margin: 10px 0 0; font-size: 15px; color: var(--steel); max-width: 720px; line-height: 1.6;">What the numbers mean, how often they update, and where the read is weak. Not a pitch deck — the assumptions behind the desk.</p>
      <div class="doc-grid" style="margin-top: 28px;">
        <nav class="toc" aria-label="On this page">${toc.map((t, i) => `<a href="#" class="${i === 0 ? 'on' : ''}">${t}</a>`).join('')}</nav>
        <article class="doc">
          <h2 class="display" style="margin-top: 0;">Two data speeds — do not mix them</h2>
          <p>Prices on the live tape update from a stream. Structure — score, tier, flip, walls, GEX, setups — refreshes on a slower poll (about a minute on a ticker desk, about every three minutes across the scanner, sooner for names that just moved). The scanner and ticker say “Structure as-of …” for that path.</p>
          <p>When the live stream drops, live cells dim and say offline. Structure stays readable at its last snapshot. A quiet tape is not a blank desk.</p>
          <div class="panel is-live" style="overflow: hidden; margin: 8px 0 4px;"><div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px 6px; flex-wrap: wrap;"><span class="caps">Structure field · the desk’s core read</span><span style="flex: 1;"></span><span class="chip outline" style="font-size: 11px;">levels as-of 42s</span><span class="chip live" style="height: 18px; font-size: 11px;"><span class="dot"></span>mid is tape</span></div><div class="well" style="padding: 6px 4px 0;">${structureField({ width: 720, height: 220, id: 'md' })}</div></div>
          <h2 class="display">Dealer structure — walls, flip, GEX</h2>
          <p>The core read is options dealer positioning: call and put walls, the gamma flip, and net GEX across strikes in your selected expiration window. Those levels come from the option chain snapshot, not from inventing direction on the front end.</p>
          <p>GEX and walls are computed at a GEX spot basis (often the session close when the market is closed, the live mid during regular hours for the engine’s phase rules). The desk always labels that basis so a level is never confused with the live tape price.</p>
          <p>Raw dollar GEX sizes exposure for a fixed 1% spot shock. Vol-norm GEX divides that magnitude by ATM IV (or 30-day HV if ATM IV is missing) so readings stay comparable when vol is high or low. Independent evidence favours the vol-normalized magnitude; walls and the flip stay raw strike levels. Vol-norm GEX is not a scoring input.</p>
          <h2 class="display">Flip vs walls — different gamma bases</h2>
          <p>Call wall and put wall pick the strikes with the largest positive and negative dealer gamma using the vendor’s per-contract gamma and a dealer-sign open-interest convention (calls short, puts long as the default dealer book). That is a snapshot convention, not a measured inventory — real desks can and do differ.</p>
          <p>Gamma flip is not “the wall’s midpoint”. It is the zero-crossing of the analytic net-GEX curve across strikes, where hedging flips from dampening to amplifying. Walls can sit far from the flip when the gamma profile is skewed; treat them as related but not the same object.</p>
          <p class="muted">Limitations: vendor gamma can lag or gap on thin names; OI sign is an assumption; levels are only as good as the chain snapshot. When gamma or OI is missing the cell says unavailable — we do not invent a wall.</p>
          <h2 class="display">Score and tier</h2>
          <p>Opportunity score and tier arrive pre-computed from the server. The desk maps them through closed labels (Prime, Actionable, Watch, Dormant) and never re-derives the score from scan rows alone. The score is a capped sum of plain components:</p>
          <table class="tbl" style="margin: 4px 0 14px;"><thead><tr><th>Component</th><th>Max</th><th>What it reads</th></tr></thead><tbody>
            ${[['Proximity to walls / flip', '40', 'how close the mid sits to a level that matters'], ['|IV/HV − 1| stretch', '25', 'how far implied vol sits from realised'], ['Active setups', '25', 'rule-based reads currently firing'], ['Flip transition', '10', 'the flip moved across the mid since the last snapshot'], ['Dark-pool confluence', '6', 'optional · off-exchange prints near a level']].map(([a, b, c]) => `<tr><td style="font-weight: 600;">${a}</td><td class="mono">${b}</td><td style="color: var(--steel);">${c}</td></tr>`).join('')}
          </tbody></table>
          <p class="muted">Honest scope: today’s score does not consume vol-normalized GEX or the IV-rank band. Those are advisory context on the desk only. Folding them into the score would be a deliberate product change with ledger evidence — not a quiet UI tweak.</p>
          <h2 class="display">Advisory reads</h2>
          <p>Projected dealer flow (charm, vanna), market context (trend, profile shape, flow vs positioning, ATR), IV rank, the straddle-implied move, fresh positioning and off-exchange blocks sit in the context band. They carry their own basis and as-of, they refresh with the data load, and none of them feeds the score.</p>
          <h2 class="display">AI read and grounding</h2>
          <p>A read runs on your own key, pinned to one snapshot, framed by your persona and capped by your risk inputs. It answers trade or no trade first, then max risk, invalidation, entry and target. Each cited figure is checked against the snapshot: figures that trace to Convexa render in mono; a figure the model asserted but that could not be traced renders in body type, so authorship is visible even in a black-and-white screenshot.</p>
          <p class="muted">What leaves the machine, on demand, is the computed snapshot, the candidate contracts, your two risk numbers, the open-positions digest for the ticker, the persona prompt and the field glossary — reviewable in full from “What’s sent”. No other ticker, no identity, no broker data and no key ever leave.</p>
          <h2 class="display">Simulation</h2>
          <p>Simulated trades and orders are paper. Fills model at the mid with no slippage and no partial fills; a sim order triggers and fills only while a live stream for that ticker is open in your browser. Sim P/L uses a mark ladder (snapshot → modeled → theoretical → last known); last known is frozen when the stream is offline and never framed as live.</p>
          <h2 class="display">Fear–greed gauge</h2>
          <p>The fear–greed gauge in the Stress section of Research → Markets is built only from inputs Convexa may show. The familiar fear gauges (Cboe’s VIX and put/call ratios, CNN’s Fear & Greed) need a licence to show, so none is used.</p>
          <p>Seven inputs: the five category series of the Office of Financial Research’s Financial Stress Index (volatility, credit, safe assets, equity valuation and funding) and two weekly CFTC series, leveraged funds’ net VIX futures and asset managers’ net E-mini S&P 500 futures, each as a share of open interest.</p>
          <p>Each input is ranked against its own last three years: its percentile is the share of those days or weeks it sits above. Inputs where a higher value means more fear are flipped, so for every input 0 is extreme fear and 100 extreme greed: high stress reads low. The gauge is the plain average of the unrounded scores of the inputs that are fresh: a daily input counts for 5 weekdays after its date, holidays included, a weekly one for 14 days. With fewer than 5 of 7 fresh, no reading is published.</p>
          <p>Bands are Convexa’s own: 0–24 Extreme Fear, 25–44 Fear, 45–55 Neutral, 56–75 Greed, 76–100 Extreme Greed. An edge belongs to the calmer band.</p>
          <p class="muted">The cost: five of the seven inputs come from one OFR file, so one method and one outage drive most of the gauge, and in practice it publishes exactly when that file is fresh. The OFR’s categories are blends of 33 market variables worldwide (OFR working paper 17-04), not raw prices, and the file runs about two business days behind, so each row shows its own date. The gauge is research, not a signal, and not investment advice.</p>
          <h2 class="display">Where the read is weak</h2>
          <p>Evidence is strongest on liquid index and megacap names. Thin single names can show structure that is noise — the desk shows a single-name caveat when the symbol is outside the curated universe. Outside regular hours structure still ages honestly, but spot basis and chain freshness matter more. Missing chain data, a failed symbol or a building first pass shows as unavailable or building — never a fabricated zero.</p>
          <h2 class="display">What Convexa never does</h2>
          <p>No real order path: nothing here places, changes or cancels a broker order. No guarantee: structure is context for a plan, not a price forecast and not a trade command. AI reads are advisory and require an explicit accept into the sim book.</p>
          <h2 class="display">Vocabulary</h2>
          <table class="tbl"><thead><tr><th>Literal</th><th>Means</th></tr></thead><tbody>
            ${[['—', 'no value on this snapshot (a plain dash, never a fake zero)'], ['unavailable', 'an input failed or is missing this cycle'], ['not given', 'the read did not answer this field'], ['not set', 'you supplied no risk block — the one you can act on'], ['size not suggested', 'the risk block is present; the model returned no size'], ['unrecognized', 'the read answered a conviction outside low / medium / high; Convexa will not repeat what it cannot place']].map(([a, b]) => `<tr><td class="mono" style="white-space: nowrap;">${a}</td><td style="color: var(--steel);">${b}</td></tr>`).join('')}
          </tbody></table>
          <div style="display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap;"><a href="#" class="btn primary">Open Scanner ${icon('arrow', 14)}</a><a href="#" class="btn secondary">Open free Ticker</a><a href="#" class="btn ghost">Back to home</a></div>
          <p class="muted" style="margin-top: 20px; font-size: 12px;">Convexa is an analysis tool. Simulated positions are paper. A connected brokerage is read-only — Convexa never places, changes, or cancels an order. Not investment advice.</p>
        </article>
      </div>
    </section>
    ${footer()}
  </div>`;
}
