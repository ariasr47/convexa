/**
 * BrokerPositionCard — the `<sm` collapse of `BrokerPositionRow` (the shipped mobile card-collapse
 * pattern, reused so 393px never overflows). Same projection, same two-axis rules, same absence
 * of every write affordance; only the layout stacks.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Box, Typography } from '@mui/material';
import {
  FactText,
  LegLines,
  ModeledPl,
  STALE_SNAPSHOT_SX,
  StructureChip,
  UnfaithfulEntry,
  type BrokerRowProps,
} from './BrokerPositionRow';

export function BrokerPositionCard({ view, streamOffline, isStale, asOf, actions }: BrokerRowProps) {
  const unfaithful = view.fidelity !== 'exact';
  return (
    <Box
      data-testid="broker-card"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        padding: '12px',
        mb: '10px',
        minWidth: 0,
      }}
    >
      {unfaithful ? (
        <Box sx={isStale ? STALE_SNAPSHOT_SX : undefined}>
          <UnfaithfulEntry view={view} />
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
