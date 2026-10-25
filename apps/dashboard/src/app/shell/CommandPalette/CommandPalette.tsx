/**
 * `CommandPalette` — the ⌘K jump-to box (SPEC §2.6/§4.4; design/src/screens/final/shell-site-kit.mjs
 * paletteF). Built on the MUI `Dialog` already in the tree — the decider is accessibility: this repo
 * owns a measured patch (`shared/a11y/modalFocusHandoff.ts`) wrapping `ModalManager` so
 * `aria-hidden` never lands on a focused subtree and focus returns to where it was on close. Escape
 * and backdrop-click close through the Dialog's OWN `onClose`; this file hand-assembles only the
 * roving `aria-activedescendant` combobox.
 *
 * Groups under one listbox, in this order: Go to (the five sections, with their `g` keys), Recent
 * (empty query only), Tickers, Research notes; then “Open X anyway” for a plausible symbol nothing
 * matched exactly. Recent is the tickers this browser opened last (`convexa.recent-tickers.v1`, the
 * key the Privacy page lists for this box; the demo's own key family on staging), read from
 * localStorage on each open — never a request.
 * Where the tickers and notes come from differs by build (usePaletteData): production lists tickers
 * A–Z and never calls the scan; staging ranks them by the demo's sample scan.
 *
 * Surface: the board's `.ss-pal` (design/src/screens/v4/shell-landing.mjs `.pal`), styled locally —
 * the one overlay that keeps a raised surface (fidelity audit 2026-10-25, OVL ruling): panelRaised,
 * a 1px lineStrong border, radius 14, e4, 620 wide, 132px from the top from 600px up. The input row
 * leads with the search glyph and ends with an `esc` key; rows sit 8px in from the edges with an
 * 8px radius, and the selected row carries a 1px inset ring on raised2 in dark (the board's `.opt`
 * fill) and on white in light (SITE-03b).
 */
import { listRecentVisits } from '@/pages/ticker/recentTickers/store';
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { elevationFor, extrasFor, typographyTokens } from '@/shared/theme/tokens';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import InputBase from '@mui/material/InputBase';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GO_TO } from '../shortcuts';
import { PALETTE_COMMANDS, type PaletteCommand } from './commandTable';
import { isPlausibleTicker, matchNotes, matchTickers, paletteScoreCell } from './format';
import { usePaletteData, type PaletteNote, type PaletteTicker } from './usePaletteData';

type Item =
  | { kind: 'command'; command: PaletteCommand }
  | { kind: 'recent'; symbol: string }
  | { kind: 'ticker'; ticker: PaletteTicker }
  | { kind: 'note'; note: PaletteNote }
  | { kind: 'open-anyway'; symbol: string };

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Opens the keyboard shortcuts sheet (the footer's “?”). */
  onOpenShortcuts?: () => void;
}

/**
 * Keyboard hints are for a keyboard: under a coarse pointer (a phone, or a touch tablet at any
 * width) the palette shows none of them (spec 2026-10-21/02, (d) Palette on a phone). Applied as the
 * LAST entry of an `sx` array, so it wins over a width rule on the same element.
 */
const HIDE_ON_COARSE = { '@media (pointer: coarse)': { display: 'none' } } as const;

const SKELETON_ROWS = 4;
/** How many recent tickers an empty query lists. */
const RECENT_ROWS = 5;
const KEY_OF: Record<string, string> = Object.fromEntries(
  Object.entries(GO_TO).map(([key, dest]) => [dest.to, key]),
);

const NOTE_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
function noteDate(date: string | null): string {
  if (!date) return 'Sample';
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : NOTE_DATE.format(d);
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        borderRadius: '4px',
        border: '1px solid',
        borderColor: 'divider',
        fontFamily: typographyTokens.monoFontFamily,
        fontSize: 11,
        lineHeight: 1.6,
        color: 'text.secondary',
      }}
    >
      {children}
    </Box>
  );
}

