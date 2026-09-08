/**
 * TickerHeader — the headline ANCHOR block (Figma `Ticker · Header`, node 149:96): a status-chip row
 * (regime + the stream-driven connection chip), the `TICKER · $price` h1 (NBBO mid when live, else the
 * bundle's static price) with the levels/expiration sub-line, and the display-only **last-trade**
 * readout beneath it.
 *
 * The last-trade is a live-derived sibling that degrades WITH the live tiles on a stream drop; it
 * NEVER feeds the anchor/levels/flip (`live-spot=NBBO-mid`, AC-LastTrade-5).
 *
 * CRITICAL: the connection chip is a **status indicator, NOT a user toggle** — derived from the SSE
 * payload-gap watchdog + the session classifier (`streamOffline` / `liveStatus(live)`). The offline
 * warning supersedes the session chip so a stale "live" can never contradict a dropped transport
 * (`[live-vs-static-isolation]`). The last-trade readout (`data-testid="last-trade"`, its 4 states) is
 * preserved byte-for-byte.
 */
import {
  Refused as FaultedRefused,
  TickerFaultedNotice,
} from '@/features/trading/positions/FaultedBanner';
import { flashColorSx, useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Refused } from '@/shared/ui/Refused';
import type { LiveUpdate, MarketState, Signals } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { ConnectionChip } from '../../connection/ConnectionChip';
import { connectionStateFor } from '../../connection/connectionState';
import { useLiveTape } from '../../liveTapeStore';
import { sessionTapeOf, type SessionTapeOccupancy } from '../../sessionTapeStanding';
import { TICKER_BUNDLE_POLL_MS } from '../../useTickerBundle';
import {
  LAST_TRADE_NO_TAPE_PRINT,
  LAST_TRADE_REPLAY_TOOLTIP,
  LAST_TRADE_TOOLTIP,
  SINGLE_NAME_CAVEAT,
} from '../_kit/copy';
import { FreshnessLine } from './FreshnessLine';

const REGIME_TIP =
  'Positive gamma: dealers dampen moves → range-bound, fade extremes. Negative gamma: dealers ' +
  "amplify moves → trending, don't fade.";

/** A dim `·` divider between second-line meta items (design: `desk.mjs`'s `<span class="dim">·`). */
function MetaDot() {
  return (
    <Typography component="span" variant="body2" aria-hidden sx={{ color: 'text.disabled' }}>
      ·
    </Typography>
  );
}

/**
 * Tinted status chip (Figma: colored text on a subtle same-color tint). `neutral` = muted grey.
 * Used for the REGIME chip only — the connection chip moved to its own `ConnectionChip` renderer
 * (curvature-v2-foundations, SPEC §2.4), taking the `liveDotPulse` keyframe with it (this is no
 * longer that declaration's home; nothing here ever needs a dot or a warn icon).
 */
