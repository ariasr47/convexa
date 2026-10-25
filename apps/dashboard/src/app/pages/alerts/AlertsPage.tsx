/**
 * /alerts — alerts on public data (Q-5) beside the structure alerts of v1. Design: the Alerts card in
 * design/src/screens/final/account.mjs, boards design/site/final-alerts-*.html.
 *
 * Production: the six public-data kinds, each with its source, its delay and its state word (P-2); SEC
 * kinds save but say Not set up until SEC_USER_AGENT is set (Q-4); structure kinds are Not live with a
 * link to the demo. This browser checks the public kinds when the page opens (usePublicChecks), and the
 * page says so: no server checks them yet.
 * Staging: the demo account's seed (libs/api/src/lib/demo/alerts.ts), every rule and firing a sample;
 * the demo never checks on its own. The shell's demo bar is the page's one "Demo · sample data", so
 * there is no legend, and each sample panel says Sample once: by a source chip in a row, or in its
 * head when no row carries one (owner decision D1, spec 01 step 5).
 *
 * The read-fault latch's faulted posture (N-5) is unchanged: identical in shape to
 * `PositionRow.tsx`'s `Refused`/`FaultedBanner`, mirrored locally rather than importing the trading
 * domain into alerts.
 */
import { BrowserNotifyControl } from '@/features/alerts/BrowserNotifyControl';
import {
  FINRA_ON_PRODUCTION,
  PUBLIC_KIND,
  PUBLIC_KINDS,
  isPublicKind,
  isStructureKind,
} from '@/features/alerts/kinds';
import { KIND_LABEL, LEVEL_LABEL, NOT_SET } from '@/features/alerts/labels';
import { fmtDay, ruleWhat } from '@/features/alerts/publicRules';
import { firedTag, secSite } from '@/features/alerts/siteState';
import { alertsReadFaulted, applyEdit } from '@/features/alerts/store';
import type { AlertEvent, AlertRule, LevelRef } from '@/features/alerts/types';
import { useAlerts } from '@/features/alerts/useAlerts';
import { followedTickers, usePublicChecks } from '@/features/alerts/usePublicChecks';
import { ProvenanceChip } from '@/pages/research/publicUi';
import { DISPLAY, MONO } from '@/pages/research/ui';
import { NOT_RECORDED } from '@/shared/copy/notANumber';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { faceFor } from '@/shared/figure';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import { dataMode, getScan } from '@convexa/api';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import type { SxProps, Theme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  cloneElement,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  KindGlyph,
  Panel,
  SecStrip,
  StateTag,
  checksLine,
  kindState,
  ruleState,
  waitSentence,
  type RuleState,
  type SiteContext,
} from './alertsUi';
import { NewAlertDialog, type Draft } from './NewAlertDialog';

// ---- The faulted posture — a small LOCAL mirror of `PositionRow.tsx:122-127`'s attribute set -----
// (PLAN FE-10 note 7: the test asserts the SAME attribute set as `Refused` so the two cannot drift
// silently, without importing the trading domain into alerts.)

const ALERTS_FAULTED_BANNER_ID = 'alerts-faulted-banner';

const ALERTS_WRITE_REFUSED_TIP =
  "Paused — Convexa couldn't read your saved alerts and won't save anything new until that's " +
  'sorted. Your existing rules are untouched.';

const alertsRefusedSx = {
  color: 'action.disabled',
  bgcolor: 'action.disabledBackground',
  borderColor: 'action.disabledBackground',
  boxShadow: 'none',
  cursor: 'not-allowed',
  '&:hover': {
    color: 'action.disabled',
    bgcolor: 'action.disabledBackground',
    borderColor: 'action.disabledBackground',
    boxShadow: 'none',
  },
} as const;

/**
 * Wrap ANY control to refuse it while the alerts store is faulted — the SAME attribute set as
 * `features/trading/positions/FaultedBanner.tsx`'s `Refused`: `aria-disabled`, `aria-describedby`
 * pointing at the banner, `data-refused="true"`, no HTML `disabled` (which would drop the tab stop
 * and swallow the explaining tooltip), a no-op activation, and the theme's own
 * `action.disabled*` emphasis. `when === false` returns the child untouched.
 */
