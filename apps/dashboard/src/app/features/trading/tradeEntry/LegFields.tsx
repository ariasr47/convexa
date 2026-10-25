/**
 * One leg's fields for the shared TradeEntryDialog.
 */
import type { InstrumentKind, LegSide } from '@/features/trading/positions/leg';
import type { OptionRight } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { FieldLabel } from './FieldLabel';
import type { ManualLegErrors } from './manualContract';
import type { LegDraft } from './types';

/** `100` for a standard option contract, `1` for equity — decided HERE and stored on the leg. */
export const multiplierFor = (kind: InstrumentKind) => (kind === 'option' ? 100 : 1);

/**
 * The leg grid (the Final trade-entry board's `.ac-g4`, `design/src/screens/final/account-dialogs.mjs`;
 * fidelity audit 2026-10-25, ACC-11): Side, Expiration, Strike and Right on one row of four from
 * 600px, two by two on a phone. Quantity and the price sit on the row below, two across.
 */
const LEG_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
  gap: '10px',
} as const;
const PAIR_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
} as const;

/** A value the trader cannot change here, drawn as the board's quiet field (`.fld .in.dis`): a
 *  dashed outline, no fill, steel text. Read-only, never `disabled`, so it stays readable and in
 *  the accessibility tree. */
export const readOnlyFieldSx = {
  '& .MuiOutlinedInput-root': { bgcolor: 'transparent', color: 'text.secondary' },
  '& .MuiOutlinedInput-notchedOutline': { borderStyle: 'dashed' },
} as const;

/**
 * One leg's fields. For a SINGLE leg the ids and the layout are the shipped ones, so the common path
 * gains ZERO steps (AC-7); additional legs suffix their ids so they stay unique.
 */
