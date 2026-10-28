// Final · Planned · the trade journal (spec 08, step 0, 2026-10-28): the kit every journal row builds on.
//
// The eight journal rows (journal-*.mjs, in BOARD BRIEF order through journal.mjs) draw on this file and on the
// Sample journal (design/src/data/journal-sample.mjs); the row lanes' contract is tmp/journal-boards/KIT.md.
// Classes here are prefixed `jr-`; a row prefixes its own `jr-<rowshort>-`. Units are px (the canvas viewer runs
// at a larger default font size, so rem would grow inside fixed boxes).
//
// Canon: DESIGN_SYSTEM.md (Curvature Terminal v2) and its 2026-10-28 Amendments rows: the pen glyph `edit`;
// Positions' section tabs Book · Journal · Review · Rulebook (current tab underlined in text colour, never amber;
// a sideways rail on a phone); the ⌘K Write group; rule 16's verdict-free scope (no amber text in a journal
// read); one amber primary per journal tab (Write entry · Run, or Save, this week's review · Plan a trade).
// And the 2026-10-13 row: P-2 (the closed data-state words), P-3 (sample: dashed frame, the 8px steel hatch
// band, the sample named once) and P-4 (build status and board notes on boards only, never product UI).
import { icon, finalPage } from '../../lib.mjs';
import { provChip, stateTag } from '../../components/data-states.mjs';
import { chartFrame, dataTable, plot } from '../../chart-kit.mjs';
import { dlg, fld, seg, statesBoard, sw } from '../v4/kit.mjs';
import { ACCT_CSS, wallButtons, DEMO as DEMO_URL } from './account-pages.mjs';
import { ANSWER_WORD, CALL, ENTRY, HIGH, KIND_WORD, LATEST, LATER_NOTES, PATH, PLAN, SNAPSHOT, STRINGS, daysBetween, etDate, fmtDate, fmtDay, fmtTime, pct, rFooter, recalledLine, usd } from '../../data/journal-sample.mjs';

export { statesBoard, stateTag, provChip, icon, dlg, fld, seg, sw };

