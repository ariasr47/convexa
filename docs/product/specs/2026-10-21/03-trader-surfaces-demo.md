# Desk, Scanner and Positions on the demo: every click lands, the sample has spread, Sample said once

_Proposal, 2026-10-21; revised 2026-10-22 after the skeptic review. Kind: ux-polish. Size: XL (four commits; (c) can split into its own spec, see Build plan). Depends on: demo-first-screen (spec 1), a11y-touch-floor (spec 2)._

Code citations are against `main@8ef735c4` (2026-10-22). Every cited file is byte-identical to the audits' `791ebd88` except `shell/AppShell.tsx`, which moved by one line (`2cb4c8ef` added an import). Staging measurements are from 2026-10-22, taken with the scratch probes in `tmp/ux-audit/spec-trader-surfaces-demo/` (`desk.mjs`, `click.mjs`, `scanpos.mjs`, `scangeo.mjs`, `posgeo.mjs`, `toolbar.mjs`, `census.mjs`, `census2.mjs`, `seedmath.mjs`; output in `desk.json`, `scanpos.json`) and the skeptic's `tmp/ux-audit/review-trader-surfaces-demo/check3.mjs`. None of them signs in or submits anything. `click.mjs` gives a different result each run (TD-01). `tmp/` is gitignored, so none of this evidence is committed.

## Why

The desk, the Scanner and Positions are the demo's working surfaces. A reviewer who arrives from a production wall's "See it on the demo →" link lands on one of them. Three problems meet that reviewer first. Clicks get lost. The sample has no spread, so filters return nothing. And the page says "Sample" and "SIMULATED" in so many forms that the repetition reads as noise rather than honesty.

**Clicks are lost, intermittently (TD-01).** On a fresh `/ticker/SPY` at 1440x900, a mouse press on Sim orders "Details" or "Cancel order" sometimes does nothing. `click.mjs` loads a fresh page for each press and presses with 0, 16, 50 and 150 ms between mousedown and mouseup. The results change from run to run:

| Run (2026-10-22, each exit 0) | Details opened its dialog | Cancel order armed |
| ----------------------------- | ------------------------- | ------------------ |
| Spec run | 1 of 4 (150 ms only) | 1 of 4 |
| Skeptic rerun | 3 of 4 (0, 50, 150 ms) | 2 of 4 (50, 150 ms) |
| Revision rerun | 4 of 4 | 2 of 4 (16, 150 ms) |

The layout shift itself is deterministic. In every press of every run the title h2 grew to 40px and the button's top moved from y=439 to y=451. Keyboard Enter works (`tmp/ux-audit/ticker-desk/details2.mjs`).
- Cause: focus moves to the button on mousedown, and `onFocus` selects the widget (`shared/ui/Widget/Widget.tsx:424`; `onClick` at `:423` fires too late to matter). Selection mounts the selected-only "Configure — coming soon" kebab (`:384-399`). The actions region gets wider, the title "Sim orders · SPY" wraps to two lines, and the row drops 12px. The press point (y=450) ends up 1px above the moved button (top 451). Whether a click still fires then depends on sub-pixel layout, which is why the runs disagree.
- Selection also shows a "Rearrange (coming soon)" grip with `cursor: grab` (`:260-282`) and owns a menu that can never open (`:402-405`). The Widget's own header comment promises these are never fake-functional (`:7-9`). Canon rule 20 says every affordance needs a working tap or focus path. These have none.

**The demo says things that aren't true (TD-08, TD-09, TD-14, SPL-04).**
- A working sim order reads "Waiting for live data — not currently evaluated" in `warning.main` (rgb(224,122,63)) with no icon, on the desk and on `/positions` (`desk.json` `tz_*.evalCell`). Rule 5 requires the icon. The cause: `NotEvaluated` goes quiet only when `marketDataOff()` is true (`features/trading/orders/OrderRow.tsx:182-205`). The demo's market-data mode is `unknown`, because demo builds never call `/api/health` (`libs/api/src/lib/convexa.ts:1200-1201`). So it is not `sample`, as the input claimed, and the demo takes the warning arm.
- The panel subtitle says "Rec-driven entries watched against live data" (`orders/copy.ts:107-108`) on a build whose banner says "no market feed connected". It says the same on production, where the feed is also off.
- Order times print in the viewer's zone with no label (`OrderRow.tsx:67`, `OrderDetailDialog.tsx:77`, `new Date(iso).toLocaleString()`). The same order reads "triggered 10/7/2026, 2:30:00 PM" in New York, "11:30:00 AM" in Los Angeles and "8:30:00 PM" in Berlin. Meanwhile the masthead says "Scenario · Oct 7, 2026 · 2:30 PM ET" in all three (`desk.json`).
- The straddle basis line prints an internal token: "% of the gex_spot spot $690.62" (`desk.json` `straddleBasis`). The copy helper renders `anchorLabel` verbatim (`pages/ticker/widgets/straddle-move/copy.ts:8-18`). The demo sends `gex_spot` (`libs/api/src/lib/demo/transport.ts:1101`). Production sends `levels-anchor`, the engine's `ANCHOR_LABEL` (`libs/quant-engine/src/straddle_move.rs:71`); `apps/api/src/services/recommendation.rs:1213` is only a test fixture (`mod tests` at `:974`).
- Max pain equals spot to the cent (`transport.ts:510`, `:922`, `max_pain: spot`). A max pain level is a strike. The ladder reads "Max pain $690.62" and the field label rounds it to "max pain 691" (`shared/charts/structure-field/paintStep.ts:488`, `toFixed(0)`). So the panel shows an impossible value, and two different numbers for it.

**The sample has no spread (SPL-02).** All six Scanner rows are Pos γ and Neutral. Flip distance is +0.96 to +0.97% and the nearer wall −1.91 to −1.94% (`scanpos.json` `scannerDesktop.rows`). The chips "IV cheap" and "IV rich" return 0 rows, and "|Flip| ≤1%" keeps all 6 (`tmp/ux-audit/scanner-positions-lab/interact.json`).
- Cause: the scan rows hardcode `regime: 'positive_gamma'` and `vol_regime: 'neutral'` (`transport.ts:1457`, `:1460`), and derive every put wall the same way (`:1443`). The generator places every flip at spot − 1% of base and every call wall at spot + 2% of base (`libs/api/src/lib/demo/catalog/shared.ts:236-237`).
- The same constants appear twice more: in the desk bundle (`transport.ts:1123`, `:1125`) and in structure history. The history hardcodes `regime` and `vol_regime` (`:1496-1497`), `net_gex: 20_000_000`, `iv_hv_ratio: 1.13`, `atm_iv: 26` and `hv_30d: 23` (`:1503-1507`), and derives each sample's put wall from that bar's close (`:1501`). The input named only the scan rows. Fixing only those would make the Scanner, the desk and the history disagree.
- The demo already disagrees with itself. The desk's IV/HV is `atmIv / 23` (`transport.ts:772`, `:946-947`). That gives 1.10 for SPY, 1.15 for QQQ, 1.18 for AAPL, 1.23 for MSFT, 1.05 for NVDA and 1.10 for TSLA (1.1017, `seedmath.mjs`). The engine calls ≥ 1.10 "IV rich" (`libs/quant-engine/src/signals.rs:15`, `:243-251`), so five desks show a rich IV/HV beside a Scanner that says Neutral.
- The "why this score" line shows parts the engine can't produce. NVDA's card says "IV vs HV stretch (+46) · near wall/flip (+18)" (`scanpos.json` `scannerPhone.cardText`). The engine caps the vol part at 25 and computes it as |IV/HV − 1| × 50 (`signals.rs:487`). The demo sets `vol = score − 35` (`transport.ts:465-467`).

**Positions is thin and buried (SPL-09, SPL-13).**
- The seed holds one open position (SPY) and one closed one (QQQ) (`libs/api/src/lib/demo/workspace.ts:230-277`).
- Four of the five Track record families say "Nothing recorded yet for this cut", because the one closed trade predates capture ("Of your 1 counted outcome, 0 carry a recorded AI rec — 1 predate capture") (`scanpos.json`).
- The orders panel renders above the book (`features/trading/positions/PositionsPanel.tsx:123`, toolbar `:130`, book `:158`). The first position row starts at y=743 at 1440x900. At 390x844 the first card starts at y=1389, below 442px of orders panel and five rows of controls (`posgeo.mjs`, `toolbar.mjs`).
- The building string, a full sentence, renders in IBM Plex Mono (`features/trading/outcomes/TrackRecordSection.tsx:131-135`).

**Sample and SIMULATED are said too often (TD-13, TD-15, SPL-01, SPL-06, SPL-08, SPL-10).**
- At load the 1440 desk's main text contains "Sample" 14 times (`census.mjs`). The read strip carries both "Sample" and "Sample · shaped like the options chain". The AI read carries "Sample analysis · SPY", "Sample read" and "Sample analysis · authored for this scenario". The live tape has the title "Sample tape" and a "Sample" tag (`census2.mjs`).
- SIMULATED appears in three forms: a green-tinted chip in the trade dialog (background rgba(46,204,113,0.18), `TradeEntryDialogView.tsx:541-551`) and in the order detail (`OrderDetailDialog.tsx:113-122`); an outlined chip in Sim orders (`OrdersWidget.tsx:110-111`); and two caps labels on one card, "YOUR BOOK · SIMULATED" plus "SIMULATED" (`pages/ticker/widgets/position-brief/copy.ts:7`, `PositionBrief.tsx:305-320`). The AI read says "SIMULATED / advisory" (`ai-rec/copy.ts:87`).
- The masthead repeats "Demo · sample data" (`pages/ticker/widgets/chrome/TickerHeader.tsx:426-427`) directly under the shell's demo bar, which says the same with the scenario date (`shell/AppShell.tsx:148-193`).
- The AI read offers "View sample analysis" (`AiRecPanel.tsx:389-397`), which re-asks for the read already on screen. The demo asks automatically once per ticker and snapshot (`AiRecPanel.tsx:214-227`), so the button visibly does nothing. Its last ⓘ wraps onto its own line, 25px below its chip (`desk.json` `provChipLine`: chip top 1412, ⓘ top 1437).
- The trade dialog opens in Manual price with an empty price, so its primary button is disabled on arrival (`desk.json` `tradeDialog`). The default is set twice: at `TradeEntryDialogView.tsx:177` and again on every open at `:230`. Its footer says "Filled at the option mid" (`positions/labels.ts:298-300`) while the mode line says "opens at exactly the price you type".
- On `/scanner` at 390x844 the first card starts at y=880, below the fold (`scangeo.mjs`). Above it sit the demo bar (137px), a three-line subhead, the session strip, the "On this page · Demo · sample data" legend and its own sentence (96px; `pages/scanner/Scanner.tsx:351-386`), a density segment on a row of its own (48px), and the sample frame head.
- The subhead never names the product: "One dense read of the tracked universe…" (`pages/scanner/labels.ts:20-22`).
- At 1440 the session strip wraps under the subhead and floats at x 124–459, aligned with nothing (`scanpos.json`). Cause: `flexWrap` with `space-between` (`Scanner.tsx:256-262`) and `alignItems: 'flex-end'` inside the strip (`:280`).
- Phones get three controls that change nothing (SPL-06). The Scanner density segment (`ScanToolbar.tsx:276-290`) has no effect on cards. Positions shows Table/Cards with Table pressed while cards render (`PositionsView.tsx:147` forces cards below md). Comfortable/Compact only sets a `data-density` attribute on the cards (`PositionsView.tsx:404`), and no style reads it.
- Phone Scanner cards hide "why this score" from sighted users (`ScanCard.tsx:101-103`, `visuallyHidden`; the input cited `:96-98`).

