# R1 — pm position: portfolio-demo-platform

## Position

**Product promise.** A visitor can explore Convexa's actual product flows without an account, paid feed, AI key, or broker connection, while always knowing that the market, portfolio, analysis, and research examples are synthetic. Rodrigo gets a visual, source-grounded backend atlas that explains what the static portfolio demonstrates and what requires the running Rust service. The existing live product remains available when configured separately.

**Stories.** V1: As a prospective visitor, I want a populated tour of the real app so that I can judge its breadth. V2: As a trader evaluating the idea, I want coherent simulated positions, technical context, and research so that I can understand a decision without mistaking samples for current evidence. V3: As Rodrigo, I want to trace each screen to the system and change demo/live mode deliberately so that I can explain and operate the portfolio. V4: As a returning visitor, I want my demo edits to survive a reload and a clear way to restore the sample.

**In.** A visual backend atlas and design canvas; explicit demo/live selection; synthetic, internally coherent examples across the existing public ticker widgets, scanner, simulated positions and orders, track record, alerts, settings/personas, command search, sample analysis, and read-only broker view; public technical-analysis and scenario-research experiences; distinct demo browser state; measured production-build and release evidence; static hosting of the verified demo. Preserve meaningful filtering, symbol navigation, simulated trade actions, and exports where those flows already exist. An intentional coming-soon affordance may remain coming soon; a data-dependent module may show a specific unsupported operation, but an entire public module cannot be silently abandoned.

**Out.** Real brokerage connection or order execution; real signup, OAuth, credential entry, paid market or AI calls; production data/schema changes; new production vendor; public access to operator archives or tokens; claims of live market state, recorded paid history, backtested performance, or newly generated AI analysis from synthetic examples. The static site demonstrates product workflows and repository-described architecture, not a running backend. Operator diagnostics remain separate and may state unavailable in demo without fabricated performance or archive coverage.

**Future, only after a separately dated decision.** A vendor-backed public live research history, a separately hosted backend demo proving Rust runtime behavior, and real broker connections are parked until funding, data rights, and authorization are settled. Revisit after the portfolio release, not as prerequisites for it.

**Behavior and bounds.** Sample scenarios use an explicit as-of date and stable symbol set. Repeated visits to the same scenario give the same underlying claims, with clearly simulated playback if movement is offered. The live label never appears because a demo timer advances. Supported symbols cover every public sample journey; unsupported symbols and operations explain their limit without escaping into a live request. Missing history produces an unavailable indicator, not a plausible number. A sample explanation is authored content tied to its scenario, and any export retains that provenance. The existing Market Context metrics are acknowledged as already present; the new value is chart context, visible windows/basis, and a public research journey.

### Acceptance criteria

`Silent if` identifies a regression that could escape an ordinary review and cost a visitor or operator; only those rows warrant retained automation. Test groups may cover several rows. Every row still receives point-by-point GATE Q verification.

