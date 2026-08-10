/**
 * Built-in persona presets (read-only). Names + framing copy are verbatim from UX_BLUEPRINT §B and
 * the §A1 disposition map. Default (no persona) is first-class and renders today's prompt verbatim.
 */
import type { PersonaDefinition } from '@convexa/api';

export const PRESETS: PersonaDefinition[] = [
  {
    id: 'default',
    name: 'Default (no persona)',
    builtin: true,
    version: 1,
    objective: 'directional_swing',
    risk: 'moderate',
    reassessment_lean: '',
    emphasis_note: null,
    dte_pref: null,
    summary: 'Today’s standard one-size briefing (unchanged).',
  },
  {
    id: 'income_keeper',
    name: 'Income Keeper',
    builtin: true,
    version: 1,
    objective: 'income',
    risk: 'conservative',
    summary: 'Defined-risk premium selling; protect capital.',
    objective_framing:
      'Frame setups for high-probability, defined-risk premium selling and theta capture; prefer credit structures over directional debit ideas.',
    risk_calibration: 'Smaller size, tighter invalidation; skeptical of adding.',
    reassessment_lean:
      'Manage winners — Trim into strength, Roll for credit when tested, Exit on breach; treat Add skeptically.',
    emphasis_note: null,
    dte_pref: { min_dte: 20, max_dte: 45 },
  },
  {
    id: 'premium_hunter',
    name: 'Premium Hunter',
    builtin: true,
    version: 1,
    objective: 'income',
    risk: 'aggressive',
    summary: 'Sells closer/larger premium within defined risk.',
    objective_framing:
      'Frame toward active premium selling — closer-to-the-money or larger credit within defined risk, more frequent.',
    risk_calibration: 'Larger (still capped) sizing; accepts higher variance within defined risk.',
    reassessment_lean: 'More open to Roll/Add within the cap; still risk-first.',
    emphasis_note: null,
    dte_pref: { min_dte: 7, max_dte: 30 },
  },
  {
    id: 'steady_swinger',
    name: 'Steady Swinger',
    builtin: true,
    version: 1,
    objective: 'directional_swing',
    risk: 'conservative',
    summary: 'High-confidence directional only, small size.',
    objective_framing:
      'Frame only high-confidence directional swings; require a clean edge; pass readily.',
    risk_calibration: 'Small size, tight invalidation.',
    reassessment_lean: 'Lean Exit/Trim on adverse moves; Hold only high-confidence; rarely Add.',
    emphasis_note: null,
    dte_pref: { min_dte: 14, max_dte: 45 },
  },
  {
    id: 'balanced_swinger',
    name: 'Balanced Swinger',
    builtin: true,
    version: 1,
    objective: 'directional_swing',
    risk: 'moderate',
    summary: 'Balanced directional (closest to today’s framing).',
    objective_framing: 'Frame balanced directional swings — the baseline directional read.',
    risk_calibration: 'Balanced sizing and invalidation.',
    reassessment_lean: 'Balanced (today’s reassessment baseline).',
    emphasis_note: null,
    dte_pref: { min_dte: 7, max_dte: 45 },
  },
  {
    id: 'momentum_rider',
    name: 'Momentum Rider',
    builtin: true,
    version: 1,
    objective: 'directional_swing',
    risk: 'aggressive',
    summary: 'Momentum in negative gamma, higher conviction.',
    objective_framing:
      'Frame toward momentum — buying premium in negative-gamma regimes, higher-conviction sizing; don’t fade strength.',
    risk_calibration: 'Higher-conviction (still capped) sizing.',
    reassessment_lean:
      'More open to Hold through vol and Add within the cap on a genuinely stronger edge.',
    emphasis_note: null,
    dte_pref: { min_dte: 7, max_dte: 30 },
  },
  {
    id: 'the_protector',
    name: 'The Protector',
    builtin: true,
    version: 1,
    objective: 'hedging',
    risk: 'conservative',
    summary: 'Downside protection; defined-cost hedges.',
    objective_framing:
      'Frame toward downside protection and defined-cost hedges; a capital-preservation lens, not directional speculation.',
    risk_calibration: 'Defined-cost, capital-preservation sizing.',
    reassessment_lean:
      'Judge protection efficacy; Hold/Roll the hedge; Exit when the covered risk is gone.',
    emphasis_note: null,
    dte_pref: { min_dte: 30, max_dte: 45 },
  },
];

// Generic per-risk calibration text used when a CUSTOM persona overrides the risk level (presets
// carry their own preset-specific text above).
export const GENERIC_RISK_CALIBRATION: Record<string, string> = {
  conservative: 'Smaller size, tighter invalidation; skeptical of adding.',
  moderate: 'Balanced sizing and invalidation.',
  aggressive: 'Larger (still capped) sizing; accepts higher variance within the fixed cap.',
};

export function presetById(id: string): PersonaDefinition | undefined {
  return PRESETS.find((p) => p.id === id);
}
