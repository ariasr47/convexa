# Research notes

Ticker research published on the site: each note shows on its ticker's **Research** tab
(`/ticker/<TICKER>/research`), and `/research` lists every ticker that has notes. Notes are plain
Markdown files, compiled into the site at build time, so they work while live market data is off.

## Add a note

1. Copy [`_template.md`](_template.md) to `research/<TICKER>/<YYYY-MM-DD>-<short-name>.md`, for
   example `research/NVDA/2026-10-12-supply-chain.md`. The folder is the uppercase ticker.
2. Fill in the front matter and write the note.
3. Check it: `npm run research:check` (the pre-push hook runs this too).
4. Commit and push to `main`. Cloudflare Pages rebuilds the site with the new note.

Edit a note in place and set `updated:` when its view changes. Keep older notes: the Research tab
shows the newest note open and earlier ones folded below it, so the history of a thesis stays visible.
Files starting with `_` are ignored, which suits drafts.

## Front matter

| Field     | Required | Example                     | Notes                                           |
| --------- | -------- | --------------------------- | ----------------------------------------------- |
| `ticker`  | yes      | `NVDA`                      | Must match the folder name                      |
| `date`    | yes      | `2026-10-12`                | When the note was written                       |
| `title`   | yes      | `Supply still runs short`   | Shown as the note heading                       |
| `stance`  | no       | `bullish`                   | `bullish`, `bearish`, `neutral` or `watching`   |
| `horizon` | no       | `2–6 weeks`                 | Free text                                       |
| `tags`    | no       | `semis, earnings`           | Comma-separated                                 |
| `summary` | no       | `One or two sentences.`     | Shown on `/research`; defaults to the first paragraph |
| `updated` | no       | `2026-10-20`                | Last meaningful revision; not before `date`     |

Any other field is an error, so a typo can't publish a half-labelled note.

## Supported Markdown

Paragraphs, `##` and `###` section headings (the title comes from front matter, so no `#`), bullet and
numbered lists (nested by indenting two spaces), `> quotes`, tables, fenced code blocks, `---` rules,
**bold**, _italic_, `code`, and links.

Links must start with `https://`, `http://`, or `/` for a page on this site (for example
`/ticker/NVDA`). Bare URLs become links too. Every external link is also listed under **Sources** at
the end of the note. Images and raw HTML are not supported.
