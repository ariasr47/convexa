# Private production sourcemaps (§4.6)

## What we do

| Mode | Sourcemaps |
|------|------------|
| `vite` dev / development build | Linked maps (browser DevTools “just works”) |
| **production** build | **`hidden` maps** — `.map` files are generated, but JS has **no** `//# sourceMappingURL`, so browsers never request them |
| After build | `tools/archive-sourcemaps.mjs` **moves** all `dist/**/*.map` → `apps/dashboard/sourcemaps-private/<stamp>/` |

Public deploy roots (**Cloudflare Pages**, Docker `html/`) therefore contain **no** `.map` files. Nginx also returns **404** for `*.map` as belt-and-braces.

## Local production debug

```bash
npm run build:dashboard
# maps land in apps/dashboard/sourcemaps-private/<stamp>/ (see LATEST)

# Optional: copy maps next to assets for a local preview only (do not deploy)
# cp apps/dashboard/sourcemaps-private/$(cat apps/dashboard/sourcemaps-private/LATEST)/assets/*.map apps/dashboard/dist/assets/
npx nx preview @convexa/dashboard
```

In Chrome DevTools you can also **Add source map…** and point at a private file without putting it on the CDN.

## CI / release hygiene

- `sourcemaps-private/` is **gitignored** — treat archives as local/CI artifacts only.
- If you need maps for a production incident: download the CI artifact for that deploy SHA (wire when CD stores them), never commit them to the repo.

## What this is *not*

- Not public source disclosure.
- Not a substitute for a multi-user error product. **§4.5** in `docs/IMPROVEMENT_BACKLOG.md` tracks optional Sentry (or peer): automatic collection of client exceptions with release-tagged stacks. Without that product, these maps help **you** decode a minified stack you already have (repro, console, user paste). Do not implement §4.5 until the owner accepts vendor, PII scrub, and CSP.
