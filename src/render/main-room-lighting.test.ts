import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { lightingAt, roomAmbient } from './lighting';
import { mainKeyLight, mainCastVector, mainShadowState, mainSurfaceLight, paintContactShade, paintCastShade, paintWindowBounce } from './main-room-lighting';

describe('coherent main-room light', () => {
  it('keeps the baked upper-left key through the day without moving the outdoor sun', () => {
    for (const hour of [7, 10, 12.75, 16, 18]) {
      const light = lightingAt(hour);
      expect(mainKeyLight(light.sun).lean).toBeGreaterThan(0);
      expect(mainKeyLight(light.sun).length).toBeGreaterThan(110);
    }
    expect(lightingAt(10).sun.x).toBeLessThan(lightingAt(16).sun.x);
    expect(mainKeyLight(lightingAt(21).sun).strength).toBe(0);
  });
  it('uses one direction for window beams and cast shadows at every daytime hour', () => {
    for (const hour of [7, 10, 12.75, 16, 18]) {
      const key = mainKeyLight(lightingAt(hour).sun);
      const cast = mainCastVector(mainShadowState(lightingAt(hour)).reach);
      expect(cast.x / cast.y).toBeCloseTo(key.lean / key.length, 8);
    }
  });
  it('has a bounded cache across every minute and no night cast shadow', () => {
    const states = new Set<string>();
    for (let minute = 0; minute < 1440; minute++) states.add(JSON.stringify(mainShadowState(lightingAt(minute / 60))));
    expect(states.size).toBeLessThanOrEqual(20);
    expect(mainShadowState(lightingAt(21)).strength).toBe(0);
  });
  it('lights only the window path and fades before the room edge', () => {
    const light = lightingAt(10), key = mainKeyLight(light.sun), windows = [{ x: 20, w: 40 }];
    expect(mainSurfaceLight(40, 80, light, windows)).toBeGreaterThan(.5);
    expect(mainSurfaceLight(200, 100, light, windows)).toBe(0);
    expect(mainSurfaceLight(40 + key.lean, 81 + key.length, light, windows)).toBe(0);
    expect(mainSurfaceLight(40, 80, lightingAt(21), windows)).toBe(0);
  });
  it('uses low-opacity bounce without long pane strips or hard end caps', () => {
    const calls: { alpha: number; y: number }[] = [];
    const ctx = { save() {}, restore() {}, globalAlpha: 1, fillStyle: '',
      fillRect(this: { globalAlpha: number }, _x: number, y: number) { calls.push({ alpha: this.globalAlpha, y }); },
    } as unknown as CanvasRenderingContext2D;
    paintWindowBounce(ctx, 20, 40, 80, lightingAt(10).sun);
    expect(Math.max(...calls.map(c => c.alpha))).toBeLessThan(.022);
    expect(Math.max(...calls.map(c => c.y))).toBeLessThan(170);
    expect(calls.at(-1)!.alpha).toBeLessThan(.00002);
    const source = readFileSync(new URL('./room-art.ts', import.meta.url), 'utf8');
    expect(source).toContain('paintWindowBounce(ctx, opening.x, opening.w, FLOOR_Y, light.sun)');
    expect(source).not.toContain('opacity: 0.72');
  });
  it('keeps noon neutral and night readable without changing other rooms', () => {
    expect(roomAmbient(lightingAt(12), 'main')).toBe('#ffffff');
    const night = roomAmbient(lightingAt(21), 'main');
    const rgb = [1,3,5].map(i => parseInt(night.slice(i,i+2),16));
    expect(Math.min(...rgb)).toBeGreaterThan(130);
    expect(Math.max(...rgb)-Math.min(...rgb)).toBeLessThan(45);
  });
  it('paints contact at night but never a solar projection, restoring canvas state', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), globalAlpha: 1, fillStyle: '' } as unknown as CanvasRenderingContext2D;
    paintCastShade(ctx, 20, 7, 30, 18, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    paintContactShade(ctx, 20, 7, 30, .25);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalledTimes(1); expect(ctx.restore).toHaveBeenCalledTimes(1);
    for (const args of vi.mocked(ctx.fillRect).mock.calls) for (const n of args) expect(Number.isFinite(n)).toBe(true);
  });
  it('sorts cast shadows below actors and preserves physical-pixel seated crops', () => {
    const source = readFileSync(new URL('./phaser/cafe-scene.ts', import.meta.url), 'utf8');
    expect(source).toContain('DEPTH.floor - .5');
    expect(source).toContain('DEPTH.floor - .4');
    expect(source).toContain('mainLitSprite(source, exposure)');
    expect(source).toContain('table).setCrop(crop.x, crop.y, crop.width, crop.height)');
    expect(source).toContain('p.drawCounterLight(light)');
  });
});
