# Implementation corrections — portfolio demo platform

These corrections preserve the approved product behavior. The owner delegated provider/facade design and implementation; they require no new capability, backend change, payment, data migration or release authority.

## Observed failures

1. Browser-native dynamic imports cache a failed module URL. The independent read-only Chrome 154 probe failed on initial HTTP 503 and again after restoring HTTP 200, with exactly one request. Calling the same import again cannot fulfill the promised cold/provider/controller Retry.
2. The shared controller launched overlapping asynchronous frame batches. A deferred loader probe observed six frames reaching replacement subscribers before their next tick, six while paused, and 2,154 after the finite end. Eligibility was only checked before awaiting catalog data.
3. Demo analysis inferred a contiguous expiry set from DTE min/max. A non-contiguous selection needs its existing authored fingerprint to select the exact catalog variant. Export did not receive the selected fingerprint at all, so a selected November view could export all-expiry context.
4. The scanner flash condition considered only live connection flags, making simulated updates flash. The demo branch must explicitly disable it while preserving the live condition.

## Settled implementation rulings

- Keep six canonical small JSON seed assets in catalog/** with symbol, base, step and phase. Reference them through Vite URL assets that are not inlined. Lazy fetch validates symbol and finite seed values, then calls the existing makeScenario factory; this does not add new domain math. Successful values and concurrent loads are cached; rejected requests are removed so Retry can fetch again. The six old TS wrappers must either use the same canonical JSON or carry a PARKED marker, never independent duplicate seeds. No production test-only path may bypass the real asset loader.
- The controller admits one bounded frame batch, invalidates pending work on pause/end or observer-cohort changes, and rechecks eligibility after each await before delivering. New subscribers must wait for a new frame. Retry preserves the current scenario offset; ordinary reload still starts at the anchor.
- POST sample analysis selects the exact known variant using the already supplied snapshot fingerprint and validates its DTE coherence. Add optional sampleFingerprint to the existing export facade's local options. Carry that metadata only in demo, using a named local request header if needed; live requests and generated server DTOs remain unchanged. The local export adapter must reject a mismatched/unknown fingerprint and return the same authored variant as the view.
- F4 adds an optional fingerprint prop to StateExportDrawer; F6 passes the selected bundle fingerprint at its existing TickerDashboard join. F4 also owns the narrow Scanner.tsx demo flash guard. Other ownership remains unchanged.

## Verification owed

Fold asset failure/recovery and exact variant/export cases into G2, deferred-frame invalidation into G3, and actual built-asset failure/recovery plus selected-view action/export into G1. Keep the six-group test budget. This note records failures and decisions, not a passing implementation or QA verdict.
