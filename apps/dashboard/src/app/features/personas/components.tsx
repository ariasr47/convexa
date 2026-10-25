/**
 * Persona UI — PersonaPicker (toolbar), PersonaCustomizeForm. All presentation-only: switching
 * persona never recomputes or fetches. Copy is verbatim from UX_BLUEPRINT.
 */
import { bottomSheetActionsSx, bottomSheetDialogSx, grabHandleSx } from '@/shared/ui/bottomSheet';
import { coarseFloor } from '@/shared/ui/touch';
import type { PersonaDefinition, PersonaRisk } from '@convexa/api';
import CheckIcon from '@mui/icons-material/Check';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useState } from 'react';
import { presetById } from './presets';
import { CustomDraft, usePersona } from './usePersona';

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
export function PersonaPicker({
  persona,
  onOpenCustomize,
  externalLabel,
}: {
  persona: Persona;
  onOpenCustomize: () => void;
  externalLabel?: boolean;
}) {
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
          onChange={(e) => {
            const v = String(e.target.value);
            if (v === CUSTOMIZE_VALUE) onOpenCustomize();
            else setActive(v);
          }}
          renderValue={() => active.name}
        >
          <MenuItem value="default">Default (no persona)</MenuItem>
          <ListSubheader>Presets</ListSubheader>
          {presets
            .filter((p) => p.id !== 'default')
            .map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          {customs.length > 0 && <ListSubheader>Custom</ListSubheader>}
          {customs.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
          <MenuItem value={CUSTOMIZE_VALUE}>Customize…</MenuItem>
        </Select>
      </FormControl>
    </Tooltip>
  );
}

// ---- Customize form ---------------------------------------------------------------------------
/** Each lean's VALUE is the prompt text a saved persona carries (`reassessment_lean`, sent in the
 *  hand-off), so it stays as shipped; only the button LABEL reads in sentence case, as the persona
 *  board draws it (fidelity audit 2026-10-25, ACC-14). */
const LEANS = [
  { value: 'Lean Exit/Trim', label: 'Lean exit or trim' },
  { value: 'Balanced', label: 'Balanced' },
  { value: 'More open to Add (within cap)', label: 'More open to add' },
] as const;

/** The base a custom persona starts from when it names none (or names no preset): Balanced Swinger,
 *  the baseline directional read. */
const DEFAULT_BASE = 'balanced_swinger';

/** The preset a persona is "Based on": its own `based_on`, a preset's own id, else the default base.
 *  Never an id the Based on list doesn't hold, which left the field blank (the demo's seeded custom
 *  persona, `demo-careful-reader`, matched no option). */
function basePresetId(p: PersonaDefinition): string {
  const id = p.based_on ?? (p.builtin ? p.id : DEFAULT_BASE);
  return id !== 'default' && presetById(id) ? id : DEFAULT_BASE;
}

export function PersonaCustomizeForm({
  open,
  onClose,
  persona,
}: {
  open: boolean;
  onClose: () => void;
  persona: Persona;
}) {
  const { presets, customs, saveCustom, active } = persona;
  const [name, setName] = useState('');
  const [basedOn, setBasedOn] = useState(DEFAULT_BASE);
  const [risk, setRisk] = useState<PersonaRisk>('moderate');
  const [lean, setLean] = useState('Balanced');
  const [note, setNote] = useState('');
  // The persona the form was filled from: the active one when the dialog opens, or the one picked in
  // the list. Picking only refills the form; nothing changes until Save.
  const [startId, setStartId] = useState(active.id);
  const listLabelId = useId();

  const fillFrom = (seed: PersonaDefinition) => {
    setStartId(seed.id);
    setBasedOn(basePresetId(seed));
    setRisk(seed.risk);
    setNote(seed.emphasis_note ?? '');
    setName(seed.builtin ? '' : seed.name);
    setLean('Balanced');
  };

  useEffect(() => {
    if (!open) return;
    fillFrom(active);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const listed = [...presets, ...customs];

  const save = () => {
    const draft: CustomDraft = {
      name: name || `${presets.find((p) => p.id === basedOn)?.name ?? 'Custom'} (custom)`,
      basedOn,
      risk,
      reassessment_lean: lean,
      emphasis_note: note,
    };
    saveCustom(draft);
    onClose();
  };

  return (
    // The persona board (`personaDemo`, `design/src/screens/final/account-dialogs.mjs`): 760 wide,
    // the persona list beside the form (2fr | 3fr), stacked under 600px, where the dialog is the
    // shared bottom sheet (fidelity audit 2026-10-25, ACC-10, ACC-14, ACC-15). The surface is the
    // theme's (OVL).
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      sx={bottomSheetDialogSx}
      slotProps={{ paper: { sx: { maxWidth: 760 } } }}
    >
      {/* `flexShrink: 0`: the sheet fills its 92dvh, and the paper's flex column would otherwise
          squeeze the 4px handle. */}
      <Box aria-hidden sx={[grabHandleSx, { flexShrink: 0 }]} />
      <DialogTitle>Customize persona</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 2fr) minmax(0, 3fr)' },
            gap: 2,
            alignItems: 'start',
            mt: 0.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              id={listLabelId}
              component="div"
              sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, mb: 0.75 }}
            >
              Persona
            </Typography>
            <MenuList
              role="listbox"
              aria-labelledby={listLabelId}
              data-testid="persona-customize-list"
              disablePadding
              sx={{ border: 1, borderColor: 'divider', borderRadius: '10px', overflow: 'hidden' }}
            >
              {listed.map((p) => {
                const on = p.id === startId;
                return (
                  <MenuItem
                    key={p.id}
                    role="option"
                    aria-selected={on}
                    selected={on}
                    dense
                    onClick={() => fillFrom(p)}
                    sx={{
                      minHeight: 36,
                      // A 36px row is the desk's mouse density; under a coarse pointer (the phone
                      // sheet) the row takes the canon's 44px touch floor. The theme's element-
                      // selector floor does not reach an `li[role="option"]` (shared/ui/touch.ts).
                      ...coarseFloor,
                      gap: 1,
                      fontSize: 13,
                      fontWeight: on ? 600 : 400,
                      // The board's selected row is a neutral raise, not the primary tint: amber is
                      // the dialog's one primary action (Save persona). The same neutral tint as the
                      // Settings theme tiles' selected state.
                      '&.Mui-selected, &.Mui-selected:hover': {
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
                      },
                    }}
                  >
                    <Box
                      component="span"
                      aria-hidden
                      sx={{ width: 14, flex: 'none', display: 'inline-flex' }}
                    >
                      {on && <CheckIcon sx={{ fontSize: 14 }} />}
                    </Box>
                    <Box component="span" sx={{ minWidth: 0 }}>
                      {p.name}
                    </Box>
                  </MenuItem>
                );
              })}
            </MenuList>
          </Box>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Based on</InputLabel>
              <Select
                label="Based on"
                value={basedOn}
                onChange={(e) => setBasedOn(String(e.target.value))}
              >
                {presets
                  .filter((p) => p.id !== 'default')
                  .map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Risk level
              </Typography>
              <Tooltip
                arrow
                title="Calibrates sizing, invalidation, and how open the framing is to adding — always within the fixed Add cap."
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  fullWidth
                  value={risk}
                  onChange={(_, v) => v && setRisk(v)}
                >
                  <ToggleButton value="conservative">Conservative</ToggleButton>
                  <ToggleButton value="moderate">Moderate</ToggleButton>
                  <ToggleButton value="aggressive">Aggressive</ToggleButton>
                </ToggleButtonGroup>
              </Tooltip>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Reassessment lean
              </Typography>
              <Tooltip
                arrow
                title="Tunes how the AI weighs Hold/Trim/Add/Exit/Roll — within the same fixed verdict schema and Add cap. It can't enable auto-apply or change the Roll rule."
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  fullWidth
                  value={lean}
                  onChange={(_, v) => v && setLean(v)}
                >
                  {LEANS.map((l) => (
                    <ToggleButton key={l.value} value={l.value}>
                      {l.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Tooltip>
            </Box>
            <TextField
              size="small"
              label="Emphasis note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "defined-risk only" · "I avoid earnings weeks" · "prioritize liquidity"'
              slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            <TextField
              size="small"
              label="Persona name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My persona"
            />
          </Stack>
        </Box>
        <Alert severity="info" icon={false} sx={{ mt: 2 }}>
          {CAVEAT}
        </Alert>
      </DialogContent>
      <DialogActions
        sx={[
          bottomSheetActionsSx,
          // On the sheet the buttons stack with an 8px row gap; MUI's 8px left margin between
          // actions would push the second one in.
          {
            '@media (max-width: 599px)': {
              rowGap: 1,
              '& > :not(style) ~ :not(style)': { ml: 0 },
            },
          },
        ]}
      >
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save persona
        </Button>
      </DialogActions>
    </Dialog>
  );
}