export function LegFields({
  draft,
  index,
  total,
  multiLeg,
  expirations,
  strikes,
  inputSx,
  showPrice,
  priceSlot,
  manualContract = false,
  today,
  errors,
  onPatch,
  onRemove,
}: {
  draft: LegDraft;
  index: number;
  total: number;
  multiLeg: boolean;
  expirations: string[];
  strikes: number[];
  inputSx: object;
  showPrice: boolean;
  /** The single-option entry's mode-scoped price, owned by the dialog and drawn beside Quantity. */
  priceSlot?: ReactNode;
  /** No options chain: the expiration and strike are typed, not picked (manualContract.ts). */
  manualContract?: boolean;
  /** Lower bound for the typed expiration (YYYY-MM-DD). */
  today?: string;
  /** What is wrong with this leg's typed values, shown under each field once it has a value. */
  errors?: ManualLegErrors;
  onPatch: (patch: Partial<LegDraft>) => void;
  onRemove: () => void;
}) {
  const id = (base: string) => (index === 0 ? base : `${base}-${index}`);
  const isOption = draft.kind === 'option';
  const suffix = index === 0 ? '' : ` leg ${index + 1}`;
  return (
    <Box
      data-testid={`entry-leg-${index}`}
      sx={
        // A `divider` rule between legs so a four-leg form reads as FOUR OBJECTS rather than one
        // long ribbon of controls — the same idea as the leg block's left rule in the book, and it
        // costs no colour. Absent for a single leg, where the shipped layout is unchanged.
        index > 0 ? { borderTop: '1px solid', borderColor: 'divider', pt: 1.5 } : undefined
      }
    >
      {total > 1 && (
        <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
            Leg {index + 1}
          </Typography>
          <Button
            size="small"
            onClick={onRemove}
            data-testid={`entry-remove-leg-${index}`}
            sx={{ color: 'text.secondary', minWidth: 0 }}
          >
            Remove
          </Button>
        </Stack>
      )}

      <Stack spacing="14px">
        {/* The instrument (multi-leg only). Shares carry no strike/expiry/right at all — never a
            zero-filled one. Half the row from 600px, so it lines up over the Side and Expiration
            cells beneath it. */}
        {multiLeg && (
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={draft.kind}
            onChange={(_, v) => v && onPatch({ kind: v as InstrumentKind })}
            aria-label={`instrument${suffix}`}
            data-testid={`entry-kind-${index}`}
            sx={{ width: { xs: '100%', sm: 'calc(50% - 5px)' } }}
          >
            <ToggleButton value="option">Option</ToggleButton>
            <ToggleButton value="equity">Shares</ToggleButton>
          </ToggleButtonGroup>
        )}

        <Box sx={LEG_GRID_SX}>
          {/* Side. Buy/Sell is UNTINTED: a short leg is not a loss (SPEC §4 Design direction 4). A
              single-leg entry has no short side to offer (its hosts open one long contract), so it
              states the side as a read-only field rather than offering a control that can't act. */}
          <Box sx={{ minWidth: 0 }}>
            {multiLeg ? (
              <>
                <FieldLabel>Side</FieldLabel>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  fullWidth
                  value={draft.side}
                  onChange={(_, v) => v && onPatch({ side: v as LegSide })}
                  aria-label={`direction${suffix}`}
                  data-testid={`entry-side-${index}`}
                >
                  <ToggleButton value="long">Buy</ToggleButton>
                  <ToggleButton value="short">Sell</ToggleButton>
                </ToggleButtonGroup>
              </>
            ) : (
              <>
                <FieldLabel htmlFor={id('entry-side')}>Side</FieldLabel>
                <TextField
                  id={id('entry-side')}
                  size="small"
                  fullWidth
                  value={draft.side === 'short' ? 'Short' : 'Long'}
                  slotProps={{ htmlInput: { readOnly: true, 'aria-label': `Side${suffix}` } }}
                  sx={readOnlyFieldSx}
                />
              </>
            )}
          </Box>

          {isOption &&
            (manualContract ? (
              <>
                <Box sx={{ minWidth: 0 }}>
                  <FieldLabel htmlFor={id('entry-expiration')}>Expiration</FieldLabel>
                  <TextField
                    id={id('entry-expiration')}
                    size="small"
                    fullWidth
                    type="date"
                    value={draft.expiration}
                    onChange={(e) => onPatch({ expiration: e.target.value })}
                    error={!!draft.expiration && !!errors?.expiration}
                    helperText={draft.expiration ? errors?.expiration : undefined}
                    slotProps={{
                      htmlInput: { min: today, 'aria-label': `Expiration${suffix}` },
                    }}
                    sx={inputSx}
                  />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <FieldLabel htmlFor={id('entry-strike')}>Strike</FieldLabel>
                  <TextField
                    id={id('entry-strike')}
                    size="small"
                    fullWidth
                    type="number"
                    value={draft.strike}
                    onChange={(e) =>
                      onPatch({ strike: e.target.value === '' ? '' : Number(e.target.value) })
                    }
                    error={draft.strike !== '' && !!errors?.strike}
                    helperText={draft.strike !== '' ? errors?.strike : undefined}
                    slotProps={{
                      htmlInput: { min: 0, step: 'any', 'aria-label': `Strike${suffix}` },
                    }}
                    sx={inputSx}
                  />
                </Box>
              </>
            ) : (
              <>
                <Box sx={{ minWidth: 0 }}>
                  <FieldLabel htmlFor={id('entry-expiration')}>Expiration</FieldLabel>
                  <Select
                    id={id('entry-expiration')}
                    size="small"
                    fullWidth
                    value={draft.expiration}
                    onChange={(e) => onPatch({ expiration: String(e.target.value) })}
                    sx={inputSx}
                    inputProps={{ 'aria-label': `Expiration${suffix}` }}
                  >
                    {expirations.map((d) => (
                      <MenuItem key={d} value={d}>
                        {d}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <FieldLabel htmlFor={id('entry-strike')}>Strike</FieldLabel>
                  <Select
                    id={id('entry-strike')}
                    size="small"
                    fullWidth
                    value={draft.strike === '' ? '' : String(draft.strike)}
                    onChange={(e) => onPatch({ strike: Number(e.target.value) })}
                    sx={inputSx}
                    inputProps={{ 'aria-label': `Strike${suffix}` }}
                  >
                    {strikes.map((k) => (
                      <MenuItem key={k} value={String(k)}>
                        ${k}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </>
            ))}

          {/* Right. NEUTRAL when selected (fidelity audit 2026-10-25, ACC-12): the canon never
              colours call against put (ruling #18), so the pressed segment keeps the theme's quiet
              selected fill, the same as the fill-mode control above it, never green or red. */}
          {isOption && (
            <Box sx={{ minWidth: 0 }}>
              <FieldLabel>Right</FieldLabel>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={draft.right}
                onChange={(_, v) => v && onPatch({ right: v as OptionRight })}
                fullWidth
                aria-label={`Right${suffix}`}
              >
                <ToggleButton value="call">Call</ToggleButton>
                <ToggleButton value="put">Put</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>

        {/* Size and price side by side — both are short numerics. */}
        <Box sx={PAIR_GRID_SX}>
          <Box sx={{ minWidth: 0 }}>
            <FieldLabel htmlFor={id('entry-qty')}>{isOption ? 'Quantity' : 'Shares'}</FieldLabel>
            <TextField
              id={id('entry-qty')}
              size="small"
              fullWidth
              type="number"
              value={draft.qty}
              onChange={(e) =>
                onPatch({ qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
              }
              slotProps={{
                // `min: 1` — NO FORM FIELD ACCEPTS A NEGATIVE QUANTITY (AC-11). Direction is the
                // Buy/Sell control above, and a sign convention here would give it two homes.
                htmlInput: { min: 1, 'aria-label': `Quantity${suffix}` },
              }}
              sx={inputSx}
            />
          </Box>
          {priceSlot != null ? (
            <Box sx={{ minWidth: 0 }}>{priceSlot}</Box>
          ) : (
            showPrice && (
              <Box sx={{ minWidth: 0 }}>
                <FieldLabel htmlFor={id('entry-leg-price')}>
                  {isOption ? 'Price per contract' : 'Avg share price'}
                </FieldLabel>
                <TextField
                  id={id('entry-leg-price')}
                  size="small"
                  fullWidth
                  type="number"
                  value={draft.price}
                  onChange={(e) =>
                    onPatch({ price: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                  error={manualContract && draft.price !== '' && !!errors?.price}
                  helperText={manualContract && draft.price !== '' ? errors?.price : undefined}
                  slotProps={{
                    htmlInput: { min: 0, 'aria-label': `Price leg ${index + 1}` },
                  }}
                  sx={inputSx}
                />
              </Box>
            )
          )}
        </Box>
      </Stack>
    </Box>
  );
}
