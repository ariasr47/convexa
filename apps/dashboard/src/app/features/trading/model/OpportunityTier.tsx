/**
 * Opportunity escalation ladder: the tier word/emphasis for the Opportunity tile + the Prime
 * setup banner. Tiers are server-emitted (signals.opportunity_tier); emphasis is non-directional
 * (info → warning, never green/red) — this is a read, not advice. The trade it offers is simulated.
 */
import BoltIcon from '@mui/icons-material/Bolt';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Button, IconButton } from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import type { OpportunityTier } from '@org/api';

/** The tier word map — the SINGLE source of the tier display label. Exported so a second consumer
 *  (the outcome ledger's tier cells) reads the same closed lookup instead of re-deriving a tier from
 *  `opportunity_score`. Deliberately NOT `tierMeta`: that returns a palette colour, and a rate must
 *  never be tinted (outcome-ledger AC-14). */
export const WORD: Record<OpportunityTier, string> = {
  dormant: 'Dormant',
  watch: 'Watch',
  actionable: 'Actionable',
  prime: 'Prime',
};

/** Tier word + a non-directional emphasis color for the tile's left accent.
 *  Stage-1 rebind (§3.3-3): tier emphasis is an ACTIVE/brand state, not a warning —
 *  actionable/prime bind brand amber (`primary`), never the burnt-orange warning slot. */
export function tierMeta(theme: Theme, tier: OpportunityTier): { word: string; color: string } {
  switch (tier) {
    case 'watch':
      return { word: WORD.watch, color: theme.palette.info.main };
    case 'actionable':
      return { word: WORD.actionable, color: theme.palette.primary.main };
    case 'prime':
      return { word: WORD.prime, color: theme.palette.primary.dark };
    default:
      return { word: WORD.dormant, color: theme.palette.divider };
  }
}

export const OPPORTUNITY_TIER_INFO =
  ' Tier: Dormant → Watch → Actionable → Prime. Emphasis scales with the score; the sim-entry ' +
  'prompt unlocks only at Prime. Not a trade signal.';

export function PrimeBanner({
  onSimulate,
  onDismiss,
}: {
  onSimulate: () => void;
  onDismiss: () => void;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      {/* Stage-1 rebind (§3.3-3): the Prime banner is a BRAND moment, not a warning — its
          coloring re-binds to amber (`primary`) via sx while the ⚡ icon stays. The `severity`
          prop remains for a11y role/structure only; every color it would paint is overridden. */}
      <Alert
        icon={<BoltIcon fontSize="inherit" />}
        severity="warning"
        sx={(theme) => ({
          color: theme.palette.primary.main,
          backgroundColor: alpha(theme.palette.primary.main, 0.12),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
          '& .MuiAlert-icon': { color: theme.palette.primary.main },
        })}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button color="inherit" size="small" variant="outlined" onClick={onSimulate}>
              Simulate this trade →
            </Button>
            <IconButton aria-label="dismiss" size="small" color="inherit" onClick={onDismiss}>
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Box>
        }
      >
        ⚡ Prime setup — the strongest edge Convexa sees right now.
      </Alert>
    </Box>
  );
}
