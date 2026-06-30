/**
 * AiRecPanel — the dedicated rec card + its full state machine (UX_BLUEPRINT §2/§3). Independently
 * nullable: its failure NEVER blanks the GEX chart, the neutral tiles, the off-exchange blocks, the
 * ghost-trade tracker, or the live stream (the page renders this as one isolated sibling card; a
 * thrown rec fault is caught in the hook and shown here as `unavailable`).
 *
 * Binding framing honored throughout: advice behind an explicit Accept (never a command), risk +
 * invalidation FIRST, `no_trade` first-class (info, not red), honest "as of {snapshot}" + stale
 * wording, the export floor reachable from every state. SIMULATED everywhere.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Stack, Typography, Button, Chip, Tooltip, Alert, Box, Divider,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { PersonaDefinition, RecResponse, RecStrategy, TickerBundle } from '@org/api';
import { fetchPersonas } from '@org/api';
import type { AiRec, RecRequestOpts } from './useAiRecommendation';
import {
  COPY, personaChip, asOfChip, cooldownLabel, cooldownCaption, capTitle, CAP_CAPTION, staleStrip,
  staleBornStrip, friendlyResetTime, retryInCooldown, retryWhenReset,
  BYO_KEY, adminExhaustedTitle, freeUsesChip, OWN_KEY_CHIP, FREE_USES_TOTAL_FALLBACK,
} from './copy';
import { useGate } from '../auth/useGate';
import { SignInPrompt } from '../auth/SignInPrompt';
import { AUTH_COPY } from '../auth/copy';

/** Map an `unavailable` rec's `unavailable_reason` to one of the three key-resolution CTA states
 *  (a/c/e). Returns null when it's NOT a byo-ai-key reason (so the shipped `unavailable` block shows).
 *  The FE keys ONLY off these three intents (UX_BLUEPRINT §3); any other reason falls through. */
function byoCtaState(rec: RecResponse | null): 'no_key' | 'over_limit' | 'shared_key_unconfigured' | null {
  if (!rec || rec.status !== 'unavailable') return null;
  const r = rec.unavailable_reason;
  if (r === 'no_key' || r === 'over_limit' || r === 'shared_key_unconfigured') return r;
  return null;
}

/** Canonical persona source with the FE embed as the offline / assembly-failure fallback (E7).
 *  Tries `GET /api/personas` once; on any fault, keeps the embedded presets. Non-blocking. */
export function useReadPersonas(embedded: PersonaDefinition[]): { personas: PersonaDefinition[]; canonical: boolean } {
  const embeddedRef = useRef(embedded);
  embeddedRef.current = embedded;
  const [personas, setPersonas] = useState<PersonaDefinition[]>(embedded);
  const [canonical, setCanonical] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchPersonas()
      .then((list) => { if (!cancelled) { setPersonas(list); setCanonical(true); } })
      .catch(() => { if (!cancelled) { setPersonas(embeddedRef.current); setCanonical(false); } });
    return () => { cancelled = true; };
  }, []);
  return { personas, canonical };
}

interface Props {
  ticker: string;
  bundle: TickerBundle | null;
  ai: AiRec;
  personas: PersonaDefinition[];     // canonical (or embedded fallback) read-persona options
  activePersonaId: string;           // 'default' | preset/custom id
  dataAge: string | null;            // humanized bundle age, for the stale-born strip
  onAccept: (rec: RecResponse, personaName: string) => void;
  onViewExport: (personaId: string | null) => void;
  readPersonaId: string;
  onChangeReadPersona: (id: string) => void;
}

