/**
 * StructureHeroPanel — the structure-field hero (curvature-v2-desk-and-read, SPEC §2.1/§2.5/§4.2).
 * ONE `Widget`, four PRESENTATIONAL children: `StructureFieldCanvas` · `LevelLadder` ·
 * `TapeTrailRow` · `StructurePathStrip` (plus the Field/Magnet toggle's `WallMagnetView`, an
 * alternate paint for the same canvas region).
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
import { andPresent, isDeliveringLive } from '@/shared/liveness/liveClaim';
import { extrasFor } from '@/shared/theme/tokens';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Widget } from '@/shared/ui/Widget';
import type { MarketState, StrikeRow, StructureSample } from '@convexa/api';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useLiveTape } from '../../liveTapeStore';
import { sessionTapeOf } from '../../sessionTapeStanding';
import { humanAge } from '../_kit/copy';
import { levelSpot } from '../_kit/distanceToLevel';
import { useStreamLatch } from '../_kit/useStreamLatch';
import { rowsToSamples, windowedStrikes } from '../gex-profile-chart/chart';
import { buildLadder, formatAnchorText, LevelLadder } from '../level-ladder';
import { StructurePathStrip } from '../structure-history/StructurePathStrip';
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
}

const HERO_INFO =
  'Net dealer gamma by strike as a dual-clock Structure Field, the five-level ladder beside it, ' +
  'the tape mid trail, and the session structure path. Levels (walls, flip, max pain) are REST ' +
  'structure; the mid is the only figure the live tape drives. The Field/Magnet toggle is a display ' +
  'preference — it never changes what is measured, only how the same levels are drawn.';

type ViewMode = 'levels' | 'magnet';

export function StructureHeroPanel({
  symbol,
  m,
  strikes,
  structureAgeSeconds = null,
  pathSamples = null,
  pathLoading = false,
  pathError = null,
  pathBasis = null,
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
  // The RAW stream mid, gated on the base claim (never a `?? bundle` composition) — the value FE-2's
  // latch is fed (`useStreamLatch`'s own contract: "the value AS RECEIVED ON THE STREAM").
  const midStream = claim ? (tape.live?.mid ?? null) : null;
  const resetToken = `${symbol.toUpperCase()}|${st ? 'replay' : 'live'}`;
  const midLatch = useStreamLatch(midStream, resetToken);
  const midLive = andPresent(claim, midStream);
  const displayMid = midLatch.value;
  // Same discipline `live-tape/LiveTape.tsx` already established: a session-tape replay is never
  // reported through the "offline" arm — it has its own standing.
  const tileOffline = st ? false : tape.streamOffline;
  const lastTrade = claim && tape.live?.last_trade != null ? tape.live.last_trade : null;

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
        anchor,
      }),
    [m.call_wall, m.put_wall, m.max_pain, m.gamma_flip, displayMid, midLive, anchor],
  );
  const anchorText = formatAnchorText(anchor);
  const ageLabel = structureAgeSeconds != null ? humanAge(structureAgeSeconds) : 'unknown age';
  const basis = `levels are REST structure (as-of ${ageLabel}) · the mid is tape`;
  const structureMid = anchor ?? m.price;

  const windowed = useMemo(
    () => windowedStrikes(strikes, structureMid, m.call_wall, m.put_wall),
    [strikes, structureMid, m.call_wall, m.put_wall],
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
    displayMid,
    midLive,
  ]);

  return (
    <Widget
      id="structure-hero"
      title={symbol}
      subtitle={basis}
      info={HERO_INFO}
      span={2}
      bodyPad="none"
      actions={
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
            Levels
          </ToggleButton>
          <ToggleButton value="magnet" data-testid="dealer-view-magnet">
            Magnet
          </ToggleButton>
        </ToggleButtonGroup>
      }
    >
      <Box data-testid="structure-hero">
        <ErrorBoundary variant="widget" label="Structure field">
          {view === 'magnet' ? (
            <WallMagnetView
              putWall={m.put_wall}
              callWall={m.call_wall}
              gammaFlip={m.gamma_flip}
              spot={structureMid}
            />
          ) : (
            fieldModel && (
              <StructureFieldCanvas
                model={fieldModel}
                height={300}
                variant="ticker"
                palette={palette}
                surfaces={surfaces}
              />
            )
          )}
        </ErrorBoundary>
        <LevelLadder rows={rows} anchorText={anchorText} palette={palette} />
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
        <StructurePathStrip
          symbol={symbol || '—'}
          samples={pathSamples}
          loading={pathLoading}
          error={pathError}
          basis={pathBasis}
        />
      </Box>
    </Widget>
  );
}

export default StructureHeroPanel;
