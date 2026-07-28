/**
 * The leg disclosure — THE SIGNATURE OF THIS FEATURE (SPEC §4 *The leg disclosure*, Design
 * direction ¶2/¶3).
 *
 * The signature is the leg block's LEFT RULE: a 1px `divider` vertical rule indenting the legs
 * beneath their parent position, so a spread reads as ONE OBJECT WITH PARTS rather than four loose
 * rows. It is the only new visual idea in the feature and it costs ZERO colour. Deliberately NOT an
 * arc — the arc is set-pinned to exactly three places and a fourth use is a violation.
 *
 * MOTION: NONE ADDED. The disclosure is instant — no keyframe, no accordion, no transition
 * property (the single-motion-moment set-equality guard).
 *
 * TINT: none. Side renders as the WORD `Long`/`Short` in `text.secondary` — never `+`/`−`, never
 * coloured: a short leg is not a loss, and a red `Short` one cell from a red P/L is a direct misread
 * (AC-78). `Call`/`Put` are likewise untinted on this surface (ruling #18).
 *
 * NO PER-LEG P/L COLUMN, deliberately (the accessory cut): it invites exactly the partial-sum
 * reading the all-or-nothing rule bans, and it quadruples the mobile line length. Legs show
 * mark + basis only; P/L exists at the POSITION level.
 *
 * LEGS CARRY NO ACTIONS — no per-leg Close, no per-leg Cancel, no button inside a leg line (AC-12).
 *
 * STATE IS EPHEMERAL and owned by the host row/card: never persisted, absent from `ViewConfig`,
 * gone after reload (AC-36).
 */
import { MARK_BASIS_META } from '@/features/trading/model/mark';
import { typographyTokens } from '@/shared/theme/tokens';
import { Box, Chip, Tooltip } from '@mui/material';
import {
  LEGS_TIP,
  MAX_LOSS_ASSUMPTION,
  MAX_LOSS_WITHHELD_META,
  ROW_UNAVAILABLE_TIP,
  SHORT_LEG_TIP,
} from './labels';
import type { PositionView } from './view';

/** 0.8rem = 12.8px — above the 11px floor, in the mono data face with tabular numerals. */
const LEG_MONO = {
  fontFamily: typographyTokens.monoFontFamily,
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.8rem',
  letterSpacing: 0,
} as const;

/** The coarse-pointer touch floor. The theme enforces it globally; stated here for the card CTA. */
const HIT_TARGET = 44;

export interface LegDisclosureButtonProps {
  expanded: boolean;
  onToggle: () => void;
  /** The id of the panel this control owns — `aria-controls` must resolve to it. */
  panelId: string;
  legCount: number;
  /** `row` = the chevron at the right edge of the `contract` cell. `card` = the full-width CTA. */
  variant: 'row' | 'card';
}

/**
 * A REAL `<button aria-expanded aria-controls>` — keyboard-operable by construction, so Enter and
 * Space both activate it for free and the app's ONE authored `:focus-visible` ring (theme layer,
 * `*:focus-visible`) applies without a bespoke per-component ring. The chevron is `text.secondary`:
 * THE DISCLOSURE CHEVRON DOES NOT EARN AMBER — amber is spent on the one entry CTA.
 */
export function LegDisclosureButton({
  expanded,
  onToggle,
  panelId,
  legCount,
  variant,
}: LegDisclosureButtonProps) {
  const isCard = variant === 'card';
  return (
    <Box
      component="button"
      type="button"
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={onToggle}
      data-testid="leg-disclosure-toggle"
      sx={{
        display: isCard ? 'flex' : 'inline-flex',
        alignItems: 'center',
        justifyContent: isCard ? 'flex-start' : 'center',
        gap: '6px',
        width: isCard ? '100%' : undefined,
        minHeight: isCard ? `${HIT_TARGET}px` : undefined,
        minWidth: isCard ? undefined : '24px',
        background: 'none',
        border: 'none',
        padding: isCard ? '0 4px' : '0 4px',
        font: 'inherit',
        fontSize: isCard ? '0.8rem' : '0.86rem',
        lineHeight: 1,
        color: 'text.secondary',
        cursor: 'pointer',
      }}
    >
      {isCard && <Box component="span">{legCount} legs</Box>}
      <Box component="span" aria-hidden="true" sx={{ display: 'inline-block' }}>
        {expanded ? '⌃' : '⌄'}
      </Box>
    </Box>
  );
}

export interface LegDisclosurePanelProps {
  id: string;
  view: PositionView;
  expanded: boolean;
}

/**
 * The panel body. Rendered ALWAYS (hidden when collapsed) so `aria-controls` always resolves to a
 * real element — a dangling reference is the quiet way an expanded/controls pair rots.
 */
export function LegDisclosurePanel({ id, view, expanded }: LegDisclosurePanelProps) {
  return (
    <Box
      id={id}
      hidden={!expanded}
      data-testid="leg-disclosure-panel"
      sx={{
        // THE SIGNATURE: one 1px divider rule, indenting the legs beneath their parent.
        borderLeft: '1px solid',
        borderColor: 'divider',
        pl: '12px',
        ml: '4px',
        py: '6px',
      }}
    >
      <Tooltip arrow title={LEGS_TIP}>
        <Box
          component="ul"
          data-testid="leg-list"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '4px' }}
        >
          {view.legs.map((l) => (
            <Box
              component="li"
              key={l.leg_id}
              data-testid="leg-line"
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px',
                ...LEG_MONO,
                color: 'text.primary',
              }}
            >
              {/* The WORD, untinted. Both sides are className-identical by construction: one
                  element, one sx object, no branch on `side` (AC-78). */}
              <Tooltip arrow title={l.side_word === 'Short' ? SHORT_LEG_TIP : ''}>
                <Box
                  component="span"
                  data-testid="leg-side"
                  sx={{ color: 'text.secondary', minWidth: '3.2em' }}
                >
                  {l.side_word}
                </Box>
              </Tooltip>
              <Box component="span" data-testid="leg-size" sx={{ color: 'text.secondary' }}>
                {l.size_text}
              </Box>
              <Box component="span" data-testid="leg-instrument">
                {l.instrument_text}
              </Box>
              <Box component="span" data-testid="leg-expiry" sx={{ color: 'text.secondary' }}>
                {l.expiry_text}
              </Box>
              {l.unavailable || l.mark == null ? (
                <Tooltip arrow title={ROW_UNAVAILABLE_TIP}>
                  <Box component="span" data-testid="leg-mark" sx={{ color: 'text.disabled' }}>
                    unavailable
                  </Box>
                </Tooltip>
              ) : (
                <>
                  <Box component="span" data-testid="leg-mark">
                    ${l.mark.toFixed(2)}
                  </Box>
                  {l.basis && (
                    <Tooltip arrow title={MARK_BASIS_META[l.basis].tip}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={MARK_BASIS_META[l.basis].label}
                        data-testid="leg-basis"
                      />
                    </Tooltip>
                  )}
                </>
              )}
            </Box>
          ))}
        </Box>
      </Tooltip>

      {/* The disclosure is the designed home for per-position detail and has vertical room for a
          sentence: the at-expiration assumption when a figure exists, the reason's own words when
          one does not. ONE string, TWO homes (this line and the risk slot's tooltip). */}
      <Box
        component="p"
        data-testid="leg-max-loss-note"
        sx={{ m: '8px 0 0', fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}
      >
        {view.max_loss.kind === 'figure'
          ? MAX_LOSS_ASSUMPTION
          : MAX_LOSS_WITHHELD_META[view.max_loss.reason].tip}
      </Box>
    </Box>
  );
}
