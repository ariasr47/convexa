/**
 * The customization toolbar (UX_BLUEPRINT §6 S8 / §5): view picker (+ unsaved-changes dot), layout
 * toggle, density toggle, group selector, sort control, filter chips, Columns menu, and the saved-view
 * create/rename/delete/switch UX. All controls re-derive the view — NONE triggers a fetch or mutates a
 * position. Static/durable: untouched by an SSE drop.
 */
import { useState } from 'react';
import {
  Stack, ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select, MenuItem, Button,
  Tooltip, Menu, Checkbox, ListItemText, Box, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Chip, IconButton, Divider,
} from '@mui/material';
import type { usePortfolio } from './usePortfolio';
import type { ColumnKey, GroupAxis, SortKey, SortDir, PositionStatus, Strategy } from './types';
import { DEFAULT_COLUMNS, OPTIONAL_COLUMNS, COLUMN_LABELS } from './defaults';
import { GROUP_TIP, SAVED_VIEW_TIP } from './labels';
import { distinctTickers, distinctExpirations } from './derive';
import type { Position } from './types';

type Portfolio = ReturnType<typeof usePortfolio>;

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: 'pl_dollar', label: 'P/L ($)' }, { key: 'pl_pct', label: 'P/L (%)' },
  { key: 'delta_entry', label: 'Δ since entry' }, { key: 'session_delta', label: 'Session Δ' },
  { key: 'ticker', label: 'Ticker' }, { key: 'strategy', label: 'Strategy' },
  { key: 'expiry', label: 'Expiry' }, { key: 'dte', label: 'DTE' },
  { key: 'qty', label: 'Qty' }, { key: 'entry_time', label: 'Entry time' },
];

const STATUSES: PositionStatus[] = ['open', 'pending', 'closed', 'cancelled'];
const STRATEGIES: { key: Strategy; label: string }[] = [
  { key: 'long_call', label: 'Long call' }, { key: 'long_put', label: 'Long put' },
];

interface ToolbarProps {
  pf: Portfolio;
  positions: Position[];
  /** Gate a save-view WRITE (UX_BLUEPRINT §2.6): logged-out ⇒ run shows the sign-in prompt instead of
   *  saving. Defaults to running the action directly (e.g. in isolated renders). */
  guardSaveView?: (run: () => void) => void;
}

