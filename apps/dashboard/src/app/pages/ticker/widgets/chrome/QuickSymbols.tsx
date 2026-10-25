/**
 * QuickSymbols — quiet chip row under the Command Deck control strip (recent-ticker-chips).
 *
 * Layout (owner-approved wireframe): micro-label QUICK + pins (always) + optional recents.
 * Selected = current **route** symbol. Theme tokens only — no hex, no P/L green/red.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { listRecents, PINNED_TICKERS } from '../../recentTickers/store';

const MONO = typographyTokens.monoFontFamily;

export interface QuickSymbolsProps {
  /** Route symbol (not the uncommitted input). Compared case-insensitively. */
  currentSymbol: string;
  onSelect: (symbol: string) => void;
  /** Ticker fidelity repair, change 3 (F3) — the row's trailing `Universe member · N tracked names`
   *  note (`design/src/screens/desk.mjs:285`'s `quick-note`), pre-formatted by the caller
   *  (`useUniverseMembership`'s `size`); omitted for a nonmember/unknown symbol or before the read
   *  resolves — never a fabricated count. */
  note?: string | null;
}

export function QuickSymbols({ currentSymbol, onSelect, note }: QuickSymbolsProps) {
  const current = currentSymbol.trim().toUpperCase();
  const recents = listRecents();
  const pins = [...PINNED_TICKERS];

  return (
    <Box
      data-testid="quick-symbols"
      sx={(t) => ({
        display: 'flex',
        // A phone's chips are 44px (the coarse touch floor): the label centres on them.
        alignItems: { xs: 'center', sm: 'flex-start' },
        gap: 1.25,
        // On a phone the row follows the full-width controls with no rule, as the board's phone
        // desk (fidelity DESK-06); from `sm` the hairline still divides it from the masthead.
        pt: { xs: 0, sm: 1.25 },
        mt: 0.25,
        borderTop: { xs: 'none', sm: `1px solid ${t.palette.divider}` },
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
          pt: { xs: 0, sm: 0.75 },
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
          flexWrap: { xs: 'nowrap', sm: 'wrap' },
          minWidth: 0,
          rowGap: 0.75,
          // A phone keeps the symbols on one row that scrolls sideways, as the board's phone desk
          // (`.hd-syms`: `overflow-x: auto`, no scrollbar; fidelity DESK-06): two wrapped rows of
          // 44px chips pushed Structure 133px down the first screen. The 4px pad (taken back by the
          // negative margin) keeps a chip's focus ring inside the scroll box.
          overflowX: { xs: 'auto', sm: 'visible' },
          p: { xs: '4px', sm: 0 },
          m: { xs: '-4px', sm: 0 },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
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
              width: '1px',
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

      {note && (
        <Typography
          component="span"
          variant="caption"
          data-testid="quick-symbols-note"
          sx={{
            color: 'text.secondary',
            ml: 'auto',
            pt: 0.75,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {note}
        </Typography>
      )}
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
        flex: '0 0 auto',
        m: 0,
        px: 1.25,
        py: 0.5,
        borderRadius: '999px',
        // Canon P-6 (owner ruling 2026-10-13): the current symbol is marked by outline and weight,
        // not amber, so amber stays spent on the one primary action, the active nav and the focus
        // ring. (The amber selected label also measured 2.63:1 in light mode.)
        border: `1px solid ${selected ? t.palette.text.primary : t.palette.divider}`,
        boxShadow: selected ? `inset 0 0 0 1px ${t.palette.text.primary}` : 'none',
        bgcolor: 'transparent',
        color: t.palette.text.primary,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: selected ? 700 : 500,
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
