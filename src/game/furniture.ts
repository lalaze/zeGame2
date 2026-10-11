// Furniture and props the player buys and places anywhere free on a grid,
// on the floor or on the two stretches of wall beside the menu board.
//
// Floor cells are laid out at the minimum scene height (see `floorY` in layout.ts),
// so a spot that's free there stays free on any screen.
import { FLOOR_Y, MAX_TABLES, MIN_SCENE_H, SCENE_W, tableSpotMin } from './layout';
import type { GameState } from './state';
import { activeTableIndices, adjacentArea, areaAtX, isAreaOpen, regionOffset } from './regions';

export type Surface = 'floor' | 'wall';
export type FurnishingCategory = 'decoration' | 'furniture';

export interface FurnitureDef {
  /** Doubles as the translation key suffix: decor.<id> */
  id: string;
  category: FurnishingCategory;
  surface: Surface;
  /** Footprint in grid cells. On the floor, h is the depth it takes up. */
  w: number;
  h: number;
  cost: number;
  /** Each kind placed adds its comfort once, however many copies are out. */
  comfort: number;
}

export const FURNITURE: readonly FurnitureDef[] = [
  { id: 'clock', category: 'decoration', surface: 'wall', w: 3, h: 3, cost: 0, comfort: 0 },
  { id: 'mugrack', category: 'furniture', surface: 'wall', w: 4, h: 2, cost: 0, comfort: 0 },
  { id: 'plant_fern', category: 'decoration', surface: 'floor', w: 2, h: 1, cost: 100, comfort: 3 },
  { id: 'plant_snake', category: 'decoration', surface: 'floor', w: 1, h: 1, cost: 180, comfort: 3 },
  { id: 'art_landscape', category: 'decoration', surface: 'wall', w: 4, h: 3, cost: 250, comfort: 4 },
  { id: 'aframe', category: 'decoration', surface: 'floor', w: 2, h: 1, cost: 400, comfort: 4 },
  { id: 'plant_fig', category: 'decoration', surface: 'floor', w: 2, h: 1, cost: 600, comfort: 5 },
  { id: 'sconce', category: 'decoration', surface: 'wall', w: 1, h: 2, cost: 800, comfort: 4 },
  { id: 'garland', category: 'decoration', surface: 'wall', w: 4, h: 1, cost: 1_200, comfort: 5 },
  { id: 'lamp', category: 'decoration', surface: 'floor', w: 2, h: 1, cost: 1_500, comfort: 6 },
  { id: 'coatrack', category: 'furniture', surface: 'floor', w: 1, h: 1, cost: 2_000, comfort: 6 },
  { id: 'plant_monstera', category: 'decoration', surface: 'floor', w: 3, h: 1, cost: 2_500, comfort: 8 },
  { id: 'shelf', category: 'furniture', surface: 'wall', w: 4, h: 2, cost: 3_000, comfort: 7 },
  { id: 'bench', category: 'furniture', surface: 'floor', w: 4, h: 1, cost: 4_000, comfort: 8 },
  { id: 'art_cat', category: 'decoration', surface: 'wall', w: 4, h: 3, cost: 5_000, comfort: 8 },
  { id: 'catbed', category: 'furniture', surface: 'floor', w: 2, h: 1, cost: 8_000, comfort: 10 },
  { id: 'bookshelf', category: 'furniture', surface: 'floor', w: 4, h: 1, cost: 20_000, comfort: 12 },
  { id: 'armchair', category: 'furniture', surface: 'floor', w: 3, h: 1, cost: 60_000, comfort: 14 },
  { id: 'plant_lemon', category: 'decoration', surface: 'floor', w: 3, h: 1, cost: 100_000, comfort: 15 },
  { id: 'art_bean', category: 'decoration', surface: 'wall', w: 4, h: 3, cost: 150_000, comfort: 15 },
  { id: 'gramophone', category: 'furniture', surface: 'floor', w: 2, h: 1, cost: 1_500_000, comfort: 22 },
  { id: 'art_starry', category: 'decoration', surface: 'wall', w: 4, h: 3, cost: 5_000_000, comfort: 26 },
  { id: 'piano', category: 'furniture', surface: 'floor', w: 5, h: 2, cost: 25_000_000, comfort: 35 },
  { id: 'plant_lavender', category: 'decoration', surface: 'floor', w: 2, h: 1, cost: 120, comfort: 3 },
  { id: 'plant_succulent', category: 'decoration', surface: 'floor', w: 1, h: 1, cost: 80, comfort: 2 },
  { id: 'vase_daisies', category: 'decoration', surface: 'floor', w: 2, h: 1, cost: 220, comfort: 4 },
  { id: 'poster_coffee', category: 'decoration', surface: 'wall', w: 3, h: 3, cost: 160, comfort: 3 },
  { id: 'poster_bakery', category: 'decoration', surface: 'wall', w: 3, h: 3, cost: 280, comfort: 4 },
  { id: 'wreath_season', category: 'decoration', surface: 'wall', w: 3, h: 3, cost: 480, comfort: 5 },
  { id: 'hanging_ivy', category: 'decoration', surface: 'wall', w: 2, h: 3, cost: 350, comfort: 4 },
  { id: 'wall_pennants', category: 'decoration', surface: 'wall', w: 4, h: 1, cost: 200, comfort: 3 },
  { id: 'lantern', category: 'decoration', surface: 'floor', w: 2, h: 1, cost: 650, comfort: 5 },
  { id: 'bean_display', category: 'decoration', surface: 'floor', w: 3, h: 1, cost: 950, comfort: 6 },
  { id: 'sideboard', category: 'furniture', surface: 'floor', w: 4, h: 2, cost: 1800, comfort: 6 },
  { id: 'sofa', category: 'furniture', surface: 'floor', w: 4, h: 2, cost: 3500, comfort: 8 },
  { id: 'round_stool', category: 'furniture', surface: 'floor', w: 2, h: 1, cost: 320, comfort: 3 },
  { id: 'display_cabinet', category: 'furniture', surface: 'floor', w: 3, h: 2, cost: 6500, comfort: 9 },
  { id: 'magazine_rack', category: 'furniture', surface: 'floor', w: 2, h: 1, cost: 750, comfort: 4 },
  { id: 'coffee_cart', category: 'furniture', surface: 'floor', w: 4, h: 2, cost: 12000, comfort: 11 },
];

