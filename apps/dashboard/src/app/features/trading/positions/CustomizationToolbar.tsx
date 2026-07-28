/**
 * The customization toolbar (UX_BLUEPRINT §6 S8 / §5): view picker (+ unsaved-changes dot), layout
 * toggle, density toggle, group selector, the primary Open-CTA, and the saved-view create/rename/
 * delete/switch UX. All controls re-derive the view — NONE triggers a fetch or mutates a position.
 * Static/durable: untouched by an SSE drop.
 *
 * Re-skin (convexa-redesign · Positions): re-laid-out to the frame — a single controls row (View ·
 * Table/Cards · Comfortable/Compact · Group None/Ticker/Structure · spacer · the blue "+ Open
 * simulated position" pill), then a status-pill row (open/pending/closed/cancelled + History + the
 * offline banner). Layout/density/group are segmented pill controls; the saved-view wiring is unchanged.
 * REVISION 2 (owner 2026-06-29): the Sort select + Desc/Asc toggle, the Filters ▾ menu, and the
 * Columns ▾ menu are REMOVED from the UI to match the Figma's one clean row — the underlying
 * `derive` sort/filter logic + `working.*` stay in the model (default sort `pl_dollar`/`desc`), only
 * the controls are gone. The Open-CTA handler (`onOpenEntry`, gated upstream) lands here.
 */
import { extrasFor } from '@/shared/theme/tokens';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import { FaultedBanner, Refused } from './FaultedBanner';
import { MERGE_NOTICE, MERGE_NOTICE_EXPORT, SAVED_VIEW_TIP, staleViewNotice } from './labels';
import type { GroupAxis, Position, PositionStatus } from './types';
import type { usePortfolio } from './usePortfolio';

type Portfolio = ReturnType<typeof usePortfolio>;

const STATUSES: PositionStatus[] = ['open', 'pending', 'closed', 'cancelled'];
// REVISION 2 — Group shows None · Ticker · Structure only (the inline Expiry option is dropped to
// match the frame). The `expiry` axis remains reachable in `derive.ts` for later; only the UI option
// and the GroupAxis member go (ruling #10).
const GROUP_AXES: { key: GroupAxis; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'structure', label: 'Structure' },
];

interface ToolbarProps {
  pf: Portfolio;
  /** Retained for callers + future filter/columns UI; unused by the REVISION-2 one-row toolbar. */
  positions?: Position[];
  /** Gate a save-view WRITE (UX_BLUEPRINT §2.6): logged-out ⇒ run shows the sign-in prompt instead of
   *  saving. Defaults to running the action directly (e.g. in isolated renders). */
  guardSaveView?: (run: () => void) => void;
  /** SSE-drop flag → renders the offline banner (live-vs-static isolation). */
  streamOffline?: boolean;
  /** The (gated, upstream) open-entry handler bound to the blue CTA pill. */
  onOpenEntry?: () => void;
  /** Whether the entry dialog can open yet (an anchor bundle is present). */
  canOpenEntry?: boolean;
  /** The durable store is faulted (SPEC §2.9). Drives the banner region's top slot AND suppresses
   *  every dismissible notice beneath it. Threaded from `pf.health.faulted`, never from a failed try. */
  faulted?: boolean;
  /** The one-time merge notice is owed to this trader and not yet dismissed (AC-51). */
  mergeNoticePending?: boolean;
  /** The ACTIVE saved view degraded a stale filter for rendering (AC-54) — its name, or null. */
  staleViewName?: string | null;
  /** Durable dismissal of the merge notice (it must never reappear). Absent ⇒ the notice is inert. */
  onDismissMerge?: () => void;
}

/**
 * THE BANNER REGION (SPEC §4 *Banner region — the collision rule*). One region, fixed priority, top
 * to bottom:
 *
 *   1. `store-faulted` — NON-dismissible (F16 renders the banner itself into this slot)
 *   2. live-offline    — NON-dismissible, shipped copy byte-identical
 *   3. AT MOST ONE dismissible notice — the merge notice first if pending, otherwise the
 *      stale-saved-view notice; the second appears only after the first is dismissed.
 *
 * WHILE FAULTED NO DISMISSIBLE NOTICE RENDERS AT ALL (AC-66). Two independent reasons, both real: a
 * dismissal cannot be persisted in a store that refuses writes, so the notice would return forever;
 * and the merge notice would be a FALSE CLAIM, because a fault aborts the promote entirely.
 *
 * Faulted and offline are INDEPENDENT (AC-65): faulted dims nothing and shows no ⏸, offline disables
 * no control, and when both apply both banners render in this order.
 */
