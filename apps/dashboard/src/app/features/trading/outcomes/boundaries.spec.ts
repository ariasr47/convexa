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
import { describe, expect, it } from 'vitest';
import * as copyModule from './copy';
import * as ledgerModule from './ledger';

// The FORBIDDEN importers, enumerated by §5.1 boundary 2 — every module that must NOT reach the
// outcomes module. Imported as SOURCE TEXT (`?raw`), so this asserts the import graph itself.
import modelStore from '@/features/trading/model/store?raw';
import modelTypes from '@/features/trading/model/types?raw';
import useGhostTrade from '@/features/trading/model/useGhostTrade?raw';
import ordersStore from '@/features/trading/orders/store?raw';
import useOrders from '@/features/trading/orders/useOrders?raw';
import positionsStore from '@/features/trading/positions/store?raw';
import usePortfolio from '@/features/trading/positions/usePortfolio?raw';
import portfolioPanel from '@/features/trading/positions/PortfolioPanel?raw';
import personasStore from '@/features/personas/store?raw';
import personasTemplate from '@/features/personas/template?raw';
import aiRecPanel from '@/pages/ticker/widgets/ai-rec/AiRecPanel?raw';

// The modules under test, as source.
import ledgerSource from './ledger?raw';
import archiveSource from './archive?raw';
import sectionSource from './TrackRecordSection?raw';
import archiveBlockSource from './ArchiveBlock?raw';
import copySource from './copy?raw';
import sourcesSource from './sources?raw';

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
  ['features/trading/model/useGhostTrade', useGhostTrade],
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
      if (typeof fn === 'function') expect(fn.name).not.toMatch(/^(set|put|save|write|append|delete|remove|clear)/i);
    }
    const ledger = code(ledgerSource);
    expect(ledger).not.toMatch(/localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/);
    expect(ledger).not.toMatch(/\b(putPosition|putTrade|putOrder|appendDecision|saveActiveId)\b/);
    // The harvest reads raw blobs — read-only, and it must stay that way. It deliberately does NOT
    // use `resolveDurable`, which promotes-forward (a write).
    expect(code(sourcesSource)).not.toMatch(/setItem|removeItem|\.clear\(\)|resolveDurable/);
  });

  it('NO_BACKEND_CHANGE — no module in this feature makes a network call of any kind', () => {
    for (const [name, source] of OUTCOMES_SOURCES) {
      // No endpoint, no SSE, no fetcher. The empty `apps/api` diff IS the no-auto-tuning guarantee.
      expect(source, name).not.toMatch(/@org\/api/);
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
      expect(source, name).not.toMatch(/useGate|simTradeGate|SignInPrompt|gate\.guard|gate\.prompt/);
    }
  });
});

describe('AC-6 / AC-14 / AC-E17 — the negative space in the surface', () => {
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

  it('AC-14 — no semantic tint on any rate: no success/error palette, no red/green, no arrow, no bar, no gauge', () => {
    // ⚠ The file next door does `color: netPl >= 0 ? "success.main" : "error.main"`. The range is
    // the verdict, not the hue.
    expect(ui).not.toMatch(/success\.main|error\.main|warning\.main|['"]red|['"]green/);
    expect(ui).not.toMatch(/ArrowUpward|ArrowDownward|TrendingUp|TrendingDown|CheckCircle|Cancel/);
    expect(ui).not.toMatch(/LinearProgress|CircularProgress|Sparkline|Gauge|BarChart/);
    // No progress bar in the `building` cell: "7 of 20" invites a meter, and a meter beside a
    // hit-rate-shaped cell reads as 35%.
    expect(ui).not.toMatch(/severity="error"/);
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
    expect(RENDERED_COPY.toLowerCase()).not.toMatch(/\bseed(ed|ing)?\b|\bdemo\b|test data|sample data/);
    // The seed is excluded STRUCTURALLY by the DecisionRecord-as-spine rule — no branch knows it exists.
    for (const [name, source] of OUTCOMES_SOURCES) {
      expect(source, name).not.toMatch(/testSeed|seedPortfolio/);
    }
  });
});