const BY_ID = new Map(FURNITURE.map((f) => [f.id, f]));
export const furnitureDef = (id: string) => BY_ID.get(id);

export interface Placed {
  id: string;
  /** Top-left cell of the footprint. */
  col: number;
  row: number;
}

export const CELL = 8;
export const COLS = SCENE_W / CELL;
/** Floor rows start at the back wall and stop at the front wall (minimum height). */
export const FLOOR_ROWS = Math.floor((MIN_SCENE_H - 7 - FLOOR_Y) / CELL);
/** The wall grid starts under the ceiling beam and stops at the back bar's clutter. */
export const WALL_TOP = 6;
export const WALL_ROWS = 5;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Wall space that's free to hang things on: either side of the menu board. */
const WALL_FREE: readonly Rect[] = [
  { x: 72, y: WALL_TOP, w: 32, h: WALL_ROWS * CELL },
  { x: 216, y: WALL_TOP, w: 32, h: WALL_ROWS * CELL },
];

/** Floor that always stays clear: the counter and the walkway from the door to it. */
const FLOOR_RESERVED: readonly Rect[] = [
  { x: 64, y: FLOOR_Y, w: 192, h: 48 },
  { x: 128, y: FLOOR_Y + 48, w: 64, h: MIN_SCENE_H },
  // Fitted service cupboards and the staff waiting bay beneath the windows.
  { x: 8, y: FLOOR_Y, w: 56, h: 46 },
  { x: 256, y: FLOOR_Y, w: 56, h: 46 },
  // Built-in pots flank the street entrance.
  { x: 122, y: MIN_SCENE_H - 15, w: 12, h: 9 },
  { x: 186, y: MIN_SCENE_H - 15, w: 12, h: 9 },
];

