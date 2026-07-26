# scanner — UX_BLUEPRINT (Phase P3 design authority → consumed by P4)

> GATE U·X deliverable. Resolves **Q3** (freshness/cadence copy) and **Q6** (column set, sort/density
> defaults, mobile card shape) and pins the **four honest states** with their exact user-facing copy.
> This is the **design authority the P4 `/scanner` build implements** — **P3 ships no UI** (the read
> API + wire + conformance only). Stands on `PRODUCT_CONTRACT.md` §3–§4, `ARCHITECTURE_CONTRACT.md`
> §4.1/§5, `docs/design/DESIGN_SYSTEM.md`, and the `convexa-design` SKILL. No math, no server internals,
> no endpoint/wire decisions (those are `INTERFACE_CONTRACT.md`). Binds only what the UI shows/says.

---

## 0. Design tokens + signature (DESIGN_RULES front-half — carried into P4)

### Brief (pinned)
One dense, honest, terminal-grade triage table answering *"which ticker deserves the deep-dive right
now?"* — morning triage (default sort read) and ambient radar (same surface left open) are **one
table, one set of states, no mode toggle**. Heritage is the **Curvature Terminal**, not a SaaS
dashboard: warm ink canvas, mono numerals as personality, **one dominant amber spent (not sprinkled)**,
and **honesty styled as a material** (stale/error/building are designed states, never hidden). The
word **"live" never appears on this table** (`[live-vs-static-isolation]`).

### Structure before style
- **Desktop / ≥`sm`:** a single dense data table, sticky header row, sticky first (Symbol) column,
  one row per view symbol, `compact` density default. Row = tap/click target → warm-navigates to the
  Ticker page. A page-level freshness header sits above the table; a worker-down banner (when engaged)
  sits between header and table over the intact rows.
- **`<sm` (mobile, ≤393px design target):** the table **collapses to stacked cards** (the Positions
  card-collapse pattern) — one card per symbol, no horizontal scroll, no clipped columns.
- **Structure is state-complete:** every one of the four honest states (skeleton · empty view ·
  worker-down banner · per-row degrade) is expressible in **both** the table and the card layout.

### Token plan (which slot each datum binds — values live in `tokens.ts`, never a hex)
| Datum | Face / slot | Rule |
|---|---|---|
| Symbol | mono, `text.primary` | identity; sticky-left column / card header |
| Price | mono `tabular-nums`, `text.primary` | **`useFlashOnChange`** on change (the sanctioned data-signal flash — the ONLY aliveness cue) |
| Chg % | mono, **`success`/`error` for DIRECTION** | the one sanctioned green/red use here (price direction) |
| Score | mono `tabular-nums`, `text.primary` | **NEVER green/red** (a rate/statistic — skill rule 2); no amber (amber is spent on tier) |
| Tier | **`TintChip` tone `emphasis`** (`textAmber`) | the amber spend of the row; consumed enum via closed lookup |
| Regime / Vol regime | mono/label, `text.secondary` (`steel`) | closed engine label enums, closed FE lookup, humanized |
| Flip level · wall levels | mono `tabular-nums`, `text.primary` | consumed levels |
| Dist-to-flip % · dist-to-wall % | mono, **`steel`/neutral — NEVER green/red** | a signed *proximity/rate*, a no-side datum (skill rule 2; the Stage-3 proximity-chip fix) |
| As-of | small mono, `steel` | relative time; **not** rendered when `status=='building'` |
| Status | `TintChip` + icon (see §3) | `warning.*` + icon for stale/error (hue never alone); neutral for building; quiet for ok |
| Sign-in / links | `signal` (blue) | quieter than amber; standard inline prompt |
| Worker-down banner | `warning.*` + icon | true-warning surface → burnt orange + icon, always |

Type floor ≥11px on every chip/label; row/card tap targets ≥44px; every interactive element gets a
visible authored `:focus-visible` ring; **no 4th `arc.ts` importer** (the table earns no arc).

