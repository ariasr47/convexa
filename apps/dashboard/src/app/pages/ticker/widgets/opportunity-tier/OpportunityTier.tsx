/**
 * Opportunity escalation ladder — the Ticker page's tier CHROME: the emphasis colour for the
 * Opportunity tile and the Prime setup banner. Relocated out of the trading kernel (F17), which
 * narrows to the decision/mark vocabulary and holds no React widget. Tiers are server-emitted (signals.opportunity_tier); emphasis is non-directional
 * (info → warning, never green/red) — this is a read, not advice. The trade it offers is simulated.
 */
import type { OpportunityTier } from '@convexa/api';
import BoltIcon from '@mui/icons-material/Bolt';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { alpha, Theme } from '@mui/material/styles';
// The tier WORD map stays in the trading KERNEL: `outcomes/ledger.ts` reads the same closed lookup,
// and `features/ -> pages/` would invert the downward-only dependency direction (SPEC §2.7).
import { WORD } from '@/features/trading/model/tier';
import { extrasFor } from '@/shared/theme/tokens';
import { Refused } from '@/shared/ui/Refused';

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
  /** When false, show Refused instead of a live-looking Simulate CTA (signed-out honesty). */
  allowed = true,
  onSignIn,
}: {
  onSimulate: () => void;
  onDismiss: () => void;
  allowed?: boolean;
  onSignIn?: () => void;
}) {
  return (
    <Box sx={{ mb: 2 }} data-testid="prime-banner">
      {/* Stage-1 rebind (§3.3-3): the Prime banner is a BRAND moment, not a warning — its
          coloring re-binds to amber via sx while the ⚡ icon stays. The `severity` prop remains
          for a11y role/structure only; every color it would paint is overridden. Stage-3 §4.2:
          the BODY TEXT binds the text-grade `textAmber` (light-mode contrast gate §5.2);
          tint/border/icon stay `primary` (UI class). */}
      <Alert
        icon={<BoltIcon fontSize="inherit" />}
        severity="warning"
        sx={(theme) => ({
          color: extrasFor(theme).textAmber,
          backgroundColor: alpha(theme.palette.primary.main, 0.12),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
          '& .MuiAlert-icon': { color: theme.palette.primary.main },
        })}
        action={
          allowed ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={onSimulate}
                data-testid="prime-banner-simulate"
              >
                Simulate this trade →
              </Button>
              <IconButton aria-label="dismiss" size="small" color="inherit" onClick={onDismiss}>
                <CloseIcon fontSize="inherit" />
              </IconButton>
            </Box>
          ) : (
            <IconButton aria-label="dismiss" size="small" color="inherit" onClick={onDismiss}>
              <CloseIcon fontSize="inherit" />
            </IconButton>
          )
        }
      >
        ⚡ Prime setup — the strongest edge Convexa sees right now.
      </Alert>
      {!allowed ? (
        <Box sx={{ mt: 1 }}>
          <Refused
            actionLabel="Simulate this trade"
            reason="Sign in to open a paper position. No real order is ever sent."
            onSignIn={onSignIn}
            onDismiss={onDismiss}
            testId="prime-banner-refused"
          />
        </Box>
      ) : null}
    </Box>
  );
}
