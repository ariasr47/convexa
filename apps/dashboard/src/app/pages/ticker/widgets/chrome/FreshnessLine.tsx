/**
 * FreshnessLine — muted structure-age caption on the Ticker deck (product spine #4).
 * Reflects the **REST bundle's** age (the static path), NOT the live/SSE stream
 * (`[live-vs-static-isolation]`) — never wired to `live`/`streamOffline`. Copy names the
 * **basis** ("Structure as-of …") so it cannot be read as a live tick age.
 *
 * The age live-counts: a 1s tick re-derives the age from `snapshotIso` so it climbs between polls, then
 * snaps back when a fresh bundle arrives (new `snapshotIso`). If `snapshotIso` is absent it falls back
 * to the static `dataAgeSeconds` from the bundle. The interval is self-contained and cleared on unmount.
 *
 * It does NOT own the stale / poll-error messaging — the existing `fresh.stale` treatment and the
 * "Couldn't refresh …" warning keep that. When a background poll is in flight it appends a quiet
 * "· refreshing…" that clears on resolve.
 */
import { demoNowMs } from '@convexa/api';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { structureAsOfPhrase } from '../_kit/copy';

interface Props {
  /** ISO timestamp of the loaded snapshot — the live-count anchor (preferred). */
  snapshotIso: string | null;
  /** Static fallback age (seconds) from the bundle when `snapshotIso` is missing. */
  dataAgeSeconds: number | null;
  /** A background poll is in flight (REST refresh) — shows the quiet "· refreshing…" affordance. */
  refreshing: boolean;
  /** Inline variant (folded into the deck meta line): render as an inline span, no own block/margin. */
  inline?: boolean;
}

/** Live-count seconds since `snapshotIso`; null when no anchor is available. */
function useAgeSeconds(snapshotIso: string | null): number | null {
  const compute = () => {
    if (!snapshotIso) return null;
    const t = Date.parse(snapshotIso);
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.round((demoNowMs() - t) / 1000));
  };
  const [age, setAge] = useState<number | null>(compute);
  useEffect(() => {
    setAge(compute());
    if (!snapshotIso) return;
    const id = setInterval(() => setAge(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotIso]);
  return age;
}

export function FreshnessLine({ snapshotIso, dataAgeSeconds, refreshing, inline }: Props) {
  const liveAge = useAgeSeconds(snapshotIso);
  const ageSeconds = liveAge ?? dataAgeSeconds;
  return (
    <Typography
      variant="caption"
      component={inline ? 'span' : 'p'}
      data-testid="freshness-line"
      // PR #46 CI repair, §A — `text.disabled` measured 2.5–2.54:1 (dark), under WCAG AA 4.5:1:
      // `text.disabled` means a disabled CONTROL, and this is a standing informational caption (the
      // REST bundle's age), never a disabled affordance. Bound to `text.secondary` instead (steel
      // ≈5.7–6.8:1 on every real dark surface it sits on).
      sx={{ color: 'text.secondary', display: inline ? 'inline' : 'block', mb: inline ? 0 : 1 }}
    >
      {structureAsOfPhrase(ageSeconds)}
      {refreshing && (
        <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
          {' · refreshing…'}
        </Typography>
      )}
    </Typography>
  );
}

export default FreshnessLine;
