/**
 * New alert, in three steps (Q-5): choose what to watch, set it up, read it back. Every kind names its
 * source and its delay before it is saved, and a kind that can't check yet says so without blocking
 * the save. Under 600px each step is a bottom sheet. Design source: design/src/screens/v5/
 * alerts-public.mjs (chooseDialog, filingConfig, cftcConfig, siConfig, reviewDialog) and the Overlays
 * card's alert-flow board.
 *
 * The same dialog edits a rule (it opens at step 2) and removes one.
 */
import { NotifyAskDialog } from '@/features/alerts/BrowserNotifyControl';
import {
  FILING_ITEMS,
  GROUP_LABEL,
  PUBLIC_KIND,
  PUBLIC_KINDS,
  isStructureKind,
} from '@/features/alerts/kinds';
import { KINDS, LEVELS } from '@/features/alerts/labels';
import {
  fmtCompact,
  fmtDay,
  ruleSentence,
  ruleWhat,
  sameRule,
  validateRule,
  type RuleErrors,
} from '@/features/alerts/publicRules';
import type {
  AlertKind,
  AlertRule,
  FilingForm,
  LevelRef,
  TraderGroup,
} from '@/features/alerts/types';
import { shouldNotify, type NotifyPermission } from '@/features/alerts/useAlerts';
import { usePublicMarkets } from '@/pages/research/publicData';
import { ProvenanceChip } from '@/pages/research/publicUi';
import { chartRoles } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { typographyTokens } from '@/shared/theme/tokens';
import { selectCoarseFloorSx } from '@/shared/ui/touch';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import SensorsOffOutlined from '@mui/icons-material/SensorsOffOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KindGlyph,
  SecStrip,
  StateTag,
  kindState,
  waitSentence,
  type SiteContext,
} from './alertsUi';

/** The contracts the API's CFTC read covers (apps/api services/public_data/cftc.rs), for when the
 *  markets read hasn't answered: the reader can still save, and the check says if it's missing. */
const KNOWN_CONTRACTS = [
  { code: '043602', name: '10-year T-note' },
  { code: '13874A', name: 'E-mini S&P 500' },
  { code: '209742', name: 'E-mini Nasdaq-100' },
];

export type Draft = Omit<AlertRule, 'id' | 'enabled' | 'createdAt'> & { id?: string };

const DEFAULTS: Record<AlertKind, Draft> = {
  results: { kind: 'results', symbol: '', days: 7 },
  filing: { kind: 'filing', symbol: '', forms: ['8-K', '10-Q', '10-K'], items: [] },
  cluster: { kind: 'cluster', symbol: '' },
  cftc: {
    kind: 'cftc',
    symbol: '043602',
    marketName: '10-year T-note',
    group: 'leveraged_funds',
    extreme: 'either',
    closeness: 'within5',
  },
  si: { kind: 'si', symbol: '', siMode: 'change', changePct: 15, dtcLevel: 5 },
  note: { kind: 'note', symbol: '', days: 7 },
  level_touch: { kind: 'level_touch', symbol: 'SPY', level: 'gamma_flip' },
  tier_change: { kind: 'tier_change', symbol: 'SPY' },
  score_gate: { kind: 'score_gate', symbol: 'SPY', scoreMin: 70 },
};

const asRule = (d: Draft): AlertRule => ({
  ...d,
  id: d.id ?? 'draft',
  enabled: true,
  createdAt: 0,
});

export interface NewAlertDialogProps {
  open: boolean;
  /** A rule to edit, or a preset to start from (the empty state's suggestions). */
  start: Draft | null;
  ctx: SiteContext;
  followed: ReadonlySet<string>;
  rules: AlertRule[];
  notifyPermission: NotifyPermission;
  /** The page-wide notification flag (the master switch), as the page's control reads it. */
  notifyOn: boolean;
  /** Turns the page-wide flag on; opens the browser's prompt when permission isn't granted yet
   *  (after Convexa's own ask). Resolves whether notifications ended up on. */
  enableNotify: () => Promise<boolean>;
  onClose: () => void;
  /** Save; resolves whether the browser kept it. */
  onSave: (draft: Draft) => boolean;
  onRemove: (id: string) => void;
  onOpenExisting: (id: string) => void;
}

