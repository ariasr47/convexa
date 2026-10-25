/**
 * Structured reasoning presentation for AI-rec (pure helpers + UI sections).
 */
import { gammaSignWord, gexAt } from '@/shared/charts/structure-field/paintStep';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { AccessibleHelp } from '@/shared/ui';
import type { RecStrategy, TickerBundle } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { distancePercentOnly, levelSpot } from '../_kit/distanceToLevel';
import { COPY, REASONING_PROSE_NOT_CHECKED } from './copy';

const MONO = typographyTokens.monoFontFamily;

export function Field({
  label,
  value,
  tip,
  valueSx,
}: {
  label: string;
  value: React.ReactNode;
  tip?: string;
  /** ai-rec-grounding (F12, DESIGN_SYSTEM Amendment 2026-08-13) — an optional per-value style
   *  override, used by the grounding type-register split (`registerSx`). Absent everywhere else on
   *  this shared component, so every other `Field` caller is byte-identical to `main`. */
  valueSx?: SxProps<Theme>;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        {tip && <AccessibleHelp label={`${label} help`} text={tip} />}
      </Stack>
      <Typography variant="body2" sx={valueSx}>
        {value}
      </Typography>
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

/** The Final boards' `.caps` label (`design/src/lib.mjs:139`): 11px, 600, 0.06em, uppercase, steel.
 *  The Full analysis drawer's section and figure labels (fidelity DESK-08). */
export function CapsLabel({
  children,
  component = 'span',
}: {
  children: React.ReactNode;
  component?: React.ElementType;
}) {
  return (
    <Typography
      component={component}
      sx={{
        display: 'block',
        m: 0,
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.3,
      }}
    >
      {children}
    </Typography>
  );
}

/** A wall's gamma side, read off the bundle's own strike profile at the wall's price (the structure
 *  field's `wallLabel` rule, `paintStep.ts:261`): `+γ` / `−γ`, or `—` when the profile is absent or
 *  flat there. Never assumed from the wall's name, because a call wall can sit in negative gamma. */
function wallSide(strikes: { strike: number; net_gex: number }[] | undefined, price: number) {
  if (!strikes?.length) return ABSENT;
  const samples = strikes
    .filter((s) => Number.isFinite(s.strike) && Number.isFinite(s.net_gex))
    .map((s) => ({ strike: s.strike, netGex: s.net_gex }))
    .sort((a, b) => a.strike - b.strike);
  if (!samples.length) return ABSENT;
  return gammaSignWord(gexAt(samples, price)) ?? ABSENT;
}

const ABSENT = '—';

interface LevelRow {
  /** The level's name, in the chips' lowercase vocabulary; the cell capitalises its first letter. */
  level: string;
  price: number;
  fromSpot: string;
  side: string;
  anchor?: boolean;
}

/** "Levels in play" — a Level / Price / From spot / Side table (the Final drawer's `.dr-lv`,
 *  `design/src/screens/final/deep-read.mjs:104`), sourced straight from the cached bundle: no
 *  recompute, no new fetch. Rows run by price, high to low, because levels can cross; the distance
 *  is measured from the levels anchor (`levelSpot`: `gex_spot`, else the price), never the live mid.
 *  The two figures that are not price levels (net GEX, IV/HV) follow the table on one line.
 *  Context, not a signal; omitted when the bundle isn't present. */
export function LevelsStrip({ bundle }: { bundle: TickerBundle | null }) {
  const m = bundle?.market_state;
  if (!m) return null;
  const spot = levelSpot(m);
  const strikes = bundle?.strike_profile?.strikes;
  const rows: LevelRow[] = [];
  if (spot != null) {
    rows.push({
      level: 'Spot · levels anchor',
      price: spot,
      fromSpot: ABSENT,
      side: ABSENT,
      anchor: true,
    });
  }
  const add = (level: string, price: number | null | undefined, side: (p: number) => string) => {
    if (price == null || !Number.isFinite(price)) return;
    rows.push({
      level,
      price,
      fromSpot: distancePercentOnly(price, spot) ?? ABSENT,
      side: side(price),
    });
  };
  add('call wall', m.call_wall, (p) => wallSide(strikes, p));
  add('max pain', m.max_pain, () => ABSENT);
  add('VWAP', m.vwap, () => ABSENT);
  add('gamma flip', m.gamma_flip, () => '±');
  add('put wall', m.put_wall, (p) => wallSide(strikes, p));
  // A stable sort keeps the anchor above a level that sits exactly at it.
  rows.sort((a, b) => b.price - a.price);

  const figures: { k: string; v: string }[] = [];
  if (m.net_gex != null && Number.isFinite(m.net_gex)) {
    figures.push({ k: 'net GEX', v: fmtCompact(m.net_gex) });
  }
  if (m.iv_hv_ratio != null && Number.isFinite(m.iv_hv_ratio)) {
    figures.push({ k: 'IV/HV', v: m.iv_hv_ratio.toFixed(2) });
  }
  if (!rows.some((r) => !r.anchor) && !figures.length) return null;

  const cell = {
    px: '6px',
    py: '6px',
    borderBottom: '1px solid',
    borderColor: 'divider',
    fontFamily: MONO,
    fontSize: 12.5,
    lineHeight: 1.5,
    color: 'text.primary',
    textAlign: 'left',
    fontVariantNumeric: 'tabular-nums',
  } as const;
  return (
    <Stack spacing={1}>
      <CapsLabel component="h3">{COPY.reasoning.levels}</CapsLabel>
      {rows.some((r) => !r.anchor) && (
        <Box
          component="table"
          data-testid="analysis-levels-table"
          sx={{ width: '100%', borderCollapse: 'collapse' }}
        >
          <Box component="thead">
            <Box component="tr">
              {['Level', 'Price', 'From spot', 'Side'].map((h) => (
                <Box
                  key={h}
                  component="th"
                  scope="col"
                  sx={(t) => ({
                    px: '6px',
                    py: '4px',
                    textAlign: 'left',
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    borderBottom: `1px solid ${extrasFor(t).lineStrong}`,
                  })}
                >
                  {h}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {rows.map((r) => (
              <Box component="tr" key={r.level}>
                <Box
                  component="th"
                  scope="row"
                  sx={{
                    ...cell,
                    fontFamily: 'inherit',
                    fontWeight: 400,
                    '&::first-letter': { textTransform: 'uppercase' },
                  }}
                >
                  {r.level}
                </Box>
                <Box component="td" sx={cell}>
                  {String(r.price)}
                </Box>
                <Box component="td" sx={cell}>
                  {r.fromSpot}
                </Box>
                <Box component="td" sx={cell}>
                  {r.side}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      {figures.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
          {figures.map(({ k, v }) => (
            <Stack key={k} direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
                {k}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.primary', fontFamily: MONO, fontSize: 12.5 }}
              >
                {v}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
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
  expanded = false,
  reengageLabel = COPY.reasoning.reengage,
}: {
  strategy: RecStrategy;
  suppressLead?: boolean;
  expanded?: boolean;
  reengageLabel?: string;
}) {
  const { lead, detail, keyPoints, reengage } = deriveReasoning(strategy);
  const [open, setOpen] = useState(false);
  const detailSection = detail ? (
    <Box data-testid={expanded ? 'reasoning-full-read' : undefined}>
      {!expanded && (
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
      )}
      {expanded && <SectionLabel>{COPY.reasoning.fullRead}</SectionLabel>}
      <Collapse in={expanded || open}>
        <Box sx={{ mt: 0.5 }}>
          <ReasoningProse text={detail} />
        </Box>
      </Collapse>
    </Box>
  ) : null;
  return (
    <Stack spacing={1.5}>
      {!suppressLead && lead && <Field label={COPY.reasoning.rationale} value={lead} />}
      {expanded && detailSection}
      {keyPoints.length > 0 && (
        <Box data-testid={expanded ? 'reasoning-key-points' : undefined}>
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
        <Box data-testid={expanded ? 'reasoning-reengage' : undefined}>
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
      {!expanded && detailSection}
      {/* AC-33 (GATE Z Z-F1) — ONE statement, placed WITH the reasoning (never with the fields, never
          gated on which reasoning sub-sections happen to be populated for this rec): numbers written
          out in the AI's free prose — the lead, the key points, the re-engage conditions, the full
          analyst read — are never scanned or checked. Unconditional so a reader can never encounter
          the reasoning surface without it, matching how QA verified it (present on every card state
          checked). Visible caption text, not a tooltip alone. */}
      <Typography
        variant="caption"
        data-testid="reasoning-prose-not-checked"
        sx={{ color: 'text.secondary', display: 'block' }}
      >
        {REASONING_PROSE_NOT_CHECKED}
      </Typography>
    </Stack>
  );
}
