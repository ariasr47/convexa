```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/dashboard/src/app/features/alerts/evaluate.spec.ts","A4-auth-alerts","5","An alert rule silently stops firing, or fires at the wrong level, when score, tier or price crosses its threshold, so the user misses the signal they set up.","parser","KEEP","","evaluate.spec.ts:16-61; evaluate.ts:53-145. These are the only tests of the transition and latch logic. Case 4 (47-53) is the only check that call_wall maps to snap.call_wall. Case 5 (55-61) is the only test of the price-threshold path.","none","e29c57a3 2026-08-10"
"apps/dashboard/src/app/features/alerts/store.spec.ts","A4-auth-alerts","9","A corrupt alerts blob in localStorage is overwritten by the empty state on the next write, which permanently destroys the user's alert rules and history (no server copy).","invariant:loss-free-durable-migration","TRIM","duplicate","store.spec.ts:78-177; store.ts:64-99. Remove 111-115 (the page can still render its own empty state), which duplicates store.spec.ts:92-99. Keep the mutation proof 101-109, the latch test 119-137 and the anti-vacuity tests 141-157.","none","589bbc51 2026-09-07"
"apps/dashboard/src/app/features/auth/RequireAuth.spec.tsx","A4-auth-alerts","7","The private-route wall tells a visitor whose session is still loading or could not be read that they are signed out, or retries the auth endpoint on its own during an outage.","invariant:absent-is-not-none","TRIM","structure","RequireAuth.spec.tsx:54-112; RequireAuth.tsx:57-139 (UX only, server gate tested at api_contract_runtime_auth_research.rs:919-938). Remove the AuthDialog signups-closed copy cases 97-106 and 108-112; the server refusal is tested at service.rs:1138-1142.","none","06c2db88 2026-09-10"
"apps/dashboard/src/app/features/auth/aiProviderLabels.spec.ts","A4-auth-alerts","8","The AI provenance chip names the wrong billing path (Grok subscription vs the user's own key), the wrong provider's model catalog is offered, or Settings crashes on a partial bootstrap.","parser","TRIM","duplicate","aiProviderLabels.spec.ts:34-128; aiProviderLabels.ts:30-64. Remove 101-108 (no hex or keyframes), covered by hex-discipline.spec.ts:241 and single-motion-moment.spec.ts:135. Remove 123-128 (banned words), covered by aiProviders.flow.spec.tsx:293-301.","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/features/auth/aiProviders.flow.spec.tsx","A4-auth-alerts","9","A pasted AI API key is shown back in the page, replacing or removing one provider's key overwrites another's, or the chosen key or model is never saved, so a different key or model gets billed.","invariant:secret-encrypted-at-rest","TRIM","structure","aiProviders.flow.spec.tsx:53-301. Keep 79-132, 134-199, 201-228, 230-262 and 293-301. Remove 53-65 (the FE hides the form; server returns 403, auth.rs:1356 and api_contract_parity.rs:855) plus 67-77, 264-272 and 274-291. byo-ai-key.json hands PUT/DELETE checks to FE/BE tests.","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/features/auth/auth.risk.spec.tsx","A4-auth-alerts","13","A gated simulated-position write lands locally despite a server 403/503, an auth outage blanks the trader path, a typed password leaks into the DOM or a URL, or one account's settings bleed into another's.","invariant:server-side-gate-enforcement","TRIM","structure","auth.risk.spec.tsx:112-512. Remove 230-241 (logged-out short-circuit), duplicated by the server 403 at api_contract_parity.rs:1252-1260 and the FE abort at 196-212. Remove 352-366 (signups-closed copy) and 459-495 (Google control, visible UX).","apps/dashboard-e2e/tools/isolation.mjs:58","05702e92 2026-07-16"
"apps/dashboard/src/app/features/auth/brokerageSection.spec.tsx","A4-auth-alerts","7","A user's brokerage App Key or Secret is shown back in the page after a save or a 422, half a credential is submitted, or disconnect deletes the stored credential without confirmation.","invariant:secret-encrypted-at-rest","TRIM","structure","brokerageSection.spec.tsx:92-195; BrokerageSection.tsx:85-140. Keep 92-176. Remove 178-186 (storage-unavailable styling) and 188-195 (anonymous makes no request; the server 403 is tested at api_contract_runtime_auth_research.rs:866-878).","none","c84e2148 2026-08-02"
"apps/dashboard/src/app/features/auth/firstPaintTheme.spec.ts","A4-auth-alerts","15","A light-mode user gets a dark first paint and browser chrome because index.html's inline boot script or the styles.css canvases drift from the palette tokens.","invariant:theme-token-discipline","TRIM","risk-gone","firstPaintTheme.spec.ts:47-212. resolveFirstPaintMode has no production importer (git grep finds only firstPaintTheme.ts and this spec), so remove its 6 cases at 48-93. Also remove the tautologies at 137-140 and 210-212. Keep 104-110, 114-135, 166-196 and 200-205.","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/features/auth/riskInputs.spec.tsx","A4-auth-alerts","12","A trader's account size or per-trade risk cap silently fails to save, a failed save shows Saved, or a cap that cannot be derived renders as $0, so AI trade sizing uses a cap the user never set.","money","TRIM","duplicate","riskInputs.spec.tsx:65-281. Remove the FE copies of server rules: 119-133 (risk.rs:260-265), 135-150 (risk.rs:240-245), 152-163 (risk.rs:247-251), 165-176 (risk.rs:253-258). Also remove structure cases 76-84, 211-230 and 256-281. Keep 65-74, 88-115, 180-207 and 234-252.","none","47a8961f 2026-08-13"
"apps/dashboard/src/app/features/auth/settings.register.spec.tsx","A4-auth-alerts","15","A failed settings write still shows Saved or leaves the control on the unsaved value, or an empty risk field reads as a number instead of 'not set'.","invariant:absent-is-not-none","TRIM","structure","settings.register.spec.tsx:81-272. Keep 81-92 (the 'not set' placeholder, per DECISION_LEDGER.md:820), 122-132 and 134-145. Remove 12 cases that check fonts, severity colours, radius, source text or copy.","none","83af0059 2026-09-07"
"apps/dashboard/src/app/features/auth/theme-color.spec.tsx","A4-auth-alerts","3","The browser chrome colour stays dark, or drifts from the theme token, when the user is in light or system-light mode.","invariant:theme-token-discipline","TRIM","duplicate","theme-color.spec.tsx:64-99; ThemeProvider.tsx:23-29. Remove 64-68 (dark pref gives the DARK token); the same assertion runs at theme-color.spec.tsx:71-73. Keep 70-80 and 82-99.","none","24359424 2026-07-22"
"apps/dashboard/src/app/features/auth/useSettings.spec.tsx","A4-auth-alerts","5","A signed-in user's server prefs are overridden or rewritten by a leftover local pref or another account, a failed save shows as applied, or an anonymous change reaches the server.","auth","CONSOLIDATE","duplicate","useSettings.spec.tsx:36-131; useSettings.ts:55-133. Merge 36-52 and 91-107 into one table-driven server-wins case that also asserts settingsPut===0. Keep 54-69, 73-87 and 111-131.","none","23b7cf99 2026-07-14 superpowers-plan"
"apps/dashboard/src/app/features/auth/validation.spec.ts","A4-auth-alerts","6","The sign-up form maps a server 422 to the wrong field or copy, or rejects an obviously bad email before the request is sent.","","RETIRE","structure","validation.spec.ts:9-42; validation.ts:1-41, which calls itself UX sugar. The server is authoritative with the same email regex (service.rs:471-475). The only failure this catches is wrong field or copy on a form error the user can see. Ordinary emails are also exercised at auth.risk.spec.tsx:265 and 331.","none","23b7cf99 2026-07-14"
```

