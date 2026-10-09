/**
 * outcome-ledger — the STRUCTURAL guarantees against auto-tuning (ARCHITECTURE_CONTRACT §5.1).
 * These four boundaries are what make this feature safe, and none of them is visible to review:
 * a single new import in an unrelated refactor would silently close the feedback loop this feature
 * exists NOT to close. Hence a source scan.
 *
 *   1. ZERO backend surface — `NO_BACKEND_CHANGE`. A statistic that never leaves the browser cannot
 *      reach `signals.py`. (The `apps/api` diff is verified empty at GATE Q.)
 *   2. The ledger is a ONE-WAY LEAF — nothing imports it but its host surface.
 *   3. The ledger performs NO writes.
 *   4. Its output rides no AI state-export / persona prompt / ai-rec context.
 *
 * ⚠ Uses the Vite `?raw` idiom. `fileURLToPath(new URL(...))` THROWS in this Vitest environment —
 * the project has hit that before (the ai-context-pack lane). Do not "fix" it back.
 */
import { entryContextFor } from '@/features/trading/model/captureDigest';
import {
  __resetMemory as __resetPositionsMemory,
  allDecisions,
  appendDecision,
} from '@/features/trading/positions/store';
import type { TickerBundle } from '@convexa/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as copyModule from './copy';
import * as ledgerModule from './ledger';
import { EXCLUSION_PRECEDENCE, FAMILY_ORDER } from './types';

// The FORBIDDEN importers, enumerated by §5.1 boundary 2 — every module that must NOT reach the
// outcomes module. Imported as SOURCE TEXT (`?raw`), so this asserts the import graph itself.
import personasStore from '@/features/personas/store?raw';
import personasTemplate from '@/features/personas/template?raw';
import modelStore from '@/features/trading/model/store?raw';
import modelTypes from '@/features/trading/model/types?raw';
import ordersStore from '@/features/trading/orders/store?raw';
import useOrders from '@/features/trading/orders/useOrders?raw';
import portfolioPanel from '@/features/trading/positions/PortfolioPanel?raw';
import positionsStore from '@/features/trading/positions/store?raw';
import usePortfolio from '@/features/trading/positions/usePortfolio?raw';
import aiRecPanel from '@/pages/ticker/widgets/ai-rec/AiRecPanel?raw';

// The modules under test, as source.
import archiveSource from './archive?raw';
import archiveBlockSource from './ArchiveBlock?raw';
import copySource from './copy?raw';
import ledgerSource from './ledger?raw';
import sourcesSource from './sources?raw';
import sectionSource from './TrackRecordSection?raw';

/**
 * Strip comments before scanning. These modules carry deliberate ⚠ warnings that QUOTE the forbidden
 * patterns verbatim ("the file next door does `opacity: streamOffline ? 0.5 : 1`") — that prose is
 * the point, and it is not code. The scan must assert what the module DOES.
 */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FORBIDDEN_IMPORTERS: [string, string][] = [
  ['features/trading/model/store', modelStore],
  ['features/trading/model/types', modelTypes],
  ['features/trading/orders/store', ordersStore],
  ['features/trading/orders/useOrders', useOrders],
  ['features/trading/positions/store', positionsStore],
  ['features/trading/positions/usePortfolio', usePortfolio],
  ['features/trading/positions/PortfolioPanel', portfolioPanel],
  ['features/personas/store', personasStore],
  ['features/personas/template', personasTemplate],
  ['pages/ticker/widgets/ai-rec/AiRecPanel', aiRecPanel],
];

const OUTCOMES_SOURCES: [string, string][] = [
  ['ledger', code(ledgerSource)],
  ['archive', code(archiveSource)],
  ['TrackRecordSection', code(sectionSource)],
  ['ArchiveBlock', code(archiveBlockSource)],
  ['copy', code(copySource)],
  ['sources', code(sourcesSource)],
];