export function NewAlertDialog(props: NewAlertDialogProps) {
  const { open, start, ctx } = props;
  const editing = !!start?.id;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<Draft>(DEFAULTS.filing);
  const [errors, setErrors] = useState<RuleErrors>({});
  const [failed, setFailed] = useState(false);

  // A new rule (or a suggestion) carries no `notify` of its own, so it follows the page flag: saved
  // while the page is off, it notifies once the reader turns the page on (W1-14). The switch and the
  // Review line read the effective value, shouldNotify(draft, notifyOn). Only the reader turning the
  // switch off writes `notify: false`; an edited rule keeps whatever it has.
  useEffect(() => {
    if (!open) return;
    setDraft(start ? { ...DEFAULTS[start.kind], ...start } : DEFAULTS.filing);
    setStep(start ? 2 : 1);
    setErrors({});
    setFailed(false);
  }, [open, start]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const pick = (kind: AlertKind) =>
    setDraft((d) => ({
      ...DEFAULTS[kind],
      symbol: kind === 'cftc' ? DEFAULTS.cftc.symbol : d.kind === 'cftc' ? '' : d.symbol,
      notify: d.notify,
    }));

  const duplicate = useMemo(
    () => props.rules.find((r) => r.id !== draft.id && sameRule(r, asRule(draft))) ?? null,
    [props.rules, draft],
  );

  const next = () => {
    if (step === 1) return setStep(2);
    const e = isStructureKind(draft.kind)
      ? /^[A-Z][A-Z.-]{0,9}$/.test(draft.symbol)
        ? {}
        : { symbol: 'Enter a ticker: 1–10 letters, “.” or “-”.' }
      : validateRule(asRule(draft), props.followed);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(3);
  };
  const save = () => {
    const ok = props.onSave(draft);
    setFailed(!ok);
  };

  const title =
    step === 1
      ? 'New alert'
      : step === 3
        ? 'Review'
        : (PUBLIC_KIND[draft.kind as keyof typeof PUBLIC_KIND]?.name ??
          KINDS.find((k) => k.value === draft.kind)?.label ??
          'Alert');

  return (
    <Dialog
      open={open}
      onClose={props.onClose}
      aria-labelledby="new-alert-title"
      fullWidth
      maxWidth={step === 1 ? 'md' : 'sm'}
      sx={{
        // Under 600px the dialog is a bottom sheet: full width, a grab handle, actions at 44px.
        '@media (max-width: 599px)': {
          '& .MuiDialog-container': { alignItems: 'flex-end' },
          '& .MuiDialog-paper': {
            m: 0,
            width: '100%',
            maxWidth: '100%',
            maxHeight: '92dvh',
            borderRadius: '16px 16px 0 0',
          },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          display: { xs: 'block', sm: 'none' },
          width: 40,
          height: 4,
          borderRadius: 2,
          bgcolor: 'divider',
          mx: 'auto',
          mt: 1,
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 2, sm: 3 },
          pt: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          component="h2"
          id="new-alert-title"
          sx={{ m: 0, fontSize: 18, fontWeight: 700, flex: 1 }}
        >
          {title}
        </Box>
        <Box
          component="span"
          sx={{
            fontFamily: 'monospace',
            fontSize: 11,
            border: 1,
            borderColor: 'divider',
            borderRadius: 3,
            px: 1,
            py: '2px',
          }}
        >
          {`Step ${step} of 3`}
        </Box>
        <IconButton aria-label="Close" onClick={props.onClose} sx={{ minWidth: 44, minHeight: 44 }}>
          <CloseOutlined fontSize="small" />
        </IconButton>
      </Box>
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
        }}
      >
        {step === 1 && <ChooseStep draft={draft} pick={pick} ctx={ctx} />}
        {step === 2 && (
          <SetupStep
            draft={draft}
            set={set}
            errors={errors}
            ctx={ctx}
            followed={props.followed}
            notifyPermission={props.notifyPermission}
            notifyOn={props.notifyOn}
            enableNotify={props.enableNotify}
          />
        )}
        {step === 3 && (
          <ReviewStep
            draft={draft}
            ctx={ctx}
            notifyOn={props.notifyOn}
            failed={failed}
            duplicate={editing ? null : duplicate}
            onOpenExisting={props.onOpenExisting}
          />
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          px: { xs: 2, sm: 3 },
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
          '& .MuiButton-root': { minHeight: 44 },
        }}
      >
        {step === 1 || (editing && step === 2) ? (
          <Button variant="text" color="inherit" onClick={props.onClose}>
            Cancel
          </Button>
        ) : (
          <Button variant="text" color="inherit" onClick={() => setStep(step === 3 ? 2 : 1)}>
            Back
          </Button>
        )}
        {editing && draft.id && (
          <Button
            variant="text"
            color="inherit"
            onClick={() => draft.id && props.onRemove(draft.id)}
          >
            Remove alert
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {step < 3 ? (
          <Button variant="contained" onClick={next} data-testid="new-alert-next">
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={save}
            disabled={!editing && !!duplicate}
            data-testid="new-alert-save"
            sx={{ minWidth: 112 }}
          >
            {failed ? 'Try again' : editing ? 'Save changes' : 'Save alert'}
          </Button>
        )}
      </Box>
    </Dialog>
  );
}

// ---- step 1 ------------------------------------------------------------------------------------

function Tile({
  pressed,
  disabled,
  onClick,
  head,
  children,
}: {
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  head: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={disabled ? undefined : !!pressed}
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0.75,
        minHeight: 44,
        p: 1.5,
        borderRadius: '10px',
        border: '1px solid',
        borderStyle: disabled ? 'dashed' : 'solid',
        borderColor: pressed ? 'text.primary' : 'divider',
        boxShadow: pressed ? (t) => `inset 0 0 0 1px ${t.palette.text.primary}` : 'none',
        bgcolor: 'transparent',
        color: disabled ? 'text.secondary' : 'text.primary',
        font: 'inherit',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        {head}
        {pressed && <CheckOutlined aria-hidden sx={{ fontSize: 16, ml: 'auto' }} />}
      </Box>
      {children}
    </Box>
  );
}

function ChooseStep({
  draft,
  pick,
  ctx,
}: {
  draft: Draft;
  pick: (k: AlertKind) => void;
  ctx: SiteContext;
}) {
  return (
    <>
      <Box component="p" sx={{ m: 0, fontSize: 13.5, color: 'text.secondary' }}>
        What should Convexa watch? Every kind reads a public source and says how late that source
        is.
      </Box>
      <Box
        role="group"
        aria-label="What to watch"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {PUBLIC_KINDS.map((k) => {
          const st = kindState(k.key, ctx);
          return (
            <Tile
              key={k.key}
              pressed={draft.kind === k.key}
              onClick={() => pick(k.key)}
              head={
                <>
                  <KindGlyph kind={k.key} />
                  {k.name}
                </>
              }
            >
              <Box
                component="span"
                sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}
              >
                {k.fires}.
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {/* Not a link: the tile is a button, and a click must choose, not leave. */}
                <ProvenanceChip
                  text={ctx.demo ? `Sample · shaped like ${k.chip}` : k.chip}
                  link={false}
                />
                <StateTag {...st} />
              </Box>
            </Tile>
          );
        })}
      </Box>
      <Box
        component="details"
        open={isStructureKind(draft.kind) || undefined}
        sx={{
          '& > summary': {
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'info.main',
            minHeight: 24,
          },
        }}
      >
        <summary>Structure alerts ({KINDS.length})</summary>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
            mt: 1,
          }}
        >
          {KINDS.map((k) => (
            <Tile
              key={k.value}
              disabled={!ctx.structureLive}
              pressed={draft.kind === k.value}
              onClick={() => pick(k.value)}
              head={
                <>
                  {ctx.structureLive ? (
                    <KindGlyph kind={k.value} />
                  ) : (
                    <SensorsOffOutlined aria-hidden sx={{ fontSize: 16 }} />
                  )}
                  {k.label}
                </>
              }
            >
              <Box
                component="span"
                sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}
              >
                {ctx.structureLive
                  ? ctx.demo
                    ? 'Checks the sample tape while a ticker desk is open.'
                    : 'Checks structure snapshots while a ticker desk is open.'
                  : 'Not live: needs the options feed, which this site doesn’t run.'}
              </Box>
            </Tile>
          ))}
        </Box>
      </Box>
    </>
  );
}

