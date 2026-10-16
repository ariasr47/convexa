/**
 * `/scanner` — the row preview (Final Scanner board: `design/src/screens/final/account-pages.mjs`
 * demoScanTable, and the states board's SCN-03 "Row preview, keyboard").
 *
 * A disclosure, not a dialog: the row's own fields read back under it, and the one way on to the
 * desk. It opens from the row's chevron button or from Enter on the focused row (hover never opens
 * it), and Escape closes it and returns focus to whichever of the two opened it, as the app's dialogs
 * return focus to their opener. Every figure here is the row's own wire field, formatted by the same
 * helpers the cells use; nothing is derived, and nothing here is an order or trade affordance
 * (`[no-real-order-path]`): the only control is a link to `/ticker/{SYMBOL}`.
 *
 * NEUTRAL throughout (ruling A): the chevron is `text.secondary`, the desk link is the outlined
 * (neutral secondary) button. The figures carry no hue; the flip distance says above/below in words.
 */
import { faceFor } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import type { ScanRow } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { KeyboardEvent, Ref } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { dash, EM_DASH, fmtPrice, fmtScore, fmtSignedPct } from './format';
import { SCAN_PREVIEW_COPY as C, tierLabel, whyThisRow } from './labels';

/** The preview row's id, the target of its button's `aria-controls`. */
export const previewIdFor = (symbol: string) => `scan-preview-${symbol}`;

/** "683.92 · price +0.97% above"; the level alone when the distance is unknown. */
export function flipLine(row: Pick<ScanRow, 'flip' | 'dist_to_flip_pct'>): string {
  const level = dash(row.flip, fmtPrice);
  const d = row.dist_to_flip_pct;
  if (level === EM_DASH || d == null || !Number.isFinite(d)) return level;
  return `${level} · ${C.flipDistance(fmtSignedPct(d), d >= 0)}`;
}

/** The disclosure chevron at the row's right edge: a real `<button aria-expanded aria-controls>`. */
export function PreviewToggle({
  symbol,
  open,
  onToggle,
  buttonRef,
}: {
  symbol: string;
  open: boolean;
  onToggle: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <Box
      component="button"
      type="button"
      ref={buttonRef}
      data-testid="scan-preview-toggle"
      aria-expanded={open}
      aria-controls={previewIdFor(symbol)}
      aria-label={open ? C.close(symbol) : C.open(symbol)}
      onClick={(e) => {
        // The row's own click would toggle a second time.
        e.stopPropagation();
        onToggle();
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 32,
        minHeight: 32,
        p: 0,
        border: '1px solid transparent',
        borderRadius: '8px',
        background: 'none',
        color: 'text.secondary',
        cursor: 'pointer',
        font: 'inherit',
        '&:hover': { color: 'text.primary', borderColor: 'divider' },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 16 16"
        aria-hidden
        sx={{
          width: 14,
          height: 14,
          display: 'block',
          transform: open ? 'rotate(180deg)' : 'none',
        }}
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Box>
    </Box>
  );
}

const capsSx = {
  fontSize: '0.6875rem', // the 11px label floor
  fontWeight: 600,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const;

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
      <Box component="span" sx={capsSx}>
        {label}
      </Box>
      <Box
        component="span"
        data-figure-register={mono ? 'mono' : 'sans'}
        sx={{
          ...faceFor(mono),
          fontSize: mono ? '0.82rem' : '0.8rem',
          color: mono ? 'text.primary' : 'text.secondary',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

/**
 * The preview row: ALWAYS rendered (hidden while closed) so the button's `aria-controls` resolves to
 * a real element, as `LegDisclosurePanel` does. `colSpan` spans the whole table.
 */
export function ScanRowPreview({
  row,
  open,
  colSpan,
  onKeyDown,
}: {
  row: ScanRow;
  open: boolean;
  colSpan: number;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const score = dash(row.score, fmtScore);
  const tier = tierLabel(row.tier) ?? EM_DASH;
  const walls = `${dash(row.call_wall, fmtPrice)} · ${dash(row.put_wall, fmtPrice)}`;
  return (
    <Box
      component="tr"
      id={previewIdFor(row.symbol)}
      hidden={!open}
      data-testid="scan-preview"
      data-symbol={row.symbol}
      onKeyDown={onKeyDown}
    >
      <Box
        component="td"
        colSpan={colSpan}
        sx={(t) => ({
          bgcolor: extrasFor(t).well,
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: '14px',
          py: '12px',
        })}
      >
        <Box
          role="group"
          aria-label={C.region(row.symbol)}
          sx={{
            // Zero intrinsic width, then the full cell: the spanning preview must not feed the
            // table's column sizing, or opening it re-balances the columns and wraps the walls.
            width: 0,
            minWidth: '100%',
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr)) auto',
            },
            gap: '12px 20px',
            alignItems: 'end',
          }}
        >
          <Field label={C.scoreTier} value={`${score} · ${tier}`} />
          <Field label={C.flip} value={flipLine(row)} />
          <Field label={C.walls} value={walls} />
          <Field label={C.why} value={whyThisRow(row)} mono={false} />
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Button
              component={RouterLink}
              to={`/ticker/${row.symbol}`}
              variant="outlined"
              size="small"
              data-testid="scan-preview-desk"
              sx={{ whiteSpace: 'nowrap' }}
            >
              {C.openDesk(row.symbol)}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
