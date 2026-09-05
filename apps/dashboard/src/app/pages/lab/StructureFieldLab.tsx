/**
 * /lab/structure-field — dual-clock Structure Field lab.
 * Default: synthetic demo (no auth, no API required).
 * Optional: load SPY structure from REST.
 * Renderer toggle: Canvas2D (original) vs WebGL2 (comparison twin).
 */
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { extrasFor } from '@/shared/theme/tokens';
import { getTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { StructureFieldCanvas } from './StructureFieldCanvas';
import { StructureFieldWebGL } from './StructureFieldWebGL';
import { buildDemoField, samplesFromStrikes, type StructureFieldModel } from './structureFieldDemo';
// Note: Lab hub lives at /lab — this page is the shipped Structure Field deep-link.

type Renderer = 'canvas2d' | 'webgl';

export function StructureFieldLab() {
  const [useLive, setUseLive] = useState(false);
  const [liveModel, setLiveModel] = useState<StructureFieldModel | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [renderer, setRenderer] = useState<Renderer>('canvas2d');

  // Mechanical fix mirroring FE-1's DealerPositioning.tsx precedent: StructureFieldCanvas's
  // `palette`/`surfaces` props became required at FE-3 (SPEC §2.7); this lab-only call site is not
  // one of FE-3's owned paths but must satisfy the new prop shape for `npm run typecheck` (not
  // deferred). Out of this phase's product scope otherwise.
  const theme = useTheme();
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

  // Demo live-mid drift (~20fps is enough for delight; instruments paint on rAF).
  useEffect(() => {
    if (useLive) return;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [useLive]);

  const demo = useMemo(() => {
    void tick;
    return buildDemoField(Date.now());
  }, [tick]);

  const loadSpy = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const bundle = await getTicker('SPY', { darkPool: false });
      const m = bundle.market_state;
      const samples = samplesFromStrikes(bundle.strike_profile?.strikes ?? []);
      if (samples.length < 8) {
        setErr('SPY chain too thin or unavailable — staying on demo field.');
        setLiveModel(null);
        return;
      }
      setLiveModel({
        symbol: 'SPY',
        samples,
        spot: m.gex_spot ?? m.price ?? samples[Math.floor(samples.length / 2)].strike,
        callWall: m.call_wall ?? samples[samples.length - 1].strike,
        putWall: m.put_wall ?? samples[0].strike,
        gammaFlip: m.gamma_flip ?? m.price ?? samples[Math.floor(samples.length / 2)].strike,
        asOfSec:
          bundle.meta?.freshness?.data_age_seconds != null
            ? Date.now() / 1000 - bundle.meta.freshness.data_age_seconds
            : Date.now() / 1000,
        liveMid: m.price ?? null,
        live: false,
        source: 'live',
      });
      setUseLive(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load SPY structure');
      setUseLive(false);
      setLiveModel(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const model = useLive && liveModel ? liveModel : demo;

  useEffect(() => {
    document.title = 'Structure Field · Lab — Convexa';
    return () => {
      document.title = 'Convexa';
    };
  }, []);

  return (
    <Box
      data-testid="structure-field-lab"
      sx={{
        minHeight: '70vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        pb: 6,
      }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={1.5} sx={{ mb: 2.5, maxWidth: 760 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip label="Lab" size="small" color="primary" variant="outlined" />
            <Chip
              label={model.source === 'demo' ? 'Synthetic field' : 'REST structure'}
              size="small"
              variant="outlined"
            />
            <Chip
              label={renderer === 'webgl' ? 'WebGL2' : 'Canvas2D'}
              size="small"
              color="primary"
              variant="filled"
            />
          </Stack>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Structure Field
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
            Dual-clock dealer-GEX instrument. Same model, two renderers — flip between Canvas2D (CPU
            paint + offscreen structure buffer) and WebGL2 (GPU heat field + point particles) to
            compare feel and cost. Walls, flip, and tape mid are the same data; only the paint path
            changes.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            sx={{ pt: 0.5, alignItems: { sm: 'center' } }}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={renderer}
              onChange={(_, v: Renderer | null) => {
                if (v) setRenderer(v);
              }}
              aria-label="Structure Field renderer"
              data-testid="structure-field-renderer-toggle"
            >
              <ToggleButton value="canvas2d" data-testid="renderer-canvas2d">
                Canvas2D
              </ToggleButton>
              <ToggleButton value="webgl" data-testid="renderer-webgl">
                WebGL2
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant={useLive ? 'outlined' : 'contained'}
              onClick={() => {
                setUseLive(false);
                setLiveModel(null);
                setErr(null);
              }}
            >
              Demo field
            </Button>
            <Button variant="outlined" disabled={loading} onClick={() => void loadSpy()}>
              {loading ? 'Loading SPY…' : 'Use live SPY structure'}
            </Button>
            <Button component={RouterLink} to="/lab" variant="text">
              All demos
            </Button>
            <Button component={RouterLink} to="/methodology" variant="text">
              Methodology
            </Button>
            <Button component={RouterLink} to="/ticker/SPY" variant="text">
              Open SPY ticker
            </Button>
          </Stack>
          {err && (
            <Typography variant="body2" color="warning.main">
              {err}
            </Typography>
          )}
        </Stack>

        {renderer === 'webgl' ? (
          <StructureFieldWebGL model={model} height={520} />
        ) : (
          <StructureFieldCanvas
            model={model}
            height={520}
            palette={palette}
            surfaces={surfaces}
          />
        )}

        <Stack spacing={1} sx={{ mt: 3, maxWidth: 760 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {renderer === 'webgl' ? 'WebGL2 path' : 'Canvas2D path'} — what to compare
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            {renderer === 'webgl' ? (
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>
                  <strong>GPU heat field</strong> — 1D GEX texture sampled in a fragment shader
                  every pixel (continuous density, wall blooms, warped force lines, flip breath,
                  scan, mid beam).
                </li>
                <li>
                  <strong>Curve ribbon</strong> — triangle-strip with glow + phosphor core on the
                  GPU.
                </li>
                <li>
                  <strong>Point particles</strong> — up to ~160 GL points with soft point sprites
                  (more than the Canvas2D sim).
                </li>
                <li>
                  <strong>Text overlay</strong> — labels still Canvas2D (WebGL has no text API);
                  honesty caption includes “WebGL2”.
                </li>
                <li>
                  <strong>Fallback</strong> — if WebGL2 is missing, an error panel points you back
                  to Canvas2D.
                </li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>
                  <strong>Structure buffer</strong> — offscreen Canvas2D rebuild only when the model
                  changes.
                </li>
                <li>
                  <strong>CPU field physics</strong> — particles, warps, flip well, mid trail
                  painted each frame in JS.
                </li>
                <li>
                  <strong>Richer probe UI</strong> — magnet disk + strength bar fully in the same
                  context (no shader split).
                </li>
                <li>
                  <strong>Honesty</strong> — structure as-of vs tape status; metaphors never claimed
                  as live gamma ticks.
                </li>
              </ul>
            )}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default StructureFieldLab;
