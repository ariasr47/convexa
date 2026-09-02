---
name: spire-tech-next-best-practices
description: Use when writing, reviewing, or refactoring Next.js App Router or Pages routes, next.config, metadata, or Next routing and caching APIs. Triggers on Next.js implementation. Skip non-Next stacks. Prefer this over spire-tech-frontend-patterns for Next-framework conventions. Prefer spire-tech-next-cache-components for cacheComponents and instant navigation.
when-to-use: Next.js App Router, Pages router, next.config, metadata, routing, Next.js caching
---

# Next.js best practices — version-matched docs, not a forked table

Own **Next-framework convention lookup** when the project is Next.js. Do not own React component
craft (`spire-tech-react-composition` and the other React specialists) or the Cache Components
adopt/optimize loop (`spire-tech-next-cache-components`). Do not author a parallel rule table.

**Exit artifact:** the lane applies the installed Next version's docs; the done-report names the
docs path or managed-block instruction that governed the change.

## Critical procedure

1. Confirm this is a Next.js app: `next` in package.json, a `next.config.*`, and an `app/`,
   `src/app/`, `pages/`, or `src/pages/` tree. Stop if it is not Next.
2. Read the Next-managed block in the workspace `AGENTS.md` at the Next app root (markers
   `BEGIN:nextjs-agent-rules` / `END:nextjs-agent-rules`) when present.
3. Read the matching guide under the installed package `node_modules/next/dist/docs/` (resolve from
   the app directory in a monorepo). That tree is the rule authority for this installed version.
4. Apply those rules. Training-data Next APIs lose to the bundled docs. Project canon and SPEC
   still outrank generic Next advice.
5. If the managed block is missing and Next is 16.3 or later, start the project's Next dev command
   so the framework can upsert the block, or add the instruction to read the bundled docs before
   writing code. If docs are not bundled (16.1 and earlier), tell the human about the Next
   `agents-md` codemod — do not download docs unasked.
6. Prefer `spire-tech-next-cache-components` when the work is `cacheComponents`, `"use cache"`,
   instant navigation, or blocking-prerender errors.

## Reference routing

| Read when | Reference |
| --- | --- |
| Locating bundled docs or the managed AGENTS.md block | [Bundled docs](references/bundled-docs.md) |

## Stop conditions

Stop when the project is not Next.js, when the installed `next` version cannot be determined, or
when a bundled-doc rule would override project canon or the approved feature direction. Skip rather
than invent Next guidance.

## Do not

- Do not apply Next conventions to a non-Next stack.
- Do not fork a living Next rule table into this package; bundled docs outrank this skill.
- Do not fetch Next docs over the network when the bundled tree is present.
- Do not out-rank the consumer's project-owned canon, `PROJECT_CONTEXT.md`, or SPEC.
