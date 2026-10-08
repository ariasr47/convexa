---
name: spire-tech
description: Select the installed Spire Tech cluster for this Grok Build session.
---

# Spire Tech selector

This is **cluster entry** for `spire:tech` — the human interface into the tech cluster, not the whole product and not a finished ascent.
Run `node .spire/bin/spire.mjs run tech --provider grok` before doing anything else and require it succeeds.
Use the native Node process exit code for the branches below. In PowerShell, append `; exit $LASTEXITCODE` to each standalone Node shell invocation (including doctor); in a multi-step script, capture `$LASTEXITCODE` immediately after Node and branch on that value before running another command. Do not infer the native code from a shell tool’s generic failure status. If it instead exits 2 and prints `E_STALE_V3_SYNTAX`, the root runs Direct-v4: write `{"root":"<this project root as an absolute path with forward slashes>"}` to `.spire/tmp/entry-doctor-in.json`, run `node .spire/bin/spire.mjs doctor --input .spire/tmp/entry-doctor-in.json --out .spire/tmp/entry-doctor`, and require exit 0 and a top-level `healthy` field equal to `true` in `.spire/tmp/entry-doctor/result.json` (the file is compact canonical JSON, so never match a spaced literal). If the first command instead exits 1 and its stderr names `no recovery launcher installed`, this machine has no local Direct-v4 install of this root — the install is machine-local and nothing here is broken. Say so in one line, and continue the boot without running the doctor. Any other outcome — including any other exit 1, or exit 2 without `E_STALE_V3_SYNTAX` — stops the entry.
Whatever the steps above concluded, next run `node .grok/tools/entry_status.mjs --then open` and show the operator its output exactly as printed. If the last line of that output is exactly `startup: stop`, stop the entry after showing the output. If it is exactly `startup: continue`, read a conductor only if the steps above continued the boot; if they stopped, stop the entry and say in one line that the steps above stopped it although the startup check did not. If the last line is neither, say so in one line and follow the steps above. Write any later command for the operating system its `machine:` line names.
Then read the validated native conductor at `.grok/ORCHESTRATOR.md` and follow its boot sequence.
The conductor mediates tech's default **web-app ascent** (discovery → council → plan → build → QA → ship). Prefer this entry for cold start; the conductor is not a second product surface.
This selection does not mean any role or gate executed.