// ---- step 2 ------------------------------------------------------------------------------------

function Field({
  label,
  children,
  help,
  error,
}: {
  label: string;
  children: ReactNode;
  help?: ReactNode;
  error?: string;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box component="span" sx={{ fontSize: 13, fontWeight: 600 }}>
        {label}
      </Box>
      {children}
      {error ? (
        <Box
          component="span"
          role="alert"
          sx={{ fontSize: 12, color: 'warning.main', display: 'flex', gap: 0.5 }}
        >
          <WarningAmberOutlined aria-hidden sx={{ fontSize: 14, mt: '1px' }} />
          {error}
        </Box>
      ) : help ? (
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}>
          {help}
        </Box>
      ) : null}
    </Box>
  );
}

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 0.5,
        p: 0.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
        alignSelf: 'flex-start',
        maxWidth: '100%',
      }}
    >
      {options.map((o) => (
        <Box
          key={o.value}
          component="button"
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          sx={{
            minHeight: 36,
            '@media (pointer: coarse)': { minHeight: 44 },
            px: 1.5,
            border: 0,
            borderRadius: '7px',
            font: 'inherit',
            fontSize: 13,
            fontWeight: value === o.value ? 600 : 500,
            cursor: o.disabled ? 'default' : 'pointer',
            bgcolor: value === o.value ? 'action.selected' : 'transparent',
            color: o.disabled
              ? 'text.disabled'
              : value === o.value
                ? 'text.primary'
                : 'text.secondary',
          }}
        >
          {o.label}
        </Box>
      ))}
    </Box>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={on}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        minHeight: 36,
        '@media (pointer: coarse)': { minHeight: 44 },
        px: 1.5,
        borderRadius: 999,
        border: '1px solid',
        borderColor: on ? 'text.primary' : 'divider',
        bgcolor: on ? 'text.primary' : 'transparent',
        color: on ? 'background.paper' : 'text.secondary',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {on && <CheckOutlined aria-hidden sx={{ fontSize: 14 }} />}
      {children}
    </Box>
  );
}

