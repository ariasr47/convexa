# R1 — ux position: ai-providers

## Position

### Intended user, job, vocabulary

- **User:** a signed-in swing trader who asks Convexa for an advisory AI read and may size a simulated trade from it.
- **Primary job:** choose *how* Ask-AI is powered, see *which provider + specific model* will run (and which actually ran), without mistaking cost, identity, or provenance.
- **Secondary job:** add / replace / remove a BYO key, or connect / disconnect the preferred Grok→Convexa pool path, without ever seeing a raw secret again.
- **User vocabulary (closed, honest):**
  - **Power path** — how this request is paid for / routed: *your key* · *Convexa Grok pool* · *admin shared key* (existing hybrid; keep distinct) · *none*.
  - **Provider** — Anthropic · OpenAI · Gemini · Grok (xAI). Closed labels only; never inferred from a typed key prefix in the UI (`digested-labels-not-raw-dump`).
  - **Model** — the specific named model the trader picks (and the one provenance reports after a run). Never a silent env default the UI hides.
  - **Pool** — Convexa's Grok sub-pool. Call it **cheaper / metered / included with Grok sign-in** only as the wire can vouch. **Do not call it "free"** unless a vouched field says so.
  - **Your key** — BYO credential. Masked last-4 only; write-only; never "Anthropic key" unless the stored `provider` field is Anthropic.

### Live surfaces cited (read at source)

| Surface | What is true today | Redesign implication |
| --- | --- | --- |
| [`AiKeySection.tsx`](apps/dashboard/src/app/features/auth/AiKeySection.tsx) | Single Anthropic key; modes view/replace; storage-unavailable info; anonymous `SignInPrompt`; `id="ai-key"` | Expand into a **power-path** panel: preferred Grok pool + BYO multi-provider + model picker; keep write-only / no-reveal / clear-draft-on-success |
| [`copy.ts` `settings.aiKey`](apps/dashboard/src/app/features/auth/copy.ts) | Heading "AI key"; every string hardcodes Anthropic / `sk-ant-…` | Retire Anthropic-only framing; provider-conditional placeholders; pool vs BYO vs admin vocabulary split |
| [`SettingsPage.tsx`](apps/dashboard/src/app/features/auth/SettingsPage.tsx) | PanelCard "AI key" after Risk inputs; scrolls `#brokerage` only | Rename panel; deep-link scroll for `#ai-key` (or renamed anchor) the way Brokerage already does — Ask-AI already navigates `/settings#ai-key` |
| [`ai-rec/copy.ts` `BYO_KEY`](apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts) | "Add your Anthropic key…"; "Using your key"; admin "free uses" | Gate CTAs must name the missing power path honestly; own-key chip must not invent provider; pool ≠ admin free allowance |
| [`AiRecPanel.tsx`](apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx) / [`DecisionCard.tsx` `Provenance`](apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx) | Auth-outermost gate; BYO CTAs `no_key` / `over_limit` / `shared_key_unconfigured`; provenance chips Persona · As of · SIMULATED · free-uses · "Using your key" — **no provider/model** | Visible model picker on every powered path before Analyze; provenance chips for provider + model **only when the response names them** |

### Feature direction under DESIGN_SYSTEM (Status: SET — The Curvature Terminal)

Adhere; **no new palette role, no new motion family, no fourth convex arc; amber stays spent.**

- Reuse Settings **PanelCard** + uppercase **FieldLabel** pattern; credential chrome mirrors `BrokerageSection` (write-only, masked mono hint, Replace/Remove, warning+icon confirm, storage-unavailable as **info** not error-red).
- Chips stay outlined / quiet `text.secondary` captions — green/red reserved for direction; pool/BYO status is not a P/L tint.
- Warnings (remove key, disconnect pool, OAuth expired) use `warning.*` **+ icon always** — never brand amber alone.
- Model / provider names in mono when they are Convexa-vouched wire labels; no new keyframe family for connect success (Snackbar/toast already used).
- Touch ≥44px on coarse pointers for path CTAs and model select; no 393px overflow.
- If a new reusable control is truly needed beyond existing Select/Chip/Alert, raise an R2 `product` conflict for a DESIGN_SYSTEM **Amendment** — do not invent a second system in SPEC §4.

### Information structure — Settings AI panel (redesign)

**Panel heading:** `AI providers` (replaces `AI key`). Anchor remains `#ai-key` for existing deep-links unless PM renames with a dual-id migration.

**Order (preferred path first — owner intent):**

