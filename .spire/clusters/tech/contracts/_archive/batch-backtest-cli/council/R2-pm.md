```json
{
  "role": "pm",
  "agree": [
    "architect: \"Sharing a flag or renaming `score-lab` to absorb replay is an explicit non-goal.\" — locks S8/AC-21/AC-22; P3 sits beside P2, never silently replaces it.",
    "architect: \"Exactly one of `--split-at` / `--train-frac` required when a split is requested; if neither is given, the run is **unsplit** (full corpus as one bucket) — still a valid measurement run.\" — matches my open decision that no-split replay-all is the default.",
    "architect: \"**PM** will treat \\\"measurement\\\" in v1 as **descriptive aggregates over replayed Path-B outputs** (counts, score/tier distributions, GEX/structure summaries per split bucket), not a requirement to reuse score-lab's comparative AUC/lift pipeline on day one — if false, Architect must name a pairing key between snapshot rows and outcomes (currently absent).\" — accepted; AC-1 requires offline compute per book, not diary AUC/lift.",
    "architect: \"Filename stamp may differ; content identity is what the BRIEF observes.\" — matches AC-8 (substantive body byte-identical; timestamp/path may differ).",
    "architect: \"**Absent ≠ empty ≠ error:** capture-disabled ≠ empty_corpus ≠ per-row missing ≠ compute_failed.\" — accept the distinction principle (retracting any reading of my empty-store row that collapses Disabled/not-storing into honest-empty); the incomplete book-level vocabulary is a separate conflict below.",
    "ux: \"There is **no trader screen here.**\" — hard Out; AC-19/AC-20.",
    "ux: \"SPEC §4 must carry **`NO_UI_CHANGE`** and must not restate the token table.\" — accepted in full.",
    "ux: \"**The report does not say the live score should change.**\" — AC-16/AC-17; measurement-only.",
    "ux: \"Requesting a symbol with no snapshots prints exactly **`no stored snapshot for <SYMBOL>`** (optional ` at <as_of>`) and does not call Massive\" — I deferred exact literals to UX; AC-10 binds the distinction, UX binds the string."
  ],
  "conflicts": [
    {
      "quote": "**capture_disabled** — store open path is `Disabled` / `\"capture not storing\"` → hard CLI error **before** any artifact claim of \"empty research.\"",
      "source": "architect",
      "why": "My degraded table and AC-23 require that with capture turned off going forward, replay over **already stored** books still completes with zero Massive calls. If `Disabled` / \"capture not storing\" hard-fails store open, research cannot read the corpus we already paid to keep — the BRIEF's whole point. Named failure is right when the store truly cannot open; it is wrong if the same mode is how capture write is switched off while historical bytes remain.",
      "proposal": "Split write-disabled from read-unavailable: capture write off must still list/load existing snapshots for this CLI; hard CLI error only when the store backend cannot be opened or is unreadable as a store (AC-15). Empty enabled store with zero metas stays honest empty (AC-9), distinct from that hard failure.",
      "kind": "technical"
    },
    {
      "quote": "**empty_corpus** — store enabled; list filters yield zero metas → write an honest empty artifact (zero replayed rows), exit success for the empty case the BRIEF requires.",
      "source": "architect",
      "why": "AC-9 forbids a success-looking measurement artifact that can later be read as a run with findings. A dated file under the research output path with exit success is exactly what gets pasted into a weekly note as \"we measured and found nothing scored,\" even with zero rows. BRIEF's \"honest empty\" means no silent live fetch and an operator-visible empty — not permission to emit a quotable research report.",
      "proposal": "Empty corpus → console/stderr honest empty with closed vocabulary; write **no** research report artifact under the research output path. Keep capture-disabled / unreadable-store as loud named failures with no measurement artifact (AC-15).",
      "kind": "product"
    },
    {
      "quote": "Empty train or empty holdout after a requested split is an **honest empty bucket** in the report (counts = 0), not a silent re-cut and not a vendor fetch.",
      "source": "architect",
      "why": "An empty train or empty holdout after the operator explicitly requested a split is not a useful measurement — it fabricates split theater (my risk #7 / AC-4/AC-5). My open product decision already recommended refusing split mode with an honest message rather than shipping empty buckets; allowing counts = 0 as success lets a one-book corpus or a cut past every as_of look like a completed split run.",
      "proposal": "When a split is requested and the cut cannot produce two non-empty buckets, refuse split mode with an honest named message and write no split membership report. Unsplit replay-all remains available. Owner confirms on the Decision card if empty buckets should ever be allowed.",
      "kind": "product"
    },
    {
      "quote": "**replayed** — load + deserialize + compute succeeded.",
      "source": "architect",
      "why": "The closed row vocabulary is only replayed / missing / unreadable / compute_failed. A stored identity that loads with an empty/unusable chain can still return Ok from compute and land as **replayed**, which would present zeros as a successful measurement. That collapses AC-12 and `[absent-is-not-none]` (absent ≠ empty book ≠ replay error). UX-8 depends on the same missing disposition.",
      "proposal": "Add an explicit row disposition for empty/unusable loaded book (snapshot present; book empty as stored), distinct from replayed, missing, unreadable, and compute_failed, and carry it into console + artifact.",
      "kind": "technical"
    },
    {
      "quote": "Honest empty corpus (capture off / empty store) produces **no** measurement artifact that could later be quoted as \"we measured and found nothing scored\"",
      "source": "ux",
      "why": "I agree that empty corpus must not emit a quotable measurement artifact (AC-9). The parenthetical equates \"capture off\" with empty store as the same situation. Capture off with retained books must still replay (AC-23); only zero metas after an honest list is empty corpus. UX's own state matrix already lists capture-not-storing under error—unreadable, so treating bare capture off as empty corpus contradicts both AC-23 and that row.",
      "proposal": "Keep UX-10's no-measurement-artifact rule for true empty corpus (zero metas). Amend the trigger: empty corpus = enabled store / filters yield zero snapshots — not \"capture off\" alone. Capture-not-storing / Disabled stays on the named-failure path; capture write off with stored books stays on the success/replay path.",
      "kind": "technical"
    }
  ],
  "asks": [
    "Architect: When store mode is Disabled / \"capture not storing\", does open fail before any list/load, or can research still read snapshots already on disk? AC-23 is blocked until this is settled.",
    "Architect: After adding empty/unusable-book, is the gate evaluated before calling compute (disposition without a score figure) or after compute returns empty-derived outputs?",
    "UX: Once Architect names the empty-stored-book disposition, what exact operator literal ships (parallel to `no stored snapshot for <SYMBOL>` / `stored snapshot unreadable: <reason>`)? AC-12 needs the distinction; you own the words."
  ]
}
```