function BannerRegion({
  faulted,
  streamOffline,
  mergeNoticePending,
  staleViewName,
  onDismissMerge,
  faultedSlot,
}: {
  faulted: boolean;
  streamOffline: boolean;
  mergeNoticePending: boolean;
  staleViewName: string | null;
  onDismissMerge?: () => void;
  faultedSlot?: ReactNode;
}) {
  // EPHEMERAL, deliberately. Dismissing the stale-view notice is a read-side gesture and MUST NOT
  // write: reading a view never mutates it (AC-54). The merge notice's dismissal is durable and
  // therefore belongs to the host, which is why it arrives as a callback instead.
  const [staleDismissed, setStaleDismissed] = useState(false);

  const showMerge = !faulted && mergeNoticePending;
  const showStale = !faulted && !showMerge && staleViewName != null && !staleDismissed;

  return (
    <>
      {faulted && faultedSlot}

      {/* Live-offline — SHIPPED, unchanged, byte-identical copy. Non-dismissible. */}
      {streamOffline && (
        <Typography
          component="p"
          data-testid="offline-banner"
          sx={{ fontSize: '0.78rem', color: 'warning.main', mb: '10px', m: '0 0 10px' }}
        >
          ⚠ Live marks paused — P/L shown is from the last update. Records persist.
        </Typography>
      )}

      {showMerge && (
        <Box
          data-testid="merge-notice"
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            flexWrap: 'wrap',
            m: '0 0 10px',
          }}
        >
          <Typography component="p" sx={{ fontSize: '0.78rem', color: 'text.secondary', m: 0 }}>
            {MERGE_NOTICE}
          </Typography>
          {/* The export POINTER. It does not duplicate the Archive block's button and does not
              rename the shipped `Export archive` action. */}
          <Box
            component="a"
            href="#tr-archive"
            data-testid="merge-notice-export"
            sx={{ fontSize: '0.78rem', color: 'info.main', whiteSpace: 'nowrap' }}
          >
            {MERGE_NOTICE_EXPORT}
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => onDismissMerge?.()}
            data-testid="merge-notice-dismiss"
            aria-label="Dismiss the merge notice"
            sx={dismissSx}
          >
            Dismiss
          </Box>
        </Box>
      )}

      {showStale && (
        // `info`-class: NO burnt orange and NO warning icon. Nothing broke and no data was lost —
        // dressing this as a warning would be dishonest in the other direction.
        <Box
          data-testid="stale-view-notice"
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            flexWrap: 'wrap',
            m: '0 0 10px',
          }}
        >
          <Typography component="p" sx={{ fontSize: '0.78rem', color: 'info.main', m: 0 }}>
            {staleViewNotice(staleViewName as string)}
          </Typography>
          <Box
            component="button"
            type="button"
            onClick={() => setStaleDismissed(true)}
            data-testid="stale-view-dismiss"
            aria-label="Dismiss the adjusted-view notice"
            sx={dismissSx}
          >
            Dismiss
          </Box>
        </Box>
      )}
    </>
  );
}

const dismissSx = {
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontSize: '0.78rem',
  color: 'text.secondary',
  p: 0,
  whiteSpace: 'nowrap' as const,
};

// ---- Segmented-control building blocks (the frame's pill groups; mode-aware via extrasFor) ------
const segContainerSx = (theme: { palette: { mode: string } }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  bgcolor: extrasFor(theme).panelRaised,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px',
  padding: '3px',
});
const segItemSx = (active: boolean) => (theme: { palette: { mode: string } }) => ({
  cursor: 'pointer',
  border: '1px solid',
  borderColor: active ? 'divider' : 'transparent',
  background: active ? extrasFor(theme).panelRaised : 'transparent',
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: '7px',
  color: active ? 'text.primary' : 'text.secondary',
  whiteSpace: 'nowrap',
});

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  leadingLabel,
  testid,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
  leadingLabel?: string;
  testid?: string;
}) {
  return (
    <Box sx={segContainerSx} role="group" aria-label={ariaLabel} data-testid={testid}>
      {leadingLabel && (
        <Typography
          component="span"
          sx={{ fontSize: '0.6875rem', color: 'text.disabled', pl: '4px', pr: '2px' }}
        >
          {leadingLabel}
        </Typography>
      )}
      {options.map((o) => (
        <Box
          key={o.key}
          component="button"
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          data-testid={testid ? `${testid}-${o.key}` : undefined}
          sx={segItemSx(value === o.key)}
        >
          {o.label}
        </Box>
      ))}
    </Box>
  );
}

const selectBoxSx = {
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px',
  padding: '7px 11px',
  fontSize: '0.8rem',
};

