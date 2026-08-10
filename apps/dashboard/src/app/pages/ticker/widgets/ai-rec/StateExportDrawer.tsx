/**
 * StateExportDrawer — the always-available export floor (UX_BLUEPRINT §4 + egress honesty).
 * Opened from `View what's sent` in the rec panel (the SAME export feeds both the in-app call and
 * the manual hand-off). It triggers NO in-app LLM call and
 * costs nothing — it works in EVERY rec-panel state (key_not_configured / daily_cap_reached /
 * unavailable). Egress invariant: it shows ONLY {context, persona prompt, glossary} for the current
 * ticker — no key, no other ticker, no identity, no order data.
 */
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { fetchRecExport, RecExport } from '@convexa/api';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { COPY, EXPORT_HEADER } from './copy';

function sectionText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function StateExportDrawer({
  open,
  ticker,
  personaId,
  onClose,
}: {
  open: boolean;
  ticker: string;
  personaId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<RecExport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [toast, setToast] = useState(false);

  // Fetch the export each time the drawer opens (or the read-persona changes). No in-app LLM call.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState('loading');
    setData(null);
    fetchRecExport(ticker, { personaId })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setState('idle');
        }
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, ticker, personaId]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setToast(true);
  };
  const allText = data
    ? [
        `# ${EXPORT_HEADER(ticker)}`,
        data.egress_note,
        '\n## Computed snapshot (context)\n' + sectionText(data.context),
        '\n## Persona prompt\n' + sectionText(data.persona_prompt),
        '\n## Field glossary\n' + sectionText(data.glossary),
      ].join('\n')
    : '';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 420 },
            p: 2.5,
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
        },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary' }}>
            {EXPORT_HEADER(ticker)}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close export"
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Egress-honesty banner (binding copy) — the complete, reviewable list of what leaves. */}
        <Box
          role="status"
          sx={{
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.14),
            color: (theme) => theme.palette.info.light ?? theme.palette.info.main,
            borderRadius: '8px',
            px: 1.5,
            py: 1.25,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {data?.egress_note ?? COPY.export.egress.replace('{TICKER}', ticker)}
        </Box>

        {state === 'loading' && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Loading the export…
            </Typography>
          </Stack>
        )}
        {state === 'error' && (
          <Alert severity="warning">Couldn't load the export right now — try reopening.</Alert>
        )}

        {data && state === 'idle' && (
          <>
            <Button
              variant="contained"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
              onClick={() => copy(allText)}
            >
              {COPY.export.copyAll}
            </Button>

            <ExportSection
              title="Computed snapshot (context)"
              caption="A serialization of what Convexa already computed — no recompute, no new fetch. Null stays null."
              text={sectionText(data.context)}
              onCopy={copy}
            />
            <ExportSection
              title="Persona prompt"
              text={sectionText(data.persona_prompt)}
              onCopy={copy}
            />
            <ExportSection title="Field glossary" text={sectionText(data.glossary)} onCopy={copy} />
          </>
        )}
      </Stack>

      <Snackbar
        open={toast}
        autoHideDuration={2000}
        onClose={() => setToast(false)}
        message={COPY.export.copied}
      />
    </Drawer>
  );
}

function ExportSection({
  title,
  caption,
  text,
  onCopy,
}: {
  title: string;
  caption?: string;
  text: string;
  onCopy: (t: string) => void;
}) {
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 600, fontSize: 13, color: 'text.primary' }}>
          {title}
        </Typography>
        {/* KEEP amber (stage-3 §4.1: brand-flavored action affordance), but TEXT-GRADE — 11px
            amber text binds `textAmber` via extrasFor (light-mode contrast gate §5.2). */}
        <Button
          onClick={() => onCopy(text)}
          sx={(t) => ({ minWidth: 0, p: 0.25, fontSize: 11, color: extrasFor(t).textAmber })}
        >
          COPY
        </Button>
      </Stack>
      {caption && (
        <Typography
          sx={{ fontSize: 11, color: 'text.disabled', lineHeight: 1.4, display: 'block', mb: 0.75 }}
        >
          {caption}
        </Typography>
      )}
      <Box
        component="pre"
        sx={{
          m: 0,
          mt: caption ? 0 : 0.75,
          px: 1.5,
          py: 1.25,
          borderRadius: '8px',
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          fontFamily: typographyTokens.monoFontFamily,
          fontSize: 11,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 220,
          overflow: 'auto',
        }}
      >
        {text || '—'}
      </Box>
    </Box>
  );
}
