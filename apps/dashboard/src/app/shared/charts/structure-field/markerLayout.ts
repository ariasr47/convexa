export interface MarkerLayoutInput {
  id: string;
  x: number;
  label: string;
  preferredLane?: number;
  color?: string;
}

export interface MarkerLayoutBox extends MarkerLayoutInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TapeLabelLayout extends MarkerLayoutBox {
  /** The marker line x-coordinate the label belongs to. */
  anchorX: number;
  /** Explicit treatment when clamping moves text away from its marker line. */
  edgeTreatment: 'none' | 'left' | 'right';
}

export interface MarkerLayoutOptions {
  bounds: { left: number; right: number; top: number; bottom: number };
  markers: readonly MarkerLayoutInput[];
  measure: (label: string) => number;
  laneHeight?: number;
  laneGap?: number;
  paddingX?: number;
  reserved?: readonly Pick<MarkerLayoutBox, 'x' | 'y' | 'width' | 'height'>[];
}

function overlaps(a: MarkerLayoutBox, b: Pick<MarkerLayoutBox, 'x' | 'y' | 'width' | 'height'>) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Deterministic collision placement for canvas marker labels. */
export function layoutMarkerLabels({
  bounds,
  markers,
  measure,
  laneHeight = 18,
  laneGap = 2,
  paddingX = 8,
  reserved = [],
}: MarkerLayoutOptions): MarkerLayoutBox[] {
  const laneStep = laneHeight + laneGap;
  const sorted = [...markers].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const placed: MarkerLayoutBox[] = [];
  const maxWidth = Math.max(0, bounds.right - bounds.left);

  for (const marker of sorted) {
    const width = Math.min(maxWidth, Math.max(0, measure(marker.label) + paddingX * 2));
    const x = Math.min(Math.max(marker.x + 6, bounds.left), bounds.right - width);
    const preferred = Math.max(0, marker.preferredLane ?? 0);
    let lane = preferred;
    let box: MarkerLayoutBox = { ...marker, x, y: bounds.top, width, height: laneHeight };
    let attempts = 0;
    while (attempts < 256) {
      const y = bounds.top + lane * laneStep;
      box = { ...marker, x, y, width, height: laneHeight };
      const blocked = y + laneHeight > bounds.bottom || placed.some((p) => overlaps(box, p)) || reserved.some((r) => overlaps(box, r));
      if (!blocked) break;
      lane += 1;
      attempts += 1;
    }
    if (attempts >= 256) {
      // A pathological model must never hang the paint loop. Keep the box inside
      // the viewport as the least-surprising degraded placement.
      box = { ...marker, x, y: Math.max(bounds.top, bounds.bottom - laneHeight), width, height: laneHeight };
    }
    placed.push(box);
  }
  return placed;
}

/** Place a live/mid tape label through the same measured collision solver as structure markers. */
export function layoutTapeLabel({
  anchorX,
  label,
  bounds,
  measure,
  reserved = [],
}: {
  anchorX: number;
  label: string;
  bounds: MarkerLayoutOptions['bounds'];
  measure: (label: string) => number;
  reserved?: MarkerLayoutOptions['reserved'];
}): TapeLabelLayout {
  const marker = layoutMarkerLabels({
    bounds,
    markers: [{ id: 'live', x: anchorX, label, preferredLane: 0 }],
    measure,
    laneHeight: 16,
    laneGap: 2,
    reserved,
  })[0];
  const idealX = anchorX + 6;
  const edgeTreatment = marker.x > idealX ? 'left' : marker.x + marker.width < idealX ? 'right' : 'none';
  return { ...marker, anchorX, edgeTreatment };
}
