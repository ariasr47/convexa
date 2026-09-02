# GATE Z bounce — archive-coverage-guardrails

**Owner:** Backend
**From:** GATE Q 2026-08-29
**Overall:** FAIL 53 PASS / 1 FAIL / 0 UNVERIFIABLE
**Independent conformance:** PASS 5/5 (matches builder)

## AC-21 FAIL

After 16:00 ET, a due `unreadable` identity must produce exactly one line
`session archive coverage warning — unreadable expected book {SYMBOL} {ET_DATE}`
(distinct from missing). Verify-by is **test**.

Observed: unreadable *cells* and CLI `[FAIL]` naming unreadable exist
(`deleted_body_is_unreadable_not_missing`, `unreadable_identity_cli_fail_names_unreadable`).
Missing and blocked S2 lines are tested. **No hermetic test asserts the unreadable
warning line fires once then latches.** Live serve on weekend 2026-08-29 emitted
zero S2 lines.

Fix: add a planted-unreadable (deleted body / unreadable locator) latch test that
captures the exact unreadable warning string once, then a second tick emits nothing
more. Do not fold unreadable into the missing template.
