/**
 * What the atlas recorders share: the DevTools-style React hook, the network policy of a browser
 * context, and the clean-up that keeps recorded data free of local ports.
 *
 * REACT_HOOK is installed with `addInitScript` before the app loads. React finds
 * `__REACT_DEVTOOLS_GLOBAL_HOOK__` and reports every commit to it, as it would to React DevTools.
 * On one clock (`performance.now`, ms since navigation) the hook records into `window.__REC`:
 *   - commits: which of our components mounted (name, parent, depth, count), re-rendered or
 *     unmounted; where an update started (a re-rendered component whose parent did not
 *     re-render: `o`); context providers whose value changed (`ctx`); library elements created;
 *   - every fetch, EventSource and localStorage write, with up to five named functions from the
 *     call stack (`names`) and the build chunk they came from;
 *   - user input (click, Enter/Escape/arrows/modified keys, input), URL changes, `data-theme`
 *     changes, and `__MARK(label)` marks the recorder sets around each step.
 * "Ours" is the list of component names declared in the repository's .tsx files (the file index);
 * anything else (MUI, the router…) only counts toward `lib`. Names survive because the recorders
 * drive unminified builds.
 */

/** Runs in the page. `ours` is the component-name list; the function must stay self-contained. */
export const REACT_HOOK = (ours) => {
  const OURS = new Set(ours);
  const now = () => Math.round(performance.now() * 10) / 10;
  const R = {
    commits: [],
    net: [],
    storage: [],
    streams: [],
    theme: [],
    input: [],
    route: [],
    marks: [],
  };
  Object.defineProperty(window, '__REC', { value: R });
  window.__MARK = (label) => R.marks.push({ t: now(), label });

  // Frames that only plumb a call through (React internals, wrappers, this hook) are skipped so
  // the names left are the app functions that caused it.
  const skip =
    /^(fetch|via|Storage\.|setItem|removeItem|EventSource|commit|invoke|flush|perform|recursively|runWithFiber|callCallback|workLoop|renderRoot|beginWork|completeWork|mount|update|dispatch|scheduler|MessagePort|Promise|new |Array|Object\.(?!entries)|Map\.|Set\.|Function\.|History\.|pushState|replaceState|batched|run|processDispatchQueue|dispatchEvent|dispatchDiscreteEvent)/;
  const via = () => {
    const lines = (new Error().stack || '').split('\n').slice(2);
    const names = [];
    let chunk = null;
    for (const l of lines) {
      const fm = l.match(/\/assets\/([A-Za-z0-9_]+?)(?:-[A-Za-z0-9_-]{8})?\.js/);
      if (fm && !chunk && !/^(mui|react|router|rolldown|shared|index)$/.test(fm[1])) chunk = fm[1];
      const m = l.match(/at (?:async )?([A-Za-z_$][\w$.]*) \(/);
      if (!m) continue;
      const n = m[1].replace(/^(Object|Module|window)\./, '');
      if (skip.test(n) || names.includes(n) || n.length < 3) continue;
      names.push(n);
      if (names.length >= 5) break;
    }
    return { names, chunk };
  };

  const ofetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    R.net.push({
      t: now(),
      url,
      m: (init && init.method) || (input && input.method) || 'GET',
      ...via(),
    });
    return ofetch.apply(this, arguments);
  };
  const OES = window.EventSource;
  if (OES) {
    window.EventSource = class extends OES {
      constructor(u, c) {
        super(u, c);
        R.streams.push({ t: now(), url: String(u), ...via() });
      }
    };
  }
  const oget = Storage.prototype.getItem;
  const oset = Storage.prototype.setItem;
  const orem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    const prev = oget.call(this, k);
    R.storage.push({
      t: now(),
      op: 'set',
      k,
      b: String(v).length,
      pb: prev == null ? null : prev.length,
      same: prev === String(v),
      ...via(),
    });
    return oset.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    R.storage.push({ t: now(), op: 'remove', k, ...via() });
    return orem.call(this, k);
  };
  for (const fn of ['pushState', 'replaceState']) {
    const o = history[fn];
    history[fn] = function () {
      const r = o.apply(this, arguments);
      R.route.push({ t: now(), how: fn, url: location.pathname + location.search });
      return r;
    };
  }
  window.addEventListener('popstate', () =>
    R.route.push({ t: now(), how: 'popstate', url: location.pathname }),
  );
  const label = (el) => {
    if (!el || !el.closest) return '';
    if (el === document.body || el === document.documentElement) return 'the page';
    const b = el.closest('button,a,input,[role="option"],[role="button"],[data-testid]') || el;
    return (
      b.getAttribute('data-testid') ||
      b.getAttribute('aria-label') ||
      (b.textContent || '').trim().slice(0, 40) ||
      b.tagName.toLowerCase()
    );
  };
  for (const type of ['click', 'keydown', 'input']) {
    document.addEventListener(
      type,
      (e) => {
        if (
          type === 'keydown' &&
          (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key) ||
            !(
              e.metaKey ||
              e.ctrlKey ||
              ['Enter', 'Escape', 'Tab', 'ArrowDown', 'ArrowUp'].includes(e.key)
            ))
        )
          return;
        R.input.push({
          t: now(),
          type,
          key: type === 'keydown' ? `${e.metaKey ? '⌘' : e.ctrlKey ? 'Ctrl+' : ''}${e.key}` : null,
          target: label(e.target),
          value:
            type === 'input' && e.target && 'value' in e.target
              ? String(e.target.value).slice(0, 30)
              : null,
        });
      },
      true,
    );
  }
  new MutationObserver(() =>
    R.theme.push({
      t: now(),
      v: document.documentElement && document.documentElement.getAttribute('data-theme'),
    }),
  ).observe(document, {
    attributes: true,
    subtree: true,
    attributeFilter: ['data-theme'],
  });

  const CTX = Symbol.for('react.context');
  const PROV = Symbol.for('react.provider');
  const nameOf = (f) => {
    const t = f.type;
    if (!t) return null;
    if (typeof t === 'function') return t.displayName || t.name || null;
    if (typeof t === 'object')
      return (
        t.displayName ||
        (t.render && (t.render.displayName || t.render.name)) ||
        (t.type && (t.type.displayName || t.type.name)) ||
        null
      );
    return null;
  };
  // Fibers alternate between two objects per component; a token per pair tells a re-render
  // (same token) from a mount (new token).
  const tok = new WeakMap();
  let next = 1;
  let prev = new Map();
  let prevSet = new WeakSet();
  const hook = {
    renderers: new Map(),
    supportsFiber: true,
    isDisabled: false,
    inject(r) {
      const id = this.renderers.size + 1;
      this.renderers.set(id, r);
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
    checkDCE() {},
    onCommitFiberRoot(_id, root) {
      try {
        const t = now();
        const curSet = new WeakSet();
        const alive = new Map();
        const mounted = new Map();
        const rr = {};
        const origins = {};
        const ctx = [];
        let lib = 0;
        const stack = [[root.current.child, null, 0, false]];
        while (stack.length) {
          const [f, parent, depth, ancR] = stack.pop();
          if (!f) continue;
          if (f.sibling) stack.push([f.sibling, parent, depth, ancR]);
          const ty = f.type;
          curSet.add(f);
          const fresh = !!(f.alternate && prevSet.has(f.alternate) && !prevSet.has(f));
          if (
            fresh &&
            ty &&
            typeof ty === 'object' &&
            (ty.$$typeof === CTX || ty.$$typeof === PROV) &&
            f.alternate &&
            f.memoizedProps &&
            f.alternate.memoizedProps &&
            f.memoizedProps.value !== f.alternate.memoizedProps.value
          ) {
            const c = ty._context || ty;
            ctx.push([c.displayName || null, parent]);
          }
          const name = nameOf(f);
          let k = tok.get(f) || (f.alternate && tok.get(f.alternate));
          if (!k) k = next++;
          tok.set(f, k);
          if (f.alternate) tok.set(f.alternate, k);
          const ours = name && OURS.has(name) && name !== parent;
          let rendered = ancR;
          if (ours) {
            alive.set(k, name);
            if (!prev.has(k)) {
              const key = `${name}\u0001${parent || ''}\u0001${depth}`;
              mounted.set(key, (mounted.get(key) || 0) + 1);
              rendered = true;
            } else if (fresh && f.flags & 1) {
              rr[name] = (rr[name] || 0) + 1;
              if (!ancR) origins[name] = (origins[name] || 0) + 1;
              rendered = true;
            } else rendered = false;
          } else if (
            name &&
            !prev.has(k) &&
            (typeof f.type === 'function' || typeof f.type === 'object')
          )
            lib++;
          stack.push([
            f.child,
            ours ? name : parent,
            ours ? depth + 1 : depth,
            ours ? rendered : ancR,
          ]);
        }
        const un = {};
        for (const [k, n] of prev) if (!alive.has(k)) un[n] = (un[n] || 0) + 1;
        prev = alive;
        prevSet = curSet;
        const m = [...mounted].map(([key, c]) => {
          const [n, p, d] = key.split('\u0001');
          return [n, p || null, Number(d), c];
        });
        if (m.length || Object.keys(un).length || Object.keys(rr).length || ctx.length)
          R.commits.push({ t, m, u: un, r: rr, o: origins, ctx, lib });
      } catch (e) {
        R.commits.push({ t: now(), err: String(e) });
      }
    },
  };
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    value: hook,
    configurable: true,
  });
};

