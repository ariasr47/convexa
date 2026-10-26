/**
 * TickerHeader — the headline ANCHOR block: the symbol as the page's h1, the price as a Mono figure
 * (NBBO mid when live, else the bundle's static price) with its day change and the structure verdict
 * beside it, then the connection chip with the display-only **last-trade** readout, and the
 * levels/expiration sub-line. The ticker's tabs head the right region (lane 4 hierarchy pass, board
 * design/src/screens/final/ticker-desk.mjs).
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
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { flashColorSx, useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { Refused } from '@/shared/ui/Refused';
import { coarseFloor } from '@/shared/ui/touch';
import { dayChange, type LiveUpdate, type MarketState, type Signals } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { ConnectionChip } from '../../connection/ConnectionChip';
import { connectionStateFor } from '../../connection/connectionState';
import { useLiveTape } from '../../liveTapeStore';
import { sessionTapeOf, type SessionTapeOccupancy } from '../../sessionTapeStanding';
import { TICKER_BUNDLE_POLL_MS } from '../../useTickerBundle';
import { SampleSourceChip } from '../_kit/SampleSourceChip';
import {
  LAST_TRADE_NO_TAPE_PRINT,
  LAST_TRADE_REPLAY_TOOLTIP,
  LAST_TRADE_TOOLTIP,
  SINGLE_NAME_CAVEAT,
} from '../_kit/copy';
import { levelSpot } from '../_kit/distanceToLevel';
import { DESK_IS_SAMPLE, sampleQuoteSource, scenarioAsOf } from '../_kit/sample';
import { FreshnessLine } from './FreshnessLine';
import { useSamplePriorClose } from './useSamplePriorClose';

const REGIME_TIP =
  'Long gamma (+γ): dealer hedging dampens moves → range-bound, fade extremes. Short gamma (−γ): ' +
  "dealer hedging amplifies moves → trending, don't fade.";

/** A dim `·` divider between second-line meta items (design: `desk.mjs`'s `<span class="dim">·`). */
function MetaDot() {
  return (
    <Typography component="span" variant="body2" aria-hidden sx={{ color: 'text.disabled' }}>
      ·
    </Typography>
  );
}

/** The day's change as text: ▲/▼ and +/− carry the sign (P-11), the caller adds the hue (P-5). */
export function signedChange(c: {
  change: number;
  pct: number;
  direction: 'up' | 'down' | 'flat';
}) {
  if (c.direction === 'flat') return 'unch 0.00 (0.00%)';
  const sign = c.direction === 'up' ? '+' : '−';
  const arrow = c.direction === 'up' ? '▲' : '▼';
  return `${arrow} ${sign}${Math.abs(c.change).toFixed(2)} (${sign}${Math.abs(c.pct).toFixed(2)}%)`;
}

/**
 * The structure verdict for the masthead chip, in words with its sign (P-11: "+γ long gamma", never a
 * green chip alone). The flip is named only when the price sits on the side the regime implies, so
 * the chip never pairs two facts that disagree; the hero title states the distance either way.
 */