export function CommandPalette({ open, onClose, onOpenShortcuts }: CommandPaletteProps) {
  const navigate = useNavigate();
  const data = usePaletteData(open);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [nowS, setNowS] = useState(() => Date.now() / 1000);
  const [recents, setRecents] = useState<string[]>([]);
  const listboxId = useId();
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  // Reset local state on every OPEN.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setNowS(Date.now() / 1000);
      // The store never throws: unreadable or corrupt storage reads as no recents.
      setRecents(listRecentVisits(RECENT_ROWS));
    }
  }, [open]);

  const q = query.trim();
  const commands = useMemo(
    () =>
      q
        ? PALETTE_COMMANDS.filter((c) => c.label.toLowerCase().startsWith(q.toLowerCase()))
        : PALETTE_COMMANDS,
    [q],
  );
  const recentSymbols = useMemo(() => (q ? [] : recents), [q, recents]);
  const tickers = useMemo(
    () => (data.tickers.phase === 'ready' ? matchTickers(data.tickers.items, q) : []),
    [data.tickers, q],
  );
  const notes = useMemo(
    () => (data.notes.phase === 'ready' ? matchNotes(data.notes.items, q) : []),
    [data.notes, q],
  );
  // Never a dead end: a plausible symbol nothing lists can still be opened.
  const showOpenAnyway = isPlausibleTicker(q) && tickers.length === 0;
  // The “we checked, nothing matches” line only once both lists have ANSWERED (absent ≠ none). A
  // failed list was never searched, so it can't back the claim: the failed read says so on its own.
  const settled = data.tickers.phase === 'ready' && data.notes.phase === 'ready';
  const showNoMatch =
    settled && q !== '' && commands.length === 0 && tickers.length === 0 && notes.length === 0;

  const items: Item[] = useMemo(
    () => [
      ...commands.map((command): Item => ({ kind: 'command', command })),
      ...recentSymbols.map((symbol): Item => ({ kind: 'recent', symbol })),
      ...tickers.map((ticker): Item => ({ kind: 'ticker', ticker })),
      ...notes.map((note): Item => ({ kind: 'note', note })),
      ...(showOpenAnyway ? [{ kind: 'open-anyway', symbol: q.toUpperCase() } as Item] : []),
    ],
    [commands, recentSymbols, tickers, notes, showOpenAnyway, q],
  );

  // P3 — the first row is pre-selected, again on every filter change.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const clampedActive = Math.min(activeIndex, Math.max(items.length - 1, 0));
  const optionId = (i: number) => `${listboxId}-option-${i}`;
  const activeId = items.length > 0 ? optionId(clampedActive) : undefined;

  // Keep the active row in view as the arrows move through a long list.
  useEffect(() => {
    if (!activeId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  function activate(item: Item) {
    if (item.kind === 'command') navigate(item.command.to);
    else if (item.kind === 'ticker') navigate(`/ticker/${item.ticker.symbol}`);
    else if (item.kind === 'recent') navigate(`/ticker/${encodeURIComponent(item.symbol)}`);
    else if (item.kind === 'note') navigate(item.note.to);
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
    } else if (event.key === '?' && query === '' && onOpenShortcuts) {
      // The footer advertises “? all shortcuts”; no ticker or note search starts with “?”.
      event.preventDefault();
      onOpenShortcuts();
    }
    // Escape is intentionally NOT handled here — it bubbles to the Dialog's own `onClose`.
  }

  // Render rows with their flat index, so the groups share one roving selection.
  let index = -1;
  const row = (item: Item, testid: string, children: ReactNode) => {
    index += 1;
    const i = index;
    return (
      <PaletteRow
        key={optionId(i)}
        id={optionId(i)}
        selected={i === clampedActive}
        onClick={() => activate(item)}
        testid={testid}
      >
        {children}
      </PaletteRow>
    );
  };

  const commandRows = commands.map((command) =>
    row(
      { kind: 'command', command },
      `palette-command-${command.id}`,
      <>
        <Box component="span" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {command.label}
        </Box>
        {KEY_OF[command.to] && (
          <Box
            component="span"
            aria-hidden
            sx={[{ display: { xs: 'none', sm: 'inline-flex' }, gap: 0.5 }, HIDE_ON_COARSE]}
          >
            <Kbd>g</Kbd>
            <Kbd>{KEY_OF[command.to]}</Kbd>
          </Box>
        )}
      </>,
    ),
  );

  const nameOf = (symbol: string) =>
    data.tickers.phase === 'ready'
      ? (data.tickers.items.find((t) => t.symbol === symbol)?.name ?? null)
      : null;
  const recentRows = recentSymbols.map((symbol) => {
    const name = nameOf(symbol);
    return row(
      { kind: 'recent', symbol },
      `palette-recent-${symbol}`,
      <>
        <Box
          component="span"
          sx={{ fontFamily: typographyTokens.monoFontFamily, fontWeight: 600, minWidth: 56 }}
        >
          {symbol}
        </Box>
        <Box
          component="span"
          sx={{
            color: 'text.secondary',
            flexGrow: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Box>
        <Box component="span" sx={{ color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}>
          Ticker
        </Box>
      </>,
    );
  });

  const tickerRows = tickers.map((ticker) => {
    // Staging's rows are the sample scan's: score and tier, no age (format.ts, `sample`).
    const cell = ticker.row
      ? paletteScoreCell(ticker.row, data.sweep, nowS, { sample: data.ranked })
      : null;
    return row(
      { kind: 'ticker', ticker },
      `palette-symbol-${ticker.symbol}`,
      <>
        <Box
          component="span"
          sx={{ fontFamily: typographyTokens.monoFontFamily, fontWeight: 600, minWidth: 56 }}
        >
          {ticker.symbol}
        </Box>
        <Box
          component="span"
          sx={{
            color: 'text.secondary',
            flexGrow: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ticker.name}
        </Box>
        {cell ? (
          <Box
            component="span"
            data-testid={`palette-score-${ticker.symbol}`}
            sx={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 0.75,
              color: 'text.secondary',
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            <Box
              component="span"
              sx={{
                fontFamily: typographyTokens.monoFontFamily,
                fontWeight: 600,
                fontSize: 13,
                color: 'text.primary',
              }}
            >
              {cell.text}
            </Box>
            {cell.tier}
            {cell.freshness && (
              <Box component="span" data-testid={`palette-freshness-${ticker.symbol}`}>
                {cell.tier ? `· ${cell.freshness}` : cell.freshness}
              </Box>
            )}
          </Box>
        ) : (
          <Box
            component="span"
            sx={{ color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            {/* A marker only where there is a note; most rows have none, and 'no note' on each
                of them was noise. */}
            {ticker.hasNote ? 'note' : null}
          </Box>
        )}
      </>,
    );
  });

  const noteRows = notes.map((note) =>
    row(
      { kind: 'note', note },
      `palette-note-${note.ticker}`,
      <>
        <Box component="span" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box
            component="span"
            sx={{ fontFamily: typographyTokens.monoFontFamily, fontWeight: 600 }}
          >
            {note.ticker}
          </Box>
          {' · '}
          {note.title}
        </Box>
        <Box component="span" sx={{ color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}>
          {noteDate(note.date)}
        </Box>
      </>,
    ),
  );

  const anywayRow = showOpenAnyway
    ? row(
        { kind: 'open-anyway', symbol: q.toUpperCase() },
        'palette-open-anyway',
        <span>
          Open{' '}
          <Box
            component="span"
            sx={{ fontFamily: typographyTokens.monoFontFamily, fontWeight: 600 }}
          >
            {q.toUpperCase()}
          </Box>{' '}
          anyway →
        </span>,
      )
    : null;

  // Production rows sort by symbol, A–Z (`tickersByName`), and most carry no name: "by name" misled.
  const footnote = data.ranked
    ? 'Scores come from the demo’s sample scan.'
    : 'Scores aren’t live on this site, so tickers list A–Z.';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // No MUI width cap: the paper below sets the board's 620.
      maxWidth={false}
      fullWidth
      transitionDuration={{ enter: 160, exit: 120 }}
      data-testid="command-palette"
      // The dialog's name (spec 2026-10-21/02, (a)). MUI 9.2 puts `role=dialog` on the paper and
      // always gives it an `aria-labelledby` (`Dialog.js`), generating an id when none is passed.
      // An `aria-label` here landed on the `role=presentation` root, and the generated id pointed
      // at nothing, so the dialog had no name. A real id on the hidden heading below fixes both.
      aria-labelledby={titleId}
      slotProps={{
        paper: {
          // The raised surface, set here over the theme's flat dialog panel: the palette floats
          // above the page rather than standing in for it (OVL ruling). `backgroundImage: 'none'`
          // keeps MUI's dark-mode elevation wash off it.
          sx: (t) => ({
            position: 'fixed',
            top: { xs: 16, sm: 132 },
            m: 0,
            width: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 48px)' },
            maxWidth: 620,
            maxHeight: { xs: 'calc(100dvh - 32px)', sm: 'calc(100dvh - 156px)' },
            bgcolor: extrasFor(t).panelRaised,
            backgroundImage: 'none',
            border: `1px solid ${extrasFor(t).lineStrong}`,
            borderRadius: '14px',
            boxShadow: elevationFor(t).e4,
          }),
        },
      }}
    >
      <Box component="h2" id={titleId} sx={visuallyHidden}>
        Jump to a ticker or note
      </Box>
      {/* The input row: the search glyph, the input, then the `esc` key from 600px up. Below 600px
          the key gives way to Cancel: a phone has no Escape key and a scrim tap is easy to miss, so
          the close is a visible, 44px control. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2,
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <SearchIcon aria-hidden sx={{ fontSize: 16, color: 'text.secondary', flex: 'none' }} />
        <InputBase
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a ticker or note"
          data-testid="palette-input"
          inputProps={{
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': listboxId,
            'aria-activedescendant': activeId,
            'aria-autocomplete': 'list',
            'aria-label': 'Jump to a ticker or note',
          }}
          sx={{ fontSize: '1rem', p: 0 }}
        />
        {/* Escape closes through the Dialog's own `onClose`, so the key it names performs it. */}
        <Box
          component="span"
          aria-hidden
          sx={[{ display: { xs: 'none', sm: 'inline-flex' }, flex: 'none' }, HIDE_ON_COARSE]}
        >
          <Kbd>esc</Kbd>
        </Box>
        {/* Neutral text button (owner ruling A: amber is the one primary action's). */}
        <Button
          variant="text"
          onClick={onClose}
          data-testid="palette-cancel"
          sx={{ display: { xs: 'inline-flex', sm: 'none' }, flexShrink: 0, minHeight: 44 }}
        >
          Cancel
        </Button>
      </Box>

      <Box
        ref={listRef}
        role="listbox"
        id={listboxId}
        aria-label="Results"
        data-testid="palette-listbox"
        sx={{ overflowY: 'auto', flex: '1 1 auto', py: 0.5 }}
      >
        {commandRows.length > 0 && <Group label="Go to">{commandRows}</Group>}

        {recentRows.length > 0 && <Group label="Recent">{recentRows}</Group>}

        {(data.tickers.phase !== 'ready' || tickerRows.length > 0) && (
          <Group label={data.ranked ? 'Tickers · ranked by the sample scan' : 'Tickers'}>
            {tickerRows}
            {/* Loading: rows at their final height; resolves once, never re-entered. */}
            {data.tickers.phase === 'loading' &&
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <Box key={`skeleton-${i}`} data-testid="palette-skeleton-row" sx={{ px: 2, py: 1 }}>
                  <Skeleton variant="text" width={`${[70, 54, 62, 48][i]}%`} />
                </Box>
              ))}
            {data.tickers.phase === 'failed' && (
              <Box
                data-testid="palette-unavailable"
                sx={{ display: 'flex', gap: 1, mx: 2, my: 1, alignItems: 'flex-start' }}
              >
                <WarningAmberOutlined
                  aria-hidden
                  sx={{ fontSize: 16, color: 'warning.main', mt: '2px' }}
                />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                    Couldn’t search tickers right now.
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    Go-to commands and notes still work; the ticker list comes back on the next
                    open.
                  </Typography>
                </Box>
              </Box>
            )}
          </Group>
        )}

        {noteRows.length > 0 && <Group label="Research notes">{noteRows}</Group>}

        {showNoMatch && (
          <Typography
            data-testid="palette-empty"
            sx={{ px: 2, pt: 1, pb: 0.5, fontSize: 13, color: 'text.secondary' }}
          >
            No ticker or note matches “{q}”.
          </Typography>
        )}
        {anywayRow && (
          <Box role="group" aria-label="Open a symbol">
            {anywayRow}
          </Box>
        )}
      </Box>

      {/* Every binding advertised here performs an action (AC-33b). */}
      <Box
        data-testid="palette-footer"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 2,
          rowGap: 0.5,
          px: 2,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          fontSize: 12,
          color: 'text.secondary',
        }}
      >
        <Box component="span" sx={HIDE_ON_COARSE}>
          <Kbd>↑↓</Kbd> move
        </Box>
        <Box component="span" sx={HIDE_ON_COARSE}>
          <Kbd>↵</Kbd> open
        </Box>
        {onOpenShortcuts && (
          <Box
            component="button"
            type="button"
            onClick={onOpenShortcuts}
            // Width alone left it on a coarse tablet of 600px and up; the coarse rule comes last.
            sx={[
              {
                all: 'unset',
                cursor: 'pointer',
                display: { xs: 'none', sm: 'inline-flex' },
                alignItems: 'center',
                gap: 0.5,
                '&:focus-visible': { outline: '2px solid', outlineOffset: 2 },
              },
              HIDE_ON_COARSE,
            ]}
          >
            <Kbd>?</Kbd> all shortcuts
          </Box>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <span data-testid="palette-footnote">{footnote}</span>
      </Box>
    </Dialog>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <Box role="group" aria-labelledby={id} sx={{ pb: 0.5 }}>
      <Typography
        id={id}
        component="div"
        sx={{
          px: 2,
          pt: 1,
          pb: 0.5,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
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
  children: ReactNode;
}) {
  return (
    <Box
      id={id}
      role="option"
      aria-selected={selected}
      data-testid={testid}
      onClick={onClick}
      // Mousedown (not click) so the input never loses focus before the click handler runs.
      onMouseDown={(e) => e.preventDefault()}
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        // Inset 8px from the palette's edges with 8px of its own, so the text keeps the group
        // label's 16px line; rounded, as the board's `.opt`.
        mx: 1,
        px: 1,
        py: 1,
        minHeight: 40,
        // The CONTROL role (8px); `1` would be `shape.borderRadius`, the 12px panel role.
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: 14,
        // The selected row sits one step ABOVE the raised paper inside the ring, as the board's
        // `.opt`: raised2 (#223041) in dark, where its steel labels (name, tier, date) measure
        // 4.74:1. Light keeps white (`background.paper`, steel 5.42:1): light raised2 (#E3E3DD)
        // under steel measures 4.20:1, below AA. `action.selected`'s wash over the raised paper
        // measured 3.31:1 dark and 3.83:1 light. Gated in token-contrast.spec.ts (raised2 rows).
        bgcolor: selected
          ? t.palette.mode === 'dark'
            ? extrasFor(t).panelRaised2
            : t.palette.background.paper
          : 'transparent',
        boxShadow: selected ? `inset 0 0 0 1px ${extrasFor(t).lineStrong}` : 'none',
        color: t.palette.text.primary,
        // Ruling 5 (AC-34): `role="option"` sits outside the theme's coarse-pointer floor.
        '@media (pointer: coarse)': { minHeight: 44 },
      })}
    >
      {children}
    </Box>
  );
}

export default CommandPalette;
