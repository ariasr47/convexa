import type { RecResponse } from '@convexa/api';

/**
 * Structural show/hide for the plan-scope caption (SPEC §2.2 / D1–D4).
 * Show when plan section mounts (decision === 'trade') AND card is not affirmative local_rules.
 * Does not read key_source or field content.
 */
export function shouldShowPlanFieldsNotChecked(rec: RecResponse): boolean {
  if (rec.strategy?.decision !== 'trade') return false;
  return rec.grounding?.card !== 'local_rules';
}
