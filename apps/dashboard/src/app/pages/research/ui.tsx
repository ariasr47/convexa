/**
 * Research view primitives: panels, labels, chips and the freshness mark. Colours come from the theme
 * (tokens.ts) so dark and light stay in parity; direction alone uses green/red, and state is always a
 * shape plus a word, never colour alone.
 */
import { MONO_FACE } from '@/shared/figure/figureFace';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import type { ElementType, ReactNode } from 'react';
import { formatShortDate } from './format';
import { type NoteSource, sourceChip } from './provenance';
import type { Freshness } from './types';

export const DISPLAY = {
  fontFamily: typographyTokens.displayFontFamily,
  fontStretch: typographyTokens.displayFontStretch,
} as const;
export const MONO = MONO_FACE;

export const PANEL_SX = {
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: '12px',
} as const;

export function Panel({
  children,
  component = 'div',
  sx,
  ...rest
}: {
  children: ReactNode;
  component?: ElementType;
  sx?: SxProps<Theme>;
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <Box
      component={component}
      {...rest}
      sx={[{ ...PANEL_SX, p: 2, minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {children}
    </Box>
  );
}

/** The small mono caps label over a figure, a panel or a section. */
export function Eyebrow({
  children,
  component = 'span',
  sx,
}: {
  children: ReactNode;
  component?: ElementType;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component={component}
      sx={[
        {
          ...MONO,
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          lineHeight: 1.5,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** A table-like header row in the well colour. */
export const HEAD_ROW_SX = (t: Theme) => ({
  ...MONO,
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'text.secondary',
  bgcolor: extrasFor(t).well,
});

type ChipVariant = 'quiet' | 'dashed' | 'strong';

/** A pill. `dashed` marks a slot that is the owner's to fill ("your call"). */
export function Pill({
  children,
  variant = 'quiet',
  sx,
}: {
  children: ReactNode;
  variant?: ChipVariant;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="span"
      sx={[
        (t) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: '2px',
          borderRadius: '999px',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.5,
          whiteSpace: 'nowrap',
          // A quiet pill's steel label on its own 16% steel tint measured 4.08:1 on paper and 4.37:1
          // on a white panel in light, under the 4.5:1 floor; light takes text.primary there, as
          // TintChip's neutral tone does (LTXT tint chip). Dark keeps steel (spec 2026-10-21/02, c).
          color:
            variant === 'quiet' && t.palette.mode === 'dark' ? 'text.secondary' : 'text.primary',
          bgcolor:
            variant === 'quiet'
              ? alpha(t.palette.text.secondary, 0.16)
              : variant === 'strong'
                ? extrasFor(t).panelRaised
                : 'transparent',
          border:
            variant === 'dashed'
              ? `1px dashed ${alpha(t.palette.text.secondary, 0.6)}`
              : variant === 'strong'
                ? `1px solid ${alpha(t.palette.text.primary, 0.32)}`
                : '1px solid transparent',
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** Where the owner's own judgment goes, still unset. */
export function YourCall({ label = 'your call' }: { label?: string }) {
  return (
    <Pill variant="dashed" sx={{ fontSize: 11 }}>
      {label}
    </Pill>
  );
}

/** The freshness shape: filled dot · half dot · ring · square. */
export function StateDot({ state, size = 9 }: { state: Freshness['state']; size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={(t) => {
        const ink = t.palette.text.primary;
        const quiet = t.palette.text.secondary;
        const base = {
          display: 'inline-block',
          width: size,
          height: size,
          flexShrink: 0,
          boxSizing: 'border-box' as const,
        };
        if (state === 'current') return { ...base, borderRadius: '50%', bgcolor: ink };
        if (state === 'due')
          return {
            ...base,
            borderRadius: '50%',
            border: `2px solid ${ink}`,
            background: `linear-gradient(90deg, ${ink} 50%, transparent 50%)`,
          };
        if (state === 'superseded')
          return { ...base, borderRadius: '50%', border: `2px solid ${quiet}` };
        return { ...base, borderRadius: '2px', bgcolor: quiet };
      }}
    />
  );
}

/** A label lowered to run on in a sentence ("Lock-up release" → "lock-up release"), leaving an
 *  acronym or a name in capitals as written ("GTC Berlin", "FOMC decision", "Q3 results"). */
export function lowerLead(s: string): string {
  return /^[A-Z][A-Z0-9]/.test(s) ? s : `${s.charAt(0).toLowerCase()}${s.slice(1)}`;
}

export const STATE_WORD: Record<Freshness['state'], string> = {
  current: 'Current',
  due: 'Review due',
  superseded: 'Superseded',
  archived: 'Archived',
};

/** "● Current · review by Oct 14" — the one-line freshness status. */
export function FreshnessLine({
  freshness,
  notFollowingSince,
  withReason = false,
}: {
  freshness: Freshness;
  notFollowingSince?: string | null;
  /** Name the event behind the next review date: "review by Oct 14 (lock-up release)". */
  withReason?: boolean;
}) {
  const reason = withReason && freshness.next ? ` (${lowerLead(freshness.next.label)})` : '';
  const detail =
    freshness.state === 'current'
      ? freshness.next
        ? `review by ${formatShortDate(freshness.next.date)}${reason}`
        : null
      : freshness.state === 'due'
        ? freshness.since && `since ${formatShortDate(freshness.since)}`
        : freshness.state === 'archived'
          ? notFollowingSince && `not following since ${formatShortDate(notFollowingSince)}`
          : 'a newer note replaces it';
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}
    >
      <StateDot state={freshness.state} />
      <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
        {STATE_WORD[freshness.state]}
      </Box>
      {detail && <span>· {detail}</span>}
    </Box>
  );
}

/** Where a figure came from, one tap from the source. A primary source (a filing, or a document the
 *  company published) has a solid border; anything else is dotted. On a touch screen the tap target
 *  grows past the chip without changing its look. */
export function SourceChip({ source }: { source: NoteSource }) {
  const chip = sourceChip(source);
  return (
    <Box
      component="a"
      href={chip.href}
      target="_blank"
      rel="noopener noreferrer"
      title={source.label}
      sx={(t) => ({
        ...MONO,
        position: 'relative',
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        px: 1,
        borderRadius: '999px',
        border: `1px ${chip.primary ? 'solid' : 'dotted'} ${alpha(t.palette.text.secondary, chip.primary ? 0.3 : 0.55)}`,
        fontSize: 11,
        color: chip.primary ? 'text.primary' : 'text.secondary',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'border-color 160ms ease-out, background-color 160ms ease-out',
        '&:hover': {
          borderColor: alpha(t.palette.text.secondary, 0.55),
          bgcolor: alpha(t.palette.text.primary, 0.05),
        },
        '@media (pointer: coarse)': {
          '&::after': { content: '""', position: 'absolute', inset: '-11px -4px' },
        },
      })}
    >
      {chip.text}
    </Box>
  );
}