### Where the inputs were wrong, and what this spec does instead

1. **"'Cancel order' opens its dialog."** It has no dialog. A first click arms an inline "Confirm cancel" button, and a second click cancels (`OrderRow.tsx:338-357`). The target becomes: a fast press arms it.
2. **"Select on pointerup."** That alone would not fix the bug, because `onFocus` fires on mousedown. This spec removes selection entirely (see Behaviour).
3. **"A demo order can never be evaluated" / "Sample · not evaluated".** That is false while the replay plays. On a page for the order's own ticker, the demo engine checks every working order against each sample frame (`features/trading/orders/useOrderEngine.ts:124-150`; `engine.ts:60-74`, `:160-162`). Frames run for 6 minutes of real time after load (`workspace.ts:26-27`, `:62-74`: 5 scenario seconds per second, 30 scenario minutes). So the row needs two demo states, "checked on the replay" and "not evaluated". A single "not evaluated" would be a new false claim.
4. **The ⓘ fix lives in `DecisionCard.tsx:132-175`** (the chip row), not in `AiRecPanel.tsx`.
5. **The census target.** "At least 30% fewer" means ≤ 9 of 14. The input's own changes reach 13. This spec's fuller set reaches 10 (−29%). Reaching 9 would mean removing either a per-card Sample tag that P-3/P-8 and the Final board draw (`design/src/screens/final/ticker-desk.mjs:194`, `:228-232`), or the hero's e2e-pinned "Sample tape · Mid" (`apps/dashboard-e2e/src/demo/demo-journey.spec.ts:274`). The target here is ≤ 10, plus a stricter rule. Every sample frame names the sample exactly once: in its head, or by a source chip anywhere in the frame (head, foot or a row). No row inside it carries a Sample tag. One part of the rule waits on D1 ((d), "One Sample mark per frame").
6. **"Render the read string in Plex Sans."** Only the building state changes. A counted cell's read states a hit rate Convexa computed, and Mono means "this figure is Convexa's" (rules 13, 23). The building read is the twin of the IV-rank floor, which already renders in Sans (`pages/ticker/widgets/iv-rank/IvRank.tsx:242-250`). Each state stays one builder, one string and one `Typography`, so AC-E3 holds.
7. **"The first Positions row is above the 900 fold (baseline 743)."** It already is. The useful target is ≤ 520px with the book first. The orders panel is 234px tall at 1440 (`posgeo.mjs`).

## Who and when

- **A recruiter or reviewer on staging**, ten seconds after a production wall's "See it on the demo →" link. They click Details on an order, and it opens. They tap "IV cheap", and a row comes back. They read "See ranked dealer-gamma setups…" and know what the product is for. The page says it is a demo in one place (open question 2), and every claim on it is true of the demo.
- **The owner on production, signed in.** The desk's widgets stop growing dead controls on click. Order times read in ET like the rest of the desk. The orders panel stops claiming it watches live data. The trade dialog keeps opening in Manual price, because the feed is off. Everything else production shows is unchanged.

## Scope and non-goals

**In scope.** Staging `/ticker/:symbol` (desk widgets, the simulated trade dialog, the AI read panel, Sim orders), `/scanner`, `/positions`, the demo seeds in `libs/api/src/lib/demo`, and the shared pieces those routes draw: `Widget`, `OrderRow`, `OrderDetailDialog`, the trade dialog footer, the straddle basis line and the structure field's max pain label.

The landing's SIMULATED chip (`pages/landing/AiReadSample.tsx:76-81`) is **out of scope**. It is already the neutral outlined chip with no tint: `<Chip label="SIMULATED" size="small" variant="outlined" sx={{ fontSize: 11, height: 20, … }} />`. Nothing needs to change there. This spec leaves it alone, so neither spec changes it (spec 2, Scope and non-goals › "The other SIMULATED chips", says the same).

**Non-goals.**
- The desk hierarchy. It stays as the owner approved it on 2026-10-16 (ruling 1). No panel moves on the desk.
- Production walls on `/scanner` and `/positions`, the sign-in flow, demo mode on production, and any FINRA or licensed-data path.
- The AppShell demo bar's phone layout and its wording. That is spec 1. This spec's phone targets and two scenario strings say where they depend on it.
- Drag-to-rearrange and per-widget configure. Removing the placeholders does not schedule the features.
- Making the six authored scores reproducible by the engine's formula. SPY's 74 is out of reach of the engine's caps at its ruled levels: proximity 27, vol 5, setups 25, transition 10 and dark pool 6 add up to 73 (`signals.rs:23-24`, `:478-490`). Scores stay authored. The gap between a score and its engine-valued parts is shown as its own part ((c), "Why this score").
- The field's call and put wall labels, which round to whole dollars (`paintStep.ts:266`) while the ladder shows cents. The ruled SPY walls are not strikes, so that mismatch needs its own decision.
- Merging the new sample positions into returning visitors' books (open question 3).
- An authored trade read. Every demo read stays no-trade, so the Track record's AI rec family stays empty on the demo ((c), "Track record").

## Behaviour

### (a) Every click lands

**Widget selection is removed.**
- Delete the drag grip (`Widget.tsx:260-282`), the selected-only kebab (`:384-399`) and the unreachable menu (`:402-405`).
- Delete the selection plumbing: the `useWidgetSelection` read (`:208`), `onSelect` (`:409-411`), `aria-current`, `onClick` and `onFocus` (`:421-424`), the selected conic ring (`:494-513`), and the click-outside clear: the `{selected && <ClearOnOutside …/>}` mount (`:611`), `ClearOnOutside` and `useOutsideClear` (`:616-645`).
- Delete `WidgetSelectionContext.tsx` and its provider in `TickerDashboard.tsx` (`:71`, `:1023`, `:1286`).
- Rewrite the header comment (`Widget.tsx:1-27`) to say the widget has no placeholder controls.
- The frame keeps `tabIndex={0}`, its authored `:focus-visible` ring (`:457-460`) and the hover/focus-revealed expand button.
- Why remove instead of selecting on pointerup: selection has no consumer left once the dead controls go. The widget is "presentation-only: selection drives NO data path" (`WidgetSelectionContext.tsx:7-8`). A pointerup handler would keep a state that changes nothing visible except a ring.
- Result: clicking or focusing a widget changes no layout, on both sites.

**AI read (demo branch).**
- The re-request button renders only when no read is on screen and nothing else offers recovery: no sample read, not loading, no request failure (that has its own "Retry demo" at `AiRecPanel.tsx:318-345`), and not `unavailable` (`:346-359`). In practice that means after Dismiss.
- Its label is "Show the sample read again". It stays a quiet text button (owner ruling A, 2026-10-15).
- On load the panel offers "View sample export →", "Full analysis & data" and "Dismiss".
- In the provenance row (`DecisionCard.tsx:132-175`), each chip and its ⓘ sit in one `inline-flex`, `whiteSpace: nowrap`, `alignItems: center` wrapper, so they wrap as a pair and share a centre line. This covers the scripted, persona, as-of, simulated, subscription and own-key pairs. Production uses the same row.

**Trade dialog.**
- The initial and on-open fill mode becomes `market` (`TradeEntryDialogView.tsx:177`, `:230`). `effectiveMode` already forces Manual when the feed is off or the entry is not a single option leg (`:305`). So production with the feed off still opens in Manual price, and the manual-contract entry is unchanged.
- A lookup that yields no fill leaves Market selected. The mode never changes by itself.
  - `no_resolvable` covers both a contract that is not in the snapshot and a contract that came back with no mid and no theoretical mark (`:272-283`). It shows the shipped refusal: "No quote or theoretical mark available for this contract — a market order can't fill. Try Manual price, or pick another contract." (`:1028-1033`).
  - `error` shows the shipped "Couldn't load the chain for entry — try again." (`:996-999`).
  - In both cases "Open simulated position" stays disabled until the trader picks another contract or chooses Manual price.
  - Why not drop to Manual automatically: the refusal renders only while `effectiveMode === 'market'` (`:1028`). And for a contract that resolved without a fill, `contractStatsFailed` stays false (`:272-283`), so Manual would show no reason at all. An automatic drop would change how the trade is priced and say nothing. The refusal names the reason and the next step, and the switch stays the trader's own click.
  - Neither site can reach this state today. Production forces Manual while the feed is off, and the demo chain always resolves. It goes live as soon as a feed returns, so AC32 checks it on a local build.
- On the demo the chain always resolves, so the primary action is enabled as soon as the fill preview lands.
- The footer sentence becomes mode-aware (Copy).
- Phone width: unchanged layout (full-screen sheet below sm, `:176`).

### (b) The demo tells the truth about itself

**Order evaluation state.**
- `deriveEval` (`useOrders.ts:351-362`) gains two demo kinds, keyed off `dataMode === 'demo'`, not the market-data mode:
  - `sample_checked`: the order's ticker is the surface's covered ticker, and demo playback is `running`.
  - `sample_idle`: otherwise. That covers another ticker's order, a replay that has ended, or a paused replay.
- **Playback is a subscription, not a read.** `canSimulatePaperAction()` (`workspace.ts:198-200`) is a plain getter, and `deriveEval` runs at render, so nothing would repaint the row when playback ends. `OrdersWidget` and `OrdersPanel` each hold the demo clock in state through `subscribeDemoClock` (`workspace.ts:165`, seeded from `demoClock()`, `:162`), the way `AppShell.tsx:47-52` does. Each passes `playback === 'running'` in `LiveCoverage`. On a live build neither subscribes (`dataMode !== 'demo'`, as `AppShell.tsx:49`).
- `OrderRow` renders each demo kind as one line of **plain text** in `text.secondary`, followed by an `AccessibleHelp` ⓘ that carries the detail (Copy). It has no chip and no "Sample" word, because rows inside a frame carry no Sample tag under either draft ((d), "One Sample mark per frame"). The frame's own mark is its Sample tag under this spec's draft (D1); none under spec 1's. It also has no warning colour, no pulse (rule 22) and no "Waiting for live data" sentence.
- **Sim orders keeps its frame-level Sample tag**, with its dashed border and hatch, unless D1 takes spec 1's draft ((d), "One Sample mark per frame"). The tag is what marks the frame whenever no working row shows:
  - on NVDA, QQQ, AAPL, MSFT and TSLA at load, because both seeded orders are SPY (`workspace.ts:480-530`);
  - after the SPY order is cancelled or fills;
  - whenever only completed rows show, because terminal rows render no eval cell (`OrderRow.tsx:110-111`).
  - The Final board draws this tag too (`ticker-desk.mjs:203`).