function TickerField({
  draft,
  set,
  error,
  help,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  error?: string;
  help?: string;
}) {
  return (
    <Field label="Ticker" error={error} help={help}>
      <TextField
        size="small"
        value={draft.symbol}
        onChange={(e) => set({ symbol: e.target.value.trim().toUpperCase() })}
        error={!!error}
        slotProps={{
          htmlInput: {
            'aria-label': 'Ticker',
            autoCapitalize: 'characters',
            spellCheck: false,
            style: { fontFamily: typographyTokens.monoFontFamily },
          },
        }}
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  unit,
  onChange,
  error,
  help,
}: {
  label: string;
  value: number | undefined;
  unit: string;
  onChange: (v: number) => void;
  error?: string;
  help?: string;
}) {
  return (
    <Field label={label} error={error} help={help}>
      <TextField
        size="small"
        type="number"
        value={value ?? ''}
        error={!!error}
        onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        slotProps={{
          htmlInput: { 'aria-label': label, inputMode: 'decimal' },
          input: {
            endAdornment: (
              <Box component="span" sx={{ color: 'text.secondary', fontSize: 13, ml: 1 }}>
                {unit}
              </Box>
            ),
          },
        }}
        sx={{ maxWidth: 220 }}
      />
    </Field>
  );
}

function followedHelp(draft: Draft, followed: ReadonlySet<string>): string | undefined {
  if (!draft.symbol) return 'A ticker with a Convexa research note.';
  return followed.has(draft.symbol) ? `Followed: you have notes on ${draft.symbol}.` : undefined;
}

