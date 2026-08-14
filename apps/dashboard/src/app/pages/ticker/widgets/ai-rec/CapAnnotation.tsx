/**
 * CapAnnotation — the cap-check surface (SPEC §4/§2.5, AC-56/57/58/58a/59/60/63). Renders by CLOSED
 * LOOKUP on `cap_check.verdict` via `capSurface` — never by testing a null. On `not_applicable`
 * (the `no_trade` branch), the HOST never even mounts this component (AC-58a); this file's own
 * `none` branch is the second line of defence.
 *
 * `warning.*` + icon only — never brand amber, never a success/error slot (AC-60): even `within`
 * renders through the SAME warning treatment, because green/red stay reserved for signed direction
 * and Convexa never frames "the AI stayed inside your number" as a win.
 */
import type { CapCheck } from '@convexa/api';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Stack, Typography } from '@mui/material';
import { NOT_SET } from './copy';
import { capRefusalLine, capSurface } from './literals';

export function CapAnnotation({ capCheck }: { capCheck: CapCheck | undefined | null }) {
  const surface = capSurface(capCheck?.verdict);

  if (surface.kind === 'none') return null;

  if (surface.kind === 'no_cap') {
    return (
      <Typography
        variant="caption"
        data-testid="cap-annotation"
        sx={{ color: 'text.secondary', display: 'block' }}
      >
        {`Cap: ${NOT_SET}`}
      </Typography>
    );
  }

  if (surface.kind === 'not_checkable') {
    return (
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: 'flex-start', color: 'warning.main', flexWrap: 'wrap', rowGap: 0.5 }}
        data-testid="cap-annotation"
      >
        <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} />
        <Typography variant="caption" sx={{ color: 'warning.main' }}>
          {capRefusalLine(capCheck?.verdict, capCheck?.risk_refusal)}
        </Typography>
      </Stack>
    );
  }

  // comparison — both `within` and `above` use the SAME warning+icon chrome (AC-60).
  const dollars = capCheck?.parsed_risk_dollars;
  const cap = capCheck?.effective_dollar_cap;
  const verdictText = surface.within ? 'within your cap' : 'above your cap';
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: 'flex-start', color: 'warning.main', flexWrap: 'wrap', rowGap: 0.5 }}
      data-testid="cap-annotation"
      data-verdict={surface.within ? 'within' : 'above'}
    >
      <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} />
      <Typography variant="caption" sx={{ color: 'warning.main' }}>
        {`$${dollars} is ${verdictText} of $${cap}.`}
      </Typography>
    </Stack>
  );
}