/** Where live builds' /api GETs go. Every other /api method is aborted: nothing is ever written. */
export const LIVE_API_ORIGIN = 'https://convexa.pages.dev';

/** Per context from openContext: the forwarded /api GETs that production did not answer. */
const FAILURES = new WeakMap();

/**
 * A fresh browser context for one site.
 * - demo: any request off the local server is aborted, so a demo recording never touches the
 *   network (the demo makes none; this makes sure of it).
 * - live: /api GETs are forwarded to production; other /api methods are aborted; third-party
 *   requests (the TradingView embed) go out as they would for a visitor.
 *
 * The route handler never rejects: an unhandled rejection would end the process before run.mjs
 * could stop its servers. A forwarded GET that production does not answer (unreachable, reset)
 * is aborted in the page and kept for closeContext to report. Every other routing call can only
 * fail because the page or context already closed, and that is ignored.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {{ site: 'demo' | 'live', origin: string, viewport: { width: number, height: number }, hookNames?: string[] }} o
 */
export async function openContext(browser, { site, origin, viewport, hookNames }) {
  const ctx = await browser.newContext({ viewport, colorScheme: 'dark' });
  const failures = [];
  FAILURES.set(ctx, failures);
  if (hookNames) await ctx.addInitScript(REACT_HOOK, hookNames);
  const ignoreClosed = () => undefined;
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(`${origin}/api/`)) {
      if (site !== 'live' || req.method() !== 'GET') return route.abort().catch(ignoreClosed);
      const rest = url.slice(origin.length);
      let res;
      try {
        res = await route.fetch({ url: LIVE_API_ORIGIN + rest });
      } catch (error) {
        failures.push(
          `GET ${LIVE_API_ORIGIN}${rest}: ${error instanceof Error ? error.message.split('\n')[0] : error}`,
        );
        return route.abort('failed').catch(ignoreClosed);
      }
      return route.fulfill({ response: res }).catch(ignoreClosed);
    }
    if (url.startsWith(`${origin}/`) || url.startsWith('data:') || url.startsWith('blob:'))
      return route.continue().catch(ignoreClosed);
    return (site === 'live' ? route.continue() : route.abort()).catch(ignoreClosed);
  });
  return ctx;
}