/** Every user-facing string this feature can render (the copy module IS the surface's vocabulary). */
const RENDERED_COPY: string = Object.values(copyModule)
  .flatMap((v) => {
    if (typeof v === 'string') return [v];
    // Exercise each builder so interpolated strings are scanned too, not just the literals.
    if (typeof v === 'function') {
      try {
        return [String((v as (...a: unknown[]) => unknown)(1, 20, 1, 1, 1))];
      } catch {
        return [];
      }
    }
    if (v && typeof v === 'object') return Object.values(v).filter((x) => typeof x === 'string');
    return [];
  })
  .join('\n');

/**
 * ⚠⚠ THE CLOSE-BEARING SET IS PINNED, NOT TRUSTED (ARCHITECTURE_CONTRACT §2/Q3.5).
 *
 * The correct answer to "the event name is an accident of the call site" is not to abandon the event
 * name — it is to make the accident ENUMERABLE, VERIFIED, and unable to drift silently. Prose cannot
 * hold a rule whose truth depends on a call site. A test can.
 *
 * This scan is deliberately BRITTLE: brittleness IS the mechanism. Without it, the join fix handles
 * today's instance and leaves tomorrow's identical defect free to recur silently — which is the
 * actual root cause, not the `close` literal. Whoever this fails for: read §2/Q3.5 before "fixing" it.
 */
const Q35 = [
  '⚠ ARCHITECTURE_CONTRACT §2/Q3.5 — the CLOSE-BEARING set has drifted.',
  'A new close path or a new `closeTrade` `via` literal appeared in production.',
  '`outcomes/ledger.isCloseBearing` enumerates the close-bearing events, and it does NOT know about',
  'this one — so every position closed through it will silently fall to `unresolved_join` and vanish',
  "from every rate, in the quiet direction that trips none of this feature's own alarms.",
  'Do NOT widen the predicate to make this pass: `accept` is ambiguous (a non-closing Hold/Trim/Add',
  'path writes it) and `accept` + `ai_verdict: "Roll"` does not close either. Read §2/Q3.5, then',
  'update the predicate, this scan, and the fixtures together.',
].join('\n');

