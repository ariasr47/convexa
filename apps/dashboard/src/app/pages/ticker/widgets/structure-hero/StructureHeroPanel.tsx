/**
 * StructureHeroPanel — the structure-field hero (curvature-v2-desk-and-read, SPEC §2.1/§2.5/§4.2).
 * ONE `Widget`, four PRESENTATIONAL regions: `StructureFieldCanvas` · the level ladder
 * (`LevelLadder` + `LadderFoot`, one region, two files) · `TapeTrailRow` · `StructurePathStrip`
 * (plus the Field/Magnet toggle's `WallMagnetView`, an alternate paint for the same canvas region).
 *
 * FE-8 ADDITION (orphan fix): `LadderFoot` (Vol-norm GEX, Raw GEX 1% shock — SPEC §2.3's "ladder
 * foot", FE-5) was built and tested but never mounted anywhere in the production tree — FE-6 wired
 * the other three regions but not this one. Left unmounted, deleting the old dealer positioning
 * widget (FE-8) would
 * have turned these two cells into genuine orphans, exactly what the zero-orphan ledger exists to
 * catch. Wired in here, beside `LevelLadder`, since the ledger already books it as part of the SAME
 * ladder region, not a fifth one; `StructureHeroPanel.spec.tsx` carries no children-count assertion
 * this contradicts.
 *
 * SINGLE STORE READ (SPEC §2.1): this is the ONLY component in `structure-hero/` that calls
 * `useLiveTape()`. It derives the branded claim ONCE and hands it — and the mid — DOWN AS PROPS.
 * That is the structural reason the four regions are presentational children, not the aesthetic
 * one. This file needs no EXEMPT entry in FE-1's source scan (`liveClaim.spec.ts`) at all: it never
 * reads the store's own `isLive` flag off `tape` directly and never writes an equivalent hand-rolled
 * boolean chain, composing only through `isDeliveringLive`/`andPresent`.
 *
 * INNER BOUNDARY (SPEC §5): the `ErrorBoundary` wraps the CANVAS REGION ONLY (whichever of
 * Field/Magnet is selected) — the ladder, the tape trail row and the path strip keep rendering on a
 * canvas fault. The ladder is REST-only, shares no failure mode with the paint path, and carries
 * the phase's most load-bearing readout (canon rule 14).
 *
 * `palette`/`surfaces` are resolved ONCE, here, and handed to the canvas/ladder/tape-row by
 * IDENTITY — not just equal value (criterion 7). This is why the canvas is rendered DIRECTLY
 * (`StructureFieldCanvas`), not through `gex-profile-chart/GexProfileChart` — that component
 * resolves its OWN palette/surfaces internally for its (still-live) standalone call site, which
 * would give the ladder a different object reference than the canvas receives.
 */
import { StructureFieldCanvas, type StructureFieldModel } from '@/shared/charts/structure-field';
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { LiveDot } from '@/shared/figure';
import { andPresent, isDeliveringLive, NOT_LIVE } from '@/shared/liveness/liveClaim';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Widget } from '@/shared/ui/Widget';
import type { MarketState, StrikeRow, StructureSample } from '@convexa/api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { useLiveTape } from '../../liveTapeStore';
import { sessionTapeOf } from '../../sessionTapeStanding';
import { humanAge } from '../_kit/copy';
import { levelSpot } from '../_kit/distanceToLevel';
import { FigureRow } from '../_kit/FigureCell';
import { DESK_IS_SAMPLE, sampleReplayLine, SCENARIO_STAMP, scenarioAsOf } from '../_kit/sample';
import { useStreamLatch } from '../_kit/useStreamLatch';
import { rowsToSamples, windowedStrikes } from '../gex-profile-chart/chart';
import { buildLadder, formatAnchorText, LadderFoot, LevelLadder } from '../level-ladder';
import { StructurePathStrip } from '../structure-history/StructurePathStrip';
import { FIELD_METRIC, heroFinding, ladderFinding } from './findings';
import { TapeTrailRow } from './TapeTrailRow';
import { WallMagnetView } from './WallMagnetView';

