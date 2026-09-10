/**
 * The read-strip model (SPEC §2.4, §4.1, §4.6; DESIGN_SYSTEM.md rule 15). EIGHT FIXED SLOTS, a
 * closed tuple type, so a ninth slot is a COMPILE ERROR — the architect's own R2 "7-or-8
 * cardinality" self-revision was withdrawn at R3: a variable-cardinality slot recreates
 * `[absent-is-not-none]` in the SCROLL axis (at 393px an absent cell and a cell scrolled off the
 * rail are indistinguishable), and fixed slots have a repair variable cardinality does not.
 *
 * Seven of the eight cells decompose BYTE-FOR-BYTE from the old dealer positioning widget's values
 * and tooltips (re-verify the exact line numbers fresh — they drift; this file was written reading
 * that widget's source at the time of this task — it is deleted whole at FE-8). The eighth
 * (`ivRank`) comes from `iv-rank/IvRank.tsx`'s own `ivRankStripFigure` — a digest of the number that
 * widget's own FULL body (percentile, band, basis line, advisory footer) still renders separately,
 * untouched, in the quiet band (FE-11).
 *
 * That accounting is what makes deleting the old dealer positioning widget reviewable (FE-8): the
 * twelve shipped
 * cells decompose with zero orphans — 3 to the ladder rows, 2 to the ladder foot (FE-5, done), 7
 * here, IV rank the eighth.
 */
import { NOT_PROVIDED, type NotANumber } from '@/shared/copy/notANumber';
import { NOT_LIVE, type LiveClaim } from '@/shared/liveness/liveClaim';
import type { IvRankRead, MarketState, OffExchange } from '@convexa/api';
import {
  fmtUsdCompact,
  IVR_INFO,
  netDexTip,
  SKEW_PHRASE,
  skewState,
  skewTip,
  termTip,
  volOiTip,
} from '../_kit/copy';
import { ivRankStripFigure } from '../iv-rank/IvRank';
import { OPPORTUNITY_TIER_INFO } from '../opportunity-tier';

/** The closed-nine `—` (`shared/copy/notANumber.ts`'s own literal) for a cell whose model has no
 *  natural sub-caption source this cycle — never a fabricated qualifier. */
const NO_SUB = '—';

export type ReadStripSlot =
  | 'opportunity'
  | 'netDex'
  | 'ivHv'
  | 'ivRank'
  | 'volOi'
  | 'ivSkew'
  | 'termStructure'
  | 'offExchange';

export const READ_STRIP_SLOTS = [
  'opportunity',
  'netDex',
  'ivHv',
  'ivRank',
  'volOi',
  'ivSkew',
  'termStructure',
  'offExchange',
] as const satisfies readonly ReadStripSlot[];

export interface ReadStripCell {
  slot: ReadStripSlot;
  label: string;
  register: 'traced' | 'asserted';
  value: string | NotANumber;
  info: string;
  /**
   * Ticker fidelity repair, change 4 (F4) — the design's per-cell sub-caption
   * (`design/src/screens/desk.mjs:29`'s `cell({ ..., sub })`), drawn from the SAME model data the
   * cell's own `value`/`info` already use (never a new fabricated qualifier) — the closed-nine `—`
   * where the model has nothing to say this cycle.
   */
  sub: string;
  /**
   * All eight cells are REST/bundle reads (SPEC §2.4) — none is live-derived today, so the strip's
   * honest liveness state is eight dotless cells and any dot in it is a defect (criterion 8).
   * Branded (FE-1): a stray live claim here is a compile error, so every cell carries `NOT_LIVE`.
   */
  live: LiveClaim;
}

/** The closed eight-tuple, in `READ_STRIP_SLOTS` order — a ninth member is a compile error. */
export type ReadStripCells = [
  ReadStripCell,
  ReadStripCell,
  ReadStripCell,
  ReadStripCell,
  ReadStripCell,
  ReadStripCell,
  ReadStripCell,
  ReadStripCell,
];

