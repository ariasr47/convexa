/**
 * PositionBrief — product spine #5: a short “your open book on this ticker” strip.
 *
 * Sits BETWEEN Structure and Tape & plan on the ticker bento so the read is:
 * levels → my risk → tape / AI / orders. Not a second Positions page: one glance of
 * structure line + P/L with mark basis, sim-only, link to `/positions`.
 *
 * Rules:
 *  - 0 open → honest empty + optional sim-entry CTA
 *  - 1 open → structure + P/L + mark basis (never re-derives score)
 *  - 2+ open → count only (never pick one of N as “the” position — evalSubject ruling)
 *  - store faulted → refuse to invent empty/full
 *  - `[no-real-order-path]` — sim language only; CTA opens the shared sim dialog
 *  - green/red only on P/L direction
 */
import { MARK_BASIS_META } from '@/features/trading/model/mark';
import { money, pct } from '@/features/trading/positions/labels';
import type { PositionView } from '@/features/trading/positions/view';
import { extrasFor } from '@/shared/theme/tokens';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { BRIEF_COPY } from './copy';

export interface PositionBriefProps {
  ticker: string;
  /** Open sim positions on the focused ticker only (caller filters). */
  openViews: readonly PositionView[];
  /** Durable store faulted — never claim empty or full. */
  storeFaulted?: boolean;
  /** Empty-state CTA → shared sim entry dialog (not a real order). */
  onOpenTrade?: () => void;
  /** When true, hide the empty CTA (e.g. store faulted already refused entry). */
  entryBlocked?: boolean;
}

const stripSx = {
  gridColumn: '1 / -1' as const,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '10px',
  bgcolor: 'background.paper',
  px: 2,
  py: 1.25,
};

export function PositionBrief({
  ticker,
  openViews,
  storeFaulted = false,
  onOpenTrade,
  entryBlocked = false,
}: PositionBriefProps) {
  const symbol = ticker.toUpperCase();

  return (
    <Box
      component="section"
      data-testid="position-brief"
      data-count={openViews.length}
      data-faulted={storeFaulted ? 'true' : 'false'}
      aria-label={`Simulated book for ${symbol}`}
      sx={(theme) => ({
        ...stripSx,
        // Slight raise so the brief bridges structure → plan without competing with widgets.
        backgroundImage:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 70%)'
            : 'none',
        boxShadow:
          theme.palette.mode === 'dark'
            ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 1px 2px rgba(16,24,40,0.06)',
      })}
    >
      <Typography
        component="p"
        data-testid="position-brief-overline"
        sx={{
          m: 0,
          mb: 0.75,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {BRIEF_COPY.overline}
      </Typography>

      {storeFaulted ? (
        <Typography
          component="p"
          data-testid="position-brief-faulted"
          sx={{ m: 0, fontSize: '0.86rem', color: 'text.secondary' }}
        >
          {BRIEF_COPY.faulted}
        </Typography>
      ) : openViews.length === 0 ? (
        <EmptyBrief
          symbol={symbol}
          onOpenTrade={onOpenTrade}
          showCta={!!onOpenTrade && !entryBlocked}
        />
      ) : openViews.length === 1 ? (
        <SingleBrief view={openViews[0]} />
      ) : (
        <MultiBrief n={openViews.length} symbol={symbol} />
      )}
    </Box>
  );
}

function EmptyBrief({
  symbol,
  onOpenTrade,
  showCta,
}: {
  symbol: string;
  onOpenTrade?: () => void;
  showCta: boolean;
}) {
  return (
    <Box
      data-testid="position-brief-empty"
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.25,
      }}
    >
      <Typography component="p" sx={{ m: 0, fontSize: '0.88rem', color: 'text.secondary', flex: 1 }}>
        {BRIEF_COPY.empty(symbol)}
      </Typography>
      {showCta && (
        <Button
          size="small"
          variant="outlined"
          data-testid="position-brief-open-trade"
          onClick={onOpenTrade}
          sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}
        >
          {BRIEF_COPY.emptyCta}
        </Button>
      )}
      <BookLink />
    </Box>
  );
}

function MultiBrief({ n, symbol }: { n: number; symbol: string }) {
  return (
    <Box
      data-testid="position-brief-multi"
      sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}
    >
      <Typography component="p" sx={{ m: 0, fontSize: '0.88rem', color: 'text.primary', flex: 1 }}>
        {BRIEF_COPY.multi(n, symbol)}
      </Typography>
      <BookLink />
    </Box>
  );
}

function SingleBrief({ view }: { view: PositionView }) {
  const basisMeta = MARK_BASIS_META[view.mark.basis];
  const pl = view.pl_dollar;
  const plPct = view.pl_pct.kind === 'value' ? view.pl_pct.value : null;
  const dimmed = view.frozen || view.mark.basis === 'last_known';
  const plColor =
    pl == null || !Number.isFinite(pl)
      ? 'text.primary'
      : pl >= 0
        ? 'success.main'
        : 'error.main';

  return (
    <Box
      data-testid="position-brief-single"
      data-structure={view.structure}
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: { xs: 1, sm: 1.5 },
        opacity: dimmed ? 0.72 : 1,
      }}
    >
      <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
        <Typography
          component="p"
          data-testid="position-brief-structure"
          title={view.structure_line_full}
          sx={{
            m: 0,
            fontSize: '0.92rem',
            fontWeight: 600,
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {view.structure_line_collapsed || view.structure_label}
        </Typography>
        <Typography
          component="p"
          data-testid="position-brief-structure-kind"
          sx={{ m: 0, mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}
        >
          {view.structure_label}
          {view.qty_text ? ` · ${view.qty_text}` : ''}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 1,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {pl == null || view.unavailable ? (
          <Typography
            component="span"
            data-testid="position-brief-pl"
            sx={{ fontSize: '0.86rem', color: 'text.disabled' }}
          >
            {BRIEF_COPY.plUnavailable}
          </Typography>
        ) : (
          <>
            <Typography
              component="span"
              data-testid="position-brief-pl"
              sx={{ fontSize: '1rem', fontWeight: 700, color: plColor }}
            >
              {money(pl)}
            </Typography>
            {plPct != null && (
              <Typography
                component="span"
                data-testid="position-brief-pl-pct"
                sx={{ fontSize: '0.82rem', fontWeight: 600, color: plColor }}
              >
                {pct(plPct)}
              </Typography>
            )}
          </>
        )}
      </Box>

      <Tooltip arrow title={basisMeta.tip}>
        <Box
          component="span"
          data-testid="position-brief-basis"
          data-basis={view.mark.basis}
          sx={(theme) => ({
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'text.secondary',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '6px',
            px: 0.75,
            py: 0.25,
            bgcolor: extrasFor(theme).panelRaised,
            whiteSpace: 'nowrap',
            cursor: 'help',
          })}
        >
          {view.frozen || view.mark.basis === 'last_known' ? '⏸ ' : ''}
          {basisMeta.label}
        </Box>
      </Tooltip>

      <Tooltip arrow title={BRIEF_COPY.simulatedTip}>
        <Box
          component="span"
          data-testid="position-brief-sim"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          Simulated
        </Box>
      </Tooltip>

      <BookLink />
    </Box>
  );
}

function BookLink() {
  return (
    <Box
      component={RouterLink}
      to="/positions"
      data-testid="position-brief-open-book"
      sx={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: 'primary.main',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.5,
        borderRadius: '4px',
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      {BRIEF_COPY.openBook} →
    </Box>
  );
}

export default PositionBrief;
