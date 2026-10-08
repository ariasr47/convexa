# RESUME — branch `spire/v4-install-2026-09-22`

**Resume status:** CONSUMED (as of 2026-09-23)
**Written:** 2026-09-22 on the Windows box (`C:/Dev/convexa`), right after the Spire v4.2.0 install.
**Branch:** `spire/v4-install-2026-09-22`, cut from `origin/main` `f8c9077a`. Local only, **not pushed**.

## What happened

Spire in this checkout went from v3.19.3 to **v4.2.0**: the Direct-v4 kernel, receipt schema 3,
generation `gen-344efe06b2d76427`, providers claude, codex and grok, ascent `web-app` (the renamed
`delivery`). Installed doctor passes 7/7. The installed Codex entry was run exactly as written, in
PowerShell: exit 2 `E_STALE_V3_SYNTAX`, then the doctor fallback, exit 0, healthy true. The whole
sequence was rehearsed first on a copy of this repository, including a rollback and a re-upgrade.

| commit | step |
|---|---|
| `c6b61340` | v3 framework refresh from spire-os `f3d6be2b` (entries with the v4 fallback; `delivery` → `web-app`) |
| `10e9edd1` | first cutover to 4.0.0 with the kernel from spire-os `abfa4ad7` |
| `9512321f` | `.gitattributes`: `.spire/bin/spire.cmd` is now `-text` (the v4 shim is LF; `eol=crlf` would rewrite it on checkout and fail the doctor) |
| `bb1a6dbc` | native upgrade to 4.2.0 from the released `v4.2.0` tag |

No application file changed. 14,335 files outside the install were fingerprinted before and after;
the only differences are `.gitattributes` (above) and `.spire/clusters/tech/receipts/selection.json`,
which the post-refresh entry check restamps. `.claude/launch.json`, `.claude/settings.local.json` and
`.codex/config.toml` are byte-identical.

## Hazards — read before any git operation in this checkout

- **Keep `C:/Dev/convexa` on this branch, or a local branch that contains it.** Checking out `main`
  or any branch without these commits rewrites the tracked v4 files with v3 bytes, and the doctor
  stays red until you come back. The same goes for `git reset` or `git checkout` to any commit
  before `bb1a6dbc`.
- **Never `git clean` here.** `.spire/generations/`, `.spire/upgrade-effects/` and `.spire/tmp/` are
  untracked on purpose; the kernel runs from the generation, and rollback needs the upgrade effects.
- **The install is machine-local.** The receipt, the `AGENTS.md` bridge and the `*/spire/*.md`
  adapters name this root (`C:/Dev/convexa`, digest `082ab697…`). A clone that receives these
  commits without its own install (the Mac) gets `no recovery launcher installed` from the entry.
  The entry treats that as "not installed on this machine" and continues, so nothing breaks, but
  that clone is not on v4 until it runs its own install.

## Recovery (retained until 2026-10-22T23:12:15Z; no cleanup authorized)

- **Back to 4.0.0:** write `{"root":"C:/Dev/convexa","transaction_id":"tx-convexa-upgrade-4.2.0-1790118735602"}`
  to a file, run `node .spire/bin/spire.mjs rollback-v4 --input <file> --out <dir>; exit $LASTEXITCODE`,
  then run the doctor.
- **Back to v3.19.3:** the rollback above, then `restore-v3` of `tx-convexa-cutover-20260922-230607`
  (capsule kept until 2026-10-22T23:06:08Z; it needs an owner RESTORE_V3 authorization record, see
  spire-os `docs/PLATFORM_OS.md`). `restore-v3` refuses an upgrade capsule.
- **Byte backup** of `.claude`, `.codex`, `.grok`, `.spire`, `.agents`, `AGENTS.md`, `.gitattributes`,
  `.git/info/exclude` and the fleet registry: `C:/Dev/convexa-provider-roots-backup-20260922`.

## Upgrade to 4.8.0 (2026-10-07)

Native upgrade 4.2.0 → **4.8.0** with `platform/lifecycle/upgrade.mjs` from a clean detached worktree
`C:/Dev/spire-os-v4.8.0` at tag `v4.8.0` (`1852420b`), on Node 26.7.0. Fault matrix
`tests/platform/os/migration/upgrade_v4.test.mjs` 10/10. Plan: 394 files, 97 changed, 0 removals;
providers claude, codex, grok; ascent web-app. Transaction `tx-convexa-upgrade-4.8.0-1791418985778`,
generation `gen-e04559a83188e6e6`. Installed doctor exit 0, healthy, 7/7; self-check `PUBLISHED_V4`.

- **Node 26 is required.** The runtime closure records `node_major: 26`; under Node 24 the doctor
  exits 1 with `E_RUNTIME_CLOSURE ... drift from a fresh regeneration`. Nothing is broken on disk —
  run `nvm use 26.7.0` (the repo's `.nvmrc`).
- **Back to 4.2.0:** write `{"root":"C:/Dev/convexa","transaction_id":"tx-convexa-upgrade-4.8.0-1791418985778"}`
  to a file, run `node .spire/bin/spire.mjs rollback-v4 --input <file> --out <dir>; exit $LASTEXITCODE`
  on Node 26, then the doctor. Capsule retained until 2026-11-07T00:23:05Z.

## Owner ruling — keep it local (2026-09-22)

The owner chose option A: the install stays on this machine. Until the owner decides otherwise,
this branch is not pushed and not opened as a PR. Working rules that follow:

- **Picking up `main`:** `git fetch origin`, then `git merge origin/main` into this branch, then run
  the doctor. If a merge ever touches `.claude/`, `.codex/`, `.grok/`, `.spire/bin/`,
  `.spire/installation.json`, `.spire/version` or `AGENTS.md`, keep this branch's side. A conflict
  in `IN_FLIGHT.md` keeps both sides' rows.
- **Feature work that will become a PR:** cut its branch from `origin/main` in a worktree under
  `.worktrees/`, never from this branch. A branch cut from here carries the install commits.
- **Guard:** `.git/hooks/pre-push` (local, untracked, shared by every worktree) refuses any push
  whose commits include `c6b61340`. `git push --no-verify` bypasses it deliberately; deleting the
  file removes it.

KC-MIG-3 was ruled survived on 2026-09-22 (spire-os `docs/research/2026-09-22-convexa-v4-install/DECISIONS.md`,
D-2), so other projects may be cut over. Nothing else is owed from this rollout.
Evidence: spire-os `docs/research/2026-09-22-convexa-v4-install/REPORT.md`; raw logs under
`C:/Dev/convexa-v4-rollout-20260922/live/run`.
