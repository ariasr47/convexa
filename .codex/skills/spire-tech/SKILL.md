---
name: spire-tech
description: Select the installed Spire Tech cluster for this Codex session.
---

# Spire Tech selector

This is **cluster entry** for `spire:tech` — the human interface into the tech cluster, not the whole product and not a finished ascent.
Run `node .spire/bin/spire.mjs run tech --provider codex` before doing anything else and require it succeeds.
If it instead exits 2 and prints `E_STALE_V3_SYNTAX`, the root runs Direct-v4: write `{"root":"<this project root as an absolute path with forward slashes>"}` to `.spire/tmp/entry-doctor-in.json`, run `node .spire/bin/spire.mjs doctor --input .spire/tmp/entry-doctor-in.json --out .spire/tmp/entry-doctor`, and require exit 0 and a top-level `healthy` field equal to `true` in `.spire/tmp/entry-doctor/result.json` (the file is compact canonical JSON, so never match a spaced literal). If the first command instead exits 1 and its stderr names `no recovery launcher installed`, this machine has no local Direct-v4 install of this root — the install is machine-local and nothing here is broken. Say so in one line, and continue the boot without running the doctor. Any other outcome — including any other exit 1, or exit 2 without `E_STALE_V3_SYNTAX` — stops the entry.
Then read the validated native conductor at `.codex/ORCHESTRATOR.md` and follow its boot sequence.
The conductor mediates tech's default **web-app ascent** (discovery → council → plan → build → QA → ship). Prefer this entry for cold start; the conductor is not a second product surface.
This selection does not mean any role or gate executed.
