#!/usr/bin/env bash
# Step 2 + 3 of the linux flow, inside the container, AFTER the human has looked at every actual and
# diff of /work/out/compare-1 (docker cp them out first). Drafts the authorization with the repository
# helper, then runs the authorized candidate update, then prints the candidate hashes against the
# compare run's actuals (they must match: a candidate that differs from the compare actual is a
# non-deterministic render, not a baseline).
#   docker exec convexa-linux bash /src/.spire/.../linux-container/authorize-and-update.sh <authorization_id>
set -euo pipefail
ID="${1:?authorization id required, e.g. linux-curvature-v2-<rev7>-<yyyymmdd>}"
export NX_DAEMON=false BROWSER_QUALITY_PREBUILD_STATUS=pass
export NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first"
unset CI
cd /work/convexa
HELPER=.spire/clusters/tech/state/spire-curvature-v2-foundations/visual-baseline-receipts/visual_receipts.mjs

echo "== authorize ($ID) from /work/out/compare-1/summary.json"
node "$HELPER" authorize --summary /work/out/compare-1/summary.json --id "$ID" --actor workspace-owner --role owner
echo "== tracked changes since HEAD (must be empty):"; git diff --name-only

echo "== candidate update"
set +e
npm run browser:visual:update -- --authorization "apps/dashboard-e2e/visual-review/authorizations/$ID.json" 2>&1 | grep -E "candidate-written|\[PASS\]|\[FAIL\]|Error|error" | head -6
echo "UPDATE_EXIT=${PIPESTATUS[0]}"
set -e

CS=$(ls -t apps/dashboard-e2e/visual-review/candidate-sets/*.json | head -1)
echo "== candidate set: $CS"
node -e '
const fs=require("fs"),crypto=require("crypto");
const cs=require(process.argv[1]); const cmp=require("/work/out/compare-1/summary.json");
console.log(cs.candidate_set_id, cs.authorization_id, cs.source_revision.slice(0,10), cs.platform);
for (const c of cs.candidates) {
  const disk=crypto.createHash("sha256").update(fs.readFileSync(c.path)).digest("hex");
  const rec=cmp.scenarios.find(r=>r.scenario_id===c.scenario_id);
  const vs=rec.actual_sha256===null ? "(compare passed: unchanged)" : (rec.actual_sha256===c.sha256 ? "= compare actual" : "DIFFERENT from compare actual");
  console.log(" ", c.scenario_id.padEnd(22), c.sha256, disk===c.sha256 ? "disk ok" : "DISK MISMATCH", vs);
}' "$PWD/$CS"
git status --porcelain
