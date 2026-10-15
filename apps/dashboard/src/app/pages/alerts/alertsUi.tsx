/**
 * Pieces shared by the Alerts page and the new-alert flow: each kind's glyph, the state word a rule or
 * a kind wears (canon P-2), the SEC strip, and the panel shell. Design source:
 * design/src/screens/final/account-pages.mjs (Alerts) and design/src/screens/v5/alerts-public.mjs.
 */
import { CHECKS_HERE, PUBLIC_KIND, isPublicKind, isStructureKind } from '@/features/alerts/kinds';
import { fmtDay } from '@/features/alerts/publicRules';
import type { AlertKind, AlertRule } from '@/features/alerts/types';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { extrasFor } from '@/shared/theme/tokens';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import GpsFixedOutlined from '@mui/icons-material/GpsFixedOutlined';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import SpeedOutlined from '@mui/icons-material/SpeedOutlined';
import SwapVertOutlined from '@mui/icons-material/SwapVertOutlined';
import TimelineOutlined from '@mui/icons-material/TimelineOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import Box from '@mui/material/Box';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import type { ComponentType, ReactNode } from 'react';

export const KIND_GLYPH: Record<
  AlertKind,
  ComponentType<{ sx?: object; 'aria-hidden'?: boolean }>
> = {
  results: EventOutlined,
  filing: DescriptionOutlined,
  cluster: PersonOutlined,
  cftc: LayersOutlined,
  si: TimelineOutlined,
  note: MenuBookOutlined,
  level_touch: GpsFixedOutlined,
  tier_change: SwapVertOutlined,
  score_gate: SpeedOutlined,
};

export function KindGlyph({ kind }: { kind: AlertKind }) {
  const G = KIND_GLYPH[kind];
  return <G aria-hidden sx={{ fontSize: 16, color: 'text.secondary', flex: 'none' }} />;
}

/** What the page knows about this site's sources. */
export interface SiteContext {
  demo: boolean;
  /** SEC EDGAR's state on this site (null: not known yet, or its read failed). */
  sec: string | null;
  /** Structure kinds can be checked (the demo, or a live options feed). */
  structureLive: boolean;
}

/** The word a kind wears on this site, before any rule of it has been checked. */
export function kindState(
  kind: AlertKind,
  ctx: SiteContext,
): { state: DataStateKey; detail?: string } {
  if (ctx.demo) return { state: 'sample' };
  if (isStructureKind(kind)) return ctx.structureLive ? { state: 'updated' } : { state: 'notLive' };
  const info = PUBLIC_KIND[kind];
  if (info.sec === 'needs' && ctx.sec !== 'live') return { state: 'notSetUp' };
  if (kind === 'cluster') return { state: 'notSetUp', detail: 'check not built' };
  if (kind === 'cftc' || kind === 'si') return { state: 'delayed' };
  if (kind === 'note') return { state: 'computed' };
  return { state: 'updated' };
}