1. **Helper** — two sentences: (a) Grok sign-in can run on Convexa's cheaper Grok pool when available; (b) otherwise store your own key for Anthropic / OpenAI / Gemini / Grok. Encrypt / never-shown-again floor stays. **No "free pool" claim.**
2. **Preferred path — Grok pool**
   - When available: primary CTA `Continue with Grok` (or `Reconnect Grok` / `Disconnect`).
   - Connected state: closed label from wire (e.g. `Grok pool · connected`) + model picker + Disconnect.
   - Unavailable / not configured / expired: distinct copy per state (see matrix) — never collapse into BYO empty.
3. **Alternative path — Your API key**
   - Provider select (closed four) **before** the secret field — provider is chosen by the trader, not guessed from `sk-…`.
   - Placeholder / format helper **switches by selected provider** (Anthropic `sk-ant-…` only when Anthropic is selected).
   - Set state: `maskedKeyLabel` **plus** provider chip from **stored** provider field (`Anthropic · ····1234`), never from key text.
   - Replace / Remove preserve today's security floor.
4. **Model (always visible when a power path is active)**
   - Label: `Model for recommendations`.
   - Options come from a server-provided catalog for the active path/provider; if catalog empty/unavailable, show honest empty — do not invent model ids in the client.
   - Selection is visible and overrideable; if the server still has an env default, the UI must **show that name** as the current selection (or an explicit "Server default · {name}" option) — never a blank that hides it.

Admin shared-key allowance (existing hybrid) is **not** the Grok pool. Keep its copy under Ask-AI (`free uses` / shared key) and do **not** place an "admin free" control in this panel unless the status read says this user is on that path. Recommend PM rename Ask-AI admin copy later if "free" collides with pool messaging — pool copy must stay non-"free" regardless.

### Information structure — Ask-AI gated / provenance chrome

1. **Signed out** — unchanged auth-outermost gate (`Sign in to ask AI`); never show no-key / pool / cooldown.
2. **Before Analyze (signed in, powered)** — beside/above the primary action: **Model** select (same closed catalog as Settings preference; local override for next request allowed if product keeps persona-style "next read only" — default: Settings preference is the value shown). Trader must see the specific model name before requesting.
3. **Unpowered / degraded CTAs** — distinct bodies (do not reuse Anthropic-only `BYO_KEY.noKey`):
   - no power path → prefer pool CTA when pool is available on this deployment; else BYO.
   - pool unavailable / OAuth expired → say so; offer BYO as alternate.
   - BYO missing for chosen provider → Settings deep-link.
   - admin exhausted / shared unconfigured → keep existing admin vocabulary, clearly not the Grok pool.
4. **Provenance (DecisionCard)** — add chips only from vouched fields:
   - `Provider · {closed label}` when response names provider.
   - `Model · {name}` when response names model.
   - If either is absent: **omit the chip** (do not invent; do not show "default"). Own-key chip becomes `Using your {provider} key` only when provider is named; else keep generic `Using your key`.
5. **Loading** — may say "Asking {provider} ({model})…" **only** if those names are already known from the request selection; otherwise keep today's "Asking the AI…".

### Component-state matrix

#### A. Settings — AI providers panel

| State | User sees | Can do | Must not |
| --- | --- | --- | --- |
| **anonymous** | Sign-in prompt; no key/OAuth forms | Sign in | Imply a key is stored in this browser |
| **loading** | Quiet pending on status read (no false Set) | Wait | Flash "Key set" from stale local guess |
| **empty / unpowered** | Preferred pool CTA (if deployment advertises pool) + BYO provider+key form; model picker disabled or hidden with caption "Choose a power path first" | Connect Grok or add BYO | Call pool free; show Anthropic-only placeholder when another provider is selected |
| **pool_available_disconnected** | Preferred path card enabled; BYO still offered | Continue with Grok | Treat as BYO empty |
| **pool_connected** | `Grok pool · connected` (or wire label); model picker enabled; Disconnect | Change model; disconnect; still manage BYO if product allows both | Label as "free"; show raw OAuth tokens |
| **pool_unavailable** | Info note: pool not available on this deployment; BYO remains | Add BYO | Collapse into generic save error |
| **oauth_expired** | Warning+icon: Grok connection expired; Reconnect | Reconnect or switch to BYO | Look like still connected |
| **byo_set** | Provider label from **stored provider** + masked last-4; model picker; Replace / Remove | Replace/remove; change model | Reveal key; label provider from typed draft; hardcode Anthropic |
| **byo_replace** | Provider select + password field; Cancel | Submit / cancel (clears draft) | Retain draft after success |
| **byo_remove_confirm** | Warning+icon confirm naming consequence for AI recs | Confirm / keep | Echo key material |
| **storage_unavailable** | Info Alert (not error-red); inputs disabled | Use manual export elsewhere | Look like a failed 5xx credential leak |
| **model_catalog_empty** | Model field shows honest empty / unavailable caption | Still keep power path; retry later | FE-invent model ids |
| **submitting** | Buttons disabled; Adding… / Replacing… / Connecting… | Wait | Double-submit |
| **save_error** | Error Alert; draft retained for retry | Dismiss; retry | Echo secret in error text |
| **success** | Snackbar ("AI key saved." / pool connected / removed — path-specific) | Continue | Claim the wrong path saved |

