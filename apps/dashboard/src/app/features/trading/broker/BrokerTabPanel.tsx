/**
 * BrokerTabPanel — the Broker tab (replaces the LOCKED LiveTabPanel placeholder; the sanctioned
 * unlock). Renders the closed S1–S9 machine off `resolveRenderState` — the wire decides, the
 * panel obeys; `positions.length` is never consulted (AC-10).
 *
 * The two degradation axes are wired here (SPEC §4, all four combinations):
 *  - market-data axis (`streamOffline` prop, the page's existing SSE watchdog): dims ONLY the
 *    modeled P/L figures to ⏸ last-known;
 *  - book-snapshot axis (`now − as_of` vs the server threshold, re-derived on a 30s tick):
 *    applies the S6 treatment ONLY to the snapshot fields and switches the modeled label to its
 *    dual basis.
 *
 * A refresh is never a silent no-op (AC-8): throttled/failed/incomplete outcomes render the
 * honest note; a fresh fetch advances the stamp instead.
 *
 * Signed-out: the shared SignInPrompt renders BEFORE any broker state is reachable (the auth
 * carve-out) — no broker request is issued anonymously.
 */
import { useAuth } from '@/features/auth/AuthContext';
import { SignInPrompt } from '@/features/auth/SignInPrompt';
import { useGate } from '@/features/auth/useGate';
import { Alert, Box, Button, Skeleton, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { LiveUpdate, TickerBundle } from '@org/api';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { BrokerGroupHeader, BrokerGroupPanel, LoneLegClause } from './BrokerGroupHeader';
import { BrokerPositionCard } from './BrokerPositionCard';
import { BrokerPositionRow } from './BrokerPositionRow';
import { buildBrokerPositionView, type BrokerPositionView } from './brokerView';
import { BROKER_COPY, stampTime } from './copy';
import { groupBook } from './grouping';
import { snapshotAgeSeconds } from './predicates';
import { ProvenanceHeader } from './ProvenanceHeader';
import { BrokerReassessAction } from './reassess';
import { resolveRenderState } from './renderState';
import { useBrokerBook } from './useBrokerBook';
import { useBrokerMarks } from './useBrokerMarks';

/** Staleness is time-varying (client-derived off the server threshold) — re-derive on a tick. */
const STALE_TICK_MS = 30_000;

interface Props {
  data: TickerBundle | null;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
}

export function BrokerTabPanel({ data, live, isLive, streamOffline }: Props) {
  const auth = useAuth();
  const gate = useGate();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));

  const api = useBrokerBook(auth.authenticated);
  const { book, hintSet, inFlight, firstFetch } = api;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), STALE_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const render = resolveRenderState({ book, hintSet, inFlight, firstFetch, nowMs });

  const marks = useBrokerMarks(book?.positions ?? [], data, live, isLive, streamOffline);
  const views = useMemo<BrokerPositionView[]>(
    () =>
      (book?.positions ?? []).map((bp) =>
        buildBrokerPositionView({
          position: bp,
          legMarks: marks.legMarksOf(bp),
          dte: marks.dteOf(bp),
          nowMs,
          book,
        }),
      ),
    [book, marks, nowMs],
  );

  // broker-option-grouping F9 — composed strictly downstream of `views` (SPEC §2.9: zero new fetch,
  // never touches marks/contracts). EPHEMERAL, React-local, keyed on the stable `GroupKey`, so the
  // 30s `nowMs` tick and every refresh rebuild the derived data WITHOUT remounting the group and
  // expand state survives them (SPEC §2.10 — no durable key: this module never touches a
  // `convexa.*` key).
  const grouped = useMemo(() => groupBook(views, book, nowMs), [views, book, nowMs]);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ---- Session still resolving: a cold skeleton, never a premature prompt or claim -------------
  if (!auth.ready) {
    return (
      <Box data-testid="broker-tab-panel" sx={{ mt: '4px' }}>
        <Box data-testid="broker-s9" sx={{ mt: '20px' }}>
          <SkeletonRows />
        </Box>
      </Box>
    );
  }

  // ---- Signed out: the shared prompt, before any broker state (auth carve-out) -----------------
  if (!auth.authenticated) {
    return (
      <Box data-testid="broker-tab-panel" sx={{ mt: '20px' }}>
        <SignInPrompt
          text={BROKER_COPY.gate}
          onSignIn={() => gate.signIn(BROKER_COPY.gate)}
          testid="broker-signin-prompt"
        />
      </Box>
    );
  }

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      const outcome = await api.refresh();
      const at = book?.as_of != null ? stampTime(book.as_of) : null;
      if (outcome.advanced) setRefreshNote(null);
      else if (outcome.throttled) setRefreshNote(BROKER_COPY.refresh.unchanged(at ?? ''));
      else if (outcome.failed != null) setRefreshNote(BROKER_COPY.refresh.failed(at));
      else setRefreshNote(BROKER_COPY.refresh.incomplete(at));
    } finally {
      setRefreshing(false);
    }
  };

  const asOf = book?.as_of ?? null;
  const ageSeconds = snapshotAgeSeconds(book, nowMs);
  const stampedTime = asOf != null ? stampTime(asOf) : '';

  // ---- The served-book body (rows / confirmed-empty), shared by S3/S4/S6/S7/S8 ------------------
  const servedBody = render.hasSnapshot ? (
    <>
      {book?.state === 'empty' ? (
        <Box data-testid="broker-s4" sx={{ mt: '18px', textAlign: 'center', py: '28px' }}>
          <Typography component="p" sx={{ fontWeight: 600, m: 0 }}>
            {BROKER_COPY.s4.heading}
          </Typography>
          <Typography
            component="p"
            data-testid="broker-s4-checked"
            sx={{ fontSize: '0.8rem', color: 'text.secondary', m: '6px 0 0' }}
          >
            {BROKER_COPY.s4.checked(stampedTime)}
          </Typography>
        </Box>
      ) : (
        <Box data-testid="broker-rows" sx={{ mt: '4px' }}>
          <Typography
            component="div"
            data-testid="broker-count"
            sx={{ fontSize: '0.75rem', color: 'text.secondary', m: '8px 0' }}
          >
            {BROKER_COPY.positionsCount(views.length)}
          </Typography>
          {/* broker-option-grouping F9 — groups (key ascending, already sorted by groupBook) first,
              then ungrouped in the book's own order (AC-33: stable, not a specific interleave). */}
          {grouped.groups.map((g) => {
            // §2.5/§2.6: `leg_count === 1` (not `position_count`) is the render branch — see
            // PLAN F9's recorded reconciliation: a single member carrying two option legs must
            // still render as a GROUP header, never the lone-leg clause.
            if (g.leg_count === 1) {
              const member = g.members[0];
              const shared = {
                view: member,
                streamOffline,
                isStale: render.isStale,
                asOf,
                actions: <BrokerReassessAction view={member} book={book} />,
                secondaryClause: <LoneLegClause />,
              };
              return compact ? (
                <BrokerPositionCard key={member.broker.broker_position_id} {...shared} />
              ) : (
                <BrokerPositionRow key={member.broker.broker_position_id} {...shared} />
              );
            }
            const expanded = expandedKeys.has(g.key);
            const panelId = `broker-group-panel-${g.key}`;
            return (
              <Box key={g.key} data-testid="broker-group-entry">
                <BrokerGroupHeader
                  group={g}
                  variant={compact ? 'card' : 'row'}
                  expanded={expanded}
                  onToggle={() => toggleGroup(g.key)}
                  panelId={panelId}
                  streamOffline={streamOffline}
                  isStale={render.isStale}
                  asOf={asOf}
                />
                <BrokerGroupPanel group={g} id={panelId} expanded={expanded}>
                  {g.members.map((m) => {
                    const shared = {
                      view: m,
                      streamOffline,
                      isStale: render.isStale,
                      asOf,
                      actions: <BrokerReassessAction view={m} book={book} />,
                      nested: true,
                    };
                    return compact ? (
                      <BrokerPositionCard key={m.broker.broker_position_id} {...shared} />
                    ) : (
                      <BrokerPositionRow key={m.broker.broker_position_id} {...shared} />
                    );
                  })}
                </BrokerGroupPanel>
              </Box>
            );
          })}
          {grouped.ungrouped.map((v) => {
            const shared = {
              view: v,
              streamOffline,
              isStale: render.isStale,
              asOf,
              // F6 — the ONLY action on a broker row: advisory reassessment (never a write).
              actions: <BrokerReassessAction view={v} book={book} />,
            };
            return compact ? (
              <BrokerPositionCard key={v.broker.broker_position_id} {...shared} />
            ) : (
              <BrokerPositionRow key={v.broker.broker_position_id} {...shared} />
            );
          })}
        </Box>
      )}
    </>
  ) : null;

  return (
    <Box data-testid="broker-tab-panel" sx={{ mt: '4px' }}>
      {/* ---- S1 — never connected ---------------------------------------------------------- */}
      {render.state === 'S1_never_connected' && (
        <Box
          data-testid="broker-s1"
          sx={{ mt: '24px', textAlign: 'center', py: '40px', px: '16px' }}
        >
          <Typography component="h3" sx={{ fontSize: '1.15rem', fontWeight: 700, m: '0 0 8px' }}>
            {BROKER_COPY.s1.heading}
          </Typography>
          <Typography
            component="p"
            sx={{
              maxWidth: 520,
              mx: 'auto',
              my: 0,
              fontSize: '0.9rem',
              color: 'text.secondary',
              lineHeight: 1.55,
            }}
          >
            {BROKER_COPY.s1.body}
          </Typography>
          <Button
            variant="contained"
            component={RouterLink}
            to="/settings#brokerage"
            data-testid="broker-connect-cta"
            sx={{ mt: '18px', minHeight: 44 }}
          >
            {BROKER_COPY.s1.cta}
          </Button>
          <Typography
            component="p"
            sx={{ fontSize: '0.75rem', color: 'text.secondary', m: '12px 0 0' }}
          >
            {BROKER_COPY.s1.subline}
          </Typography>
        </Box>
      )}

      {/* ---- S2 — first sync --------------------------------------------------------------- */}
      {render.state === 'S2_pending_first_sync' && (
        <Box data-testid="broker-s2" sx={{ mt: '20px' }}>
          <Typography component="p" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            {BROKER_COPY.s2}
          </Typography>
          <SkeletonRows />
        </Box>
      )}

      {/* ---- S9 — cold skeleton (≠ S2: no first-sync claim; ≠ S7: nothing is degraded) ------- */}
      {render.state === 'S9_cold_skeleton' && (
        <Box data-testid="broker-s9" sx={{ mt: '20px' }}>
          <SkeletonRows />
        </Box>
      )}

      {/* ---- S5 — unknown (never renderable as confirmed-empty) ------------------------------ */}
      {render.state === 'S5_unknown' && (
        <Box data-testid="broker-s5" sx={{ mt: '24px', textAlign: 'center', py: '32px' }}>
          <Typography
            component="p"
            sx={{ maxWidth: 520, mx: 'auto', my: 0, fontSize: '0.9rem', color: 'text.secondary' }}
          >
            {BROKER_COPY.s5.body}
          </Typography>
          <Button
            variant="outlined"
            data-testid="broker-try-again"
            onClick={() => void api.refetch()}
            sx={{ mt: '16px', minHeight: 44 }}
          >
            {BROKER_COPY.s5.cta}
          </Button>
        </Box>
      )}

      {/* ---- Served-book family: provenance header over everything -------------------------- */}
      {(render.state === 'S3_ok' ||
        render.state === 'S4_empty_confirmed' ||
        render.state === 'S7_degraded' ||
        render.state === 'S8_reauth') && (
        <>
          {render.hasSnapshot && asOf != null && (
            <ProvenanceHeader
              asOf={asOf}
              isStale={render.isStale}
              ageSeconds={ageSeconds}
              onRefresh={() => void doRefresh()}
              refreshing={refreshing || inFlight}
            />
          )}

          {/* S7 — tab-scoped degraded banner (info class: nothing here is the trader's fault). */}
          {render.state === 'S7_degraded' && (
            <Alert severity="info" data-testid="broker-degraded-banner" sx={{ mb: '10px' }}>
              {BROKER_COPY.s7(stampedTime)}
            </Alert>
          )}

          {/* S8 — reauth vs our-fault: DISTINCT copy off distinct wire values (AC-13). */}
          {render.state === 'S8_reauth' && render.warn === 'credential_rejected' && (
            <Alert
              severity="warning"
              data-testid="broker-reauth-banner"
              sx={{ mb: '10px' }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  component={RouterLink}
                  to="/settings#brokerage"
                  data-testid="broker-reconnect-cta"
                >
                  {BROKER_COPY.s8.cta}
                </Button>
              }
            >
              {BROKER_COPY.s8.banner}
              {render.hasSnapshot ? BROKER_COPY.s8.lastKnown(stampedTime) : '.'}
            </Alert>
          )}
          {render.state === 'S8_reauth' && render.warn === 'credential_unreadable' && (
            <Alert
              severity="warning"
              data-testid="broker-unreadable-banner"
              sx={{ mb: '10px' }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  component={RouterLink}
                  to="/settings#brokerage"
                  data-testid="broker-replace-cta"
                >
                  {BROKER_COPY.unreadable.cta}
                </Button>
              }
            >
              {BROKER_COPY.unreadable.banner}
            </Alert>
          )}

          {/* AC-8 — the refresh outcome note (throttled / failed / incomplete). */}
          {refreshNote != null && (
            <Alert
              severity="info"
              data-testid="broker-refresh-note"
              onClose={() => setRefreshNote(null)}
              sx={{ mb: '10px' }}
            >
              {refreshNote}
            </Alert>
          )}

          {servedBody}
        </>
      )}

      {/* S8 with NO served snapshot renders its banner above and nothing below — the server has
          no confirmed book to show, and the panel will not invent one. */}
    </Box>
  );
}

function SkeletonRows() {
  return (
    <Box sx={{ mt: '12px' }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" height={56} sx={{ mb: '8px' }} />
      ))}
    </Box>
  );
}
