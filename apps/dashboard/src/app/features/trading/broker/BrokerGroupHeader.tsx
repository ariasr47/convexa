/**
 * BrokerGroupHeader — the ONE shared group header + panel shell, desktop and mobile (SPEC §2.8,
 * PLAN F5). Renders a group whose `leg_count > 1` (a lone leg — `position_count === 1` — is a
 * caller-side render branch, SPEC §2.5, and never reaches this component).
 *
 * A group header authored twice diverges twice — this is the direct mitigation of the recorded
 * desktop/mobile `ModeledPl` divergence this feature also repairs (F10). Same fields, same
 * literals, same tooltips, both form factors.
 *
 * NO NAME ANYWHERE. This module never imports `positions/structure`, `positions/view` or
 * `positions/leg` (Layer 1's deny-list); it renders exactly what `BrokerGroup` carries: a ticker, a
 * count, a net, a combined P/L, and a toggle. No quantity figure, no percent, no reassessment slot.
 *
 * NO MOTION: no `<Accordion>`, no transition, no keyframe — nothing animates, so nothing needs a
 * reduced-motion guard.
 */
import { money } from '@/features/trading/positions/labels';
import { faceFor, figureStateOf, MONO_FACE, PauseMark } from '@/shared/figure';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { FactText, STALE_SNAPSHOT_SX } from './BrokerPositionRow';
import { UNAVAILABLE } from './brokerView';
import { BROKER_COPY, stampTime } from './copy';
import { GROUP_COPY } from './groupCopy';
import {
  plWithheldLiteralOf,
  withheldCauseOf,
  withheldCountOf,
  type BrokerGroup,
} from './grouping';

/** The desktop grid — IDENTICAL to `BrokerPositionRow`'s, so every column lines up. */
const ROW_GRID_TEMPLATE = 'minmax(220px, 1.6fr) minmax(120px, 1fr) minmax(110px, 1fr) auto';

/** The coarse-pointer touch floor (mirrors `LegDisclosure.tsx`'s `HIT_TARGET`). */
const HIT_TARGET = 44;

export interface BrokerGroupHeaderProps {
  group: BrokerGroup;
  /** `row` = the desktop grid line. `card` = the mobile full-width disclosure at ≥44px. */
  variant: 'row' | 'card';
  expanded: boolean;
  onToggle: () => void;
  /** `aria-controls` target — the panel is ALWAYS rendered, so this never dangles. */
  panelId: string;
  streamOffline: boolean;
  isStale: boolean;
  asOf: string | null;
}

export interface BrokerGroupPanelProps {
  group: BrokerGroup;
  id: string;
  expanded: boolean;
  /** The member rows/cards, supplied by the parent. */
  children: ReactNode;
}

/** The keyboard-reachable count clause — a `tabIndex={0}` span inside a `Tooltip`, never hover-only. */
function CountClause({ group }: { group: BrokerGroup }) {
  return (
    <Tooltip title={GROUP_COPY.countTip}>
      <Box
        component="span"
        tabIndex={0}
        data-testid="broker-group-count"
        sx={{
          ...MONO_FACE,
          fontSize: '0.8rem',
          color: 'text.secondary',
          whiteSpace: 'nowrap',
        }}
      >
        {GROUP_COPY.countClause(group.leg_count)}
      </Box>
    </Tooltip>
  );
}

/** The real `<button aria-expanded aria-controls>` — the ONLY button in the header (AC-30/32). */
function GroupToggle({
  group,
  expanded,
  onToggle,
  panelId,
  fullWidth,
}: {
  group: BrokerGroup;
  expanded: boolean;
  onToggle: () => void;
  panelId: string;
  fullWidth: boolean;
}) {
  const name = expanded
    ? GROUP_COPY.hideLegs(group.ticker, group.leg_count)
    : GROUP_COPY.showLegs(group.ticker, group.leg_count);
  return (
    <Box
      component="button"
      type="button"
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-label={name}
      onClick={onToggle}
      data-testid="broker-group-toggle"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: fullWidth ? '100%' : undefined,
        minHeight: fullWidth ? `${HIT_TARGET}px` : undefined,
        minWidth: fullWidth ? undefined : '24px',
        background: 'none',
        border: 'none',
        padding: '0 4px',
        font: 'inherit',
        fontSize: '0.86rem',
        lineHeight: 1,
        color: 'text.secondary',
        cursor: 'pointer',
      }}
    >
      <Box component="span" aria-hidden="true" sx={{ display: 'inline-block' }}>
        {expanded ? '⌃' : '⌄'}
      </Box>
    </Box>
  );
}

