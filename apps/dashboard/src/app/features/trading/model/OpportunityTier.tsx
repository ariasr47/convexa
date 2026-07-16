/**
 * Opportunity escalation ladder: the tier word/emphasis for the Opportunity tile + the Prime
 * setup banner. Tiers are server-emitted (signals.opportunity_tier); emphasis is non-directional
 * (info → warning, never green/red) — this is a read, not advice. The trade it offers is simulated.
 */
import BoltIcon from '@mui/icons-material/Bolt';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Button, IconButton } from '@mui/material';
import { Theme } from '@mui/material/styles';
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

/** Tier word + a non-directional emphasis color for the tile's left accent. */
export function tierMeta(theme: Theme, tier: OpportunityTier): { word: string; color: string } {
  switch (tier) {
    case 'watch':
      return { word: WORD.watch, color: theme.palette.info.main };
    case 'actionable':
      return { word: WORD.actionable, color: theme.palette.warning.main };
    case 'prime':
      return { word: WORD.prime, color: theme.palette.warning.dark };
    default:
      return { word: WORD.dormant, color: theme.palette.divider };
  }
}

export const OPPORTUNITY_TIER_INFO =
  ' Tier: Dormant → Watch → Actionable → Prime. Emphasis scales with the score; the sim-entry ' +
  'prompt unlocks only at Prime. Not a trade signal.';

export const PRIME_BANNER_TOOLTIP =
  'Appears only at the top opportunity tier when the setup is actionable, and only when it first ' +
  'reaches Prime — not while the score sits high. A read, not advice; the trade is simulated.';

export function PrimeBanner({
  onSimulate,
  onDismiss,
}: {
  onSimulate: () => void;
  onDismiss: () => void;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        icon={<BoltIcon fontSize="inherit" />}
        severity="warning"
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
