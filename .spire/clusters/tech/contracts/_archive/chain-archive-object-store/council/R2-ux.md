```json
{
  "role": "ux",
  "agree": [
    "A locator with a missing object is **unreadable**, not \"no book,\" and not a vendor miss.",
    "**Non-move.** `ChainSnapshotStore` / `pg_chain_snapshot` keep co-located BYTEA / `body_b64` under the existing 14d + 48/symbol prune.",
    "**Prod adapter named:** **Railway volume (or any host path) via env-configured filesystem root** — not S3 this ship.",
    "UX will uphold `NO_UI_CHANGE`: no trader-facing layout, chrome, or copy work; research outcome vocabulary stays the existing closed set (`no session book` / `session book unreadable` / `session archive not storing`) without new trader surfaces.",
    "There is **no trader UI to design**; UX will not invent an object-store browser, session-history trader surface, or Settings control to \"make storage visible.\"",
    "**Research load stays zero-vendor** — present body, missing identity, missing object, corrupt object, and not-storing alike: **never** a Massive fill-in.",
    "**Absence classes stay split** — `no session book` ≠ `session book unreadable` ≠ `session archive not storing` ≠ empty/pruned ring (`absent-is-not-none`).",
    "**Authorizes: nothing** on the live score.",
    "Operator verification (list / load / miss / unreadable / not-storing) is available **without** using the trader UI."
  ],
  "conflicts": [
    {
      "quote": "**`review` owns** absence of trader UI (AC-15), not raising 48 / not buying hist-chain (AC-19/20), program non-absorption (AC-21), explicit ring-body decision (AC-22), operator-without-trader-UI (AC-23), \"authorizes: nothing\" framing (AC-24), and Path-B same-store continuity at product level (AC-25).",
      "source": "pm",
      "why": "Trader-chrome absence and the hit-envelope `authorizes: nothing` field are negative space / wire invariants: a Settings row, `/_ops` storage badge, Ask-AI disclosure, or dropped `authorizes` key can land under an unrelated change while a review pass still looks fine. Risk-based verify assigns that silently-regressing class to `test` (structural `apps/dashboard` empty-diff + research-wire assertion) — matching UX AC-U1/U2/U13. Bundling them with intentional scope checks (no 48 raise, no hist-chain, program non-absorption, named ring deferral, Path-B continuity, positive operator-without-trader-UI) conflates two risk classes.",
      "proposal": "Reclassify AC-15 and AC-24 as `Verify by: test`; leave AC-19–AC-23 and AC-25 as `review`. No DOM harness required — route/affordance negative assertion plus wire-field assertion is enough.",
      "kind": "technical"
    },
    {
      "quote": "Operator-facing clarity may lightly touch research wording so `no session book`, `session book unreadable`, and `session archive not storing` stay distinguishable when object miss becomes common — but pixel layout, motion, and theme work are out of scope; my ACs bind operator list/load/desk observables, not screens.",
      "source": "pm",
      "why": "Those three strings are already the shipped closed set that keeps object-miss distinguishable (`session book unreadable: <reason>` for identity/pointer without readable body; miss stays miss; not-storing stays not-storing). \"Lightly touch\" invites a second deck or storage-backend synonyms (\"object store miss,\" \"volume unavailable,\" \"off Postgres\") — UX's defining failure mode and a direct reopen of session-chain-archive §4.",
      "proposal": "Withdraw \"lightly touch.\" Reuse exact shipped session-chain-archive §4 strings; map missing object onto existing unreadable; ban storage-branded rename strings. Pixel/motion/theme stay Out; `NO_UI_CHANGE` in SPEC §4.",
      "kind": "product"
    },
    {
      "quote": "When the object / volume store is **disabled / not configured / unavailable**, the trader desk remains available; archival does **not** report a false stored success; the operator can observe honest **`session archive not storing`** (or store-error) distinct from `no session book` and from unreadable.",
      "source": "pm",
      "why": "The parenthetical \"or store-error\" opens a synonym for the disabled/unavailable class and risks collapsing it into list I/O `session archive store error: <reason>` or into unreadable. Shipped vocabulary already separates not-storing (archive disabled/unavailable) from list store-error and from unreadable; AC honesty requires the exact not-storing string for this situation, not an equivalent class name.",
      "proposal": "Bind AC-8's operator-visible outcome to exact **`session archive not storing`** when the archive/store is disabled / not configured / unavailable at open. Keep list metadata I/O faults on **`session archive store error: <reason>`** and missing/corrupt body on **`session book unreadable: <reason>`** — no \"or store-error\" alias for not-storing.",
      "kind": "technical"
    }
  ],
  "asks": [
    "Architect: confirm research list/load wire fields and closed miss/unreadable/not-storing `detail` strings remain byte-compatible with shipped session-chain-archive under the FS body store (no storage-location envelope field; no fifth \"S3\"/\"volume\" miss enum member).",
    "Architect: what opaque `<reason>` tokens (if any) already ship on `session book unreadable: <reason>` so the storage-backend ban list does not forbid a live fault string you already emit?",
    "PM: accept Verify-by `test` for AC-15 (trader-UI silence) and AC-24 (`authorizes: nothing` on research hit), keeping AC-19–23 and AC-25 as `review`?",
    "PM: withdraw \"lightly touch research wording\" in favor of exact session-chain-archive §4 reuse for this ship?"
  ]
}
```