- Production keeps the feed-off arm (`DataStateTag notLive` "Not evaluated" + text, `OrderRow.tsx:198-200`) unchanged.
- Any arm that keeps `warning.main` gets the warning icon: the live-build offline arm (`:159-161`), the live-build uncovered arm (`:199`) and the armed "Confirm cancel" button (`:342`). The icon is `WarningAmberOutlined` at 16px, the glyph `DataStateTag` uses.
- The offline arm's distance line swaps `opacity: 0.5` (`:167`) for `extrasFor(theme).textDim` (Amendments 2026-09-09). The pause mark stays.
- The orders panel subtitle (`OrdersPanel.tsx:105-107`) is chosen from three strings: demo, feed off and live (Copy).
- The Sim orders empty state on the demo says what the demo can do (Copy). No visitor can create a sim order on the demo. Every demo AI read is a no-trade read: `decision: 'no_trade'` (`libs/api/src/lib/demo/transport.ts:711`) is the only decision the demo returns. And "Create sim order" renders only for a fresh trade read (`pages/ticker/widgets/ai-rec/presentationPolicy.ts:185`). So the shipped "Act on an AI read to create one" would be a false instruction.
- The panel's `PANEL_EMPTY_OPEN` (`orders/copy.ts:113-114`) is unreachable on the demo. The seed carries a filled SPY order, so an emptied Open tab shows `PANEL_EMPTY_OPEN_WITH_HISTORY` instead. It is unchanged.

**Order timestamps.**
- The ET formatter moves out of the ticker page. `scenarioClock` and its `Intl.DateTimeFormat`s move from `pages/ticker/widgets/_kit/sample.ts:25-48` to `shared/lib/etClock.ts`, and `_kit/sample.ts` re-exports `scenarioClock` so its callers don't change. `features/trading/orders` imports from `shared/`, never from `pages/`.
- The formatter pins `America/New_York`, so the text is the same in every viewer zone. This applies on both sites.
- On the row (`OrderRow.tsx:66-80`) a time reads "Oct 7, 2:30 PM ET" when it falls in the app clock's current year (`appNowMs()`, `workspace.ts:195`). Otherwise it carries the year: "Oct 7, 2025, 2:30 PM ET". Older orders and good-til dates in another year therefore stay unambiguous on production. On the demo the app clock is the scenario's, so demo orders read without a year.
- In the detail dialog (`OrderDetailDialog.tsx:77`) every lifecycle time carries the year: "Oct 7, 2026, 2:30 PM ET".

**Straddle basis line.**
- `basisLine` (`straddle-move/copy.ts:10-19`) maps `anchor_label` through a closed lookup: `gex_spot` and `levels-anchor` both become "the levels anchor".
- An unknown token renders no label ("% of $690.62"), never the raw token.
- The doubled "spot" goes, and a missing anchor still reads "—".
- The comment's "render VERBATIM" rule (`:8-9`) is superseded and the comment says so.

### (c) The sample has spread (demo seeds only; nothing fetched)

**Seeds.** Each `catalog/*.seed.json` gains these required fields:
- the full-set call wall, flip and put wall;
- `max_pain`, a listed strike;
- `atm_iv` and `regime`;
- the per-strike call and put GEX amplitudes;
- the five score-driver parts, at the engine's values for the symbol's own inputs ("Why this score", below).

How the seeds are read:
- `base`, `step` and `phase` stay byte-identical. Spot and every option mark are therefore unchanged, and so is the D-04 guard below.
  - The bars are not. Spec 4's part C (step C1) replaces every bar before Oct 7, and Oct 7's open, high and low. It keeps the Oct 7 close pinned (spec 4, Behaviour › The sample series, "Pin the last close" and "Candles"). Spot, every option mark and the replay's mid read only that close, so they hold.
  - Part C lands after this commit and rebases on it. Step C1 then recomputes, once, the figures both specs move: the flow seed, the IV-rank observations, AAPL's `iv_rank_band` (Positions seed, below) and the board lines that quote them (spec 4, Scope and non-goals › Coordination with specs 01, 03 and 05, "Figures both specs move are recomputed once"; spec 4, Build plan › C1).
- `parseScenarioSeed` (`scenario-loader.ts:14-32`) requires the new fields. A missing field throws at load, the existing loud path ("Invalid X scenario seed"), instead of silently falling back to the old constants.
- `makeScenario` (`shared.ts:205-246`) takes the parsed seed instead of `(symbol, base, step, phase)`. Its callers change with it: `scenario-loader.ts:52`, `catalog/spy.ts:4`, and `flowSeed.spec.ts:42`, `:67` and `:156`.
- The other six expiry masks keep today's shift arithmetic (`shared.ts:232-246`), applied to the authored full-set levels. `assertCuratedVariants` (`:139-160`) still holds.

**One source, five readers.** All five read the same authored values:
- the scan row (`transport.ts:1438-1462`);
- the desk bundle's `market_state` and `signals` (`:912-1135`);
- the structure history (`:1490-1508`). Every sample carries its symbol's `regime`, `vol_regime`, `atm_iv`, `iv_hv_ratio` and `score_drivers`, and a `net_gex` whose sign is the regime's. Its `put_wall` is the seed's, as `flip` and `call_wall` already are the variant's. `hv_30d` stays 23, the desk's HV. Without this, TSLA's history would carry +20M net GEX beside Neg γ.
- the AI read context (`:502-514`);
- the strike profile (`:788-815`).

Six invariants hold for every symbol:
- The regime word equals the sign of the bundle's own net GEX, as the engine decides it (`signals.rs:211-215`).
- The strike profile's net GEX changes sign within one strike step (5) of the authored flip. SPY passes this today: its bars change sign between 685 and 690, and its flip is 683.92.
- The bar nearest spot has the regime's sign.
- `vol_regime` equals what the engine would call the bundle's own IV/HV: IV rich at ≥ 1.10, IV cheap at ≤ 0.90 (`signals.rs:15-17`).
- Each score-driver part equals the engine's value from the row's own inputs, to ±1 for rounding (`signals.rs:478-490`):
  - proximity = 40 × (1 − the nearest of |call wall|, |put wall| and |flip| distances ÷ 3%), floored at 0;
  - vol = min(25, |IV/HV − 1| × 50);
  - setups = min(25, 8 × setup count), so 8 for the demo's one setup per symbol (`transport.ts:1130-1138`);
  - transition = 10 exactly when |flip| ≤ 1%, otherwise 0;
  - dark pool = 0, as today.
  - The parts sum to at most the authored score. The rest is the authored remainder.
- SPY keeps price 690.62, call wall 704.02, flip 683.92, put wall 652.22 and score 74 (decision-queue ruling 3).

**The six rows (proposed authoring).** Scores and tiers are unchanged.

| Symbol | Score · tier | Regime | Vol | Flip distance | What changes in the seed |
| ------ | ------------ | ------ | --- | ------------- | ------------------------ |
| NVDA | 81 · Prime | Pos γ | IV rich | within 1% | IV/HV ≥ 1.10 (today 1.05) |
| SPY | 74 · Actionable | Pos γ | IV rich (open question 1) | +0.97% | none; its IV/HV is already 1.10 |
| QQQ | 70 · Actionable | Pos γ | Neutral | within 1% | IV/HV 0.90–1.10 (today 1.15) |
| AAPL | 63 · Actionable | Pos γ | IV cheap | within 1% | IV/HV ≤ 0.90 (today 1.18) |
| MSFT | 52 · Watch | Pos γ | Neutral | +1% to +3% (spot above flip) | flip moves down; IV/HV into range (today 1.23) |
| TSLA | 47 · Watch | Neg γ | Neutral | −1% to −3% (spot below flip) | flip above spot; per-strike GEX shape with net GEX < 0 at spot; IV/HV into range (today 1.1017, which the engine calls IV rich) |

Expected chip counts: Prime 1 · Actionable 3 · Watch 2 · Score ≥70 3 · |Flip| ≤1% 4 · IV cheap 1 · IV rich 2. If open question 1 is answered the other way, IV rich is 1. Either way each chip returns 1–5 rows.

The strike profile today shares one shape for every symbol (`transport.ts:790-791`). To put TSLA in Neg γ at its own flip, the call and put amplitudes become per-seed values. That is the only formula change, and SPY's amplitudes stay as they are today.

**Why this score.** Scores stay authored, so on the demo the engine's parts don't reach the score. SPY's parts are proximity 27 (flip 0.97% away), vol 5 (IV/HV 1.10), setups 8, transition 10 and dark pool 0: 50 of 74. Today the demo hides that gap in a vol part no IV/HV could produce. Instead:
- `scoreDrivers` (`transport.ts:465-467`) returns the seed's engine-valued parts and the authored `total`. The remainder is `total` − Σ parts: 24 for SPY.
- `whyThisRow(row, { sample })` (`pages/scanner/labels.ts:341-418`) takes the Scanner's demo flag, `dataMode === 'demo'`, which `Scanner.tsx:75` already reads.
  - When `sample` is true and the remainder is above 0, `whyFromScoreDrivers` adds one more part, "authored for this scenario (+N)". It sorts with the others, and the line still shows the top two.
  - SPY's line then reads "near wall/flip (+27) · authored for this scenario (+24)".
  - On production the flag is false and the line is unchanged, because the engine's parts make its total.
- The three callers pass the flag: `ScanCard.tsx`, `ScanCells.tsx:171` and `ScanRowPreview.tsx:191`.
- The wire type does not change. The remainder is derived in the UI and never sent.

**Max pain.**
- `market_state.max_pain` and the AI context's `max_pain` (`transport.ts:510`, `:922`) take the seed's strike. Strikes are `floor(spot/5)·5 − 25 … +25` in 5s (`:789`). SPY's is 690.
- The field label prints `toFixed(2)` (`paintStep.ts:488`), matching the flip label (`:479`) and the ladder. SPY then reads "max pain 690.00" on the field and "$690.00" in the ladder. The AI drawer shows the same strike.

**Scanner subhead.** `SCAN_COPY.subhead` (`labels.ts:20-22`) reuses the scanner wall's sentence (`features/auth/RequireAuth.tsx:46-48`). The cadence line already links methodology (`Scanner.tsx:325-333`). Production signed in renders `ScannerNotLive`, which has its own subhead (`ScannerNotLive.tsx:269-271`), so production is unchanged.

**Positions seed.** Two positions are added. Nothing else in the seed changes.
- **NVDA Oct 16 200 C**: open, long 1, entry 1.55 on a `snapshot` basis, opened 2026-10-07T17:50:00Z (1:50 PM ET). Sample mark at 2:30 PM: 1.85 (`sampleContractMark`, `shared.ts:162-172`), so +$30.
  - Its `open` decision carries an `entry_context` digest with `state_fingerprint: null` and `ai_rec_fingerprint: null`. The other fields follow the AAPL pattern below.