function SetupStep({
  draft,
  set,
  errors,
  ctx,
  followed,
  notifyPermission,
  notifyOn,
  enableNotify,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  errors: RuleErrors;
  ctx: SiteContext;
  followed: ReadonlySet<string>;
  notifyPermission: NotifyPermission;
  notifyOn: boolean;
  enableNotify: () => Promise<boolean>;
}) {
  const k = draft.kind;
  return (
    <>
      {k === 'results' && (
        <>
          <TickerField
            draft={draft}
            set={set}
            error={errors.symbol}
            help={followedHelp(draft, followed)}
          />
          <NumberField
            label="Days before results"
            value={draft.days}
            unit="days"
            onChange={(days) => set({ days })}
            error={errors.value}
            help="Read from the note’s catalysts. An estimate until the company confirms the date."
          />
        </>
      )}
      {k === 'filing' && (
        <>
          <TickerField
            draft={draft}
            set={set}
            error={errors.symbol}
            help={followedHelp(draft, followed)}
          />
          <Field label="Forms" error={errors.forms}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(['8-K', '10-Q', '10-K'] as FilingForm[]).map((f) => {
                const on = (draft.forms ?? []).includes(f);
                return (
                  <Pill
                    key={f}
                    on={on}
                    onClick={() =>
                      set({
                        forms: on
                          ? (draft.forms ?? []).filter((x) => x !== f)
                          : [...(draft.forms ?? []), f],
                      })
                    }
                  >
                    {f}
                  </Pill>
                );
              })}
            </Box>
          </Field>
          {(draft.forms ?? []).includes('8-K') && (
            <Field
              label="8-K items"
              help="An 8-K’s items say what it is about; leave “Any item” on to hear about every one."
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Pill on={!(draft.items ?? []).length} onClick={() => set({ items: [] })}>
                  Any item
                </Pill>
                {FILING_ITEMS.map((it) => {
                  const on = (draft.items ?? []).includes(it.value);
                  return (
                    <Pill
                      key={it.value}
                      on={on}
                      onClick={() =>
                        set({
                          items: on
                            ? (draft.items ?? []).filter((x) => x !== it.value)
                            : [...(draft.items ?? []), it.value],
                        })
                      }
                    >
                      {it.label}
                    </Pill>
                  );
                })}
              </Box>
            </Field>
          )}
        </>
      )}
      {k === 'cluster' && (
        <>
          <TickerField
            draft={draft}
            set={set}
            error={errors.symbol}
            help={followedHelp(draft, followed)}
          />
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}>
            Fires when three or more insiders buy on the open market within 10 days, as their Form
            4s show. Sales, and trades under a pre-set plan (Rule 10b5-1), don’t count.
          </Box>
        </>
      )}
      {k === 'cftc' && <CftcSetup draft={draft} set={set} demo={ctx.demo} />}
      {k === 'si' && (
        <>
          <TickerField
            draft={draft}
            set={set}
            error={errors.symbol}
            help="FINRA settles short interest twice a month and publishes about a week later."
          />
          <Field label="Fire when">
            <Seg
              label="Fire when"
              value={draft.siMode ?? 'change'}
              onChange={(siMode) => set({ siMode })}
              options={[
                { value: 'change', label: 'Shares short change' },
                { value: 'dtc', label: 'Days to cover reaches' },
              ]}
            />
          </Field>
          {(draft.siMode ?? 'change') === 'change' ? (
            <NumberField
              label="By more than"
              value={draft.changePct}
              unit="%"
              onChange={(changePct) => set({ changePct })}
              error={errors.value}
              help="Between two settlements, up or down."
            />
          ) : (
            <NumberField
              label="Days to cover"
              value={draft.dtcLevel}
              unit="days"
              onChange={(dtcLevel) => set({ dtcLevel })}
              error={errors.value}
              help="Shares short over average daily volume, at a settlement. Fires on reaching it, again only after it drops below."
            />
          )}
        </>
      )}
      {k === 'note' && (
        <>
          <TickerField
            draft={draft}
            set={set}
            error={errors.symbol}
            help={followedHelp(draft, followed)}
          />
          <NumberField
            label="Review due within"
            value={draft.days}
            unit="days"
            onChange={(days) => set({ days })}
            error={errors.value}
            help="Also fires when a results or periodic filing lands after the note’s date (that half reads SEC EDGAR)."
          />
        </>
      )}
      {isStructureKind(k) && (
        <>
          <TickerField draft={draft} set={set} error={errors.symbol} />
          {k === 'level_touch' && (
            <Field label="Level">
              <TextField
                select
                size="small"
                value={draft.level ?? 'gamma_flip'}
                onChange={(e) => set({ level: e.target.value as LevelRef })}
                slotProps={{ htmlInput: { 'aria-label': 'Level' } }}
                sx={[selectCoarseFloorSx, { maxWidth: 260 }]}
              >
                {LEVELS.map((l) => (
                  <MenuItem key={l.value} value={l.value}>
                    {l.label}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
          )}
          {k === 'level_touch' && draft.level === 'price' && (
            <NumberField
              label="Price threshold"
              value={draft.priceThreshold}
              unit="$"
              onChange={(priceThreshold) => set({ priceThreshold })}
            />
          )}
          {k === 'score_gate' && (
            <NumberField
              label="Score at or above"
              value={draft.scoreMin}
              unit=""
              onChange={(scoreMin) => set({ scoreMin })}
            />
          )}
        </>
      )}
      <TellMe
        draft={draft}
        set={set}
        demo={ctx.demo}
        notifyPermission={notifyPermission}
        notifyOn={notifyOn}
        enableNotify={enableNotify}
      />
      {!ctx.demo && (k === 'filing' || k === 'cluster') && ctx.sec === 'notSetUp' && <SecStrip />}
    </>
  );
}

/**
 * The rule's browser-notification switch. The page-wide flag is the master switch (W1-14): the
 * switch reads on only while it is on, and turning the switch on turns the page flag on too, by the
 * same path as the page's own control: Convexa's ask first, then the browser's prompt.
 */
function TellMe({
  draft,
  set,
  demo,
  notifyPermission,
  notifyOn,
  enableNotify,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  demo: boolean;
  notifyPermission: NotifyPermission;
  notifyOn: boolean;
  enableNotify: () => Promise<boolean>;
}) {
  const [asking, setAsking] = useState(false);
  const blocked = !demo && (notifyPermission === 'denied' || notifyPermission === 'unavailable');
  const on = shouldNotify(draft, notifyOn);
  // A refused or dismissed browser prompt leaves the rule as it was: writing `notify: false` here
  // would keep the rule silent after a later "Turn on" on the page (W1-14).
  const turnOn = async () => {
    if (await enableNotify()) set({ notify: true });
  };
  return (
    <Field label="Tell me">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box
          component="span"
          sx={{ fontSize: 13, display: 'inline-flex', gap: 0.75, alignItems: 'center' }}
        >
          <CheckOutlined aria-hidden sx={{ fontSize: 14 }} />
          On the Alerts page, always
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Switch
            color="default"
            checked={on}
            disabled={blocked || demo}
            onChange={(_, want) => {
              if (!want) return set({ notify: false });
              if (notifyPermission === 'granted') void turnOn();
              else setAsking(true);
            }}
            slotProps={{ input: { 'aria-label': 'Browser notification' } }}
          />
          <Box component="span" sx={{ fontSize: 13 }}>
            Browser notification
          </Box>
          {blocked && (
            <DataStateTag
              state="notSetUp"
              detail={notifyPermission === 'denied' ? 'Blocked here' : 'Not in this browser'}
            />
          )}
        </Box>
        {blocked && notifyPermission === 'denied' && (
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            Browser notifications are blocked for this site. Allow them in your browser’s site
            settings; firings still appear under Fired.
          </Box>
        )}
        {demo && (
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            The demo never fires on its own, so it sends no notifications.
          </Box>
        )}
      </Box>
      <NotifyAskDialog
        open={asking}
        onClose={() => setAsking(false)}
        onContinue={() => {
          setAsking(false);
          void turnOn();
        }}
      />
    </Field>
  );
}

/** Where the group sits now, before the reader picks an extreme: the chart system's range bar. */
function CftcSetup({
  draft,
  set,
  demo,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  demo: boolean;
}) {
  const markets = usePublicMarkets(true);
  const futures = markets.data?.futures ?? null;
  const contracts =
    futures?.markets.map((m) => ({ code: m.code, name: m.name })) ?? KNOWN_CONTRACTS;
  const market = futures?.markets.find((m) => m.code === draft.symbol) ?? null;
  const group: TraderGroup = draft.group ?? 'leveraged_funds';
  const g = market ? market[group] : null;
  return (
    <>
      <Field label="Contract" help="Traders in Financial Futures, CFTC.">
        <TextField
          select
          size="small"
          value={draft.symbol}
          onChange={(e) => {
            const c = contracts.find((x) => x.code === e.target.value);
            set({ symbol: e.target.value, marketName: c?.name });
          }}
          slotProps={{ htmlInput: { 'aria-label': 'Contract' } }}
          sx={selectCoarseFloorSx}
        >
          {contracts.map((c) => (
            <MenuItem key={c.code} value={c.code}>
              {`${c.name} futures`}
            </MenuItem>
          ))}
        </TextField>
      </Field>
      <Field label="Trader group">
        <Seg
          label="Trader group"
          value={group}
          onChange={(v) => set({ group: v })}
          options={(Object.keys(GROUP_LABEL) as TraderGroup[]).map((v) => ({
            value: v,
            label: GROUP_LABEL[v],
            disabled: !!market && !market[v],
          }))}
        />
      </Field>
      <Field label="Fire when the net position reaches its">
        <Seg
          label="Which extreme"
          value={draft.extreme ?? 'either'}
          onChange={(extreme) => set({ extreme })}
          options={[
            { value: 'high', label: '3-year high' },
            { value: 'low', label: '3-year low' },
            { value: 'either', label: 'Either' },
          ]}
        />
      </Field>
      <Field
        label="How close"
        help="Within 5%: within 5% of the 3-year range’s width from that end."
      >
        <Seg
          label="How close"
          value={draft.closeness ?? 'within5'}
          onChange={(closeness) => set({ closeness })}
          options={[
            { value: 'at', label: 'At the extreme' },
            { value: 'within5', label: 'Within 5%' },
          ]}
        />
      </Field>
      <Field label="Where it is now">
        {markets.loading ? (
          <Box sx={{ fontSize: 12, color: 'text.secondary' }}>Reading the latest CFTC report…</Box>
        ) : g && futures ? (
          <RangeNow g={g} reportDate={futures.report_date} who={GROUP_LABEL[group]} demo={demo} />
        ) : (
          <DataStateTag state="couldntLoad" detail="the alert still saves" />
        )}
      </Field>
    </>
  );
}

function RangeNow({
  g,
  reportDate,
  who,
  demo,
}: {
  g: {
    net: number;
    min_3y: number;
    max_3y: number;
    median_3y: number;
    p10_3y: number;
    p90_3y: number;
  };
  reportDate: string;
  who: string;
  demo: boolean;
}) {
  const span = g.max_3y - g.min_3y;
  const at = (v: number) => (span > 0 ? (v - g.min_3y) / span : 0.5);
  const pct = Math.round(at(g.net) * 100);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box
        role="img"
        aria-label={`${who} net ${fmtCompact(g.net, true)}, ${pct}% of the 3-year range from the low of ${fmtCompact(g.min_3y, true)} to the high of ${fmtCompact(g.max_3y, true)}`}
        sx={{ position: 'relative', height: 22 }}
      >
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: 0,
            right: 0,
            top: 9,
            height: 4,
            borderRadius: '2px',
            bgcolor: chartRoles(t).grid,
          })}
        />
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: `${at(g.p10_3y) * 100}%`,
            width: `${Math.max(0.5, (at(g.p90_3y) - at(g.p10_3y)) * 100)}%`,
            top: 5,
            height: 12,
            boxSizing: 'border-box',
            borderRadius: '2px',
            bgcolor: chartRoles(t).band,
            borderLeft: `1px solid ${chartRoles(t).edge}`,
            borderRight: `1px solid ${chartRoles(t).edge}`,
          })}
        />
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: `${at(g.median_3y) * 100}%`,
            top: 5,
            width: 2,
            height: 12,
            ml: '-1px',
            bgcolor: chartRoles(t).ctx,
          })}
        />
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: `${at(g.net) * 100}%`,
            top: 1,
            width: 4,
            height: 20,
            ml: '-2px',
            borderRadius: '2px',
            bgcolor: chartRoles(t).emph,
            boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
          })}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: typographyTokens.monoFontFamily,
          fontSize: 11,
          color: 'text.secondary',
          gap: 1,
        }}
      >
        <span>{`${fmtCompact(g.min_3y, true)} 3-yr low`}</span>
        <span>{`${fmtCompact(g.max_3y, true)} high`}</span>
      </Box>
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}>
        {`${fmtCompact(g.net, true)} net, ${pct}% of its 3-year range (tick = median, band = 10th–90th percentile). ${demo ? 'Sample report, positions' : 'Positions'} as of ${fmtDay(reportDate)}.`}
      </Box>
    </Box>
  );
}