function AlertsRefused({ when, children }: { when: boolean; children: ReactElement }) {
  if (!when) return children;
  const swallow = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const ownSx = (children.props as { sx?: SxProps<Theme> }).sx;
  const blocked = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-disabled': true,
    'aria-describedby': ALERTS_FAULTED_BANNER_ID,
    'data-refused': 'true',
    onClick: (e: MouseEvent) => swallow(e),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') swallow(e);
    },
    sx: [...(Array.isArray(ownSx) ? ownSx : [ownSx]), alertsRefusedSx].filter(Boolean),
  });
  return (
    <Tooltip arrow title={ALERTS_WRITE_REFUSED_TIP}>
      {blocked}
    </Tooltip>
  );
}

/** `role="status"` — a standing condition, non-dismissible (a dismissal can't be persisted by a
 *  store that refuses writes). Four blocks, mirroring the positions banner's shape: what happened ·
 *  what was protected and what is refused · what you can do · what to expect. No apology, no error
 *  code. Nothing dims and no pause mark appears anywhere on this surface (faulted ≠ offline). */
function AlertsFaultedBanner() {
  return (
    <Box
      id={ALERTS_FAULTED_BANNER_ID}
      role="status"
      data-testid="alerts-faulted-banner"
      sx={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        border: '1px solid',
        borderColor: 'warning.main',
        borderRadius: 1,
        p: '10px 12px',
        mb: 0,
      }}
    >
      <WarningAmberIcon fontSize="small" aria-hidden sx={{ color: 'warning.main', mt: '1px' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'warning.main', m: 0 }}
        >
          Alerts paused — Convexa couldn't read your saved alerts
        </Typography>
        <Typography
          component="p"
          sx={{ fontSize: '0.78rem', color: 'text.primary', m: '4px 0 0', lineHeight: 1.5 }}
        >
          Rather than overwrite it, Convexa left your saved data exactly as it is. Nothing was
          deleted. The rules and firings below are the ones that loaded. New rules, firing history
          and read/unread changes will not be saved while this lasts.
        </Typography>
        <Box
          component="button"
          type="button"
          data-testid="alerts-faulted-reload"
          onClick={() => window.location.reload()}
          sx={{
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            font: 'inherit',
            fontSize: '0.78rem',
            color: 'info.main',
            p: 0,
            mt: '6px',
            textAlign: 'left',
          }}
        >
          Reload the page
        </Box>
        <Typography
          component="p"
          sx={{ fontSize: '0.78rem', color: 'text.secondary', m: '6px 0 0', lineHeight: 1.5 }}
        >
          If it comes back after a reload, the saved data in this browser needs attention. Convexa
          will keep it untouched either way.
        </Typography>
      </Box>
    </Box>
  );
}

// ---- Threshold rendering (§4.5, D-D) --------------------------------------------------------

/** A user-entered number: Mono (traced), no dotted rule — never the F9 `· untraced` caption
 *  (D-D, criteria 47a/47b). */
function TracedValue({ children, testId }: { children: string; testId?: string }) {
  return (
    <Box
      component="span"
      data-figure-register="mono"
      data-testid={testId}
      sx={{ ...faceFor(true), fontSize: '0.8rem' }}
    >
      {children}
    </Box>
  );
}

/** A structure rule's own note, quoted after its summary (Final Alerts board: “Gamma flip · 683.92 ·
 *  “Watch the authored sample flip””). Nothing when the rule holds no note. */
function RuleNote({ note }: { note?: string }) {
  const text = note?.trim();
  return text ? <>{` · “${text}”`}</> : null;
}

function RuleSummary({ rule, levelValue }: { rule: AlertRule; levelValue?: number | null }) {
  return (
    <>
      <RuleSummaryBody rule={rule} levelValue={levelValue} />
      <RuleNote note={rule.note} />
    </>
  );
}