- **AAPL Oct 9 265 C**: closed, long 1, entry 1.30 and exit 1.05, both `snapshot`. Opened 2026-10-07T15:10:00Z (11:10 AM ET) and closed 2026-10-07T17:05:00Z (1:05 PM ET), so realized −$25 (−19.2%).
  - Its `open` decision carries tier `actionable` and an `entry_context` digest (`features/trading/model/types.ts:55-95`):
    - `opportunity_score` 63;
    - `setups` [Balanced structure · medium];
    - `persona_id` `demo-careful-reader`;
    - `iv_rank_band` taken from AAPL's own bundle after the IV change, and recomputed once by spec 4's step C1 when its bars land ("How the seeds are read");
    - `gamma_regime` and `vol_regime` from the seed;
    - `state_fingerprint: null`;
    - `ai_rec_fingerprint: null`;
    - `risk_block_present` false.
  - Why both fingerprints are null:
    - The trade opened at 11:10 AM ET, and the scenario's only snapshot is the 2:30 PM one (`aapl-synthetic-variant-7-v1`, `shared.ts:244`). Citing it would date the entry after the snapshot it claims to have seen.
    - No demo read could have produced the entry. Every demo read is no-trade (`transport.ts:711`), and "Create sim order" needs a fresh trade read (`presentationPolicy.ts:185`).
    - `null` is the digest's own word for "capture ran, and that source was absent" (`types.ts:46-53`, `:70-79`). Absence is not invented context, so this stays inside the NO BACKFILL rule.
    - The other digest fields are authored entry-time values. The scenario authors one state per symbol, so they equal the 2:30 PM bundle, and no field names a time.
- QQQ stays as authored, without a digest. Its "1 predate capture" clause is a real state, and the seed is never rewritten to invent context (`types.ts:46-53`, "NO BACKFILL").
- At load on a fresh visit the header reads "CAPITAL AT RISK $455 · 2 open" (SPY 300 + NVDA 155) and "NET P/L (OPEN) −$23" (−53 + 30).
- SPY stays first in the seed, so `focusedTicker()` (`pages/positions/PositionsPage.tsx:97-115`) still picks SPY on a tie.
- No working order is added. The seeded SPY Nov 20 limit at 4.25 stays below the rising sample mark for the whole replay. `demoSeed.flow.spec.ts` (tracker D-04) keeps guarding that, unchanged.
- New seeds reach first visits and Reset demo data. The workspace sentinel skips re-seeding for returning browsers (`workspace.ts:206-225`).

**Track record.**
- Four of the five families then have a cell. Tier shows Watch (QQQ) and Actionable (AAPL). Setup (Balanced structure), IV-rank band and Persona (Careful sample reader) show AAPL.
- AI rec stays empty, and says why. It reads "Nothing recorded yet for this cut. Cells appear as trades close with a recorded AI rec." (`outcomes/copy.ts:295-296`), and its coverage line reads "Of your 2 counted outcomes, 0 carry a recorded AI rec — 1 predate capture and 1 had none available at entry." (`copy.ts:266-285`, `ledger.ts:270-293`). Filling it would need an authored trade read, which the demo doesn't have (Non-goals).
- Each filled cell reads "Building history — 1 of 20 closed trade." (rate-free, AC-E3). The Setup, IV-rank band and Persona coverage lines read "Of your 2 counted outcomes, 1 carry a recorded … — 1 predate capture."
- The building read renders in IBM Plex Sans. The counted read keeps Mono. `CellView` (`TrackRecordSection.tsx:123-137`) picks the face from `cell.cohort.state`.

**Book first.** In `PositionsPanel.tsx:111-196` the order becomes: sign-in prompt, toolbar, disclosure line, book, then orders panel. This supersedes the UX §4.5 note that the orders panel sits "ABOVE the positions view" (`:120-122`).

### (d) Sample and simulated said once

**One SIMULATED chip.**
- A `SimulatedChip` in `shared/ui/SimulatedChip.tsx`, exported from `shared/ui/index.ts`, draws the neutral outlined chip Sim orders already draws: `Chip size="small" variant="outlined" label="SIMULATED"`. Its tooltip is `SIMULATED_TIP`, and a `tip` prop overrides it. If spec 2 lands first, `SimulatedChip` reuses spec 2's trade-dialog chip (spec 2, Behaviour › (c) Readable text, "Trade dialog chip"), the same outlined chip, instead of drawing a second one.
- `SIMULATED_TIP` moves to `shared/copy/simulated.ts`. `features/trading/positions/labels.ts:43-44` re-exports it, so its five importers don't change: `PositionRow.tsx:66`, `OrderDetailDialog.tsx:7`, `OrdersWidget.tsx:12`, `TradeEntryDialogView.tsx:66` and `OrdersPanel.tsx:9`.
- Why `shared/`: the chip's consumers span `features/trading` and `pages/ticker`, and the repo rule is to promote to `shared/` on the second consumer (`shared/ui/index.ts:5-7`; the same advice in the lint message at `eslint.config.mjs:220-222`).
- It is used at eight sites:
  - `OrdersWidget.tsx:110-111` and `OrdersPanel.tsx:93-94`;
  - `PositionRow.tsx:343-344`;
  - `OrderDetailDialog.tsx:113-122`, which drops the green tint;
  - `TradeEntryDialogView.tsx:541-551`. If spec 2 landed first, this site already draws the outlined chip, and it becomes the `SimulatedChip` that reuses it;
  - `PositionBrief.tsx:305-320`;
  - `DecisionCard.tsx:152`;
  - `TrackRecordSection.tsx:381`.
- The landing's chip is not a site (Scope): it is already neutral. It also could not take a chip from `features/trading`, because the public-surface deny-list bans that import on `pages/landing/**` ("no trading domain on a marketing surface", `eslint.config.mjs:203-231`), and `npm run verify` lints every affected project (`tools/verify.mjs:44`).
- The position brief's overline becomes "Your book".
- The AI read's chip reads "SIMULATED". Its ⓘ keeps the advisory tip (`ai-rec/copy.ts:101-102`).

**One Sample mark per frame.** A sample frame keeps its dashed border and hatch stripe and names the sample once: in its head, by its title or its Sample tag, or by a source chip anywhere in the frame (head, foot or a row). Further source chips are not extra marks: a frame's source chips count as one, and each keeps naming its source (spec 1, Behaviour › Research and Alerts on staging: say Sample once, "A chip that names a source keeps naming it"). Rows inside it carry no Sample tag; a source chip in a row is not one. P-3 asks for a Sample tag on sample data, and this keeps exactly one per frame, so it needs no amendment. Spec 1 proposes a stricter staging rule; open question 2 (owner decision D1) reconciles the two.
- One part waits on D1: a frame whose only mark is a Sample tag (no source chip, no title that begins "Sample") keeps that tag under this spec's draft and carries none under spec 1's. On the desk, Sim orders, the AI read, Setups, the hero and Your book are among those frames; on `/scanner`, the scan frame ("Scanner header and frame", below).
- The rest holds under either draft: no row carries a Sample tag, and no frame carries a second mark.
- The read strip keeps "Sample · shaped like the options chain" and drops the bare tag (`ReadStrip.tsx:148`). The P-8 chip names the shape; the tag only repeats it.
- The AI read's demo title becomes "AI read · SPY", the production title (`AiRecPanel.tsx:423`). Under this spec's draft (D1), the "Sample read" tag (`:300-304`) stays as the frame's one sample chip; under spec 1's, the frame carries none. The panel's "Sample analysis · authored for this scenario" line (`:308-311`) goes. "This is an authored example. No model was called." stays. The export drawer keeps `COPY.demo.provenance` (`StateExportDrawer.tsx:231`), so `demo-journey.spec.ts:162` is unaffected.
- The live tape keeps its title "Sample tape" (`LiveTape.tsx:176`) and drops the extra tag (`sampleTag={false}`).
- Sim orders keeps its frame tag under this spec's draft (D1); none under spec 1's. Under either, its rows carry plain text instead of a tag ((b)).
- The hero keeps its tag under this spec's draft (D1); none under spec 1's. Its "Sample tape · Mid" is a caption in the body lane (`StructureHeroPanel.tsx:465-468`), neither a head title nor a source chip, so it is not a mark.

**The demo bar as the page's one "Demo · sample data" (only if open question 2 is answered yes).**
- The masthead's demo tag is not just a repeat. In demo mode it fills the rule-18 connection-chip slot. That gift comes from the 2026-10-07 Amendments row, and the code marks the slot as unconditional: "The chip slot is UNCONDITIONAL (ruling 1 / AC-9)… never nothing" (`TickerHeader.tsx:416-428`). Emptying the slot needs the canon to say so first. This part therefore ships only with open question 2 answered yes, and only once the shared Amendments row is in the canon. Spec 1's step 8 appends that row (spec 1, Build plan, step 8). Commit 4 appends it only if that step has not landed (Build plan).
- With yes:
  - The shell exposes whether its demo bar is mounted (`AppShell.tsx:148`), through a small context.
  - While the bar is mounted, the masthead does not render its demo tag (`TickerHeader.tsx:426-427`). The masthead keeps the dashed "Shaped like a delayed SPY quote · Oct 7, 2:30 PM ET" chip and "Sample last trade", so its slot still names the sample and its time. The slot comment (`:416-419`) and the "About this sample" comment that names the masthead tag (`TickerDashboard.tsx:1310-1313`) are rewritten to match.
  - The Scanner's "On this page" legend (`Scanner.tsx:351-386`) yields the same way.
- With no: the masthead keeps its demo tag, unchanged. The Scanner keeps its legend box and loses only `DEMO_COPY.legendLine` (`:84-85`, `:382-384`), which is a sentence, not a slot.

**Scanner header and frame.**
- The frame head keeps the "Sample scan" tag under this spec's draft (D1); none under spec 1's. Its sentence is plain text, not a source chip (`Scanner.tsx:94-101`), so under this spec's draft the tag is the frame's one mark. The sentence becomes the short source form with the scenario time (Copy), dropping "authored scenario" and "Not market data."
- The subhead gets `maxWidth: '60ch'`.
- The session strip gets `ml: { xs: 0, sm: 'auto' }`. Its items align `flex-start` below 600px (sm) and `flex-end` from 600px, and the cadence line's `textAlign` follows.
  - From 1100px up, the strip sits beside the subhead on the page's right edge.
  - From 600px to 1100px, a wrapped strip sits on its own row at the right edge.
  - Below 600px it starts at the column's left edge, under the title.
  - Why the margin is per breakpoint: at 390 the strip is 335px wide in a 342px column. An unconditional auto margin pushes its left edge from 24px to about 31px, away from the h1 at 24px (`check3.mjs`).

**Phone controls.**
- The Scanner density segment is not displayed below sm (`ScanToolbar.tsx:276-290`, `display: { xs: 'none', sm: 'flex' }`).
- On Positions, Table/Cards is not displayed below md (`CustomizationToolbar.tsx:472-482`).
- Comfortable/Compact (`:484-494`) is displayed only where the table renders: md and up, with Table chosen.
- The cards' `data-density` attribute goes (`PositionsView.tsx:404`), because nothing reads it. The table's density still sets row padding (`:278`) and stays.
- The stored view is untouched. Only the viewport decides what is shown, as `PositionsView.tsx:143-147` already does.

