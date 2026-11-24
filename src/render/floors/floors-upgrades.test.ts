import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MENU, UPGRADES } from '../../game/data';
import { installedEquipment, type Equipment } from '../../game/kitchen';
import { createInitialState } from '../../game/state';

vi.mock('phaser', () => ({ default: {} }));
const { MACHINE_LEVELS, TABLE_BOX, kitchenPieces, machineTier } = await import('./floors-upgrades');

const BUILD = 'assets/generated/floor-sample-v1/build/upgrades/';
const manifest = JSON.parse(readFileSync(`${BUILD}pieces.json`, 'utf8')) as { kitchen: [number, number]; clear: number[]; pieces: Record<string, { w: number; h: number; at: [number, number] }> };
/** Pieces of equipment the kitchen draws when they are installed. */
const DRAWN = ['convection', 'proofer', 'pastryFridge', 'sheeter', 'standMixer', 'kettle', 'fryer', 'mixer'] as const satisfies readonly Equipment[];

describe('the espresso machine', () => {
  it('changes its look at levels 5, 10 and 15, all of them within reach', () => {
    expect([0, 4, 5, 9, 10, 14, 15, 20].map(machineTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(MACHINE_LEVELS.at(-1)!).toBeLessThanOrEqual(UPGRADES.find(u => u.id === 'machine')!.max);
  });

  it('has a picture for every look, standing where the old one is taken out', () => {
    const [x0, , x1, y1] = manifest.clear;
    for (const tier of [1, 2, 3]) {
      const piece = manifest.pieces[`machine-${tier}`];
      expect(piece, `machine-${tier}`).toBeDefined();
      expect(piece.at[0]).toBeGreaterThanOrEqual(x0);
      expect(piece.at[0] + piece.w).toBeLessThanOrEqual(x1);
      // Its feet are hidden behind the cake display.
      expect(piece.at[1] + piece.h).toBeGreaterThanOrEqual(y1);
    }
  });
});

describe('the basement kitchen', () => {
  it('is put together from pieces that exist, whatever is installed and however far it is expanded', () => {
    expect(existsSync(`${BUILD}basement-bare.webp`) && existsSync(`${BUILD}pieces.webp`)).toBe(true);
    const [width, height] = manifest.kitchen;
    for (let mask = 0; mask < 1 << DRAWN.length; mask++) {
      const installed = new Set<string>(DRAWN.filter((_, i) => mask & (1 << i)));
      for (const expanded of [0, 1, 2]) {
        const pieces = kitchenPieces(installed, expanded);
        expect(new Set(pieces).size).toBe(pieces.length);
        for (const name of pieces) {
          const piece = manifest.pieces[name];
          expect(piece, name).toBeDefined();
          expect(piece.at[0] >= 0 && piece.at[1] >= 0 && piece.at[0] + piece.w <= width && piece.at[1] + piece.h <= height, name).toBe(true);
        }
        for (const id of DRAWN) expect(pieces.includes(id), id).toBe(installed.has(id));
        // Each thing gives way to what takes its place.
        expect(pieces.includes('bowl')).toBe(!installed.has('sheeter'));
        expect(pieces.includes('jars')).toBe(!installed.has('standMixer'));
        expect(pieces.includes('pot')).toBe(!installed.has('mixer'));
        expect(pieces.includes('basket')).toBe(!installed.has('kettle') && !installed.has('fryer'));
        expect(pieces.includes('peels')).toBe(!installed.has('convection') && !installed.has('sheeter'));
      }
    }
  });

  it('opens its right half with each expansion', () => {
    const none = new Set<string>();
    expect([0, 1, 2].map(n => kitchenPieces(none, n).filter(p => p.startsWith('stage-')))).toEqual([['stage-1'], ['stage-2'], []]);
    // The last expansion is the last there is.
    expect(UPGRADES.find(u => u.id === 'cook')!.max).toBe(2);
  });

  it('shows equipment as the dishes that need it are unlocked', () => {
    const state = createInitialState(0);
    state.kitchen = true;
    expect(kitchenPieces(installedEquipment(state), 0)).toContain('basket');
    for (const item of MENU) state.items[item.id] = 1;
    const all = kitchenPieces(installedEquipment(state), 2);
    for (const id of DRAWN) expect(all, id).toContain(id);
  });

  it('takes the table out of its own picture', () => {
    const [width, height] = manifest.kitchen;
    expect(TABLE_BOX.x + TABLE_BOX.w).toBeLessThan(width);
    expect(TABLE_BOX.y + TABLE_BOX.h).toBeLessThan(height);
  });
});
