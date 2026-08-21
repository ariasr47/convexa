# batch-backtest-cli — R3 decisions

Source: `council/conflicts.json` (11 conflicts, 11/11 quotes, 2 self-revisions).

## Folded — self-revisions (no exchange)

### T0a — Capture-write-off is not a hard-fail
- **Conflict id:** `bbcd0eed…` (architect self-revision)
- **Ruling:** Hard-fail only when the store cannot be opened for read. If capture *write* is off but dated books remain, open read-only and replay. Empty inventory after a successful open is `empty_corpus`, not `capture_disabled`.
- **Also covers:** `1db2ae27…` (pm), `61271bd1…` (architect vs ux), `8b28de31…` (pm vs ux) — same split.

### T0b — Empty corpus writes no measurement artifact
- **Conflict id:** `4b3f9f38…` (architect self-revision)
- **Ruling:** `empty_corpus` → console-only honest empty; **no** dated measurement artifact; zero Massive; exit success. Matches PM AC-9 / UX-10.
- **Also covers:** `adcadbcb…` (pm), `79c17b42…` (ux) — same rule. Not a remaining human call.

## Default-with-veto

### D-metrics — v1 report is descriptive only
- Architect left summary stats to PM. **Proceeding:** v1 prints descriptive Path-B aggregates already on the replayed row (score/tier/walls/flip/etc. as compute emits). **No** score-lab AUC/lift pairing required this ship. Say `stop` to add comparative metrics now.

## Human product call

### D1 — Split when one side would be empty — **A (owner 2026-08-18)**
- **Conflicts:** `7cb902fd…` · `caf7f902…`
- **Ruling:** If a requested split cannot produce **two non-empty** buckets, **refuse split mode** with an honest named message. Write **no** split membership report. Unsplit replay-all remains available. Do not print train=0 / holdout=0 as a completed split.
- **Settled by:** owner letter A.

## R3 closed
All product calls settled (D1=A, D-metrics default, T0a/T0b/T1). Synthesizer writes SPEC + INTERFACE against this file.

## Folded — technical (voices converged)

### T1 — Empty stored book is its own row disposition
- **Conflicts:** `0cb8f978…` · `c273ecd1…`
- **Ruling:** Closed type `empty_book` — snapshot present, stored chain empty/unusable; gated **before** compute (no score figure). Operator literal: `empty stored book for <SYMBOL>` (optional ` at <as_of>`). Distinct from `no stored snapshot for <SYMBOL>` and `stored snapshot unreadable: …`.
- **Settled by:** R3 architect + pm + ux.
