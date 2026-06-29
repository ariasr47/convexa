/**
 * StateExportDrawer — the always-available export floor (UX_BLUEPRINT §4 + egress honesty).
 * Opened from `View what's sent` in the rec panel AND from the persona `HandoffDialog` (the SAME
 * export feeds both the in-app call and the manual hand-off). It triggers NO in-app LLM call and
 * costs nothing — it works in EVERY rec-panel state (key_not_configured / daily_cap_reached /
 * unavailable). Egress invariant: it shows ONLY {context, persona prompt, glossary} for the current
 * ticker — no key, no other ticker, no identity, no order data.
 */
import { useEffect, useState } from 'react';
import {
  Drawer, Box, Stack, Typography, Button, IconButton, Alert, Divider, Snackbar, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { fetchRecExport, RecExport } from '@org/api';
import { COPY, EXPORT_HEADER } from './copy';

function sectionText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function StateExportDrawer({ open, ticker, personaId, onClose }: {
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
      .then((d) => { if (!cancelled) { setData(d); setState('idle'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [open, ticker, personaId]);

  const copy = (text: string) => { navigator.clipboard?.writeText(text); setToast(true); };
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
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 }, p: 2 } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6">{EXPORT_HEADER(ticker)}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close export"><CloseIcon fontSize="small" /></IconButton>
      </Stack>

      {/* Egress-honesty banner (binding copy) — the complete, reviewable list of what leaves. */}
      <Alert severity="info" icon={false} sx={{ mb: 2 }}>
        {data?.egress_note ?? COPY.export.egress.replace('{TICKER}', ticker)}
      </Alert>

      {state === 'loading' && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} /><Typography variant="body2" color="text.secondary">Loading the export…</Typography>
        </Stack>
      )}
      {state === 'error' && (
        <Alert severity="warning">Couldn't load the export right now — try reopening.</Alert>
      )}

      {data && state === 'idle' && (
        <Stack spacing={2}>
          <Button variant="contained" size="small" sx={{ alignSelf: 'flex-start' }}
            onClick={() => copy(allText)}>{COPY.export.copyAll}</Button>

          <ExportSection title="Computed snapshot (context)"
            caption="A serialization of what Convexa already computed — no recompute, no new fetch. Null stays null."
            text={sectionText(data.context)} onCopy={copy} />
          <Divider />
          <ExportSection title="Persona prompt" text={sectionText(data.persona_prompt)} onCopy={copy} />
          <Divider />
          <ExportSection title="Field glossary" text={sectionText(data.glossary)} onCopy={copy} />
        </Stack>
      )}

      <Snackbar open={toast} autoHideDuration={2000} onClose={() => setToast(false)} message={COPY.export.copied} />
    </Drawer>
  );
}

function ExportSection({ title, caption, text, onCopy }: {
  title: string; caption?: string; text: string; onCopy: (t: string) => void;
}) {
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Button size="small" onClick={() => onCopy(text)}>Copy</Button>
      </Stack>
      {caption && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{caption}</Typography>}
      <Box component="pre" sx={{
        m: 0, p: 1, borderRadius: 1, bgcolor: 'action.hover', fontSize: 11, fontFamily: 'monospace',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto',
      }}>{text || '—'}</Box>
    </Box>
  );
}