export interface StructureHeroPanelProps {
  symbol: string;
  m: MarketState;
  strikes: StrikeRow[];
  structureAgeSeconds?: number | null;
  /** Session structure path (slow lane) — embedded strip, not a peer card. */
  pathSamples?: StructureSample[] | null;
  pathLoading?: boolean;
  pathError?: string | null;
  pathBasis?: string | null;
  /** "all expirations" / "N expirations" — the SAME phrase `TickerHeader` already states beside the
   *  headline (repair task item 6's subtitle). Never a second, independent computation. */
  expirationsLabel?: string;
  /** The API's regime word (`signals.regime`) for the finding title; absent → the metric title. */
  regime?: string | null;
}

const HERO_INFO =
  'Net dealer gamma by strike as a dual-clock Structure Field, the five-level ladder beside it, ' +
  'the tape mid trail, and the session structure path. Levels (walls, flip, max pain) are REST ' +
  'structure; the mid is the only figure the live tape drives. The Field/Magnet toggle is a display ' +
  'preference — it never changes what is measured, only how the same levels are drawn.';

type ViewMode = 'levels' | 'magnet';

/**
 * Ticker fidelity repair, change 6 (F10 hero residual) — the design's `● mid · tape` header chip
 * (`design/src/screens/desk.mjs:295`'s `widgetHead(..., { live: 'mid · tape' })`), which the app
 * showed as an ⓘ where the design shows this instead (`STRUCTURE_HERO_REVIEW.md`'s own F10 finding).
 * Reuses `shared/figure`'s `LiveDot` — the SAME per-figure provenance mark every other live value on
 * this page wears (canon 13) — never a second page-level connection claim (canon 18 is explicit that
 * rule 13's dot is chip-SCOPED, a mark on ONE value, not a competing page claim; the text here names
 * exactly which value: the mid, sourced from the tape). Genuinely live-gated (canon 22): mounted
 * only while `claim` (`isDeliveringLive`) is true, never a "not live" variant the design doesn't
 * specify — absence is the honest signal, the same shape the read strip's ring/other additive marks
 * already use.
 */
function MidTapeChip() {
  return (
    <Box
      component="span"
      data-testid="structure-hero-mid-tape-chip"
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        height: 20,
        px: 1,
        borderRadius: 999,
        bgcolor: 'action.selected',
        fontSize: 11,
        fontWeight: 600,
        // PR #46 CI repair, §A — `info.main` is the fill/dot grade (≥3:1 UI class); 11px TEXT needs
        // the ≥4.5:1 text class (measured 3.79:1 composited on this chip's own translucent fill —
        // and plain `text.secondary` ALSO falls short here, 3.7:1 on the same real composite, so the
        // text-grade `textInfo` companion is the one fix that actually clears both). `LiveDot` keeps
        // the blue (its own explicit `bgcolor`, unaffected — it does not inherit `currentColor`).
        color: extrasFor(t).textInfo,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      })}
    >
      <LiveDot />
      mid · tape
    </Box>
  );
}

/**
 * The field legend (repair task item 6; `design/src/screens/desk.mjs:296`): `■ call-dominated`,
 * `■ put-dominated`, `— flip`, 11px steel — hidden below a 768px container (the legend is a nicety,
 * not load-bearing; the ladder's own ticks already carry the same colour identity). Plain viewport
 * `theme.breakpoints`, not `theme.containerQueries('panel')`: the `Widget` header's `actions` slot
 * renders OUTSIDE the panel-named container (`Widget.tsx`'s body box is the one wrapped in
 * `containerName: 'panel'`), so a container query here would never match any ancestor.
 */