## NOTES

### TRIM and CONSOLIDATE: cases to remove or merge (114 cases before, 64 after)

**store.spec.ts (9 → 8)**
- Remove "the page can still render its own empty state from the degraded read (no throw reaches a caller)". It duplicates "a corrupt blob renders the empty state and never throws".

**RequireAuth.spec.tsx (7 → 5), structure**
- Remove "signup mode shows the closed-signups sentence with zero prior typing".
- Remove "login mode does not show the signup-only closed-signups sentence".

**aiProviderLabels.spec.ts (8 → 6), duplicate**
- Remove "AiKeySection has no hex literals and no new keyframes".
- Remove "Settings AI providers strings never say free / pool / cheaper / included".
- For the ai-rec auditor: DecisionCard.spec.tsx:122-141 re-checks this file's cases 1-3 at a slower render layer.

**aiProviders.flow.spec.tsx (9 → 5)**
- Remove "anonymous Settings is sign-in only — no credential / OAuth / model forms (AC-12)". This one is a duplicate: the server refuses an anonymous key write (auth.rs:1356).
- Remove "present-but-unavailable Grok card has no Connect CTA (AC-27)" (structure).
- Remove "first-visit named model is visible while still unpowered (AC-7 / AC-13)" (structure).
- Remove "storage unavailable is info, not error-red, and inputs are disabled (AC-18)" (structure).