#### B. Ask-AI — gate / action / provenance chrome

| State | User sees | Can do | Must not |
| --- | --- | --- | --- |
| **signed_out** | Signed-out gate only | Sign in | Show cooldown / no_key / pool / model picker as if gated in |
| **idle_powered** | Analyze enabled; **visible model** name/select; snapshot hint | Analyze; change model | Hide model behind env default |
| **idle_unpowered** | Distinct CTA for missing path (pool-first when available) | Go to Settings / Continue with Grok | Anthropic-only "Add your Anthropic key" when pool is the preferred fix |
| **admin_shared_ok** | Existing free-uses chip (admin path only) | Analyze within allowance | Call this the Grok pool |
| **admin_exhausted / shared_unconfigured** | Existing BYO_KEY admin bodies (rename later if needed) | Add BYO in Settings | Imply Grok OAuth is exhausted |
| **pool_path_ok** | Quiet path caption or chip from wire (e.g. `Convexa Grok pool`) + model | Analyze | Say "free" without voucher |
| **loading** | Thinking… + honest asking line | Wait; export still available | Present a pinned old card as the new result |
| **byo_cta / unavailable** | Reason-specific body; export floor stays | Settings CTA / Retry when allowed | Merge `no_key` · `pool_unavailable` · `oauth_expired` into one string |
| **produced** | DecisionCard + provenance including provider/model **iff named** | Review / refresh / dismiss | Show `Model · …` when field absent; rename key_source into a fake provider |
| **stale / superseded** | Existing stale strips | Refresh | Imply a new model ran |

### Acceptance criteria → states → Verify by

(UX-owned criteria for synthesis into SPEC §3. Product may renumber; meanings stay.)

| ID | Criterion | State(s) | Verify by |
| --- | --- | --- | --- |
| U1 | Settings panel offers provider choice among Anthropic / OpenAI / Gemini / Grok as closed labels, not inferred from key text | empty, byo_replace, byo_set | **test** (closed options; no prefix→provider map in UI) |
| U2 | Grok pool path is visually preferred (first) when the deployment advertises it; BYO is the alternate | empty, pool_* | **review** (order/presence) |
| U3 | Pool copy never says "free" unless a vouched field authorizes that word; default wording is cheaper/metered/pool | pool_* , Ask-AI pool_path_ok | **test** (banned substring on pool strings) + **review** final tone |
| U4 | Every powered path shows a specific model name the trader can see and change before Analyze | idle_powered, pool_connected, byo_set | **test** (control present + value visible; hidden-default impossible) |
| U5 | BYO set-state labels provider only from stored provider field; masked last-4 only; no reveal | byo_set | **test** |
| U6 | Anonymous Settings shows sign-in only; no credential form | anonymous | **test** |
| U7 | storage_unavailable is info, inputs disabled, no secret echo | storage_unavailable | **test** |
| U8 | Ask-AI signed-out never shows no_key / pool / cooldown / model picker | signed_out | **test** |
| U9 | Unavailable reasons for no key vs pool unavailable vs OAuth expired vs admin paths use distinct copy (`absent-is-not-none`) | idle_unpowered, byo_cta, unavailable | **test** (distinct testids + strings) |
| U10 | Produced provenance shows Provider and Model chips only when response names them; omission ≠ "default" | produced | **test** |
| U11 | Own-key chip does not hardcode "Anthropic"; uses provider when named, else generic "Using your key" | produced | **test** |
| U12 | Remove/Disconnect confirms with warning severity + icon | byo_remove_confirm, pool disconnect | **review** (warning+icon pattern) |
| U13 | Deep-link from Ask-AI Settings CTA scrolls to the AI providers panel | empty / any Settings | **test** or e2e |
| U14 | Token-only styling; no new motion family; no fourth arc; no hardcoded hex | all | **test** (existing discipline suites) |
| U15 | Manual export floor remains reachable in every Ask-AI body state | all Ask-AI | **test** |