function FieldLegend({ flipColor }: { flipColor: string }) {
  const swatch = (color: string) => (
    <Box
      component="span"
      aria-hidden
      sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color, flexShrink: 0 }}
    />
  );
  const line = (color: string) => (
    <Box
      component="span"
      aria-hidden
      sx={{ width: 10, height: 2, bgcolor: color, flexShrink: 0 }}
    />
  );
  return (
    <Box
      component="span"
      data-testid="structure-field-legend"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 11,
        color: 'text.secondary',
        flexWrap: 'wrap',
        // Kept on phones (TD-02): hiding it left the field's green and red unexplained there. The
        // header wraps it onto its own line instead.
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {swatch('success.main')}
        +γ call-dominated
      </Box>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {swatch('error.main')}
        −γ put-dominated
      </Box>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {line(flipColor)}
        flip
      </Box>
    </Box>
  );
}

export function StructureHeroPanel({
  symbol,
  m,
  strikes,
  structureAgeSeconds = null,
  pathSamples = null,
  pathLoading = false,
  pathError = null,
  pathBasis = null,
  expirationsLabel = 'all expirations',
  regime = null,
}: StructureHeroPanelProps) {
  const [view, setView] = useState<ViewMode>('levels');
  const theme = useTheme();
  // Resolved ONCE (SPEC §2.7) — the SAME objects the canvas, the ladder and the tape trail row all
  // receive, by identity (criterion 7).
  const palette = useMemo(() => resolveLevelPalette(theme), [theme]);
  const surfaces = useMemo(
    () => ({
      ink: theme.palette.background.default,
      panel: theme.palette.background.paper,
      raised: extrasFor(theme).panelRaised,
      phosphor: theme.palette.text.primary,
      steel: theme.palette.text.secondary,
      warning: theme.palette.warning.main,
    }),
    [theme],
  );

  // SINGLE STORE READ (SPEC §2.1) — the only `useLiveTape()` call in `structure-hero/`.
  const tape = useLiveTape();
  const st = sessionTapeOf(tape.live);
  const claim = isDeliveringLive(tape.live, tape.streamOffline);
  const sampleStanding =
    tape.sampleStanding?.symbol === symbol.toUpperCase() ? tape.sampleStanding : null;
  // GATE Z (FE-11): the SAME "S0 genuinely live / S1 display-active during replay" discipline
  // `live-tape/LiveTape.tsx`'s own `numbersActive` already established (branching on session-tape
  // occupancy, falling back to the store's live/offline facts) — deliberately NOT `claim` alone.
  // `claim` (`isDeliveringLive`) is ALWAYS false
  // during a session-tape replay (SPEC §2.1: replay is never the live stream), so gating the mid
  // STREAM READ on `claim` alone left it permanently `null` for the whole replay arm — the mid would
  // never reach F6 with a real number, only ever the empty literal, which is not "full strength."
  // `tape.live.mid` genuinely carries replayed values during a session tape (mirrors
  // `live-tape/LiveTape.tsx`'s `net_flow`/`gamma_flip` reads, which already use this same gate) — the
  // wire ships the same envelope shape either way. `claim` itself (below) is UNCHANGED and still
  // governs `midLive`/the live dot: never true during replay.
  const sampleMidActive = Boolean(
    sampleStanding &&
    tape.live?.ticker.toUpperCase() === symbol.toUpperCase() &&
    tape.live.live === false,
  );
  const numbersActive = st ? tape.displayActive : claim || sampleMidActive;
  // The RAW stream mid (never a `?? bundle` composition) — the value FE-2's latch is fed
  // (`useStreamLatch`'s own contract: "the value AS RECEIVED ON THE STREAM").
  const midStream = numbersActive ? (tape.live?.mid ?? null) : null;
  const resetToken = `${symbol.toUpperCase()}|${st ? 'replay' : sampleStanding ? 'sample' : 'live'}`;
  const midLatch = useStreamLatch(midStream, resetToken);
  const midLive = andPresent(claim, midStream);
  const displayMid = midLatch.value;
  // Same discipline `live-tape/LiveTape.tsx` already established: a session-tape replay is never
  // reported through the "offline" arm — it has its own standing.
  const tileOffline = st ? false : tape.streamOffline;
  const lastTrade = claim && tape.live?.last_trade != null ? tape.live.last_trade : null;

  // GATE Z (FE-11) — SPEC §4.1's ladder mid-row offline/stale treatment, mechanised by branching on
  // the STANDING UNION (live / offline / replay), never on `!isLive`: `midOffline` and `midReplay` are
  // mutually exclusive BY CONSTRUCTION (`tileOffline` is defined as `st ? false : streamOffline`, so
  // it can never be true while `st` — a replay standing — holds). This is the exact mechanism
  // criterion 16b requires: implemented as `!isLive -> pause mark`, a replay standing (where `midLive`
  // is always false) would wrongly wear one; implemented over this standing union, it structurally
  // cannot, because replay is not offline.
  const midOffline = useMemo(
    () => (tileOffline ? { retained: midLatch.retained } : null),
    [tileOffline, midLatch.retained],
  );
  const midReplay = Boolean(st);
  // P-3: the sample tape names the scenario it replays, never an advancing clock or "running".
  const sampleCaption = sampleStanding
    ? sampleReplayLine(scenarioAsOf(), tape.live?.flow_window_s ?? 60)
    : null;
  const sampleStatusCaption =
    sampleStanding?.playback === 'paused'
      ? 'Simulated playback paused. Showing the last sample.'
      : sampleStanding?.playback === 'ended'
        ? 'Sample playback complete. Showing the last sample.'
        : null;

  const anchor = levelSpot(m);
  const rows = useMemo(
    () =>
      buildLadder({
        callWall: m.call_wall,
        putWall: m.put_wall,
        maxPain: m.max_pain,
        gammaFlip: m.gamma_flip,
        mid: displayMid,
        midLive,
        midOffline,
        midReplay,
        anchor,
      }),
    [
      m.call_wall,
      m.put_wall,
      m.max_pain,
      m.gamma_flip,
      displayMid,
      midLive,
      midOffline,
      midReplay,
      anchor,
    ],
  );
  const anchorText = formatAnchorText(anchor);
  const ageLabel = structureAgeSeconds != null ? humanAge(structureAgeSeconds) : 'unknown age';
  // Repair task item 6 — the design's basis line (`desk.mjs:294`), verbatim: what the field plots,
  // the expirations scope (the SAME phrase `TickerHeader` states beside the headline — never a
  // second computation), then the REST/tape provenance clause this hero already carried. The demo
  // names its scenario instead of a clock age (P-3).
  const basis = DESK_IS_SAMPLE
    ? `Net dealer gamma by strike · ${expirationsLabel} · ${SCENARIO_STAMP}`
    : `Net dealer gamma by strike · ${expirationsLabel} · ` +
      `levels are REST structure (as-of ${ageLabel}) · the mid is tape`;
  const structureMid = anchor ?? m.price;

  const windowed = useMemo(
    () => windowedStrikes(strikes, structureMid, m.call_wall, m.put_wall, m.gamma_flip, m.max_pain),
    [strikes, structureMid, m.call_wall, m.put_wall, m.gamma_flip, m.max_pain],
  );
  const fieldModel: StructureFieldModel | null = useMemo(() => {
    if (windowed.length < 2) return null;
    const asOfSec =
      structureAgeSeconds != null && Number.isFinite(structureAgeSeconds)
        ? Date.now() / 1000 - structureAgeSeconds
        : null;
    return {
      symbol: symbol || m.ticker || 'GEX',
      samples: rowsToSamples(windowed),
      spot: structureMid,
      callWall: m.call_wall,
      putWall: m.put_wall,
      gammaFlip: m.gamma_flip,
      maxPain: m.max_pain,
      asOfSec,
      liveMid: displayMid,
      live: midLive,
      source: 'rest',
    };
  }, [
    windowed,
    structureAgeSeconds,
    symbol,
    m.ticker,
    structureMid,
    m.call_wall,
    m.put_wall,
    m.gamma_flip,
    m.max_pain,
    displayMid,
    midLive,
  ]);

  // P-10 (lane 4): the title states the finding over data, and names the metric otherwise.
  const title = fieldModel
    ? heroFinding({ regime, spot: anchor, flip: m.gamma_flip })
    : FIELD_METRIC;
  const ladderLine = ladderFinding({
    anchor,
    flip: m.gamma_flip,
    callWall: m.call_wall,
    putWall: m.put_wall,
  });
  const regimeCell =
    regime === 'positive_gamma' || regime === 'negative_gamma'
      ? {
          value: regime === 'positive_gamma' ? '+γ long gamma' : '−γ short gamma',
          caption:
            anchor != null && m.gamma_flip != null && m.gamma_flip > 0
              ? `${anchor >= m.gamma_flip ? 'above' : 'below'} the flip by ${Math.abs(((anchor - m.gamma_flip) / m.gamma_flip) * 100).toFixed(1)}%`
              : 'the API’s regime read',
        }
      : null;
  const moveTenor =
    m.straddle_move?.state === 'ok'
      ? (m.straddle_move.tenors.find((t) => t.expiration === m.straddle_move?.primary_expiration) ??
        null)
      : null;

  return (
    <Widget
      id="structure-hero"
      title={title}
      titleWrap
      subtitle={basis}
      info={HERO_INFO}
      span={2}
      bodyPad="none"
      // PASS 2 change 7: the design's `● mid · tape` chip (`widgetHead(..., { live })`) sits BESIDE
      // the title, not inside `actions` — moved here from the `actions` Stack below so it keeps that
      // adjacency once the header wraps at narrow widths (`Widget.tsx`'s new `titleBadge` slot).
      // Gating (`claim &&`) and the chip itself are unchanged — same testid, same live-gate. Its
      // presence and gating are asserted by `live-dot-census.spec.tsx`, not its container.
      titleBadge={claim && <MidTapeChip />}
      actions={
        <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, v: ViewMode | null) => {
              if (v) setView(v);
            }}
            aria-label="Dealer positioning view"
            data-testid="dealer-view-toggle"
          >
            <ToggleButton value="levels" data-testid="dealer-view-levels">
              Field
            </ToggleButton>
            <ToggleButton value="magnet" data-testid="dealer-view-magnet">
              Magnet
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      }
    >
      {/*
       * REPAIR TASK item 1 (composition) — the design's `field-grid` (`desk.mjs:19`): a
       * `minmax(0,1fr) 300px` grid, 340px above a 1600px container, one column below 1000px. The
       * Widget BODY box is the named `panel` container (`Widget.tsx`), so every breakpoint below
       * queries it via `theme.containerQueries('panel')` — the same authority `FigureCell` already
       * queries, never an unnamed/viewport one for THIS layout decision.
       */}
      <Box
        data-testid="structure-hero"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gridTemplateAreas: '"field ladder" "lane ladder"',
          gridTemplateRows: 'auto 1fr',
          [theme.containerQueries('panel').up(1600)]: {
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
          },
          // Lane 4: under a 1000px panel the levels follow the field directly (the second read),
          // ahead of the sample tape line and the session path (the slow lane).
          [theme.containerQueries('panel').down(1000)]: {
            gridTemplateColumns: '1fr',
            gridTemplateAreas: '"field" "ladder" "lane"',
            gridTemplateRows: 'auto',
          },
        }}
      >
        <Box sx={{ gridArea: 'field', minWidth: 0, padding: '10px 6px 0' }}>
          {/* Lane 4: the legend sits over the field it keys (it shared the header with the title,
              the Sample tag, the ⓘ and the toggle, and pushed the finding onto three lines). */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, pb: 0.75 }}>
            <FieldLegend flipColor={palette.gammaFlip} />
          </Box>
          <ErrorBoundary variant="widget" label="Structure field">
            {view === 'magnet' ? (
              <WallMagnetView
                putWall={m.put_wall}
                callWall={m.call_wall}
                gammaFlip={m.gamma_flip}
                spot={structureMid}
                height={300}
                palette={palette}
              />
            ) : (
              fieldModel && (
                <StructureFieldCanvas
                  model={fieldModel}
                  height={300}
                  palette={palette}
                  surfaces={surfaces}
                  table
                />
              )
            )}
          </ErrorBoundary>
        </Box>
        <Box sx={{ gridArea: 'lane', minWidth: 0, padding: '0 6px' }}>
          {sampleStanding ? (
            <Box
              data-testid="sample-mid-readout"
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1,
                px: 0.5,
                py: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                Sample tape · Mid
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontFamily: typographyTokens.monoFontFamily,
                  fontSize: 13,
                  color: 'text.primary',
                }}
              >
                {displayMid != null ? `$${displayMid.toFixed(2)}` : '—'}
              </Typography>
              <Typography
                component="span"
                data-testid="structure-sample-caption"
                variant="caption"
                sx={{ color: 'text.secondary' }}
              >
                {sampleStatusCaption ? `${sampleStatusCaption} ${sampleCaption}` : sampleCaption}
              </Typography>
            </Box>
          ) : (
            <TapeTrailRow
              structureMid={structureMid}
              claim={claim}
              mid={displayMid}
              lastTrade={lastTrade}
              retained={midLatch.retained}
              paused={tileOffline}
              palette={palette}
              surfaces={surfaces}
            />
          )}
          <StructurePathStrip
            symbol={symbol || '—'}
            samples={pathSamples}
            loading={pathLoading}
            error={pathError}
            basis={pathBasis}
          />
        </Box>
        <Box
          sx={{
            gridArea: 'ladder',
            borderLeft: '1px solid',
            borderColor: 'divider',
            padding: '12px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            [theme.containerQueries('panel').down(1000)]: {
              borderLeft: 0,
              borderTop: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'divider',
              padding: '12px 14px',
            },
          }}
        >
          {ladderLine && (
            <Typography
              component="p"
              data-testid="level-ladder-finding"
              sx={{ m: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'text.primary' }}
            >
              {ladderLine}
            </Typography>
          )}
          <LevelLadder rows={rows} anchorText={anchorText} palette={palette} />
          {/* Lane 4: the figures that frame the price fill what was ~180px of empty column at
              1280 (board ticker-desk.mjs ladderChart): the regime in words with its sign (P-11)
              and the move options price, both from the bundle. Under a 1000px panel (the ladder
              runs five-up below the field) they share one row with the ladder foot from 600px. */}
          <Box
            data-testid="structure-hero-figures"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              flex: '1 1 auto',
              [theme.containerQueries('panel').between(600, 1000)]: {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                alignItems: 'end',
                gap: 2,
              },
            }}
          >
            {(regimeCell || moveTenor) && (
              <Box
                data-testid="structure-hero-frame"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  [theme.containerQueries('panel').between(600, 1000)]: {
                    pt: '12px',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  },
                }}
              >
                {regimeCell && (
                  <FigureRow
                    register="traced"
                    direction="column"
                    valueSize={15}
                    label="Regime"
                    value={regimeCell.value}
                    live={NOT_LIVE}
                    caption={regimeCell.caption}
                  />
                )}
                {moveTenor && (
                  <FigureRow
                    register="traced"
                    direction="column"
                    valueSize={15}
                    label="Implied move"
                    value={`±$${Math.abs(moveTenor.move_dollars).toFixed(2)}`}
                    live={NOT_LIVE}
                    caption={`ATM straddle · ${moveTenor.dte} DTE`}
                  />
                )}
              </Box>
            )}
            <LadderFoot volNormalizedGex={m.vol_normalized_gex} netGex={m.net_gex} />
          </Box>
        </Box>
      </Box>
    </Widget>
  );
}

export default StructureHeroPanel;
