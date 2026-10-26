/**
 * The one chart frame (canon P-8 to P-13, owner rulings 2026-10-14). Every chart on the site sits in
 * it, so every chart says the same things in the same places:
 *
 * - The border is the provenance (P-8): solid for Convexa's own figures or a primary source, dotted
 *   for a third party's, dashed with a hatch stripe for sample data. A frame given no provenance
 *   takes the board's (WidgetProvenanceContext: the shell sets it from the build, `sample` on the
 *   demo and `primary` on the live site). On a sample board it wears the demo's state tag, unless
 *   its page has opted out (FrameDemoTagProvider, the Research pages): the shell's demo bar is then
 *   the page's one "Demo · sample data", and the frame names the sample once, by its own source
 *   chip, or by a Sample tag in its head when it has no source line (owner decision D1).
 * - The title states the finding only when the chart has data; every other state names the metric
 *   (P-10, frameTitle.ts). The subtitle holds the metric, the unit and the period.
 * - A state tag sits beside the title (Updated Oct 13, Computed, Demo · sample data…).
 * - The foot carries the source chip, in the frame's provenance, and the as-of line.
 * - "Show the numbers" opens the table twin: the same values as text, for every chart. A chart may
 *   give several tables under the one disclosure, and a cell may link out (TableTwinLink). The
 *   tables are built only while it is open, so a closed twin carries no rows.
 * - In loading and message states the body keeps the chart's final height (no layout shift); a
 *   message sits on a faint ghost grid, a failure marked in the warning colour, never green or red.
 *   Loading draws the same ghost grid (the board's `.cskel`) and keeps the frame's rows, so the frame
 *   doesn't jump when the data lands (fidelity audit 2026-10-25, FND-15; acceptance: 24px or less).
 *   A loading frame given no foot holds the standard one as ghosts: a source chip and an as-of line
 *   that wrap where the real ones do on a narrow frame, the chip at the coarse 44 of the /credits
 *   link it becomes, and the "Show the numbers" row at the summary's own 24 (44 on a coarse
 *   pointer). Rows only the ready frame knows (the finding's lines, the state tag, a longer sub, the
 *   legend, a note) are held by `reserve`: stand-ins laid out invisibly, or a ghost legend row.
 *
 * Text inside a chart is HTML or SVG text at 11px or more (P-13); that's the plot's job, not the frame's.
 *
 * Design: design/src/chart-kit.mjs (chartFrame, dataTable, stateBody), screens/v5/system.mjs.
 */
import { creditsAnchor } from '@/shared/credits/anchor';
import { CreditsLink } from '@/shared/credits/CreditsLink';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { DATA_STATES, type DataStateKey } from '@/shared/dataState/vocabulary';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { coarseFloor, standaloneLinkSx } from '@/shared/ui/touch';
import { useFrameDemoTag, useWidgetProvenance } from '@/shared/ui/Widget/WidgetProvenanceContext';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { alpha, type Breakpoint, type Theme } from '@mui/material/styles';
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { frameTitle, type ChartStatus } from './frameTitle';

export type Provenance = 'primary' | 'third' | 'sample';

/** The plot's height: one number, or one per breakpoint for a plot that draws shorter on a phone. */
export type FrameHeight = number | Partial<Record<Breakpoint, number>>;

/**
 * Loading only: the ready frame's rows that only the data can fill, held so the frame keeps its
 * height when the data lands (FND-15). Text stand-ins are laid out invisibly (`visibility: hidden`,
 * `aria-hidden`) in the ready frame's type, so they wrap at every width as the real rows will;
 * pass text of the ready text's usual length. The loading title still names the metric (P-10).
 */
export interface FrameReserve {
  /** A stand-in of the ready finding (the title's lines). */
  finding?: string;
  /** A stand-in of the ready sub. */
  sub?: string;
  /** The ready frame's state tag, resolved as the ready frame would resolve it. */
  tag?: { state: DataStateKey; detail?: string; word?: string };
  /** A ghost legend row with this many entries. */
  legend?: number;
  /** A stand-in of the ready note under the plot. */
  note?: string;
}

/**
 * A twin cell that links out (spec 2026-10-21/02, part (d)): `text` is what shows, `label` the
 * link's accessible name. It renders as a standalone link, 44px under a coarse pointer. The renderer
 * treats an object cell as a link only when it has an `href`.
 */
export interface TableTwinLink {
  text: string;
  href: string;
  label: string;
}

