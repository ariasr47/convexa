/**
 * Persona UI — PersonaPicker (toolbar), PersonaCustomizeForm. All presentation-only: switching
 * persona never recomputes or fetches. Copy is verbatim from UX_BLUEPRINT.
 */
import { useEffect, useState } from 'react';
import {
  Select, MenuItem, ListSubheader, FormControl, InputLabel, Tooltip, Box, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Typography, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Alert,
} from '@mui/material';
import type { PersonaRisk, PersonaDefinition } from '@org/api';
import { usePersona, CustomDraft } from './usePersona';

const PICKER_TOOLTIP =
  'Pick how the AI is briefed about your style. Persona changes only the hand-off prompt — never the ' +
  'score, tier, gate, or fingerprint, and it never recomputes anything.';
const CAVEAT =
  "Customizations only add framing emphasis. They can't change the AI's risk-first floor, the verdict " +
  'schema (Hold / Trim / Add / Exit / Roll), the Add cap, the no-auto-apply rule, the Roll constraint, ' +
  'or what data is sent — those are fixed and always take precedence.';
const CUSTOMIZE_VALUE = '__customize__';

type Persona = ReturnType<typeof usePersona>;

// ---- Toolbar picker ---------------------------------------------------------------------------
export function PersonaPicker({ persona, onOpenCustomize, externalLabel }:
  { persona: Persona; onOpenCustomize: () => void; externalLabel?: boolean }) {
  const { presets, customs, activeId, setActive, active } = persona;
  return (
    <Tooltip arrow title={PICKER_TOOLTIP}>
      <FormControl size="small" sx={{ minWidth: 190 }}>
        {/* `externalLabel` (toolbar): the caption sits ABOVE the field per the Figma; suppress the
            built-in floating label but keep an accessible name. */}
        {!externalLabel && <InputLabel>Persona</InputLabel>}
        <Select
          label={externalLabel ? undefined : 'Persona'}
          inputProps={externalLabel ? { 'aria-label': 'Persona' } : undefined}
          value={activeId}
          onChange={(e) => { const v = String(e.target.value); if (v === CUSTOMIZE_VALUE) onOpenCustomize(); else setActive(v); }}
          renderValue={() => active.name}
        >
          <MenuItem value="default">Default (no persona)</MenuItem>
          <ListSubheader>Presets</ListSubheader>
          {presets.filter((p) => p.id !== 'default').map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
          ))}
          {customs.length > 0 && <ListSubheader>Custom</ListSubheader>}
          {customs.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          <MenuItem value={CUSTOMIZE_VALUE}>Customize…</MenuItem>
        </Select>
      </FormControl>
    </Tooltip>
  );
}

// ---- Customize form ---------------------------------------------------------------------------
const LEANS = ['Lean Exit/Trim', 'Balanced', 'More open to Add (within cap)'];

export function PersonaCustomizeForm({ open, onClose, persona }:
  { open: boolean; onClose: () => void; persona: Persona }) {
  const { presets, saveCustom, active } = persona;
  const [name, setName] = useState('');
  const [basedOn, setBasedOn] = useState('balanced_swinger');
  const [risk, setRisk] = useState<PersonaRisk>('moderate');
  const [lean, setLean] = useState('Balanced');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    const seed: PersonaDefinition = !active.builtin ? active : (presets.find((p) => p.id === active.id) ?? presets[1]);
    setBasedOn(seed.based_on ?? (seed.id === 'default' ? 'balanced_swinger' : seed.id));
    setRisk(seed.risk);
    setNote(seed.emphasis_note ?? '');
    setName(seed.builtin ? '' : seed.name);
    setLean('Balanced');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const draft: CustomDraft = {
      name: name || `${presets.find((p) => p.id === basedOn)?.name ?? 'Custom'} (custom)`,
      basedOn, risk,
      reassessment_lean: lean,
      emphasis_note: note,
    };
    saveCustom(draft);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Customize persona</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Based on</InputLabel>
            <Select label="Based on" value={basedOn} onChange={(e) => setBasedOn(String(e.target.value))}>
              {presets.filter((p) => p.id !== 'default').map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Risk level</Typography>
            <Tooltip arrow title="Calibrates sizing, invalidation, and how open the framing is to adding — always within the fixed Add cap.">
              <ToggleButtonGroup exclusive size="small" fullWidth value={risk} onChange={(_, v) => v && setRisk(v)}>
                <ToggleButton value="conservative">Conservative</ToggleButton>
                <ToggleButton value="moderate">Moderate</ToggleButton>
                <ToggleButton value="aggressive">Aggressive</ToggleButton>
              </ToggleButtonGroup>
            </Tooltip>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Reassessment lean</Typography>
            <Tooltip arrow title="Tunes how the AI weighs Hold/Trim/Add/Exit/Roll — within the same fixed verdict schema and Add cap. It can't enable auto-apply or change the Roll rule.">
              <ToggleButtonGroup exclusive size="small" fullWidth value={lean} onChange={(_, v) => v && setLean(v)}>
                {LEANS.map((l) => <ToggleButton key={l} value={l} sx={{ fontSize: 11 }}>{l}</ToggleButton>)}
              </ToggleButtonGroup>
            </Tooltip>
          </Box>
          <TextField
            size="small" label="Emphasis note" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder='e.g. "defined-risk only" · "I avoid earnings weeks" · "prioritize liquidity"'
            slotProps={{ htmlInput: { maxLength: 160 } }}
          />
          <TextField size="small" label="Persona name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My persona" />
          <Alert severity="info" icon={false}>{CAVEAT}</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>Save persona</Button>
      </DialogActions>
    </Dialog>
  );
}