| # | Story | Observable criterion | Silent if | Verify by |
|---|---|---|---|---|
| 1 | V3 | Opening the atlas gives a reader a source-linked visual path from each public screen through its responsible backend modules and data stores. | — | review |
| 2 | V3 | The atlas distinguishes source-inferred traces, locally observed behavior, and hosted observations wherever it makes an operational claim. | — | review |
| 3 | V3 | The atlas explains how to select each mode, what rebuild or restart makes a change effective, how to restore live service, and which demo features are intentionally limited. | — | review |
| 4 | V1 | Before implementation, the saved design canvas shows the demo truth treatment and the new analysis/research states in the existing Convexa design language. | — | review |
| 5 | V1 | On each public data page in the demo, a visitor can identify the content as sample data and find its scenario as-of date without opening documentation. | A plausible screen loses its sample provenance. | test G1 |
| 6 | V1 | During simulated playback or a browser reconnection, demo prices and activity never acquire a genuine live-market claim. | A timer or stream makes synthetic data appear paid/live. | test G1 |
| 7 | V1 | From a fresh demo browser, the visitor can reach scanner and simulated positions without creating an account or entering a credential. | An auth gate strands the public tour. | test G1 |
| 8 | V1 | Selecting a sample scanner row opens the matching ticker, whose price, structure, history, options context, setups, and available positioning readings describe the same scenario. | Independently seeded widgets contradict one another. | test G2 |
| 9 | V1 | Scanner filters, sorting, saved view, and command search draw their results from the same populated sample symbol set. | One entry point silently serves a different universe. | test G2 |
| 10 | V1 | A supported ticker exposes sample values or an individually explained unavailable state for every currently mounted data-dependent widget and trade-entry choice. | An exposed widget stays blank with a successful-looking page. | test G2 |
| 11 | V1 | An unsupported symbol states that the demo has no scenario for it and offers a route back to supported samples. | A missing symbol silently falls through to network or a fabricated result. | test G2 |
| 12 | V2 | The simulated portfolio opens with linked open and closed examples, orders, decisions, marks, and a track record that agree with the selected sample scenario. | Separate sample ledgers yield contradictory outcomes. | test G2 |
| 13 | V2 | Completing an available simulated trade changes the demo portfolio and related record after reload. | A trade appears accepted but is lost. | test G3 |
| 14 | V4 | Reset Demo restores the original sample after a visitor edits or deletes demo entries. | Seed logic silently restores deleted entries before a requested reset. | test G3 |
| 15 | V4 | Editing or resetting the demo leaves a live-mode book and preferences already present in the same browser unchanged. | Demo state leaks into or overwrites live state. | test G3 |
| 16 | V2 | The read-only broker area identifies sample holdings separately from simulated trades. | — | review |
| 17 | V2 | Attempting broker connection or refresh in demo explains the limit without requesting a broker secret or contacting a broker. | A control sends a real credential or suggests a live connection. | test G1 |
| 18 | V2 | Sample alerts, persona choice, and risk/settings changes remain usable across navigation and reload within demo mode. | A non-market store silently uses live state. | test G3 |
| 19 | V2 | Requesting analysis for a supported scenario produces a labeled, preauthored sample explanation consistent with that scenario. | A sample is presented as newly generated AI or calls a provider. | test G1/G2 |
| 20 | V2 | Exporting that explanation retains its sample provenance. | A detached export looks like live or generated advice. | test G2 |
| 21 | V2 | Technical analysis shows a dated price series with named indicator windows/basis and enough context to relate each reading to the displayed sample period. | — | review |
| 22 | V2 | The available technical readings state what trend, momentum, and volatility imply within the selected sample scenario without turning the example into a current trade call. | — | review |
| 23 | V2 | When a selected sample period lacks enough observations, its affected indicator is explicitly unavailable while unaffected readings remain visible. | A warm-up gap becomes a plausible numeric reading. | test G4 |
| 24 | V2 | For available sample periods, indicator readings agree with independent known examples, including a flat series. | Wrong numeric results look credible. | test G4 |
| 25 | V2 | Public research lets a visitor change a supported sample scenario and see its thesis, evidence, risks, and outcome assumptions change together, with synthetic provenance retained. | Mismatched research evidence quietly supports the wrong case. | test G2 |
| 26 | V2 | If sample research evidence is absent, the affected claim is marked unavailable and no archive, citation, or paid-history claim is invented. | An absent corpus is represented as actual research. | test G2 |
| 27 | V1 | Once the demo is loaded, loss of network access leaves sample pages explorable. | — | review |
| 28 | V1 | An unavailable demo action explains its limit instead of showing an endless retry or blank success state. | — | review |
| 29 | V3 | A demo build remains demo after a repeated build/cache restoration. | A cache collision ships live traffic in the demo artifact. | test G5 |
| 30 | V3 | A separately selected live build retains the existing live behavior. | A demo adapter silently replaces the live product. | test G5 |
| 31 | V3 | A production demo journey across scanner, ticker, portfolio, technical analysis, and research completes with zero requests to app, vendor, broker, OAuth, or AI services. | A hidden path incurs paid egress or exposes credentials. | test G1 |
| 32 | V3 | The release report compares baseline and final compressed route sizes and build duration, records unchanged or improved existing limits, and names any accepted regression with its measured cost. | — | review |
| 33 | V1 | The hosted demo opens by direct link on every new public route. | A static host serves the home page but breaks deep links. | test G6 |
| 34 | V1 | Refreshing a hosted sample page retains visible demo provenance. | A deep-link refresh removes the sample warning. | test G6 |

**Verification economy.** Retain at most six new behavior groups initially: G1 one bounded production-build browser journey and network/provenance guard; G2 one scenario/consumer consistency contract group; G3 one demo-state round-trip/isolation group; G4 known-vector indicator group; G5 build-mode artifact/cache guard; G6 one deployed direct-link smoke. Reuse existing type, accessibility, compatibility, and visual gates. Target less than 30 seconds of added frontend unit CI and one bounded demo browser smoke; any increase needs measured risk and cost. Review-only rows still require recorded GATE Q evidence. A release is blocked by any false-live claim, external service contact in demo, state contamination, plausible fabricated analysis/history, or broken hosted core journey.

## Risks I see

- The public tour can look complete while an unvisited settings, export, stream, alert, or broker action still contacts a live service. The acceptance boundary covers actions as well as first paint.
- A seeded portfolio can show attractive but inconsistent marks, decisions, and track record. The story only works if the examples agree across screens.
- The backend atlas may accidentally imply deployed runtime proof from static source inspection. Its evidence labels must remain explicit.
- A chart can lend false authority to synthetic bars or insufficient indicator history. Named windows, as-of context, and unavailable states are part of the claim.
- A deployment may serve the correct homepage from an incorrect build or break direct links; the released artifact needs its own observed check.

## Assumptions I'm making about the other two lanes

- Architecture can provide one mode decision covering ordinary requests, both public streams, browser persistence, and exceptional account/operator actions without routing an unknown demo operation to a live service.
- Architecture can keep the public demo independent of paid services and production storage while retaining a separately selectable live build.
- Architecture can supply a consistent, deterministic scenario source for scanner, ticker, contracts, positions, explanations, indicators, and research, including explicit absence where evidence is unavailable.
- UX can make sample provenance and as-of context visible on each public data page without relying on a single dismissible notice.
- UX can distinguish simulated playback, stale/offline data, unavailable indicators, and genuinely live state without changing the meaning of existing live indicators.
- UX can introduce the public analysis/research experience in the Curvature Terminal v2 canon while keeping operator tools separate and unlinked from the trader journey.
