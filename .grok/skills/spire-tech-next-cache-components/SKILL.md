---
name: spire-tech-next-cache-components
description: Use when writing or reviewing Next.js Cache Components, cacheComponents config, use cache, instant navigation, or blocking-prerender errors. Triggers on adopting or optimizing Cache Components. Skip non-Next stacks. Prefer this over spire-tech-react-async-data for this Next caching model. Prefer spire-tech-next-best-practices for general Next docs lookup.
when-to-use: Cache Components, cacheComponents, use cache, instant navigation, blocking prerender, Next.js caching
---

# Next.js Cache Components — adopt, then optimize

Own **Cache Components adoption and instant-navigation optimization** on Next.js App Router. Do not
own generic React fetch/waterfall craft (`spire-tech-react-async-data`) or Next-framework docs
lookup (`spire-tech-next-best-practices`).

**Exit artifact:** `cacheComponents` on with a passing `next build` for adopted features, or a
locked instant-navigation check for an optimized route. Report which branch (adopt vs optimize).

## Critical procedure

1. Confirm Next.js App Router (`next.config.*` plus `app/` or `src/app/`). Stop on Pages-only or
   non-Next. Read the bundled Cache Components guide under `node_modules/next/dist/docs/`.
2. **Branch.** Flag off or first enable → **adopt**. Flag already on and the route builds →
   **optimize**. Do not optimize an app that cannot build with `cacheComponents: true`.
3. **Adopt.** Enable top-level `cacheComponents`. Translate leftover `dynamic` / `revalidate` /
   `fetchCache` exports; remove `experimental.dynamicIO`. Choose with the human: quiet pre-step
   (opt every page/layout out with `export const instant = false`, then remove opt-outs one
   feature at a time) or fix blocking routes directly. Work one product surface at a time against
   `next dev` overlay recipes; `next build` is the per-feature gate, not the working surface.
4. **Optimize.** Encode the UI that must commit on navigation as a failing instant-navigation
   check, push request-time reads below a `<Suspense>` scoped to that read, reuse existing loading
   UI, then keep the passing check. Do not measure instantness on `next dev`.
5. Verify shell vs streamed content in the browser (`spire-tech-visual-evidence`). A passing build
   is not proof of what painted.
6. Ambiguous cache-freshness or "should this stay blocking?" is a human check-in, not agent guess.

## Reference routing

| Read when | Reference |
| --- | --- |
| Choosing adopt vs optimize, or the inner loops | [Adopt vs optimize](references/adopt-vs-optimize.md) |

## Stop conditions

Stop when the project is not Next App Router, when Next is older than the Cache Components APIs
and the human has not approved an upgrade, or when a fix would change product behavior (auth,
redirects, what is public). Report the blocker.

## Do not

- Do not apply Cache Components to Pages-only or non-Next apps.
- Do not start the optimize loop before `cacheComponents: true` builds.
- Do not leave a coarse page-level `<Suspense>` that empties the static shell.
- Do not download third-party workflow skills at runtime; sequence here, recipes in bundled docs.
- Do not commit or open PRs without the human when the official loop would check in.
