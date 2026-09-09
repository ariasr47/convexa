#!/usr/bin/env bash
# Steps 4 + 5 of the linux flow, inside the container, AFTER the human has confirmed the candidate
# hashes equal the inspected compare actuals (authorize-and-update.sh prints that table). Shows the
# patch stat, drafts the acceptance with the repository helper, runs the two compare-only stability
# gates, copies their summaries into the evidence folder, and validates stability_clean.
#   docker exec convexa-linux bash /src/.spire/.../linux-container/accept-and-stabilize.sh <candidate_set_id> <authorization_id>
# Afterwards `docker cp` the six PNGs, the evidence folder, the authorization, the candidate set, the
# patch and the acceptance into the Windows tree, re-run `check`/`stability` there, commit once, push.
set -euo pipefail
CS="${1:?candidate set id required}"
ID="${2:?authorization id required}"
export NX_DAEMON=false BROWSER_QUALITY_PREBUILD_STATUS=pass
export NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first"
unset CI
cd /work/convexa
HELPER=.spire/clusters/tech/state/spire-curvature-v2-foundations/visual-baseline-receipts/visual_receipts.mjs
EV="apps/dashboard-e2e/visual-review/evidence/$ID"

echo "== patch stat (the reviewer signs this diff)"
git diff --stat -- apps/dashboard-e2e/src/quality/snapshots/linux/chromium/ | tail -7

echo "== accept ($CS)"
node "$HELPER" accept --candidate-set "apps/dashboard-e2e/visual-review/candidate-sets/$CS.json" --actor workspace-code-reviewer | head -2

for i in 1 2; do
  echo "== stability run $i"
  set +e
  npm run browser:visual 2>&1 | grep -E "^\[(PASS|FAIL)\]" | head -3
  echo "STAB${i}_EXIT=${PIPESTATUS[0]}"
  set -e
  cp apps/dashboard-e2e/test-output/playwright/visual/summary.json "$EV/stability-$i.json"
  node -e 'const s=require(process.argv[1]);console.log("  run",s.run_id,s.status,s.source_revision.slice(0,10),s.host_platform,"flaky="+s.flaky)' "$PWD/$EV/stability-$i.json"
done

echo "== stability"
node "$HELPER" stability --acceptance "apps/dashboard-e2e/visual-review/acceptances/$CS.json" --summary "$EV/stability-1.json" --summary "$EV/stability-2.json"
node -e 'const a=require(process.argv[1]);console.log(a.acceptance_id,a.state,a.platform,a.source_revision.slice(0,10))' "$PWD/apps/dashboard-e2e/visual-review/acceptances/$CS.json"
echo "== files to copy out"
git status --porcelain
ls "$EV"