### Microcopy integrity rules (binding for this feature)

1. **Trace or omit.** Provider, model, pool metering, free-use counts — each needs a vouched field. No field → no chip / no number / no claim.
2. **No silent renames.** `shared_admin` free allowance ≠ Grok pool. `own_key` ≠ a named vendor until provider is present.
3. **No key-string forensics in UI.** Selecting Gemini then pasting an `sk-ant-` key may warn softly, but the UI must not auto-retitle the row "Anthropic" from the string (`digested-labels-not-raw-dump`).
4. **Withdraw overclaim.** Prefer "Convexa Grok pool (cheaper than a personal xAI key when available)" over any unearned "unlimited" / "free" / "SuperGrok subscription" language. SuperGrok-subscription passthrough is **out of BRIEF scope** — do not imply it.
5. **Degraded wording samples (exact intent; PM may edit words, not honesty):**
   - Pool unavailable: `Convexa's Grok pool isn't available on this deployment. You can still add your own API key below.`
   - OAuth expired: `Your Grok connection expired. Reconnect to use the pool, or use your own key.`
   - Model unnamed on a produced card: omit model chip (never `Model · default`).
   - BYO empty (no pool): `Add an API key for Anthropic, OpenAI, Gemini, or Grok to power recommendations. Your key, your cost.`

### Design review notes (preserve / fix)

- **Preserve:** write-only key UX, masked mono last-4, auth-outermost Ask-AI gate, export floor in every state, PanelCard Settings rhythm, DecisionCard provenance row pattern.
- **Fix:** Anthropic-only Settings + BYO_KEY copy; missing provider/model provenance; `#ai-key` deep-link without Settings scroll handler; hidden env-default model; risk of calling the pool "free" by analogy with admin allowance.

## Risks I see

1. **Copy collision:** admin "free uses" and Grok "cheaper pool" will be read as the same thing if vocabulary is not split — traders will think the pool is a free trial or that admin exhaustion means the pool is dead.
2. **Invented model names:** shipping a hardcoded client model list that drifts from the server is a defining integrity failure; catalog must be wire-driven or the picker must show an honest empty.
3. **False Anthropic labeling:** keeping `sk-ant-` helpers globally, or inferring provider from key prefix, renames the datum.
4. **Hidden default survives:** a model select that defaults visually to blank while the server uses `AI_REC_MODEL_*` recreates today's failure mode.
5. **State collapse:** one "Add your key" CTA for no_key / pool_unavailable / oauth_expired violates `absent-is-not-none` and sends people to the wrong fix.
6. **OAuth arm blocked:** if architect marks Grok OAuth blocked-on, the UI must still ship BYO multi-provider + model picker without fake "Continue with Grok" that cannot complete — preferred-path chrome becomes present-but-unavailable (like Google sign-in), not a lying primary.
7. **Design-system pressure:** a branded multi-step wizard or new motion on connect would fight The Curvature Terminal; keep terminal density and existing credential patterns.

## Assumptions I'm making about the other two lanes

- **Architect** will expose distinct, FE-consumable power-path / unavailable reasons that separate at least: BYO missing · BYO set · Grok pool connected · pool unavailable on deployment · OAuth expired · admin shared · admin exhausted · shared unconfigured — so UX can keep `absent-is-not-none` without inventing server behavior.
- **Architect** will return closed `provider` and `model` (or equivalent) on credential status and on produced/unavailable recommendation envelopes when known; absent means omit, never a client-side default label.
- **Architect** will either name a buildable Convexa-owned Grok OAuth + server-side pool-key mechanism or explicitly mark that arm blocked-on; UX will not invent accounts.x.ai / SuperGrok-subscription protocol.
- **Architect** will supply a model catalog (per provider / pool path) the UI can render; the FE will not hardcode vendor model ids as product truth.
- **PM** will keep the existing admin shared-key allowance as a separate product path from the Grok pool and will accept copy that never calls the pool "free" by default.
- **PM** will require a visible specific-model control on Settings *and* on the Ask-AI request chrome for every powered path (BRIEF: "always be able to choose"), not Settings-only.
- **PM** will treat provider/model as non-scoring display provenance under `additive-keeps-score-byte-identical` / `ai-asserted-numbers-are-traceable` — chips name what ran; they do not invent checks.
- **Backend lane (via architect)** will continue write-only credential semantics: status carries at most set + last4 + provider (+ pool connection flags); raw keys/OAuth secrets never return to the browser.
- **Neither lane** will ask UX to infer provider from the key string or to show a model name that provenance did not supply.
