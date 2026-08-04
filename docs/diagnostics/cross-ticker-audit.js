/**
 * Convexa — cross-ticker mark contamination audit (READ-ONLY)
 * ===========================================================
 * Context: `useBrokerMarks` / `usePortfolio` price EQUITY legs off the FOCUSED ticker's bundle
 * price, never the leg's own `ticker` (confirmed + reproduced 2026-08-03). Marks feed
 * `realized_pl_dollar` on close and `mark_price`/`pl_dollar`/`underlying_spot` on every
 * DecisionRecord — which feed the outcome ledger. A code fix corrects future numbers; it cannot
 * repair records already written. This tells you HOW MUCH of your saved history is affected.
 *
 * HOW TO RUN
 *   1. Open the Convexa app in your browser (any page — it only reads localStorage).
 *   2. Open DevTools (F12) -> Console.
 *   3. Paste this ENTIRE file, press Enter.
 *   4. Read the summary. Nothing is written, deleted, or sent anywhere.
 *
 * WHAT IT CANNOT KNOW: which ticker was focused when a given record was written is not stored,
 * so exact per-record contamination is not retroactively provable. What IS provable is the
 * SMOKING GUN below — two records for DIFFERENT tickers sharing one `underlying_spot` can only
 * happen if both took the same (focused) bundle's spot.
 */
(() => {
  const KEY = 'convexa.positions.v3';
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    console.log(`%c[audit] No ${KEY} in this browser — nothing saved here to audit.`, 'color:#888');
    return;
  }
  let book;
  try {
    book = JSON.parse(raw);
  } catch (e) {
    console.log(`%c[audit] ${KEY} exists but did not parse — STOP and do not write to the app.`,
      'color:#b3403f;font-weight:bold');
    return;
  }

  // --- locate the collections defensively (shape has migrated across versions) ---
  const posMap = book.positions && typeof book.positions === 'object' ? book.positions : {};
  const positions = Array.isArray(posMap) ? posMap : Object.values(posMap);
  const decisions = []
    .concat(Array.isArray(book.decisions) ? book.decisions : [])
    .concat(Array.isArray(book.decision_log) ? book.decision_log : [])
    .concat(positions.flatMap((p) => (Array.isArray(p?.decisions) ? p.decisions : [])));

  const legsOf = (p) => (Array.isArray(p?.legs) ? p.legs : []);
  const isEquity = (l) => l?.kind === 'equity';
  const isClosed = (p) => p?.status === 'closed' || p?.close_time;

  // --- population ---
  const allTickers = new Set(positions.flatMap((p) => legsOf(p).map((l) => l?.ticker).filter(Boolean)));
  const closed = positions.filter(isClosed);
  const closedWithEquity = closed.filter((p) => legsOf(p).some(isEquity));
  const openWithEquity = positions.filter((p) => !isClosed(p) && legsOf(p).some(isEquity));

  // --- implausible-move heuristic on closed equity positions ---
  // implied exit = entry + realized/(qty*mult). A >40% implied move on a single equity leg is
  // possible but rare; combined with a multi-ticker book it is the expected fingerprint here.
  const suspectClosed = [];
  for (const p of closedWithEquity) {
    const eq = legsOf(p).filter(isEquity);
    if (eq.length !== 1 || typeof p.realized_pl_dollar !== 'number') continue;
    const l = eq[0];
    const denom = (Number(l.qty) || 0) * (Number(l.multiplier) || 1);
    if (!denom || !Number(l.entry_price)) continue;
    const impliedExit = Number(l.entry_price) + p.realized_pl_dollar / denom;
    const movePct = Math.abs(impliedExit / Number(l.entry_price) - 1) * 100;
    if (movePct > 40) {
      suspectClosed.push({
        ticker: l.ticker, entry: +Number(l.entry_price).toFixed(2),
        impliedExit: +impliedExit.toFixed(2), movePct: +movePct.toFixed(1),
        realized: +p.realized_pl_dollar.toFixed(2), closed: p.close_time || '(no close_time)',
      });
    }
  }

  // --- THE SMOKING GUN: one underlying_spot shared across different tickers ---
  const bySpot = new Map();
  for (const d of decisions) {
    const t = d?.contract?.ticker;
    const s = d?.underlying_spot;
    if (!t || typeof s !== 'number' || !Number.isFinite(s)) continue;
    const k = s.toFixed(4);
    if (!bySpot.has(k)) bySpot.set(k, new Set());
    bySpot.get(k).add(t);
  }
  const collisions = [...bySpot.entries()]
    .filter(([, tickers]) => tickers.size > 1)
    .map(([spot, tickers]) => ({ underlying_spot: +spot, tickers: [...tickers].join(', ') }));

  // --- report ---
  const line = '─'.repeat(62);
  console.log(`%c${line}\n CONVEXA — cross-ticker mark contamination audit\n${line}`,
    'color:#a86410;font-weight:bold');
  console.log(`Distinct tickers in the book : ${allTickers.size}  [${[...allTickers].join(', ') || '—'}]`);
  console.log(`Positions total / closed     : ${positions.length} / ${closed.length}`);
  console.log(`Decision records found       : ${decisions.length}`);
  console.log('');
  console.log(`%cAT-RISK POPULATION (equity legs — the only ones affected)`, 'font-weight:bold');
  console.log(`  closed positions w/ equity : ${closedWithEquity.length}   <- realized P/L already on disk`);
  console.log(`  open positions w/ equity   : ${openWithEquity.length}   <- self-corrects once the fix ships`);
  console.log('');

  if (allTickers.size <= 1) {
    console.log('%c✅ SINGLE-TICKER BOOK — the bug cannot have fired. Nothing to remediate.',
      'color:#1e7a4d;font-weight:bold');
  } else if (closedWithEquity.length === 0 && collisions.length === 0) {
    console.log('%c✅ NO CONTAMINATED RECORDS FOUND — multi-ticker book, but no closed equity',
      'color:#1e7a4d;font-weight:bold');
    console.log('   positions and no spot collisions. Your options history is unaffected.');
  } else {
    console.log(`%cSMOKING GUN — one spot shared by two+ tickers (proof, not inference): ${collisions.length}`,
      collisions.length ? 'color:#b3403f;font-weight:bold' : 'color:#1e7a4d');
    if (collisions.length) console.table(collisions.slice(0, 25));
    console.log(`%cIMPLAUSIBLE IMPLIED MOVE on a closed equity position (>40%): ${suspectClosed.length}`,
      suspectClosed.length ? 'color:#a35f14;font-weight:bold' : 'color:#1e7a4d');
    if (suspectClosed.length) console.table(suspectClosed.slice(0, 25));
  }

  console.log('');
  console.log('%cNOTE: which ticker was focused at write time is not stored, so per-record proof is',
    'color:#888');
  console.log('%climited to the collisions above. Option positions are affected only mildly (they',
    'color:#888');
  console.log('%cre-anchor each cycle); equity positions are the real exposure.', 'color:#888');
  console.log(`%c${line}`, 'color:#a86410');

  return {
    tickers: [...allTickers], positionsTotal: positions.length, closedTotal: closed.length,
    closedWithEquity: closedWithEquity.length, openWithEquity: openWithEquity.length,
    decisionRecords: decisions.length, spotCollisions: collisions.length,
    implausibleClosed: suspectClosed.length,
  };
})();
