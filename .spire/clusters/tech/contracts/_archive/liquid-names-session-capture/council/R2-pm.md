```json
{
  "role": "pm",
  "agree": [
    "Trigger is a **dedicated off-path ensure worker** (warmer-shaped loop cadence is fine; capture is **not** bolted onto `refresh_analytics`).",
    "**Do not** re-`append` to the ring (avoids burning a 48-slot / churning prune).",
    "If `T` is **not** scannable/servable that day: **do not fabricate** — leave honest `no session book` (`absent-is-not-none`).",
    "It does **not** add a route, component, token, motion, Settings row, Ask-AI line, Ticker chip, Scanner badge, or `/_ops` health chrome.",
    "Closed names SPY/QQQ/IWM are a **backend ensure scope**, not a user-facing taxonomy.",
    "This feature **reuses** that vocabulary; it does **not** invent a second one."
  ],
  "conflicts": [
    {
      "quote": "Extra Massive lives **only** on this arm, off the trader request path, ≤1 successful attempt intent per `(T, D)` while identity absent.",
      "source": "architect",
      "why": "Product + BRIEF lock invoice policy at at-most-one paid fetch per liquid name per ET day while the session identity is still absent — not at-most-one successful compute. Softening to successful-attempt intent silently re-opens same-day retry invoices after a failed force-compute, which AC-8 exists to forbid.",
      "proposal": "Bound the force-compute arm to at most one Massive fetch per `(T, D)` for the ET day while identity is absent (presence short-circuit + singleflight + no same-day re-arm after a completed attempt, success or fail). Later ET days are new identities.",
      "kind": "product"
    },
    {
      "quote": "Optional fire-and-forget wake from scanner/ticker warm traffic for those three symbols is allowed only if it never joins the trader HTTP await path.",
      "source": "architect",
      "why": "Await-only is weaker than the product path rule: extra Massive I/O must not sit on the ticker/scanner request path at all. A request-scoped fire-and-forget that still starts vendor/ensure work can contend with desk latency and rate limits even when HTTP does not await.",
      "proposal": "Allow at most a non-blocking wake signal into the dedicated ensure worker from warm traffic; Massive and force-compute run only inside that off-path worker, never as request-scoped tasks from ticker/scanner handlers.",
      "kind": "technical"
    },
    {
      "quote": "**Honest degraded outcomes** — disabled ensure, true never-captured, ensure failure, and research miss remain distinguishable and non-fabricating (`absent-is-not-none`).",
      "source": "pm",
      "why": "Overclaim. UX correctly keeps one shipped miss string for every no-identity cause and bans why-taxonomy (warm cache / not ensured / not a lab name). Disabled ensure, never-captured, and ensure failure are not operator-distinguishable from each other in research copy — only the four shipped classes stay distinct (session miss ≠ ring miss ≠ not storing ≠ unreadable).",
      "proposal": "Retract cause-level distinguishability among no-identity cases. Keep AC-10–14 as honesty/non-fabrication + four-class separation; do not require miss copy to explain why the identity is absent.",
      "kind": "product"
    }
  ],
  "asks": [
    "Architect: What concrete predicate implements “in today’s paid-capture / scannable-servable universe” for ET date D, so holiday or outside-coverage absence stays honest `no session book` rather than a failed AC-1–3?",
    "Architect: By what observable deadline on or after ET date D has the dedicated ensure worker finished for SPY/QQQ/IWM so research list/load hit is checkable for the ship-blocking warm-cache guarantee?",
    "UX: Confirm operator verification stays list/load against the shipped session-book envelope only — no fifth miss/pending class and no ensure-progress chrome when a read lands before the off-path worker has completed."
  ]
}
```
