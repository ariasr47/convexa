```json
{
  "role": "ux",
  "agree": [
    "A visitor can explore Convexa's actual product flows without an account, paid feed, AI key, or broker connection, while always knowing that the market, portfolio, analysis, and research examples are synthetic.",
    "Real session, broker credentials, OAuth, LLM keys, and live position refresh are unavailable capabilities in demo.",
    "Synthetic research/analysis numbers carry a fixture-to-bundle or fixture-to-bar trace; a missing basis remains unavailable, not zero or an asserted fact.",
    "Once the demo is loaded, loss of network access leaves sample pages explorable."
  ],
  "conflicts": [
    {
      "quote": "On each public data page in the demo, a visitor can identify the content as sample data and find its scenario as-of date without opening documentation.",
      "source": "pm",
      "why": "The SET DESIGN_SYSTEM.md rule 18 requires one page connection chip drawn from live, closed, overnight, no ticks, offline, or replay. None truthfully describes an authored synthetic scenario. Satisfying the page-level provenance criterion while obeying that unchanged chip rule would force a false connection or recorded-session claim. This is a design-canon amendment decision, not a seventh state UX can silently invent.",
      "proposal": "Amend rule 18 narrowly for demo mode: show persistent text-visible 'Demo · sample data' provenance with the scenario as-of date, suppress the six-state connection chip and paid-live motion for synthetic figures, and retain the existing six states for genuine live mode. Put the amendment in DESIGN_SYSTEM.md after the council ruling.",
      "kind": "product"
    }
  ],
  "asks": [
    "PM: In the research criterion, does changing a supported sample scenario mean selecting another symbol, or must one symbol offer multiple selectable cases? The answer determines Research navigation and its empty state.",
    "Architect: Is the stored simulation epoch a fixed authored scenario anchor or a visitor's first-use wall-clock instant? Which explicit field supplies the as-of label so sample history and expiries never imply an observed market date?",
    "Architect: Which distinct typed outcomes will identify an unsupported symbol, absent optional value, insufficient indicator history, cold load error, failed refresh with retained data, and paused playback? UX has different copy and retention behavior for each.",
    "Architect: Does browser network loss pause local simulated playback, or can it continue from already loaded assets? UX will reserve 'Simulated playback paused' for an actual pause rather than treating browser offline status as evidence of one."
  ]
}
```