export function AiRecPanel({
  ticker, bundle, ai, personas, activePersonaId, dataAge, onAccept, onViewExport,
  readPersonaId, onChangeReadPersona,
}: Props) {
  const { rec, loading, stale, inAppEnabled, cap, effectiveGateState, cooldownRemaining, gate } = ai;
  const navigate = useNavigate();

  // Auth gate is OUTERMOST over ai-rec's own gating (D6f, AC-E4/E5). Logged-out ⇒ the "ask AI" control
  // shows a sign-in prompt and the LLM is NOT invoked; ai-rec's cooldown/cap/no_key are NOT shown. The
  // manual export floor stays anonymous-usable (AC-E6) — that control lives in the header, ungated.
  const authGate = useGate();

  // The "Add your key in Settings" CTA navigates to the Settings route + deep-links the AI-key section.
  const goToSettings = () => navigate('/settings#ai-key');

  const activeName = personas.find((p) => p.id === activePersonaId)?.name ?? 'Default (no persona)';
  const readName = personas.find((p) => p.id === readPersonaId)?.name ?? activeName;
  const readPersonaIdForRequest = readPersonaId === 'default' ? null : readPersonaId;

  // Guard the LLM invoke: logged-out ⇒ prompt + no invoke; a server 403 (stale cookie) ⇒ same prompt
  // and nothing produced (AC-E7). Auth FIRST, then ai-rec's existing gating runs inside `ai.request`.
  const doRequest = (o: RecRequestOpts = {}) =>
    void authGate.guard(
      AUTH_COPY.askAi.gate,
      () => ai.request({ ...o, personaId: readPersonaIdForRequest, personaName: readName }),
    );

  // The byo-ai-key key-resolution state (layer 3, UX_BLUEPRINT §2/§3). Read OFF the status fields,
  // never re-derived: an `unavailable` rec whose reason is one of no_key (a) / over_limit (c) /
  // shared_key_unconfigured (e) renders a distinct CTA block instead of the generic unavailable Alert.
  const byoCta = byoCtaState(rec);

  // Exactly one body state. A byo CTA (a/c/e) preempts the generic `unavailable` block.
  const phase =
    loading ? 'loading'
    : byoCta ? 'byo_cta'
    : rec?.status === 'unavailable' ? 'unavailable'
    : rec && rec.status === 'produced' && rec.strategy?.decision === 'no_trade' ? 'no_trade'
    : rec && rec.status === 'produced' ? 'produced'
    : 'idle';

  const hasRec = phase === 'produced' || phase === 'no_trade';

  return (
    <Card variant="outlined" sx={{ mt: 3 }} data-testid="ai-rec-panel">
      <CardContent>
        {/* Header — title + per-query persona override + the always-available export control. */}
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>AI recommendation · {ticker}</Typography>
          <Box>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Persona for this read</InputLabel>
              <Select label="Persona for this read" value={readPersonaId}
                onChange={(e) => onChangeReadPersona(String(e.target.value))}>
                {personas.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 320, mt: 0.5 }}>
              Defaults to your active persona ({activeName}). Changing it here frames this one read only —
              it doesn't change your active persona and never recomputes any number.
            </Typography>
          </Box>
          <Box>
            <Button size="small" onClick={() => onViewExport(readPersonaIdForRequest)}>{COPY.action.viewExport}</Button>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
              Costs nothing — opens the exact export.
            </Typography>
          </Box>
        </Stack>

        {/* Body */}
        {phase === 'loading' && <LoadingBlock ticker={ticker} readName={readName} />}

        {/* byo-ai-key CTA states (a/c/e) — distinct testids + copy; all route to Settings. The
            "View what's sent" export floor in the header stays present in every state (AC-23). */}
        {phase === 'byo_cta' && byoCta && (
          <ByoKeyCta reason={byoCta} rec={rec as RecResponse} onAddKey={goToSettings} />
        )}

        {phase === 'unavailable' && (
          <UnavailableBlock cap={cap} cooldownRemaining={cooldownRemaining} onRetry={ai.retry} />
        )}

        {hasRec && rec && (
          <RecResult
            rec={rec} stale={stale} dataAge={dataAge} bundle={bundle}
            onAccept={() => authGate.guard(
              AUTH_COPY.positions.gateAcceptRec, () => onAccept(rec, rec.persona.name),
            )} onDismiss={ai.dismiss}
            onViewExport={() => onViewExport(readPersonaIdForRequest)}
            onFresh={() => doRequest({ override: false })}
            freshDisabled={!inAppEnabled || cap.over_limit || cooldownRemaining > 0}
          />
        )}

        {/* The action region (primary action in idle; the NEXT-query control alongside a rendered
            rec). Hidden while loading, the byo CTA, and the unavailable block (each owns its action). */}
        {phase !== 'loading' && phase !== 'unavailable' && phase !== 'byo_cta' && (
          <>
            {!hasRec && <SnapshotHint bundle={bundle} />}
            {/* Auth OUTERMOST: logged-out (or a server 403 on a stale cookie) ⇒ sign-in prompt ONLY —
                no cooldown/cap/no_key (AC-E4/E7). The prompt also shows when a server rejection set
                `promptText` even if the FE still believed it was signed-in. */}
            {!authGate.allowed || authGate.promptText ? (
              <Box sx={{ mt: hasRec ? 2 : 1 }} data-testid="ai-rec-auth-gate">
                <Tooltip arrow describeChild title={AUTH_COPY.askAi.tooltip}>
                  <span>
                    <Button variant="contained" size="small" disabled data-testid="ai-rec-get-disabled">
                      {COPY.action.get}
                    </Button>
                  </span>
                </Tooltip>
                <SignInPrompt
                  text={authGate.promptText ?? AUTH_COPY.askAi.gate}
                  onSignIn={() => authGate.signIn(AUTH_COPY.askAi.gate)}
                  testid="ai-rec-signin-prompt"
                />
              </Box>
            ) : (
              <ActionRegion
                inAppEnabled={inAppEnabled} cap={cap} effectiveGateState={effectiveGateState}
                cooldownRemaining={cooldownRemaining} reasons={gate.reasons}
                compact={hasRec} ticker={ticker}
                onGet={() => doRequest({ override: false })}
                onAskAnyway={() => doRequest({ override: true })}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Loading (AC1/AC2) -----------------------------------------------------------------------
function LoadingBlock({ ticker, readName }: { ticker: string; readName: string }) {
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CircularProgress size={18} />
        <Typography variant="subtitle1">{COPY.loading.title}</Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Asking the AI for a risk-first read on {ticker} ({readName}). This can take a few seconds.
      </Typography>
    </Box>
  );
}

// ---- Snapshot idle hint ----------------------------------------------------------------------
function SnapshotHint({ bundle }: { bundle: TickerBundle | null }) {
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
      Reads the current snapshot{bundle?.meta.freshness.snapshot_iso ? `, as of ${bundle.meta.freshness.snapshot_iso}` : ''}.
    </Typography>
  );
}

// ---- The gated action control ----------------------------------------------------------------
function ActionRegion({
  inAppEnabled, cap, effectiveGateState, cooldownRemaining, reasons, compact, ticker, onGet, onAskAnyway,
}: {
  inAppEnabled: boolean;
  cap: { over_limit: boolean; resets_at: string };
  effectiveGateState: string;
  cooldownRemaining: number;
  reasons: string[];
  compact: boolean;
  ticker: string;
  onGet: () => void;
  onAskAnyway: () => void;
}) {
  const box = { mt: compact ? 2 : 1 };

  // key_not_configured (AC12) — inert in-app, manual floor preserved (the header export stays).
  if (!inAppEnabled) {
    return (
      <Box sx={box}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
          <Button variant="contained" size="small" disabled>{COPY.action.get}</Button>
          <Chip size="small" variant="outlined" label={COPY.noKey.chip} />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{COPY.noKey.caption}</Typography>
      </Box>
    );
  }

  // daily_cap_reached (AC10) — calm blocked state, NOT an error; export floor stays.
  if (cap.over_limit) {
    return (
      <Box sx={box}>
        <Button variant="contained" size="small" disabled>{capTitle(friendlyResetTime(cap.resets_at))}</Button>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{CAP_CAPTION}</Typography>
      </Box>
    );
  }

  // cooling_down (AC9) — disabled with a visible countdown; re-enables at 0.
  if (cooldownRemaining > 0) {
    return (
      <Box sx={box}>
        <Button variant="contained" size="small" disabled>{cooldownLabel(cooldownRemaining)}</Button>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{cooldownCaption(cooldownRemaining)}</Typography>
      </Box>
    );
  }

  // no_fresh_edge (AC8) — de-emphasized + explicit one-tap override.
  if (effectiveGateState === 'no_fresh_edge') {
    return (
      <Box sx={box}>
        <Typography variant="body2">
          {COPY.noEdge.title}{reasons.length ? ` — ${reasons[0]}` : ''}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
          <Tooltip arrow describeChild title={COPY.tooltip.askAnyway}>
            <Button variant="outlined" size="small" color="inherit" onClick={onAskAnyway}>{COPY.action.askAnyway}</Button>
          </Tooltip>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{COPY.noEdge.caption}</Typography>
      </Box>
    );
  }

  // idle — Available (AC1 entry point).
  return (
    <Box sx={box}>
      <Tooltip arrow describeChild title={COPY.tooltip.get.replace('{TICKER}', ticker)}>
        <Button variant="contained" size="small" onClick={onGet}>{COPY.action.get}</Button>
      </Tooltip>
    </Box>
  );
}

// ---- Unavailable (AC11) ----------------------------------------------------------------------
function UnavailableBlock({ cap, cooldownRemaining, onRetry }: {
  cap: { over_limit: boolean; resets_at: string }; cooldownRemaining: number; onRetry: () => void;
}) {
  // Retry respects cooldown + cap (E6): if a retry would land in cooldown/over-cap, disable it.
  const blockedByCooldown = cooldownRemaining > 0;
  const blockedByCap = cap.over_limit;
  const retryDisabled = blockedByCooldown || blockedByCap;
  const sub = blockedByCooldown ? retryInCooldown(cooldownRemaining)
    : blockedByCap ? retryWhenReset(friendlyResetTime(cap.resets_at)) : null;
  return (
    <Alert severity="warning" sx={{ mt: 1 }}
      action={
        <Stack spacing={0.25} sx={{ alignItems: 'flex-end' }}>
          <Button color="inherit" size="small" disabled={retryDisabled} onClick={onRetry}>{COPY.action.retry}</Button>
          {sub && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{sub}</Typography>}
        </Stack>
      }>
      <Typography variant="subtitle2">{COPY.unavailable.title}</Typography>
      <Typography variant="body2">{COPY.unavailable.body}</Typography>
    </Alert>
  );
}

// ---- byo-ai-key CTA states (a/c/e) — UX_BLUEPRINT §3 ------------------------------------------
// Three observably-distinct CTA bodies (distinct testid + title/body copy; same button label). None
// is an error red; none frames a free trial. (c) implies daily renewal. Each routes to Settings.
function ByoKeyCta({
  reason, rec, onAddKey,
}: {
  reason: 'no_key' | 'over_limit' | 'shared_key_unconfigured';
  rec: RecResponse;
  onAddKey: () => void;
}) {
  const total = rec.free_uses_total ?? FREE_USES_TOTAL_FALLBACK;
  const cfg =
    reason === 'no_key'
      ? { testid: 'ai-rec-state-no-key', title: BYO_KEY.noKey.title, body: BYO_KEY.noKey.body, cta: BYO_KEY.noKey.cta }
      : reason === 'over_limit'
      ? { testid: 'ai-rec-state-admin-exhausted', title: adminExhaustedTitle(total), body: BYO_KEY.adminExhausted.body, cta: BYO_KEY.adminExhausted.cta }
      : { testid: 'ai-rec-state-shared-unconfigured', title: BYO_KEY.sharedUnconfigured.title, body: BYO_KEY.sharedUnconfigured.body, cta: BYO_KEY.sharedUnconfigured.cta };
  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }} data-testid={cfg.testid}>
      <Typography variant="subtitle1">{cfg.title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{cfg.body}</Typography>
      <Button
        variant="contained" size="small" sx={{ mt: 1.5 }}
        data-testid="ai-rec-add-key-cta" onClick={onAddKey}
      >
        {cfg.cta}
      </Button>
    </Box>
  );
}

// ---- Provenance header (AC3/AC4) + byo-ai-key key-source chips (b/d) --------------------------
function Provenance({ rec }: { rec: RecResponse }) {
  // The provenance chip reads ONLY `key_source` (never a score field — AC-14). shared_admin (b) ⇒ the
  // subordinate free-uses chip; own_key (d) ⇒ the "Using your key" chip. NO chip for none.
  const showFreeUses = rec.key_source === 'shared_admin' && rec.remaining_free_uses != null;
  const showOwnKey = rec.key_source === 'own_key';
  const freeUsesTotal = rec.free_uses_total ?? FREE_USES_TOTAL_FALLBACK;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}>
      <Tooltip arrow title={COPY.tooltip.persona.replace('{name}', rec.persona.name)}>
        <Chip size="small" variant="outlined" label={personaChip(rec.persona.name)} />
      </Tooltip>
      <Tooltip arrow title={COPY.tooltip.asOf}>
        <Chip size="small" variant="outlined" label={asOfChip(rec.as_of)} />
      </Tooltip>
      <Tooltip arrow title={COPY.tooltip.advisory}>
        <Chip size="small" variant="outlined" label={COPY.provenance.sim} />
      </Tooltip>
      {showFreeUses && (
        <Tooltip arrow describeChild title={BYO_KEY.freeUses.tooltip}>
          <Chip size="small" variant="outlined" data-testid="ai-rec-free-uses"
            label={freeUsesChip(rec.remaining_free_uses as number, freeUsesTotal)} />
        </Tooltip>
      )}
      {showOwnKey && (
        <Tooltip arrow describeChild title={BYO_KEY.ownKey.tooltip}>
          <Chip size="small" variant="outlined" data-testid="ai-rec-own-key" label={OWN_KEY_CHIP} />
        </Tooltip>
      )}
    </Stack>
  );
}

