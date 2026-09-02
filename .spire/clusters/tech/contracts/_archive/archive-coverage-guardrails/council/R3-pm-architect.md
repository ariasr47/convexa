```json
{
  "role": "pm",
  "pair": "architect",
  "converged": true,
  "locks_honored": [
    "D1: due clock = 16:00 America/New_York. Named residual: 16:00 is not 48-slot prune salvage.",
    "D2: default matrix is one ET date D (today, or the date the CLI names). Unbounded storing-window is out of v1. Forensic history is a second run with a named weekday."
  ],
  "resolutions": [
    {
      "conflict_id": "1fcb87c522fba144510e1ce07c614bbac4f242dc70509f4b7aee14b8baa1dd95",
      "quote": "5. **Storing window** starts the first ET weekday this environment was actually storing — the 21 Aug “unset root” days must not count as missing.",
      "resolution": "After D2 there is no storing window and no since. Do not bake a calendar storing-start into the product. Do not treat the first present live paid book as a window start (that hides a leading named miss when a later day is the first present — the 24–25 / 26 case). Default D is today: weekdays other than D, including dates from before this environment was storing, do not appear as missing cells on that run, so unset-root days are not a default missing grid. A named ET weekday is operator-chosen expected date (weekday rule, seed excluded). If that due identity has no live paid book, the cell is missing — not a distinct not-expected-because-not-yet-storing class. That distinction has no honest oracle without a baked date or a first-present inference, both refused. Accepted residual on the named-date path only. Currently not-storing remains the matrix-level not-storing outcome (not this residual). Explicit since is Future-dated if forensic false-missing on pre-storing named weekdays becomes noise.",
      "withdrawn": "Any remaining reading of AC-12 that a named forensic weekday from before storing must classify as not-expected / not-missing. v1 since / storing-start flag. Inferring storing start from first present.",
      "acs": [
        {
          "fold": "AC-12 restated (default D)",
          "criterion": "Given the default matrix evaluates one ET date D (today unless another ET date is named) and the session archive is storing, eligible ET weekdays other than D — including weekdays from before this environment was storing — do not appear as missing cells on that run.",
          "verify_by": "test"
        },
        {
          "fold": "named-date residual (own row, not buried in AC-12)",
          "criterion": "Given the session archive is storing and the operator names an ET weekday D that is due, a due identity with no live paid-vendor session book on D is missing — not a distinct not-expected / not-yet-storing class — and the audit exits non-zero on that cell.",
          "verify_by": "test"
        },
        {
          "fold": "anti-first-present (own row)",
          "criterion": "Given a later ET weekday holds the first present live paid book for a symbol and the operator names an earlier due ET weekday with no live paid book, that named cell is missing — the later present day does not make the earlier day not-expected.",
          "verify_by": "test"
        }
      ]
    },
    {
      "conflict_id": "a35113676817db277fb5cc2a41468b505c1ca1f4f8f9f40805f800981d644596",
      "quote": "Walk `list(symbol, None)` newest-first (`MemoryInner::list` already sorts by `et_date` ascending).",
      "resolution": "Last-readable for symbol S at evaluated date D is the newest present live paid-vendor identity for S on or before D. After D2 the matrix is one D, so this is per-symbol when-any for that D — not a historical grid of per-row values, and not the newest present anywhere in the archive. Naming D2 while a later D3 is present still yields last-readable on or before D2, never D3. Seed is never last-readable. Unreadable and wrong-source occupants are skipped, not treated as last-readable. If none qualify: honest none — not a fabricated date, not seed, not another symbol. Walk-cap copy when the bound is hit without a qualifying present is not this exchange.",
      "withdrawn": "Last-readable as newest-in-archive with no upper bound of D.",
      "acs": [
        {
          "fold": "AC-5 restated (one D, named forensic still bounded)",
          "criterion": "Given symbol S has a present live paid book on ET date D1, is missing on later due date D2, and has a present live paid book on still later D3, evaluating D2 (named) shows last-readable as S on D1 (on or before D2) — not D3, not seed, not another symbol.",
          "verify_by": "test"
        },
        {
          "fold": "AC-6 unchanged honesty",
          "criterion": "Given symbol S has no live paid book on or before evaluated date D, last-readable is an honest none — not a fabricated date, not a seed/conformance fixture identity, not another symbol’s date.",
          "verify_by": "test"
        },
        {
          "fold": "present D is its own last-readable",
          "criterion": "Given evaluated date D is present for symbol S as a live paid book, last-readable for S is that same identity (on or before D).",
          "verify_by": "test"
        }
      ]
    },
    {
      "conflict_id": "195f0ecccf5b486648555add335439bb41df5fce3e7c9f302e262a5802dabaf4",
      "quote": "**Last readable:** latest `present` identity for that symbol inside the archive that is **not** the seed fixture.",
      "resolution": "Same lock as a3511367. BRIEF when-any is last-readable for evaluated D when any live paid book exists on or before D, seed excluded. Global latest in the archive is refused: a later present date on an earlier hole invents a prior success that row did not have. Trailing last-readable after D2 is that one per-symbol value for D, still bounded by D. Operator copy of none vs undetermined-at-cap remains architect ↔ ux.",
      "withdrawn": "Last-readable as latest present anywhere in the archive.",
      "acs": []
    },
    {
      "conflict_id": "4756d937ac1c4ddc176726e56cc9f27ac8e67bf30acdc18c825f72ca31f42b76",
      "quote": "Each due identity is exactly one of **present** · **missing** · **unreadable**.",
      "resolution": "Confirm the unanimous fold and architect’s distinct arm. A fixture or reconstructed occupant of a due identity is a distinct due outcome: not present, not missing, not unreadable. Audit exits 0 only when every due expected identity is present; this occupant fails the audit. After 16:00 America/New_York, exactly one structured warning for that (symbol, ET date) whose line does not reuse missing or unreadable templates. Identities that fail the due audit include this outcome so print, that list, and exit agree. Matrix-level errors (not-storing, compute-fail) stay out of the per-identity hole family. Seed identity exclusion is unchanged and is not this arm. Operator-visible token remains UX to name. Coverage never inserts such an artifact as a live paid book.",
      "withdrawn": "The three-class due set as exhaustive (already self-revised a071ffd7; this exchange confirms the replacement).",
      "acs": [
        {
          "fold": "AC-13 split — not present",
          "criterion": "A fixture or reconstructed occupant of a due identity is not classified present as a live paid-vendor session book.",
          "verify_by": "test"
        },
        {
          "fold": "AC-13 split — not missing, not unreadable",
          "criterion": "That same occupant is not classified missing and is not classified unreadable.",
          "verify_by": "test"
        },
        {
          "fold": "AC-13 split — audit fail",
          "criterion": "The audit command does not exit 0 on the strength of that occupant; exit 0 only when every due expected identity is present.",
          "verify_by": "test"
        },
        {
          "fold": "wrong-source warning (own row)",
          "criterion": "After 16:00 America/New_York, a due fixture or reconstructed occupant causes exactly one structured operator warning for that (symbol, ET date) whose wording does not reuse the missing template and does not reuse the unreadable template.",
          "verify_by": "test"
        }
      ]
    }
  ],
  "still_open": [
    "Operator-visible cell literal and warning line for wrong-source occupancy (UX names copy; this exchange only locked the distinct due outcome + audit fail).",
    "Last-readable walk-cap copy when the bound is hit without a qualifying present (architect ↔ ux; on-or-before D is locked regardless)."
  ]
}
```
