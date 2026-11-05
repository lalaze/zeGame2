import { franchiseEarnings } from '../game/chain';
import { orderReady } from '../game/orders';
import type { GameState } from '../game/state';
import { generatedMainRaster, paintGeneratedMain, type GeneratedMainId } from './generated-main-art';

type Ctx = CanvasRenderingContext2D;

/**
 * Generated props for the idle layer (assets/generated/cozy-idle-v1): building work in
 * a room being renovated, the till jar and a catering order waiting at the counter.
 * Each stands on `foot`, centred on `cx`, fitted inside `maxW` × `maxH` world pixels at
 * its own aspect. Returns false while the bitmap isn't loaded, so callers can fall back.
 */
export function paintIdleProp(ctx: Ctx, id: GeneratedMainId, cx: number, foot: number, maxW: number, maxH: number): boolean {
  const raster = generatedMainRaster(id);
  if (!raster) return false;
  const scale = Math.min(maxW / raster.contentWidth, maxH / raster.contentHeight);
  const w = raster.contentWidth * scale, h = raster.contentHeight * scale;
  const snap = (v: number) => Math.round(v * 2) / 2;
  return paintGeneratedMain(ctx, id, snap(cx - w / 2), snap(foot - h), w, h);
}

/** Tools left in a room that is being built: they stand where its tables will go. */
export function paintConstruction(ctx: Ctx, floorY: (y: number) => number, height: number): void {
  paintIdleProp(ctx, 'build-sawhorse', 66, floorY(112), 34, 27);
  paintIdleProp(ctx, 'build-ladder', 252, floorY(114), 46, 31);
  // The sign stands by the doorway runner, facing whoever comes to look.
  paintIdleProp(ctx, 'build-sign', 126, Math.min(height - 12, floorY(178)), 15, 16);
}

export type JarLevel = 0 | 1 | 2;

/**
 * How full the jar on the counter looks. With franchises it shows their side of the
 * till (brimming once it's full and waiting to be collected); otherwise it fills with
 * the day's tips as guests are served, as the old painted jar did.
 */
export function tillJarLevel(state: GameState, now: number): JarLevel {
  if (state.chain.franchises.length) {
    const { fill } = franchiseEarnings(state, now);
    return fill >= 1 ? 2 : fill >= 1 / 3 ? 1 : 0;
  }
  const served = state.today.served;
  return served >= 45 ? 2 : served >= 15 ? 1 : 0;
}

export const tillJarId = (level: JarLevel): GeneratedMainId => (['till-jar-0', 'till-jar-1', 'till-jar-2'] as const)[level];

/** A finished catering order waits at the end of the counter until it's collected. */
export const orderWaiting = (state: GameState, now: number) => orderReady(state, now);