function Field({ label, value, tip }: { label: string; value: React.ReactNode; tip?: string }) {
  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
        {tip && <Tooltip arrow title={tip}><InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} /></Tooltip>}
      </Stack>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

const fmtNum = (n: number | null | undefined) => (n == null ? '—' : String(n));

// ---- The rendered rec (produced + no_trade) --------------------------------------------------
function RecResult({
  rec, stale, dataAge, bundle, onAccept, onDismiss, onViewExport, onFresh, freshDisabled,
}: {
  rec: RecResponse; stale: boolean; dataAge: string | null; bundle: TickerBundle | null;
  onAccept: () => void; onDismiss: () => void; onViewExport: () => void; onFresh: () => void;
  freshDisabled: boolean;
}) {
  const s = rec.strategy as RecStrategy;
  const isNoTrade = s.decision === 'no_trade';
  const dteMin = bundle?.market_state.dte_min;
  const dteMax = bundle?.market_state.dte_max;

  return (
    <Box>
      {/* Stale-born (E5) — generated off an already-stale bundle; warned AT BIRTH. */}
      {rec.stale_born && (
        <Alert severity="warning" sx={{ mb: 1, py: 0 }}>{staleBornStrip(dataAge ?? 'older data')}</Alert>
      )}

      {/* Stale (AC6) — a NEWER bundle arrived after generation. Rec body stays byte-stable. */}
      {stale && (
        <Box sx={{ mb: 1 }}>
          <Chip size="small" color="warning" variant="outlined" label={COPY.stale.chip} sx={{ mb: 0.5 }} />
          <Alert severity="info" sx={{ py: 0 }}
            action={<Button color="inherit" size="small" disabled={freshDisabled} onClick={onFresh}>{COPY.action.freshRec}</Button>}>
            {staleStrip(rec.as_of)}
          </Alert>
        </Box>
      )}

      <Provenance rec={rec} />

      {isNoTrade ? (
        <Box>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <InfoOutlinedIcon color="info" sx={{ fontSize: 18 }} />
            <Typography variant="subtitle1">{COPY.noTrade.title}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{s.rationale}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>{COPY.noTrade.caption}</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {/* 2. RISK FIRST (foremost). */}
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <Field label={COPY.risk.maxRisk} value={s.max_risk ?? '—'}
                tip="The most this plan puts at risk. Judge this before anything else." />
              <Field label={COPY.risk.invalidation} value={fmtNum(s.invalidation_level)}
                tip="The level that says the idea is wrong. If price reaches it, the thesis is invalidated." />
            </Stack>
          </Box>
          {/* 3. Plan. */}
          <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Field label="Decision" value="Trade" />
            <Field label="Bias" value={s.bias} />
            <Field label="Structure" value={s.structure ?? '—'} />
            <Field label="Strike(s)" value={s.strikes.length ? s.strikes.map((x) => `$${x}`).join(' / ') : '—'} />
            <Field label="Expiration"
              value={<>{s.expiration ?? '—'}{(dteMin != null || dteMax != null) && (
                <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}> · within your {dteMin ?? '?'}–{dteMax ?? '?'} DTE window</Typography>
              )}</>} />
            <Field label="Entry trigger" value={s.entry_trigger ?? '—'} />
          </Stack>
          {/* 4. Exit. */}
          <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Field label="Target" value={fmtNum(s.exit_plan?.target)} />
            <Field label="Stop" value={fmtNum(s.exit_plan?.stop)} />
          </Stack>
          {/* 5. Sizing. */}
          <Box>
            <Field label="Suggested size" value={s.position_size ?? '—'} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              A suggestion. Your size is your risk decision — you'll be able to change it on Accept.
            </Typography>
          </Box>
          {/* 6. Read context. */}
          <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
            <Field label="Time horizon" value={s.time_horizon ?? '—'} />
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Confidence</Typography>
              <Chip size="small" label={s.confidence ?? '—'} />
            </Box>
          </Stack>
          <Field label="Rationale" value={s.rationale} />
        </Stack>
      )}

      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        {/* Accept is ABSENT on a no_trade rec (AC5) — never just disabled. */}
        {!isNoTrade && (
          <Tooltip arrow describeChild title={COPY.tooltip.advisory}>
            <Button variant="contained" size="small" onClick={onAccept}>{COPY.action.accept}</Button>
          </Tooltip>
        )}
        <Button size="small" onClick={onViewExport}>{COPY.action.viewExport}</Button>
        <Button size="small" color="inherit" onClick={onDismiss}>{COPY.action.dismiss}</Button>
      </Stack>
    </Box>
  );
}
