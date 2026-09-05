/**
 * `CommandPalette` — the ⌘K command palette (SPEC §2.6/§4.4). Built on the MUI `Dialog` already in
 * the tree (no new dependency) — the decider is accessibility, not bundle size: this repo owns a
 * measured patch (`shared/a11y/modalFocusHandoff.ts`) wrapping `ModalManager.prototype.add/remove`
 * so `aria-hidden` never lands on a focused subtree, paired with theme-level
 * `MuiModal.defaultProps.disableRestoreFocus` — installed once at `main.tsx`. A non-MUI modal
 * routes around both halves. Escape and backdrop-click close through the Dialog's OWN `onClose`
 * (two different internal code paths, hence AC-26's own test arm) — this file hand-assembles only
 * what Dialog does NOT provide: the roving `aria-activedescendant` combobox pattern.
 *
 * Read-only in phase 1: no write binding, no recents (`convexa.recent-tickers.v1` already ships,
 * but promoting it here is a later phase's module-placement cost, not this phase's).
 */
import type { ScanRow } from '@convexa/api';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import InputBase from '@mui/material/InputBase';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PALETTE_COMMANDS, type PaletteCommand } from './commandTable';
import { isPlausibleTicker, matchSymbols, paletteScoreCell } from './format';
import { usePaletteScan } from './usePaletteScan';

