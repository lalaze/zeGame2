// What the café scene is showing, independent of how it's drawn: the camera, the
// room in view, the piece being arranged, the cat and kitchen door, and effects
// waiting to be spawned. The Phaser scene (render/phaser/) reads this every frame.
import { isBakery } from '../game/economy';
import { CELL, WALL_TOP, furnitureDef, type FurnitureDef } from '../game/furniture';
import { CAT_SPOT, FLOOR_Y, SCENE_W, areaOrigin, floorY, floorYMin, sceneHeight, tablePos } from '../game/layout';
import { areaAtX, regionOffset, type AreaId } from '../game/regions';
import type { Sim, SimEvent } from '../game/sim';
import type { GameState } from '../game/state';
import { floorFurnitureBounds } from './furniture-art';
import { MACHINE_X } from './room-art';
import { RoomCamera } from './room-camera';

/** A piece of furniture being placed or moved, and where it would go. */
export interface Ghost {
  id: string;
  col: number;
  row: number;
  /** The placed item being moved, which doesn't count as in its own way. */
  skip: number;
}

export interface Effect {
  kind: 'steam' | 'sparkle' | 'heart' | 'bell';
  x: number;
  y: number;
}

/** Where a floor piece at (col, row) stands: its middle, and its feet at the front of its footprint. */
export function floorAnchor(def: FurnitureDef, col: number, row: number): { cx: number; foot: number } {
  const area = areaAtX(col * CELL) ?? 'main';
  const o = areaOrigin(area);
  return { cx: o.x + (col + def.w / 2) * CELL - regionOffset(area), foot: o.y + floorY(FLOOR_Y + (row + def.h) * CELL) - 1 };
}

/** Grid cells as drawn on screen; floor rows stretch with the room. */
export function cellRect(surface: 'floor' | 'wall', col: number, row: number, w: number, h: number) {
  const area = areaAtX(col * CELL) ?? 'main';
  const o = areaOrigin(area);
  const x = o.x + col * CELL - regionOffset(area);
  if (surface === 'wall') return { x, y: o.y + WALL_TOP + row * CELL, w: w * CELL, h: h * CELL };
  const top = floorY(FLOOR_Y + row * CELL);
  return { x, y: o.y + top, w: w * CELL, h: floorY(FLOOR_Y + (row + h) * CELL) - top };
}

export class CafeView {
  private camera = new RoomCamera();
  private steamTimer = 0;
  area: AreaId = 'main';
  overview = false;
  /** Set while the player is placing or moving a piece. */
  ghost: Ghost | null = null;
  /** Seconds the cat stays happy after being petted. */
  catHappy = 0;
  /** How far the kitchen door has swung open, 0 to 1. */
  kitchenDoor = 0;
  /** Particles and sales waiting for the renderer to show them. */
  readonly effects: Effect[] = [];
  readonly sales: Extract<SimEvent, { type: 'sale' }>[] = [];

  get viewX(): number { return this.camera.x; }
  get viewY(): number { return this.camera.y; }
  get zoom(): number { return this.camera.zoom; }
  get viewWidth(): number { return SCENE_W / this.camera.zoom; }
  get viewHeight(): number { return sceneHeight() / this.camera.zoom; }
  get panning(): boolean { return this.camera.moving; }

  moveToArea(area: AreaId, immediate = false): void {
    this.area = area;
    this.overview = false;
    this.camera.moveTo(areaOrigin(area), immediate);
  }

  setOverview(show: boolean, immediate = false): void {
    this.overview = show;
    this.camera.moveTo(show ? { x: 0, y: -sceneHeight() } : areaOrigin(this.area), immediate, show ? 0.5 : 1);
  }

  // ------------------------------------------------------------ effects

  addEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'sale') this.sales.push(e);
      else if (e.type === 'bell') this.effects.push({ kind: 'bell', x: e.x, y: e.y });
    }
  }

  sparkle(x: number, y: number): void {
    this.effects.push({ kind: 'sparkle', x, y });
  }

  /** Returns true if the tap landed on the cat. */
  hitCat(x: number, y: number): boolean {
    return this.area === 'main' && x >= CAT_SPOT.x - 10 && x <= CAT_SPOT.x + 10 && y >= CAT_SPOT.y - 16 && y <= CAT_SPOT.y + 2;
  }

  petCat(): void {
    this.catHappy = 2;
    for (let i = 0; i < 3; i++) this.effects.push({ kind: 'heart', x: CAT_SPOT.x - 4 + i * 4, y: CAT_SPOT.y - 16 - i * 4 });
  }

  update(dt: number, sim: Sim): void {
    this.camera.update(dt);
    this.catHappy = Math.max(0, this.catHappy - dt);
    // The kitchen door swings open while someone fetches a bread or pastry.
    const fetching = sim.baristas.some((b, i) => {
      const c = sim.isBrewing(i) && sim.customers.find((c) => c.id === b.customerId);
      return !!c && isBakery(c.order);
    });
    this.kitchenDoor += ((fetching ? 1 : 0) - this.kitchenDoor) * Math.min(1, dt * 10);

    this.steamTimer -= dt;
    if (this.steamTimer <= 0) {
      this.steamTimer = 0.3;
      if (sim.baristas.some((_, i) => sim.isBrewing(i))) this.effects.push({ kind: 'steam', x: MACHINE_X + 8 + Math.random() * 14, y: 62 });
      for (const c of sim.customers) {
        if (c.phase === 'sitting' && Math.random() < 0.25) {
          const table = tablePos(Math.floor(c.seat / 2));
          this.effects.push({ kind: 'steam', x: table.x + (c.seat % 2 === 0 ? -7 : 7), y: table.y - 26 });
        }
      }
    }
  }

  // ------------------------------------------------------------ arranging furniture

  /** The grid cell a piece would go in if dropped with its middle at (x, y). */
  cellAt(id: string, x: number, y: number): { col: number; row: number } {
    const def = furnitureDef(id)!;
    const o = areaOrigin(this.area);
    x = x - o.x + regionOffset(this.area);
    y -= o.y;
    const col = Math.round(x / CELL - def.w / 2);
    if (def.surface === 'wall') return { col, row: Math.round((y - WALL_TOP) / CELL - def.h / 2) };
    // On the floor the pointer marks the front edge, where the piece stands.
    const bottom = Math.floor((floorYMin(Math.max(FLOOR_Y, y)) - FLOOR_Y) / CELL);
    return { col, row: bottom - def.h + 1 };
  }

  /** Which placed piece is drawn at (x, y), front-most first; -1 if none. */
  furnitureAt(state: GameState, x: number, y: number): number {
    const hits = state.decor.placed
      .map((p, i) => ({ p, i, def: furnitureDef(p.id) }))
      .filter(({ p, def }) => {
        if (!def) return false;
        const b =
          def.surface === 'wall'
            ? cellRect('wall', p.col, p.row, def.w, def.h)
            : floorFurnitureBounds(p.id, floorAnchor(def, p.col, p.row).cx, floorAnchor(def, p.col, p.row).foot);
        return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
      })
      .sort((a, b) => (b.def!.surface === 'floor' ? b.p.row : -1) - (a.def!.surface === 'floor' ? a.p.row : -1));
    return hits[0]?.i ?? -1;
  }
}