/** Every string literal passed as `closeTrade`'s FIRST argument (its `via`), from real source. */
const viaLiteralsIn = (src: string): string[] =>
  [...code(src).matchAll(/closeTrade\(\s*'([^']*)'/g)].map((m) => m[1]);

const WRITES_CLOSED = /status:\s*'closed'/;

/**
 * The whole `features/trading` tree as SOURCE TEXT. A glob, not an enumeration: the scan must notice
 * a close path in a module that does not exist yet — that is the entire point of guarding the root
 * cause rather than the instance.
 */
const TRADING_SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('⚠ §2/Q3.5 — the close-bearing set is PINNED by a source scan (the guard)', () => {
  it('`closeTrade` has NO producer left at all — and the predicate still recognises its records', () => {
    // `model/useGhostTrade` is DELETED at the v3 cutover, and it was the only `closeTrade` caller.
    // So the live producer set is now EMPTY — asserted over the whole tree, not over one file, so a
    // reintroduced caller anywhere is caught.
    const producers = Object.entries(TRADING_SOURCES)
      .filter(([path]) => !/\.spec\.|\/fixtures\.ts$/.test(path))
      .flatMap(([, src]) => viaLiteralsIn(src));
    expect(producers, Q35).toEqual([]);
    // The PREDICATE must NOT be narrowed to match. `accept` and `roll` close-bearing records are
    // sitting in real users' durable history right now, and the ledger has to keep counting them;
    // narrowing it would make those positions vanish from every rate, quietly.
    expect(code(ledgerSource), Q35).toMatch(/'accept'/);
    expect(code(ledgerSource), Q35).toMatch(/'roll'/);
  });

  it('`status: "closed"` is written by NO production module outside the two named close paths', () => {
    // `usePortfolio.closePosition` is now the ONLY close path — `useGhostTrade` is deleted and the
    // Ticker page closes through the one book. `testSeed.ts` is the known second writer and is NOT a
    // close path: it writes a fabricated closed position with no decision record at all, which the
    // spine rule excludes structurally (§2/Q3.3). A THIRD entry here means a new close path exists
    // and the join has not been told about it.
    const writers = Object.entries(TRADING_SOURCES)
      .filter(([path]) => !/\.spec\.|\/fixtures\.ts$/.test(path))
      .filter(([, src]) => WRITES_CLOSED.test(code(src)))
      .map(([path]) => path.replace(/^\.\.\//, ''))
      .sort();
    expect(writers, Q35).toEqual(['positions/testSeed.ts', 'positions/usePortfolio.ts']);
  });

  it('the guard BITES — it fails on a new `via` literal and on a new close path (a scan that cannot fail guards nothing)', () => {
    // The scan is only worth its brittleness if it actually detects the drift it exists for. Prove
    // it against a mutated source rather than trusting the regex.
    expect(viaLiteralsIn("closeTrade('expire', x)")).toEqual(['expire']); // a new via IS detected
    expect(WRITES_CLOSED.test(code("const x = { ...p, status: 'closed' };"))).toBe(true);
    // ...and it reads CODE, not prose: this file's own ⚠ warnings quote the patterns verbatim.
    expect(WRITES_CLOSED.test(code("// a comment about status: 'closed'"))).toBe(false);
  });
});

describe('boundary 2 — the outcome ledger is a ONE-WAY LEAF: nothing imports it', () => {
  it.each(FORBIDDEN_IMPORTERS)('%s does not import the outcomes module', (_name, source) => {
    // A single import here would let a measured outcome flow back toward the score. This feature is
    // `[score-change-is-deliberate-and-measured]`'s ENABLER, never its exerciser: a measured outcome
    // informs a DELIBERATE HUMAN score change, in a separate explicit feature.
    expect(source).not.toMatch(/from\s+['"][^'"]*outcomes/);
    expect(source).not.toMatch(/import\(['"][^'"]*outcomes/);
  });

  it('the AI-rec panel / prompt assembly does not reach the ledger — its output is not a decision input (boundary 4)', () => {
    // Feeding outcome stats to the LLM would make them a decision input. That is a separate feature
    // governed by `[digested-labels-not-raw-dump]` — a named seam, not built.
    for (const source of [aiRecPanel, personasTemplate]) {
      expect(source).not.toMatch(/outcomes/);
      expect(source).not.toMatch(/TrackRecord|computeLedgerRead|hit_rate/);
    }
  });
});

describe('boundary 1 + 3 — the ledger is a pure client-local read', () => {
  it('the read module has ZERO write functions and touches no storage write API', () => {
    for (const fn of Object.values(ledgerModule)) {
      if (typeof fn === 'function')
        expect(fn.name).not.toMatch(/^(set|put|save|write|append|delete|remove|clear)/i);
    }
    const ledger = code(ledgerSource);
    expect(ledger).not.toMatch(
      /localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/,
    );
    expect(ledger).not.toMatch(/\b(putPosition|putTrade|putOrder|appendDecision|saveActiveId)\b/);
    // The harvest reads raw blobs — read-only, and it must stay that way. It deliberately does NOT
    // use `resolveDurable`, which promotes-forward (a write).
    expect(code(sourcesSource)).not.toMatch(/setItem|removeItem|\.clear\(\)|resolveDurable/);
  });

  it('NO_BACKEND_CHANGE — no module in this feature makes a network call of any kind', () => {
    for (const [name, source] of OUTCOMES_SOURCES) {
      // No endpoint, no SSE, no fetcher. The empty `apps/api` diff IS the no-auto-tuning guarantee.
      expect(source, name).not.toMatch(/@convexa\/api/);
      expect(source, name).not.toMatch(/\bfetch\(|streamTicker|getTicker|EventSource|axios/);
    }
  });

  it('the import fences hold: outcomes reaches no `pages/`, no `features/personas`, no `features/auth`', () => {
    for (const [name, source] of OUTCOMES_SOURCES) {
      expect(source, name).not.toMatch(/from\s+['"]@\/pages\//); // upward import — lint + structure
      expect(source, name).not.toMatch(/from\s+['"]@\/features\/personas/); // personaLabel is a PROP
      expect(source, name).not.toMatch(/from\s+['"]@\/features\/auth/);
    }
  });
});

describe('AC-2 / AC-25 — the readout AND the archive are UNGATED', () => {
  it('no gate call exists anywhere in the feature', () => {
    // `PortfolioPanel` — the component directly above this one on the same page — server-gates every
    // write, and Import *looks* like a write. It is not comparable: it reaches no server, creates no
    // position, costs nothing, and writes only into the user's own browser. There is no boundary at
    // which a gate could be enforced, so an FE-only gate would be decorative — and a decorative gate
    // is FORBIDDEN, not merely useless (`[server-side-gate-enforcement]`).
    for (const [name, source] of OUTCOMES_SOURCES) {
      expect(source, name).not.toMatch(
        /useGate|simTradeGate|SignInPrompt|gate\.guard|gate\.prompt/,
      );
    }
  });
});

describe('AC-6 / AC-E17 — the negative space in the surface', () => {
  const ui = code([sectionSource, archiveBlockSource].join('\n'));

  it('AC-E17 — the readout takes NO live prop and binds no opacity to any stream state', () => {
    // ⚠ `PositionsPage.tsx` does `opacity: streamOffline ? 0.5 : 1` on its Net P/L header — the
    // block directly above this section, in the same file. That is a LIVE P&L. This is a STATIC
    // historical read: on a stream drop it renders unchanged and UN-DIMMED.
    expect(ui).not.toMatch(/\bstreamOffline\b|\bisLive\b|\boffline\b/);
    expect(ui).not.toMatch(/opacity:/);
    expect(ui).not.toMatch(/EventSource|streamTicker|LiveUpdate/);
    // No freshness concept exists here: no "as of", no Refresh, no poll, no stale treatment.
    expect(ui).not.toMatch(/setInterval|Refresh|as of/i);
  });

  it('AC-6 — the readout proposes nothing: no score/threshold/weight copy, and no toggle, override, filter or sort control', () => {
    // This feature is `[score-change-is-deliberate-and-measured]`'s ENABLER, never its exerciser.
    expect(RENDERED_COPY.toLowerCase()).not.toMatch(
      /gate_score|threshold|weight|tune|calibrat|suggest/,
    );
    // §8 non-goal 15: no include/exclude affordance in the surface OR the data.
    expect(ui).not.toMatch(/<Switch|<Checkbox|<Slider|<Select|onSort|setFilter|includeExcluded/);
    expect(RENDERED_COPY.toLowerCase()).not.toMatch(/count it anyway|show excluded/);
  });

  it('AC-E21 — NO ROLL CATEGORY: a roll is a close, not a cohort. No roll cell, rate, reason, count, badge or filter — in the data, the type, or the surface', () => {
    // Having ruled that a rolled-out leg IS an outcome, it must be an outcome WITHOUT AN ASTERISK.
    // ⚠ "Surfacing the roll count for transparency" is the FAILURE MODE here, not the safeguard: a
    // count of rolls beside a rate is a sub-cohort in everything but name, and it hands the reader
    // the mental subtraction — "58%, but 5 of those were rolls, so really…" — that the ruling
    // refused. The basis obligation (`[model-read-carries-its-assumptions]`) is discharged by the
    // hit DEFINITION (`TR_HIT_DEF`, AC-13): a definition, not a count.
    expect(EXCLUSION_PRECEDENCE.filter((r) => /roll/i.test(r))).toEqual([]);
    expect(Object.keys(copyModule.TR_REASON_LABEL).filter((k) => /roll/i.test(k))).toEqual([]);
    expect(FAMILY_ORDER.filter((k) => /roll/i.test(k))).toEqual([]);
    // ⚠ The pre-named exclusion slot after `scenario_sourced` stays EMPTY. No `rolled_continuation`.
    expect([...EXCLUSION_PRECEDENCE]).toEqual([
      'malformed',
      'no_decision_record',
      'unresolved_join',
      'scenario_sourced',
      'unpriced_basis',
      'modeled_basis',
    ]);
    // No roll cohort / marker / count / filter in the surface. (`\b` keeps "scroll"/"controlled"
    // out; the "roll-up" in the prose is stripped with the comments.)
    expect(ui).not.toMatch(/\broll(ed|s|_|C|Co)/i);
    // The ONLY place a roll may be NAMED is the hit definition (AC-13) — never a label, never a
    // count, never a badge. AC-E20's truthful wording names no roll either.
    const namesARoll = Object.entries(copyModule)
      .filter(([, v]) => typeof v === 'string' && /\broll/i.test(v))
      .map(([k]) => k)
      .filter((k) => k !== 'TR_HIT_DEF');
    expect(namesARoll).toEqual([]);
  });

  it('AC-10 / AC-16 — no dollar figure and no summed total anywhere in the rendered copy', () => {
    // `expectancy` appears ONLY inside `TR_RETURN_DEF`'s required disclaimer ("it is not dollar
    // expectancy", AC-10). It may never be a label, a caption or a stat name.
    const usesExpectancy = Object.entries(copyModule).filter(
      ([, v]) => typeof v === 'string' && v.toLowerCase().includes('expectancy'),
    );
    expect(usesExpectancy.map(([k]) => k)).toEqual(['TR_RETURN_DEF']);
    // No `$` anywhere: not a total, not per cell. A dollar total would sum OVERLAPPING cells.
    expect(RENDERED_COPY).not.toContain('$');
    // No total that sums cell Ns exists: the setup family fans out, so a sum would overstate.
    expect(ui).not.toMatch(/totalN|sumOfCells|reduce\(\(s, c\) => s \+ c\.cohort\.n/);
  });

  it('AC-E10 — the demo seed gets no special case: no seed/demo/test-data string is renderable, and no code branch mentions it', () => {
    // ("sample count" in the empty-state copy is the statistical sample — not seeded data.)
    expect(RENDERED_COPY.toLowerCase()).not.toMatch(
      /\bseed(ed|ing)?\b|\bdemo\b|test data|sample data/,
    );
    // The seed is excluded STRUCTURALLY by the DecisionRecord-as-spine rule — no branch knows it exists.
    for (const [name, source] of OUTCOMES_SOURCES) {
      expect(source, name).not.toMatch(/testSeed|seedPortfolio/);
    }
  });
});

// =================================================================================================
// tradeable-rec-inputs AC-29a (ship-blocking) — the account-size exclusion, TWO ARMS.
//
// The risk block's account size is the owner's most personal figure. `entry_context` carries only
// `risk_block_present: boolean | null` — the PRESENCE flag — never the dollar value; this is a
// TYPE-LEVEL guarantee (`EntryContextDigest` has no account-size field to assign one into), and the
// two arms below make that guarantee ENFORCEABLE rather than merely true today.
// =================================================================================================

describe('AC-29a arm 1 (behavioural) — the ledger export contains no account-size value', () => {
  const bundle = (): TickerBundle =>
    ({
      market_state: { price: 250 },
      signals: { opportunity_score: 50, opportunity_tier: 'watch' },
      ai_eval: { state_fingerprint: 'fp-risk' },
    }) as unknown as TickerBundle;

  beforeEach(() => {
    localStorage.clear();
    __resetPositionsMemory();
  });
  afterEach(() => {
    localStorage.clear();
    __resetPositionsMemory();
  });

  it('a rec produced under a risk block → captured at entry → appended → the ledger export JSON carries no account-size value anywhere', () => {
    // "Produced under a risk block" is represented exactly as the REAL capture call sites represent
    // it (`usePortfolio.recordDecision`, `useOrders.ts` x2): a PRESENCE boolean, never the figure —
    // the owner's account size (e.g. $583,219) is never even IN SCOPE of this function to leak.
    const digestAttachment = entryContextFor('open', {
      bundle: bundle(),
      aiRecFingerprint: 'fp-risk-rec',
      riskBlockPresent: true,
    });
    const rec = {
      id: 'dec-1',
      event_type: 'open',
      clock_time: '2026-08-12T14:00:00Z',
      trade_id: 'pos-1',
      contract: { ticker: 'TSLA', expiration: '2026-08-21', strike: 250, right: 'call', qty: 1 },
      mark_price: 5,
      mark_basis: 'snapshot',
      underlying_spot: 250,
      pl_dollar: 0,
      pl_pct: 0,
      tier: 'watch',
      position_fingerprint: 'fp-risk',
      schema_version: 3,
      ...digestAttachment,
    };
    expect(appendDecision(rec as never)).toBe(true);

    // "closed into the outcome ledger" — the record is readable off the SAME append-only log a close
    // event would add to; the export is the log's serialized form (`allDecisions` "feeds the orders
    // Export JSON — a read, never a write", `positions/store.ts`).
    const exported = JSON.stringify(allDecisions());
    expect(exported).toContain('risk_block_present'); // the presence flag DID ride the record
    expect(exported).not.toMatch(/account_size|accountSize|risk_account_size/i);
  });
});

describe('AC-29a arm 2 (source scan) — no production module writes an account-size value into a ledger or decision record', () => {
  /** The identifiers this arm forbids as OBJECT KEYS anywhere in production `features/trading/**`
   *  source. Deliberately WIDE (the whole tree, never narrowed to `outcomes/`) — the enforceable
   *  subject is `features/trading/**`, per PLAN.md's correction of SPEC §2.6's prose. */
  const ACCOUNT_SIZE_KEY = /\b(account_size|accountSize|risk_account_size)\s*:/;

  const PRODUCTION_TRADING_SOURCES: [string, string][] = Object.entries(TRADING_SOURCES)
    .filter(([path]) => !/\.spec\.|\/fixtures\.ts$/.test(path))
    .map(([path, src]) => [path.replace(/^\.\.\//, ''), code(src)]);

  it('no production module in features/trading/** writes an account-size KEY into any object literal', () => {
    const offenders = PRODUCTION_TRADING_SOURCES.filter(([, src]) =>
      ACCOUNT_SIZE_KEY.test(src),
    ).map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('the guard BITES — a poisoned literal is detected (anti-vacuity: a scan that cannot fail guards nothing)', () => {
    expect(ACCOUNT_SIZE_KEY.test('const rec = { account_size: 50000, ...x };')).toBe(true);
    expect(ACCOUNT_SIZE_KEY.test('const rec = { accountSize: entered, ...x };')).toBe(true);
    expect(ACCOUNT_SIZE_KEY.test('const rec = { risk_account_size: v, ...x };')).toBe(true);
    // ...and it reads CODE, not prose: a comment naming the forbidden key must not trip it (the
    // `code()` strip already removes comments before this regex ever sees the source).
    expect(ACCOUNT_SIZE_KEY.test(code('// never write account_size: here'))).toBe(false);
    // `risk_block_present` (the ALLOWED presence flag) must never be mistaken for the forbidden key.
    expect(ACCOUNT_SIZE_KEY.test('const d = { risk_block_present: true };')).toBe(false);
  });

  it('captureDigest.ts — the file F11 routes the flag into — is covered by this scan (not narrowed away)', () => {
    const names = PRODUCTION_TRADING_SOURCES.map(([path]) => path);
    expect(names.some((p) => p.endsWith('model/captureDigest.ts'))).toBe(true);
    expect(names.some((p) => p.endsWith('model/types.ts'))).toBe(true);
    expect(names.some((p) => p.endsWith('positions/usePortfolio.ts'))).toBe(true);
  });
});
