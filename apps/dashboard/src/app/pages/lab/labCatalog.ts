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
}

export const LAB_DEMOS: LabDemo[] = [
  {
    id: 'structure-field',
    title: 'Structure Field',
    tagline: 'Dual-clock dealer net-GEX field — walls, flip, tape mid, probe.',
    tickerCandidate: 'GEX strike profile (shipped)',
    path: '/lab/structure-field',
    status: 'shipped',
  },
  {
    id: 'tape-pulse',
    title: 'Tape Pulse',
    tagline: 'Mid trail + last-print flashes on a dual-clock tape strip.',
    tickerCandidate: 'Live tape / Command Deck mid',
    path: '/lab/tape-pulse',
    status: 'lab',
  },
  {
    id: 'wall-magnet',
    title: 'Wall Magnet',
    tagline: 'Spot pulled between put/call walls with flip as the polarity line.',
    tickerCandidate: 'Dealer positioning levels',
    path: '/lab/wall-magnet',
    status: 'lab',
  },
  {
    id: 'term-heat',
    title: 'Term Heat',
    tagline: 'Cross-tenor vol as a glowing heat ribbon (contango / back).',
    tickerCandidate: 'Term structure card',
    path: '/lab/term-heat',
    status: 'lab',
  },
  {
    id: 'flow-ribbons',
    title: 'Flow Ribbons',
    tagline: 'Charm + vanna projected flow as layered streaming ribbons.',
    tickerCandidate: 'Dealer flow projection',
    path: '/lab/flow-ribbons',
    status: 'lab',
  },
];