**Phone Scanner cards.**
- Under the score line, `whyThisRow(row, { sample })` becomes a visible one-line caption (`ScanCard.tsx:94-105`): IBM Plex Sans, 0.8rem, `text.secondary`, ellipsized. That is the register the desktop preview uses (`ScanRowPreview.tsx:191`, `mono={false}`). It keeps the id that `aria-describedby` points at, so the full text is still read out.
- The card stays a link to the desk. Owner ruling 2026-10-16 (2) on row-click preview covers the table.

### States, route by route

| State | Desk `/ticker/:symbol` | `/scanner` | `/positions` |
| ----- | ---------------------- | ---------- | ------------ |
| Loading | Unchanged skeletons. No grip or kebab at any point. | Unchanged `ScanSkeleton`; header layout as above. | Unchanged. Book first once loaded. |
| Empty | Sim orders empty: the demo copy on staging, the shipped copy on production. The frame keeps its Sample tag under this spec's draft (D1); none under spec 1's. | Empty view and empty filter unchanged. Chips no longer reach them on the demo. | Empty book unchanged. The orders panel moves below it. |
| Error | Orders store fault block unchanged (`OrdersWidget.tsx:147-148`). AI read failure keeps "Retry demo". The trade dialog stays in Market and shows the shipped refusal on a lookup miss, or "Couldn't load the chain" on a lookup error. | The worker-down alert stays live-build only (`Scanner.tsx:403`). | Faulted banner unchanged. |
| Sample (staging) | The order row says "Checked on the Oct 7 replay" or "Not evaluated", in plain text. Times in ET. Each sample frame names the sample exactly once: in its head, or by a source chip anywhere in the frame (head, foot or a row), also with no working order. Under spec 1's draft (D1), a frame whose only mark is a Sample tag carries none. With open question 2 yes, no masthead demo tag while the bar shows. | Spread rows, the product subhead, an authored part in each why line, no legend sentence, a short frame head. | 4 positions, four filled Track record families, an honest empty AI rec family, the demo subtitle. |
| Not live (production) | No dead widget controls. ET order times, with the year outside the current one. Feed-off order arm unchanged. Trade dialog in Manual. | `ScannerNotLive` unchanged. | Book first. Feed-off subtitle. Sans building string. |
| Signed out (production) | Unchanged. | Wall unchanged. | Wall unchanged. |
| Phone (390) | No layout shift on tap. The ⓘ pairs hold. | No density segment. Visible why line. First card above 844. The strip lines up with the title. | No Table/Cards and no density. Book first. |

## Copy

Voice per DESIGN_SYSTEM.md: plain, short and literal. Every state word is a member of P-2's closed set (`shared/dataState/vocabulary.ts:32-51`), with an in-context word on the `sample` state the way "Sample read", "Sample scan" and "Sample mark · 2:30 PM" already are. The order row's demo lines are sentences, not state words, like the shipped "Waiting for live data" sentence they replace.

| Where | Today | New |
| ----- | ----- | --- |
| AI read re-request (`ai-rec/copy.ts:12`) | View sample analysis | Show the sample read again (only after Dismiss) |
| AI read demo title (`AiRecPanel.tsx:297`) | Sample analysis · SPY | AI read · SPY |
| AI read demo lines (`AiRecPanel.tsx:308-317`) | Sample analysis · authored for this scenario / This is an authored example. No model was called. | This is an authored example. No model was called. |
| AI read chip (`ai-rec/copy.ts:87`) | SIMULATED / advisory | SIMULATED (ⓘ keeps: "A read, not an order. Nothing is saved until you review and confirm a simulated trade.") |
| Trade footer, Market (`positions/labels.ts:298-300`) | Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and assignment are not modeled. | Paper trade — no broker, no real money. Fills at the mark shown above; fees, slippage, taxes and assignment are not modeled. |
| Trade footer, Manual price | (same as Market) | Paper trade — no broker, no real money. Opens at the price you type; fees, slippage, taxes and assignment are not modeled. |
| Trade footer, Limit on the desk | (same) | Paper trade — no broker, no real money. Opens at your limit; fees, slippage, taxes and assignment are not modeled. |
| Trade footer, Limit on Positions (resting) | (same) | Paper trade — no broker, no real money. Fills at your limit once the mark reaches it; fees, slippage, taxes and assignment are not modeled. |
| Trade footer, multi-leg or equity | (same) | Paper trade — no broker, no real money. Opens at the prices you type; fees, slippage, taxes and assignment are not modeled. |
| Trade dialog, Market with no fill (`TradeEntryDialogView.tsx:1028-1033`, `:996-999`) | (shipped) | unchanged: the shipped refusal and the shipped load error, now reachable because Market is the default |
| Order eval line, demo, checked | Waiting for live data — not currently evaluated | Checked on the Oct 7 replay (plain text, `text.secondary`, then ⓘ) |
| …its ⓘ | (production tip) | On the demo, this order is checked against the Oct 7 sample replay while this page plays it, 2:30 to 3:00 PM ET in the scenario. It fills only if the sample mark crosses its terms. Nothing reaches a market. |
| Order eval line, demo, idle | Waiting for live data — not currently evaluated | Not evaluated — the replay isn't playing for this order (plain text, then ⓘ) |
| …its ⓘ | (production tip) | On the demo, an order is checked against the Oct 7 sample replay only while that replay plays on a page for its ticker. It isn't playing for this order now, so the order stays as placed. You can still cancel it. |
| Orders panel subtitle, demo (`orders/copy.ts:107-108`) | Rec-driven entries watched against live data. Paper only — never a real order. | Entries are checked against the Oct 7 sample replay. Paper only — never a real order. |
| Orders panel subtitle, feed off (production) | (same) | Entries can't trigger without the live tape; they stay as placed. Paper only — never a real order. |
| Orders panel subtitle, live feed | (same) | unchanged |
| Sim orders empty, demo (`orders/copy.ts:110-112`) | No simulated orders for NVDA. Act on an AI read to create one — it watches the live tape for the entry. | No simulated orders for NVDA. Orders start from an AI read that proposes a trade, and the demo's sample reads all say no trade. |
| Order times, row (`OrderRow.tsx:66-80`) | triggered 10/7/2026, 2:30:00 PM | triggered Oct 7, 2:30 PM ET; in another year, triggered Oct 7, 2025, 2:30 PM ET (likewise placed, filled, cancelled, expired) |
| Order times, detail dialog (`OrderDetailDialog.tsx:77`) | 10/7/2026, 2:30:00 PM | Oct 7, 2026, 2:30 PM ET |
| Straddle basis (`straddle-move/copy.ts:18`) | … · % of the gex_spot spot $690.62 | From the 2026-10-09 ATM straddle · 2 DTE · mid quotes · % of the levels anchor, $690.62 |
| Field max pain label (`paintStep.ts:488`) | max pain 691 | max pain 690.00 |
| Why this score, demo (`scanner/labels.ts:390-418`) | IV vs HV stretch (+39) · near wall/flip (+18) (SPY) | near wall/flip (+27) · authored for this scenario (+24) (SPY; production adds no authored part) |
| Position brief overline (`position-brief/copy.ts:7`) | Your book · simulated (plus a "Simulated" label) | Your book (plus the SIMULATED chip) |
| Scanner subhead (`labels.ts:20-22`) | One dense read of the tracked universe — which ticker deserves the deep-dive right now. Structure is a snapshot; see methodology for how it is built. | See ranked dealer-gamma setups across the universe, then jump into any name for walls, flip and flow. |
| Scanner frame head (`Scanner.tsx:87-88`) | Shaped like an options-chain scan · authored scenario, Oct 7, 2026, 2:30 PM ET. Not market data. | Shaped like an options-chain scan · Oct 7, 2026, 2:30 PM ET |
| Scanner legend sentence (`Scanner.tsx:84-85`) | Every figure on this page comes from the authored Oct 7 scenario. Nothing is fetched; prices don't flash. | (removed) |
| Desk "About this sample" (`TickerDashboard.tsx:1328-1329`) | {source label} · Authored scenario · October 7, 2026 · no market feed connected | {source label} · As of Oct 7, 2026 · no market feed connected |
| Scanner sample banner (`pages/scanner/format.ts:386`) | Authored scenario · October 7, 2026 · no market feed connected | As of Oct 7, 2026 · no market feed connected |

The last two rows are the strings spec 1 hands to this spec (spec 1, Scope and non-goals › Non-goals, the desk bullet). They take spec 1's new bar wording, "As of Oct 7, 2026 · no market feed connected" (spec 1, Behaviour › The demo bar, "From 600px up"). If the owner chooses the brief's "Sample scenario · Oct 7, 2026" instead (spec 1 open question 2), both strings follow whatever the bar says, so the three never disagree.
- The Scanner banner never renders on the demo. The alert that would show it is live-build only (`Scanner.tsx:403`, `!DEMO`), and production never reports `sample`. The string changes only so it cannot drift from the bar. Its pin moves with it (`features/trading/orders/demoWorkspace.flow.spec.ts:173`).
- Spec 1's third string, `pages/ticker/research/ResearchView.tsx:334`, is not here. Spec 4 deletes that file (spec 4, Behaviour › `/ticker/:symbol/research` on staging, "Dead code"; spec 4, Build plan › C2; spec 4, Acceptance criteria, 4).

## Design

Tokens and components come from DESIGN_SYSTEM.md and `shared/ui`. No value is introduced here.

- **Colour.** `text.secondary` for the order row's demo lines, as plain text. `extrasFor(theme).textDim` replaces opacity dimming (Amendments 2026-09-09). `warning.main` appears only with `WarningAmberOutlined` (rule 5). The SIMULATED chip is MUI's default outlined chip, neutral per the 2026-10-15 ruling A. Its green tint goes, which retires a banned pattern: green on a status chip (Banned, v2).
- **Type.** The building read, the order row's demo lines and the phone why line use Plex Sans. Figures stay Mono. Chip and caption text stays at 11px or more.
- **Components.** `DataStateTag`, `AccessibleHelp`, MUI `Chip`, `Tooltip` and the new `shared/ui` `SimulatedChip`. Nothing from the Banned list: no hover-only affordance, no live pulse on sample state, no second token table.
- **Spacing.** The 4-pt ladder. The ⓘ pair wrapper uses a 4px gap.

The sketches draw this spec's draft (D1). Under spec 1's, the `┆▢ Sample┆` and `┆▢ Sample scan┆` tags are absent ((d), "One Sample mark per frame").

Sim orders on the demo:

```
Sim orders · SPY  ┆▢ Sample┆  [SIMULATED]                                   All orders →
SPY 690C · 2026-11-20  ×1  [Triggered · working entry]  triggered Oct 7, 2:30 PM ET
trigger — none (armed immediately)   limit $4.25   stop — · target —   Good-til Nov 20, 2026
Manual   Checked on the Oct 7 replay ⓘ                         Details   Cancel order
```