export interface ReadStripInput {
  m: MarketState;
  offExchange: OffExchange | null | undefined;
  volOiThreshold: number;
  unusualCount: number;
  /** Opportunity tier word, computed in TickerDashboard via tierMeta (same source the old dealer
   *  positioning widget used). No accent-color prop — a FigureCell has none to take one. */
  tierWord: string;
  opportunityScore: number;
  ivRank: IvRankRead | null;
  /** Ticker fidelity repair, change 4 (F4) — `sig?.setups.length`, for the opportunity cell's own
   *  sub-caption; `null` when signals haven't loaded (never a fabricated 0 setups). */
  setupsCount: number | null;
}

const skewSign = (slope: number) => (slope >= 0 ? '+' : '−');

/**
 * The off-exchange cell's info text (criterion 27: "context only, no side" — never omitted). The
 * "Top levels" clause — byte-for-byte from the old dealer positioning widget (deleted at FE-8) —
 * appears only when there is
 * data to name; the closing sentence is present in BOTH arms, unconditionally.
 */
function offExchangeInfo(offExchange: OffExchange | null | undefined): string {
  if (offExchange?.ratio_pct == null) {
    return 'Side/intent unknown — context only, not a directional signal.';
  }
  const levels =
    offExchange.levels
      .slice(0, 3)
      .map((l) => `$${l.price} (${l.share_of_offex_pct}%)`)
      .join(', ') || '—';
  return (
    `Share of recent volume printed off-lit (dark pools/ATS + internalized retail). Top levels: ` +
    `${levels}. Side/intent unknown — context only, not a directional signal.`
  );
}

/** Standard quartile bucketing (0–24 / 25–49 / 50–74 / 75–100) — an unambiguous statistical
 *  convention, not a judgment call, for the IV-rank sub-caption's "Nth quartile" half. */
function quartileOrdinal(pct: number): string {
  if (pct < 25) return '1st';
  if (pct < 50) return '2nd';
  if (pct < 75) return '3rd';
  return '4th';
}

/** The standard English ordinal suffix (11th/12th/13th are the "teens" exception; otherwise 1→st,
 *  2→nd, 3→rd, else th) — for the percentile HALF of the sub-caption (the quartile half above uses
 *  its own small fixed table; this one is general since a percentile ranges 0–100). */