export function CustomizationToolbar({ pf, positions, guardSaveView }: ToolbarProps) {
  const guard = guardSaveView ?? ((run: () => void) => run());
  const { working, activeView, custom, hasUnsavedChanges } = pf;
  const [colAnchor, setColAnchor] = useState<null | HTMLElement>(null);
  const [viewAnchor, setViewAnchor] = useState<null | HTMLElement>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [name, setName] = useState('');

  const tickers = distinctTickers(positions);
  const expirations = distinctExpirations(positions);
  const allColumns: ColumnKey[] = [...DEFAULT_COLUMNS, ...OPTIONAL_COLUMNS];

  const toggleColumn = (c: ColumnKey) => {
    if (c === 'simulated') return; // not removable
    const has = working.columns.includes(c);
    const columns = has ? working.columns.filter((x) => x !== c) : [...working.columns, c];
    pf.setWorking({ columns });
  };

  const toggleStatus = (s: PositionStatus) => {
    const has = working.filter.status.includes(s);
    const status = has ? working.filter.status.filter((x) => x !== s) : [...working.filter.status, s];
    pf.setFilter({ status });
  };

  return (
    <Box data-testid="customization-toolbar">
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
        {/* View picker. */}
        <Button variant="outlined" size="small" onClick={(e) => setViewAnchor(e.currentTarget)} data-testid="view-picker">
          {activeView.name}{hasUnsavedChanges ? ' ●' : ''}
        </Button>
        <Menu anchorEl={viewAnchor} open={!!viewAnchor} onClose={() => setViewAnchor(null)}>
          {custom.views.map((v) => (
            <MenuItem key={v.id} selected={v.id === custom.activeViewId}
              onClick={() => { pf.switchView(v.id); setViewAnchor(null); }} data-testid="view-option" data-view-id={v.id}>
              <ListItemText>{v.name}</ListItemText>
              {!v.builtin && (
                <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
                  <IconButton size="small" aria-label="rename view" onClick={(e) => { e.stopPropagation(); setName(v.name); setRenameOpen(v.id); setViewAnchor(null); }}>✎</IconButton>
                  <IconButton size="small" aria-label="delete view" onClick={(e) => { e.stopPropagation(); setDeleteOpen(v.id); setViewAnchor(null); }}>🗑</IconButton>
                </Stack>
              )}
            </MenuItem>
          ))}
          <Divider />
          {hasUnsavedChanges && !activeView.builtin && (
            <MenuItem onClick={() => { guard(() => pf.saveChanges()); setViewAnchor(null); }} data-testid="save-changes">
              Save changes to '{activeView.name}'
            </MenuItem>
          )}
          <MenuItem onClick={() => { setName(''); setSaveAsOpen(true); setViewAnchor(null); }} data-testid="save-as-new">
            Save as new view…
          </MenuItem>
        </Menu>
        <Tooltip arrow title={SAVED_VIEW_TIP}><Typography variant="caption" color="text.disabled">ⓘ</Typography></Tooltip>

        {/* Layout toggle. */}
        <ToggleButtonGroup exclusive size="small" value={working.layout} onChange={(_, v) => v && pf.setWorking({ layout: v })} aria-label="layout">
          <ToggleButton value="table">Table</ToggleButton>
          <ToggleButton value="card">Cards</ToggleButton>
        </ToggleButtonGroup>

        {/* Density toggle. */}
        <ToggleButtonGroup exclusive size="small" value={working.density} onChange={(_, v) => v && pf.setWorking({ density: v })} aria-label="density">
          <ToggleButton value="comfortable">Comfortable</ToggleButton>
          <ToggleButton value="compact">Compact</ToggleButton>
        </ToggleButtonGroup>

        {/* Group selector. */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Group</InputLabel>
          <Select label="Group" value={working.group} onChange={(e) => pf.setWorking({ group: e.target.value as GroupAxis })} data-testid="group-select">
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="ticker">Ticker</MenuItem>
            <MenuItem value="strategy">Strategy</MenuItem>
            <MenuItem value="expiry">Expiry</MenuItem>
          </Select>
        </FormControl>
        <Tooltip arrow title={GROUP_TIP}><Typography variant="caption" color="text.disabled">ⓘ</Typography></Tooltip>

        {/* Sort control. */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Sort</InputLabel>
          <Select label="Sort" value={working.sortKey} onChange={(e) => pf.setWorking({ sortKey: e.target.value as SortKey })} data-testid="sort-select">
            {SORT_KEYS.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Button size="small" onClick={() => pf.setWorking({ sortDir: (working.sortDir === 'asc' ? 'desc' : 'asc') as SortDir })} data-testid="sort-dir">
          {working.sortDir === 'asc' ? 'Asc ▲' : 'Desc ▼'}
        </Button>

        {/* Columns menu. */}
        <Button size="small" onClick={(e) => setColAnchor(e.currentTarget)} data-testid="columns-button">Columns</Button>
        <Menu anchorEl={colAnchor} open={!!colAnchor} onClose={() => setColAnchor(null)}>
          {allColumns.map((c) => (
            <MenuItem key={c} onClick={() => toggleColumn(c)} disabled={c === 'simulated'} data-testid="column-option" data-col={c}>
              <Checkbox size="small" checked={working.columns.includes(c)} />
              <ListItemText>{COLUMN_LABELS[c]}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </Stack>

      {/* Filter chips. */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center', mt: 1 }} data-testid="filter-row">
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Ticker</InputLabel>
          <Select label="Ticker" value={working.filter.ticker ?? ''} onChange={(e) => pf.setFilter({ ticker: e.target.value === '' ? null : String(e.target.value) })} data-testid="filter-ticker">
            <MenuItem value="">All</MenuItem>
            {tickers.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Strategy</InputLabel>
          <Select label="Strategy" value={working.filter.strategy ?? ''} onChange={(e) => pf.setFilter({ strategy: (e.target.value as string) === '' ? null : e.target.value as Strategy })} data-testid="filter-strategy">
            <MenuItem value="">All</MenuItem>
            {STRATEGIES.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Expiry</InputLabel>
          <Select label="Expiry" value={working.filter.expiry ?? ''} onChange={(e) => pf.setFilter({ expiry: e.target.value === '' ? null : String(e.target.value) })} data-testid="filter-expiry">
            <MenuItem value="">All</MenuItem>
            {expirations.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }} data-testid="status-chips">
          {STATUSES.map((s) => (
            <Chip key={s} size="small" label={s} clickable
              color={working.filter.status.includes(s) ? 'primary' : 'default'}
              variant={working.filter.status.includes(s) ? 'filled' : 'outlined'}
              onClick={() => toggleStatus(s)} data-testid={`status-chip-${s}`} />
          ))}
        </Stack>
        <Button size="small" onClick={() => pf.setFilter({ status: ['closed', 'cancelled'] })} data-testid="history-button">History</Button>
      </Stack>

      {/* Save-as-new dialog. */}
      <Dialog open={saveAsOpen} onClose={() => setSaveAsOpen(false)}>
        <DialogTitle>Name this view</DialogTitle>
        <DialogContent>
          <TextField autoFocus size="small" fullWidth sx={{ mt: 1 }} placeholder="e.g. Tech swings"
            value={name} onChange={(e) => setName(e.target.value)} data-testid="save-as-name" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveAsOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name.trim()} onClick={() => { const n = name.trim(); setSaveAsOpen(false); guard(() => pf.saveAsNewView(n)); }} data-testid="save-view-confirm">
            Save view
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog. */}
      <Dialog open={!!renameOpen} onClose={() => setRenameOpen(null)}>
        <DialogTitle>Rename view</DialogTitle>
        <DialogContent>
          <TextField autoFocus size="small" fullWidth sx={{ mt: 1 }} value={name} onChange={(e) => setName(e.target.value)} data-testid="rename-name" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(null)}>Cancel</Button>
          <Button variant="contained" disabled={!name.trim()} onClick={() => { if (renameOpen) pf.renameView(renameOpen, name.trim()); setRenameOpen(null); }} data-testid="rename-confirm">
            Rename view
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm. */}
      <Dialog open={!!deleteOpen} onClose={() => setDeleteOpen(null)}>
        <DialogTitle>Delete view</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Delete '{custom.views.find((v) => v.id === deleteOpen)?.name}'? Your positions are unaffected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(null)}>Cancel</Button>
          <Button color="error" onClick={() => { if (deleteOpen) pf.deleteView(deleteOpen); setDeleteOpen(null); }} data-testid="delete-confirm">
            Delete view
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