export function TintChip({
  tone,
  label,
  tip,
}: {
  tone: 'success' | 'error' | 'info' | 'warning' | 'neutral';
  label: string;
  tip?: string;
}) {
  const chip = (
    <Box
      component="span"
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: '3px',
        borderRadius: '999px',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        color: tone === 'neutral' ? t.palette.text.secondary : t.palette[tone].main,
        bgcolor:
          tone === 'neutral'
            ? alpha(t.palette.text.secondary, 0.14)
            : alpha(t.palette[tone].main, 0.16),
      })}
    >
      {label}
    </Box>
  );
  return tip ? (
    <Tooltip arrow title={tip}>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

// ---- Live last-trade readout (AC-LastTrade-1..5) --------------------------------------------
// LIVE-DERIVED (rides SSE only). Cold → shimmer; default → `● Last trade $X`; live-empty → honest
// empty; offline → `⏸ Last trade $X` dimmed. Never the headline; never freezes a stale value.
// S1 (session_tape): hollow ○ + replay tooltip; no ⏸; drop dims via chip, not paused copy.
export function LastTradeReadout({
  live: liveProp,
  streamOffline: offlineProp,
  displayActive: displayActiveProp,
}: {
  live?: LiveUpdate | null;
  streamOffline?: boolean;
  displayActive?: boolean;
} = {}) {
  // Prefer liveTapeStore when props omitted (§3.8 Phase C).
  // Lazy import avoided — store is light and ticker-only.
  const tape = useLiveTape();
  const live = liveProp !== undefined ? liveProp : tape.live;
  const streamOffline = offlineProp !== undefined ? offlineProp : tape.streamOffline;
  const st = sessionTapeOf(live);
  const numbersActive =
    displayActiveProp !== undefined
      ? displayActiveProp
      : tape.displayActive || ((live?.live ?? false) && !streamOffline && !st);
  // Flash on genuine print while numbers are active (S0 live or S1 display-active).
  const ltActive = numbersActive && !streamOffline;
  const ltFlash = useFlashOnChange(ltActive ? (live?.last_trade ?? null) : null, {
    active: ltActive,
  });
  if (live == null) {
    return (
      <Skeleton
        variant="text"
        width={140}
        data-testid="last-trade-skeleton"
        sx={{ fontSize: '0.875rem' }}
      />
    );
  }
  const lt = live.last_trade;

  if (st) {
    const tip = LAST_TRADE_REPLAY_TOOLTIP;
    const dim = streamOffline;
    if (lt == null) {
      return (
        <Tooltip arrow title={tip}>
          <Typography
            component="span"
            variant="body2"
            sx={{ color: 'text.secondary', opacity: dim ? 0.5 : 1 }}
            data-testid="last-trade"
          >
            {LAST_TRADE_NO_TAPE_PRINT}
          </Typography>
        </Tooltip>
      );
    }
    return (
      <Tooltip arrow title={tip}>
        <Typography
          component="span"
          variant="body2"
          sx={[{ color: 'text.secondary', opacity: dim ? 0.5 : 1 }, flashColorSx(ltFlash)]}
          data-testid="last-trade"
        >
          <Box component="span" sx={{ color: 'text.secondary' }}>
            ○
          </Box>{' '}
          Last trade ${lt.toFixed(2)}
        </Typography>
      </Tooltip>
    );
  }

  if (streamOffline) {
    return (
      <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
        <Typography
          component="span"
          variant="body2"
          data-testid="last-trade"
          sx={{ color: 'text.secondary', opacity: 0.5 }}
        >
          {lt != null ? `⏸ Last trade $${lt.toFixed(2)}` : 'Last trade — no recent print'}
        </Typography>
      </Tooltip>
    );
  }
  if (lt == null) {
    return (
      <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
        <Typography
          component="span"
          variant="body2"
          sx={{ color: 'text.secondary' }}
          data-testid="last-trade"
        >
          Last trade — no recent print
        </Typography>
      </Tooltip>
    );
  }
  return (
    <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
      <Typography
        component="span"
        variant="body2"
        sx={[{ color: 'text.secondary' }, flashColorSx(ltFlash)]}
        data-testid="last-trade"
      >
        <Box component="span" sx={{ color: 'info.main' }}>
          ●
        </Box>{' '}
        Last trade ${lt.toFixed(2)}
      </Typography>
    </Tooltip>
  );
}

interface TickerHeaderProps {
  m: MarketState;
  sig: Signals | undefined;
  live: LiveUpdate | null;
  /** Genuine paid-live gate (fills / ● live / pulses). */
  isLive: boolean;
  /** Session-tape numbers may follow mid (or S0 live). */
  displayActive?: boolean;
  streamOffline: boolean;
  selected: string[] | null;
  /** Persistent "+ Open simulated trade" CTA, right-aligned in the header (kept out of the analysis flow). */
  onOpenTrade?: () => void;
  /**
   * THE TICKER-PAGE DOOR (SPEC §2.9, §4, AC-69). The faulted state is NOT scoped to `/positions`:
   * this CTA opens the same shared dialog against the same book, so it carries the same refused
   * treatment and its own one-line notice. `aria-disabled` + focusable, never HTML `disabled`.
   */
  storeFaulted?: boolean;
  /** When false (signed out), show Refused instead of a live-looking sim CTA. */
  tradeAllowed?: boolean;
  onSignIn?: () => void;
  /** REST-bundle freshness — folded into the deck hero's meta line (relocated `FreshnessLine`). The
   *  freshness reflects the STATIC path only (never live/SSE) — `[live-vs-static-isolation]`. */
  freshness?: { snapshotIso: string | null; dataAgeSeconds: number | null; refreshing: boolean };
  /** index-first-defaults AC-4 — render the one-line single-name honesty caption under the meta
   *  line. The CALLER owns the membership decision (true ONLY for a confirmed non-universe symbol;
   *  unknown/failed reads stay false — AC-5). Muted caption, token-only, never warn/red. */
  singleNameCaveat?: boolean;
  /** Last vouched session_tape.phase — survives payload-gap for drop standing. */
  lastSessionPhase?: SessionTapeOccupancy['phase'] | null;
}

export function TickerHeader({
  m,
  sig,
  live,
  isLive,
  displayActive = false,
  streamOffline,
  selected,
  onOpenTrade,
  storeFaulted = false,
  tradeAllowed = true,
  onSignIn,
  freshness,
  singleNameCaveat = false,
  lastSessionPhase = null,
}: TickerHeaderProps) {
  const reduced = useReducedMotion();
  const connState = connectionStateFor({
    live,
    streamOffline,
    routeSymbol: m.ticker,
    lastSessionPhase,
  });
  // Numbers follow tape mid when display-active OR genuine live (S0).
  const numbersActive = displayActive || isLive;
  const priceFlash = useFlashOnChange(numbersActive && live ? live.mid : null, {
    active: numbersActive && !streamOffline,
  });

  return (
    <Box>
      {/* Stage 0 item 1 (the measured 580px offender): the hero row STACKS vertically below `sm` —
          chips/anchor/meta re-stack and the CTA drops under the anchor on its own left-aligned row.
          Nothing is removed; at `sm+` the row layout is unchanged. */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'flex-start' } }}
      >
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          {/* Ticker fidelity repair, change 3 (F3) — the design's chip row
              (`design/src/screens/desk.mjs:264-272`'s `.mast-meta`): regime + the ONE stream-driven
              connection chip + the last-trade readout, all on one row (last-trade MOVES here from
              the old separate meta line — still the SAME `LastTradeReadout`, byte-identical states
              and testid). The chip slot is UNCONDITIONAL (ruling 1 / AC-9): before the first stream
              fact it renders the wordless placeholder, never nothing — so the row itself always
              renders once mounted. */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {sig?.regime && (
              <TintChip
                tone={sig.regime === 'positive_gamma' ? 'success' : 'error'}
                label={sig.regime.replace('_', ' ')}
                tip={REGIME_TIP}
              />
            )}
            <ConnectionChip
              state={connState}
              live={live}
              routeSymbol={m.ticker}
              reduced={reduced}
            />
            <LastTradeReadout
              live={live}
              streamOffline={streamOffline}
              displayActive={numbersActive}
            />
          </Stack>

          {/* Headline ANCHOR — SYMBOL + mid only (design: `SPY 573.12 +1.84 · +0.32%`). The bundle
              carries no prior close, signed change or instrument name (`market_state` has
              `price`/`gex_spot` only, checked against the saved real bundle) — the design's
              `+1.84 · +0.32%` and `SPDR S&P 500 ETF` are OMITTED here, not faked and not rendered as
              `—` (F3 — filed as an API follow-up in this folder's `RESUME.md`). The "levels @ ·
              expirations" parenthetical moves to the second line below, matching the design. Mono
              figure; last-trade is DISPLAY-ONLY and NEVER feeds this anchor (`live-spot=NBBO-mid`). */}
          <Typography variant="h1" sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.12 }}>
            <Box
              component="span"
              sx={[{ fontVariantNumeric: 'tabular-nums' }, flashColorSx(priceFlash)]}
            >
              {m.ticker} · ${(numbersActive && live ? live.mid : m.price)?.toFixed(2)}
            </Box>
          </Typography>

          {/* Second line (design: `Levels @ · Structure as-of · refreshes · All expirations`,
              `desk.mjs:269-271`) — levels anchor, the relocated REST-bundle freshness (STRUCTURE,
              spine #4, never the live stream), the documented ~60s bundle poll
              (`useTickerBundle.ts`'s `TICKER_BUNDLE_POLL_MS`, not invented), then the expirations
              count that used to live in the headline's parenthetical. */}
          <Stack
            direction="row"
            data-testid="deck-meta"
            sx={{ alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25 }}
          >
            {m.gex_spot != null && (
              <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                Levels @ ${m.gex_spot.toFixed(2)}
              </Typography>
            )}
            {freshness && (
              <>
                {m.gex_spot != null && <MetaDot />}
                <FreshnessLine
                  snapshotIso={freshness.snapshotIso}
                  dataAgeSeconds={freshness.dataAgeSeconds}
                  refreshing={freshness.refreshing}
                  inline
                />
                <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                  · refreshes ~{Math.round(TICKER_BUNDLE_POLL_MS / 1000)}s
                </Typography>
              </>
            )}
            <MetaDot />
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
              {selected === null
                ? 'All expirations'
                : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`}
            </Typography>
          </Stack>

          {/* index-first-defaults AC-4 — the single-name honesty caption, on the freshness/context
              line of the deck. Muted secondary-text token ONLY (both themes via the palette) — no
              warn/red semantics, no icon, never blocking. Absent for universe members AND while the
              universe is unknown (AC-5 — absence IS the degraded state). */}
          {singleNameCaveat && (
            <Typography
              variant="caption"
              data-testid="single-name-caveat"
              sx={{ color: 'text.secondary' }}
            >
              {SINGLE_NAME_CAVEAT}
            </Typography>
          )}
        </Stack>

        {/* Persistent trade CTA (right-aligned) — primary action kept in the header, out of the
            analysis flow. Opens the shipped simulated-trade entry dialog. */}
        {onOpenTrade && (
          <Stack
            sx={{
              flexShrink: 0,
              // `flex-end` (not `stretch`): without it the notice's width would drag the CTA out
              // into a full-width bar across the header — amber is spent exactly once on this page
              // and a 800px slab of it is not that one spend.
              alignItems: { xs: 'flex-start', sm: 'flex-end' },
              alignSelf: { xs: 'flex-start', sm: 'auto' },
              maxWidth: 460,
            }}
          >
            {storeFaulted && <TickerFaultedNotice />}
            {!tradeAllowed ? (
              <Box sx={{ mt: 0.5, maxWidth: 360 }}>
                <Refused
                  actionLabel="+ Open simulated trade"
                  reason="Sign in to open a paper position. No real order is ever sent."
                  onSignIn={onSignIn}
                  testId="open-sim-trade-refused"
                />
              </Box>
            ) : (
              <FaultedRefused when={storeFaulted}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={onOpenTrade}
                  data-testid="open-sim-trade"
                  // At xs the CTA sits under the anchor on its own row (left-aligned, intrinsic width)
                  // so its nowrap label can never force the viewport wider. Still THE one entry point
                  // to the shared TradeEntryDialog (`[single-shared-sim-entry-dialog]`).
                  sx={{ flexShrink: 0, whiteSpace: 'nowrap', mt: 0.5 }}
                >
                  + Open simulated trade
                </Button>
              </FaultedRefused>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default TickerHeader;
