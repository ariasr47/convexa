import type { StructureFieldModel } from './types';

/** Stable offscreen-buffer identity: live tape values belong to the dynamic clock. */
export function structureBufferKey(m: StructureFieldModel): string {
  return `${m.symbol}|${m.spot}|${m.putWall}|${m.callWall}|${m.gammaFlip}|${m.samples.length}|${m.samples[0]?.strike}|${m.samples[m.samples.length - 1]?.strike}|${m.samples[0]?.netGex}|${m.samples[Math.floor(m.samples.length / 2)]?.netGex}`;
}