/**
 * Close a context from openContext and return the forwarded GETs production did not answer while
 * it was open. The routes come off first (`ignoreErrors`), so a request still in flight at the
 * close is dropped instead of being routed into a disposed context; what such a request reports
 * after this point is not a failure of the recording, so it is not counted.
 *
 * @param {import('@playwright/test').BrowserContext} ctx
 * @returns {Promise<string[]>}
 */
export async function closeContext(ctx) {
  const failed = [...(FAILURES.get(ctx) ?? [])];
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx.close();
  return failed;
}

/** Throw when a recording ran on answers production never gave. */
export function assertAnswered(what, failed) {
  if (!failed.length) return;
  throw new Error(
    `${what}: production did not answer ${failed.length} forwarded GET${failed.length === 1 ? '' : 's'}; first: ${failed[0]}`,
  );
}

/**
 * Drop the local server from every string in recorded data, since ports differ per run: the
 * origin itself (`http://localhost:<port>/x` → `/x`) and the host anywhere else, plain or
 * URL-encoded (the TradingView embed's `page-uri` carries `localhost%3A<port>`).
 */
export function stripOrigin(value, origin) {
  const { protocol, hostname, port } = new URL(origin);
  const json = JSON.stringify(value)
    .replace(new RegExp(`${protocol}//${hostname}:${port}(?!\\d)`, 'g'), '')
    .replace(new RegExp(`${hostname}(?::|%3A)${port}(?!\\d)`, 'g'), hostname);
  return JSON.parse(json);
}
