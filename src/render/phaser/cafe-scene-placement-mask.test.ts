import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLS, FLOOR_ROWS, canPlace, cellFree } from '../../game/furniture';
import { MIN_SCENE_H, setSceneHeight } from '../../game/layout';
import { createInitialState } from '../../game/state';
import type { Ghost } from '../cafe-view';

const counts = vi.hoisted(() => ({ vectors: 0 }));
vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Math: { Vector2: class {
    constructor(public x: number, public y: number) { counts.vectors++; }
  } },
} }));
vi.mock('../../game/furniture', async importOriginal => {
  const actual = await importOriginal<typeof import('../../game/furniture')>();
  return { ...actual, cellFree: vi.fn(actual.cellFree), canPlace: vi.fn(actual.canPlace) };
});
vi.mock('../furniture-art', () => ({
  GHOST_OK: '#00ff00', GHOST_BAD: '#ff0000',
  paintWallFurniture: vi.fn(), paintFloorFurniture: vi.fn(), floorFurnitureBounds: vi.fn(),
}));

import { CafeScene } from './cafe-scene';

function graphics() {
  return {
    clear: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(),
    fillPoints: vi.fn().mockReturnThis(), lineStyle: vi.fn().mockReturnThis(),
    strokePoints: vi.fn().mockReturnThis(),
  };
}

function harness() {
  const scene = Object.create(CafeScene.prototype);
  const cells = graphics(), box = graphics();
  const piece = {
    setVisible: vi.fn().mockReturnThis(), setTexture: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(),
  };
  const texture = { context: { clearRect: vi.fn() }, refresh: vi.fn() };
  const view = { area: 'main', catSpaceClear: vi.fn(() => true) };
  const sim = { furnitureSpaceClear: vi.fn(() => true) };
  const state = createInitialState(0);
  const ghost: Ghost = { id: 'lamp', col: 1, row: 18, skip: -1 };
  Object.assign(scene, {
    ghostCells: cells, ghostBox: box, ghostPiece: piece, view, sim,
    textures: { exists: () => true, get: () => texture },
    floorTexture: () => ({ key: 'lamp', dx: -10, dy: -40 }),
  });
  const draw = (held: Ghost | null = ghost, t = 0) => scene.drawGhost(state, held, t, new Date(0));
  return { scene, cells, box, piece, view, sim, state, ghost, draw };
}

beforeEach(() => { vi.clearAllMocks(); counts.vectors = 0; });
afterEach(() => setSceneHeight(MIN_SCENE_H));

describe('scene placement mask caching', () => {
  it('keeps static mask geometry across pointer/time changes and only builds the live outline', () => {
    const { cells, box, piece, ghost, draw } = harness();
    draw();
    expect(cellFree).toHaveBeenCalledTimes(COLS * FLOOR_ROWS);
    const blockedCells = cells.fillPoints.mock.calls.length;
    expect(blockedCells).toBeGreaterThan(0);
    const vectors = counts.vectors;
    const oldOutline = box.fillPoints.mock.calls[0][0];
    ghost.col++;
    draw(ghost, 1);
    expect(cells.clear).toHaveBeenCalledTimes(1);
    expect(cells.fillPoints).toHaveBeenCalledTimes(blockedCells);
    expect(cellFree).toHaveBeenCalledTimes(COLS * FLOOR_ROWS);
    expect(box.clear).toHaveBeenCalledTimes(2);
    expect(box.fillPoints).toHaveBeenCalledTimes(2);
    expect(counts.vectors - vectors).toBe(box.fillPoints.mock.calls[1][0].length);
    expect(box.fillPoints.mock.calls[1][0]).not.toEqual(oldOutline);
    expect(piece.setPosition).toHaveBeenCalledTimes(2);
    expect(canPlace).toHaveBeenCalledTimes(2);
  });

  it('still checks moving people and cats each frame and changes live validity', () => {
    const { cells, box, sim, view, draw } = harness();
    draw();
    expect(box.fillStyle).toHaveBeenLastCalledWith(0x00ff00, expect.any(Number));
    sim.furnitureSpaceClear.mockReturnValue(false);
    draw();
    expect(box.fillStyle).toHaveBeenLastCalledWith(0xff0000, expect.any(Number));
    sim.furnitureSpaceClear.mockReturnValue(true);
    view.catSpaceClear.mockReturnValue(false);
    draw();
    expect(box.fillStyle).toHaveBeenLastCalledWith(0xff0000, expect.any(Number));
    view.catSpaceClear.mockReturnValue(true);
    draw();
    expect(box.fillStyle).toHaveBeenLastCalledWith(0x00ff00, expect.any(Number));
    expect(sim.furnitureSpaceClear).toHaveBeenCalledTimes(4);
    expect(view.catSpaceClear).toHaveBeenCalledTimes(3);
    expect(cells.clear).toHaveBeenCalledTimes(1);
    expect(canPlace).toHaveBeenCalledTimes(4);
  });

  it('reuses the mask when a different piece uses the same surface', () => {
    const { cells, box, state, ghost, draw } = harness();
    draw();
    const lampOutline = box.fillPoints.mock.calls[0][0];
    ghost.id = 'plant_snake';
    state.coins++;
    state.dayTime++;
    draw();
    expect(cells.clear).toHaveBeenCalledTimes(1);
    expect(cellFree).toHaveBeenCalledTimes(COLS * FLOOR_ROWS);
    expect(box.fillPoints.mock.calls[1][0]).not.toEqual(lampOutline);
    expect(canPlace).toHaveBeenLastCalledWith(state, 'plant_snake', ghost.col, ghost.row, 2, -1);
  });

  it('redraws when occupancy, skip, room, surface or scene geometry changes', () => {
    const { cells, state, ghost, view, draw } = harness();
    draw();
    state.decor.placed.push({ id: 'plant_snake', col: 1, row: 18 }); draw();
    ghost.skip = state.decor.placed.length - 1; draw();
    state.upgrades.tables++; draw();
    state.regions.push('reading'); draw();
    state.kitchen = true; draw();
    view.area = 'reading'; draw();
    ghost.id = 'clock'; draw();
    setSceneHeight(360); draw();
    expect(cells.clear).toHaveBeenCalledTimes(9);
  });

  it.each([null, { id: 'unknown', col: 0, row: 0, skip: -1 }])('clears and invalidates when the held piece is %j', absent => {
    const { cells, box, piece, draw } = harness();
    draw();
    const blockedCells = cells.fillPoints.mock.calls.length;
    draw(absent);
    expect(cells.clear).toHaveBeenCalledTimes(2);
    expect(piece.setVisible).toHaveBeenLastCalledWith(false);
    expect(box.clear).toHaveBeenCalledTimes(2);
    expect(box.fillPoints).toHaveBeenCalledTimes(1);
    draw();
    expect(cells.clear).toHaveBeenCalledTimes(3);
    expect(cells.fillPoints).toHaveBeenCalledTimes(blockedCells * 2);
  });

  it('does not reuse a key against newly created scene graphics', () => {
    const { scene, draw } = harness();
    draw();
    const replacement = graphics();
    scene.ghostCells = replacement;
    draw();
    expect(replacement.clear).toHaveBeenCalledTimes(1);
    expect(replacement.fillPoints.mock.calls.length).toBeGreaterThan(0);
  });
});
