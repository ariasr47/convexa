/**
 * QuickSymbols — quiet chip row under the Command Deck control strip (recent-ticker-chips).
 *
 * Layout (owner-approved wireframe): micro-label QUICK + pins (always) + optional recents.
 * Selected = current **route** symbol. Theme tokens only — no hex, no P/L green/red.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { listRecents, PINNED_TICKERS } from '../../recentTickers/store';

const MONO = typographyTokens.monoFontFamily;

export interface QuickSymbolsProps {
  /** Route symbol (not the uncommitted input). Compared case-insensitively. */
  currentSymbol: string;
  onSelect: (symbol: string) => void;
}

export function QuickSymbols({ currentSymbol, onSelect }: QuickSymbolsProps) {
  const current = currentSymbol.trim().toUpperCase();
  const recents = listRecents();
  const pins = [...PINNED_TICKERS];

  return (
    <Box
      data-testid="quick-symbols"
      sx={(t) => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        pt: 1.25,
        mt: 0.25,
        borderTop: `1px solid ${t.palette.divider}`,
        minWidth: 0,
      })}
    >
      <Typography
        component="span"
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          pt: 0.75,
          flexShrink: 0,
        }}
      >
        QUICK
      </Typography>

      <Stack
        direction="row"
        useFlexGap
        spacing={0.75}
        sx={{
          flexWrap: 'wrap',
          minWidth: 0,
          // Narrow widths: wrap (wireframe). Horizontal scroll is acceptable if wrap is awkward —
          // prefer wrap first.
          rowGap: 0.75,
        }}
      >
        {pins.map((sym) => (
          <QuickChip
            key={`pin-${sym}`}
            symbol={sym}
            selected={sym === current}
            onSelect={onSelect}
          />
        ))}

        {recents.length > 0 && (
          <Box
            aria-hidden
            sx={(t) => ({
              alignSelf: 'center',
              width: 1,
              height: 16,
              bgcolor: t.palette.divider,
              mx: 0.25,
              flexShrink: 0,
            })}
          />
        )}

        {recents.map((sym) => (
          <QuickChip
            key={`recent-${sym}`}
            symbol={sym}
            selected={sym === current}
            onSelect={onSelect}
          />
        ))}
      </Stack>
    </Box>
  );
}

function QuickChip({
  symbol,
  selected,
  onSelect,
}: {
  symbol: string;
  selected: boolean;
  onSelect: (s: string) => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={symbol}
      onClick={() => onSelect(symbol)}
      sx={(t) => ({
        appearance: 'none',
        cursor: 'pointer',
        m: 0,
        px: 1.25,
        py: 0.5,
        borderRadius: '999px',
        border: `1px solid ${selected ? t.palette.primary.main : t.palette.divider}`,
        // Quiet selected surface via primary alpha — never success/error green/red.
        bgcolor: selected ? alpha(t.palette.primary.main, 0.14) : 'transparent',
        color: selected ? t.palette.primary.main : t.palette.text.primary,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        lineHeight: 1.2,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        '&:hover': selected
          ? undefined
          : {
              bgcolor: alpha(t.palette.action.selected, 0.5),
              borderColor: t.palette.text.secondary,
            },
      })}
    >
      {symbol}
    </Box>
  );
}

export default QuickSymbols;