/** A figure (a string or number, Mono) or a link cell. */
export type TableTwinCell = string | number | TableTwinLink;

export interface TableTwinData {
  caption: string;
  cols: string[];
  /** The first cell of each row is its header (a date, a maturity); the rest are figures. */
  rows: TableTwinCell[][];
}

const MONO = typographyTokens.monoFontFamily;
const BORDER: Record<Provenance, 'solid' | 'dotted' | 'dashed'> = {
  primary: 'solid',
  third: 'dotted',
  sample: 'dashed',
};

export function ChartFrame({
  finding,
  metric,
  sub,
  provenance: given,
  status = { kind: 'ready' },
  tag: givenTag,
  height,
  legend,
  note,
  source,
  asOf,
  table,
  action,
  reserve,
  headingLevel = 'h3',
  children,
  testId,
}: {
  /** The title over ready data: a finding, not a label. */
  finding: string;
  /** The title in every other state: what the chart measures. */
  metric: string;
  sub?: ReactNode;
  /** Omitted: the board's provenance. On a sample board (the demo build) the frame then shows the
   *  demo tag in every state, whatever `tag` says, so a call site passes only its live tag. On a
   *  page that opts out of that tag (FrameDemoTagProvider) a passed failure or absence tag (warn or
   *  quiet: Couldn’t load, Last good copy, Off…) still shows; a current-data one (Updated,
   *  Computed…) never does, and a frame with no source line says Sample instead. */
  provenance?: Provenance;
  status?: ChartStatus;
  tag?: { state: DataStateKey; detail?: string; word?: string };
  /** The plot's height, kept by the loading and message bodies. */
  height: FrameHeight;
  legend?: ReactNode;
  note?: ReactNode;
  source?: { text: string; href?: string };
  asOf?: string;
  /** "Show the numbers": one table, or several under the one disclosure, in the order given. */
  table?: TableTwinData | TableTwinData[];
  /** A message state's one action (Try again). */
  action?: ReactNode;
  /** Loading only: the ready rows to hold (FrameReserve). */
  reserve?: FrameReserve;
  headingLevel?: 'h2' | 'h3';
  children?: ReactNode;
  testId?: string;
}) {
  const board = useWidgetProvenance();
  const demoTag = useFrameDemoTag();
  const provenance = given ?? board;
  const boardSample = given === undefined && provenance === 'sample';
  const resolveTag = (given: FrameReserve['tag'], hasSource: boolean) =>
    !boardSample
      ? given
      : demoTag
        ? { state: 'demo' as const }
        : given && ['warn', 'quiet'].includes(DATA_STATES[given.state].kind)
          ? given
          : hasSource
            ? undefined
            : { state: 'sample' as const };
  const tag = resolveTag(givenTag, !!source);
  const title = frameTitle(status, finding, metric);
  const ready = status.kind === 'ready';
  const loading = status.kind === 'loading';
  const twins = table === undefined ? [] : Array.isArray(table) ? table : [table];
  // A loading frame given no foot holds the standard one (source chip + as-of + table twin) as ghosts.
  const ghostFoot = loading && !source && !asOf;
  const ghostTwin = loading && (twins.length > 0 || ghostFoot);
  const hold = loading ? reserve : undefined;
  // The ready head, laid out invisibly under the loading one: the taller of the two sets the height.
  const holdHead = !!hold && (!!hold.finding || !!hold.sub || !!hold.tag);
  // The ready frame's tag, as the ready frame resolves it (a held foot means a source line comes).
  const holdTag = hold?.tag ? resolveTag(hold.tag, !!source || ghostFoot) : undefined;
  return (
    <Box
      component="figure"
      data-testid={testId}
      data-provenance={provenance}
      sx={(t) => ({
        position: 'relative',
        m: 0,
        p: { xs: '14px 14px 12px', sm: '18px 20px 14px' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minWidth: 0,
        height: '100%',
        bgcolor: 'background.paper',
        borderRadius: '12px',
        border: `1px ${BORDER[provenance]} ${
          provenance === 'primary' ? t.palette.divider : extrasFor(t).textTertiary
        }`,
        ...(provenance === 'sample' && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 8,
            borderRadius: '11px 11px 0 0',
            pointerEvents: 'none',
            background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
              t.palette.text.secondary,
              0.28,
            )} 6px 12px)`,
          },
        }),
      })}
    >
      <Box
        component="figcaption"
        sx={
          holdHead
            ? { display: 'grid', minWidth: 0, '& > *': { gridArea: '1 / 1' } }
            : { display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }
        }
      >
        <Head
          title={
            <Box component={headingLevel} sx={TITLE_SX}>
              {title}
            </Box>
          }
          tag={tag}
          sub={sub}
          wrapped={holdHead}
        />
        {holdHead && (
          <Head
            hidden
            title={
              <Box component="span" sx={[TITLE_SX, { display: 'block' }]}>
                {hold?.finding ?? title}
              </Box>
            }
            tag={holdTag}
            sub={hold?.sub ?? sub}
            wrapped
          />
        )}
      </Box>

      {(ready || loading) && legend}
      {loading && !legend && !!hold?.legend && <LegendGhost entries={hold.legend} />}
      {ready ? (
        children
      ) : (
        <StateBody status={status} height={height} metric={metric} action={action} />
      )}
      {ready && note && (
        <Box component="p" sx={NOTE_SX}>
          {note}
        </Box>
      )}
      {loading && hold?.note && (
        <Box aria-hidden sx={[NOTE_SX, { visibility: 'hidden' }]}>
          {hold.note}
        </Box>
      )}

      {(source || asOf || ghostFoot) && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px 12px',
            mt: 'auto',
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          {source && <SourceChip text={source.text} href={source.href} provenance={provenance} />}
          {asOf && (
            <Box component="span" sx={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.3 }}>
              {asOf}
            </Box>
          )}
          {ghostFoot && (
            <>
              {/* The chip, at the coarse 44 of the /credits link it becomes (the theme's `a` floor). */}
              <Box
                component="span"
                aria-hidden
                sx={[{ display: 'inline-flex', alignItems: 'center', minHeight: 24 }, coarseFloor]}
              >
                <Ghost width={240} height={24} radius={12} />
              </Box>
              {/* The as-of line (Mono 11 at 1.3); with the chip it wraps where the real pair does. */}
              <Box
                component="span"
                aria-hidden
                sx={{ display: 'inline-flex', alignItems: 'center', height: `${11 * 1.3}px` }}
              >
                <Ghost width={112} height={10} radius={5} />
              </Box>
            </>
          )}
        </Box>
      )}
      {ready && twins.length > 0 && <TwinDisclosure tables={twins} />}
      {ghostTwin && (
        // The summary's own row: 24, and the coarse 44 its `coarseFloor` gives it.
        <Box aria-hidden sx={[{ height: 24, display: 'flex', alignItems: 'center' }, coarseFloor]}>
          <Ghost width={116} height={12} radius={6} />
        </Box>
      )}
    </Box>
  );
}

function StateBody({
  status,
  height,
  metric,
  action,
}: {
  status: Exclude<ChartStatus, { kind: 'ready' }>;
  height: FrameHeight;
  metric: string;
  action?: ReactNode;
}) {
  if (status.kind === 'loading') {
    // The board's `.cskel` (design/src/chart-kit.mjs:134-135): the chart's ghost grid, a gridline
    // every quarter of the plot, under a faint sheen. Static, so reduced motion needs nothing.
    return (
      <Box
        role="img"
        aria-label={`Loading ${metric}`}
        aria-busy="true"
        sx={(t) => ({
          height,
          borderRadius: '6px',
          backgroundImage: [
            `linear-gradient(90deg, transparent, ${alpha(t.palette.text.secondary, 0.07)}, transparent)`,
            ghostGrid(t),
          ].join(', '),
        })}
      />
    );
  }
  const warn = status.tone === 'warn';
  return (
    <Box
      sx={(t) => ({
        position: 'relative',
        // At least the plot's height, so the frame doesn't shift; taller when the message needs it.
        minHeight: height,
        display: 'flex',
        alignItems: 'center',
        p: 1,
        // The ghost grid: the chart's outline, so the frame reads as a chart with nothing in it.
        backgroundImage: ghostGrid(t),
      })}
    >
      <Box
        role={warn ? 'alert' : 'status'}
        sx={(t) => ({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1,
          maxWidth: 480,
          p: '12px 14px',
          borderRadius: '10px',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          ...(warn && { borderLeft: `2px solid ${t.palette.warning.main}` }),
        })}
      >
        <Box component="p" sx={{ m: 0, fontSize: 13, lineHeight: 1.5, textWrap: 'pretty' }}>
          {status.text}
        </Box>
        {status.cause && (
          <Box
            component="p"
            sx={{ m: 0, fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}
          >
            {status.cause}
          </Box>
        )}
        {action}
      </Box>
    </Box>
  );
}

/** A gridline every quarter of the plot, in the chart grid's line colour (`roles.ts` `grid`). */
function ghostGrid(t: Theme): string {
  return `repeating-linear-gradient(0deg, transparent 0 calc(25% - 1px), ${t.palette.divider} calc(25% - 1px) 25%)`;
}

const TITLE_SX = {
  m: 0,
  flex: '1 1 260px',
  minWidth: 0,
  fontSize: { xs: 14, sm: 15 },
  fontWeight: 600,
  lineHeight: 1.35,
  color: 'text.primary',
  textWrap: 'balance',
} as const;
const SUB_SX = {
  m: 0,
  fontSize: 12,
  lineHeight: 1.45,
  color: 'text.secondary',
  textWrap: 'pretty',
} as const;
const NOTE_SX = SUB_SX;

/** The frame's head: the title and its state tag on one wrapping row, then the sub. `hidden` lays
 *  out a reserve copy (no heading, no text in the accessibility tree) that only gives the height. */
function Head({
  title,
  tag,
  sub,
  wrapped,
  hidden = false,
}: {
  title: ReactNode;
  tag?: { state: DataStateKey; detail?: string; word?: string };
  sub?: ReactNode;
  /** Inside the reserve grid: a block of its own rather than the figcaption's direct rows. */
  wrapped: boolean;
  hidden?: boolean;
}) {
  const rows = (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '6px 10px' }}>
        {title}
        {tag && <DataStateTag state={tag.state} detail={tag.detail} word={tag.word} />}
      </Box>
      {sub && (
        <Box component={hidden ? 'span' : 'p'} sx={[SUB_SX, { display: 'block' }]}>
          {sub}
        </Box>
      )}
    </>
  );
  if (!wrapped) return rows;
  return (
    <Box
      aria-hidden={hidden || undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        minWidth: 0,
        ...(hidden && { visibility: 'hidden', pointerEvents: 'none' }),
      }}
    >
      {rows}
    </Box>
  );
}

/** A loading legend: one row of ghost entries (a swatch and a label bar) at the legend's 12px line. */
function LegendGhost({ entries }: { entries: number }) {
  return (
    <Box aria-hidden sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12 }}>
      {Array.from({ length: entries }, (_, i) => (
        <Box
          key={i}
          component="span"
          sx={(t) => ({
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            minHeight: '1lh',
            '& > i': {
              display: 'inline-block',
              width: 16,
              borderTop: `2px solid ${alpha(t.palette.text.secondary, 0.16)}`,
            },
          })}
        >
          <i />
          <Ghost width={72} height={10} radius={5} />
        </Box>
      ))}
    </Box>
  );
}

/** A placeholder bar for a row the ready frame will fill (the source chip, the table twin). */
function Ghost({ width, height, radius }: { width: number; height: number; radius: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={(t) => ({
        display: 'block',
        width,
        maxWidth: '100%',
        height,
        borderRadius: `${radius}px`,
        bgcolor: alpha(t.palette.text.secondary, 0.08),
      })}
    />
  );
}

/** Where the figures come from, in the frame's provenance: solid, dotted (third party), dashed (sample). */
function SourceChip({
  text,
  href,
  provenance,
}: {
  text: string;
  href?: string;
  provenance: Provenance;
}) {
  const chip = (
    <Box
      component="span"
      // The library's `.prov` (design/src/lib.mjs:26-29): Mono 11/500; a primary source is phosphor
      // on the strong line, a third party's or a sample's is steel on a dotted or dashed steel2 line
      // (fidelity audit 2026-10-25, FND-16).
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        minHeight: 24,
        px: 1.25,
        py: '2px',
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.35,
        borderRadius: '12px',
        border: `1px ${BORDER[provenance]} ${
          provenance === 'primary' ? extrasFor(t).lineStrong : extrasFor(t).textTertiary
        }`,
        color: provenance === 'primary' ? 'text.primary' : 'text.secondary',
        overflowWrap: 'anywhere',
      })}
    >
      {text}
    </Box>
  );
  // A chip that names a source links to its card on /credits, which links on to the source. A
  // TradingView link stays as given: it is TradingView's attribution (its policies §4).
  const attribution = href !== undefined && /(^|\.)tradingview\.com\//.test(href);
  if (!attribution && creditsAnchor(text)) return <CreditsLink text={text}>{chip}</CreditsLink>;
  return href ? (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      // Under a coarse pointer the theme's floor makes this link 44px; inline-flex with centred
      // content keeps the chip in its middle (spec 2026-10-21/02, part (b) and criterion 7).
      sx={{ maxWidth: '100%', display: 'inline-flex', alignItems: 'center' }}
    >
      {chip}
    </Link>
  ) : (
    chip
  );
}

/** "Show the numbers": the chart's values as a table, for every chart (P-8 to P-13, design table twin). */
export function TableTwin(table: TableTwinData) {
  return <TwinDisclosure tables={[table]} />;
}

/**
 * The one "Show the numbers" disclosure over one or more tables (the insider chart's windows, then
 * every trade). The tables are built only while it is open, from local state on `toggle`: a closed
 * twin carries no rows, which keeps a long note's DOM small (the NVDA note's 194 trades would add
 * about 1,750 nodes; spec 2026-10-21/02, part (d) and its DOM budget).
 */
function TwinDisclosure({ tables }: { tables: TableTwinData[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Box
      component="details"
      onToggle={(e: SyntheticEvent<HTMLElement>) =>
        setOpen((e.currentTarget as HTMLDetailsElement).open)
      }
      sx={{ '& > summary::-webkit-details-marker': { display: 'none' } }}
    >
      <Box
        component="summary"
        // The local 24px beats the theme's coarse floor (an element selector), so the summary
        // carries its own coarse 44 (`shared/ui/touch.ts`; spec 2026-10-21/02 part (b), FND-09).
        // Last in the array, so its media rule follows the 24. A block-level flex box sized to its
        // text, not inline-flex: inline, it sat on the details' 24.75px body line and drew the row
        // 25.1 tall, 1.1 more than its loading ghost (FND-15).
        sx={[
          (t) => ({
            display: 'flex',
            width: 'fit-content',
            alignItems: 'center',
            gap: 0.75,
            minHeight: 24,
            cursor: 'pointer',
            listStyle: 'none',
            fontSize: 12,
            fontWeight: 600,
            color: extrasFor(t).textInfo,
            '&::before': { content: '"▸"', fontSize: 11, color: t.palette.text.secondary },
            'details[open] > &::before': { content: '"▾"' },
          }),
          coarseFloor,
        ]}
      >
        Show the numbers
      </Box>
      {open && tables.map((t, i) => <TwinTable key={i} {...t} />)}
    </Box>
  );
}

/** A link cell's link: the standalone link (44px under coarse) in the body Sans, since a link is
 *  not a figure (Mono is for figures). */
const LINK_CELL_SX = [
  standaloneLinkSx,
  (t: Theme) => ({ fontFamily: t.typography.fontFamily, fontVariantNumeric: 'normal' }),
] as const;

function cellContent(c: TableTwinCell): ReactNode {
  if (typeof c !== 'object') return c;
  if (!c.href) return c.text;
  return (
    <Link
      href={c.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={c.label}
      sx={LINK_CELL_SX}
    >
      {c.text}
    </Link>
  );
}

function TwinTable({ caption, cols, rows }: TableTwinData) {
  return (
    <Box
      role="region"
      aria-label={caption}
      tabIndex={0}
      sx={(t) => ({
        mt: 1,
        maxWidth: '100%',
        overflowX: 'auto',
        border: 1,
        borderColor: 'divider',
        borderRadius: '8px',
        '&:focus-visible': { outline: `2px solid ${extrasFor(t).textAmber}`, outlineOffset: 2 },
      })}
    >
      <Box
        component="table"
        sx={(t) => ({
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 12,
          '& caption': { textAlign: 'left', p: '8px 10px', color: 'text.secondary' },
          '& th, & td': {
            p: '6px 10px',
            textAlign: 'right',
            borderTop: 1,
            borderColor: 'divider',
            whiteSpace: 'nowrap',
          },
          '& th:first-of-type, & td:first-of-type': { textAlign: 'left' },
          '& thead th': { fontWeight: 600, color: 'text.secondary', bgcolor: extrasFor(t).well },
          '& td': { fontFamily: MONO, fontVariantNumeric: 'tabular-nums' },
          '& tbody th': { fontWeight: 500, color: 'text.primary' },
        })}
      >
        <caption>{caption}</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cellContent(c)}
                  </th>
                ) : (
                  <td key={j}>{cellContent(c)}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