// ---- step 3 ------------------------------------------------------------------------------------

function ReviewStep({
  draft,
  ctx,
  notifyOn,
  failed,
  duplicate,
  onOpenExisting,
}: {
  draft: Draft;
  ctx: SiteContext;
  notifyOn: boolean;
  failed: boolean;
  duplicate: AlertRule | null;
  onOpenExisting: (id: string) => void;
}) {
  const rule = asRule(draft);
  const pub = PUBLIC_KIND[draft.kind as keyof typeof PUBLIC_KIND];
  const st = kindState(draft.kind, ctx);
  const wait = waitSentence(draft.kind, ctx);
  const sentence = pub
    ? ruleSentence(rule)
    : `Tell me when ${draft.symbol} ${draft.kind === 'tier_change' ? 'changes tier' : draft.kind === 'score_gate' ? `scores ${draft.scoreMin ?? 70} or more` : 'touches the level'}.`;
  return (
    <>
      <Box
        component="p"
        sx={{ m: 0, fontSize: 15, lineHeight: 1.55 }}
        data-testid="new-alert-sentence"
      >
        {sentence}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <ProvenanceChip
          text={
            ctx.demo
              ? `Sample · shaped like ${pub?.chip ?? 'a Massive options chain'}`
              : (pub?.chip ?? 'Options chain')
          }
          link={false}
        />
        <StateTag {...st} />
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '120px minmax(0, 1fr)' },
          gap: { xs: '2px 0', sm: '6px 12px' },
          fontSize: 13,
          '& dt': { color: 'text.secondary', mt: { xs: 1, sm: 0 } },
          '& dd': { m: 0 },
        }}
      >
        {pub && (
          <>
            <dt>Delay</dt>
            <dd>{pub.delay}.</dd>
          </>
        )}
        <dt>Checks</dt>
        <dd>
          {ctx.demo
            ? 'Never on its own: the demo’s firings are part of the Oct 7 scenario.'
            : isStructureKind(draft.kind)
              ? 'While a ticker desk is open, on each structure snapshot.'
              : (wait ??
                'When you open Alerts, in this browser. Nothing checks while no Alerts page is open.')}
        </dd>
        <dt>Tells you</dt>
        <dd>
          {shouldNotify(draft, notifyOn)
            ? 'On the Alerts page and by browser notification.'
            : 'On the Alerts page.'}
        </dd>
        {pub && (
          <>
            <dt>Watching</dt>
            <dd>{ruleWhat(rule)}</dd>
          </>
        )}
      </Box>
      {duplicate && (
        <Box
          role="status"
          sx={{
            display: 'flex',
            gap: 1,
            p: '10px 12px',
            border: 1,
            borderColor: 'divider',
            borderRadius: '10px',
          }}
        >
          <InfoOutlined aria-hidden sx={{ fontSize: 16, color: 'text.secondary', mt: '2px' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box component="strong" sx={{ fontSize: 13 }}>
              You already have this alert.
            </Box>
            <Box component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              {`${PUBLIC_KIND[duplicate.kind as keyof typeof PUBLIC_KIND]?.name ?? 'Alert'} · ${duplicate.kind === 'cftc' ? (duplicate.marketName ?? duplicate.symbol) : duplicate.symbol}${pub ? ` · ${ruleWhat(duplicate)}` : ''}`}
            </Box>
            <Button
              variant="text"
              size="small"
              color="inherit"
              onClick={() => onOpenExisting(duplicate.id)}
              sx={{ alignSelf: 'flex-start', minHeight: 44, px: 0 }}
            >
              Open it →
            </Button>
          </Box>
        </Box>
      )}
      {failed && (
        <Box
          role="alert"
          sx={{
            display: 'flex',
            gap: 1,
            p: '10px 12px',
            border: 1,
            borderColor: 'warning.main',
            borderRadius: '10px',
          }}
        >
          <WarningAmberOutlined
            aria-hidden
            sx={{ fontSize: 16, color: 'warning.main', mt: '2px' }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box component="strong" sx={{ fontSize: 13 }}>
              Couldn’t save the alert.
            </Box>
            <Box component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              This browser’s storage refused the write (it may be full or private). Your choices are
              kept; try again.
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}
