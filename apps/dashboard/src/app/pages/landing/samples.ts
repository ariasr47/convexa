/**
 * The frozen sample values every landing composition reads (SPEC §2.2 item 2).
 * MODULE-LEVEL `as const` CONSTANTS ONLY: no function, no store, no props derived from a session
 * read. `/` reads NO session fact at all, so nothing here can vary per visitor.
 *
 * The numbers are the design source's own illustrative SPY structure
 * (`design/src/data/index.mjs:2-8`) and its net-GEX profile (`design/src/lib.mjs:238-246`,
 * regenerated at build time and pasted here). They are ILLUSTRATIVE: every panel that shows them
 * carries a sample mark, and `[live-vs-static-isolation]` bars any offline/pause/stale treatment —
 * those literals mean "we tried and failed", and a frozen sample never tried.
 */
import type { StructureFieldModel } from '@/shared/charts/structure-field';

export const LANDING_SAMPLE = {
  symbol: 'SPY',
  spot: 573.12,
  callWall: 580,
  putWall: 560,
  gammaFlip: 568.5,
  score: 72,
  tier: 'Actionable',
  ivHv: '0.82',
  volOi: '0.61×',
} as const;

/** 21 strikes × net GEX — `design/src/lib.mjs:238-246` at `SPY.strikes`, rounded as that source
 *  rounds. Frozen: poison one value and the sample-figure equality spec must move (§7 item 14). */
export const LANDING_FIELD_SAMPLES = [
  { strike: 550, netGex: -61 },
  { strike: 552.5, netGex: -123 },
  { strike: 555, netGex: -233 },
  { strike: 557.5, netGex: -357 },
  { strike: 560, netGex: -430 },
  { strike: 562.5, netGex: -367 },
  { strike: 565, netGex: -235 },
  { strike: 567.5, netGex: -103 },
  { strike: 570, netGex: 68 },
  { strike: 572.5, netGex: 158 },
  { strike: 575, netGex: 332 },
  { strike: 577.5, netGex: 488 },
  { strike: 580, netGex: 500 },
  { strike: 582.5, netGex: 394 },
  { strike: 585, netGex: 233 },
  { strike: 587.5, netGex: 112 },
  { strike: 590, netGex: 58 },
  { strike: 592.5, netGex: 43 },
  { strike: 595, netGex: 40 },
  { strike: 597.5, netGex: 40 },
  { strike: 600, netGex: 40 },
] as const;

/**
 * The model the shipped canvas receives. THE FLAGS ARE NECESSARY BUT NOT SUFFICIENT (SPEC §2.4):
 * `paintStep.ts:850-858` drifts a phosphor grain off `now` under `if (!reduced && !calm)` with no
 * `m.live` term in the gate, and `calm` is DERIVED from `variant === 'ticker'`, not a prop. The
 * mount's `variant='ticker'` is the single lever that kills the grain AND suppresses the canvas's
 * own title strip, tape pill, `demo as-of`, `synthetic demo` and `TAPE OFF` copy.
 */
export const LANDING_FIELD_MODEL: StructureFieldModel = {
  symbol: LANDING_SAMPLE.symbol,
  samples: [...LANDING_FIELD_SAMPLES],
  spot: LANDING_SAMPLE.spot,
  callWall: LANDING_SAMPLE.callWall,
  putWall: LANDING_SAMPLE.putWall,
  gammaFlip: LANDING_SAMPLE.gammaFlip,
  maxPain: null,
  asOfSec: null,
  liveMid: null,
  live: false,
  source: 'demo',
};

/** The ONE shared sample literal on `/` — the hero panel and the field panel carry the same words,
 *  so the page has one vocabulary for one claim, not two. */
export const SAMPLE_MARK = 'Illustrative sample — not a live read and not a recorded session.' as const;
/** The AI-read panel's own mark: a DIFFERENT withdrawal (no model run happened, as against no live
 *  read). Two sample literals on `/`, and only two. */
export const AI_SAMPLE_MARK = 'Illustrative sample — not a real model output.' as const;