/** The netted figure + its basis label — the shared literal handling via `FactText`. */
function NetEntry({ group }: { group: BrokerGroup }) {
  const withheld = group.net_entry.kind === 'withheld';
  const n = withheldCountOf(group);
  const cause = withheldCauseOf(group);
  return (
    <>
      <Typography
        component="div"
        data-testid="broker-group-net"
        sx={{ ...MONO_FACE, fontWeight: 700, fontSize: '0.9rem' }}
      >
        <FactText text={group.net_entry_text} />
      </Typography>
      {!withheld && (
        <Tooltip title={GROUP_COPY.nettedTip(group.net_rests_on_derived_size)}>
          <Box
            component="span"
            tabIndex={0}
            data-testid="broker-group-net-label"
            sx={{
              ...MONO_FACE,
              fontSize: '0.6875rem',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
            }}
          >
            {GROUP_COPY.nettedBy}
          </Box>
        </Tooltip>
      )}
      {withheld && n != null && cause != null && (
        <Tooltip title={GROUP_COPY.withheldTip(cause, n, group.leg_count)}>
          <Box
            component="span"
            tabIndex={0}
            data-testid="broker-group-withheld-count"
            sx={{ ...MONO_FACE, fontSize: '0.6875rem', color: 'text.secondary' }}
          >
            {GROUP_COPY.withheldCount(n, group.leg_count)}
          </Box>
        </Tooltip>
      )}
    </>
  );
}

/** The combined P/L — reuses `FactText` for the withheld case, `money()` for the figure (SPEC §2.8):
 *  withheld renders the NET's own literal, so the two slots can never diverge in precedence. */
