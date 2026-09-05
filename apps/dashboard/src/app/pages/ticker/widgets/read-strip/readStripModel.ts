/**
 * The read-strip model (SPEC §2.4, §4.1, §4.6; DESIGN_SYSTEM.md rule 15). EIGHT FIXED SLOTS, a
 * closed tuple type, so a ninth slot is a COMPILE ERROR — the architect's own R2 "7-or-8
 * cardinality" self-revision was withdrawn at R3: a variable-cardinality slot recreates
 * `[absent-is-not-none]` in the SCROLL axis (at 393px an absent cell and a cell scrolled off the
 * rail are indistinguishable), and fixed slots have a repair variable cardinality does not.
 *
 * Seven of the eight cells decompose BYTE-FOR-BYTE from `DealerPositioning.tsx`'s values and
 * tooltips (re-verify the exact line numbers fresh — they drift; this file was written reading
 * `DealerPositioning.tsx` at the time of this task). The eighth (`ivRank`) comes from
 * `iv-rank/IvRank.tsx`'s own `ivRankStripFigure` — a digest of the number that widget's own FULL
 * body (percentile, band, basis line, advisory footer) still renders separately, untouched, in the
 * quiet band (FE-11).
 *
 * That accounting is what makes deleting `DealerPositioning` reviewable (FE-8): the twelve shipped
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
  skewState,
  skewTip,
  termTip,
  volOiTip,
} from '../_kit/copy';
import { ivRankStripFigure } from '../iv-rank/IvRank';
import { OPPORTUNITY_TIER_INFO } from '../opportunity-tier';

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
  /** Opportunity tier word, computed in TickerDashboard via tierMeta (same source DealerPositioning
   *  used). No accent-color prop — a FigureCell has none to take one. */
  tierWord: string;
  opportunityScore: number;
  ivRank: IvRankRead | null;
}

const skewSign = (slope: number) => (slope >= 0 ? '+' : '−');

/**
 * The off-exchange cell's info text (criterion 27: "context only, no side" — never omitted). The
 * "Top levels" clause — byte-for-byte from `DealerPositioning.tsx` — appears only when there is
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

export function buildReadStrip(input: ReadStripInput): ReadStripCells {
  const { m, offExchange, volOiThreshold, unusualCount, tierWord, opportunityScore, ivRank } =
    input;

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
      live: NOT_LIVE,
    },
    {
      slot: 'netDex',
      label: 'Net DEX',
      register: 'traced',
      value: m.net_dex == null ? 'unavailable' : fmtUsdCompact(m.net_dex),
      info: netDexTip(m.call_dex, m.put_dex),
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
      live: NOT_LIVE,
    },
    {
      slot: 'ivRank',
      label: 'IV rank',
      register: 'traced',
      value: ivRankStripFigure(ivRank),
      info: IVR_INFO,
      live: NOT_LIVE,
    },
    {
      slot: 'volOi',
      label: 'Vol/OI',
      register: 'traced',
      value: m.chain_vol_oi_ratio == null ? 'unavailable' : `${m.chain_vol_oi_ratio.toFixed(2)}×`,
      info: volOiTip(volOiThreshold, unusualCount),
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
      live: NOT_LIVE,
    },
    {
      slot: 'offExchange',
      // Criterion 26: the empty slot renders `not provided` (never `unavailable`) — it collapses
      // BOTH the disabled-source case (`INCLUDE_DARK_POOL=false`) and the failed-computation case,
      // which the frontend cannot distinguish (`PROJECT_CONTEXT.md` §5, an empty `apps/api` diff).
      label: 'Off-exchange %',
      register: 'traced',
      value: offExchange?.ratio_pct != null ? `${offExchange.ratio_pct}%` : NOT_PROVIDED,
      info: offExchangeInfo(offExchange),
      live: NOT_LIVE,
    },
  ];
}
