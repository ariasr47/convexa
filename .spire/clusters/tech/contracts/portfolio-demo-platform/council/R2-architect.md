```json
{
  "role": "architect",
  "agree": [
    "The static site demonstrates product workflows and repository-described architecture, not a running backend.",
    "Ticker's existing `live` connection chip, per-figure live dots, pulses and tick flashes are suppressed for synthetic data.",
    "Do not expose `/_ops/research` as public research."
  ],
  "conflicts": [
    {
      "quote": "Preserve meaningful filtering, symbol navigation, simulated trade actions, and exports where those flows already exist.",
      "source": "pm",
      "why": "My R1 finite precomputed bundle-variant mechanism does not cover the current ticker query's independent DTE bounds, expiry set, optional off-exchange inclusion, and position contract/P&L inputs. A matching expiry set alone cannot supply a correct position evaluation or preserve all existing filter choices; returning an unrelated variant would fabricate agreement across widgets.",
      "proposal": "Withdraw the claim that expiry-set variants alone are complete. Compile a full-chain scenario as the base, then use a deterministic local projection for supported filter and position inputs, validated against the live DTO's field semantics. If a specific input cannot be projected truthfully, mark that operation unavailable at its control and in the response without network fallback.",
      "kind": "technical"
    },
    {
      "quote": "Once the demo is loaded, loss of network access leaves sample pages explorable.",
      "source": "pm",
      "why": "The proposed static build lazy-loads analysis, research, and per-symbol catalog chunks. Loading the landing page does not by itself put unvisited chunks in the browser cache, so an immediate network loss can make those pages fail even though their data provider is local.",
      "proposal": "Precache the public route code and supported scenario assets before declaring the demo ready, then verify navigation with the network blocked. Measure the startup-byte cost against the landing budget; if that cost is unacceptable, return a separate product decision to narrow offline scope.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: Does offline exploration mean every supported route after only the landing page has loaded, including routes the visitor has never opened?",
    "PM: Which simulated order transitions must occur during playback, beyond a seeded pending/completed history and a newly confirmed paper trade?"
  ]
}
```
