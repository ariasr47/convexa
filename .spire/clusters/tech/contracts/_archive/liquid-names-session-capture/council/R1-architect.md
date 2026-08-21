# R1 — architect position: liquid-names-session-capture

## Position

### Problem (verified, not assumed)

Session archive is fed only after a paid `VendorBundle` reaches `spawn_capture` →
`capture_into` → `archive_session_best_effort` (`apps/api/src/services/chain_snapshot/capture.rs`).
That hand-off exists on cache-miss compute in `load_analytics` / `load_or_compute`
(`analytics.rs`), but a warm `gex_cache` hit in `load_or_compute` returns the snapshot and
**never** calls `spawn_capture`. The warmer path `refresh_analytics` intentionally drops
`_vendor` and must not capture. Net: SPY/QQQ/IWM stay hot via warmer + scanner warm hits and
can miss Tuesday’s prune-proof book — observed as honest `no session book` (QQQ).

Sibling `session-chain-archive` identity `(symbol, et_date)`, first-wins, prune isolation, and
research list/load are **shipped and not reopened**.

### Chosen mechanism: closed-set off-path **ensure** = promote-from-ring, else bounded force-compute

Introduce a **one-way leaf** ensure for the closed set `{SPY, QQQ, IWM}` only (not
`DEFAULT_LIQUID`’s ten names). Trigger is a **dedicated off-path ensure worker** (warmer-shaped
loop cadence is fine; capture is **not** bolted onto `refresh_analytics`). Optional
fire-and-forget wake from scanner/ticker warm traffic for those three symbols is allowed only if
it never joins the trader HTTP await path.

For each name `T` and current America/New_York calendar date `D`
(`et_date_from_as_of` / clock → same New_York rule as the shipped archive):

1. **Presence short-circuit.** `SessionChainArchive::load(T, D)`. Hit → done. No Massive, no
   ring I/O beyond what load needs. Mechanism for “at most one extra vendor fetch per name per
   ET day”: presence + an in-flight singleflight keyed by `(T, D)` for the force-compute arm.
2. **Promote existing ring snapshot (zero Massive).** If archive miss: `ChainSnapshotStore::list(T)`,
   filter rows where `et_date_from_as_of(as_of) == Some(D)`, pick the **earliest** `as_of` among
   matches (matches first-capture provenance under shipped first-wins), `load` body, `deserialize_capture`
   → wire, then call **`archive_session_best_effort(archive, &wire, &body)` directly**.
   **Do not** re-`append` to the ring (avoids burning a 48-slot / churning prune). Observable:
   research load `(T, D)` becomes a hit with mandatory `source_as_of` from that ring row.
3. **Bounded off-path force-compute (only when ring also empty for `D`).** If no ring row maps to
   `D` **and** `T` is in today’s paid-capture / scannable-servable universe for that ET day:
   off-path singleflight `compute_analytics` (or equivalent that yields a live `VendorBundle`),
   then existing `spawn_capture` / `capture_into` (append → prune → archive). Extra Massive lives
   **only** on this arm, off the trader request path, ≤1 successful attempt intent per `(T, D)`
   while identity absent. If `T` is **not** scannable/servable that day: **do not fabricate** —
   leave honest `no session book` (`absent-is-not-none`).

### Comparison (axes)

| Option | Complexity | Cost (Massive / ops) | Scalability | Familiarity | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A. Promote-then-force ensure (chosen)** | Medium: new ensure leaf + worker | Low: Massive only when ring empty for D | 3 names fixed | High: reuses `archive_session_best_effort`, `capture_into`, `et_date_from_as_of` | **Win** — BRIEF axes + invariants dominate |
| B. Capture inside `refresh_analytics` | Low line-count | High: warm-interval refetch×set | Warm set defaults to 10 liquids | High but fights live comment | **Reject** — warmer exclusion unless a *separate* ensure is named; this option is not separate |
| C. Force-compute on every `load_or_compute` warm hit | Low | Stampede risk without gates | Scanner cadence × hot names | High | **Reject** — puts vendor work on the serve/scan hot path lifecycle; violates “off trader request path” spirit even if fire-and-forget |

**Decisive axes:** binding BRIEF constraints (zero Massive when ring already holds today’s book;
warmer stays capture-excluded; closed trio; research read stays Massive-free) over elegance.

### Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| Ensure leaf (new; under/beside `session_chain_archive/`) | Closed-set membership, today’s `D`, presence → promote → force-compute ladder, `(T,D)` singleflight, best-effort warn | Import signals/score/tier/fingerprint/gate; raise 48/14d; hist-chain; object-store; UI |
| `archive_session_best_effort` (unchanged contract) | First-wins insert-if-absent | Become last-wins / RTH-gated |
| `capture_into` / `spawn_capture` | Force-compute arm only (full append+prune+archive) | Be invoked from `refresh_analytics` |
| `load_or_compute` / ticker await | Desk latency; optional non-awaited wake for closed set | Await ensure I/O or Massive |
| Research session-books list/load | Stored bytes only; zero Massive including miss | Trigger ensure or vendor fetch |
| Warmer `refresh_analytics` | Keep gex/price warm; **still drops vendor for capture** | Gain request-path / warm-loop capture |