Sim orders on NVDA (no orders):

```
Sim orders · NVDA  ┆▢ Sample┆  [SIMULATED]                                  All orders →
No simulated orders for NVDA. Orders start from an AI read that proposes a trade,
and the demo's sample reads all say no trade.
```

Scanner header at 1440:

```
Scanner                                                              [RTH · SCENARIO]
See ranked dealer-gamma setups across the universe,     Sample tape · structure ~3 min · How structure is computed
then jump into any name for walls, flip and flow.                    Structure as-of 2:30 PM ET, Oct 7
[Your view · 6 names] [Edit view]  Prime Actionable Watch Score≥70 |Flip|≤1% IV cheap IV rich  [Compact|Comfortable]
┆▢ Sample scan┆ Shaped like an options-chain scan · Oct 7, 2026, 2:30 PM ET
NVDA …
```

Positions at 1440, book first:

```
Positions      CAPITAL AT RISK $455 · 2 open      NET P/L (OPEN) −$23
[Simulated] [Live]
[All positions ▾] [Table|Cards] [Comfortable|Compact] [Group] [Open|Pending|Closed|Cancelled] [History] [+ Open]
Positions are stored in this browser …
┌ book: SPY 690C (Oct 16), NVDA 200C (Oct 16) ┐
Simulated orders [SIMULATED]                                            Export JSON
Entries are checked against the Oct 7 sample replay. Paper only — never a real order.
…
Track record [SIMULATED]
```

At 390 the toolbar loses Table/Cards and Comfortable/Compact.

The Final design boards draw the marks and figures this spec changes. Under ruling 3 the boards follow the seed, so they change in the same commits:
- Commit 3 (seeds):
  - `design/src/screens/final/ticker-desk.mjs:106`: `PAIN = 690.62` becomes 690, so the ladder's "Max pain" row (`:147`) reads 690.00.
  - `design/src/screens/final/account-pages.mjs:63-70`: the `DEMO_SCAN` rows take the seed's flip, walls and distances, and gain a regime column.
  - `account-pages.mjs:76` (table) and `:81` (phone cards): the hardcoded `Positive γ` reads the row's regime, so TSLA shows Neg γ.
  - `account-pages.mjs:87`: the staging Scanner subhead takes the new copy. The production board's subhead (`:106`) stays, because `ScannerNotLive` keeps its own.
- Commit 4 (sample and simulated):
  - `ticker-desk.mjs:122`: the masthead demo tag, only with open question 2 answered yes.
  - `ticker-desk.mjs:173`: the read strip's bare tag.
  - `ticker-desk.mjs:182-183`: the AI read's title and its "Sample analysis · authored for this scenario" line.
  - `ticker-desk.mjs:194`: the tape's extra tag.
  - `ticker-desk.mjs:198`: the head "Your book · simulated" becomes "Your book" plus the outlined SIMULATED chip. Its sample tag stays under this spec's draft (D1); none under spec 1's.
  - `ticker-desk.mjs:203-205`: Sim orders keeps `stateTag('sample')` under this spec's draft (D1); none under spec 1's. Its solid "Simulated" stag becomes the outlined SIMULATED chip, and the row gains "Checked on the Oct 7 replay".
  - `ticker-desk.mjs:233`: the "About this sample" line takes the desk's new string.
  - `account-pages.mjs:73`: the frame head sentence.
  - `account-pages.mjs:87`: the legend sentence; the legend box too, only with open question 2 answered yes.
- Regenerate with `node design/src/build.mjs`. Never hand-edit `design/canvas` or `design/site`.

## Data and licence

This is not a new tool, and it adds no data source. Every new number is authored demo seed data in `libs/api/src/lib/demo`, served from the staging bundle. Nothing is fetched. No licensed data reaches a public page, and production shows the same public data it shows today. There is nothing to add to `docs/product/ai-analyst/SOURCES.md`.

## Acceptance criteria

All staging checks use a fresh browser context (empty storage) unless stated. Production checks load pages signed out and never sign in or submit.

1. **Details always opens.** On `/ticker/SPY` at 1440x900, run 10 trials at each of 0, 16, 50 and 150 ms between mousedown and mouseup. Each trial loads a fresh page, because the first press is the one that races. All 40 trials open exactly one dialog titled "Simulated order · SPY 690C". Baseline: intermittent, 1, 3 and 4 of 4 in three single-press runs (Why). Check: `click.mjs`, extended to 10 trials per timing.
2. **Cancel always arms.** The same 40 fresh-page trials on "Cancel order" each turn it into "Confirm cancel" (`order-cancel-confirm`) and open no dialog. No trial presses "Confirm cancel". Baseline: 1, 2 and 2 of 4. Check: `click.mjs`.
3. **Nothing moves on click.** This is the deterministic gate; ACs 1–2 are the user-level check. The Details and Cancel buttons' tops are identical before mousedown and after mouseup, and the Sim orders h2 keeps its height. Baseline: 439 → 451, and the h2 grows to 40px, in every press of every run. Check: `desk.mjs` `click_*`.
4. **No placeholder controls.** On staging and production `/ticker/SPY`, the counts of `.widget__grip`, `[aria-label="Configure — coming soon"]`, `[aria-current="true"][data-widget-id]` and the text "Rearrange (coming soon)" are all 0, before and after clicking each widget once. Check: a DOM count in a probe.
5. **AI read actions.** On load, the panel's buttons are "View sample export →", "Full analysis & data" and "Dismiss". After Dismiss, "Show the sample read again" is visible. Clicking it shows `sample-analysis-result` again within 2 s. Check: `desk.mjs` `aiButtons`, plus a dismiss step.
6. **ⓘ pairs hold.** In `decision-provenance`, each help button's vertical centre is within 2px of its chip's vertical centre, and the button's top is above the chip's bottom (one line box). This holds at 1440, and at 390 under a coarse pointer (`hasTouch`), where spec 2's floor makes the button 44px tall beside a 24px chip (spec 2, Why, "Touch targets below 44px on coarse pointers"). At 390 the probe first expands the read's bottom sheet, which is collapsed by default below 768px (`AiRecPanel.tsx:294`, `defaultExpanded={false}`). Baseline: the last ⓘ's top is 25px below its chip's. Check: `desk.mjs` `provChipLine`, comparing centres.
7. **Trade dialog opens ready.** On staging, within 1 s of "+ Open simulated trade": MARKET is pressed, the preview starts "Fill: mid $", "Open simulated position" is enabled, and the footer is the Market sentence. Clicking MANUAL PRICE switches the footer to the Manual sentence. Baseline: Manual pressed, primary disabled, the "Filled at the option mid" footer. Never submitted. Check: `desk.mjs` `tradeDialog`.
8. **Production dialog still Manual.** On production, signed in, the dialog opens in Manual price with the Manual footer. Check: the owner, since agents never sign in on production.
9. **Demo order states.** On staging `/ticker/SPY` and `/positions`, during the replay, the SPY order's eval line reads "Checked on the Oct 7 replay" as plain text: no chip and no `[data-state="sample"]` element inside `[data-testid=order-row]`, computed colour `text.secondary`, no animation. When the demo bar says "Sample playback complete", 6 minutes after load, the line changes to "Not evaluated — the replay isn't playing for this order" within 2 s, with no reload and no input. That proves the row subscribes to the clock. Baseline: "Waiting for live data — not currently evaluated", rgb(224,122,63), no icon. Check: `desk.mjs` `evalCell`, plus a 370 s wait that polls the line.
10. **Warnings carry the icon.** In both schemes, on the desk and on `/positions`, every element inside `[data-testid=order-row]` whose computed colour is `warning.main` has a warning svg in the same stack. That includes the armed "Confirm cancel". Check: a computed-style scan.
11. **Subtitle.** Staging `/positions` shows "Entries are checked against the Oct 7 sample replay. Paper only — never a real order." Production shows the feed-off string. Check: `scanpos.json` `panelSubtitle`; production by the owner.
12. **Times in ET.** `tz.mjs` under America/New_York, America/Los_Angeles and Europe/Berlin prints the same "triggered Oct 7, 2:30 PM ET". The detail dialog's lifecycle lines read "Oct 7, 2026, 2:30 PM ET" and match across all three. Baseline: three different strings. Check: `tmp/ux-audit/ticker-desk/tz.mjs`. The other-year row form ("Oct 7, 2025, …") needs a production order from another year, which neither site has, so it is checked by review.
13. **Straddle line.** Staging reads "From the 2026-10-09 ATM straddle · 2 DTE · mid quotes · % of the levels anchor, $690.62". Check: `desk.mjs` `straddleBasis`.
14. **No opacity dimming.** `OrderRow.tsx` has no `opacity` on text. The offline arm needs a live stream drop, which neither site can produce today, so this one is checked by review.
15. **Every chip filters.** On staging `/scanner` each of the 7 chips returns 1–5 rows. Expected: Prime 1, Actionable 3, Watch 2, Score ≥70 3, |Flip| ≤1% 4, IV cheap 1, IV rich 2 (1 if open question 1 goes the other way). Baseline: IV cheap 0, IV rich 0, |Flip| 6. Check: `tmp/ux-audit/scanner-positions-lab/interact.mjs` `chips`.
16. **The spread exists, and SPY is unchanged.** The rows include at least one Neg γ, one IV rich, one IV cheap and one |flip| > 1%. The SPY row reads 690.62, 683.92 (+0.97%), 704.02 / 652.22, 74, Actionable. Check: `scanpos.mjs` `rows`.
17. **The desk agrees with its row.** For each of the six symbols, `/ticker/X` shows the row's regime (+γ or −γ in the masthead and hero finding), an IV/HV in the read strip that maps to the row's Vol label (≥ 1.10 rich, ≤ 0.90 cheap, Neutral between), and the row's flip and walls in the ladder. Check: a probe over six desks. The net GEX sign, the field's zero crossing and the history samples aren't in the DOM, so they are asserted in `transport.spec.ts` (Verification).
18. **Why lines add up.** For each of the six rows, on the phone card caption and the desktop preview:
    - every engine part shown equals the formula's value from that row's own figures, to ±1: proximity from the nearest of flip and walls, vol from the desk's IV/HV, setups 8, transition 10 exactly when |flip| ≤ 1%;
    - the "authored for this scenario (+N)" part, where shown, has N = score − the sum of the engine parts;
    - SPY reads "near wall/flip (+27) · authored for this scenario (+24)".
    - Baseline: vol parts of NVDA "(+46)", SPY "(+39)", QQQ "(+35)" and AAPL "(+28)", none of which any IV/HV can produce. Check: `scanpos.mjs`, extended to all six cards and previews. That production adds no authored part is checked by review, because production walls the Scanner.
