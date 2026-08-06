---
name: delivery-code-review
description: Review dimensions for reading shipped code behind an acceptance criterion — security, performance, correctness, maintainability. Use at GATE Q when inspecting an implementation. Produces findings for QA_REPORT.md and prescribes no document of its own.
---

# Code review dimensions (GATE Q)

You are reading code to decide whether an acceptance criterion actually holds. These are the
dimensions worth reading for.

**This skill gives you no document to write.** `QA_REPORT.md` is the only output, and its shape is
defined by your role, not here.

## Security

No other role in this pipeline owns security. Read for:

- **Injection** — untrusted input reaching a query, a shell, a template, or an evaluator.
- **Authentication and authorization** — a route or handler that checks neither; an object fetched by
  id with no ownership check.
- **Secrets** — credentials, tokens or keys in source, in logs, or in a response body.
- **Data boundaries** — data crossing from one tenant, user, or trust zone into another.

## Performance

- **Queries in a loop** — one query per row where a single query would do.
- **Unbounded work** — a fetch with no limit, a list with no pagination, a payload that grows with
  the data set.

## Correctness

- **Race conditions** — shared state mutated from two paths; read-then-write with no guard.
- **Edge cases** — empty, one, many; null and absent treated as the same thing; boundary values.
- **Error paths** — a failure swallowed silently, or one that reports success anyway.

## Maintainability

- **Hollow coverage** — a test that names a behavior but asserts nothing about it.

## Reporting

Findings belong beside the criterion they bear on, in `QA_REPORT.md`: the criterion verbatim, the
verdict, and the evidence. Keep the verdict vocabulary that report already uses — do not introduce
another one.

A finding that bears on no criterion is still worth recording. It does not by itself fail the gate;
route it as an amendment to the owning lane.
