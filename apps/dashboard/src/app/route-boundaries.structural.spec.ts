/**
 * SPEC §2.5 / §7 item 7 — EVERY route element in the shell group is either `lazyRoute(...)` or
 * explicitly `ErrorBoundary`-wrapped, so a future route added without a boundary red-builds instead
 * of being noticed. Mutation-guarded: the checker is pure and is fed both fixtures.
 */
import { describe, expect, it } from 'vitest';

const APP_RAW = import.meta.glob(['/src/app/app.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Pure checker (mutation-tested): does this `element={…}` expression carry a boundary? */
export const elementIsBounded = (expr: string): boolean =>
  expr.includes('lazyRoute(') || expr.includes('<ErrorBoundary');

/**
 * Every `element={ … }` on a <Route …> in the file, expression text only — RESTRICTED to routes
 * that actually match a URL (`path="…"` or the `index` flag). Excludes the shell's own LAYOUT
 * route (`<Route element={<AppShell />}>`, no `path`, no `index`): that route has no boundary by
 * design — it IS the nav/footer chrome, so wrapping it would strip that chrome on any page-level
 * throw, which is the opposite of the "nav and footer stay mounted" invariant this file exists to
 * protect (SPEC §2.5, §5). A naive file-wide `element={…}` scan pulls it in as a 19th match with no
 * `lazyRoute(`/`ErrorBoundary`, which is over-matching, not a real violation — filtered out here so
 * "every one is bounded" checks exactly the addressable routes the floor below counts.
 */
function routeElements(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/<Route\b([\s\S]*?)element=\{([\s\S]*?)\}\s*\/?>/g)) {
    const attrs = m[1];
    const isRoutable = /\bpath="/.test(attrs) || /(^|\s)index(\s|$)/.test(attrs);
    if (isRoutable) out.push(m[2]);
  }
  return out;
}

describe('§7 item 7 — every route element is bounded', () => {
  it('the glob is not vacuous', () => {
    expect(Object.keys(APP_RAW)).toHaveLength(1);
    expect(APP_RAW['/src/app/app.tsx']).toContain('<Routes>');
  });

  it('MUTATION GUARD: the checker flags an unbounded fixture and passes a bounded one', () => {
    expect(elementIsBounded('<Landing />')).toBe(false);
    expect(elementIsBounded('lazyRoute(<BlogPage />)')).toBe(true);
    expect(elementIsBounded('<ErrorBoundary variant="route"><Landing /></ErrorBoundary>')).toBe(
      true,
    );
  });

  it('MUTATION GUARD: routeElements ignores a layout route and catches an unbounded page route', () => {
    const fixture = `
      <Route element={<AppShell />}>
        <Route index element={<Landing />} />
        <Route path="/blog" element={lazyRoute(<BlogPage />)} />
      </Route>
    `;
    const elements = routeElements(fixture);
    // The layout route (no path, no index) never appears — poisoning the filter would surface it.
    expect(elements).not.toContain('<AppShell />');
    // Both addressable routes are still caught, one unbounded, one bounded.
    expect(elements).toEqual(['<Landing />', 'lazyRoute(<BlogPage />)']);
    expect(elements.filter((e) => !elementIsBounded(e))).toEqual(['<Landing />']);
  });

  it('the route table declares at least 18 route elements and every one is bounded', () => {
    const elements = routeElements(APP_RAW['/src/app/app.tsx']);
    expect(elements.length).toBeGreaterThanOrEqual(18);
    // The live file's own layout route must not have slipped past the filter above.
    expect(elements).not.toContain('<AppShell />');
    expect(elements.filter((e) => !elementIsBounded(e))).toEqual([]);
  });
});