function GroupPl({
  group,
  streamOffline,
  asOf,
}: {
  group: BrokerGroup;
  streamOffline: boolean;
  asOf: string | null;
}) {
  const dual = group.modeled_label === 'dual' && asOf != null;
  const label = dual ? BROKER_COPY.modeled.dualLabel(stampTime(asOf)) : BROKER_COPY.modeled.label;
  const tip = dual
    ? `${BROKER_COPY.modeled.tip} ${BROKER_COPY.modeled.dualTipAppend(stampTime(asOf as string))}`
    : BROKER_COPY.modeled.tip;

  let figure: ReactNode;
  if (group.pl_dollar != null) {
    // Same conversion as `ModeledPl` (`BrokerPositionRow.tsx`) — one member's figure, one group's
    // figure, one decision. Always the traced register (`mono` is always `true` here).
    const { mono, dim, showPause } = figureStateOf({
      value: money(group.pl_dollar),
      register: 'traced',
      offline: streamOffline ? { retained: true } : null,
    });
    figure = (
      <Stack
        direction="row"
        spacing={0.5}
        data-testid="broker-group-pl"
        sx={{ alignItems: 'baseline', justifyContent: 'flex-end', opacity: dim ? 0.5 : 1 }}
      >
        {showPause && <PauseMark />}
        <Typography
          component="span"
          sx={{
            ...faceFor(mono),
            fontWeight: 700,
            fontSize: '0.95rem',
            color: group.pl_dollar >= 0 ? 'success.main' : 'error.main',
          }}
        >
          {money(group.pl_dollar)}
        </Typography>
      </Stack>
    );
  } else {
    // AC-11 / [absent-is-not-none] fix (GATE Q FAIL B1): the literal is DERIVED through the
    // shared permanence-first cascade over the group's own members — never hardcoded to
    // `UNAVAILABLE`. On the real feed every option leg is `unpriceable` (no strike/expiry/right),
    // which is PERMANENT for this axis, so this now renders `not provided`, matching every
    // expanded member row's own conclusion (`BrokerPositionRow.tsx:135`) instead of promising a
    // refresh that cannot work. The `?? UNAVAILABLE` fallback is defensive only — unreachable
    // given the `pl_dollar != null` guard above already selects this branch.
    const literal = plWithheldLiteralOf(group) ?? UNAVAILABLE;
    figure = (
      <Typography component="span" data-testid="broker-group-pl" sx={{ color: 'text.secondary' }}>
        <FactText text={literal} />
      </Typography>
    );
  }

  return (
    <Box sx={{ textAlign: 'right', minWidth: 0 }}>
      {figure}
      <Tooltip title={tip}>
        <Typography
          component="div"
          data-testid="broker-group-pl-label"
          sx={{
            ...MONO_FACE,
            fontSize: '0.6875rem',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </Tooltip>
    </Box>
  );
}

/**
 * The lone-leg secondary clause (SPEC §2.5, §4, AC-23) — PLAIN TEXT, no button, no chevron, never a
 * ghost one. Supplied to today's `BrokerPositionRow`/`BrokerPositionCard` via the `secondaryClause`
 * prop for a `leg_count === 1` entry; this module is the one place it is authored, matching the
 * group header's own `CountClause`. Snapshot-family: the caller places it inside the same
 * `isStale`-gated box as the rest of the snapshot fields, so it dims/undims WITH them.
 */
export function LoneLegClause() {
  return (
    <Tooltip title={GROUP_COPY.loneLegTip}>
      <Box
        component="span"
        tabIndex={0}
        data-testid="broker-lone-leg-clause"
        sx={{
          ...MONO_FACE,
          display: 'inline-block',
          fontSize: '0.8rem',
          color: 'text.secondary',
          // Deliberately NOT `nowrap` (unlike this module's other clauses): on a narrow mobile
          // card this clause sits in the SAME flex row as the P/L block (`BrokerPositionCard.tsx`),
          // and a forced single line overflowed its own column into the P/L label at 393px (GATE Q
          // finding §3.3, `broker-option-grouping` bounce — 33.0×13.8px, non-blocking, logged).
          // Allowing it to wrap keeps it inside its own column instead of spilling sideways; the
          // text and testid are unchanged.
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        }}
      >
        {GROUP_COPY.loneLegClause}
      </Box>
    </Tooltip>
  );
}

export function BrokerGroupHeader({
  group,
  variant,
  expanded,
  onToggle,
  panelId,
  streamOffline,
  isStale,
  asOf,
}: BrokerGroupHeaderProps) {
  const snapshotSx = isStale ? STALE_SNAPSHOT_SX : undefined;

  if (variant === 'card') {
    return (
      <Box
        data-testid="broker-group-header"
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '10px',
          padding: '12px',
          mb: '10px',
          minWidth: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', ...snapshotSx }}>
          <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {group.ticker}
          </Typography>
          <GroupToggle
            group={group}
            expanded={expanded}
            onToggle={onToggle}
            panelId={panelId}
            fullWidth
          />
        </Box>
        <Box sx={{ mt: '4px', ...snapshotSx }}>
          <CountClause group={group} />
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '18px',
            mt: '8px',
            flexWrap: 'wrap',
          }}
        >
          <Box sx={snapshotSx}>
            <NetEntry group={group} />
          </Box>
          <GroupPl group={group} streamOffline={streamOffline} asOf={asOf} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="broker-group-header"
      sx={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID_TEMPLATE,
        alignItems: 'start',
        gap: '12px',
        padding: '12px 14px',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* The identity cell spans columns 1–2: no quantity cell exists at group level (AC-16b). */}
      <Box sx={{ gridColumn: '1 / span 2', minWidth: 0, ...snapshotSx }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {group.ticker}
          </Typography>
          <CountClause group={group} />
          <GroupToggle
            group={group}
            expanded={expanded}
            onToggle={onToggle}
            panelId={panelId}
            fullWidth={false}
          />
        </Box>
      </Box>

      <Box sx={snapshotSx}>
        <NetEntry group={group} />
      </Box>

      <GroupPl group={group} streamOffline={streamOffline} asOf={asOf} />
    </Box>
  );
}

/**
 * The panel shell — ALWAYS rendered, `hidden` when collapsed (so `aria-controls` never dangles),
 * the shipped disclosure grammar (a 1px left `divider` rule + an indent, matching
 * `LegDisclosurePanel`). Carries `GROUP_COPY.expandedBasis(...)` when the net is a figure, and
 * `GROUP_COPY.withheldReason(...)` REPLACING it whenever the figure is withheld — one line, for the
 * cause the rendered literal names. No group-level fidelity-note line (SPEC §2.8).
 */
export function BrokerGroupPanel({ group, id, expanded, children }: BrokerGroupPanelProps) {
  const cause = withheldCauseOf(group);
  const n = withheldCountOf(group);
  const note =
    group.net_entry.kind === 'value'
      ? GROUP_COPY.expandedBasis(group.net_rests_on_derived_size)
      : cause != null && n != null
        ? GROUP_COPY.withheldReason(cause, n, group.leg_count)
        : GROUP_COPY.withheldReason('cost_missing', 0, group.leg_count);

  return (
    <Box
      id={id}
      hidden={!expanded}
      data-testid="broker-group-panel"
      sx={{
        borderLeft: '1px solid',
        borderColor: 'divider',
        pl: '12px',
        ml: '4px',
        py: '6px',
      }}
    >
      {children}
      <Box
        component="p"
        data-testid="broker-group-note"
        sx={{ m: '8px 0 0', fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}
      >
        {note}
      </Box>
    </Box>
  );
}