function RuleSummaryBody({ rule, levelValue }: { rule: AlertRule; levelValue?: number | null }) {
  if (rule.kind === 'score_gate') {
    return (
      <>
        {'Score gate: '}
        {rule.scoreMin != null ? (
          <TracedValue testId="alert-rule-threshold">{`≥ ${rule.scoreMin}`}</TracedValue>
        ) : (
          NOT_SET
        )}
      </>
    );
  }
  if (rule.kind === 'level_touch') {
    if (rule.level === 'price') {
      return (
        <>
          {'Price threshold: '}
          {rule.priceThreshold != null ? (
            <TracedValue testId="alert-rule-threshold">{`$${rule.priceThreshold}`}</TracedValue>
          ) : (
            NOT_SET
          )}
        </>
      );
    }
    // Structure level: the label FROM the closed lookup, no threshold number of the rule's own —
    // the level's value is a market fact the record does not hold (47d). On the demo the page reads
    // that fact from the sample scan (useSampleLevels) and shows it beside the label, as the board
    // does; elsewhere the label stands alone.
    if (!rule.level) return <>{NOT_RECORDED}</>;
    return (
      <>
        {LEVEL_LABEL[rule.level]}
        {levelValue != null && Number.isFinite(levelValue) && (
          <>
            {' · '}
            <TracedValue testId="alert-rule-level-value">{levelValue.toFixed(2)}</TracedValue>
          </>
        )}
      </>
    );
  }
  // tier_change — byte-identical.
  return <>any tier transition</>;
}

// ---- the page -----------------------------------------------------------------------------------

const ALERTS_LEAD =
  'Alerts on public data: filings, insider clusters, results dates, futures positioning, short interest and your own notes. Each says where it reads from and how late that source is.';

const POSITIONING_SUGGESTION = {
  text: 'When leveraged funds in 10-year notes reach a 3-year extreme',
  draft: {
    kind: 'cftc',
    symbol: '043602',
    marketName: '10-year T-note',
    group: 'leveraged_funds',
    extreme: 'either',
    closeness: 'within5',
  } as Draft,
};
const NOTE_SUGGESTION = {
  text: 'When your NVDA note is due for review',
  draft: { kind: 'note', symbol: 'NVDA', days: 7 } as Draft,
};

/** Three that work today, none needing SEC access (the spec card's empty state). With FINRA off on
 *  production, the short-interest one would only read Off, so results approaching takes its place. */
function suggestions(finra: boolean): { text: string; draft: Draft }[] {
  return [
    POSITIONING_SUGGESTION,
    finra
      ? {
          text: 'When NVDA’s shares short move more than 15% between settlements',
          draft: { kind: 'si', symbol: 'NVDA', siMode: 'change', changePct: 15 },
        }
      : {
          text: 'A week before NVDA’s expected results date',
          draft: { kind: 'results', symbol: 'NVDA', days: 7 },
        },
    NOTE_SUGGESTION,
  ];
}

const LEGEND_ORDER: DataStateKey[] = [
  'updated',
  'delayed',
  'computed',
  'notSetUp',
  'sourceDown',
  'notLive',
  'off',
];

/** The day it fired: when this browser's check found it (the publication's own date rides in its
 *  detail and source chip), or, for the demo's scenario firing, the scenario's day. */
