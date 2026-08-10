/**
 * Pure helpers for structure history display — session path deltas and sparkline points.
 * Neutral only: never green/red on score or flip-dist rates.
 */
import type { StructureSample } from '@org/api';

export interface SessionPathSummary {
  n: number;
  firstAsOf: number;
  lastAsOf: number;
  scoreDelta: number | null;
  flipDistDelta: number | null;
  flipDelta: number | null;
}

/** First→last path over samples with finite values. Empty / single point → nulls. */
export function summarizePath(samples: readonly StructureSample[]): SessionPathSummary | null {
  if (samples.length === 0) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const scoreDelta =
    first.score != null &&
    last.score != null &&
    Number.isFinite(first.score) &&
    Number.isFinite(last.score)
      ? last.score - first.score
      : null;
  const flipDistDelta =
    first.dist_to_flip_pct != null &&
    last.dist_to_flip_pct != null &&
    Number.isFinite(first.dist_to_flip_pct) &&
    Number.isFinite(last.dist_to_flip_pct)
      ? last.dist_to_flip_pct - first.dist_to_flip_pct
      : null;
  const flipDelta =
    first.flip != null &&
    last.flip != null &&
    Number.isFinite(first.flip) &&
    Number.isFinite(last.flip)
      ? last.flip - first.flip
      : null;
  return {
    n: samples.length,
    firstAsOf: first.as_of,
    lastAsOf: last.as_of,
    scoreDelta: scoreDelta === 0 ? null : scoreDelta,
    flipDistDelta: flipDistDelta === 0 ? null : flipDistDelta,
    flipDelta: flipDelta === 0 ? null : flipDelta,
  };
}

/** Compact neutral path label: ↑2 · ↓1.5 — same glyphs as scanner poll deltas. */
export function fmtPathDelta(n: number, digits = 0): string {
  const abs = Math.abs(n);
  const body = digits > 0 ? abs.toFixed(digits) : String(Math.round(abs));
  if (n > 0) return `↑${body}`;
  if (n < 0) return `↓${body}`;
  return '';
}

/** Build SVG polyline points for a numeric series (nulls skip). Need ≥2 finite points. */
export function sparkPoints(
  samples: readonly StructureSample[],
  pick: (s: StructureSample) => number | null | undefined,
  width: number,
  height: number,
  pad = 2,
): string | null {
  const vals: { i: number; v: number }[] = [];
  samples.forEach((s, i) => {
    const v = pick(s);
    if (v != null && Number.isFinite(v)) vals.push({ i, v });
  });
  if (vals.length < 2) return null;
  const min = Math.min(...vals.map((x) => x.v));
  const max = Math.max(...vals.map((x) => x.v));
  const span = max - min || 1;
  const n = samples.length;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return vals
    .map(({ i, v }) => {
      const x = pad + (i / Math.max(n - 1, 1)) * innerW;
      const y = pad + (1 - (v - min) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