### Data-structure content (no wire/field invention)

- Session identity remains `(symbol, et_date)` with body = serialized paid capture bytes and
  provenance `source_as_of` = the promoted/captured ring `as_of`.
- Closed ensure set is a **compile-time / config-fixed trio** SPY, QQQ, IWM — structurally not
  `warm_symbols` / full `DEFAULT_LIQUID`.
- In-flight dedupe content: key `(symbol, et_date)` for force-compute only; promote path is
  idempotent via `insert_if_absent`.

### Isolation / error rules

- Ensure failure (archive disabled, ring I/O, compute fail, insert fail) → warn + return; desk
  bundle/SSE/scan HTTP unchanged (`best-effort-isolated-or-null`).
- Research miss while still absent → keep shipped `no session book…` classes; never empty
  fabricated book (`absent-is-not-none`).
- Score / tier / fingerprint / gate: ensure is a one-way leaf non-input
  (`additive-keeps-score-byte-identical`).
- Multi-name work only off-path (`single-ticker-on-demand` narrowed form).
- Operator research remains off trader routes (`operator-vs-trader-path-separation`); this ship
  adds **no** trader UI (`NO_UI_CHANGE`).
- Blobs stay secret-free (`no-secrets-in-image` / existing capture asserts); Massive use is
  research-corpus fill, not a trader redistribution.

### Explicit non-goals

- Do not raise the 48-per-symbol cap or stretch 14-day ring retention.
- Do not buy hist-chain / PIT; do not move bodies to object storage.
- Do not force-capture the whole universe or expand beyond SPY/QQQ/IWM this ship.
- Do not put capture onto the warmer request/refresh path; do not put extra Massive on research
  list/load or on the ticker HTTP await path.
- Do not rewrite Path-B / batch-backtest / replay CLIs; do not change live scoring.
- Do not reopen session-archive identity, first-wins, prune isolation, or absence vocabulary.

### Restated binding constraints

- Domain: America/New_York `et_date` from `as_of` (late ET 20:00–23:59 stays on calendar D);
  first-wins; promote uses existing bytes; force-compute only when ring empty for D.
- Build invariants: `operator-vs-trader-path-separation`, `best-effort-isolated-or-null`,
  `additive-keeps-score-byte-identical`, narrowed `single-ticker-on-demand`,
  `cited-code-is-verified-not-assumed`, `absent-is-not-none`, `no-secrets-in-image`,
  research-only Massive posture.

## Risks I see

- **Ring empty + warm forever:** if warmer never yields a `VendorBundle` to capture and no miss
  compute runs, only the force-compute arm fills the hole — the dedicated ensure must actually
  run on trading days, not only when scanner misses.
- **Eligibility ambiguity:** “paid-capture universe / scannable-servable” must be a concrete
  predicate (universe membership ∩ vendor-covered ET session hours, or equivalent). Wrong
  predicate → either holiday fabrications or continued misses.
- **Promote selection vs first-wins:** earliest-`as_of` among today’s ring rows is the honest
  match to “first capture”; picking latest would still insert once but would mis-label
  provenance relative to the original miss hole if a later ring row exists while archive was
  empty (rare; still prefer earliest).
- **Ensure storm:** without `(T,D)` singleflight + presence check, a tight ensure cadence could
  stampede Massive on the force-compute arm.
- **Disabled archive:** ensure must not invent success; research stays `session archive not storing`.

## Assumptions I'm making about the other two lanes

- **PM:** Acceptance will treat “after an ET day where SPY/QQQ/IWM were scannable/servable, research
  load `(T,D)` is a hit with `source_as_of` and zero Massive on the read” as ship-blocking, and will
  keep warm-cache-is-not-an-excuse as an explicit criterion — not merely “capture still works on
  cold miss.”
- **PM:** Product eligibility for force-compute is “in today’s paid/scannable universe during
  vendor-covered hours,” and absence outside that window remains honest `no session book` rather
  than a failed AC.
- **PM:** Scope stays the closed trio; expanding to full `DEFAULT_LIQUID` / warm set is out, even
  if operationally tempting.
- **UX:** `NO_UI_CHANGE` holds — no trader chrome, nav, Settings control, or Ask-AI disclosure for
  ensure success/failure; operator verification stays on existing research list/load framing.
- **UX:** Research absence copy and successful-load framing/`source_as_of` vocabulary stay as
  shipped by `session-chain-archive`; this feature does not invent a fifth absence class for
  “ensure pending.”
- **Both:** Endpoint paths, JSON field names, and operator copy are theirs / R4’s to name; this
  position only requires an off-path ensure component boundary and the promote-then-force data
  flow above.