function eventDay(e: AlertEvent): string {
  if (e.sample && e.date) return fmtDay(e.date, false);
  return new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type SampleLevels = ReadonlyMap<string, Partial<Record<LevelRef, number>>>;

/**
 * The demo's structure levels per symbol, from the sample scan (the demo transport answers
 * getScan(); nothing leaves the browser), so a level-touch rule reads as the Final Alerts board
 * draws it: “Gamma flip · 683.92”. Read only on the demo and only when a structure-level rule is
 * listed; production never reads it, since its structure needs the options feed. A failed or odd
 * answer just leaves the label on its own.
 */
function useSampleLevels(enabled: boolean): SampleLevels | null {
  const [levels, setLevels] = useState<SampleLevels | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    getScan()
      .then((res) => {
        if (cancelled) return;
        const map = new Map<string, Partial<Record<LevelRef, number>>>();
        for (const row of Array.isArray(res?.rows) ? res.rows : []) {
          if (typeof row?.symbol !== 'string') continue;
          map.set(row.symbol.toUpperCase(), {
            gamma_flip: num(row.flip),
            call_wall: num(row.call_wall),
            put_wall: num(row.put_wall),
          });
        }
        setLevels(map);
      })
      .catch(() => {
        /* the rule keeps its label and note */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return levels;
}

function levelValueFor(rule: AlertRule, levels: SampleLevels | null): number | null {
  if (rule.kind !== 'level_touch' || !rule.level || rule.level === 'price' || !levels) return null;
  return levels.get(rule.symbol.toUpperCase())?.[rule.level] ?? null;
}

export function AlertsPage() {
  const a = useAlerts();
  const faulted = alertsReadFaulted();
  const marketDataMode = useMarketDataMode();
  const demo = dataMode === 'demo';
  const checks = usePublicChecks(a.rules);
  const ctx: SiteContext = {
    demo,
    sec: secSite(checks),
    finra: demo || FINRA_ON_PRODUCTION,
    structureLive: demo || marketDataMode === 'live',
  };
  const followed = useMemo(() => followedTickers(), []);
  const [dialog, setDialog] = useState<{ open: boolean; start: Draft | null }>({
    open: false,
    start: null,
  });
  const [toast, setToast] = useState<string | null>(null);
  const checking = checks.phase === 'checking' || checks.phase === 'idle';

  const states = a.rules.map((r) => ({ rule: r, ...ruleState(r, ctx, checking) }));
  const sampleLevels = useSampleLevels(
    demo && a.rules.some((r) => r.kind === 'level_touch' && r.level != null && r.level !== 'price'),
  );
  const structureCount = a.rules.filter((r) => isStructureKind(r.kind)).length;

  // No legend on the demo: the shell's demo bar is the page's one "Demo · sample data" (D1).
  const legend = demo
    ? null
    : [
        ...LEGEND_ORDER.filter((k) => k !== 'notLive' || ctx.structureLive)
          .map((k) => ({ state: k, n: states.filter((s) => s.state === k).length }))
          .filter((x) => x.n > 0),
        ...(ctx.structureLive ? [] : [{ state: 'notLive' as DataStateKey, n: structureCount }]),
      ];

  const openNew = (start: Draft | null = null) => {
    if (faulted) return;
    setDialog({ open: true, start });
  };
  const close = () => setDialog((d) => ({ ...d, open: false }));

  const onSave = (draft: Draft): boolean => {
    if (draft.id) {
      const existing = a.rules.find((r) => r.id === draft.id);
      if (!existing) return false;
      // New settings: the next check starts fresh; a new subject counts as a new rule (applyEdit).
      const ok = a.upsertRule(applyEdit(existing, draft, Date.now()));
      if (!ok) return false;
      close();
      setToast('Alert saved.');
      return true;
    }
    const { rule, saved } = a.addRule(draft);
    if (!saved) {
      a.removeRule(rule.id);
      return false;
    }
    close();
    const wait = waitSentence(draft.kind, ctx);
    setToast(
      demo
        ? 'Alert saved in this browser’s demo workspace. The demo doesn’t check it.'
        : wait
          ? `Alert saved. ${wait}`
          : isStructureKind(draft.kind)
            ? 'Alert saved. It checks while a ticker desk is open.'
            : 'Alert saved. Convexa checks it now, and each time you open Alerts.',
    );
    return true;
  };

  const openExisting = (id: string) => {
    close();
    window.setTimeout(() => {
      const el = document.getElementById(`alert-rule-${id}`);
      el?.scrollIntoView({ block: 'center' });
      el?.focus();
    }, 250);
  };

  return (
    <Box
      data-testid="alerts-page"
      sx={{
        // The one page column, the boards' `.wrap` (fidelity audit 2026-10-25, COL): 1280 of content
        // at 1440, so the 7fr/5fr columns run 737/527 as on the Alerts board.
        ...pageColumnSx,
        py: { xs: 3, md: 4 },
        pb: 'max(2rem, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'flex-end' }}>
        <Box sx={{ flex: '999 1 480px', minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              ...DISPLAY,
              m: 0,
              fontSize: 'clamp(30px, 3vw, 40px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              // The board's `.display` line height (44px at 1440), not body1's 1.65 (66px).
              lineHeight: 1.1,
            }}
          >
            Alerts
          </Typography>
          <Typography
            sx={{
              m: '6px 0 0',
              maxWidth: '72ch',
              color: 'text.secondary',
              fontSize: 14.5,
              lineHeight: 1.55,
            }}
          >
            {ALERTS_LEAD}{' '}
            {demo
              ? 'Every kind can be set up here, structure included.'
              : ctx.structureLive
                ? 'Structure alerts check while a ticker desk is open.'
                : 'Structure alerts need the options feed, which isn’t live on this site.'}
          </Typography>
        </Box>
        <AlertsRefused when={faulted}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openNew()}
            data-testid="alerts-new"
            sx={{ minHeight: 44 }}
          >
            New alert
          </Button>
        </AlertsRefused>
      </Box>

      {faulted && <AlertsFaultedBanner />}

      {legend && (
        <Box
          role="group"
          aria-label="On this page"
          data-testid="alerts-legend"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 12px',
            p: '10px 14px',
            borderRadius: '10px',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            On this page
          </Box>
          {legend.map((l) => (
            <Box
              key={l.state}
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              <DataStateTag state={l.state} detail={l.state === 'notLive' ? null : undefined} />
              {l.state === 'notLive' && (
                <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                  structure alerts
                </Box>
              )}
              <Box component="span" sx={{ ...MONO, fontSize: 12 }}>
                {l.n}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {!demo && ctx.sec === 'notSetUp' && <SecStrip />}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* Under 900px the two columns dissolve into one ordered list: rules, fired, structure, the kind
            reference (the phone board's order). */}
        <Box
          sx={{
            display: { xs: 'contents', md: 'flex' },
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          <Panel
            sx={{ order: { xs: 1, md: 0 } }}
            title="Your alerts"
            sample={demo}
            tag={
              <>
                {/* Its rows carry no tag and no source chip, so its head says Sample (D1). With no
                    rule left, the suggestions' "Sample · shaped like …" chips say it instead. */}
                {demo && a.rules.length > 0 && <DataStateTag state="sample" />}
                <Box
                  component="span"
                  sx={{ ...MONO, fontSize: 12, px: 1, borderRadius: 1, bgcolor: 'action.hover' }}
                >
                  {a.rules.length}
                </Box>
              </>
            }
          >
            <Box data-testid="alerts-rules">
              {a.rules.length === 0 ? (
                <Suggestions demo={demo} ctx={ctx} onPick={(d) => openNew(d)} faulted={faulted} />
              ) : (
                states.map(({ rule, state, detail, last }) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    state={state}
                    detail={detail}
                    last={last}
                    levelValue={levelValueFor(rule, sampleLevels)}
                    faulted={faulted}
                    onToggle={(on) => a.upsertRule({ ...rule, enabled: on })}
                    onEdit={() => openNew({ ...rule })}
                  />
                ))
              )}
            </Box>
            <Typography sx={{ m: 0, fontSize: 12.5, color: 'text.secondary' }}>
              {demo
                ? 'Saved in this browser’s demo workspace. Reset demo data puts the seed back.'
                : 'Kept in this browser. Sign in to keep them on your account.'}
            </Typography>
          </Panel>
          <Panel title="What each kind watches" sx={{ order: { xs: 4, md: 0 } }}>
            <KindReference ctx={ctx} />
          </Panel>
        </Box>

        <Box
          sx={{
            display: { xs: 'contents', md: 'flex' },
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          <Panel
            sx={{ order: { xs: 2, md: 0 } }}
            title="Fired"
            sample={demo}
            tag={
              demo ? (
                // A row's "Sample · shaped like …" chip is the frame's one Sample mark (D1); the
                // head says it only when no row shown carries one.
                a.events.slice(0, 20).some((e) => e.source) ? null : (
                  <DataStateTag state="sample" />
                )
              ) : checks.phase === 'done' ? (
                <DataStateTag {...firedTag(checks)} />
              ) : (
                <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Checking…
                </Box>
              )
            }
          >
            <Box data-testid="alerts-events">
              {a.events.length === 0 ? (
                <Typography
                  data-testid="alerts-events-empty"
                  sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}
                >
                  Nothing has fired yet.
                </Typography>
              ) : (
                a.events.slice(0, 20).map((e) => <FireRow key={e.id} e={e} />)
              )}
            </Box>
            <Typography sx={{ m: 0, fontSize: 12.5, color: 'text.secondary', lineHeight: 1.5 }}>
              {demo
                ? 'Each firing here comes from the sample day: one is seeded with it, and structure alerts fire while a ticker desk is open. Nothing here was published by a source.'
                : 'Convexa checks your public-data alerts when you open this page, in this browser. Nothing checks them while no Alerts page is open.'}
            </Typography>
            {/* Browser notifications: Convexa's own ask before the browser's prompt, Turn off once on,
                and the blocked / unavailable sentences (More overlays, lane 4). */}
            <BrowserNotifyControl
              on={a.notifyBrowser}
              permission={a.notifyPermission}
              onEnable={a.enableBrowserNotify}
              onTurnOff={a.turnOffBrowserNotify}
              where={demo ? 'demo' : ctx.structureLive ? 'live' : 'publicOnly'}
              refuse={(el) => <AlertsRefused when={faulted}>{el}</AlertsRefused>}
            />
          </Panel>
          {!ctx.structureLive && (
            <Panel
              sx={{ order: { xs: 3, md: 0 } }}
              title="Structure alerts"
              label="Structure alerts, not live"
              tag={<DataStateTag state="notLive" />}
            >
              <Typography sx={{ m: 0, fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}>
                <Box component="strong" sx={{ color: 'text.primary' }}>
                  Would watch
                </Box>{' '}
                score gate, tier change, level touch on any ticker’s options.
              </Typography>
              <Typography sx={{ m: 0, fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}>
                <Box component="strong" sx={{ color: 'text.primary' }}>
                  Off because
                </Box>{' '}
                they read the options chain, a paid feed this site doesn’t run.
              </Typography>
              <Link
                href={`${STAGING_DEMO_URL}/alerts`}
                sx={{ fontSize: 13, fontWeight: 600, minHeight: 24, alignSelf: 'flex-start' }}
              >
                See it on the demo →
              </Link>
            </Panel>
          )}
        </Box>
      </Box>

      <NewAlertDialog
        open={dialog.open}
        start={dialog.start}
        ctx={ctx}
        followed={followed}
        rules={a.rules}
        notifyPermission={a.notifyPermission}
        notifyOn={a.notifyBrowser}
        enableNotify={a.enableBrowserNotify}
        onClose={close}
        onSave={onSave}
        onRemove={(id) => {
          a.removeRule(id);
          close();
          setToast('Alert removed.');
        }}
        onOpenExisting={openExisting}
      />
      <Snackbar
        open={toast !== null}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

function RuleRow({
  rule,
  state,
  detail,
  last,
  levelValue,
  faulted,
  onToggle,
  onEdit,
}: {
  rule: AlertRule;
  state: RuleState['state'];
  detail?: string;
  last: string;
  /** A level-touch rule's level, when the page can read it (the demo's sample scan). */
  levelValue?: number | null;
  faulted: boolean;
  onToggle: (on: boolean) => void;
  onEdit: () => void;
}) {
  const name = KIND_LABEL[rule.kind];
  const subject = rule.kind === 'cftc' ? (rule.marketName ?? rule.symbol) : rule.symbol;
  const what = isPublicKind(rule.kind) ? (
    ruleWhat(rule)
  ) : (
    <RuleSummary rule={rule} levelValue={levelValue} />
  );
  return (
    <Box
      id={`alert-rule-${rule.id}`}
      tabIndex={-1}
      data-testid="alerts-rule"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '170px minmax(0, 1fr)' },
        gap: '8px 16px',
        py: 1.75,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0, pt: 0.5 },
        outline: 'none',
        '&:focus-visible': { boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}` },
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          fontSize: 12.5,
          fontWeight: 600,
          color: rule.enabled ? 'text.primary' : 'text.secondary',
          alignSelf: 'start',
          pt: '1px',
        }}
      >
        <KindGlyph kind={rule.kind} />
        {name}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
        <Box
          component="b"
          sx={{
            ...MONO,
            fontSize: 13.5,
            fontWeight: 600,
            color: rule.enabled ? 'text.primary' : 'text.secondary',
          }}
        >
          {subject}
        </Box>
        <Box
          component="span"
          data-testid="alerts-rule-summary"
          sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.45 }}
        >
          {what}
        </Box>
      </Box>
      <Box
        sx={{
          gridColumn: { xs: '1', sm: '2' },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 12px',
        }}
      >
        {state !== 'none' && <StateTag state={state} detail={detail} />}
        <Box
          component="span"
          sx={{
            ...MONO,
            fontSize: 11,
            color: 'text.secondary',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {last}
        </Box>
        <AlertsRefused when={faulted}>
          <Switch
            checked={rule.enabled}
            onChange={(_, on) => {
              if (faulted) return;
              onToggle(on);
            }}
            slotProps={{
              input: { 'aria-label': `${name} for ${subject}: ${rule.enabled ? 'on' : 'off'}` },
            }}
            color="default"
          />
        </AlertsRefused>
        <AlertsRefused when={faulted}>
          <Button
            variant="text"
            size="small"
            color="inherit"
            onClick={() => {
              if (faulted) return;
              onEdit();
            }}
            aria-label={`Edit ${name} for ${subject}`}
            sx={{
              ml: 'auto',
              minHeight: 40,
              '@media (pointer: coarse)': { minHeight: 44, minWidth: 44 },
            }}
          >
            Edit
          </Button>
        </AlertsRefused>
      </Box>
    </Box>
  );
}

function FireRow({ e }: { e: AlertEvent }) {
  const external = e.link?.href.startsWith('http');
  return (
    <Box
      data-testid="alerts-event"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        py: 1.5,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0, pt: 0 },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline' }}>
        <Box
          component="span"
          title={new Date(e.at).toLocaleString(undefined, { timeZoneName: 'short' })}
          sx={{ ...MONO, fontSize: 12, color: 'text.secondary', minWidth: 44, flex: 'none' }}
        >
          {eventDay(e)}
        </Box>
        <Box component="b" sx={{ fontSize: 13.5, lineHeight: 1.4 }}>
          {e.message}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 12px',
          alignItems: 'center',
          pl: { xs: 0, sm: '54px' },
        }}
      >
        {e.detail && (
          <Box
            component="span"
            sx={{ fontSize: 12.5, color: 'text.secondary', flex: '1 1 240px', lineHeight: 1.45 }}
          >
            {e.detail}
          </Box>
        )}
        {e.source && <ProvenanceChip text={e.source} kind={e.sample ? 'sample' : 'primary'} />}
        {e.link &&
          (external ? (
            <Link
              href={e.link.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontSize: 13, minHeight: 24, display: 'inline-flex', alignItems: 'center' }}
            >
              {`${e.link.label} →`}
            </Link>
          ) : (
            <Link
              component={RouterLink}
              to={e.link.href}
              sx={{ fontSize: 13, minHeight: 24, display: 'inline-flex', alignItems: 'center' }}
            >
              {`${e.link.label} →`}
            </Link>
          ))}
      </Box>
    </Box>
  );
}

function Suggestions({
  demo,
  ctx,
  onPick,
  faulted,
}: {
  demo: boolean;
  ctx: SiteContext;
  onPick: (d: Draft) => void;
  faulted: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box component="strong" sx={{ fontSize: 14 }}>
        No alerts yet.
      </Box>
      <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
        {demo ? 'These work on the demo’s sample data:' : 'These work on this site today:'}
      </Box>
      {suggestions(ctx.finra).map((s) => {
        const info = PUBLIC_KIND[s.draft.kind as keyof typeof PUBLIC_KIND];
        const st = kindState(s.draft.kind, ctx);
        return (
          <AlertsRefused key={s.text} when={faulted}>
            <Box
              component="button"
              type="button"
              onClick={() => !faulted && onPick(s.draft)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.75,
                p: 1.5,
                minHeight: 44,
                width: '100%',
                borderRadius: '10px',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'transparent',
                color: 'text.primary',
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  gap: 1,
                  alignItems: 'center',
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                <KindGlyph kind={s.draft.kind} />
                {s.text}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {/* Not a link: the suggestion is a button, and a click must pick it, not leave. */}
                <ProvenanceChip
                  text={demo ? `Sample · shaped like ${info.chip}` : info.chip}
                  link={false}
                />
                {/* On the demo the chip says Sample; a Sample tag beside it would repeat it. */}
                {!demo && <StateTag {...st} />}
              </Box>
            </Box>
          </AlertsRefused>
        );
      })}
    </Box>
  );
}

/** The kind reference: what each kind watches, its source and delay, and its state here. A table
 *  that stacks into rows under 900px. */
function KindReference({ ctx }: { ctx: SiteContext }) {
  const head = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    textAlign: 'left',
    p: '8px',
    borderBottom: 1,
    borderColor: 'divider',
  } as const;
  const cell = {
    p: '10px 8px',
    borderBottom: 1,
    borderColor: 'divider',
    verticalAlign: 'top',
    color: 'text.secondary',
    lineHeight: 1.45,
  } as const;
  return (
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12.5,
        '@media (max-width: 899px)': {
          '& thead': { display: 'none' },
          '& tr': {
            display: 'grid',
            gridTemplateColumns: '1fr',
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          },
          '& td': { border: 0, p: '2px 0' },
        },
      }}
    >
      <thead>
        <tr>
          <Box component="th" sx={head}>
            Kind
          </Box>
          <Box component="th" sx={head}>
            Fires when
          </Box>
          <Box component="th" sx={head}>
            Source · delay
          </Box>
          {/* The state column: on the demo every cell would read Sample beside a chip that
              already says it, so the column goes (owner decision D1). */}
          {!ctx.demo && (
            <Box component="th" sx={head}>
              On this site
            </Box>
          )}
        </tr>
      </thead>
      <tbody>
        {PUBLIC_KINDS.map((k) => {
          const st = kindState(k.key, ctx);
          return (
            <tr key={k.key}>
              <Box
                component="td"
                sx={{
                  ...cell,
                  color: 'text.primary',
                  fontWeight: 600,
                  whiteSpace: { md: 'nowrap' },
                }}
              >
                {k.name}
              </Box>
              <Box component="td" sx={cell}>{`${k.fires}.`}</Box>
              <Box component="td" sx={cell}>
                <ProvenanceChip text={ctx.demo ? `Sample · shaped like ${k.chip}` : k.chip} />
                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                  {`${k.delay}.`}
                  {!ctx.demo && ` ${checksLine(k.key)}`}
                </Box>
              </Box>
              {!ctx.demo && (
                <Box
                  component="td"
                  sx={{ ...cell, '& [data-state]': { whiteSpace: { md: 'nowrap' } } }}
                >
                  <StateTag {...st} />
                </Box>
              )}
            </tr>
          );
        })}
        <tr>
          <Box
            component="td"
            sx={{
              ...cell,
              color: ctx.structureLive ? 'text.primary' : 'text.secondary',
              fontWeight: 600,
            }}
          >
            Score, tier, level touch
          </Box>
          <Box component="td" sx={cell}>
            Structure moves on a ticker’s options.
          </Box>
          <Box component="td" sx={cell}>
            {ctx.demo ? (
              <>
                <ProvenanceChip text="Sample · shaped like a Massive options chain" kind="sample" />
                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                  Checked against the sample tape while a ticker desk is open.
                </Box>
              </>
            ) : ctx.structureLive ? (
              'The options feed. Checks: while a ticker desk is open.'
            ) : (
              'Needs a paid options feed.'
            )}
          </Box>
          {!ctx.demo && (
            <Box
              component="td"
              sx={{ ...cell, '& [data-state]': { whiteSpace: { md: 'nowrap' } } }}
            >
              <StateTag state={kindState('level_touch', ctx).state} />
            </Box>
          )}
        </tr>
      </tbody>
    </Box>
  );
}

export default AlertsPage;
