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
import { FieldLabel } from './FieldLabel';
import type { ManualLegErrors } from './manualContract';
import type { LegDraft } from './types';

/** `100` for a standard option contract, `1` for equity — decided HERE and stored on the leg. */
export const multiplierFor = (kind: InstrumentKind) => (kind === 'option' ? 100 : 1);

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

      <Stack spacing={2}>
        {/* Direction and instrument SIDE BY SIDE — two stacked full-width toggle groups per leg
            turns a four-leg form into a wall of controls; paired, a leg reads as one line of
            decisions. Buy/Sell is UNTINTED: a short leg is not a loss (SPEC §4 Design direction 4),
            which is why it does not borrow the Call/Put green/red beneath it. */}
        {multiLeg && (
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={draft.side}
              onChange={(_, v) => v && onPatch({ side: v as LegSide })}
              aria-label={`direction${suffix}`}
              data-testid={`entry-side-${index}`}
              sx={{ flex: 1 }}
            >
              <ToggleButton value="long">Buy</ToggleButton>
              <ToggleButton value="short">Sell</ToggleButton>
            </ToggleButtonGroup>
            {/* Shares carry no strike/expiry/right at all — never a zero-filled one. */}
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={draft.kind}
              onChange={(_, v) => v && onPatch({ kind: v as InstrumentKind })}
              aria-label={`instrument${suffix}`}
              data-testid={`entry-kind-${index}`}
              sx={{ flex: 1 }}
            >
              <ToggleButton value="option">Option</ToggleButton>
              <ToggleButton value="equity">Shares</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )}

        {isOption && (
          <>
            {manualContract ? (
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
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
                <Box sx={{ flex: 1, minWidth: 0 }}>
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
              </Stack>
            ) : (
              <>
                <Box>
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

                <Box>
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
            )}

            {/* Call / Put — active CALL = success green, active PUT = error red. A DOMAIN fact on an
                instrument control, not a claim about money: the tint ban is on POSITION and P&L
                surfaces (SPEC §4 Design direction 4). */}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={draft.right}
              onChange={(_, v) => v && onPatch({ right: v as OptionRight })}
              fullWidth
              sx={{
                '& .MuiToggleButton-root.Mui-selected': { color: 'common.white' },
                '& .MuiToggleButton-root[value="call"].Mui-selected': {
                  bgcolor: 'success.main',
                  '&:hover': { bgcolor: 'success.dark' },
                },
                '& .MuiToggleButton-root[value="put"].Mui-selected': {
                  bgcolor: 'error.main',
                  '&:hover': { bgcolor: 'error.dark' },
                },
              }}
            >
              <ToggleButton value="call">Call</ToggleButton>
              <ToggleButton value="put">Put</ToggleButton>
            </ToggleButtonGroup>
          </>
        )}

        {/* Size and price side by side — both are short numerics, and pairing them keeps a leg to
            three rows instead of five. */}
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
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
          {showPrice && (
            <Box sx={{ flex: 1 }}>
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
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
