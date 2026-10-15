/**
 * Canon P-10: a chart's title states its finding only when it has data. Loading, empty, failed and
 * not-live frames name the metric instead, so a finding is never claimed over data that isn't there.
 */
export type ChartStatus =
  | { kind: 'ready' }
  | { kind: 'loading' }
  /** No data to draw: a source down, not set up, off, not live, empty, or our request failed. */
  | { kind: 'message'; tone: 'warn' | 'quiet'; text: string; cause?: string };

export function frameTitle(status: ChartStatus, finding: string, metric: string): string {
  return status.kind === 'ready' ? finding : metric;
}