19. **Max pain is one strike.** On all six desks the ladder's max pain equals a listed strike. On SPY the ladder says "$690.00" and the field label says "max pain 690.00". Baseline: "$690.62" and "691". Check: ladder text, plus a 1440 crop of the hero (the field label is canvas).
20. **Book seeded, D-04 intact.** A fresh `/positions` lists SPY and NVDA open, and QQQ and AAPL in History. Within 2 s of load the header reads "CAPITAL AT RISK $455 · 2 open" and "NET P/L (OPEN) −$23". The SPY Nov 20 order is still "Triggered · working entry" after the replay ends. Check: `scanpos.mjs`; `demoSeed.flow.spec.ts` exits 0.
21. **Track record fills where it honestly can.** "Nothing recorded yet for this cut" appears exactly once, in the AI rec family (baseline 4). Tier, Setup, IV-rank band and Persona each have at least one cell reading exactly "Building history — 1 of 20 closed trade. No hit rate yet: fewer than 20 outcomes can't tell luck from edge." The AI rec coverage line reads "Of your 2 counted outcomes, 0 carry a recorded AI rec — 1 predate capture and 1 had none available at entry." No cell contains "%" or "won". Check: `scanpos.mjs` `trReads`, `nothingRecordedCount`.
22. **Sans for the building read.** The computed `font-family` of each `tr-read-*` in the building state starts with "IBM Plex Sans". Baseline: Plex Mono. Check: `scanpos.mjs` `trReadFont`.
23. **The book comes first.** At 1440x900 the first position row's top is ≤ 520 (baseline 743), and the orders panel sits below the book. At 390x844 the first card's top is < 844 once spec 1's one-row demo bar has landed. This spec alone takes it to about 871. Baseline: 1389. Check: `posgeo.mjs`.
24. **One SIMULATED form.** On the 1440 desk "SIMULATED" appears 3 times (Sim orders, Your book, AI read), each a chip with the same computed background, border and colour. "SIMULATED / advisory" and "YOUR BOOK · SIMULATED" are gone. The trade dialog's and order detail's chips have no green background. The landing is out of scope, because its chip is already neutral. Baseline: 4 marks in 3 forms, rgba(46,204,113,0.18). Check: `desk.mjs`, `census.mjs`.
25. **Sample said less.** By the audit's census (main innerText at load, case-sensitive "Sample", 1440 desk) the count is ≤ 10 (baseline 14). Check: `census.mjs`, `census2.mjs`. AC33 covers the per-frame rule.
26. **One "Demo · sample data" (only if open question 2 is answered yes).** While the demo bar shows, `main` contains no `[data-state="demo"]` on `/ticker/SPY` (baseline 1), and the same holds on `/scanner`. The masthead still shows its dashed "Shaped like a delayed SPY quote · Oct 7, 2:30 PM ET" chip. If the answer is no, `main` on `/ticker/SPY` still contains exactly one `[data-state="demo"]`, in the masthead. Check: `desk.mjs` `mastheadDemoTag`.
27. **Scanner header.** No legend sentence. The frame head reads "Shaped like an options-chain scan · Oct 7, 2026, 2:30 PM ET", after the "Sample scan" tag under this spec's draft (D1), and without it under spec 1's. At 1440 the session strip's top is above the subhead's bottom (one row), and its right edge is within 1px of the page column's content edge. At 390 its left edge is within 1px of the h1's left edge (24px). Baseline: the strip on its own row at x 124–459 at 1440; left edge 24 at 390, which an unconditional `ml: 'auto'` would move to about 31. Check: `scanpos.mjs` `subheadBox`, `strip`.
28. **Scanner phone fold.** At 390x844 the first card's top is < 844, with or without spec 1. This spec alone projects 694–754, from the measured heights in `scangeo.mjs`. Baseline: 880. Check: `scangeo.mjs`.
29. **Every visible toggle does something.** The four segmented controls in scope are `scan-density` on `/scanner`, and `layout-toggle`, `density-toggle` and `group-select` on `/positions`.
    - At 390, `scan-density`, `layout-toggle` and `density-toggle` take no space (height 0 or absent). `group-select` stays.
    - At 1440 on Positions, `density-toggle` is absent with Cards chosen and present with Table chosen.
    - For each control visible at each route and width, the probe clicks every option whose `aria-pressed` is `false`, one at a time. It diffs a screenshot of the list region before and after each click. Every diff is non-zero. Pressed options are never clicked, because re-pressing changes nothing by design.
    - Baseline: at 390, `scan-density`, `layout-toggle` and `density-toggle` change nothing (SPL-06). Check: a new probe under `tmp/ux-audit/`.
30. **Phone why line.** Each `scan-card` shows its why text visibly, one line, in IBM Plex Sans at 12px or more, `text.secondary`, and each card still links to `/ticker/<SYM>`. Check: `scanpos.mjs` `scannerPhone`.
31. **Production walls unchanged.** Signed out, production `/scanner` and `/positions` still show the sign-in wall and the demo link. Check: a page load and a text read.
32. **A lookup miss keeps Market and says why.** This runs on a local dev build only, never production. Run `npm run ports:free`, then `npm run dev`. A Playwright probe stubs `/api/health` to `market_data: "live"` with `page.route`, so the feed reads as on. It then stubs `/api/contract/*` three ways: a 404, a 200 with no mid and no theoretical mark, and a 500.
    - For the 404 and the empty 200, the dialog keeps MARKET pressed, shows "No quote or theoretical mark available for this contract — a market order can't fill. Try Manual price, or pick another contract.", and "Open simulated position" is disabled.
    - For the 500 it shows "Couldn't load the chain for entry — try again." with MARKET still pressed.
    - In all three, clicking MANUAL PRICE shows the Manual line, and typing a price enables the button. Nothing is submitted.
    - Baseline: unreachable, because the dialog opens in Manual. If the local desk cannot open the dialog signed out, this is checked by review of `TradeEntryDialogView.tsx:996-1033`, and the report says so.
33. **One Sample mark per frame, in every state.** On all six staging desks at 1440, every Widget frame drawn dashed (`sample`) has exactly one sample mark: in its head, a title that begins "Sample" (the tape) or a `DataStateTag` of state `sample`; or dashed source chips anywhere in the frame (head, foot or a row) whose text begins "Sample", which count as one mark however many there are. No element inside `[data-testid=order-row]` carries `[data-state="sample"]`. One part waits on D1 (open question 2): under spec 1's draft, a frame whose only mark is a Sample tag carries 0 marks instead ((d), "One Sample mark per frame"). The probe checks three states:
    - at load, which gives SPY with a working order and NVDA, QQQ, AAPL, MSFT and TSLA with none;
    - on SPY after "Cancel order" then "Confirm cancel", which leaves completed rows only (staging-local state, fresh context);
    - after the replay ends.
    - Baseline today: 2 marks on the read strip, the AI read and the tape, and 1 on Sim orders on every desk (`check3.mjs`, NVDA: 0 rows, 1 sample tag). The earlier draft of this spec would have left 0 on Sim orders on five desks. Check: a new probe under `tmp/ux-audit/`.

## Verification

Risk-based, per CLAUDE.md. No change here touches money or P&L logic. The order engine, `composeMark`, the ledger maths and the fill resolver are untouched. Seeds are data. One assertion block is owed, and it goes into an existing spec rather than a new file. The Scanner row, the desk bundle and the structure history are three routes over one seed. If they disagree, nothing crashes: the deep link just lies. That is the silent contract failure the house rule names. The block extends the existing per-symbol loop in `libs/api/src/lib/demo/transport.spec.ts:313` to assert, for each symbol:
- the scan row's `regime`, `vol_regime`, `flip`, `call_wall` and `put_wall` equal the bundle's;
- `regime` matches the sign of `market_state.net_gex`;
- the strike profile changes sign within 5 of the flip;
- `vol_regime` matches the bundle's `iv_hv_ratio` by 1.10 / 0.90;
- every score-driver part equals the engine formula's value from the bundle's own distances, IV/HV and setups, to ±1 (`signals.rs:478-490`), and the parts sum to at most the score;
- every structure-history sample's `regime`, `vol_regime`, `iv_hv_ratio`, `atm_iv`, `flip`, `call_wall`, `put_wall` and `score_drivers` equal the bundle's, and the sign of its `net_gex` equals the regime's.

Prove the block can fail. Set TSLA's seeded regime to `positive_gamma` and confirm the spec exits non-zero. Then restore it and set the history's `net_gex` back to the constant `20_000_000`, and confirm it exits non-zero again. Revert both and record all three exit codes.

Specs to update, because they pin what changes:
- `libs/api/src/lib/demo/transport.spec.ts:97-104`: the score drivers' sum assertion changes from "equals the score" to the per-part formula check above, with the sum at most the score.
- `libs/api/src/lib/demo/workspace.spec.ts:376-378`: positions 2 → 4, orders 2, decisions 7 → 10.
- `libs/api/src/lib/demo/catalog/catalog.spec.ts`: the new required seed fields.
- `libs/api/src/lib/demo/flowSeed.spec.ts:42`, `:67`, `:156` and `catalog/spy.ts:4`: `makeScenario` takes the parsed seed.
- `apps/dashboard/src/app/features/trading/orders/demoWorkspace.flow.spec.ts:173`: the `sweepBanner` sample string. `:64` uses `arrayContaining` and needs no edit; confirm it still passes.
- `apps/dashboard-e2e/src/demo/demo-journey.spec.ts:143`, `:153`: wait for the automatic read instead of clicking "View sample analysis".
- `apps/dashboard-e2e/src/quality/accessibility.spec.ts:78-93`: A11Y-3's four-grip assertion becomes zero grips.
- `shared/ui/Widget/Widget.spec.tsx:16-23` and `pages/ticker/widgets/_kit/TintChip.spec.tsx:17-25`: drop the provider.
- Spec 2's criterion 14 (spec 2, Acceptance criteria, 14) states 2 colour uses of `text.disabled` before this commit, NewAlertDialog's disabled option and the Widget grip (spec 2, Behaviour › (c) Readable text, "Two uses stay `text.disabled`"), and 1 after it, once the grip is deleted. It needs no edit. Spec 2 adds no source scan (spec 2, Behaviour › (c) Readable text, "No source scan is added"), so there is no exemption to remove.

RETIRED: lines are owed only if a spec is deleted. None is planned.

Commands. Each one's exit code is checked with `echo $?`, never a printed summary:
- `npx nx run-many -t typecheck` (Vitest does not typecheck).
- `npm run verify`. It runs affected lint, typecheck and test (`tools/verify.mjs:44`), and gitleaks over new commits (`brew install gitleaks`). The lint step is the one that would catch a trading import on the landing.
- `npm run check:bundle` (`tools/check-dashboard-bundle.mjs` brotli budgets). Removing selection shrinks the shared chunk. Nothing may grow past its budget.
- `npx playwright test -c apps/dashboard-e2e/playwright.demo.config.ts` for the demo journey, and `npx nx run dashboard-e2e:a11y` for A11Y-3.
- `node design/src/build.mjs` after the board edits. No token changes, so `verify-tokens.mjs` is not owed.
- Before any local run-the-app check, run `npm run ports:free`.