export const JR_CSS = `${ACCT_CSS}
  /* ---- page: the Positions host, header, grid -------------------------------------------------- */
  .jr-page { padding-top: 28px; display: flex; flex-direction: column; gap: 24px; }
  .jr-h { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 24px; }
  .jr-h > div:first-child { flex: 999 1 480px; min-width: 0; }
  .jr-h h1 { margin: 0; font-size: clamp(30px, 3vw, 40px); line-height: 1.1; letter-spacing: -0.02em; }
  .jr-sub { margin: 6px 0 0; max-width: 72ch; font-size: 15px; line-height: 1.5; color: var(--text-dim); text-wrap: pretty; }
  .jr-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .jr-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; }
  .jr-grid.r320 { grid-template-columns: minmax(0, 1fr) 320px; }
  .jr-grid.m840 { grid-template-columns: minmax(0, 840px) 320px; }
  .jr-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .jr-one { width: 100%; max-width: 880px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .jr-foot { margin: 0; font-size: 12px; line-height: 1.5; color: var(--steel); }
  @media (max-width: 1099px) { .jr-grid, .jr-grid.r320, .jr-grid.m840 { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 767px) { .jr-page { padding-top: 18px; gap: 18px; } .has-bar .jr-acts { display: none; } }

  /* ---- panels: quiet never lifts; a normal panel lifts 2px to e2 (rule 21) --------------------- */
  .jr-q, .jr-p, .jr-frame { position: relative; display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px 18px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; container-type: inline-size; }
  .jr-p { box-shadow: var(--e1); transition: transform 180ms ease, box-shadow 180ms ease; }
  .jr-p:hover { transform: translateY(-2px); box-shadow: var(--e2); }
  .jr-frame.is-sample { border-style: dashed; border-color: var(--steel-2); padding-top: 22px; }
  .jr-frame.is-sample::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8px; border-radius: 11px 11px 0 0; background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--steel) 28%, transparent) 6px 12px); pointer-events: none; }
  .jr-fh { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
  .jr-fh h2, .jr-fh h3 { margin: 0; flex: 1 1 auto; min-width: 0; font-size: 15px; font-weight: 600; line-height: 1.35; text-wrap: balance; }
  .jr-ff { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: 12px; color: var(--steel); }
  .jr-sec-t { margin: 0; font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 112.5%; font-weight: 600; font-size: 22px; line-height: 1.25; letter-spacing: -0.01em; }

  /* ---- the entry card -------------------------------------------------------------------------- */
  .jr-card { position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
  .jr-card-h { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; }
  .jr-time { font-size: 13px; line-height: 1.4; color: var(--text-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .jr-ai { margin-left: auto; font-size: 12px; line-height: 1.4; color: var(--text-dim); white-space: nowrap; }
  .jr-kind { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border: 1px solid var(--line-2); border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1; color: var(--phosphor); white-space: nowrap; }
  .jr-kind .ico { width: 12px; height: 12px; }
  .jr-kind.call { border-color: var(--warn); color: var(--warn); }
  .jr-sym { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border: 1px solid var(--line); border-radius: 999px; font: 500 12px/1 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .jr-body { margin: 0; font-size: 16px; line-height: 1.55; color: var(--phosphor); overflow-wrap: anywhere; text-wrap: pretty; }
  .jr-clamp { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
  .jr-clamp.l4 { -webkit-line-clamp: 4; } .jr-clamp.l3 { -webkit-line-clamp: 3; }
  @media (max-width: 599px) { .jr-clamp.l4 { -webkit-line-clamp: 3; } }
  .jr-more { align-self: flex-start; display: inline-flex; align-items: center; min-height: 24px; font-size: 13px; font-weight: 600; }
  /* A standalone link is 24px, 44 under a coarse pointer (rule 7); a phone board draws the 44, as .jr-chip does. */
  @media (pointer: coarse), (max-width: 599px) { .jr-more { min-height: 44px; } }
  .jr-card-f { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  /* A plan's No with his line under it (Screens 4: "went ahead against R3", with his line under it, on the card). */
  .jr-card .jr-quote.jr-card-why { margin-top: -2px; font-size: 14px; line-height: 1.5; }
  .jr-sep { margin: 0 6px; color: var(--steel); }
  .jr-day { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; padding: 4px 0 2px; border-bottom: 1px solid var(--line); }
  .jr-day h3 { margin: 0; font-size: 14px; font-weight: 600; }
  .jr-day .jr-day-l { font-size: 13px; color: var(--steel); }
  .jr-day .mono, .jr-card-f .mono { color: var(--phosphor); }

  /* ---- figures (FigureCell): Mono, tabular, state in the label row; 20 → 17 → 15px by container - */
  /* Cell rules are each cell's right and bottom shadow, clipped at the strip's edge, so a short last row leaves
     panel, not a grey block. */
  .jr-figs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; container-type: inline-size; }
  .jr-fig { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 10px 12px; background: var(--panel); box-shadow: 1px 0 0 var(--line), 0 1px 0 var(--line); }
  .jr-fig-l { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0; }
  .jr-fig-v { font: 500 20px/1.15 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; color: var(--phosphor); overflow-wrap: anywhere; }
  .jr-fig-s { font-size: 12px; line-height: 1.4; color: var(--steel); }
  @container (max-width: 520px) { .jr-fig-v { font-size: 17px; } }
  @container (max-width: 300px) { .jr-fig-v { font-size: 15px; } }
  .jr-gap { font-family: 'IBM Plex Sans', sans-serif; font-weight: 500; color: var(--steel); letter-spacing: 0; }
  .jr-fig-v.jr-gap { font-size: 15px; line-height: 1.4; }
  /* jrFig({ signed: true }): .jr-fig-v's phosphor comes after the base .t-down/.t-up at the same specificity, so
     restate the tint here (signed money only, with its sign; Design → Palette roles). */
  .jr-fig-v.t-down { color: var(--text-down); } .jr-fig-v.t-up { color: var(--text-up); }
  .jr-ans { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; color: var(--phosphor); }
  .jr-i { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--steel); cursor: pointer; }
  @media (pointer: coarse) { .jr-i { width: 44px; height: 44px; } }

  /* ---- controls: the 44px segment, kind chips, buttons ------------------------------------------- */
  .jr-seg { display: inline-flex; flex-wrap: wrap; gap: 2px; max-width: 100%; padding: 3px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line); }
  .jr-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 16px; border: 0; border-radius: 8px; background: transparent; color: var(--steel); font: 600 14px/1.2 'IBM Plex Sans', sans-serif; cursor: pointer; }
  .jr-seg button[aria-pressed="true"] { background: var(--panel); color: var(--phosphor); box-shadow: var(--e1); }
  .jr-seg.sm button { min-height: 32px; padding: 0 12px; font-size: 13px; }
  .jr-seg.fill { display: flex; } .jr-seg.fill button { flex: 1 1 0; }
  @media (max-width: 599px) { .jr-seg.sm button { min-height: 44px; } .jr-seg { display: flex; } .jr-seg button { flex: 1 1 auto; } }
  .jr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .jr-chips.rail { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .jr-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border: 1px solid var(--line-2); border-radius: 999px; background: transparent; color: var(--steel); font: 500 13px/1.2 'IBM Plex Sans', sans-serif; white-space: nowrap; cursor: pointer; }
  .jr-chip[aria-pressed="true"] { border-color: var(--phosphor); color: var(--phosphor); font-weight: 600; box-shadow: inset 0 0 0 1px var(--phosphor); }
  @media (max-width: 599px), (pointer: coarse) { .jr-chip { min-height: 44px; } }
  .btn.jr-44 { height: 44px; min-height: 44px; padding: 0 18px; font-size: 14px; border-radius: 10px; }
  .btn.jr-danger { background: transparent; color: var(--warn); border-color: transparent; padding: 0 6px; }
  .btn.jr-danger:hover { background: var(--warn-tint); }
  .btn .jr-wi { color: var(--warn); }

  /* ---- readings: "above" carries the warning glyph; "within" is plain neutral text (never green) - */
  .jr-above { display: inline-flex; align-items: center; gap: 4px; color: var(--phosphor); font-weight: 600; white-space: nowrap; }
  .jr-above .ico { width: 14px; height: 14px; color: var(--warn); }
  .jr-within { color: inherit; }

  /* ---- strips: a quiet info strip, and the burnt-orange warning strip with its icon -------------- */
  .jr-strip { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--ink-2); font-size: 13px; line-height: 1.5; color: var(--phosphor); }
  .jr-strip > .ico { flex: none; margin-top: 2px; color: var(--steel); }
  .jr-strip.warn { background: var(--warn-tint); border-color: var(--warn); }
  .jr-strip.warn > .ico { color: var(--warn); }
  /* Action labels on the warn tint take text.primary: steel on the tint measured 4.27:1 in light (the base kit's
     .dwarn .dline fix, and the canon's 2026-10-26 row (5)); the strip's icon carries the warning. */
  .jr-strip.warn .btn.ghost { color: var(--phosphor); }
  .jr-strip > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }

  /* ---- counts: neutral steel dots below 20; at n ≥ 20 a rate track with a Wilson whisker ---------- */
  .jr-count { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .jr-count .r { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
  .jr-count .t { font: 500 13px/1.3 'IBM Plex Mono', monospace; color: var(--phosphor); white-space: nowrap; }
  .jr-count .b { font-size: 12px; line-height: 1.4; color: var(--steel); }
  .jr-dots { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .jr-dots i { display: block; width: 8px; height: 8px; border-radius: 50%; box-sizing: border-box; border: 1.5px solid var(--steel); }
  .jr-dots i.k { background: var(--phosphor); border-color: var(--phosphor); }
  .jr-rate { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .jr-rate .tr { position: relative; height: 12px; border-radius: 6px; background: var(--line); }
  .jr-rate .fl { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; background: var(--phosphor); }
  .jr-rate .wk { position: absolute; top: -4px; height: 20px; box-sizing: border-box; border-left: 2px solid var(--steel); border-right: 2px solid var(--steel); background: linear-gradient(var(--steel), var(--steel)) center / 100% 2px no-repeat; }
  .jr-rate .t { font: 500 13px/1.3 'IBM Plex Mono', monospace; color: var(--phosphor); }

  /* ---- his words: quotes (2px steel rule) and highlighted source spans ----------------------------- */
  .jr-quote { margin: 0; padding: 2px 0 2px 12px; border-left: 2px solid var(--steel); font-size: 15px; line-height: 1.55; color: var(--phosphor); overflow-wrap: anywhere; }
  .jr-span { color: inherit; background: color-mix(in srgb, var(--steel) 22%, transparent); box-shadow: inset 0 -1px 0 var(--steel); border-radius: 2px; padding: 0 1px; }

  /* ---- overlays: drawers 520 / 560 / 760, dialogs 560 / 760, a page behind the scrim ------------- */
  .jr-over { position: relative; width: 100%; overflow: hidden; background: var(--ink); color: var(--phosphor); }
  .jr-over > .jr-behind { filter: blur(2px); opacity: 0.6; pointer-events: none; }
  .jr-over > .jr-scrim { position: absolute; inset: 0; display: flex; justify-content: flex-end; align-items: stretch; background: var(--scrim); }
  .jr-over > .jr-scrim.center { justify-content: center; align-items: flex-start; padding: 64px 24px 24px; }
  .jr-drawer, .jr-dlg { display: flex; flex-direction: column; min-width: 0; background: var(--panel); color: var(--phosphor); box-shadow: var(--e4); }
  .jr-drawer { width: min(520px, 100%); border-left: 1px solid var(--line-2); border-radius: 16px 0 0 16px; overflow-y: auto; }
  .jr-drawer.w560 { width: min(560px, 100%); } .jr-drawer.w760 { width: min(760px, 100%); }
  .jr-dlg { width: min(560px, 100%); border: 1px solid var(--line); border-radius: 16px; }
  .jr-dlg.w760 { width: min(760px, 100%); }
  .jr-dh { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .jr-dh h2 { margin: 0; flex: 1 1 auto; min-width: 0; font-size: 16px; font-weight: 700; line-height: 1.35; }
  .jr-db { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; }
  .jr-df { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: auto; padding: 12px 18px; border-top: 1px solid var(--line); }

  /* ---- the bottom sheet (below 600px): grab handle, peek row, actions stacked at 44px ------------ */
  .jr-sheetstage { display: flex; flex-direction: column; justify-content: flex-end; padding-top: 56px; background: var(--scrim); }
  .jr-sheet { display: flex; flex-direction: column; min-width: 0; background: var(--panel); color: var(--phosphor); border-top: 1px solid var(--line-2); border-radius: 16px 16px 0 0; box-shadow: var(--e4); }
  .jr-grab { display: flex; justify-content: center; padding: 8px 0 4px; }
  .jr-grab::before { content: ''; width: 36px; height: 4px; border-radius: 2px; background: var(--line-2); }
  .jr-peek { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 16px; border-bottom: 1px solid var(--line); }
  .jr-peek > .c { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; min-width: 0; }
  .jr-peek .t { font-size: 15px; font-weight: 600; line-height: 1.35; }
  .jr-peek .s { font-size: 12px; line-height: 1.4; color: var(--steel); }
  .jr-peek .btn { flex: none; width: 44px; height: 44px; min-height: 44px; padding: 0; }
  .jr-peek > .stag { flex: none; }
  .jr-sheet-b { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; }
  .jr-stack { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px calc(16px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); }
  .jr-stack .btn { width: 100%; height: 44px; min-height: 44px; }

  /* ---- the phone's sticky, safe-area-padded bottom bar (journal tabs) ----------------------------- */
  .jr-bar { position: sticky; bottom: 0; z-index: 10; display: none; gap: 8px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: var(--glass); backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
  .jr-bar .btn { flex: 1 1 0; height: 44px; min-height: 44px; padding: 0 10px; }
  @media (max-width: 767px) { .jr-bar { display: flex; } }

  /* ---- P-4: a board note above a board (never product UI) ---------------------------------------- */
  .jr-note { display: flex; align-items: flex-start; gap: 4px 12px; padding: 12px clamp(16px, 3vw, 40px); border-bottom: 1px dashed var(--line-2); background: var(--ink-2); font: 500 12px/1.5 'IBM Plex Mono', monospace; color: var(--steel); }
  .jr-note b { font-weight: 600; color: var(--phosphor); }

  /* ---- the account path: three small multiples on one date axis, the event rail ------------------ */
  .jr-path { display: flex; flex-direction: column; gap: 6px; min-width: 0; container-type: inline-size; }
  .jr-path h4 { margin: 0; font: 600 12px/1.3 'IBM Plex Sans', sans-serif; color: var(--phosphor); }
  .jr-evr { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 6px var(--pr) 0 var(--pl); border-top: 1px solid var(--line); }
  .jr-evr .ln { position: relative; height: 22px; }
  .jr-evr .lb { position: absolute; right: calc(100% + 8px); top: 50%; transform: translateY(-50%); font: 500 11px/1 'IBM Plex Sans', sans-serif; color: var(--steel); white-space: nowrap; }
  .jr-evr .ch { position: absolute; top: 50%; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border: 1px solid var(--line-2); border-radius: 999px; background: var(--panel); font: 600 11px/1 'IBM Plex Sans', sans-serif; color: var(--phosphor); white-space: nowrap; }
  .jr-evr .ch .ico { width: 12px; height: 12px; color: var(--warn); }
  .jr-evr .ch.mono { font-family: 'IBM Plex Mono', monospace; font-weight: 500; }
  .jr-evr .ch.e1 { transform: translate(calc(-100% + 10px), -50%); }
  .jr-evr .tk { position: absolute; top: 4px; bottom: 4px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--steel); }
  .jr-evr .tl { position: absolute; top: 50%; transform: translate(4px, -50%); font: 600 11px/1 'IBM Plex Sans', sans-serif; color: var(--phosphor); }
  @container (max-width: 480px) { .jr-evr { padding-right: var(--prn); } .jr-evr .tl { display: none; } }
  .jr-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--steel); }
  .jr-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .jr-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; box-sizing: border-box; background: var(--phosphor); }
  .jr-legend i.o { background: var(--panel); border: 2px solid var(--phosphor); }

  /* ---- rule 7 on a phone: every button, the chart twin's summary and the ⓘ reach 44px below 600px, as under a
     coarse pointer; scoped to the journal's own content, so the shell's chrome is untouched ------------------- */
  @media (pointer: coarse), (max-width: 599px) {
    :is(.jr-page, .jr-sheet, .jr-cp-fsm) .btn, :is(.jr-page, .jr-sheet, .jr-cp-fsm) .btn.sm, :is(.jr-page, .jr-sheet, .jr-cp-fsm) .btn.link { min-height: 44px; }
    :is(.jr-page, .jr-sheet, .jr-cp-fsm) .cf-tab > summary { min-height: 44px; }
    .jr-i { width: 44px; height: 44px; }
  }
`;

