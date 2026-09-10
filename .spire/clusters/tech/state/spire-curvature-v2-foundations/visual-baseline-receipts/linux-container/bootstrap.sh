#!/usr/bin/env bash
# Bootstrap the LINUX visual-baseline receipt flow inside the CI-parity Playwright image
# (mcr.microsoft.com/playwright:v1.62.1-noble — Ubuntu 24.04, Chromium 1234, the runner's browser).
# Used 2026-09-08 from the Windows box (no Ubuntu WSL distro there; Docker Desktop's WSL2 backend).
#
#   docker run -d --name convexa-linux --ipc=host \
#     -v C:/Dev/convexa:/src:ro -v convexa-linux-work:/work \
#     mcr.microsoft.com/playwright:v1.62.1-noble sleep infinity
#   docker exec convexa-linux bash /src/.spire/clusters/tech/state/spire-curvature-v2-foundations/visual-baseline-receipts/linux-container/bootstrap.sh <revision>
#
#   /src   the Windows working tree, mounted READ-ONLY — only the clone source (no credentials needed).
#   /work  writable volume; the SEPARATE clone the flow runs in. The Windows tree is never touched.
# The human steps (look at the images, `authorize`, `accept`, `stability`) run afterwards with
# `docker exec` + `docker cp`, one decision at a time — this script stops after step 1 (compare_failed).
set -euo pipefail
REV="${1:?revision required}"
export NX_DAEMON=false BROWSER_QUALITY_PREBUILD_STATUS=pass
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/ms-playwright}"
# In this image `localhost` resolves to ::1 first for Node, so the gate's `http-server -a localhost`
# binds ::1 while its own SPA-fallback proxy (`-P http://localhost:4200?`) dials 127.0.0.1 and gets
# ECONNREFUSED: every deep route (/scanner, /ticker/SPY, …) 404s to a blank page and readiness times
# out (found 2026-09-08). GitHub's ubuntu-24.04 runner lists 127.0.0.1 first in /etc/hosts, so this
# ordering is what CI already gets; it is set for the WHOLE flow (every gate run) — not just here.
export NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first"
unset CI

echo "== toolchain"; node -v; npm -v; uname -m; . /etc/os-release; echo "$PRETTY_NAME"

echo "== clone (separate working tree, detached at the revision)"
if [ ! -d /work/convexa/.git ]; then
  git clone --quiet /src /work/convexa
fi
cd /work/convexa
git fetch --quiet /src "$REV" || true
git checkout --quiet --detach "$REV"
git status --porcelain
echo "HEAD=$(git rev-parse HEAD)"
[ "$(git rev-parse HEAD)" = "$REV" ] || { echo "HEAD does not match $REV"; exit 2; }

echo "== npm ci"
npm ci --no-audit --no-fund 2>&1 | tail -6

echo "== playwright browsers (the image ships 1.62.1 / chromium-1234; this is a no-op when it matches)"
npx playwright install chromium 2>&1 | tail -2
ls "$PLAYWRIGHT_BROWSERS_PATH" | tr '\n' ' '; echo

echo "== production build (the gate serves dist, as CI does)"
npx nx build @convexa/dashboard --configuration=production --skip-nx-cache 2>&1 | grep -E "built in|error|Error|Successfully|failed" | tail -5
test -f apps/dashboard/dist/index.html

echo "== step 1: compare-only (expect exit 1, six records, host_platform linux)"
set +e
npm run browser:visual 2>&1 | grep -E "^\[(PASS|FAIL|RUNNING|BLOCKED)\]|passed|failed" | tail -12
echo "VISUAL_EXIT=${PIPESTATUS[0]}"
set -e
node -e '
const s=require("/work/convexa/apps/dashboard-e2e/test-output/playwright/visual/summary.json");
console.log("run",s.run_id,"status",s.status,"platform",s.host_platform,"rev",s.source_revision.slice(0,10));
for(const r of s.scenarios)console.log(" ",r.scenario_id.padEnd(22),r.status,(r.actual_sha256||"").slice(0,16),r.actual_path||"");
'
rm -rf /work/out/compare-1 && mkdir -p /work/out/compare-1 && cp -r apps/dashboard-e2e/test-output/playwright/visual/. /work/out/compare-1/
echo "== bootstrap done; step-1 evidence copied to /work/out/compare-1 (docker cp it out to look)"
