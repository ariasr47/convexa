# Existing hosted backend: anonymous interface check

At `2026-10-08T01:34:56Z` (October 7 locally), the repository conformance runner queried the existing Railway API using the two anonymous GETs in this feature's interface contract. Native exit code **0**; **2 endpoints passed, 0 failed**:

| Request | Observed status | Required shape checks |
| --- | --- | --- |
| `GET /api/auth/session` | 200 | 4 |
| `GET /api/scan` | 200 | 8 |

Machine receipt: `backend-anonymous-baseline.json`. No credentials or signup were supplied. This was a read-only observation; no server, deployment or data configuration was changed.

This proves these two hosted API shapes were reachable at the recorded instant. It does not prove a paid feed is active, that scanner rows are populated, that quantitative calculations ran, or that the new static demo has been deployed. Array-member checks can be vacuous when an array is empty. The runner's `mode: live` means it checked an actual HTTP response rather than a saved sample; it is not a claim about `MARKET_DATA_MODE` or market-data provenance. The exact deployed backend revision was not independently identified in this check.
