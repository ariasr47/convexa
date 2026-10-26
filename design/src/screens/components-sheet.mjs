// Components.dc.html — foundations, controls, data primitives, chrome, motion spec.
import { icon, labelInfo, sparkline, seq, wordmark } from '../lib.mjs';

const section = (title, sub, body) => `<section style="display: flex; flex-direction: column; gap: 14px;">
  <div style="display: flex; align-items: baseline; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line);"><h2 class="display" style="margin: 0; font-size: 18px;">${title}</h2><span style="font-size: 12px; color: var(--steel);">${sub}</span></div>
  ${body}
</section>`;

const swatch = (name, v, hex, role) => `<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0;"><div style="height: 44px; border-radius: 8px; background: ${v}; border: 1px solid var(--line-2);"></div><div style="font-size: 12px; font-weight: 600;">${name}</div><div class="mono" style="font-size: 11px; color: var(--steel);">${hex}</div><div style="font-size: 11px; color: var(--steel);">${role}</div></div>`;

function cellState(label, value, sub, extra = '', cls = '') {
  return `<div class="cell ${cls}" style="padding: 12px 14px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); position: relative; overflow: hidden;">${labelInfo(label, extra)}<span class="v">${value}</span><span class="s">${sub}</span></div>`;
}

export function componentsBody() {
  const foundations = section('Foundations', 'tokens.ts is the authority — values shown, never re-derived', `
    <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px;">
      ${swatch('ink', '#0B0F17', '#0B0F17', 'canvas')}${swatch('ink-2', '#0D121B', '#0D121B', 'wells / inset')}${swatch('panel', '#131A24', '#131A24', 'raised surface')}${swatch('raised', '#1B2432', '#1B2432', 'one step up')}
      ${swatch('phosphor', '#E9E4D6', '#E9E4D6', 'primary text')}${swatch('steel', '#8A9BB4', '#8A9BB4', 'secondary / structure')}${swatch('gammaAmber', '#F2A93B', '#F2A93B', 'THE brand · spent, not sprinkled')}${swatch('signal', '#5E8BC4', '#5E8BC4', 'live · links · info')}
      ${swatch('warningOrange', '#E07A3F', '#E07A3F', 'true warnings + icon')}${swatch('up', '#2ecc71', '#2ecc71', 'direction only')}${swatch('down', '#ff5c5c', '#ff5c5c', 'direction only')}${swatch('paper (light)', '#F6F6F3', '#F6F6F3', 'light canvas · amberDeep #C57F19')}
    </div>
    <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 24px; margin-top: 4px;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <span class="caps">Type ramp · three faces, one job each</span>
        <div class="display" style="font-size: 42px; line-height: 1;">Archivo 112.5%</div>
        <div class="display" style="font-size: 28px;">Display · verdicts, page anchors, landing</div>
        <div style="font-size: 15px;">IBM Plex Sans 15 · body copy, rationale, untraced figures</div>
        <div style="font-size: 13px;">Plex Sans 13 · UI default</div>
        <div style="font-size: 12px; color: var(--steel);">Plex Sans 12 · secondary</div>
        <div class="caps">Plex Sans 11 caps +6% · labels (the floor)</div>
        <div class="mono" style="font-size: 42px; line-height: 1; letter-spacing: -0.02em;">573.12</div>
        <div class="mono" style="font-size: 20px;">IBM Plex Mono 20 · figure cells</div>
        <div class="mono" style="font-size: 14px;">Plex Mono 14 · ladder, tables</div>
        <div class="mono" style="font-size: 11px; color: var(--steel);">Plex Mono 11 · captions, provenance, chips</div>
        <p style="margin: 4px 0 0; font-size: 12px; color: var(--steel); line-height: 1.5;"><strong style="color: var(--phosphor); font-weight: 600;">Authorship register.</strong> Mono means <em>this figure is Convexa’s</em> (computed, or traced to a computed value). A figure the model asserted but could not trace renders in Plex Sans with a dotted rule: <span class="sans" style="font-size: 15px; border-bottom: 1px dotted var(--steel-2);">579.50</span> vs <span class="mono" style="font-size: 15px;">568.50</span>.</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <span class="caps">Surfaces · radius · elevation</span>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="panel" style="height: 70px; display: flex; align-items: flex-end; padding: 8px; font-size: 11px; color: var(--steel);">e1 · resting<br>r 12</div>
          <div class="panel" style="height: 70px; box-shadow: var(--e2); transform: translateY(-2px); display: flex; align-items: flex-end; padding: 8px; font-size: 11px; color: var(--steel);">e2 · hover / sticky<br>−2px lift</div>
          <div class="panel" style="height: 70px; box-shadow: var(--e4); background: var(--raised); display: flex; align-items: flex-end; padding: 8px; font-size: 11px; color: var(--steel);">e4 · overlay<br>menus, toasts</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div style="height: 44px; border-radius: 12px; border: 1px dashed var(--line-2); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--steel);">12 · panels</div>
          <div style="height: 44px; border-radius: 8px; border: 1px dashed var(--line-2); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--steel);">8 · controls</div>
          <div style="height: 44px; border-radius: 999px; border: 1px dashed var(--line-2); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--steel);">999 · chips</div>
        </div>
        <div class="well" style="border: 1px solid var(--line); border-radius: 10px; padding: 12px; font-size: 11.5px; color: var(--steel);">Well · <span class="mono">ink-2</span> recess under panels so raised cells and the field read as instruments set into a desk. Depth is luminance-first; shadow is the supporting cue.</div>
        <div style="display: flex; gap: 6px; align-items: flex-end;">${[4, 8, 12, 16, 20, 24, 32, 40].map((s) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;"><div style="width: ${s}px; height: ${s}px; background: var(--amber-tint-2); border-radius: 2px;"></div><span class="mono" style="font-size: 11px; color: var(--steel);">${s}</span></div>`).join('')}<span style="font-size: 11px; color: var(--steel); margin-left: 6px;">4-pt rhythm</span></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <span class="caps">Brand · the arc budget</span>
        <div class="panel" style="padding: 18px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start;">${wordmark(28)}${wordmark(17)}<div style="display: flex; align-items: center; gap: 12px;"><svg viewBox="0 0 100 100" width="34" height="34" fill="none" stroke="var(--amber)" stroke-width="21" stroke-linecap="round"><path d="M 12 91 Q 58 62 88 9"></path><path d="M 12 9 Q 42 62 88 91"></path></svg><span style="font-size: 11.5px; color: var(--steel);">favicon master · heavier stroke (21) so the X survives 16px</span></div></div>
        <p style="margin: 0; font-size: 12px; color: var(--steel); line-height: 1.5;">The convex arc appears in exactly three places — the mark’s X, the landing hero curve-draw, the footer seam. The structure field and the ladder are instruments, not flourishes: they earn no arc.</p>
        <p style="margin: 0; font-size: 12px; color: var(--steel); line-height: 1.5;"><strong style="color: var(--phosphor); font-weight: 600;">Amber rule.</strong> Fill amber on primary actions, the flip line, the active nav and the verdict word. Warnings are burnt orange <em>and</em> an icon. Green and red are direction only — never a rate, never decoration.</p>
      </div>
    </div>`);

  const btnRow = (cls, label) => `<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
    <span class="caps" style="width: 84px;">${label}</span>
    <button class="btn ${cls}">Default</button>
    <button class="btn ${cls}" style="${cls === 'primary' ? 'transform: translateY(-1px); box-shadow: 0 8px 22px -8px rgba(242,169,59,0.6); filter: brightness(1.04);' : cls === 'secondary' ? 'background: var(--raised); border-color: var(--steel);' : 'background: var(--raised); color: var(--phosphor);'}">Hover</button>
    <button class="btn ${cls} focus">Focus</button>
    <button class="btn ${cls} disabled">Disabled</button>
    <button class="btn ${cls}"><span style="width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent; animation: spin 0.9s linear infinite; opacity: 0.8;"></span>Working…</button>
    ${cls === 'primary' ? '<button class="btn primary sm">Small</button><button class="btn primary lg">Large · 44px</button>' : ''}
  </div>`;

  const controls = section('Controls', 'sentence case · 36px default · 44px on coarse pointers · one authored focus ring (text-grade amber, 2px, offset 2)', `
    <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 28px;">
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${btnRow('primary', 'Primary')}${btnRow('secondary', 'Secondary')}${btnRow('ghost', 'Ghost')}
        <div style="display: flex; align-items: center; gap: 10px;"><span class="caps" style="width: 84px;">Link</span><a href="#" class="btn link">What’s sent ${icon('arrow', 13)}</a><a href="#" class="btn link" style="text-decoration: underline;">Hover</a><span class="btn link focus" style="padding: 2px 4px;">Focus</span><span style="font-size: 11.5px; color: var(--steel);">links bind signal, never amber</span></div>
        <div style="display: flex; align-items: center; gap: 10px;"><span class="caps" style="width: 84px;">Segmented</span><span class="seg"><span class="on">Field</span><span>Magnet</span><span>Levels</span></span><span class="seg"><span>Compact</span><span class="on">Comfortable</span></span><span class="seg"><span class="on">Dark</span><span>Light</span><span>System</span></span></div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span class="caps" style="width: 84px;">Chips</span><span class="chip up">positive gamma</span><span class="chip down">negative gamma</span><span class="chip live"><span class="dot"></span>live · open</span><span class="chip warn">${icon('warn', 11)} live offline</span><span class="chip emph">high</span><span class="chip">medium</span><span class="chip outline">SIMULATED</span><span class="chip outline mono">claude-sonnet-5</span><span class="chip outline">Structure as-of 42s</span></div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span class="caps" style="width: 84px;">Symbols</span><span class="sym on">SPY</span><span class="sym">QQQ</span><span class="sym" style="border-color: var(--steel); background: var(--raised);">NVDA · hover</span><span class="sym ring">TSLA · focus</span><span style="font-size: 11.5px; color: var(--steel);">mono, uppercase, 26px, pill</span></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div><span class="caps">Text</span><div class="field" style="margin-top: 5px;"><span class="ph">Default ticker · e.g. SPY</span></div></div>
          <div><span class="caps">Focus</span><div class="field focus" style="margin-top: 5px;"><span class="mono">SP</span><span style="width: 1px; height: 16px; background: var(--amber);"></span></div></div>
          <div><span class="caps">Error</span><div class="field" style="margin-top: 5px; border-color: var(--warn); box-shadow: 0 0 0 3px var(--warn-tint);"><span class="mono">25,00O</span></div><div style="display: flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 11px; color: var(--warn);">${icon('warn', 12)} Enter a whole-dollar amount.</div></div>
          <div><span class="caps">Select</span><div class="field" style="margin-top: 5px;"><span>Balanced Swinger</span><span style="flex: 1;"></span>${icon('chevron', 14)}</div></div>
        </div>
        <div><span class="caps">Unit-bearing numeric · Risk inputs</span><div style="display: flex; gap: 8px; margin-top: 5px;"><div class="field mono" style="flex: 1;">2</div><span class="seg" style="align-self: stretch; padding: 3px;"><span class="on">% of account</span><span>$ per trade</span></span></div><div style="font-size: 11px; color: var(--steel); margin-top: 4px;">Effective cap <span class="mono">$500</span> of <span class="mono">$25,000</span> · a bare number with an inferred unit is forbidden</div></div>
        <div><span class="caps">Multi-select · expirations</span><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px; align-items: start;"><div class="field"><span>All expirations</span><span class="mono steel" style="font-size: 11px;">7–45 DTE</span><span style="flex: 1;"></span>${icon('chevron', 14)}</div><div class="panel" style="padding: 6px; box-shadow: var(--e4); background: var(--raised);">${[['Sep 12', '9 DTE', true], ['Sep 18', '15 DTE', true], ['Sep 26', '23 DTE', true], ['Oct 17', '44 DTE', false]].map(([d, t, on]) => `<div style="display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 6px; font-size: 12.5px;"><span style="width: 16px; height: 16px; border-radius: 4px; border: 1px solid ${on ? 'var(--amber)' : 'var(--line-2)'}; background: ${on ? 'var(--amber)' : 'transparent'}; color: var(--amber-ink); display: inline-flex; align-items: center; justify-content: center;">${on ? icon('check', 12) : ''}</span><span style="flex: 1;">${d}</span><span class="mono" style="font-size: 11px; color: var(--steel);">${t}</span></div>`).join('')}</div></div></div>
      </div>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>`);

  const data = section('Data primitives', 'figure cells replace the accent-bar stat tiles · state is carried by the label row and the register, never by a coloured edge', `
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">
      ${cellState('Call wall', '580.00', '+1.20% from mid')}
      ${cellState('Net flow · 5m', '<span class="up">+12,480</span> <span class="up" style="font-size: 12px;">▲</span>', 'buyers lifting the ask', '<span class="chip live" style="height: 16px; padding: 0 6px; font-size: 11px; margin-left: 2px;"><span class="dot"></span></span>', 'is-live')}
      ${cellState('Mid', '<span class="flash-up">573.12</span>', 'flash-on-tick · 700ms · direction colour decays to phosphor', '', 'is-live')}
      ${cellState('Spread', '$0.01', 'tight · liquid', '', 'offline').replace('tight · liquid', '⏸ offline · last known')}
      ${cellState('Net DEX', '<span style="font-size: 15px; font-weight: 500; color: var(--steel);">unavailable</span>', 'this cycle · never a fake zero')}
      ${cellState('Per-trade cap', '<span style="font-size: 15px; font-weight: 500; color: var(--steel);">not set</span>', '<a href="#">Set your risk inputs →</a>')}
      ${cellState('Suggested size', '<span style="font-size: 15px; font-weight: 500; color: var(--steel);">size not suggested</span>', 'the model returned no size')}
      <div class="cell" style="padding: 12px 14px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line);"><div class="skel" style="height: 11px; width: 50%;"></div><div class="skel" style="height: 22px; width: 62%; margin-top: 6px;"></div><div class="skel" style="height: 10px; width: 40%; margin-top: 6px;"></div></div>
    </div>
    <p style="margin: 0; font-size: 12px; color: var(--steel); line-height: 1.5;">The closed not-a-number vocabulary — <span class="mono">—</span> · unavailable · not given · not set · size not suggested · unrecognized — renders in Plex Sans at 15px, never as a fake figure. Loading (shimmer) ≠ empty (resolved null) ≠ offline (kept value, dimmed, ⏸).</p>
    <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 20px;">
      <div><span class="caps">Widget frame · anatomy</span>
        <div class="panel" style="margin-top: 6px; position: relative; overflow: hidden;"><span class="livebar is-live"></span>
          <div style="display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px 8px;"><span style="color: var(--steel-2); display: inline-flex; margin-top: 2px;">${icon('grip', 14)}</span><div style="flex: 1;"><div style="display: flex; align-items: center; gap: 8px;"><h3 style="margin: 0; font-size: 14px; font-weight: 600;">Title · h2 in the page</h3><span class="chip live" style="height: 18px; font-size: 11px;"><span class="dot"></span>live</span><span style="color: var(--steel-2); display: inline-flex;">${icon('info', 13)}</span></div><div style="font-size: 12px; color: var(--steel);">Subtitle carries the basis: snapshot vs tape, as-of, window.</div></div><span class="seg" style="padding: 2px;"><span class="on">A</span><span>B</span></span><span style="display: inline-flex; color: var(--steel);">${icon('expand', 14)}</span><span style="display: inline-flex; color: var(--steel-2);">${icon('dots', 14)}</span></div>
          <div class="well" style="padding: 12px 16px; font-size: 12px; color: var(--steel);">Body · flush or inset well · container-queried by its own width</div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;"><div class="panel" style="flex: 1; padding: 10px 12px; font-size: 11.5px; color: var(--steel); outline: 2px solid var(--amber-text); outline-offset: 2px;">Selected · plain ring (the conic sweep is retired)</div><div class="panel quiet" style="flex: 1; padding: 10px 12px; font-size: 11.5px; color: var(--steel);">Quiet · context band: no sheen, no lift</div><div class="panel" style="flex: 1; padding: 10px 12px; font-size: 11.5px; color: var(--steel); transform: translateY(-2px); box-shadow: var(--e2); border-color: var(--steel-2);">Hover · −2px, e2</div></div>
      </div>
      <div><span class="caps">Ladder row · tooltip · toast</span>
        <div class="panel" style="margin-top: 6px; padding: 4px 14px;">
          <div style="display: grid; grid-template-columns: 18px 1fr auto auto; align-items: center; gap: 10px; padding: 8px 0;"><span style="width: 14px; border-top: 2px solid var(--amber);"></span><span style="font-size: 12px; color: var(--steel); font-weight: 500;">Gamma flip</span><span class="mono" style="font-size: 14px;">568.50</span><span class="mono" style="font-size: 11px; color: var(--steel);">−0.81%</span></div>
          <div style="display: grid; grid-template-columns: 18px 1fr auto auto; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); background: var(--raised); margin: 0 -14px; padding-left: 14px; padding-right: 14px;"><span style="width: 14px; border-top: 2px solid var(--up);"></span><span style="font-size: 12px; color: var(--phosphor); font-weight: 500;">Call wall · hover</span><span class="mono" style="font-size: 14px;">580.00</span><span class="mono" style="font-size: 11px; color: var(--steel);">+1.20%</span></div>
        </div>
        <div style="position: relative; height: 82px; margin-top: 10px;"><div class="tt" style="left: 0; top: 0;">Strike with the most positive dealer gamma. Tends to act as resistance. Not the analytic gamma flip — see Methodology.</div></div>
        <div style="margin-top: 6px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line-2); box-shadow: var(--e4); font-size: 12.5px;"><span class="up" style="display: inline-flex;">${icon('check', 15)}</span><span style="flex: 1;">Saved to your account.</span><span style="color: var(--steel-2); display: inline-flex;">${icon('close', 14)}</span></div>
      </div>
      <div><span class="caps">Warning strip · empty · refused</span>
        <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 8px; background: var(--warn-tint); border: 1px solid var(--warn); color: var(--warn); font-size: 12px;">${icon('warn', 15)}<span style="color: var(--phosphor);">Couldn’t refresh — showing data from 3 min ago. Retrying automatically.</span></div>
        <div class="panel quiet" style="margin-top: 10px; padding: 18px; text-align: center; border-style: dashed;"><div style="display: inline-flex; color: var(--steel);">${icon('radar', 22)}</div><div style="font-size: 13px; font-weight: 600; margin-top: 6px;">No tickers in your view.</div><div style="font-size: 12px; color: var(--steel); margin-top: 2px;">Pick tickers to build your scan.</div><button class="btn primary sm" style="margin-top: 10px;">Edit view</button></div>
        <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--line); font-size: 12px;"><span style="display: inline-flex; color: var(--steel);">${icon('lock', 14)}</span><span style="flex: 1; color: var(--steel);"><strong style="color: var(--phosphor); font-weight: 600;">Open simulated trade</strong> · Sign in to open a paper position. No real order is ever sent.</span><button class="btn secondary sm">Sign in</button></div>
      </div>
    </div>`);

  const overlays = section('Overlays &amp; navigation', 'command palette · trade entry · nav states · bottom sheet', `
    <div style="display: grid; grid-template-columns: 1.15fr 1fr 0.85fr; gap: 20px; align-items: start;">
      <div><span class="caps">Command palette · ⌘K</span>
        <div class="panel" style="margin-top: 6px; box-shadow: var(--e4); background: var(--raised); overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line);">${icon('search', 16)}<span class="mono" style="font-size: 14px;">NV</span><span style="width: 1px; height: 18px; background: var(--amber);"></span><span style="flex: 1;"></span><span class="kbd">esc</span></div>
          ${[['NVDA', 'NVIDIA · Prime · 88', 'emph', true], ['NVDL', 'GraniteShares 2x NVDA · not in universe', '', false], ['NVO', 'Novo Nordisk · Watch · 41', '', false]].map(([s, n, c, on]) => `<div style="display: flex; align-items: center; gap: 12px; padding: 9px 14px; background: ${on ? 'var(--pal-sel)' : 'transparent'};"><span class="mono" style="font-size: 13px; font-weight: 600; min-width: 52px;">${s}</span><span style="flex: 1; font-size: 12px; color: var(--steel);">${n}</span>${c ? '<span class="chip emph">Prime</span>' : ''}${on ? '<span class="kbd">↵</span>' : ''}</div>`).join('')}
          <div style="display: flex; gap: 14px; padding: 8px 14px; border-top: 1px solid var(--line); font-size: 11px; color: var(--steel-2);"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">↵</span> open ticker</span><span><span class="kbd">⇧↵</span> add to scan</span></div>
        </div>
      </div>
      <div><span class="caps">Trade entry · the one shared sim dialog</span>
        <div class="panel" style="margin-top: 6px; box-shadow: var(--e4); overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line);"><h3 style="margin: 0; font-size: 14px; font-weight: 600;">Review simulated trade</h3><span class="chip outline">SIMULATED</span><span style="flex: 1;"></span>${icon('close', 15)}</div>
          <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 12.5px;">
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; background: var(--amber-tint); font-size: 12px;"><span class="amber" style="display: inline-flex;">${icon('sparkle', 13)}</span><span>Pre-filled from the AI read · <span class="mono">9f2c…</span> · sizing is your call</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">${[['Leg', 'SPY 575C · Sep 18'], ['Qty', '2'], ['Fill', 'market · mid 2.46']].map(([l, v]) => `<div><span class="caps" style="font-size: 11px;">${l}</span><div class="field mono" style="height: 32px; font-size: 12px; margin-top: 3px;">${v}</div></div>`).join('')}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">${[['Stop', '568.50'], ['Target', '579.50']].map(([l, v]) => `<div><span class="caps" style="font-size: 11px;">${l}</span><div class="field mono" style="height: 32px; font-size: 12px; margin-top: 3px;">${v}</div></div>`).join('')}</div>
            <div style="font-size: 11.5px; color: var(--steel);">Max loss <span class="mono" style="color: var(--phosphor);">$492</span> · within your cap (<span class="mono">$500</span>) · fills are modeled at the mid</div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;"><button class="btn ghost">Cancel</button><button class="btn primary">Confirm paper trade</button></div>
          </div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div><span class="caps">Nav item states</span><div class="panel" style="margin-top: 6px; padding: 0 16px; display: flex; gap: 20px; height: 48px; align-items: stretch;">${[['Default', 'var(--steel)', false], ['Hover', 'var(--phosphor)', false], ['Active', 'var(--phosphor)', true]].map(([l, c, a]) => `<span style="position: relative; display: inline-flex; align-items: center; font-size: 13px; font-weight: 600; color: ${c};">${l}${a ? '<span style="position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--amber); border-radius: 2px 2px 0 0;"></span>' : ''}</span>`).join('')}<span class="ring" style="display: inline-flex; align-items: center; font-size: 13px; font-weight: 600; color: var(--steel); align-self: center; padding: 4px 6px;">Focus</span></div></div>
        <div><span class="caps">Phone · bottom sheet peek</span><div style="margin-top: 6px; border-radius: 16px 16px 0 0; background: var(--panel); border: 1px solid var(--line); border-bottom: 0; padding: 8px 14px 12px; box-shadow: var(--e4);"><div style="width: 36px; height: 4px; border-radius: 2px; background: var(--line-2); margin: 0 auto 8px;"></div><div style="display: flex; align-items: center; gap: 8px;"><span class="amber" style="display: inline-flex;">${icon('sparkle', 14)}</span><span style="font-size: 13px; font-weight: 600;">AI read</span><span class="dim">·</span><span class="display" style="font-size: 14px;"><span class="amber">Trade</span> · Bullish</span><span style="flex: 1;"></span><span class="mono" style="font-size: 11px; color: var(--steel);">as of 10:41</span>${icon('chevron', 14, 'style="transform: rotate(180deg);"')}</div></div></div>
        <div><span class="caps">Sticky masthead · condensed</span><div class="panel" style="margin-top: 6px; display: flex; align-items: center; gap: 12px; padding: 8px 14px; box-shadow: var(--e2);"><span class="display" style="font-size: 15px;">SPY</span><span class="mono" style="font-size: 15px; font-weight: 500;">573.12</span><span class="mono up" style="font-size: 11px;">+0.32%</span><span class="chip live" style="height: 20px;"><span class="dot"></span>live</span><span style="flex: 1;"></span><span style="font-size: 11px; color: var(--steel);">All expirations · as-of 42s</span><button class="btn primary sm">Open sim trade</button></div></div>
      </div>
    </div>`);

  const motionRows = [
    ['Flash on tick', 'figure cells, masthead price, P/L', '700 ms ease-out · colour decays up/down → phosphor · transform-free', 'kept — a data signal'],
    ['Live pulse', 'connection chip dot, widget live bar, mid beam', '1.6 s / 2.8 s ease-in-out infinite · opacity + scale only · fires only while genuinely live', 'kept'],
    ['Field particles', 'structure field hedging-pressure dots', 'CSS drift 4.5–6.5 s · opacity 0→0.9→0 · absent when the stream is down', 'new · gated by live'],
    ['Tape trail', 'mid trail dash-offset', '1.2 s linear infinite · reads as flow, not blink', 'new'],
    ['Hover lift', 'panels, cells, symbol chips', '160–220 ms · −2 px translate + e2 · never on quiet context cards', 'kept'],
    ['Masthead condense', 'sticky bar after the deck scrolls out', '220 ms max-height + opacity · IntersectionObserver sentinel', 'kept'],
    ['Expand', 'widget → focus overlay', 'View Transitions shared-element morph · Fade fallback · instant under reduced motion', 'kept'],
    ['Read arrives', 'AI read loading → produced', 'skeleton takes the exact final shape · 180 ms opacity crossfade · no slide', 'new'],
    ['Bottom sheet', 'phone AI read', 'spring 320 ms · drag to dismiss · peek row always visible', 'new'],
    ['Hero curve-draw', 'landing only', '900 ms cubic-bezier(0.16,1,0.3,1) · THE one orchestrated moment · everything else is a data signal', 'kept'],
  ];
  const motion = section('Motion &amp; liveness', 'one orchestrated moment (the landing curve) · everything else is a data signal · transform/opacity only · prefers-reduced-motion honoured everywhere', `
    <div class="panel quiet" style="overflow: hidden;">
      <div style="display: grid; grid-template-columns: 1.1fr 1.4fr 2.4fr 0.8fr; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--line);" class="caps"><span>Interaction</span><span>Where</span><span>Spec</span><span>Status</span></div>
      ${motionRows.map(([a, b, c, d], i) => `<div style="display: grid; grid-template-columns: 1.1fr 1.4fr 2.4fr 0.8fr; gap: 12px; padding: 9px 16px; font-size: 12px; ${i ? 'border-top: 1px solid var(--line);' : ''}"><span style="font-weight: 600;">${a}</span><span style="color: var(--steel);">${b}</span><span class="mono" style="font-size: 11.5px; color: var(--steel);">${c}</span><span><span class="chip ${d.startsWith('new') ? 'emph' : ''}">${d}</span></span></div>`).join('')}
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; font-size: 12px; color: var(--steel); line-height: 1.5;">
      <div class="panel quiet" style="padding: 12px 14px;"><strong style="color: var(--phosphor); font-weight: 600;">GPU path.</strong> The structure field stays Canvas2D on the desk (shipped, hover probe, reduced-motion aware). The WebGL2 twin already in <span class="mono">/lab</span> is the upgrade path for the heat field and particles — same model, same honesty captions. Three.js earns its place only on the landing surface (below), not on the desk.</div>
      <div class="panel quiet" style="padding: 12px 14px;"><strong style="color: var(--phosphor); font-weight: 600;">Liveness that is true.</strong> Live chrome exists only where a stream is genuinely live: pulses stop, particles clear and cells dim with ⏸ on a payload gap &gt; 15 s. Static reads never fake a heartbeat.</div>
      <div class="panel quiet" style="padding: 12px 14px;"><strong style="color: var(--phosphor); font-weight: 600;">Reduced motion.</strong> Every animation is behind <span class="mono">prefers-reduced-motion</span>; flashes become a static colour hold, the curve renders drawn, sheets snap.</div>
    </div>
    ${sparkline(seq(40, 5, 0, 1), { width: 300, height: 30, color: 'var(--signal)', dot: true, cls: 'trail' }).replace('<svg', '<svg class="is-live"')}`);

  return `<div class="is-live" style="width: 1440px; min-height: 2720px; background: var(--ink); color: var(--phosphor); padding: 36px 40px 48px; display: flex; flex-direction: column; gap: 36px;">
    <div style="display: flex; align-items: flex-end; gap: 24px;">
      <div><div class="caps" style="color: var(--amber-text);">Design system · Curvature Terminal v2</div><h1 class="display" style="margin: 6px 0 0; font-size: 30px;">Components &amp; states</h1><p style="margin: 8px 0 0; max-width: 820px; font-size: 13.5px; color: var(--steel); line-height: 1.55;">The tokens, faces and rules already enforced in <span class="mono">tokens.ts</span> stay. What changes: the accent-bar stat tile becomes a figure cell, panels get a recessed well and a single live bar, the amber budget is spent on the verdict, and liveness is a set of gated data signals rather than decoration.</p></div>
    </div>
    ${foundations}${controls}${data}${overlays}${motion}
  </div>`;
}
