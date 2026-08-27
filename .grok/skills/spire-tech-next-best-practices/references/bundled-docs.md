# Bundled docs

Next.js 16.2+ ships version-matched docs inside the installed `next` package. Prefer that tree over
training data.

| Need | Where |
| --- | --- |
| Managed agent instruction | Workspace `AGENTS.md` at the Next app root, block `BEGIN:nextjs-agent-rules` … `END:nextjs-agent-rules` |
| Guides and API | `node_modules/next/dist/docs/` resolved from the app directory (monorepos: the `next` package may not sit at repo root) |
| A named guide whose numbered prefix is unknown | Search that docs tree for the slug file (example: `migrating-to-cache-components.md`) |
| Next 16.1 or earlier (no bundled docs) | Ask the human before running the Next `agents-md` codemod; it writes a local copy |

The managed block is upserted by `next dev` on 16.3+ when an agent environment is detected. Content
outside the markers is preserved. Do not delete the block to "clean" a diff — `next dev` re-creates
it.

If both `app/` and `src/app/` exist, Next builds `app/` and ignores `src/app/`. Resolve the app
directory from `next.config.*`, not from the current working directory.
