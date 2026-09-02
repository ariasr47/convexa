# PLAN_METHOD — how a plan is written in this kit

> Read by the `spire-tech-planner` role as a mandatory input at GATE PLAN (`ORCHESTRATOR.md` §3),
> and by anyone judging whether a plan is executable. `SPEC_TEMPLATE.md` owns what a spec looks
> like; this file owns what a `PLAN.md` looks like.

## The bar

A plan is written for a skilled engineer with ZERO context for this codebase: every task names
its exact files, every step shows the actual code or command, nothing is left as an exercise. If
a task needs a question answered before an implementer could start it, the plan is not done.

## Shape

- **Header:** the goal in one sentence, the architecture shape in two or three, the tech stack it
  binds, and Global Constraints — which MUST copy the `## Conformance spec` block from
  `INTERFACE_CONTRACT.md` verbatim so both lanes inherit the same binding shape (GATE PLAN law).
- **Tasks:** bite-sized, one deliverable each, in dependency order. Backend and frontend tracks
  must be independently executable in parallel. Each task carries its own test cycle: write the
  failing test → run it, watch it fail → implement minimally → run it, watch it pass → commit.
- **Independence table:** the **planner** writes a `## Independence` table on every GATE PLAN
  (including all-`Independent: no` rows — that is the honest “cannot split” signal). Columns:
  Task · Lane · Paths · Depends on · Independent. Lane is `backend` or `frontend` only — there
  is no third spawn lane. Task ids match `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`. Paths are
  repo-relative files or a single trailing `/**` directory; `{`, `?`, or a `*` that is not that
  trailing `/**` cannot be `Independent: yes`. Independent is `yes` or `no`.
  - `yes` only when this task shares **no** write path with another `yes` row in the same lane
    (after stripping a trailing `/**` or `/*`, one path must not equal or prefix the other),
    every `Depends on` id exists, and — for frontend — SPEC §4 names the files the task owns.
    If §4 does not name files, mark frontend `no`.
  - Modules both lanes need (API client, schema, tokens) are `Independent: no` on **one** lane,
    run first; `yes` rows `Depends on` them. Files outside `backend.dir` and `frontend.dir`
    go on one lane as `no`, never on both.
  - Overlapping `yes` paths in one lane is a **plan failure** — STOP and fix the table.
  - Each lane that has work names **exactly one closer** (`Independent: no`, `Depends on` every
    other task in that lane). Backend closer owns serve + `conformance-receipt.json` only — it
    does not re-implement worker paths. Frontend closer owns leftover visual/serve states only.
    Independent workers implement their paths and tests; they do not write the lane receipt.
  - **Conductor** does not bounce a missing table (archives, GATE M/V, old plans) — missing
    means one worker per lane. An all-`no` table is not a miss; it is “cannot split.”
- **Verification track:** names exact commands and their expected output — "run the suite" is not
  a verification step; the command with its expected pass count is.

## The banned moves

- "TBD", "add appropriate error handling", "similar to Task N" — placeholder text is a plan
  failure, not a shorthand.
- A step that describes without showing: if a step changes code, the step contains the code.
- Weakening a spec requirement to make it plannable — if the spec cannot be planned as written,
  STOP and report the contradiction (a GATE Z question), never plan around it.

## Plans are code

This kit has caught plan-authored defects in its own history — wrong regexes, false premises
about existing behavior, arithmetic that misled implementers. A plan therefore states, per task,
what a reviewer should probe; and an implementer who finds the plan contradicting the tree
reports the conflict instead of resolving it silently. DRY, YAGNI, TDD, frequent commits.
