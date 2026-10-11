import { describe, expect, it, vi } from 'vitest';
import { createInitialState, type GameState } from '../game/state';
import { RoomPainter } from './room-art';

vi.mock('./sprites', () => ({
  OUTLINE: '#2e1c16',
  pixelSprite: () => ({ width: 18, height: 28 }),
  itemIcon: (id: string) => ({ width: 12, height: 12, itemId: id }),
}));

function pastryCount(phase: GameState['phase'], planned: number, remaining: number): number {
  const state = createInitialState(0);
  state.phase = phase;
  state.kitchen = true;
  state.items.roll = 1;
  state.onMenu = ['roll'];
  state.bakePlan.roll = planned;
  state.shelf.roll = remaining;
  const drawImage = vi.fn();
  const ctx = { fillStyle: '', globalAlpha: 1, fillRect() {}, save() {}, restore() {}, drawImage } as unknown as CanvasRenderingContext2D;
  new RoomPainter(ctx).drawCounter(state, 'counter_oak', 0, []);
  return drawImage.mock.calls.filter(([source]) => source.itemId === 'roll').length;
}

describe('pastry case inventory across closing', () => {
  it('shows the planned bake only during preparation', () => {
    expect(pastryCount('prep', 8, 0)).toBe(2);
    expect(pastryCount('prep', 0, 8)).toBe(0);
  });
  it.each(['open', 'closing'] as const)('shows remaining stock during %s without reviving the prep plan', phase => {
    expect(pastryCount(phase, 8, 0)).toBe(0);
    expect(pastryCount(phase, 8, 1)).toBe(1);
    expect(pastryCount(phase, 0, 8)).toBe(2);
  });
});