const SAMPLE_LAST: Record<AlertKind, (r: AlertRule) => string> = {
  level_touch: () => 'Checks the sample tape',
  tier_change: () => 'Checks the sample tape',
  score_gate: () => 'Checks the sample tape',
  results: (r) => `Sample note · ${r.symbol}`,
  filing: () => 'Sample filings · Oct 7 scenario',
  cluster: () => 'Sample Form 4s · Oct 7 scenario',
  cftc: () => 'Sample report · as of Tue Oct 6',
  si: () => 'Sample settlement · Sep 30',
  note: (r) => `Sample note · ${r.symbol}`,
};

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const when = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? time(ms)
    : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time(ms)}`;
};

/** A rule's state tag and the short line beside it ("Checked 2:30 PM · 33% of its 3-year range"). */
export function ruleState(
  rule: AlertRule,
  ctx: SiteContext,
  checking: boolean,
): { state: DataStateKey; detail?: string; last: string } {
  if (!rule.enabled) return { state: 'off', last: 'Switched off: not checked' };
  if (ctx.demo) return { state: 'sample', last: SAMPLE_LAST[rule.kind](rule) };
  if (isStructureKind(rule.kind)) {
    return ctx.structureLive
      ? { state: 'updated', last: 'Checks while a ticker desk is open' }
      : { state: 'notLive', last: 'Needs the options feed' };
  }
  const c = rule.check;
  if (!c) {
    const base = kindState(rule.kind, ctx);
    return { ...base, last: checking ? 'Checking…' : 'Not checked yet' };
  }
  if (c.outcome === 'unchecked') return { state: 'notSetUp', last: c.note ?? 'Not checked' };
  if (c.outcome === 'unavailable')
    return { state: 'sourceDown', last: c.note ?? 'The source didn’t answer' };
  const checked = `Checked ${when(c.at)}${c.note ? ` · ${c.note}` : ''}`;
  if (rule.kind === 'cftc' || rule.kind === 'si')
    return {
      state: 'delayed',
      detail: c.asOf ? `As of ${fmtDay(c.asOf, rule.kind === 'cftc')}` : undefined,
      last: checked,
    };
  if (rule.kind === 'note') return { state: 'computed', last: checked };
  return { state: 'updated', last: checked };
}

/** The kind reference's "Checks" line, honest about who checks. */
export const checksLine = (kind: AlertKind) =>
  isPublicKind(kind)
    ? `Checks: ${CHECKS_HERE.charAt(0).toLowerCase()}${CHECKS_HERE.slice(1)}.`
    : '';

export function Panel({
  title,
  tag,
  children,
  label,
  sample = false,
  sx,
}: {
  title: string;
  tag?: ReactNode;
  children: ReactNode;
  label?: string;
  sample?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="section"
      aria-label={label ?? title}
      sx={[
        (t) => ({
          position: 'relative',
          bgcolor: 'background.paper',
          border: `1px ${sample ? 'dashed' : 'solid'} ${sample ? extrasFor(t).textTertiary : t.palette.divider}`,
          borderRadius: '12px',
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          minWidth: 0,
          // Sample data: dashed, with the hatch band ChartFrame uses (canon P-3, P-8).
          ...(sample && {
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 8,
              borderRadius: '11px 11px 0 0',
              pointerEvents: 'none',
              background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(t.palette.text.secondary, 0.28)} 6px 12px)`,
            },
          }),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box component="h2" sx={{ m: 0, fontSize: 16, fontWeight: 700, flex: '1 1 auto' }}>
          {title}
        </Box>
        {tag}
      </Box>
      {children}
    </Box>
  );
}

/** Filing and insider alerts before SEC access: saved, not checking (reader sentence first, the
 *  operator hint folded, DS-02). */
export function SecStrip() {
  return (
    <Box
      role="status"
      data-testid="alerts-sec-strip"
      sx={{
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        p: '12px 14px',
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
      }}
    >
      <TuneOutlined aria-hidden sx={{ fontSize: 16, color: 'text.secondary', mt: '2px' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
        <Box component="strong" sx={{ fontSize: 13 }}>
          Filing and insider alerts are saved but not checking yet.
        </Box>
        <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}>
          They read SEC EDGAR, which isn’t set up on this site. They start on their own once it is;
          nothing is lost.
        </Box>
        <Box
          component="details"
          sx={{
            fontSize: 12,
            '& summary': { cursor: 'pointer', color: 'info.main', fontWeight: 600, minHeight: 24 },
          }}
        >
          <summary>For the operator</summary>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            Set <code>SEC_USER_AGENT</code> on the API (a contact string the SEC requires).
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// GATE Z, finding 3 (criterion 66): MUI `Select` self-duplicates its own class
// (`&.${selectClasses.select}`, `Select/SelectInput.js`) to "win specificity over the input
// base" at (0,2,0) — a bare `[role="combobox"]` (0,1,0) or a scoped `sx` descendant selector tied
// at (0,2,0) both lose that fight (confirmed by measuring computed `min-height` in a real
// browser). Doubling the SAME class ourselves reaches (0,3,0), which wins unconditionally —
// `theme.ts`'s own coarse-pointer floor comment points here as the pattern.
export const selectCoarseFloorSx = {
  '@media (pointer: coarse)': {
    '& .MuiSelect-select.MuiSelect-select': { minHeight: 44 },
  },
} as const;