### Self-critique (design red-flags cleared)
- **Amber spent, not sprinkled:** only the **tier chip** carries amber; score/price/distances stay
  mono-neutral. One amber spend per row.
- **Green/red only on `chg_pct`:** score, distances, walls, regime — all neutral. A className-identity
  test (skill §Enforcement) guards that a distance/score cell ≡ a neutral cell.
- **No "live", no per-row stream, no second motion moment:** the price flash is the sole motion; it is
  paint-only and honors `useReducedMotion`.
- **Honesty is styled:** stale/error/building are first-class chips with copy + icon, never a blank or
  a dressed-up-fresh number.
- **Mobile is a first-class terminal:** cards, no 393px horizontal overflow (joins the e2e route set).

---

## 1. Q6 — Column set, order, sort, density

### 1.1 Column set (dense table, left→right — triage reading order). Nothing §3.1-required dropped.
| # | Column | Source key (wire) | Notes |
|---|---|---|---|
| 1 | **Symbol** | `symbol` | sticky-left, mono |
| 2 | **Price** | `price` | mono, `useFlashOnChange` |
| 3 | **Chg %** | `chg_pct` | direction color (success/error) |
| 4 | **Score** | `score` | headline; default sort; neutral |
| 5 | **Tier** | `tier` | `TintChip` emphasis (amber) |
| 6 | **Regime** | `regime` | closed lookup label |
| 7 | **Vol** | `vol_regime` | closed lookup label |
| 8 | **Flip** (± to flip) | `flip` + `dist_to_flip_pct` | level mono; distance neutral, signed |
| 9 | **Walls** (± to wall) | `call_wall` / `put_wall` + `dist_to_wall_pct` | nearer-wall distance neutral, signed; both wall levels available on hover/expanded |
| 10 | **Updated** | `as_of` | relative time, steel; hidden when building |
| 11 | **Status** | `status` | closed-lookup chip (§3) |

Any numeric field may be `null` (partial/failed compute) → render **honestly-missing** (an em-dash
`—` in steel), never `0`, never a fabricated value.

### 1.2 Sort + density defaults
- **Default sort = Score, best-first (descending)** — the triage read (§3.1). User-changeable via
  column-header controls; the choice **persists in the per-account view** (`sort` in the wire view).
- **Sortable keys** (closed set the FE offers): `score` · `symbol` · `price` · `chg_pct` ·
  `dist_to_flip_pct` · `dist_to_wall_pct`. Sorting is **client-side re-order of the returned rows**;
  it never re-derives a value. `null` values sort last regardless of direction.
- **Default density = `compact`** (dense terminal table). `comfortable` is the alternate; density
  persists in the per-account view.

### 1.3 Mobile card shape (`<sm`, ≤393px — Positions card-collapse pattern)
Each row → one card, whole card is the warm-navigate target (≥44px):
- **Header:** Symbol (mono, left) · Tier chip (amber, right) · Status chip (when not `ok`).
- **Primary line:** Price (flash) · Chg % (direction color).
- **Score:** prominent, its own line/label.
- **Secondary 2-col grid:** Regime · Vol · Flip (± to flip) · Nearer wall (± to wall) — neutral.
- **Footer:** "Updated {relative}" (steel) — replaced by the status note when stale/error/building.
- **No horizontal overflow at 393px**; long values wrap or truncate within the card, never clip.

---

## 2. Q3 — Freshness / cadence copy (self-describing; never "live")

Honors `[model-read-carries-its-assumptions]` (self-describing freshness, the two-speed basis) and
`[digested-labels-not-raw-dump]` (closed-lookup labels). No wording may imply more currency than exists.

### 2.1 Page-level two-speed header (always present above the table)
> **Prices ~30s · structure ~3 min · hot names sooner**

Glossary/tooltip on the header (the `Jargon` inline term or a help affordance):
> "Prices refresh about every 30 seconds; the full options structure re-computes about every 3 minutes;
> names that just moved re-compute sooner. This is a polled snapshot, not a live feed."

