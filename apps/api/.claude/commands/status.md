---
description: Report current GammaFlow pipeline state from the manifests + backlog (no full bootstrap).
---
Read every `_MANIFEST.md` under `.claude/contracts/` (live, not `_archive/`), plus `.claude/BACKLOG.md`
§A and the latest "Last GATE I" note. Report concisely, as a table: each live feature · Stage · last
gateway · open amendments · QA (GATE Q) status. State whether the queue is drained and what the natural
next gateway is. **Do not act — just report.**
