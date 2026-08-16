import { describe, expect, it } from 'vitest';
import { layoutMarkerLabels, layoutTapeLabel } from './markerLayout';
import { structureBufferKey } from './structureBufferKey';

describe('layoutMarkerLabels', () => {
  const measure = (text: string) => text.length * 7;

  it.each([320, 600, 1152])(
    'keeps clustered put/call/flip/spot boxes in bounds and clear of fixed captions at %spx',
    (width) => {
      const bounds = { left: 40, right: width - 12, top: 22, bottom: 298 };
      const captions = [
        { x: bounds.left, y: bounds.top, width: 76, height: 16 },
        { x: bounds.left, y: bounds.bottom - 20, width: 76, height: 20 },
      ];
      const boxes = layoutMarkerLabels({
        bounds,
        measure,
        laneHeight: 16,
        laneGap: 2,
        reserved: captions,
        markers: [
          { id: 'put', x: bounds.left + 4, label: 'put $450', preferredLane: 0 },
          { id: 'flip', x: (bounds.left + bounds.right) / 2, label: 'flip', preferredLane: 1 },
          { id: 'spot', x: (bounds.left + bounds.right) / 2 + 2, label: 'spot $450.0', preferredLane: 2 },
          { id: 'call', x: bounds.right - 4, label: 'call $451', preferredLane: 0 },
        ],
      });
      expect(boxes).toHaveLength(4);
      const intersects = (a: typeof boxes[number], b: (typeof captions)[number]) =>
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(bounds.left);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.right);
        expect(box.y).toBeGreaterThanOrEqual(bounds.top);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.bottom);
        for (const caption of captions) expect(intersects(box, caption)).toBe(false);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) expect(intersects(boxes[i], boxes[j])).toBe(false);
      }
    },
  );

  it('assigns distinct lanes for clustered markers without intersections', () => {
    const boxes = layoutMarkerLabels({
      bounds: { left: 40, right: 360, top: 20, bottom: 100 },
      laneHeight: 18,
      laneGap: 2,
      measure,
      markers: [
        { id: 'put', x: 180, label: 'put $450' },
        { id: 'call', x: 182, label: 'call $451' },
        { id: 'flip', x: 184, label: 'flip' },
        { id: 'spot', x: 186, label: 'spot $450.0' },
      ],
    });
    expect(boxes).toHaveLength(4);
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].x).toBeGreaterThanOrEqual(40);
      expect(boxes[i].x + boxes[i].width).toBeLessThanOrEqual(360);
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const intersects = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(intersects).toBe(false);
      }
    }
  });

  it('clamps three-, four-, and five-digit labels at both boundaries', () => {
    const boxes = layoutMarkerLabels({
      bounds: { left: 40, right: 200, top: 20, bottom: 160 },
      laneHeight: 18,
      laneGap: 2,
      measure,
      markers: [
        { id: 'left', x: 40, label: 'put $10000' },
        { id: 'right', x: 200, label: 'call $450' },
      ],
    });
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(40);
      expect(box.x + box.width).toBeLessThanOrEqual(200);
    }
  });

  it.each([
    ['left edge', 40],
    ['right edge', 200],
  ])('places live/mid text measured and in-bounds at the %s without static markers/captions, with an anchor treatment', (_name, anchorX) => {
    const staticBoxes = layoutMarkerLabels({
      bounds: { left: 40, right: 200, top: 20, bottom: 160 },
      measure,
      markers: [
        { id: 'put', x: 42, label: 'put $450' },
        { id: 'call', x: 198, label: 'call $451' },
        { id: 'flip', x: 120, label: 'flip', preferredLane: 1 },
        { id: 'spot', x: 120, label: 'spot $450.0', preferredLane: 2 },
      ],
      laneHeight: 16,
      laneGap: 2,
      reserved: [{ x: 40, y: 132, width: 76, height: 16 }],
    });
    const caption = { x: 40, y: 132, width: 76, height: 16 };
    const box = layoutTapeLabel({
      anchorX,
      label: 'live $450.00',
      bounds: { left: 40, right: 200, top: 20, bottom: 160 },
      measure,
      reserved: [...staticBoxes, caption],
    });
    expect(box.x).toBeGreaterThanOrEqual(40);
    expect(box.x + box.width).toBeLessThanOrEqual(200);
    expect(box.y + box.height).toBeLessThanOrEqual(160);
    expect(box.y < 132 || box.y >= 148).toBe(true);
    expect(box.anchorX).toBe(anchorX);
    expect(box.edgeTreatment).toMatch(/^(none|left|right)$/);
    for (const reserved of [...staticBoxes, caption]) {
      const intersects = box.x < reserved.x + reserved.width && box.x + box.width > reserved.x && box.y < reserved.y + reserved.height && box.y + box.height > reserved.y;
      expect(intersects).toBe(false);
    }
  });

  it('keeps live tape changes outside the static structure key', () => {
    const base = {
      symbol: 'SPY', samples: [{ strike: 450, netGex: 1 }, { strike: 451, netGex: -1 }],
      spot: 450, putWall: 445, callWall: 455, gammaFlip: 449, asOfSec: 1, liveMid: 450, live: true, source: 'live' as const,
    };
    const changed = { ...base, liveMid: 451.25, live: false };
    expect(structureBufferKey(base)).toBe(structureBufferKey(changed));
    expect(structureBufferKey({ ...base, gammaFlip: 448 })).not.toBe(structureBufferKey(base));
  });
});