function ordinalSuffix(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs % 100 >= 11 && abs % 100 <= 13) return 'th';
  switch (abs % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function buildReadStrip(input: ReadStripInput): ReadStripCells {
  const {
    m,
    offExchange,
    volOiThreshold,
    unusualCount,
    tierWord,
    opportunityScore,
    ivRank,
    setupsCount,
  } = input;

  return [
    {
      slot: 'opportunity',
      label: 'Opportunity',
      register: 'traced',
      value: `${opportunityScore} · ${tierWord}`,
      info:
        '0–100 triage score (proximity + IV/HV stretch + setups + flip transition + optional dark ' +
        'pool). Does not use vol-norm GEX or IV-rank — those stay advisory. Not a trade signal.' +
        OPPORTUNITY_TIER_INFO,
      sub:
        setupsCount == null
          ? NO_SUB
          : setupsCount === 0
            ? 'no setups'
            : `${setupsCount} setup${setupsCount === 1 ? '' : 's'}`,
      live: NOT_LIVE,
    },
    {
      slot: 'netDex',
      label: 'Net DEX',
      register: 'traced',
      value: m.net_dex == null ? 'unavailable' : fmtUsdCompact(m.net_dex),
      info: netDexTip(m.call_dex, m.put_dex),
      // A generic tagline naming WHAT the metric is (not a data-dependent claim) — safe even when
      // `value` itself is unavailable.
      sub: 'delta hedging pressure',
      live: NOT_LIVE,
    },
    {
      slot: 'ivHv',
      label: 'IV / HV',
      register: 'traced',
      value: m.iv_hv_ratio.toFixed(2),
      info:
        'Implied volatility ÷ recent realized volatility. >1 = options look expensive (favor ' +
        'selling); <1 = cheap (favor buying).',
      // Derived from the SAME ratio the value renders (the info tooltip's own >1/<1 rule).
      sub:
        m.iv_hv_ratio > 1
          ? 'options look expensive'
          : m.iv_hv_ratio < 1
            ? 'options look cheap'
            : 'options fairly priced',
      live: NOT_LIVE,
    },
    {
      slot: 'ivRank',
      label: 'IV rank',
      register: 'traced',
      value: ivRankStripFigure(ivRank),
      info: IVR_INFO,
      // The SAME `percentile` the full IV-rank widget's own descriptor uses (`ivrPctDescriptor`),
      // compressed to the design's "Nth quartile · Mth pct" shape rather than that widget's full
      // sentence (too long for a strip cell).
      sub:
        ivRank?.percentile == null
          ? NO_SUB
          : `${quartileOrdinal(ivRank.percentile)} quartile · ${ivRank.percentile}${ordinalSuffix(ivRank.percentile)} pct`,
      live: NOT_LIVE,
    },
    {
      slot: 'volOi',
      label: 'Vol/OI',
      register: 'traced',
      value: m.chain_vol_oi_ratio == null ? 'unavailable' : `${m.chain_vol_oi_ratio.toFixed(2)}×`,
      info: volOiTip(volOiThreshold, unusualCount),
      // The SAME `unusualCount` the ⓘ tooltip already states in full sentence form.
      sub:
        unusualCount > 0
          ? `${unusualCount} unusual strike${unusualCount === 1 ? '' : 's'}`
          : NO_SUB,
      live: NOT_LIVE,
    },
    {
      slot: 'ivSkew',
      label: 'IV skew',
      register: 'traced',
      value:
        m.iv_skew == null
          ? 'unavailable'
          : `${skewSign(m.iv_skew.slope)}${Math.abs(m.iv_skew.slope).toFixed(1)} pts · ${skewState(m.iv_skew.slope)}`,
      info: m.iv_skew == null ? 'IV skew unavailable this cycle.' : skewTip(m.iv_skew),
      // The SAME closed phrase table `skewTip` spends inline, factored out so both share one copy.
      sub: m.iv_skew == null ? NO_SUB : SKEW_PHRASE[skewState(m.iv_skew.slope)],
      live: NOT_LIVE,
    },
    {
      slot: 'termStructure',
      // Criterion 60: keeps the shipped THREE-way render — absent object / thin-points object /
      // the wire's own state label. Not a second not-a-number vocabulary (SPEC §2.4): the two
      // absences here ARE distinguishable, unlike off-exchange's single-object omission.
      label: 'Term structure',
      register: 'traced',
      value:
        m.term_structure == null
          ? 'unavailable'
          : m.term_structure.points.length < 2
            ? '—'
            : m.term_structure.state,
      info:
        m.term_structure == null
          ? 'Term structure unavailable this cycle.'
          : termTip(m.term_structure),
      // The SAME near/far tenor pair `termTip` already names, in the design's compact
      // "{near}d {iv} → {far}d {iv}" shape.
      sub:
        m.term_structure == null || m.term_structure.points.length < 2
          ? NO_SUB
          : `${m.term_structure.points[0]?.dte}d ${m.term_structure.near_iv.toFixed(1)} → ` +
            `${m.term_structure.points[m.term_structure.points.length - 1]?.dte}d ${m.term_structure.far_iv.toFixed(1)}`,
      live: NOT_LIVE,
    },
    {
      slot: 'offExchange',
      // Criterion 26: the empty slot renders `not provided` (never `unavailable`) — it collapses
      // BOTH the disabled-source case (`INCLUDE_DARK_POOL=false`) and the failed-computation case,
      // which the frontend cannot distinguish (`PROJECT_CONTEXT.md` §5, an empty `apps/api` diff).
      label: 'Off-exchange %',
      // A generic tagline (the SAME "context only, no side" the widget's own subtitle/info already
      // says in full elsewhere) — not a data-dependent claim, so it holds even when `value` is
      // `not provided`.
      sub: 'context only, no side',
      register: 'traced',
      value: offExchange?.ratio_pct != null ? `${offExchange.ratio_pct}%` : NOT_PROVIDED,
      info: offExchangeInfo(offExchange),
      live: NOT_LIVE,
    },
  ];
}
