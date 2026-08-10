/**
 * Structured reasoning presentation for AI-rec (pure helpers + UI sections).
 */
import { typographyTokens } from '@/shared/theme/tokens';
import type { RecStrategy, TickerBundle } from '@convexa/api';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Button, Collapse, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { COPY } from './copy';

const MONO = typographyTokens.monoFontFamily;

export function Field({
  label,
  value,
  tip,
}: {
  label: string;
  value: React.ReactNode;
  tip?: string;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        {tip && (
          <Tooltip arrow title={tip}>
            <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          </Tooltip>
        )}
      </Stack>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

// ---- Structured reasoning (the redesigned read) ----------------------------------------------
/** Split off the first sentence as a lead; the remainder is the "rest". No lookbehind (portable). */
export function leadAndRest(text: string): { lead: string; rest: string } {
  const t = (text || '').trim();
  if (!t) return { lead: '', rest: '' };
  const m = t.match(/^[\s\S]*?[.!?](?:\s|$)/);
  if (!m) return { lead: t, rest: '' };
  return { lead: m[0].trim(), rest: t.slice(m[0].length).trim() };
}

/** Derive the display parts from a strategy: a one-line lead, the detail body behind the toggle, and
 *  the key-points / re-engage lists. `summary` wins as the lead; otherwise the first sentence of the
 *  rationale is the lead and the remaining sentences become the detail (so nothing is shown twice). */
export function deriveReasoning(
  s: Pick<RecStrategy, 'summary' | 'key_points' | 'reengage_when' | 'rationale'>,
) {
  const summary = (s.summary ?? '').trim() || null;
  const { lead: first, rest } = leadAndRest(s.rationale ?? '');
  return {
    lead: summary ?? first,
    detail: summary ? (s.rationale ?? '').trim() : rest,
    keyPoints: (s.key_points ?? []).map((x) => x.trim()).filter(Boolean),
    reengage: (s.reengage_when ?? []).map((x) => x.trim()).filter(Boolean),
  };
}

const fmtCompact = (n: number): string => {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(a)}`;
};

/** A small uppercase section label (the panel's existing caption idiom). */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        color: 'text.disabled',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: 11,
        fontWeight: 500,
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

/** "Levels in play" — chips sourced straight from the cached bundle (no recompute, no new fetch).
 *  Context, not a signal; omitted when the bundle isn't present. */
export function LevelsStrip({ bundle }: { bundle: TickerBundle | null }) {
  const m = bundle?.market_state;
  if (!m) return null;
  const items: { k: string; v: string }[] = [];
  const add = (
    k: string,
    v: number | null | undefined,
    fmt: (n: number) => string = (n) => String(n),
  ) => {
    if (v != null) items.push({ k, v: fmt(v) });
  };
  add('call wall', m.call_wall);
  add('gamma flip', m.gamma_flip);
  add('put wall', m.put_wall);
  add('max pain', m.max_pain);
  add('net GEX', m.net_gex, fmtCompact);
  add('IV/HV', m.iv_hv_ratio, (n) => n.toFixed(2));
  add('VWAP', m.vwap);
  if (!items.length) return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <SectionLabel>{COPY.reasoning.levels}</SectionLabel>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {items.map(({ k, v }) => (
          <Box
            key={k}
            sx={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 0.75,
              px: 1,
              py: 0.5,
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11 }}>
              {k}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.primary', fontFamily: MONO }}>
              {v}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

/** Full reasoning prose, split into readable paragraphs with a constrained measure. */
function ReasoningProse({ text }: { text: string }) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const list = paras.length ? paras : [text.trim()];
  return (
    <>
      {list.map((p, i) => (
        <Typography
          key={i}
          variant="body2"
          sx={{
            color: 'text.secondary',
            lineHeight: 1.7,
            maxWidth: '64ch',
            mb: i < list.length - 1 ? 1 : 0,
          }}
        >
          {p}
        </Typography>
      ))}
    </>
  );
}

/** Structured reasoning: (optional lead) · Why bullets · Re-engage list · collapsible full read.
 *  `suppressLead` is set when a verdict hero already shows the lead (the no_trade card). */
export function ReasoningSection({
  strategy,
  suppressLead = false,
  reengageLabel = COPY.reasoning.reengage,
}: {
  strategy: RecStrategy;
  suppressLead?: boolean;
  reengageLabel?: string;
}) {
  const { lead, detail, keyPoints, reengage } = deriveReasoning(strategy);
  const [open, setOpen] = useState(false);
  return (
    <Stack spacing={1.5}>
      {!suppressLead && lead && <Field label={COPY.reasoning.rationale} value={lead} />}
      {keyPoints.length > 0 && (
        <Box>
          <SectionLabel>{COPY.reasoning.keyPoints}</SectionLabel>
          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {keyPoints.map((k, i) => (
              <Typography
                key={i}
                component="li"
                variant="body2"
                sx={{ color: 'text.secondary', lineHeight: 1.6 }}
              >
                {k}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}
      {reengage.length > 0 && (
        <Box>
          <SectionLabel>{reengageLabel}</SectionLabel>
          <Stack spacing={0.5}>
            {reengage.map((r, i) => (
              <Stack key={i} direction="row" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
                <Box component="span" aria-hidden sx={{ color: 'text.disabled', lineHeight: 1.6 }}>
                  →
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {r}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
      {detail && (
        <Box>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionLabel>{COPY.reasoning.fullRead}</SectionLabel>
            <Button
              size="small"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 500 }}
            >
              {open ? COPY.reasoning.showLess : COPY.reasoning.showMore}
            </Button>
          </Stack>
          <Collapse in={open}>
            <Box sx={{ mt: 0.5 }}>
              <ReasoningProse text={detail} />
            </Box>
          </Collapse>
        </Box>
      )}
    </Stack>
  );
}
