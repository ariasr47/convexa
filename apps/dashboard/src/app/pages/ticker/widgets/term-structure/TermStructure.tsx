/**
 * TermStructureCard — ATM IV by tenor, re-composed by the ticker fidelity repair (F2,
 * `design/src/screens/desk.mjs:43`'s `termRibbon()`): a compact ribbon of tenor cells (value +
 * tenor per cell, an amber fill scaled to the tenor's relative IV) then one state/slope line —
 * "**not** a 230 px canvas over 240 px of air" (the repair task's own words) — replacing the
 * `TermHeatChart` canvas this card used to render at `height={168}`.
 *
 * `TermHeatChart.tsx` itself is separately repaired for its theme/hex defect (F9 — see that file's
 * own module doc) but is not mounted by this card after this repair: `Widget`'s `⤢` expand renders
 * the SAME children larger, never different content, so there is no seam today to show the fuller
 * canvas view on expand without new shared `Widget`-level overlay-content plumbing this task's
 * blast radius does not call for. Residual, recorded in the repair report.
 *
 * Cross-tenor; ignores DTE filter; static bundle field, never offline-dimmed.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Widget } from '@/shared/ui/Widget';
import type { TermStructure } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { memo } from 'react';
import { sampleTermPoints, termTip, withStructureAge } from '../_kit/copy';

const MONO = typographyTokens.monoFontFamily;

interface Props {
  termStructure: TermStructure | null;
  structureAgeSeconds?: number | null;
}

/** Signed 1dp, U+2212 minus — this codebase's own convention (`_kit/copy.ts`'s `fmtSigned2`). */
const fmtSlope = (v: number): string => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`;

/** One tenor cell — DTE + ATM IV, an amber fill scaled to this tenor's IV within the sampled
 *  range (the ribbon's own "heat", `desk.mjs`'s `termRibbon` bars — MUI theme token, never a
 *  hardcoded hex; `primary.main` IS the design's `--amber`, `tokens.ts`'s brand-amber mapping). */
function TenorCell({ dte, atmIv, intensity }: { dte: number; atmIv: number; intensity: number }) {
  return (
    <Box
      data-testid="term-tenor-cell"
      sx={(theme) => ({
        flex: '1 1 0',
        minWidth: 0,
        borderRadius: '6px',
        textAlign: 'center',
        py: 0.5,
        bgcolor: alpha(theme.palette.primary.main, 0.14 + intensity * 0.5),
      })}
    >
      <Typography
        variant="caption"
        sx={{ display: 'block', fontFamily: MONO, fontWeight: 600, color: 'text.primary' }}
      >
        {atmIv.toFixed(1)}
      </Typography>
      {/* 11px chip/label floor (convexa-design rule 7) — the design's own SVG
          tenor label is 10px raw canvas/SVG text, not bound by this app's MUI chip/label floor. */}
      <Typography
        variant="caption"
        sx={{ display: 'block', color: 'text.secondary', fontSize: 11 }}
      >
        {dte}d
      </Typography>
    </Box>
  );
}

export const TermStructureCard = memo(function TermStructureCard({
  termStructure,
  structureAgeSeconds = null,
}: Props) {
  const termSampled = termStructure ? sampleTermPoints(termStructure.points) : [];
  const unavailable = termStructure == null || termSampled.length === 0;

  const stateLabel =
    unavailable || !termStructure || termStructure.points.length < 2 ? '—' : termStructure.state;
  const subtitle = withStructureAge(`ATM IV by tenor · ${stateLabel}`, structureAgeSeconds);

  const ivs = termSampled.map((p) => p.atm_iv);
  const min = ivs.length ? Math.min(...ivs) : 0;
  const max = ivs.length ? Math.max(...ivs) : 0;
  const span = max - min || 1;

  return (
    <Widget
      id="term-structure"
      title="Term structure"
      subtitle={subtitle}
      info={termStructure ? termTip(termStructure) : undefined}
    >
      <Box data-testid="term-structure">
        {unavailable || !termStructure ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Term structure unavailable this cycle.
          </Typography>
        ) : (
          <>
            <Box data-testid="term-ribbon" sx={{ display: 'flex', gap: 0.5 }}>
              {termSampled.map((p) => (
                <TenorCell
                  key={p.expiration}
                  dte={p.dte}
                  atmIv={p.atm_iv}
                  intensity={(p.atm_iv - min) / span}
                />
              ))}
            </Box>
            {/* State + slope — the wire's OWN `slope` field (`TermStructureWire.slope`), never
                re-derived FE-side; the state word is rendered as the read strip already renders it
                (`readStripModel.ts`) — a small closed backend enum, not a raw wire descriptor. */}
            <Typography
              variant="caption"
              data-testid="term-ribbon-state"
              sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
            >
              {termStructure.state.charAt(0).toUpperCase() + termStructure.state.slice(1)}
              {' · slope '}
              <Box component="span" sx={{ fontFamily: MONO }}>
                {fmtSlope(termStructure.slope)}
              </Box>
            </Typography>
          </>
        )}
      </Box>
    </Widget>
  );
});

export default TermStructureCard;
