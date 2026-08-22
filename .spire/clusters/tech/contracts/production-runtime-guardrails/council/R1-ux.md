# R1 — ux position: production-runtime-guardrails

## Position

### Surface, intended user, and primary job

`NO_UI_CHANGE` applies to the React dashboard, including the existing trader routes and the unlinked operator-metrics route. This feature does not justify a new settings panel, readiness page, badge, toast, or design-system amendment.

The only human-facing surface is the API process's startup diagnostic output. Its intended user is the deploy operator. Their primary job is to determine, from one failed start, which production configuration categories must be corrected without seeing a secret value or mistaking a partial validation for a claim that the service is generally “secure.”

The information order for a refused start is:

1. one outcome headline;
2. one count-bearing summary;
3. one line per failed configuration category, in a stable order;
4. no success reassurance, secret value, ciphertext, cookie value, or credential hint.

The normal ready path needs no new UX. In particular, passing these startup checks must not produce copy such as “Secure,” “Fully protected,” or “Production ready” because the feature vouches only for the named guardrails, not the whole deployment.

### User vocabulary and exact copy

Use these operator-facing labels consistently: **Durable store**, **Session signing**, **API-key encryption**, **Operator metrics**, **Allowed browser origins**, **Session cookies**, and **API-key rotation**. Do not collapse them into “environment error,” and do not rename any one of them as “security status.”

For a refused production start:

- Headline: `Production startup refused`
- Summary, singular: `Fix 1 configuration issue before starting the API in production.`
- Summary, plural: `Fix {count} configuration issues before starting the API in production.`
- Durable-store issue template: `{store label}: configure a durable production store.`
- Session-signing issue: `Session signing: configure a stable production key.`
- Missing active encryption-key issue: `API-key encryption: configure an active production key.`
- Rotation issue: `API-key rotation: retain every key required to read existing encrypted credentials.`
- Metrics issue: `Operator metrics: require authenticated access in production.`
- Origin issue: `Allowed browser origins: configure one or more explicit origins.`
- Cookie issue template: `Session cookies: {plain-language policy requirement}.`

`{store label}` and `{plain-language policy requirement}` must come from the validated configuration rule; they are not free-form exception text. The diagnostic may name a configuration key, but it must never interpolate the configured value.

When a local-development cryptographic fallback is actually active, use only the matching warning:

- `Development fallback: the session-signing key is temporary and changes when this process restarts.`
- `Development fallback: the API-key encryption key is temporary; credentials encrypted with it may be unreadable after restart.`

These warnings must be scoped to development. They must never accompany a production process that continues toward readiness.

### Complete state inventory

This startup surface has four meaningful states; loading, empty, offline, and stale are not applicable because there is no network-backed view, collection, or retained snapshot to present.

| State | What the operator sees | What happens next | Must not happen |
| --- | --- | --- | --- |
| Production configuration accepted | Existing ordinary startup output; no new security claim | The process may continue toward its existing readiness behavior | Passing validation must not be described as proof that the whole deployment is secure |
| Production startup refused | Refusal headline, issue count, and every failed category in the stable vocabulary above | The operator corrects configuration and starts the process again | The process must not become ready; output must not contain configured values or stop after only the first issue |
| Development fallback active | Existing startup output plus the exact warning for each temporary cryptographic fallback that is active | Local development continues | The warning must not say data is safe across restart or imply the fallback is acceptable in production |
| Rotation configuration refused | Production-refusal presentation with the API-key-rotation issue | The operator restores the required readable key set before retrying | Existing credentials must not be presented as deleted, invalid, or user-caused; no re-entry prompt or dashboard state is introduced |

Startup validation failure is not an application “error page,” and it has no retry control: restart after correcting configuration is the recovery action. Color, animation, and browser accessibility rules do not apply to this text-only process surface. Meaning must remain complete in plain text without color or terminal formatting.

### Brief-outcome to state and verification mapping

The BRIEF has no numbered acceptance criteria yet. The synthesizer should assign stable IDs without weakening the following observable outcomes or their `Verify by` marks.

