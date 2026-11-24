// @vitest-environment happy-dom
// The café's front (floors-front.ts) and the decor its awning would hide.
import { describe, expect, it, vi } from 'vitest';
import { DECOR } from '../../game/decor';
import { menuItems } from '../../game/economy';
import { createInitialState } from '../../game/state';

vi.mock('phaser', () => ({ default: {} }));
const { boardPrice, boardRows } = await import('./floors-front');
const { BOARD, DOOR, FRAME, GROUND_SHIFT, SHOP_SIGN, WORLD_W } = await import('./floors-layout');
const { CEILING_LAMPS, NEON_LAMP, floorLamps } = await import('./floors-sky-light');

describe('the menu board', () => {
  it('turns its pages and shows every dish in turn', () => {
    const menu = ['a', 'b', 'c', 'd', 'e'], seen = new Set<string>();
    for (let seconds = 0; seconds < 15; seconds += 1) for (const dish of boardRows(menu, seconds)) seen.add(dish);
    expect([...seen].sort()).toEqual(menu);
    expect(boardRows(menu, 0)).toEqual(['a', 'b']);
    expect(boardRows(menu, 10)).toEqual(['e']);
    expect(boardRows([], 3)).toEqual([]);
  });

  it('writes the shop\'s rounded price', () => {
    const state = createInitialState(0);
    state.items.espresso = 30;
    const espresso = menuItems(state).find(item => item.id === 'espresso')!;
    expect(boardPrice(state, espresso)).toMatch(/^\$/);
  });

  it('stands by the right-hand door, out of the way in', () => {
    expect(BOARD.x - BOARD.w / 2 - DOOR.x).toBeGreaterThan(300);
    expect(BOARD.x + BOARD.w / 2).toBeLessThan(WORLD_W);
    expect(SHOP_SIGN.x).toBeGreaterThan(FRAME.pillar);
  });
});

describe('ground floor decor under the awning', () => {
  it('moves only real items, and their lamps with them', () => {
    for (const id of Object.keys(GROUND_SHIFT)) expect(DECOR.some(item => item.id === id), id).toBe(true);
    for (const id of ['ceiling_lights', 'ceiling_chandelier']) {
      const base = CEILING_LAMPS[id][0], has = (floor: 'ground' | 'floor-2', dy: number) => floorLamps(floor, { ceiling: id }).some(l => l.x === base.x && l.y === base.y + dy);
      expect(has('ground', GROUND_SHIFT[id]!.dy), id).toBe(true);
      expect(has('floor-2', 0), id).toBe(true);
    }
    expect(floorLamps('ground', { ceiling: 'ceiling_pendants' })).toContain(CEILING_LAMPS.ceiling_pendants[0]);
    const neon = GROUND_SHIFT.neon_heart!;
    expect(floorLamps('ground', { neon: 'neon_heart' }).at(-1)).toMatchObject({ x: NEON_LAMP.x + neon.dx, y: NEON_LAMP.y + neon.dy });
  });
});