The specific numerals track D4 defaults (fast ~30s · slow ~2–3 min); if an operator retunes cadence the
copy is driven from the same basis, never hardcoded past the header. **The word "live" is forbidden here
and everywhere on the table** (AC-9).

### 2.2 Per-row freshness ("Updated" + status)
- **`ok`:** show **"Updated {relative}"** in steel (e.g. "Updated 42s ago", "Updated 2m ago"),
  derived from `as_of`. No status chip (quiet — freshness is the only cue).
- The relative-time string is display transport off the `as_of` epoch; it is not a new freshness claim.

### 2.3 Worker-down banner (heartbeat stale or absent — over intact rows)
Engaged when the sweep heartbeat is behind/missing (the FE computes the age from the heartbeat epochs;
see INTERFACE §4). Burnt-orange surface + warning icon, **rows stay rendered beneath it**:
- Heartbeat present but behind:
  > ⚠ **Sweep last ran {X} ago** — showing the last known rows.
- Heartbeat absent (`sweep` null / worker never reported):
  > ⚠ **Sweep hasn't reported yet** — showing the last known rows.

`{X}` is a coarse relative age ("3 min", "12 min", "1 hr"). Never a 5xx, never a blank page (AC-6).

---

## 3. The four honest states + closed status vocabulary (copy is pinned; FE renders via closed lookup)

The per-row status comes from the closed set `ok`/`stale`/`error`/`building` — the FE maps it through a
**fixed lookup and NEVER re-derives** it (`[digested-labels-not-raw-dump]`, AC-9/AC-10). Unknown value →
treat as unavailable (fail-honest), never guess.

### 3.1 Per-row status (chip copy + tooltip)
| status | Chip (label + tone) | Price behavior | Tooltip (glossary) |
|---|---|---|---|
| `ok` | *(no chip)* | fresh | — |
| `stale` | **Stale** — `warning` + icon | **frozen price kept WITH its as-of stamp**, never re-presented as fresh | "Last computed {as-of}; the sweep is behind. Price is frozen at its last read." |
| `error` | **Error** — `warning` + icon | last-known value dashed if none | "This symbol failed its last compute. Only this row is affected — the rest of the table is live-scored on the stated cadence." |
| `building` | **Building** — `neutral` (TintChip) | no price / `—`; **no fabricated score** | "Tracked, not yet computed. First score is pending." |

### 3.2 Page-level states
- **First-load skeleton** — shimmer placeholder rows/cards while the first `/api/scan` read is in
  flight. **Distinct** from `building` and from the worker-down/stale degrade. No copy (or a quiet
  "Loading scan…"); never shows a fabricated number.
- **Empty view** — a **signed-in** user whose saved view has **no symbols**:
  > **No tickers in your view.** Pick tickers to build your scan.
  with a CTA opening the view editor. An **anonymous** user **never** reaches this — an empty/unset
  default falls back per **D2** (owner list, else top-20-by-score, else the universe in `building`),
  never a dead empty screen (AC-1).
- **Worker-down banner** — §2.3, over intact stale rows (AC-6).
- **Per-row degrade** — §3.1 `stale`/`error` on a single row; the table lives on around it (AC-5).

### 3.3 Anonymous sign-in affordance (never overclaim)
Anonymous users see a standard inline prompt near the view controls:
> **Sign in to customize your view.**

Signed-out interactions with the editor/save show the same prompt. **Never** write "Saved to your
account" or any persistence claim for an anonymous user (skill rule 4; the save is refused server-side —
AC-3).

---

## 4. Where each datum surfaces (consumption fidelity)

Every market number is **consumed, never re-derived** (AC-10): score/tier/regime/vol/flip/walls are
the SAME values the Ticker page shows for that symbol from the same compute. The FE renders them; it
does not recompute, unify, or re-band anything. Distances (`dist_to_flip_pct`, `dist_to_wall_pct`)
arrive pre-computed on the wire (signed % transport) — the FE displays them, it does not derive them.

