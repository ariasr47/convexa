/**
 * Lab demos — public instruments that may graduate onto the ticker board.
 * Keep synthetic-first (no auth). Honesty: demos never claim live gamma.
 */

export interface LabDemo {
  id: string;
  title: string;
  tagline: string;
  /** Which ticker surface this could replace or augment. */
  tickerCandidate: string;
  path: string;
  status: 'lab' | 'shipped';
  /** What its live form would show, for the Not live card on a live build (no mocks there). */
  would: string;
  /** The metric it draws, which heads its Not live panel (a frame names its metric, P-10). */
  metric: string;
}

export const LAB_DEMOS: LabDemo[] = [
  {
    id: 'structure-field',
    title: 'Structure Field',
    tagline: 'Net dealer gamma by strike as a field: walls, the flip, the mid and a probe.',
    tickerCandidate: 'GEX strike profile (shipped)',
    path: '/lab/structure-field',
    metric: 'Net dealer gamma by strike',
    would: 'net dealer gamma by strike, with the walls, the flip and the mid you can probe.',
    status: 'shipped',
  },
  {
    id: 'tape-pulse',
    title: 'Tape Pulse',
    tagline: 'The mid’s recent trail and the last prints, on a strip with two clocks.',
    tickerCandidate: 'Live tape / Command Deck mid',
    path: '/lab/tape-pulse',
    metric: 'The mid and the last prints',
    would: 'the mid’s trail and the last prints as they arrive.',
    status: 'lab',
  },
  {
    id: 'wall-magnet',
    title: 'Wall Magnet',
    tagline: 'The mid between the put and call walls, with the flip as the polarity line.',
    tickerCandidate: 'Dealer positioning levels',
    path: '/lab/wall-magnet',
    metric: 'Where the mid sits between the walls',
    would: 'where the mid sits between the walls, and which way hedging pulls it.',
    status: 'lab',
  },
  {
    id: 'term-heat',
    title: 'Term Heat',
    tagline: 'Implied volatility across tenors as a single ordinal ribbon.',
    tickerCandidate: 'Term structure card',
    path: '/lab/term-heat',
    metric: 'At-the-money implied vol by tenor',
    would: 'implied volatility by tenor, and whether the curve is in contango.',
    status: 'lab',
  },
  {
    id: 'flow-ribbons',
    title: 'Flow Ribbons',
    tagline: 'Charm and vanna flow projected to the next expiry.',
    tickerCandidate: 'Dealer flow projection',
    path: '/lab/flow-ribbons',
    metric: 'Projected dealer delta flow to the next expiry',
    would: 'the dealer flow charm and vanna imply into the next expiry.',
    status: 'lab',
  },
];