// =========================================================================================================
// Board declarations
// =========================================================================================================
/** Step 0's placeholder board, drawn with base CSS only (a stub row carries `css: ''`). The row lane replaces it. */
export const jrStub = (label, { scheme = 'dark', minHeight = 0 } = {}) => `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor);"><div class="sb"><header><h1 class="display">${label}</h1><p class="lead">Spec 08, step 0: this row’s boards are drawn next, by its row lane, on the journal kit and the Sample journal.</p></header></div></div>`;

/** A light board's opts, as every existing light board declares it: `opts: LIGHT`. */
export const LIGHT = { scheme: 'light' };
/** A board: B('staging', 'Staging · demo account', 1440, 1600, (o) => …). Pass LIGHT as `opts` for a light board.
 *  A phone board is w 390 and binds its phone layout in the body closure, not in opts (the site page drops opts). */
export const B = (id, title, w, h, body, opts) => ({ id, title, w, h, body, ...(opts ? { opts } : {}) });

// =========================================================================================================
// Words
// =========================================================================================================
/** The staging source chip: once per frame, the frame's one Sample mark (D1). */
export const SAMPLE_CHIP = 'Sample journal';
/** Board-only notes (P-4). `illustrative` is the BOARD BRIEF's sentence for production boards drawn on the
 *  sample trader's figures; `staging` says what a staging board shows. */
export const JR_NOTES = {
  illustrative: 'Figures illustrative; production shows only the owner’s entries',
  staging: 'Staging · the demo account on the Oct 7, 2026 scenario. The Sample journal is a fictional trader’s; every value is sample data.',
};
/** A board note's sentence (P-4) for every board that counts R2's asks: its answer on the Oct 1 plan is the sample
 *  module's derived one, since the spec doesn't print it. */
const R2_PLAN = Object.values(PLAN).find((p) => p.answers.some((a) => a.rule === 'R2' && a.derived));
export const JR_R2_DERIVED = `R2’s ${fmtDate(R2_PLAN.at)} plan answer is derived (${ANSWER_WORD[R2_PLAN.answers.find((a) => a.rule === 'R2').answer]}); the spec doesn’t print it.`;
/** "Your real account, in your words." heads every journal tab (Information architecture → Placement); the
 *  Journal tab's subline carries the rest. */