type Item =
  | { kind: 'command'; command: PaletteCommand }
  | { kind: 'symbol'; row: ScanRow }
  | { kind: 'open-anyway'; symbol: string };

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const SKELETON_ROWS = 4;

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const scan = usePaletteScan(open);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [nowS, setNowS] = useState(() => Date.now() / 1000);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Reset local state on every OPEN (the dialog is not `keepMounted`, so this also happens for
  // free on unmount/remount — kept explicit for the case a future caller does keep it mounted).
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setNowS(Date.now() / 1000);
    }
  }, [open]);

  const symbolItems: ScanRow[] = useMemo(() => {
    if (scan.phase !== 'ready' || scan.unavailable) return [];
    return matchSymbols(scan.rows, query);
  }, [scan.phase, scan.unavailable, scan.rows, query]);

  const showOpenAnyway = isPlausibleTicker(query) && symbolItems.length === 0;
  // P4: the honest "we checked, there is nothing" claim — ONLY once the read has actually
  // resolved. During loading we do not yet know, so this line must not render (`[absent-is-not-none]`).
  const showNoResultsLine =
    scan.phase === 'ready' && !scan.unavailable && query.trim() !== '' && symbolItems.length === 0;

  const items: Item[] = useMemo(() => {
    const commandItems: Item[] = PALETTE_COMMANDS.map((command) => ({ kind: 'command', command }));
    const rowItems: Item[] = symbolItems.map((row) => ({ kind: 'symbol', row }));
    const openAnywayItems: Item[] = showOpenAnyway
      ? [{ kind: 'open-anyway', symbol: query.trim().toUpperCase() }]
      : [];
    return [...commandItems, ...rowItems, ...openAnywayItems];
  }, [symbolItems, showOpenAnyway, query]);

  // P3 — "the first row is pre-selected" — reset on every filter change.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const clampedActive = Math.min(activeIndex, Math.max(items.length - 1, 0));
  const activeId = items.length > 0 ? `${listboxId}-option-${clampedActive}` : undefined;

  function activate(item: Item) {
    if (item.kind === 'command') navigate(item.command.to);
    else if (item.kind === 'symbol') navigate(`/ticker/${item.row.symbol}`);
    else navigate(`/ticker/${item.symbol}`);
    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[clampedActive];
      if (item) activate(item);
    }
    // Escape is intentionally NOT handled here — it bubbles to the Dialog's own `onClose` (AC-26's
    // "share no guaranteed implementation path" note: Escape and backdrop click are Dialog's, not
    // this handler's, so this file must not shadow either).
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      transitionDuration={{ enter: 160, exit: 120 }}
      data-testid="command-palette"
      aria-label="Jump to a ticker or a surface"
      slotProps={{
        paper: {
          // No local `borderRadius` here (a real, previously-latent defect found while fixing an
          // unrelated lint warning): the `sx` prop ALWAYS wins over a theme `styleOverrides` class
          // (that precedence is the whole point of `sx`), so a literal `borderRadius: 2` here would
          // have overridden — not deferred to — `theme.components.MuiDialog.styleOverrides.paper`'s
          // declared DIALOG role (16px, ruling 4), rendering this dialog at 2 × `shape.borderRadius`
          // (24px) instead. Omitting it lets the theme role apply, as every other Dialog in the app
          // already does.
          sx: {
            position: 'fixed',
            top: { xs: 16, sm: '12vh' },
            m: 0,
            maxHeight: '70vh',
          },
        },
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <InputBase
          inputRef={inputRef}
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a ticker…"
          data-testid="palette-input"
          inputProps={{
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': listboxId,
            'aria-activedescendant': activeId,
            'aria-autocomplete': 'list',
            'aria-label': 'Jump to a ticker or a surface',
          }}
          sx={{ fontSize: '1rem', px: 1, py: 0.5 }}
        />
      </Box>

      <Box
        component="ul"
        role="listbox"
        id={listboxId}
        data-testid="palette-listbox"
        sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto', maxHeight: '50vh' }}
      >
        {items.map((item, i) => {
          const id = `${listboxId}-option-${i}`;
          const selected = i === clampedActive;
          if (item.kind === 'command') {
            return (
              <PaletteRow
                key={id}
                id={id}
                selected={selected}
                onClick={() => activate(item)}
                testid={`palette-command-${item.command.id}`}
              >
                {item.command.label}
              </PaletteRow>
            );
          }
          if (item.kind === 'open-anyway') {
            return (
              <PaletteRow
                key={id}
                id={id}
                selected={selected}
                onClick={() => activate(item)}
                testid="palette-open-anyway"
              >
                Open {item.symbol} anyway →
              </PaletteRow>
            );
          }
          const cell = paletteScoreCell(item.row, scan.sweep, nowS);
          return (
            <PaletteRow
              key={id}
              id={id}
              selected={selected}
              onClick={() => activate(item)}
              testid={`palette-symbol-${item.row.symbol}`}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography component="span" sx={{ fontWeight: 700, minWidth: 56 }}>
                  {item.row.symbol}
                </Typography>
                <Typography component="span" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                  {cell.text}
                </Typography>
                {cell.freshness && (
                  <Typography
                    component="span"
                    data-testid={`palette-freshness-${item.row.symbol}`}
                    sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
                  >
                    {cell.freshness}
                  </Typography>
                )}
              </Box>
            </PaletteRow>
          );
        })}

        {/* P2a — the LOADING class: skeleton rows, present in the list (a positive observable),
            never a `0`, never a blank. Resolves once, never re-entered. */}
        {scan.phase === 'loading' &&
          Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Box
              component="li"
              key={`skeleton-${i}`}
              data-testid="palette-skeleton-row"
              sx={{ px: 2, py: 1 }}
            >
              <Skeleton variant="text" width="60%" />
            </Box>
          ))}

        {/* AC-30 — the ranked read is unavailable; the palette stays otherwise usable. */}
        {scan.phase === 'ready' && scan.unavailable && (
          <Box component="li" data-testid="palette-unavailable" sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ color: 'text.secondary' }}>
              Ranked results are unavailable right now.
            </Typography>
          </Box>
        )}

        {/* AC-31 — visibly distinct from AC-30's unavailable copy. */}
        {showNoResultsLine && (
          <Box component="li" data-testid="palette-empty" sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ color: 'text.secondary' }}>
              No tracked symbol matches &ldquo;{query.trim()}&rdquo;.
            </Typography>
          </Box>
        )}
      </Box>

      {/* AC-33b — advertises exactly these three; the negative arm (spec-level) is verified by
          the CommandPalette.spec.tsx `every advertised binding resolves to a performed action`. */}
      <Box
        data-testid="palette-footer"
        sx={{
          display: 'flex',
          gap: 2,
          px: 2,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          fontSize: 11,
          color: 'text.secondary',
        }}
      >
        <span>↑↓ move</span>
        <span>↵ open ticker</span>
        <span>esc close</span>
      </Box>
    </Dialog>
  );
}

function PaletteRow({
  id,
  selected,
  onClick,
  testid,
  children,
}: {
  id: string;
  selected: boolean;
  onClick: () => void;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="li"
      id={id}
      role="option"
      aria-selected={selected}
      data-testid={testid}
      onClick={onClick}
      // Mousedown (not click) so the input never loses focus before the click handler runs.
      onMouseDown={(e) => e.preventDefault()}
      sx={(t) => ({
        px: 2,
        py: 1,
        cursor: 'pointer',
        bgcolor: selected ? 'action.selected' : 'transparent',
        color: t.palette.text.primary,
        // Ruling 5 (curvature-v2-foundations, AC-34): `role="option"` is outside the theme's
        // coarse-pointer floor selector (`button, [role="button"], a` — `theme.ts:102`), which is
        // ruling 5's own named example of a control this phase creates that "silently escapes" the
        // mechanism. Explicit local floor, scoped to coarse pointers only (desktop density unchanged).
        '@media (pointer: coarse)': { minHeight: 44 },
      })}
    >
      {children}
    </Box>
  );
}

export default CommandPalette;