**auth.risk.spec.tsx (13 → 9)**
- Remove "logged out: the FE gate short-circuits — prompt shown, NO server call, NO write, no dialog". This is a pure-FE gate. The server refusal is tested at api_contract_parity.rs:1252-1260, and the FE honouring a 403 stays tested in the kept "403 (stale cookie / bypassed FE check)" case.
- Remove "POST /api/auth/signup → 403 signups_closed maps to the SAME policy sentence…" (structure).
- Remove "google_available:false ⇒ disabled, and a click initiates NOTHING (no navigation, no fetch)" (structure).
- Remove "config-only flip false→true (no rebuild): the next who-am-I read enables the control" (structure).
- Once validation.spec.ts is retired, the header comment at auth.risk.spec.tsx:39 that points to it is stale.

**brokerageSection.spec.tsx (7 → 5)**
- Remove "storage-unavailable: contained info note (never error-red), inputs disabled" (structure).
- Remove "anonymous: the sign-in prompt, and NO broker request is issued". It duplicates the server 403 at api_contract_runtime_auth_research.rs:866-878.

**firstPaintTheme.spec.ts (15 → 7)**
- Remove these six cases as risk-gone. `resolveFirstPaintMode` (firstPaintTheme.ts:16-37) is dead code with no production importer:
  - "anonymous never-touched → dark (AC-A3)"
  - "paint cache wins over uiprefs (last resolved mode, including signed-in)"
  - "uiprefs light → light when no paint cache"
  - "legacy gammaflow key is consulted when the new key is empty"
  - "system pref follows prefers-color-scheme; missing match → dark"
  - "corrupt blob / storage throw → dark, never throws"
- Remove "MUTATION GUARD: the pin fails if the script loses the light canvas" (structure): line 138 repeats line 129, and line 139 is a tautology.
- Remove "is the closed set light | dark (not system — system is a pref, not a paint)" (structure): it asserts a literal equals itself.
- Optional, not floor: the paint-cache, legacy-key and corrupt-blob branches of the real inline script are not tested anywhere. If you want them covered, add those three rows to the jsdom-eval block at :143-197.

**riskInputs.spec.tsx (12 → 5)**
- Remove "carries a \"View what's sent\" link, present in the anonymous state as well" (structure).
- Remove these four as duplicates. They copy server rules that are enforced via `risk::validate` (service.rs:555) and unit-tested in risk.rs:
  - "a zero, negative or non-numeric account size is refused locally…"
  - "a dollar cap exceeding the entered account size is refused…"
  - "a percent cap outside (0,100] is refused…"
  - "a percent cap is NEVER refused on account-size grounds…"
- Remove "renders the section with aria-disabled controls that remain focusable…" (structure).
- Remove "shows the storage-unavailable copy and claims no value as saved" (structure: it only checks the copy).

