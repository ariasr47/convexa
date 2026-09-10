/**
 * `shared/figure` — the ONE figure decision, its two marks and its one face binding
 * (curvature-v2-surfaces SPEC §2.1). Consumers import from here: the scanner atoms, the positions
 * row cells, the Broker tab's cells, the two mono-run quiet-band widgets — and `FigureCell` itself,
 * which is now one caller of this module rather than its home.
 *
 * What is NOT here, on purpose: the card chrome, the label row, the help host and the 20/17/15
 * ladder. Those stay `FigureCell`'s (§2.1 — "the chrome does not travel; the ladder does not
 * travel").
 */
export { MONO_FACE, SANS_FACE, UNTRACED_RULE, faceFor } from './figureFace';
export { LiveDot, PauseMark } from './FigureMarks';
export {
  figureStateOf,
  type FigureRegister,
  type FigureStateInput,
  type FigureStateName,
  type FigureStateOutput,
} from './figureState';