| Brief-observable outcome | Component state(s) | Verify by | Why |
| --- | --- | --- | --- |
| A production process with any forbidden unsafe category does not become ready | Production startup refused; Rotation configuration refused | `test` | Readiness refusal is a silent safety invariant and must cover each category independently as well as multiple simultaneous failures |
| A valid production configuration may continue to the existing ready path | Production configuration accepted | `test` | A guardrail that rejects every production start can look safe while making the service unusable |
| Local development retains its permitted cryptographic fallbacks | Development fallback active | `test` | The feature must not silently turn a production safeguard into a local-development blocker |
| Planned rotation leaves previously encrypted credentials readable | Production configuration accepted; Rotation configuration refused | `test` | Credential readability is an invisible persistence invariant; visual review cannot establish it |
| Browser origins are explicit in production and an unlisted origin is not accepted | Production startup refused; Production configuration accepted | `test` | The negative-space boundary can regress without any visible UI change |
| Operator metrics cannot be open because a production token is absent | Production startup refused | `test` | Access-control negative space requires automation |
| Invalid production cookie policy prevents readiness | Production startup refused | `test` | Cookie attributes and refusal behavior are not reliably established by prose review |
| Startup diagnostics expose no configured secret values and report all failing categories together | Production startup refused; Rotation configuration refused | `test` | Secret absence and multi-failure aggregation are easy to miss in ordinary review |
| Headline, labels, issue wording, singular/plural summary, and development warnings use the exact approved copy | Production startup refused; Development fallback active; Rotation configuration refused | `review` | Wording is visible and intentional; brittle string snapshots would not add behavioral protection |
| No trader or operator web surface changes and no guardrail result enters scoring, bundle, SSE, or trader routes | All startup states | `test` | Route/path isolation and additive score identity are structural negative-space invariants |

### Design-system and interaction disposition

The project design canon is `Status: SET`, but this feature creates no browser surface and therefore consumes no new token, component, motion, icon, layout, focus, or responsive pattern. The existing Curvature Terminal UI remains untouched. No amendment is needed.

## Risks I see

- A generic `invalid environment` message would force operators into repeated deploy/fail cycles and conceal whether more than one category is wrong.
- Stopping after the first validation failure would make the count and remediation hierarchy dishonest; the refusal surface should report every safely reportable category in one pass.
- Echoing raw configuration values while trying to be actionable could leak signing keys, encryption keys, tokens, origins containing credentials, cookie material, or database credentials into retained logs.
- Calling a passing configuration “secure” would overstate what the checks prove and could suppress further operational review.
- Reusing the production refusal register for development would make an intentionally permitted fallback look fatal; omitting the development warning would hide that encrypted credentials may not survive restart.
- A rotation failure described as “credential invalid” could blame the user and invite unnecessary key re-entry even though the failure is in operator-managed key availability.
- Adding a dashboard indicator would breach operator-vs-trader separation, create stale status semantics, and imply continuous monitoring that this startup-only feature does not provide.
- Exact copy cannot compensate for an undefined cookie-policy rule. The architecture/product lanes must name the validated requirements so `{plain-language policy requirement}` remains truthful.

## Assumptions I'm making about the other two lanes

- The architect lane will define one authoritative production-mode decision that runs before the process can satisfy readiness.
- The architect lane will make every BRIEF-named unsafe category independently detectable and will allow all safely reportable failures to be aggregated without reading secret values into diagnostic strings.
- The architect lane will define a versioned or otherwise unambiguous active/previous-key relationship that can preserve reads of existing ciphertext during planned rotation.
- The architect lane will keep validation, CORS, cookie, metrics, and cryptographic changes outside quant math, scoring, bundle, SSE, and trader-route data flow.
- The PM lane will keep the React dashboard and `/_ops/metrics` UI out of scope, treating process startup diagnostics as the only human-facing surface.
- The PM lane will define the exact valid production cookie policy and the set of durable stores required in production, rather than asking UX copy to infer either meaning.
- The PM lane will require development fallbacks to remain usable and will not reinterpret their presence as acceptable production degradation.
- The PM lane will treat planned key rotation as an operator action that preserves existing user credentials, not as a user-facing credential reset flow.
