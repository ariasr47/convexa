/**
 * Wall Magnet — the Dealer positioning view's second form (Field | Magnet toggle): the structure
 * levels on one price scale with the structure spot among them (TD-03, design/src/screens/v5/
 * families-desk.mjs `magnetAfter`).
 *
 * What it says depends on the side of the flip. Above it dealers are long gamma and their hedging
 * tends to damp moves; below it they are short gamma and hedging tends to amplify them. The canvas
 * this replaces said "dealers dampen moves here" on both sides — a wrong fact below the flip, and the
 * opposite of what the live tape says (LiveTape.tsx). It was also a canvas with no role or label,
 * 10px text and a requestAnimationFrame loop that never stopped.
 *
 * Now HTML: levels as lines with their names and prices as 11px text (labels that would touch move
 * to a second row), the long-gamma zone above the flip as a band, the spot as a phosphor dot (it is
 * the REST levels spot, not the live mid, so it is not tape blue). The dot eases to a new spot in
 * 400ms (a data tween, P-12), instantly under reduced motion. Gamma sign keeps green/red on the walls
 * and always says it in words too (P-11).
 */
import { chartRoles } from '@/shared/charts/frame';
import type { LevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { useLayoutEffect, useRef, useState } from 'react';

const MONO = typographyTokens.monoFontFamily;
const CH = 6.8;

export interface WallMagnetViewProps {
  putWall: number;
  callWall: number;
  gammaFlip: number;
  spot: number;
  height?: number;
  /** The hero's level colours, so the walls and the flip match its legend and the ladder beside it. */
  palette: LevelPalette;
}

const pct = (v: number) => `${Math.abs(v).toFixed(1)}%`;

/** The read, by side of the flip: where the spot sits and how far the nearer wall is. */
export function magnetRead({
  putWall,
  callWall,
  gammaFlip,
  spot,
}: Pick<WallMagnetViewProps, 'putWall' | 'callWall' | 'gammaFlip' | 'spot'>) {
  const above = spot >= gammaFlip;
  const fromFlip = gammaFlip ? ((spot - gammaFlip) / gammaFlip) * 100 : 0;
  const toCall = ((callWall - spot) / spot) * 100;
  const toPut = ((spot - putWall) / spot) * 100;
  const wall =
    Math.abs(toCall) <= Math.abs(toPut)
      ? `${pct(toCall)} ${toCall >= 0 ? 'below' : 'above'} the call wall`
      : `${pct(toPut)} ${toPut >= 0 ? 'above' : 'below'} the put wall`;
  return {
    above,
    finding: `Spot ${spot.toFixed(2)} sits ${pct(fromFlip)} ${above ? 'above' : 'below'} the flip: inside the ${above ? 'long' : 'short'}-gamma zone, ${wall}`,
    meaning: above
      ? `Above the flip (${gammaFlip.toFixed(2)}) dealers are long gamma: their hedging tends to damp moves.`
      : `Below the flip (${gammaFlip.toFixed(2)}) dealers are short gamma: their hedging tends to amplify moves.`,
  };
}

export function WallMagnetView({
  putWall,
  callWall,
  gammaFlip,
  spot,
  height = 300,
  palette,
}: WallMagnetViewProps) {
  const t = useTheme();
  const roles = chartRoles(t);
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const read = magnetRead({ putWall, callWall, gammaFlip, spot });
  const lo = Math.min(putWall, callWall, gammaFlip, spot);
  const hi = Math.max(putWall, callWall, gammaFlip, spot);
  const pad = (hi - lo) * 0.12 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const X = (v: number) => ((v - min) / (max - min)) * W;

  // Level labels in up to two rows above the scale; a label that still touches drops to the legend
  // line under the chart, which always lists every level.
  const levels = [
    { key: 'put', v: putWall, name: 'Put wall', color: palette.putWall },
    { key: 'flip', v: gammaFlip, name: 'Flip', color: palette.gammaFlip },
    { key: 'call', v: callWall, name: 'Call wall', color: palette.callWall },
  ];
  const rows: { left: number; w: number }[][] = [[], []];
  const placed = new Map<string, { row: number; left: number }>();
  if (W > 0)
    for (const l of levels) {
      const w = `${l.name} ${l.v.toFixed(2)}`.length * CH;
      const left = Math.min(Math.max(0, X(l.v) - w / 2), W - w);
      const row = rows.findIndex((r) =>
        r.every((o) => left >= o.left + o.w + 8 || left + w + 8 <= o.left),
      );
      if (row >= 0) {
        rows[row].push({ left, w });
        placed.set(l.key, { row, left });
      }
    }
  const TOP = 40;
  const MID = TOP + 52;

  return (
    <Box
      data-testid="wall-magnet-view"
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        px: 1,
        pt: 0.5,
        minWidth: 0,
      }}
    >
      <Box
        component="p"
        sx={{ m: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4, textWrap: 'balance' }}
      >
        {read.finding}
      </Box>
      <Box
        ref={ref}
        role="img"
        aria-label={`Levels on one price scale: put wall ${putWall.toFixed(2)}, flip ${gammaFlip.toFixed(2)}, call wall ${callWall.toFixed(2)}; spot ${spot.toFixed(2)}, ${read.above ? 'above' : 'below'} the flip.`}
        sx={{
          position: 'relative',
          height: MID + 40,
          fontFamily: MONO,
          fontSize: 11,
          lineHeight: '14px',
        }}
      >
        {W > 0 && (
          <>
            {/* The long-gamma zone: above the flip, to the right edge of the scale. */}
            <Box
              sx={{
                position: 'absolute',
                top: MID - 14,
                height: 28,
                left: X(gammaFlip),
                right: 0,
                bgcolor: roles.band,
                borderTop: `1px solid ${roles.edge}`,
                borderBottom: `1px solid ${roles.edge}`,
              }}
            />
            <Box
              component="span"
              sx={{
                position: 'absolute',
                top: MID + 18,
                left: X(gammaFlip) + 6,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              long gamma →
            </Box>
            <Box
              component="span"
              sx={{
                position: 'absolute',
                top: MID + 18,
                right: W - X(gammaFlip) + 6,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              ← short gamma
            </Box>
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: MID - 1,
                height: 2,
                bgcolor: roles.grid,
              }}
            />
            {levels.map((l) => {
              const p = placed.get(l.key);
              return (
                <Box key={l.key}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: TOP - 4,
                      height: MID - TOP + 22,
                      left: X(l.v) - 1,
                      borderLeft: `2px solid ${l.color}`,
                    }}
                  />
                  {p && (
                    <Box
                      component="span"
                      sx={{
                        position: 'absolute',
                        top: p.row * 16,
                        left: p.left,
                        color: 'text.primary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {l.name} {l.v.toFixed(2)}
                    </Box>
                  )}
                </Box>
              );
            })}
            <Box
              sx={{
                position: 'absolute',
                top: MID - 8,
                left: X(spot) - 8,
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: roles.emph,
                boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
                transition: 'left 400ms ease-out',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            />
          </>
        )}
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 13, lineHeight: 1.5, color: 'text.primary' }}>
        {read.meaning}
      </Box>
      <Box
        component="p"
        sx={{ m: 0, mt: 'auto', fontSize: 12, lineHeight: 1.45, color: 'text.secondary' }}
      >
        Put wall {putWall.toFixed(2)} · flip {gammaFlip.toFixed(2)} · call wall{' '}
        {callWall.toFixed(2)} · structure levels on one price scale: a display of where dealers are
        positioned, not a forecast.
      </Box>
    </Box>
  );
}