export function CustomizationToolbar({
  pf,
  guardSaveView,
  streamOffline,
  onOpenEntry,
  canOpenEntry,
  faulted = false,
  mergeNoticePending = false,
  staleViewName = null,
  onDismissMerge,
}: ToolbarProps) {
  const guard = guardSaveView ?? ((run: () => void) => run());
  const { working, activeView, custom, hasUnsavedChanges } = pf;
  const [viewAnchor, setViewAnchor] = useState<null | HTMLElement>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [name, setName] = useState('');

  const toggleStatus = (s: PositionStatus) => {
    const has = working.filter.status.includes(s);
    const status = has
      ? working.filter.status.filter((x) => x !== s)
      : [...working.filter.status, s];
    pf.setFilter({ status });
  };

  const statusPillSx = (active: boolean) => ({
    cursor: 'pointer',
    border: '1px solid',
    font: 'inherit',
    fontSize: '0.74rem',
    fontWeight: 600,
    borderRadius: 999,
    padding: '3px 11px',
    ...(active
      ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderColor: 'primary.main' }
      : { background: 'transparent', color: 'text.secondary', borderColor: 'divider' }),
  });

  return (
    <Box data-testid="customization-toolbar">
      {/* Controls row — REVISION 2: ONE clean row (no wrap) matching the Figma at sm+. Below sm the
          row WRAPS (Stage 0 item 1 — the measured 952px offender at 393; nothing is removed). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          rowGap: '8px',
          mb: '6px',
        }}
      >
        {/* View picker (saved views). */}
        <Box
          component="button"
          type="button"
          onClick={(e) => setViewAnchor(e.currentTarget)}
          data-testid="view-picker"
          sx={{
            ...selectBoxSx,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            font: 'inherit',
            color: 'text.primary',
          }}
        >
          <Typography component="span" sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
            View
          </Typography>
          <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
            {activeView.name}
            {hasUnsavedChanges ? ' ●' : ''}
          </Typography>
          <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            ▾
          </Typography>
        </Box>
        <Menu anchorEl={viewAnchor} open={!!viewAnchor} onClose={() => setViewAnchor(null)}>
          {custom.views.map((v) => (
            <MenuItem
              key={v.id}
              selected={v.id === custom.activeViewId}
              onClick={() => {
                pf.switchView(v.id);
                setViewAnchor(null);
              }}
              data-testid="view-option"
              data-view-id={v.id}
            >
              <ListItemText>{v.name}</ListItemText>
              {!v.builtin && (
                <Box sx={{ display: 'inline-flex', gap: '4px', ml: 1 }}>
                  <IconButton
                    size="small"
                    aria-label="rename view"
                    onClick={(e) => {
                      e.stopPropagation();
                      setName(v.name);
                      setRenameOpen(v.id);
                      setViewAnchor(null);
                    }}
                  >
                    ✎
                  </IconButton>
                  <Refused when={faulted}>
                    <IconButton
                      size="small"
                      aria-label="delete view"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteOpen(v.id);
                        setViewAnchor(null);
                      }}
                    >
                      🗑
                    </IconButton>
                  </Refused>
                </Box>
              )}
            </MenuItem>
          ))}
          <Divider />
          {hasUnsavedChanges && !activeView.builtin && (
            <Refused when={faulted}>
              <MenuItem
                onClick={() => {
                  guard(() => pf.saveChanges());
                  setViewAnchor(null);
                }}
                data-testid="save-changes"
              >
                Save changes to '{activeView.name}'
              </MenuItem>
            </Refused>
          )}
          <Refused when={faulted}>
            <MenuItem
              onClick={() => {
                setName('');
                setSaveAsOpen(true);
                setViewAnchor(null);
              }}
              data-testid="save-as-new"
            >
              Save as new view…
            </MenuItem>
          </Refused>
          <Divider />
          <MenuItem disableRipple sx={{ pointerEvents: 'none' }}>
            <Tooltip arrow title={SAVED_VIEW_TIP}>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                ⓘ A named snapshot of your view.
              </Typography>
            </Tooltip>
          </MenuItem>
        </Menu>

        {/* Thin vertical divider. */}
        <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider' }} />

        {/* Layout segmented. */}
        <Segmented
          ariaLabel="layout"
          testid="layout-toggle"
          value={working.layout}
          options={[
            { key: 'table', label: 'Table' },
            { key: 'card', label: 'Cards' },
          ]}
          onChange={(v) => pf.setWorking({ layout: v })}
        />

        {/* Density segmented. */}
        <Segmented
          ariaLabel="density"
          testid="density-toggle"
          value={working.density}
          options={[
            { key: 'comfortable', label: 'Comfortable' },
            { key: 'compact', label: 'Compact' },
          ]}
          onChange={(v) => pf.setWorking({ density: v })}
        />

        {/* Group segmented (None · Ticker · Structure) — REVISION 2: Expiry option dropped. */}
        <Segmented
          ariaLabel="group"
          testid="group-select"
          leadingLabel="Group"
          value={working.group}
          options={GROUP_AXES}
          onChange={(v) => pf.setWorking({ group: v })}
        />

        {/* Spacer + the primary CTA. */}
        <Box sx={{ flex: 1 }} />
        <Refused when={faulted}>
          <Box
            component="button"
            type="button"
            onClick={() => onOpenEntry?.()}
            // While FAULTED the HTML `disabled` attribute must never appear here: it would take the
            // control out of the tab order and swallow the hover, putting the reason for the
            // refusal out of reach of both keyboard and mouse. `Refused` owns that treatment.
            disabled={!faulted && !canOpenEntry}
            data-testid="open-entry"
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              border: 'none',
              font: 'inherit',
              padding: '8px 15px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: canOpenEntry && !faulted ? 'pointer' : 'not-allowed',
              opacity: canOpenEntry ? 1 : 0.5,
            }}
          >
            + Open simulated position
          </Box>
        </Refused>
      </Box>

      {/* Status-pill row. */}
      <Box
        sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', mb: '14px' }}
        data-testid="status-chips"
      >
        {STATUSES.map((s) => (
          <Box
            key={s}
            component="button"
            type="button"
            onClick={() => toggleStatus(s)}
            aria-pressed={working.filter.status.includes(s)}
            data-testid={`status-chip-${s}`}
            sx={statusPillSx(working.filter.status.includes(s))}
          >
            {s}
          </Box>
        ))}
        <Box
          component="button"
          type="button"
          onClick={() => pf.setFilter({ status: ['closed', 'cancelled'] })}
          data-testid="history-button"
          sx={{
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            font: 'inherit',
            fontSize: '0.78rem',
            // Link-class text binds `info` (stage-3 §4.2: links are signal-blue, never amber).
            color: 'info.main',
            ml: '4px',
          }}
        >
          History
        </Box>
      </Box>

      {/* THE banner region — one place, fixed priority (SPEC §4). */}
      <BannerRegion
        faulted={faulted}
        streamOffline={!!streamOffline}
        mergeNoticePending={mergeNoticePending}
        staleViewName={staleViewName}
        onDismissMerge={onDismissMerge}
        faultedSlot={<FaultedBanner />}
      />

      {/* Save-as-new dialog. */}
      <Dialog open={saveAsOpen} onClose={() => setSaveAsOpen(false)}>
        <DialogTitle>Name this view</DialogTitle>
        <DialogContent>
          {/* autoFocus KEPT, justified (redesign-stage-0 §3 item 4): moving focus into a
              just-opened modal's single field is the expected a11y behavior — the WCAG
              "sparingly" carve-out, not a focus-steal. */}
          <TextField
            autoFocus
            size="small"
            fullWidth
            sx={{ mt: 1 }}
            placeholder="e.g. Tech swings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="save-as-name"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveAsOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim()}
            onClick={() => {
              const n = name.trim();
              setSaveAsOpen(false);
              guard(() => pf.saveAsNewView(n));
            }}
            data-testid="save-view-confirm"
          >
            Save view
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog. */}
      <Dialog open={!!renameOpen} onClose={() => setRenameOpen(null)}>
        <DialogTitle>Rename view</DialogTitle>
        <DialogContent>
          {/* autoFocus KEPT, justified (redesign-stage-0 §3 item 4): moving focus into a
              just-opened modal's single field is the expected a11y behavior — the WCAG
              "sparingly" carve-out, not a focus-steal. */}
          <TextField
            autoFocus
            size="small"
            fullWidth
            sx={{ mt: 1 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="rename-name"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim()}
            onClick={() => {
              if (renameOpen) pf.renameView(renameOpen, name.trim());
              setRenameOpen(null);
            }}
            data-testid="rename-confirm"
          >
            Rename view
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm. */}
      <Dialog open={!!deleteOpen} onClose={() => setDeleteOpen(null)}>
        <DialogTitle>Delete view</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Delete '{custom.views.find((v) => v.id === deleteOpen)?.name}'? Your positions are
            unaffected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              if (deleteOpen) pf.deleteView(deleteOpen);
              setDeleteOpen(null);
            }}
            data-testid="delete-confirm"
          >
            Delete view
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
