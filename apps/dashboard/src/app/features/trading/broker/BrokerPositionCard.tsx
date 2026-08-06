/**
 * BrokerPositionCard — the `<sm` collapse of `BrokerPositionRow` (the shipped mobile card-collapse
 * pattern, reused so 393px never overflows). Same projection, same two-axis rules, same absence
 * of every write affordance; only the layout stacks.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Box, Typography } from '@mui/material';
import {
  FactText,
  FidelityNotes,
  LegLines,
  ModeledPl,
  STALE_SNAPSHOT_SX,
  StructureChip,
  UnfaithfulEntry,
  type BrokerRowProps,
} from './BrokerPositionRow';

export function BrokerPositionCard({
  view,
  streamOffline,
  isStale,
  asOf,
  actions,
  nested,
  secondaryClause,
}: BrokerRowProps) {
  // G1 — the row's rule, verbatim: only `unrecognized` collapses to the bare entry.
  const unfaithful = view.fidelity === 'unrecognized';
  return (
    <Box
      data-testid="broker-card"
      sx={{
        border: nested ? 'none' : '1px solid',
        borderColor: 'divider',
        borderRadius: nested ? 0 : '10px',
        padding: nested ? '8px 0' : '12px',
        mb: nested ? '4px' : '10px',
        minWidth: 0,
      }}
    >
      {unfaithful ? (
        // F10 — parity repair. Desktop's `BrokerPositionRow` renders `<ModeledPl>` OUTSIDE the
        // `unfaithful` branch (the P/L block sits in the right rail regardless of fidelity); this
        // card omitted the slot entirely, which `[absent-is-not-none]` forbids — the mobile reader
        // could not tell "no answer" from "nothing to say". Side-by-side, matching the row's layout.
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <Box sx={{ minWidth: 0, ...(isStale ? STALE_SNAPSHOT_SX : {}) }}>
            <UnfaithfulEntry view={view} />
          </Box>
          <ModeledPl view={view} streamOffline={streamOffline} asOf={asOf} />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <Box sx={{ minWidth: 0, ...(isStale ? STALE_SNAPSHOT_SX : {}) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  {view.ticker}
                </Typography>
                <StructureChip view={view} />
              </Box>
              <Typography
                component="div"
                sx={{
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  fontFamily: typographyTokens.monoFontFamily,
                  fontVariantNumeric: 'tabular-nums',
                  mt: '2px',
                  overflowWrap: 'anywhere',
                }}
              >
                {view.structure_line_collapsed}
              </Typography>
              {secondaryClause != null && <Box sx={{ mt: '4px' }}>{secondaryClause}</Box>}
            </Box>
            <ModeledPl view={view} streamOffline={streamOffline} asOf={asOf} />
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: '18px',
              mt: '8px',
              flexWrap: 'wrap',
              ...(isStale ? STALE_SNAPSHOT_SX : {}),
            }}
          >
            <Meta label="Qty" testid="broker-qty">
              {view.qty_text}
            </Meta>
            <Meta label="Net entry" testid="broker-net-entry">
              <FactText text={view.net_entry_text} />
            </Meta>
          </Box>

          <Box sx={isStale ? STALE_SNAPSHOT_SX : undefined}>
            <LegLines view={view} />
            {/* `partial`: the full card above, plus every omission named underneath it. */}
            <FidelityNotes notes={view.fidelity_notes} />
          </Box>
        </>
      )}
      {actions != null && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: '8px' }}>{actions}</Box>
      )}
    </Box>
  );
}

function Meta({
  label,
  testid,
  children,
}: {
  label: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography component="div" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography
        component="div"
        data-testid={testid}
        sx={{
          fontFamily: typographyTokens.monoFontFamily,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.85rem',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}