export function regimeVerdict(
  regime: string | null,
  spot: number | null,
  flip: number | null | undefined,
): string | null {
  if (regime !== 'positive_gamma' && regime !== 'negative_gamma') return null;
  const positive = regime === 'positive_gamma';
  const words = positive ? '+γ long gamma' : '−γ short gamma';
  if (spot == null || flip == null || !Number.isFinite(flip) || flip <= 0) return words;
  if (positive && spot >= flip) return `${words} above ${flip.toFixed(2)}`;
  if (!positive && spot < flip) return `${words} below ${flip.toFixed(2)}`;
  return words;
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
  // P-3: sample data never flashes.
  const ltActive = numbersActive && !streamOffline && !DESK_IS_SAMPLE;
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

  // The demo's last trade is the scenario replay's: no live dot, no pause mark, no flash (P-3).
  if (DESK_IS_SAMPLE) {
    return (
      <Typography
        component="span"
        variant="body2"
        sx={{ color: 'text.secondary' }}
        data-testid="last-trade"
      >
        {lt != null ? `Sample last trade $${lt.toFixed(2)}` : 'Sample last trade —'}
      </Typography>
    );
  }

  if (st) {
    const tip = LAST_TRADE_REPLAY_TOOLTIP;
    const dim = streamOffline;
    if (lt == null) {
      return (
        <Tooltip arrow title={tip}>
          <Typography
            component="span"
            variant="body2"
            // PR #46 CI repair, §A — a SOLID dim token replaces `opacity` on text (never opacity: it
            // composites with whatever sits behind it and cannot carry a contrast guarantee).
            sx={(t) => ({ color: dim ? extrasFor(t).textDim : t.palette.text.secondary })}
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
          sx={[
            (t) => ({ color: dim ? extrasFor(t).textDim : t.palette.text.secondary }),
            flashColorSx(ltFlash),
          ]}
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
          // PR #46 CI repair, §A — solid `textDim`, never opacity (see the `st` branch above).
          sx={(t) => ({ color: extrasFor(t).textDim })}
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
  /**
   * PASS 2 change 9 — at ≥ laptop (1100, `CommandDeck.tsx`'s `controlsJoinHeadline`) the toolbar's
   * fields join this headline row's right region, ahead of the CTA (design: `desk.mjs:255-274`'s
   * `.mast-controls`, fields then the one amber button). `null`/unset below 1100 — the caller
   * (`CommandDeck`) decides placement; this component only reserves the slot, beside its own CTA.
   */
  inlineControls?: ReactNode;
  /** The ticker's Overview · Technical · Research tabs, at the top of the right region (lane 4:
   *  the board puts them in the masthead, not above it). */
  tabs?: ReactNode;
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
  inlineControls = null,
  tabs = null,
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
  // P-3: no flash on sample data.
  const priceFlash = useFlashOnChange(numbersActive && live ? live.mid : null, {
    active: numbersActive && !streamOffline && !DESK_IS_SAMPLE,
  });

  // The day's change (site check D-22): the demo's authored prior close against the price the anchor
  // shows; a live build has no prior close on the wire, so nothing renders there, never a fake 0.
  const anchorPrice = numbersActive && live ? live.mid : m.price;
  const priorClose = useSamplePriorClose(m.ticker);
  const change = dayChange(anchorPrice, priorClose);
  const verdict = regimeVerdict(sig?.regime ?? null, levelSpot(m), m.gamma_flip);

  return (
    <Box>
      {/* Stage 0 item 1 (the measured 580px offender): the hero row STACKS vertically below `sm` —
          the anchor first, then the tabs and the CTA on their own rows. Nothing is removed. The
          stacked gap is the board's `.tk-mast` row gap, 14px (fidelity DESK-06). */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.75, sm: 2 }}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'flex-start' } }}
      >
        <Stack spacing={1} sx={{ minWidth: 0, flex: '1 1 auto' }}>
          {/* The first read (lane 4 hierarchy pass; board ticker-desk.mjs deskStagingBody): the
              symbol as the page's one heading, then the price as a Mono figure with its day change
              and the structure verdict beside it. A stat value is never a heading element (canon,
              Banned), so the price is its own line under the h1. Mid when live, else the bundle's
              price; last trade is display-only and never feeds this anchor (`live-spot=NBBO-mid`). */}
          <Typography
            variant="h1"
            data-testid="deck-symbol"
            sx={{
              fontFamily: typographyTokens.displayFontFamily,
              fontStretch: typographyTokens.displayFontStretch,
              fontSize: { xs: 30, sm: 36 },
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {m.ticker}
          </Typography>
          <Stack
            direction="row"
            sx={{ alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.75, rowGap: 0.75 }}
          >
            <Box
              component="p"
              data-testid="deck-price"
              sx={[
                {
                  m: 0,
                  fontFamily: typographyTokens.monoFontFamily,
                  // The phone takes the board's `.tk-px .p` floor, 26px on a 1.0 line (fidelity
                  // DESK-06: 28px on 1.05 made the price row 5px taller than the board's at 390).
                  fontSize: { xs: 26, sm: 32 },
                  fontWeight: 500,
                  lineHeight: { xs: 1, sm: 1.05 },
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                },
                flashColorSx(priceFlash),
              ]}
            >
              {anchorPrice != null ? `$${anchorPrice.toFixed(2)}` : '—'}
            </Box>
            {change && (
              <Box
                component="span"
                data-testid="deck-change"
                sx={(t) => ({
                  fontFamily: typographyTokens.monoFontFamily,
                  fontSize: 14,
                  fontWeight: 500,
                  // The board's `.tk-px .c` sets `font`, so its line height is `normal`; the body's
                  // 1.65 hung 2.5px below the price row on the phone (fidelity DESK-06).
                  lineHeight: { xs: 'normal', sm: 'inherit' },
                  whiteSpace: 'nowrap',
                  // P-5: a price change stays green/red as TEXT (textUp/textDown); P-11: the sign
                  // also rides on ▲/▼ and +/−, never on hue alone.
                  color:
                    change.direction === 'up'
                      ? extrasFor(t).textUp
                      : change.direction === 'down'
                        ? extrasFor(t).textDown
                        : t.palette.text.secondary,
                })}
              >
                {signedChange(change)}
              </Box>
            )}
            {verdict && (
              // `describeChild`: the tip describes the chip; the visible verdict stays its name.
              <Tooltip arrow describeChild title={REGIME_TIP}>
                <Box
                  component="span"
                  data-testid="deck-verdict"
                  tabIndex={0}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    alignSelf: 'center',
                    minHeight: 24,
                    px: 1,
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: 'text.secondary',
                    color: 'text.primary',
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    // Coarse pointer: a 44px hit area from a pseudo-element, 10px above and below
                    // the 24px chip. It takes no space, so the chip and its row keep their size;
                    // a 44px box in the flow grew the wrapped row from 62 to 82px (spec
                    // 2026-10-21/02, part (b), the verdict chip's mechanism).
                    // `zIndex: 1`: the row under the chip starts 8px below it and paints later, so
                    // without it a tap 9-10px below the chip landed on that row's text.
                    '@media (pointer: coarse)': {
                      position: 'relative',
                      zIndex: 1,
                      // -11: the offsets run from the padding edge, inside the 1px border, so
                      // this is 10px past the chip's outer edge.
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -11,
                        bottom: -11,
                        left: 0,
                        right: 0,
                      },
                    },
                  }}
                >
                  {verdict}
                </Box>
              </Tooltip>
            )}
          </Stack>

          {/* Provenance and the tape: the one connection chip (P-1/P-3: the demo gives its slot to
              "Demo · sample data", its tape being a scenario replay) and the display-only last
              trade. The chip slot is UNCONDITIONAL (ruling 1 / AC-9): before the first stream fact
              it renders the wordless placeholder, never nothing. */}
          {/* `useFlexGap`: a wrapped chip starts at the column edge, not 8px in (the margin
              spacing indented the second line and squeezed the source chip onto two lines at 390).
              Gaps are the board's `.tk-chips`, 6px between wrapped lines. */}
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}
          >
            {DESK_IS_SAMPLE ? (
              <DataStateTag state="demo" />
            ) : (
              <ConnectionChip
                state={connState}
                live={live}
                routeSymbol={m.ticker}
                reduced={reduced}
              />
            )}
            {/* P-8: the demo's quote is sample data, so the masthead names what it is shaped like. */}
            {DESK_IS_SAMPLE && (
              <SampleSourceChip text={sampleQuoteSource(m.ticker, scenarioAsOf())} />
            )}
            <LastTradeReadout
              live={live}
              streamOffline={streamOffline}
              displayActive={numbersActive}
            />
          </Stack>

          {/* Second line (design: `Levels @ · Structure as-of · refreshes · All expirations`) —
              levels anchor, the REST-bundle freshness (STRUCTURE, spine #4, never the live stream),
              the documented ~60s bundle poll, then the expirations count. In the board's `.dline`
              type, 12px on 1.45, with no gap between wrapped lines (fidelity DESK-06: 13px body and
              the 12px caption's 1.66 made this line 5.7px taller than the board's at 390). The
              selector reaches FreshnessLine's caption too, at (0,2,0) over its own class. */}
          <Stack
            direction="row"
            data-testid="deck-meta"
            sx={{
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: 1,
              rowGap: 0,
              '& .MuiTypography-root': { fontSize: 12, lineHeight: 1.45 },
            }}
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
                {/* The demo's structure is a fixed scenario: nothing refreshes it. */}
                {!DESK_IS_SAMPLE && (
                  <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                    · refreshes ~{Math.round(TICKER_BUNDLE_POLL_MS / 1000)}s
                  </Typography>
                )}
              </>
            )}
            <MetaDot />
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
              {selected === null
                ? 'All expirations'
                : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`}
            </Typography>
          </Stack>

          {/* index-first-defaults AC-4 — the single-name honesty caption, muted, never warn/red;
              absent for universe members and while the universe is unknown (AC-5). */}
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

        {/* Right region — the ticker's tabs on top (board: the masthead's right column), then at
            ≥ laptop (1100) the toolbar's fields and the one amber action. From `laptop`, where the
            chips join this column, it does not shrink (the board's `.act` keeps its 600px basis):
            shrunk to 551px at 1280 it dropped the CTA under the chips, so the anchor column on the
            left gives up the width instead (fidelity DESK-05). Up to 600px, as before. Below
            `laptop` it holds only the tabs and the CTA and shrinks as it always has. */}
        {(tabs || inlineControls || onOpenTrade) && (
          <Stack
            spacing={1.25}
            sx={{
              alignItems: { xs: 'stretch', sm: 'flex-end' },
              flex: { xs: '0 1 auto', laptop: '0 0 auto' },
              maxWidth: { sm: 600 },
              minWidth: 0,
            }}
          >
            {tabs}
            {(inlineControls || onOpenTrade) && (
              // One row: the `.tk-sel` chips, then the CTA (board `.tk-ctl`, gaps 10px 12px;
              // fidelity DESK-05). `useFlexGap`, so a wrapped row carries no stray margin.
              <Stack
                direction="row"
                useFlexGap
                sx={{
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                  columnGap: 1.5,
                  rowGap: 1.25,
                }}
              >
                {inlineControls}

                {/* Persistent trade CTA — the page's one primary action. Opens the shipped
                    simulated-trade entry dialog. */}
                {onOpenTrade && (
                  <Stack
                    sx={{
                      flexShrink: 0,
                      // A phone gives the one amber action the column at 44px, as the board's phone
                      // masthead does (`.tk-mast .act .btn { width: 100%; min-height: 44px }`,
                      // fidelity DESK-06). From `sm` it keeps its own width, `flex-end`: an 800px
                      // slab of amber on a wide screen is not the page's one spend.
                      alignItems: { xs: 'stretch', sm: 'flex-end' },
                      alignSelf: { xs: 'stretch', sm: 'auto' },
                      flexBasis: { xs: '100%', sm: 'auto' },
                      maxWidth: { xs: 'none', sm: 460 },
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
                          // 36 at a fine pointer from 600px; 44 under a coarse one at any width
                          // (a coarse tablet too), last in the array so it follows the 36.
                          sx={[
                            {
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                              minHeight: { xs: 44, sm: 36 },
                              width: { xs: '100%', sm: 'auto' },
                            },
                            coarseFloor,
                          ]}
                        >
                          + Open simulated trade
                        </Button>
                      </FaultedRefused>
                    )}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default TickerHeader;