/** The space a table needs: its chairs, and room in front to walk up to them. */
function tableRect(i: number): Rect {
  const t = tableSpotMin(i);
  return { x: t.x - 24, y: t.y - 30, w: 48, h: 44 };
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

/** The footprint of an item at (col, row), in pixels at the minimum height. */
export function footprint(def: FurnitureDef, col: number, row: number): Rect {
  const top = def.surface === 'wall' ? WALL_TOP : FLOOR_Y;
  return { x: col * CELL, y: top + row * CELL, w: def.w * CELL, h: def.h * CELL };
}

/**
 * Whether an item fits at (col, row): on the grid, clear of the counter, the walkway,
 * the built tables and the spot the next table will go, and of other placed items.
 * `tables` is how many main café tables are built; `skip` ignores one placed item (the one being moved).
 */
export function canPlace(state: GameState, id: string, col: number, row: number, tables: number, skip = -1): boolean {
  const def = furnitureDef(id);
  return !!def && fits(state, def, col, row, tables, skip);
}

function fits(state: GameState, def: FurnitureDef, col: number, row: number, tables: number, skip: number): boolean {
  const rows = def.surface === 'wall' ? WALL_ROWS : FLOOR_ROWS;
  if (!Number.isInteger(col) || !Number.isInteger(row)) return false;
  const area = areaAtX(col * CELL);
  // The kitchen is fitted out for work, with no room for decorations.
  if (!area || area === 'kitchen' || !isAreaOpen(state, area)) return false;
  const start = regionOffset(area) / CELL;
  if (col < start || row < 0 || col + def.w > start + COLS || row + def.h > rows) return false;
  const box = footprint(def, col, row);
  if (def.surface === 'wall') {
    if (area === 'main') {
      if (!WALL_FREE.some((free) => inside(box, free))) return false;
    } else {
      if (!inside(box, { x: regionOffset(area) + 16, y: WALL_TOP, w: 288, h: WALL_ROWS * CELL })) return false;
      if (adjacentArea(area, 'up') && overlaps(box, { x: regionOffset(area) + 136, y: WALL_TOP, w: 48, h: WALL_ROWS * CELL })) return false;
    }
  } else {
    if (overlaps(box, { x: regionOffset(area), y: 126, w: SCENE_W, h: 24 })) return false;
    if (col < start + 1 || col + def.w > start + COLS - 1) return false;
    if (area === 'main') {
      if (FLOOR_RESERVED.some((r) => overlaps(box, r))) return false;
      const built = tables;
      for (let i = 0; i < Math.min(MAX_TABLES, built + 1); i++) if (overlaps(box, tableRect(i))) return false;
    } else {
      const x = regionOffset(area);
      const reserved = [{ x, y: FLOOR_Y, w: SCENE_W, h: 24 }, { x: x + 136, y: 104, w: 48, h: MIN_SCENE_H }];
      if (reserved.some((r) => overlaps(box, r))) return false;
      for (const i of activeTableIndices(state)) if (overlaps(box, tableRect(i))) return false;
    }
  }
  return state.decor.placed.every((p, i) => {
    const other = furnitureDef(p.id);
    return i === skip || !other || other.surface !== def.surface || !overlaps(box, footprint(other, p.col, p.row));
  });
}

/** Whether a single cell is free, for drawing the grid while placing. */
export function cellFree(state: GameState, surface: Surface, col: number, row: number, tables: number, skip = -1): boolean {
  return fits(state, { id: '', category: 'decoration', surface, w: 1, h: 1, cost: 0, comfort: 0 }, col, row, tables, skip);
}

export const storedCount = (state: GameState, id: string) => state.decor.stored[id] ?? 0;
export const placedCount = (state: GameState, id: string) => state.decor.placed.filter((p) => p.id === id).length;

/** Buys one into storage. Returns false if it can't be afforded. */
export function buyFurniture(state: GameState, id: string): boolean {
  const def = furnitureDef(id);
  if (!def || state.coins < def.cost) return false;
  state.coins -= def.cost;
  state.decor.stored[id] = storedCount(state, id) + 1;
  return true;
}

/** Takes one out of storage and puts it at (col, row). */
export function placeFurniture(state: GameState, id: string, col: number, row: number, tables: number): boolean {
  if (storedCount(state, id) < 1 || !canPlace(state, id, col, row, tables)) return false;
  state.decor.stored[id]--;
  if (state.decor.stored[id] === 0) delete state.decor.stored[id];
  state.decor.placed.push({ id, col, row });
  return true;
}

/** Moves a placed item to (col, row). */
export function moveFurniture(state: GameState, index: number, col: number, row: number, tables: number): boolean {
  const p = state.decor.placed[index];
  if (!p || !canPlace(state, p.id, col, row, tables, index)) return false;
  p.col = col;
  p.row = row;
  return true;
}

/** Puts a placed item back in storage. */
export function storeFurniture(state: GameState, index: number): void {
  const [p] = state.decor.placed.splice(index, 1);
  if (p) state.decor.stored[p.id] = storedCount(state, p.id) + 1;
}

/** Sends to storage anything a newly built table (or the next table spot) now needs. Returns how many. */
export function evictBlocked(state: GameState, tables: number): number {
  let moved = 0;
  for (let i = state.decor.placed.length - 1; i >= 0; i--) {
    const p = state.decor.placed[i];
    if (!canPlace(state, p.id, p.col, p.row, tables, i)) {
      storeFurniture(state, i);
      moved++;
    }
  }
  return moved;
}

export function furnitureComfort(state: GameState): number {
  const kinds = new Set(state.decor.placed.map((p) => p.id));
  return [...kinds].reduce((sum, id) => sum + (furnitureDef(id)?.comfort ?? 0), 0);
}

/** What a new café starts with on the wall. */
export const STARTER_FURNITURE: readonly Placed[] = [
  { id: 'clock', col: 10, row: 0 },
  { id: 'mugrack', col: 27, row: 3 },
];
/** Where a painting carried over from an old save goes. */
export const DEFAULT_ART_SPOT = { col: 27, row: 0 };
