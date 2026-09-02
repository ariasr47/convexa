# Adopt vs optimize

Official Next.js splits this work into two workflows. Use this table; do not run both as one blob.

| Signal | Branch | Success bar |
| --- | --- | --- |
| No `cacheComponents: true`, or first enable | **Adopt** | Dev overlay clean on the feature's routes and `next build` passes |
| Flag on, app already builds, user wants instant navigation / a bigger static shell | **Optimize** | Locked instant-navigation check GREEN on a production-like build |

## Adopt (inner loop)

1. Resolve the app directory from `next.config.*`. Hybrid `pages/` + `app/` is fine; the flag
   affects `app/` only.
2. Translate `export const (dynamic|revalidate|fetchCache)` before enabling the flag. Remove
   `experimental.dynamicIO` (fatal rename). `dynamic = 'force-dynamic'` is already the Cache
   Components default — delete rather than translate.
3. Incremental: insert `export const instant = false` on `{page,layout,default}` files (Next
   `cache-components-instant-false` codemod when available), enable the flag, get a passing
   build, then remove opt-outs top-down one feature at a time. Direct: enable the flag and fix
   what the build flags first.
4. Three common blockers: request-time reads (`cookies`, `headers`, `params`, `searchParams`)
   outside `<Suspense>`; sync-IO (`Date.now`, `Math.random`) at module/render time; `"use cache"`
   files that also try to export `instant`.
5. Apply the recipe from the error's bundled guide, not from the overlay summary line.

## Optimize (inner loop)

Requires adopt already done.

1. Name the UI that must be on screen at click time.
2. RED: an instant-navigation check that fails because that UI is not in the static shell.
3. Push each await into a `<Suspense>` scoped to that read; hoist layout UI above the boundary;
   reuse `loading.tsx` or a colocated skeleton.
4. GREEN on a production-like build (`next build` then start), not on `next dev`.
5. Parity: same content, redirects, and client state; only whether the shell commits changed.

`export const instant = false` clears validation; it does not make a route instant. An empty
`fallback={null}` shell can pass a naive check — assert the named UI is present.