**settings.register.spec.tsx (15 → 3), structure**
- Remove:
  - "MUTATION GUARD — RiskInputsSection.tsx binds the face from shared/figure…"
  - "renders \"Stored in this browser.\" and the \"Saved to your account.\" string is absent…"
  - "MUTATION GUARD — the canvas footnote string never appears…"
  - "a successful write shows severity=\"info\"…"
  - "the risk-inputs confirmation is also neutral chrome…"
  - "the AI-key and Brokerage confirmations… neutral chrome…"
  - "the save-error alert is untouched: severity=\"error\"…"
  - "MUTATION GUARD — no `severity=\"success\"` remains…"
  - "zero figure-live-dot nodes and zero pulse/live-keyframe classes…"
  - "renders the resolving line while auth.ready is false…"
  - "SettingsPage.tsx no longer carries `borderRadius: 2.5`…"
  - "MUTATION GUARD — the regex actually distinguishes 2.5 from 1…"
- In the kept case at 81-92, also drop the two `data-figure-register="mono"` assertions (font). Only the "not set" vs "0" placeholder assertions are floor.

**theme-color.spec.tsx (3 → 2)**
- Remove "dark pref → the DARK theme background token (never a literal drifting from the theme)". It is contained in the "switching to light" case.

**useSettings.spec.tsx (5 → 4), CONSOLIDATE**
- Merge "reflects the server settings value over any client-local store" and "shows account Y own value, never account X (FE does not overwrite server from local)" into one table-driven case that also asserts `settingsPut === 0`.

### UNSURE
- None.
- One open question that would change a floor label: should the wall's "still loading or session unknown" vs "signed out" distinction count as an `absent-is-not-none` instance? I applied it by analogy; the ledger does not list `curvature-v2-landing-and-site` under that key. If the answer is no, RequireAuth.spec.tsx:54-85 becomes structure, and only the auth-pass case (61-65) and the no-auto-retry case (87-93) stay.

### NEW-BEHAVIOR-TEST
This is a recommendation outside the row verdicts. The server side of the broker credential has no Rust test:
- A single-half PUT should return 422 and store nothing (service.rs:993-995).
- GET and PUT responses should never contain `app_key` or `app_secret`, only set/last4/storage_available (service.rs:966-1029).

Today the only coverage is the FE copy of the check (brokerageSection.spec.tsx:111-125) and an FE mock that returns last4 by construction, so a server-side echo of the secret would go unnoticed. The test belongs in the `apps/api/src/services/auth/service.rs` tests module, next to `set_ai_key_never_echoes_secret_and_is_a_power_gesture` (:1181).

### FLAKY / timing
- auth.risk.spec.tsx sets per-test timeouts of 20000 or 30000 ms at :142, :194, :212, :228, :297, :438 and :512. All are above the 15000 default (vite.config.mts:117), so slowness is being hidden by longer timeouts.
- The session-lifecycle case waits for a lazy route to mount (:272) under the 5000 ms asyncUtilTimeout (test-setup.ts:65). That is sensitive to CI load.
- firstPaintTheme.spec.ts:27-38 finds the dashboard root by walking up from `process.cwd()` and throws if it can't. That depends on the environment, not on timing.
- No sleeps or retries in this area.

### SLOW kept tests and the cheapest safe speed-ups
- **auth.risk.spec.tsx (12.84s, 9 cases kept):**
  - Use `userEvent.setup({ delay: null })` and `user.paste` for the email, password and manual-price fields.
  - Pre-import the lazy positions route in a `beforeAll`.
  - The trim also removes four provider mounts.
- **aiProviders.flow.spec.tsx (6.52s):** the add/replace/remove case types four roughly 25-character keys and a rotated key one character at a time. Switch to `user.paste`. The trim also removes four SettingsPage mounts.
- **brokerageSection.spec.tsx (1.59s):** paste APP_KEY and APP_SECRET instead of typing them.
- **riskInputs.spec.tsx (2.05s) and settings.register.spec.tsx (1.99s):** the trims remove 7 of 12 and 12 of 15 mounts. No further change needed.

Totals (A4-auth-alerts, 13 files): KEEP 1 · TRIM 10 · CONSOLIDATE 1 · RETIRE 1 · UNSURE 0 · NEW-BEHAVIOR-TEST 0 (plus one recommendation for a Rust broker-credential test in NOTES). Cases go from 114 to 64.