Observable checks after each staging deploy:
- `tmp/ux-audit/ticker-desk/details2.mjs`, `details3.mjs`, `tz.mjs` and `phonefold.mjs`.
- `tmp/ux-audit/scanner-positions-lab/interact.mjs` and `probe.mjs`.
- This spec's probes in `tmp/ux-audit/spec-trader-surfaces-demo/`, with ACs 1–31 and 33. AC32 runs locally.

CI is off, and none is proposed. Nothing in this spec has been run against the change yet. The baselines above are measured, and the targets are not.

## Build plan

Four commits, in this order, each green on its own: `npx nx run-many -t typecheck` and `npm run verify`, both exit 0. Total size XL. Commit 3 is separable: it touches the demo seeds, the Scanner's why line, Positions' order and the Track record face, and none of commits 1, 2 or 4 depends on it. If the owner wants a smaller first change, it moves to its own spec with ACs 15–23, and this spec keeps the rest.

1. **(a) Every click lands. Size M.**
   - `shared/ui/Widget/Widget.tsx`: delete the grip, kebab, menu, selection, ring, `ClearOnOutside` and `useOutsideClear` (`:611`, `:616-645`), and rewrite the header comment. Delete `WidgetSelectionContext.tsx` and its export in `shared/ui/Widget/index.ts`. Edit `TickerDashboard.tsx:71`, `:1023`, `:1286` and the `CommandDeck.tsx:5` comment.
   - `ai-rec/AiRecPanel.tsx:386-397`, `ai-rec/copy.ts:12`, and the `ai-rec/DecisionCard.tsx:132-175` nowrap pairs.
   - `tradeEntry/TradeEntryDialogView.tsx:177` and `:230`: the default becomes Market, with no automatic mode change. Then `:1112-1118` and `positions/labels.ts:298-300`: the footer as a function of mode.
   - Spec updates: `Widget.spec.tsx`, `TintChip.spec.tsx`, `accessibility.spec.ts` and `demo-journey.spec.ts`.
2. **(b) The demo tells the truth. Size M.**
   - `orders/useOrders.ts:351-362` and `orders/types.ts`: the eval kinds and the coverage flag.
   - `OrdersWidget.tsx` and `OrdersPanel.tsx`: subscribe to the demo clock (`subscribeDemoClock`, as `AppShell.tsx:47-52`) and pass playback in `LiveCoverage`.
   - `OrderRow.tsx:108-205`: the plain-text demo lines with their ⓘ, the warning icons and `textDim`.
   - New `shared/lib/etClock.ts`, with `_kit/sample.ts:25-48` re-exporting from it. `OrderRow.tsx:66-80` and `OrderDetailDialog.tsx:77` use it (ET, with the year rule).
   - `orders/copy.ts`: new strings, the subtitle variants and the demo empty state.
   - `straddle-move/copy.ts:8-19`.
3. **(c) The sample has spread. Size L. Separable.**
   - The six `catalog/*.seed.json`, `scenario-loader.ts:5-52` and `shared.ts:205-246` (`makeScenario` takes the seed), plus its callers `catalog/spy.ts:4` and `flowSeed.spec.ts`.
   - `transport.ts`:
     - `:465-467`: drivers from the seed;
     - `:502-514`;
     - `:758-830`: per-seed IV and GEX amplitudes;
     - `:912-947` and `:1121-1129`;
     - `:1438-1462`;
     - `:1490-1508`: the history fields.
   - `paintStep.ts:488`.
   - `scanner/labels.ts:341-418` (`whyThisRow` and the authored part), and its callers `ScanCard.tsx`, `ScanCells.tsx:171` and `ScanRowPreview.tsx:191`.
   - `workspace.ts:226-481`: two positions and three decisions, with null fingerprints.
   - `scanner/labels.ts:20-22`.
   - `PositionsPanel.tsx:111-196` (reorder) and `TrackRecordSection.tsx:123-137` (face by state).
   - Spec updates: `transport.spec.ts` (the coherence block, the driver assertion and the mutation runs), `workspace.spec.ts` and `catalog.spec.ts`.
   - The commit-3 board edits (Design) and `node design/src/build.mjs`.
4. **(d) Sample and simulated said once. Size M.**
   - New `shared/ui/SimulatedChip.tsx` and `shared/copy/simulated.ts`, with `positions/labels.ts:43-44` re-exporting the tip. The chip is used at the eight sites listed in (d). Also `position-brief/copy.ts:7`, `PositionBrief.tsx:305-320` and `ai-rec/copy.ts:87`.
   - `ReadStrip.tsx:148`, `AiRecPanel.tsx:297-317` and `LiveTape.tsx:209` (`sampleTag={false}`).
   - **Waits on D1** ((d), "One Sample mark per frame"): each tag site below is a frame's only mark. Each keeps its tag under this spec's draft and carries none under spec 1's:
     - Sim orders, `OrdersWidget.tsx:133` (the `Widget` frame's Sample tag, drawn at `Widget.tsx:322-329`);
     - the AI read's "Sample read" tag, `AiRecPanel.tsx:300-304`;
     - Setups, `Setups.tsx:40` (its `Widget` frame tag);
     - the hero, `StructureHeroPanel.tsx:374` (its `Widget` frame tag);
     - Your book, `PositionBrief.tsx` (the Final board draws its tag, `ticker-desk.mjs:198`);
     - the Scanner's frame head, the "Sample scan" tag at `Scanner.tsx:96`.
   - `TickerDashboard.tsx:1328-1329`, `scanner/format.ts:386` and the pin at `demoWorkspace.flow.spec.ts:173`. These wait on D2 (spec 1, Build plan › step 2, the bar wording): they land with or after spec 1 step 2, so the desk, the Scanner and the bar never disagree.
   - `Scanner.tsx:81-101` and `:251-386`, `ScanToolbar.tsx:276-290`, `CustomizationToolbar.tsx:472-494`, `PositionsView.tsx:404` and `ScanCard.tsx:94-105`.
   - The commit-4 board edits (Design) and `node design/src/build.mjs`.
   - Only with open question 2 answered yes: `AppShell.tsx:148` (expose the bar), `TickerHeader.tsx:416-428` and the Scanner legend box. This part requires the one Amendments row shared with spec 1 (its open question 1), which spec 1's step 8 appends to DESIGN_SYSTEM.md (spec 1, Build plan, step 8). This commit appends it only if that step has not landed, and only after both D1 and D2 are answered, so the row is appended once with D2 in it. It supersedes; the 2026-10-07 rule-18 exception row stays. Neither spec appends a row of its own, and none is appended before the owner answers.

Rebase onto specs 1 and 2 first. Spec 1 edits `AppShell.tsx`, and on other lines `demo-journey.spec.ts` and `account-pages.mjs` (spec 1, Build plan, steps 1, 2 and 7). Spec 2 edits `TradeEntryDialogView.tsx`, `OrderRow.tsx`, `OrdersPanel.tsx`, `TrackRecordSection.tsx`, `PositionRow.tsx`, `TickerHeader.tsx`, `TickerDashboard.tsx` and `ScanToolbar.tsx` (spec 2, Build plan, steps 2 to 4), and `AiRecPanel.tsx` among its `Select` sites (spec 2, Behaviour › (b) Touch floor). Its step 4 sweep also reaches `OrderDetailDialog.tsx`, `PositionBrief.tsx`, `PositionsView.tsx` and `CustomizationToolbar.tsx` (spec 2's `text-disabled-sites.txt`). Before writing anything, check that no other session holds uncommitted work in those files. Never `git stash` in this shared tree.

## Open questions for the owner

1. **SPY's vol label.** SPY's own IV/HV on the desk is 1.10 (25.32 / 23, `transport.ts:772`, `:946-947`). The engine calls that IV rich (`signals.rs:15`), but the demo labels SPY Neutral everywhere. **Recommended: label SPY IV rich and change no SPY figure.** The alternative is lowering SPY's authored IV so it reads Neutral. That changes SPY's IV/HV, IV rank, skew and net DEX cells, which the Final boards then have to follow (ruling 3).
2. **One "Demo · sample data" per page, and one Sample mark per frame: one Amendments row shared with spec 1 (owner decision D1 in the README).** Both specs need the same row. Spec 1's step 8 appends it (spec 1, Build plan, step 8), and today the two drafts differ on one point.
   - **Proposed shared text:** "On the demo, the shell's demo bar is the page's one 'Demo · sample data', with its as-of. While it shows, page-level slots yield to it: the masthead's demo tag (the rule-18 connection-chip slot the 2026-10-07 exception gave it), header chips that only state the demo, and the 'On this page' legend. The demo note's kind pill, 'Sample note' (D-21's tag, in the note header's kind slot), is not such a chip, and it stays. A sample frame keeps its dashed border and hatch stripe (P-3, P-8) and names the sample exactly once: in its head (a title that begins 'Sample', or its Sample tag), or by a source chip anywhere in the frame (head, foot or a row) that itself begins 'Sample' or 'Demo'. Further source chips are not extra marks: a frame's source chips count as one, and each keeps naming its source. Rows and cards inside a frame carry no Sample tag; a row's demo state is plain text. Production is unchanged: rule 18's six states and P-3 apply as written."
   - **The difference.** Spec 1's draft (spec 1, Behaviour › Research and Alerts on staging: say Sample once; spec 1, Open questions for the owner, 1) gives a staging frame at most its source line, and supersedes D-19's per-frame tag. A frame with no source line and no Sample title would then name the sample nowhere in words: Sim orders, the AI read, the Setups card, the hero and Your book. The Scanner's scan frame is the same case, because its source sentence begins "Shaped like", not "Sample" or "Demo" ((d), "Scanner header and frame"). Both drafts already agree that rows and cards carry no Sample tag.
   - **Recommended: the text above.** The dashed border and the hatch are visual only and never reach the accessibility tree, so a frame with no word says "sample" to no screen reader. P-3 names the tag. And Sim orders shows no row at all on five of six desks at load. Spec 1's Research frames that carry a "Demo · shaped like …" line keep exactly what spec 1 gives them. That line is a source chip in the ChartFrame's foot (`ChartFrame.tsx:12`, `:187-199`), which the text above counts. So is the one mark of spec 7's Stress frame, which carries no head tag (spec 7, Acceptance criteria, 5), and Fired's "Sample · shaped like CFTC TFF" chip, which sits in its row (spec 1, Behaviour › Research and Alerts on staging: say Sample once, the Fired bullet). Only spec 1's frames with no source line would keep a tag, so spec 1 must recount those.
   - **If no:** the masthead keeps its demo tag and AC26 takes its "no" form. The Scanner keeps its legend box and loses only its sentence. The frame rules in (d) still ship, because they stay within P-3 as written.
3. **Returning staging visitors.** The new positions reach first visits and "Reset demo data" only. The sentinel skips re-seeding (`workspace.ts:206-225`). Alerts merge new samples by id (Q-SAMPLE-MERGE). **Recommended: don't merge positions.** A merge would change a returning visitor's capital at risk and P/L underneath them. The alerts ruling covered alerts, which carry no totals.