export const JR_SUBLINE = 'Your real account, in your words.';
export const JOURNAL_SUB = 'Your real account, in your words. Typed by you, stored on your account.';
/** The canon the spec's Design section cites, for spec cards' `rulings`. */
export const JR_RULINGS = ['rule 4', 'rule 5', 'rule 6', 'rule 7', 'rule 10', 'rule 13 + D-D', 'rule 16 (verdict-free scope, 2026-10-28)', 'rule 17', 'rule 19', 'rule 21', 'rule 22', 'rule 23', 'rule 24', 'P-2', 'P-3', 'P-4', 'P-6', 'P-8–P-13', 'NO-13 B', 'D1', 'D2', 'ruling A', 'Amendments 2026-10-28'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const plain = (s) => String(s).replace(/<[^>]+>/g, '');
const sep = '<span class="jr-sep" aria-hidden="true">·</span>';
/** Join parts with an aria-hidden middle dot, as the demo bar does. */
export const dotJoin = (parts) => parts.filter(Boolean).map((p) => `<span>${p}</span>`).join(sep);

// =========================================================================================================
// The Positions host: tabs, page, header, primaries, the phone's bottom bar
// =========================================================================================================
const TABS = [['book', 'Book', '/positions'], ['journal', 'Journal', '/positions/journal'], ['review', 'Review', '/positions/review'], ['rulebook', 'Rulebook', '/positions/rulebook']];
/** Positions' section tabs, the second use of the Research pattern: the current tab underlined in text colour,
 *  never amber; a sideways rail on a phone. `tabs` narrows the band for a slice (1a reads Book · Journal). */
export function jrTabs(current = 'journal', { tabs = ['book', 'journal', 'review', 'rulebook'] } = {}) {
  return `<nav aria-label="Positions" class="v4-tabs jr-tabs"><div class="wrap tabs-in">${TABS.filter(([k]) => tabs.includes(k)).map(([k, l, h]) => `<a href="${h}"${k === current ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</div></nav>`;
}

/** A journal page on the Positions host. `env`: 'staging' (the demo bar, the demo account) or 'production'
 *  (signed in as the owner unless `signedIn: false`). `tab`: the current tab, or null for no band (the walls).
 *  `bar`: 'journal' | 'review' | 'rulebook' adds the phone's bottom bar (shown under 768px; the header's actions
 *  hide there, so the page keeps one amber). `note`: a P-4 board note above the page. */
export function jrPage({ scheme = 'dark', minHeight = 0, env = 'staging', tab = 'journal', tabs, label = 'Journal', main = '', bar = null, signedIn = true, note = '' } = {}) {
  const demo = env === 'staging';
  const inner = `<div class="wrap jr-page${bar ? ' has-bar' : ''}">${main}</div>`;
  let html = finalPage({ scheme, minHeight, active: 'positions', demo, signedIn: !demo && signedIn, label, main: inner });
  if (tab) html = html.replace('<main id="main"', `${jrTabs(tab, tabs ? { tabs } : {})}<main id="main"`);
  if (bar) html = html.replace(/<\/div>\s*$/, `${jrBottomBar(bar)}</div>`);
  return (note ? jrNote(scheme, note) : '') + html;
}

/** The page header: h1 (Archivo, the account-page size), the 15px textDim subline, and the actions at the right. */
export function jrHeader({ title, sub = '', actions = '' } = {}) {
  return `<header class="jr-h"><div><h1 class="display">${title}</h1>${sub ? `<p class="jr-sub">${sub}</p>` : ''}</div>${actions ? `<div class="jr-acts">${actions}</div>` : ''}</header>`;
}

/** A button. kind: 'primary' (the screen's one amber fill) · 'outline' (neutral) · 'text' · 'link' · 'danger'
 *  (burnt-orange text with its word, never red). size: 'md' (36) · 'touch' (44) · 'sm'. `warn: true` puts the
 *  warning glyph in burnt orange (the Margin call button). */
export function jrBtn(label, { kind = 'outline', ic = '', warn = false, size = 'md', href = '', attrs = '' } = {}) {
  const cls = { primary: 'btn primary', outline: 'btn secondary', text: 'btn ghost', link: 'btn link', danger: 'btn jr-danger' }[kind] || 'btn secondary';
  const sz = size === 'touch' ? ' jr-44' : size === 'sm' ? ' sm' : '';
  const glyph = warn ? icon('warn', size === 'sm' ? 14 : 16, 'style="color: var(--warn);"') : ic ? icon(ic, size === 'sm' ? 14 : 16) : '';
  const inner = `${glyph}${label}`;
  return href ? `<a href="${href}" class="${cls}${sz}"${attrs ? ' ' + attrs : ''}>${inner}</a>` : `<button type="button" class="${cls}${sz}"${attrs ? ' ' + attrs : ''}>${inner}</button>`;
}

/** Each journal tab's one amber primary and its outlined companions (Amendments 2026-10-28, G2):
 *  journal → amber "Write entry" with the pen glyph; review → amber "Run this week’s review" (or, where there is
 *  no Run, "Save this week’s review") with "Write entry" outlined; rulebook → amber "Plan a trade" with "Write a
 *  rule" and "Copy as text" outlined. */
export function jrHeaderActions(tab = 'journal', { review = 'run' } = {}) {
  if (tab === 'review') return `${jrBtn('Write entry', { kind: 'outline', ic: 'edit' })}${jrBtn(review === 'save' ? 'Save this week’s review' : 'Run this week’s review', { kind: 'primary' })}`;
  if (tab === 'rulebook') return `${jrBtn('Copy as text', { kind: 'outline', ic: 'copy' })}${jrBtn('Write a rule', { kind: 'outline', ic: 'edit' })}${jrBtn('Plan a trade', { kind: 'primary' })}`;
  return jrBtn('Write entry', { kind: 'primary', ic: 'edit' });
}

/** The phone's sticky bottom bar: the tab's capture button and an outlined 44px "Margin call" with the warning
 *  glyph. Journal: amber "Write entry"; Review: outlined "Write entry"; Rulebook: amber "Plan a trade". */
export function jrBottomBar(tab = 'journal') {
  const first = tab === 'rulebook' ? jrBtn('Plan a trade', { kind: 'primary', size: 'touch' }) : jrBtn('Write entry', { kind: tab === 'review' ? 'outline' : 'primary', ic: 'edit', size: 'touch' });
  return `<div class="jr-bar" role="toolbar" aria-label="Write">${first}${jrBtn('Margin call', { kind: 'outline', warn: true, size: 'touch' })}</div>`;
}

/** A P-4 board note: a design annotation above a board, never product UI. */
export const jrNote = (scheme, html) => `<div class="v4" data-scheme="${scheme}" style="background: var(--ink); color: var(--phosphor);"><div class="jr-note" role="note" aria-label="Board note">${icon('info', 13)}<span>${html}</span></div></div>`;

/** Grids: main and a 360 rail (Journal), a 320 rail (Review), main 840 and a 320 rail (Rulebook); one column 880
 *  (Tidy, Rule, Import). Below 1100px the rail drops under the main column. */
export const jrGrid = (main, rail, { rail: w = 360 } = {}) => `<div class="jr-grid${w === 320 ? ' r320' : w === 840 ? ' m840' : ''}"><div class="jr-col">${main}</div><aside class="jr-col" aria-label="Rail">${rail}</aside></div>`;
export const jrOne = (html) => `<div class="jr-one">${html}</div>`;

// =========================================================================================================
// Frames and marking
// =========================================================================================================
/** A frame (a container-query panel). Staging: dashed, the 8px steel hatch band, and one "Sample journal" source
 *  chip (D1: the frame's one Sample mark; rows and cards inside carry none). Production: solid, no chip.
 *  `tag`: a state tag for the head (Stored here, Computed, Couldn’t load …). `chipAt`: 'head' or 'foot'. */
export function jrFrame({ env = 'staging', title = '', level = 'h2', tag = '', chip = true, chipAt = 'head', body = '', foot = '', label = '', cls = '', id = '' } = {}) {
  const sample = env === 'staging';
  const sc = sample && chip ? provChip(SAMPLE_CHIP, 'dashed') : '';
  const head = title || tag || (sc && chipAt === 'head') ? `<div class="jr-fh">${title ? `<${level}>${title}</${level}>` : ''}${tag}${chipAt === 'head' ? sc : ''}</div>` : '';
  const ft = foot || (sc && chipAt === 'foot') ? `<div class="jr-ff">${foot}${chipAt === 'foot' ? sc : ''}</div>` : '';
  return `<section class="jr-frame${sample ? ' is-sample' : ''}${cls ? ' ' + cls : ''}"${id ? ` id="${id}"` : ''} aria-label="${esc(plain(label || title || 'Panel'))}">${head}${body}${ft}</section>`;
}
/** A quiet panel (cards, the quick-capture box): never lifts, never sheens. */
export const jrQuiet = (html, { label = '', cls = '' } = {}) => `<section class="jr-q${cls ? ' ' + cls : ''}"${label ? ` aria-label="${esc(label)}"` : ''}>${html}</section>`;
/** A chart frame in the journal's provenance (P-8): staging dashed with the band and the "Sample journal" chip in
 *  its foot; production solid. Titles state the finding only when there is data (P-10). */
export function jrChartFrame(env, { claim, sub = '', body = '', table = '', note = '', legendHtml = '', tag = '', asof = '', source = '' } = {}) {
  const sample = env === 'staging';
  return chartFrame({ claim, sub, body, table, note, legendHtml, kind: sample ? 'sample' : 'primary', source: sample ? SAMPLE_CHIP : source, sourceKind: sample ? 'dashed' : 'solid', asof, state: tag ? tag[0] : '', stateText: tag ? tag[1] || '' : '' });
}

/** The provenance and state words the spec names, from P-2's closed set: 'stored' Stored here · 'computed'
 *  Computed · 'error' Couldn’t load · 'notSetUp' Not set up · 'off' Off · 'signIn' Sign in · 'sample' Sample.
 *  Loading and empty states carry no tag. The error word is spelt with the typographic apostrophe, as the app's
 *  vocabulary and the spec's Copy spell it (data/states.mjs's shared default has a straight one). */
export const JR_ERROR_WORD = 'Couldn’t load';
export function jrTag(key, word = '') {
  const map = { stored: 'local', computed: 'computed', error: 'error', notSetUp: 'notConfigured', off: 'off', signIn: 'locked', sample: 'sample' };
  const k = map[key] || key;
  return stateTag(k, word || (k === 'error' ? JR_ERROR_WORD : ''));
}
/** The staging source chip, alone (for a frame drawn without jrFrame). */
export const jrSampleChip = () => provChip(SAMPLE_CHIP, 'dashed');

// =========================================================================================================
// Walls
// =========================================================================================================
/** Production, signed out: the Positions private-testing wall, as RequireAuth draws it for surface "your journal"
 *  (its default unlock and demo lines, RequireAuth.tsx wallCopy), with the shipped buttons: amber Sign in, then
 *  "See it on the demo →" as a neutral outlined 44px button, then Open a ticker desk (account-pages wallButtons). */
export function jrWall({ path = '/positions/journal' } = {}) {
  return `<div class="ac-wall" role="region" aria-label="Sign in to open your journal">${stateTag('locked', 'Private testing')}<h1 class="display">Sign in to open your journal</h1><p class="steel">This area is limited to invited accounts while Convexa is in private testing.</p>${wallButtons(path)}<p class="dline">Invited accounts only; new sign-ups are closed while Convexa is in private testing. Research, rates, positioning and short data are open to everyone.</p><p class="dline" style="border-top: 1px solid var(--line); padding-top: 12px;">The demo account shows this screen on sample data.</p></div>`;
}
/** Signed in as another account (API 403 owner_only): a sentence and the demo, no tag (open question 12). */
export function jrNotOwner({ path = '/positions/journal' } = {}) {
  return `<div class="ac-wall" role="region" aria-label="Private journal"><h1 class="display" style="font-size: 24px;">This journal is private to the account that owns this Convexa.</h1><div class="ac-wbtns"><a href="${DEMO_URL}${path}" class="btn secondary">See it on the demo →</a></div></div>`;
}

// =========================================================================================================
// Entries
// =========================================================================================================
/** A kind pill: outlined and neutral; the Margin call pill carries the warning glyph and burnt-orange text. */
export const jrKind = (kind) => (kind ? `<span class="jr-kind${kind === 'margin_call' ? ' call' : ''}">${kind === 'margin_call' ? icon('warn', 12) : ''}${KIND_WORD[kind] ?? kind}</span>` : '');
/** A ticker chip (Mono 12, neutral). */
export const jrSym = (t) => `<span class="jr-sym">${t}</span>`;

/** An entry card (a quiet panel with no lift). Row 1: time (Sans 13, textDim), kind pill, ticker chips, AI status
 *  at the right; the body (Plex Sans 16/1.55) clamped to `clamp` lines (4, or 3 on a phone) with "Read more";
 *  footers joined by a middle dot. `strip` sits under the body (e.g. "Not on your account yet …"). */
export function jrCard({ time = '', kind = null, tickers = [], ai = '', body = '', clamp = 4, more = true, foot = [], strip = '', why = '', label = '', cls = '' } = {}) {
  const head = `<div class="jr-card-h">${time ? `<span class="jr-time">${time}</span>` : ''}${jrKind(kind)}${tickers.map(jrSym).join('')}${ai ? `<span class="jr-ai">${ai}</span>` : ''}</div>`;
  const b = body ? `<p class="jr-body${clamp ? ` jr-clamp l${clamp}` : ''}">${body}</p>${more ? '<a href="#" class="jr-more">Read more</a>' : ''}` : '';
  const f = foot.filter(Boolean).length ? `<div class="jr-card-f">${dotJoin(foot)}</div>` : '';
  return `<article class="jr-card${cls ? ' ' + cls : ''}" aria-label="${esc(plain(label || [KIND_WORD[kind] ?? 'Entry', time].filter(Boolean).join(' · ')))}">${head}${b}${strip}${f}${why}</article>`;
}
/** The footers the sample gives an entry: "Written Aug 21 · about Aug 4" on a recalled one; "1 later note";
 *  "Asked 2 rules · went ahead against R3" on a plan (G1); "−0.5R against planned risk · Your label: Sound" on a
 *  trim (G6; a stock with no exit reads `not set` in Sans); "Corrected Aug 22" when a figure was corrected. */
export function jrEntryFooter(entryId) {
  const e = ENTRY[entryId];
  const out = [];
  const rl = recalledLine(entryId);
  if (rl) out.push(rl);
  const notes = LATER_NOTES.filter((n) => n.entry === entryId).length;
  if (notes) out.push(`${notes} later note${notes === 1 ? '' : 's'}`);
  if (e.plan) {
    const p = PLAN[e.plan];
    const no = p.answers.filter((a) => a.answer === 'no').map((a) => a.rule);
    out.push(`Asked ${p.answers.length} rules${no.length ? ` · went ahead against ${no.join(' and ')}` : ''}`);
  }
  const r = rFooter(entryId);
  if (r) out.push(r.gap ? `<span class="jr-gap">${r.r}</span> against planned risk${r.label ? ` · Your label: ${r.label}` : ''}` : `<span class="mono">${r.r}</span> against planned risk${r.label ? ` · Your label: ${r.label}` : ''}`);
  if (e.corrected) out.push('Corrected Aug 22');
  return out;
}
/** A plan's No answers with his line under the footer (Screens 4: "Saved, a No shows as “went ahead against R3”,
 *  with his line under it, on the card"): his words alone for one No, each led by its rule for more. */
export function jrPlanWhy(entryId) {
  const e = ENTRY[entryId];
  if (!e?.plan) return '';
  const nos = PLAN[e.plan].answers.filter((a) => a.answer === 'no' && a.reason);
  if (!nos.length) return '';
  return jrQuote(nos.length === 1 ? nos[0].reason : nos.map((a) => `${a.rule} · ${a.reason}`).join('<br>')).replace('class="jr-quote"', 'class="jr-quote jr-card-why"');
}
/** A sample entry's card, filled from the Sample journal (body only where the spec prints it; pass `body` to
 *  draw an entry whose words the spec gives elsewhere, e.g. a money-in line). */
export function jrEntryCard(entryId, o = {}) {
  const e = ENTRY[entryId];
  const time = e.writtenAt && e.writtenAt.length > 10 ? fmtTime(e.writtenAt) : '';
  return jrCard({ time, kind: e.kind, tickers: e.tickers, body: e.body ?? '', foot: jrEntryFooter(entryId), why: jrPlanWhy(entryId), ...o });
}
/** A day group's header: "Tue Sep 29" with that day's snapshot line, labels in Sans and figures in Mono
 *  ("Account value $34,047 · margin used 147% · call $2,750"). */
export function jrDay(date, { snapshot = null } = {}) {
  const s = snapshot ? SNAPSHOT[snapshot] : null;
  const line = s ? dotJoin([`Account value <span class="mono">${usd(s.accountValue)}</span>`, `margin used <span class="mono">${pct(s.marginUsed, 0)}</span>`, s.id === CALL.snapshot ? `call <span class="mono">${usd(CALL.amount)}</span>` : '']) : '';
  return `<div class="jr-day"><h3>${fmtDay(date)}</h3>${line ? `<span class="jr-day-l">${line}</span>` : ''}</div>`;
}

// =========================================================================================================
// Figures, gaps, answers, readings
// =========================================================================================================
/** A figure cell (FigureCell): the caps label with an optional ⓘ and its state tag, the value in Mono (or a value
 *  gap in Sans), an optional sub line. A value starting with + or − that is money (`signed: true`) takes
 *  textUp/textDown with its sign; counts, rates, R and labels are never tinted. */
export function jrFig({ label, value, tag = '', sub = '', info = '', signed = false, gap = false } = {}) {
  const tone = signed ? (/^[−-]/.test(plain(value)) ? ' t-down' : /^\+/.test(plain(value)) ? ' t-up' : '') : '';
  return `<div class="jr-fig"><div class="jr-fig-l"><span class="caps">${label}</span>${info ? jrInfo(info) : ''}${tag}</div><span class="jr-fig-v${gap ? ' jr-gap' : ''}${tone}">${value}</span>${sub ? `<span class="jr-fig-s">${sub}</span>` : ''}</div>`;
}
/** A strip of figure cells; columns fit by width (150px floor). */
export const jrFigs = (cells, { cols = 0 } = {}) => `<div class="jr-figs"${cols ? ` style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));"` : ''}>${cells.join('')}</div>`;
/** An ⓘ (AccessibleHelp): a 24px button, 44 under a coarse pointer. */
export const jrInfo = (label) => `<button type="button" class="jr-i" aria-label="${esc(label)}">${icon('info', 14)}</button>`;
/** A value gap from rule 24's closed set, in Sans: `not recorded` · `not set` · `not given` · `no basis` ·
 *  `unrecognized` · `—`. */
export const jrGap = (word) => `<span class="jr-gap">${word}</span>`;
/** An answer label (Yes · No · Doesn’t apply · Not answered) or his decision label (Sound · Mixed · Poor): Sans,
 *  never tinted, never a value gap. */
export const jrAnswer = (word) => `<span class="jr-ans">${word}</span>`;
/** "above" with the warning glyph (burnt orange) beside the word, which stays neutral text. */
export const jrAbove = () => `<span class="jr-above">${icon('warn', 14)}above</span>`;
/** "within": plain neutral text, never green. */
export const jrWithin = () => '<span class="jr-within">within</span>';
/** Signed money text: textDown with "−", textUp with "+"; anything else untinted. */
export const jrSigned = (text) => `<span class="mono${/^[−-]/.test(text) ? ' t-down' : /^\+/.test(text) ? ' t-up' : ''}">${text}</span>`;

/** The 44px segment: options start unselected unless `on` names one; size 32 rises to 44 under 600px. `fill`
 *  stretches it to the row. Each option is a toggle button with aria-pressed. */
export function jrSeg(options, on = null, { size = 44, label = '', fill = false } = {}) {
  return `<div class="jr-seg${size === 32 ? ' sm' : ''}${fill ? ' fill' : ''}" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${options.map((o) => `<button type="button" aria-pressed="${o === on}">${o}</button>`).join('')}</div>`;
}
/** Kind chips: optional, single-select; the chosen one is marked by outline and weight, not amber (P-6). 44px on
 *  touch. `rail: true` makes them the phone's sideways rail. */
export const jrChips = (options, on = null, { rail = false, label = 'Kind' } = {}) => `<div class="jr-chips${rail ? ' rail' : ''}" role="group" aria-label="${esc(label)}">${options.map((o) => `<button type="button" class="jr-chip" aria-pressed="${o === on}">${o}</button>`).join('')}</div>`;

/** A strip: 'info' (quiet, not a warning) or 'warn' (burnt orange with its icon: stale, failures). */
export function jrStrip(kind, html) {
  return `<div class="jr-strip${kind === 'warn' ? ' warn' : ''}" role="${kind === 'warn' ? 'alert' : 'note'}">${icon(kind === 'warn' ? 'warn' : 'info', 16)}<div>${html}</div></div>`;
}

/** Count dots below n = 20: n dots of 8px with 4px gaps, k filled phosphor, the rest steel outline, with "k of n"
 *  and, under it, "n counted; rates start at 20". Dots, not bars: a bar reads as a rate. */
export function jrDots(k, n, { text = true, building = true, label = '' } = {}) {
  const dots = `<span class="jr-dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i${i < k ? ' class="k"' : ''}></i>`).join('')}</span>`;
  return `<div class="jr-count" role="img" aria-label="${esc(label || `${k} of ${n}`)}"><div class="r">${dots}${text ? `<span class="t">${k} of ${n}</span>` : ''}</div>${building ? `<span class="b">${n} counted; rates start at 20</span>` : ''}</div>`;
}
/** At n ≥ 20: a 0–100% track, a phosphor fill to the rate and a steel whisker for the Wilson 95% interval, with
 *  "63% (43–79%) · n = 24". Pass the interval as fractions (journal-sample.mjs wilson()). */
export function jrRate(p, lo, hi, n) {
  const P = (x) => `${(Math.max(0, Math.min(1, x)) * 100).toFixed(2)}%`;
  const r = (x) => Math.round(x * 100);
  return `<div class="jr-rate" role="img" aria-label="${r(p)}%, Wilson 95% interval ${r(lo)} to ${r(hi)}%, n = ${n}"><div class="tr"><span class="fl" style="width: ${P(p)};"></span><span class="wk" style="left: ${P(lo)}; width: calc(${P(hi)} - ${P(lo)});"></span></div><span class="t">${r(p)}% (${r(lo)}–${r(hi)}%) · n = ${n}</span></div>`;
}

/** His words: a quote with the 2px steel rule (Sans). */
export const jrQuote = (html) => `<blockquote class="jr-quote">${html}</blockquote>`;
/** A highlighted source span inside his words (hover and focus both reveal it in the product, rule 20). */
export const jrSpan = (text) => `<mark class="jr-span">${text}</mark>`;

// =========================================================================================================
// Overlays
// =========================================================================================================
const head = (title, chip, closeLabel = 'Close') => `<div class="jr-dh"><h2>${title}</h2>${chip}<button class="btn ghost sm" type="button" aria-label="${closeLabel}">${icon('close', 16)}</button></div>`;
/** A drawer from the right: 520 (What’s sent), 560 (the finding drawer) or 760 (the account path). */
export function jrDrawer({ w = 520, title, chip = '', body = '', foot = '', label = '' } = {}) {
  return `<section class="jr-drawer${w === 560 ? ' w560' : w === 760 ? ' w760' : ''}" role="dialog" aria-modal="true" aria-label="${esc(plain(label || title))}">${head(title, chip)}<div class="jr-db">${body}</div>${foot ? `<div class="jr-df">${foot}</div>` : ''}</section>`;
}
/** A dialog: 560, or wide 760 (Edit positions). */
export function jrDialog({ w = 560, title, chip = '', body = '', foot = '', label = '' } = {}) {
  return `<section class="jr-dlg${w === 760 ? ' w760' : ''}" role="dialog" aria-modal="true" aria-label="${esc(plain(label || title))}">${head(title, chip)}<div class="jr-db">${body}</div>${foot ? `<div class="jr-df">${foot}</div>` : ''}</section>`;
}
/** An overlay over a page: `behind` is the page (a jrPage(...) string) drawn blurred and inert under the scrim;
 *  `panel` is a jrDrawer or jrDialog (`center: true` for a dialog). The board is at least 900 tall. */
export function jrOverlay({ scheme = 'dark', minHeight = 0, behind = '', panel = '', center = false } = {}) {
  return `<div class="v4 jr-over" data-scheme="${scheme}" style="min-height: ${Math.max(minHeight, 900)}px;"><div class="jr-behind" aria-hidden="true">${behind}</div><div class="jr-scrim${center ? ' center' : ''}">${panel}</div></div>`;
}
/** A peek row: the sheet's title (and an optional sub line) with a chevron to open or minimize. `tag`: a state tag
 *  beside the title; on staging, the sheet's one Sample mark (D1), as a 1440 drawer carries it in its head. */
export const jrPeek = ({ title, sub = '', open = true, tag = '' } = {}) => `<div class="jr-peek"><div class="c"><span class="t">${title}</span>${sub ? `<span class="s">${sub}</span>` : ''}</div>${tag}<button class="btn ghost" type="button" aria-label="${open ? 'Minimize' : 'Open'}">${icon(open ? 'chevron' : 'chevronU', 18)}</button></div>`;
/** A bottom sheet (every overlay below 600px): grab handle, peek row (with an optional `tag`), body, actions stacked
 *  at 44px. */
export function jrSheet({ title, sub = '', tag = '', body = '', actions = [], label = '' } = {}) {
  return `<section class="jr-sheet" role="dialog" aria-modal="true" aria-label="${esc(plain(label || title))}"><div class="jr-grab" aria-hidden="true"></div>${jrPeek({ title, sub, tag })}${body ? `<div class="jr-sheet-b">${body}</div>` : ''}${actions.length ? `<div class="jr-stack">${actions.join('')}</div>` : ''}</section>`;
}
/** A sheet over a dimmed page strip, for the phone's sheet boards. */
export const jrSheetStage = (sheet) => `<div class="jr-sheetstage">${sheet}</div>`;
/** A bare board surface: the scheme wrapper with the ink background, for a board that is neither a page (jrPage)
 *  nor a states board (statesBoard), e.g. the phone's stack of bottom sheets. `gap` spaces its children. */
export const jrSurface = ({ scheme = 'dark', minHeight = 0, html = '', gap = 24 } = {}) => `<div class="v4" data-scheme="${scheme}" style="width: 100%; min-height: ${minHeight}px; background: var(--ink); color: var(--phosphor); display: flex; flex-direction: column; gap: ${gap}px;">${html}</div>`;

// =========================================================================================================
// The account path (Design → Charts 1): three small multiples on one date axis, with the event rail beneath
// =========================================================================================================
const DAY0 = PATH[0].date;
const dx = (date) => daysBetween(DAY0, date);
const XMAX = dx(LATEST.asOf);
const XT = (ticks) => ({ min: 0, max: XMAX, ticks });
const XTICKS = [['2026-08-04', 0], ['2026-08-21', null], ['2026-09-04', null], ['2026-09-18', null], ['2026-10-06', 1]].map(([d, a], i) => ({ v: dx(d), label: fmtDate(d), align: a ?? undefined, minor: i === 1 || i === 3 }));
const PL = 56, PR = 96, PRN = 56;
const FACET_KEY = { accountValue: 'accountValue', below: 'below', margin: 'marginUsed' };
function facet(key, { last = false, height = 112, spark = false, highLabel = STRINGS.highLabel } = {}) {
  const v = FACET_KEY[key];
  const pts = PATH.map((p) => [dx(p.date), p.v[v]]);
  const dots = PATH.map((p) => ({ x: dx(p.date), y: p.v[v], open: p.hollow, role: 'emph', ...(spark ? { size: 6 } : {}) }));
  const endAt = { long: fmtDate(LATEST.asOf), short: fmtDate(LATEST.asOf) };
  if (spark) {
    // The rail's sparkline: the account value multiple at a sparkline's height, the recorded high as its dashed line
    // (unlabelled: the frame's title states it), the end value at the right. No axes.
    return plot({ height, pl: 4, pr: 72, prn: 72, pt: 8, pb: 8, keyboard: false, x: XT([]), dots, aria: `Account value at each snapshot, Aug 4 to Oct 6, ${usd(LATEST.accountValue)} on Oct 6; recorded high ${usd(HIGH.accountValue)} on ${fmtDate(HIGH.asOf)}`, y: { min: 28000, max: 54000, ticks: [] }, hlines: [{ v: HIGH.accountValue / 100, kind: 'ref' }], series: [{ id: 'av', points: pts, role: 'emph', width: 2, end: endAt, endValue: usd(LATEST.accountValue) }] });
  }
  const common = { height, pl: PL, pr: PR, prn: PRN, pt: 14, pb: last ? 26 : 10, keyboard: false, x: XT(last ? XTICKS : []), dots };
  if (key === 'accountValue') {
    return plot({ ...common, aria: `Account value at each snapshot, Aug 4 to Oct 6; recorded high ${usd(HIGH.accountValue)} on ${fmtDate(HIGH.asOf)}`, y: { min: 28000, max: 54000, ticks: [30000, 40000, 50000].map((v) => ({ v, label: `$${v / 1000}k` })) }, hlines: [{ v: HIGH.accountValue / 100, label: highLabel, kind: 'ref' }], series: [{ id: 'av', points: pts, role: 'emph', width: 2, end: endAt, endValue: usd(LATEST.accountValue) }] });
  }
  if (key === 'below') {
    return plot({ ...common, aria: `Below the recorded high, with money in and out taken out: ${STRINGS.belowEnd} on Oct 6`, y: { min: -50, max: 5, ticks: [0, -20, -40].map((v) => ({ v, label: v ? `−${Math.abs(v)}%` : '0%' })) }, hlines: [{ v: 0, kind: 'zero' }], bands: [{ points: PATH.map((p) => [dx(p.date), p.v.below, 0]) }], series: [{ id: 'below', points: pts, role: 'emph', width: 2, end: endAt, endValue: STRINGS.belowEnd }] });
  }
  return plot({ ...common, aria: `Margin used at each snapshot; R3’s limit 50%; ${pct(LATEST.marginUsed, 0)} on Oct 6`, y: { min: 0, max: 160, ticks: [0, 50, 100, 150].map((v) => ({ v, label: `${v}%` })) }, hlines: [{ v: 50, label: 'R3 · 50%', kind: 'ref' }], series: [{ id: 'mu', points: pts, role: 'emph', width: 2, end: endAt, endValue: pct(LATEST.marginUsed, 0) }] });
}
/** The event rail: the margin call (warning glyph, "Call $2,750"), money ("+$2,500"), trims (a tick with T), and a
 *  notes lane of entry ticks; one lane each, aligned to the multiples' date axis. */
function eventRail() {
  const at = (d) => `${((dx(d) / XMAX) * 100).toFixed(2)}%`;
  const callDay = etDate(ENTRY[CALL.entry].writtenAt);
  const lane = (name, inner) => `<div class="ln"><span class="lb">${name}</span>${inner}</div>`;
  const notes = PATH.length ? Object.values(ENTRY).filter((e) => e.described && e.cls === 'at_time' && e.writtenAt).map((e) => `<span class="tk" style="left: ${at(etDate(e.writtenAt))};"></span>`).join('') : '';
  const trims = ['2026-09-30', '2026-10-02'].map((d) => `<span class="tk" style="left: ${at(d)};"></span><span class="tl" style="left: ${at(d)};">T</span>`).join('');
  return `<div class="jr-evr" style="--pl: ${PL}px; --pr: ${PR}px; --prn: ${PRN}px;" aria-label="Events">${lane('Call', `<span class="ch e1" style="left: ${at(callDay)};">${icon('warn', 12)}Call ${usd(CALL.amount)}</span>`)}${lane('Money', `<span class="ch mono e1" style="left: ${at('2026-09-30')};">+${usd(250000)}</span>`)}${lane('Trims', trims)}${lane('Entries', notes)}</div>`;
}
/** The table twin, the Path's keyboard path (NO-13 B): date · source · account value · margin loan · margin used ·
 *  below the high · money in or out · event. */
export function jrPathTable({ open = false } = {}) {
  const ev = { 's-sep29': 'Margin call $2,750', 's-sep30': 'Trimmed NVDA', 's-oct02': 'Trimmed TSLA puts' };
  const rows = PATH.map((p) => [fmtDate(p.date), { t: p.source + (p.hollow ? ' · written later' : '') }, usd(p.accountValue), usd(p.marginLoan, { dp: 2 }), pct(p.marginUsed, 0), pct(p.below, 1), p.moneyIn.sign() ? `+${usd(p.moneyIn)}` : { t: '—' }, { t: ev[p.id] ?? '—' }]);
  return dataTable({ caption: 'The account path, one row per snapshot', cols: ['Date', 'Source', 'Account value', 'Margin loan', 'Margin used', 'Below the high', 'Money in or out', 'Event'], rows, open });
}
const PATH_LEGEND = '<div class="jr-legend" aria-hidden="true"><span><i></i>written at the time</span><span><i class="o"></i>written later, from memory or a statement</span></div>';
export const PATH_CAPTION = 'The line joins your snapshots. Convexa has no prices between them.';
/** The rail's sparkline (Journal rail, account frame): the account value multiple only, at a sparkline's height. */
export const jrSpark = ({ height = 64 } = {}) => `<div class="jr-path">${facet('accountValue', { spark: true, height })}</div>`;
/** The account path in its frame. `facets`: any of 'accountValue', 'below', 'margin'. `rail`, `table` and `frame`
 *  can be dropped (frame: false returns the body alone, for the 760 drawer or a sheet). `highLabel` relabels the
 *  recorded high's line when it says how the high was written ("… · from memory", Computed facts → Recalled
 *  snapshots). */
export function jrPath(env = 'staging', { facets = ['accountValue', 'below', 'margin'], height = 112, rail = true, table = true, frame = true, open = false, claim = STRINGS.pathTitle, highLabel = STRINGS.highLabel } = {}) {
  const titles = { accountValue: 'Account value', below: 'Below the recorded high', margin: 'Margin used' };
  const body = `<div class="jr-path">${facets.map((f, i) => `<h4>${titles[f]}</h4>${facet(f, { last: i === facets.length - 1, height, highLabel })}`).join('')}${rail ? eventRail() : ''}</div>`;
  if (!frame) return body;
  return jrChartFrame(env, { claim, sub: 'Account value, below the recorded high and margin used at each snapshot, Aug 4 – Oct 6, 2026', body, legendHtml: PATH_LEGEND, note: PATH_CAPTION, table: table ? jrPathTable({ open }) : '' });
}