Row click → **warm-navigate to the existing Ticker page** for `symbol` and nothing else — no order,
no trade, no broker action (`[no-real-order-path]`, AC-11). Warmth is a **speed-only** difference; the
Ticker page content is identical warm or cold (AC-12).

---

## 5. AC → component-state map (P4 verification surface)

| AC | Satisfied by state(s) | Marker |
|---|---|---|
| AC-1 anonymous sees populated read-only default view | Default state + D2 default-view resolution + sign-in affordance (§3.2/§3.3) | review |
| AC-2 saved view persists across reload/session/device | Account-view load (view.source=`account`) | test |
| AC-3 signed-out WRITE refused server-side | Gated save → real 401 (INTERFACE §3); inline prompt, nothing persisted | test |
| AC-4 all READS anonymous-open | Every read state reachable anonymously | review |
| AC-5 one symbol fails, others render | Per-row `error`/`stale` degrade (§3.1) | test |
| AC-6 worker down → last rows + banner, non-5xx | Worker-down banner over intact rows (§2.3/§3.2) | test |
| AC-7 stale = frozen price + stamp + `stale` | Per-row `stale` (§3.1) | review |
| AC-8 building shown honestly | Per-row `building` (§3.1) | review |
| AC-9 never "live"; only price flash; two-speed basis stated | Header copy (§2.1) + `useFlashOnChange` price cell; no per-row stream | review |
| AC-10 scanner score/tier == Ticker page's | Consumed values, closed lookup, no re-derive (§4) | test |
| AC-11 row click → correct Ticker page, no order | Row navigation (§4) | review |
| AC-12 warm = speed-only, identical content | Row navigation (§4) | review |
| AC-13 editor selects only from current universe | View editor constrained to `/api/scan/universe` list | review |

## 6. Tests-to-write for P4 (enumerated so FE implements — never chooses — the requirement set)

Risk-based per `qa-verify §4`: `test:` = invariant / negative-space / silently-regressing; `review:` =
visible/intentional (copy, presence, ordering). **P4 implements exactly these; it does not re-scope.**

- `test:` Closed status lookup renders each of `ok`/`stale`/`error`/`building` with the §3.1 chip +
  copy; an unknown status renders the fail-honest unavailable state (silent-regression risk on a lookup
  miss).
- `test:` The table renders **no "live"** string and mounts **no per-row stream/SSE** (negative space —
  `[live-vs-static-isolation]`, AC-9).
- `test:` **Direction color is on `chg_pct` only** — score, distances, walls, regime cells are
  className-identical to a neutral cell (skill rule 2; the proximity-chip regression class).
- `test:` A `stale` row shows its **frozen price + as-of stamp + Stale chip**, never a fresh-looking
  value (honesty invariant, AC-7).
- `test:` A `building` row shows **no fabricated score** (dash/absent) and the Building chip (AC-8).
- `test:` Worker-down banner appears when the heartbeat is stale/absent and **rows still render**; the
  page returns non-error content (AC-6).
- `test:` `null` numeric fields render as `—`, never `0`/fabricated (§1.1).
- `test:` No horizontal overflow at 393px; the table collapses to cards `<sm` (Playwright, joins the
  393px route set).
- `test:` Every interactive element (row, sort control, editor toggle) exposes a visible
  `:focus-visible` ring.
- `review:` Anonymous load shows the populated default view + "Sign in to customize your view", **not**
  a persistence claim, **not** a blank/error screen (AC-1/AC-3 copy).
- `review:` Default sort is Score-descending; changing sort/density and saving persists it in the
  account view (ordering is visible/intentional, AC-2).
- `review:` All §3.1-required columns are present in the row/card (presence).
- `review:` Row click navigates to `/ticker/{symbol}` and performs no order/broker action (AC-11).
- `review:` The two-speed header renders the §2.1 copy verbatim-in-intent (self-describing basis, AC-9).
- `review:` Empty saved view (signed-in) shows the "pick tickers" affordance; anonymous never sees it
  (§3.2).

**Never a named test per AC** — the mapping in §5 pairs ACs to states; the cases above are the
risk-selected checks, not an AC mirror.
