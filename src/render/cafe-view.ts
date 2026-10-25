// What the café scene is showing, independent of how it's drawn: the camera, the
// room in view, the piece being arranged, the cat and kitchen door, and effects
// waiting to be spawned. The Phaser scene (render/phaser/) reads this every frame.
import { LivingCats } from '../game/living-cats';
import type { CatId } from '../game/pets';
import { isBakery } from '../game/economy';
import { stationSpot } from '../game/kitchen';
import { CELL, WALL_TOP, furnitureDef, type FurnitureDef } from '../game/furniture';
import { CAT_SPOT, CAT_SPOTS, COUNTER, FLOOR_Y, PASTRY_CASE, SCENE_W, areaOrigin, areaBounds, kitchenHeight, floorY, floorYMin, sceneHeight, tablePos } from '../game/layout';
import { areaAtX, regionOffset, type AreaId } from '../game/regions';
import type { Sim, SimEvent } from '../game/sim';
import type { GameState } from '../game/state';
import { floorFurnitureBounds } from './furniture-art';
import { MACHINE_X, MACHINE_Y } from './room-art';
import { RoomCamera } from './room-camera';
import { MAIN_COUNTER_PLANE, MAIN_WALL_PLANE, projectMainAttachment, projectMainPlaneWorld, projectMainWorld, unprojectMainPlaneWorld, unprojectMainWorld } from './main-pixel-presentation';
import type { PixelPoint } from './pixel-projection';
import type { MomentKind, MomentReaction, MomentSpot } from '../game/moments';

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
  readonly livingCats = new LivingCats();
  selectedCat: CatId | null = null;
  catSelectionSeconds = 0;
  private locatingCat = false;
  private steamTimer = 0;
  private focusedKitchenHeight = 0;
  private presentedPointer: PixelPoint | null = null;
  private presentedResidentCatPoints = new Map<CatId, PixelPoint>();
  private effectAnchors = new WeakMap<Effect, { anchor?: PixelPoint; plane?: number; presented?: boolean }>();

  /** Frame the physical room, rather than the unused remainder of its grid cell. */
  private roomFocus() {
    const b = areaBounds(this.area);
    return { x: b.x, y: b.y + (b.h - sceneHeight()) / 2 };
  }
  area: AreaId = 'main';
  overview = false;
  /** Mirrors the page's pause state, so transient thoughts disappear behind dialogs. */
  paused = false;
  /** An explicit, temporary next-table preview; never saved or treated as a seat. */
  tablePreview = false;
  /** The optional moment waiting on the player, cued above its guest or its spot. */
  moment: { kind: MomentKind; customerId?: number; spot?: MomentSpot } | null = null;
  /** A guest's spoken reply to the player's answer. */
  momentReaction: MomentReaction | null = null;
  /** Where the moment's cue and subject are painted this frame, in presented pixels. */
  momentTarget: { x: number; y: number; w: number; h: number } | null = null;
  /** Coins a moment paid out, waiting to pop up over the spot the player tapped. */
  readonly tips: { amount: number; x: number; y: number }[] = [];
  /** Brief, truthful feedback anchored on the employee or guest who was helped. */
  readonly assistanceLabels: { text: string; x: number; y: number }[] = [];
  /** Set while the player is placing or moving a piece. */
  ghost: Ghost | null = null;
  /** Seconds the cat stays happy after being petted. */
  catHappy = 0;
  catSpot: { x: number; y: number } = CAT_SPOT;
  /** How far the kitchen door has swung open, 0 to 1: it opens as a cook brings a batch through. */
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
    this.locatingCat = false;
    this.area = area;
    this.overview = false;
    this.focusedKitchenHeight = kitchenHeight();
    this.camera.moveTo(this.roomFocus(), immediate);
  }

  /** The map shows the whole building, three rooms across and two deep, centered. */
  setOverview(show: boolean, immediate = false): void {
    this.locatingCat = false;
    this.overview = show;
    const H = sceneHeight();
    this.focusedKitchenHeight = kitchenHeight();
    this.camera.moveTo(show ? { x: -SCENE_W, y: -H * 1.5 } : this.roomFocus(), immediate, show ? 1 / 3 : 1);
  }

  // ------------------------------------------------------------ effects

  /** Keep the raw painted pointer only during its synchronous input dispatch. */
  withPresentedPointer<T>(point: PixelPoint, dispatch: (logical: PixelPoint) => T): T {
    const previous = this.presentedPointer;
    this.presentedPointer = point;
    try { return dispatch(this.overview ? point : unprojectMainWorld(point)); }
    finally { this.presentedPointer = previous; }
  }

  private queueEffect(effect: Effect, anchor?: PixelPoint, plane?: number, presented = false): void {
    this.effects.push(effect);
    this.effectAnchors.set(effect, { anchor, plane, presented });
  }

  /** Effects keep their owner's displacement even when emitted above its head. */
  effectPoint(effect: Effect): PixelPoint {
    const attachment = this.effectAnchors.get(effect);
    if (attachment?.presented) return { x: effect.x, y: effect.y };
    if (attachment?.plane !== undefined) return projectMainPlaneWorld(effect, attachment.plane);
    return attachment?.anchor ? projectMainAttachment(effect, attachment.anchor) : projectMainWorld(effect);
  }

  addEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'sale') this.sales.push(e);
      else if (e.type === 'bell') this.queueEffect({ kind: 'bell', x: e.x, y: e.y }, undefined, MAIN_COUNTER_PLANE);
      else if (e.type === 'restock') {
        // A fresh batch lands in the pastry case.
        for (let i = 0; i < 4; i++) this.queueEffect({ kind: 'sparkle', x: PASTRY_CASE.x + 8 + i * 18, y: COUNTER.front + 6 }, undefined, MAIN_COUNTER_PLANE);
      }
    }
  }

  sparkle(x: number, y: number, anchor: PixelPoint = { x, y: y + 15 }): void {
    this.queueEffect({ kind: 'sparkle', x, y }, anchor);
  }

  assistance(text: string, anchor: PixelPoint, kind: 'brew' | 'guest' = 'guest'): void {
    const point = projectMainAttachment({ x: anchor.x, y: anchor.y - 38 }, anchor);
    this.assistanceLabels.push({ text, ...point });
    for (const dx of [-6, 0, 6]) this.sparkle(anchor.x + dx, anchor.y - 25 - Math.abs(dx), anchor);
    this.queueEffect({ kind: kind === 'brew' ? 'steam' : 'heart', x: anchor.x, y: anchor.y - 28 }, anchor);
  }

  /** Clear before each rendered frame, including frames that draw no residents. */
  clearPresentedResidentCatPoints(): void {
    this.presentedResidentCatPoints.clear();
  }

  /** Final painted world-space foot, already projected; never a simulation position. */
  setPresentedResidentCatPoint(id: CatId, point: PixelPoint): void {
    if (!this.livingCats.actors.has(id) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      this.presentedResidentCatPoints.delete(id);
      return;
    }
    this.presentedResidentCatPoints.set(id, { x: point.x, y: point.y });
  }

  /** Resident hit targets are slightly larger than the pixel art, nearest wins. */
  hitResidentCat(x: number, y: number, radius = 12): CatId | null {
    if (this.overview || this.panning || this.paused) return null;
    const point = this.presentedPointer ?? { x, y };
    const candidates = [...this.livingCats.actors.values()].map(cat => ({ cat, at: this.presentedPointer
      ? this.presentedResidentCatPoints.get(cat.id) ?? projectMainWorld(cat) : cat })).filter(({ cat, at }) =>
      cat.area === this.area && Math.abs(point.x - at.x) <= radius && point.y >= at.y - Math.max(22, radius + 8) && point.y <= at.y + Math.max(5, radius - 8));
    candidates.sort((a, b) => Math.hypot(point.x - a.at.x, point.y - a.at.y + 8) - Math.hypot(point.x - b.at.x, point.y - b.at.y + 8));
    return candidates[0]?.cat.id ?? null;
  }

  selectResidentCat(id: CatId): void {
    if (!this.livingCats.actors.has(id)) return;
    this.selectedCat = id;
    this.catSelectionSeconds = 6;
  }

  /** Reveal the painted resident, then return to the normal room framing. */
  focusResidentCat(id: CatId, immediate = false): void {
    const cat = this.livingCats.actors.get(id);
    if (!cat) return;
    this.moveToArea(cat.area, immediate);
    this.selectResidentCat(id);
    this.locatingCat = true;
    const point = this.presentedResidentCatPoints.get(id) ?? projectMainWorld(cat);
    const zoom = 1.6;
    this.camera.moveTo({ x: point.x - SCENE_W / (2 * zoom), y: point.y - 8 - sceneHeight() / (2 * zoom) }, immediate, zoom);
  }

  petResidentCat(id: CatId): boolean {
    const cat = this.livingCats.actors.get(id);
    if (!cat || !this.livingCats.interact(id)) return false;
    this.selectResidentCat(id);
    this.catSpot = { x: cat.x, y: cat.y };
    this.petCat();
    return true;
  }

  /** Cats yield to people, but solid furniture must not be placed on a resident. */
  catSpaceClear(id: string, col: number, row: number): boolean {
    const def = furnitureDef(id);
    if (!def || def.surface !== 'floor') return true;
    const rect = cellRect('floor', col, row, def.w, def.h);
    return [...this.livingCats.actors.values()].every((cat) =>
      cat.x < rect.x - 4 || cat.x > rect.x + rect.w + 4 || cat.y < rect.y - 4 || cat.y > rect.y + rect.h + 4);
  }

  /** Whether a tap lands on the waiting moment's cue or its subject, at least `reach` wide. */
  hitMoment(x: number, y: number, reach: number): boolean {
    const target = this.momentTarget, point = this.presentedPointer ?? { x, y };
    if (!target || this.overview || this.panning) return false;
    const cx = target.x + target.w / 2, half = Math.max(reach, target.w / 2);
    return Math.abs(point.x - cx) <= half && point.y >= target.y - 2 && point.y <= target.y + target.h + 2;
  }

  /** Pop the coins a moment paid over where its cue was. */
  tipAtMoment(amount: number): void {
    const target = this.momentTarget;
    if (target && amount > 0) this.tips.push({ amount, x: target.x + target.w / 2, y: target.y + 6 });
  }

  /** A little camera flash: sparkles around the posing guest. */
  flashAtMoment(): void {
    const target = this.momentTarget;
    if (!target) return;
    for (let i = 0; i < 5; i++) {
      this.queueEffect({ kind: 'sparkle', x: target.x + target.w / 2 - 8 + i * 4, y: target.y + 10 + (i % 2) * 6 }, undefined, undefined, true);
    }
  }

  /** Returns true if the tap landed on the cat. */
  hitCat(x: number, y: number, count = 1): boolean {
    if (this.area !== 'main') return false;
    const point = this.presentedPointer ?? { x, y };
    const spot = CAT_SPOTS.slice(0, count).find((p) => {
      const at = this.presentedPointer ? projectMainPlaneWorld(p, MAIN_WALL_PLANE) : p;
      return point.x >= at.x - 10 && point.x <= at.x + 10 && point.y >= at.y - 16 && point.y <= at.y + 2;
    });
    if (!spot) return false;
    this.catSpot = spot;
    return true;
  }

  petCat(): void {
    this.catHappy = 2;
    const resident = [...this.livingCats.actors.values()].some(cat => cat.x === this.catSpot.x && cat.y === this.catSpot.y);
    for (let i = 0; i < 3; i++) this.queueEffect({ kind: 'heart', x: this.catSpot.x - 4 + i * 4, y: this.catSpot.y - 16 - i * 4 }, resident ? { ...this.catSpot } : undefined, resident ? undefined : MAIN_WALL_PLANE);
  }

  update(dt: number, sim: Sim): void {
    if (this.area === 'kitchen' && !this.overview && this.focusedKitchenHeight !== kitchenHeight()) {
      this.focusedKitchenHeight = kitchenHeight();
      this.camera.moveTo(this.roomFocus());
    }
    this.camera.update(dt);
    if (!this.paused) {
      this.catHappy = Math.max(0, this.catHappy - dt);
      this.catSelectionSeconds = Math.max(0, this.catSelectionSeconds - dt);
      if (this.locatingCat && this.catSelectionSeconds === 0) {
        this.locatingCat = false;
        this.camera.moveTo(this.roomFocus());
      }
    }
    const through = sim.cooks.some((_, i) => {
      const at = sim.cookStation(i);
      const cook = sim.cooks[i];
      return (cook.x > -26 && cook.x < 26 && Math.abs(cook.y - 88) < 14) || (at?.station === 'door' && at.working);
    });
    this.kitchenDoor += ((through ? 1 : 0) - this.kitchenDoor) * Math.min(1, dt * 10);

    this.steamTimer -= dt;
    if (this.steamTimer <= 0) {
      this.steamTimer = 0.3;
      if (sim.baristas.some((_, i) => sim.isBrewing(i))) this.queueEffect({ kind: 'steam', x: MACHINE_X + 8 + Math.random() * 14, y: MACHINE_Y - 9 }, undefined, MAIN_COUNTER_PLANE);
      // Drinks being made at the back bar steam up past the barista's shoulder.
      sim.baristas.forEach((b, i) => {
        const pose = sim.baristaPose(i);
        const c = pose.working && sim.customers.find((c) => c.id === b.customerId);
        if (c && !isBakery(c.order) && Math.random() < 0.5) this.queueEffect({ kind: 'steam', x: pose.x + (Math.random() < 0.5 ? -9 : 7), y: pose.y - 26 }, { x: pose.x, y: pose.y });
      });
      // The bagel pot and the fryer steam while a cook is at them.
      sim.cooks.forEach((_, i) => {
        const at = sim.cookStation(i);
        if (!at?.working || (at.station !== 'kettle' && at.station !== 'fryer')) return;
        const spot = stationSpot(at.station);
        this.effects.push({ kind: 'steam', x: spot.x - 6 + Math.random() * 12, y: areaOrigin('kitchen').y + (at.station === 'kettle' ? 42 : 56) });
      });
      for (const c of sim.customers) {
        if (c.phase === 'sitting' && Math.random() < 0.25) {
          const table = tablePos(Math.floor(c.seat / 2));
          this.queueEffect({ kind: 'steam', x: table.x + (c.seat % 2 === 0 ? -7 : 7), y: table.y - 26 }, table);
        }
      }
    }
  }

  // ------------------------------------------------------------ arranging furniture

  /** The grid cell a piece would go in if dropped with its middle at (x, y). */
  cellAt(id: string, x: number, y: number): { col: number; row: number } {
    const def = furnitureDef(id)!;
    if (def.surface === 'wall' && this.presentedPointer && this.area === 'main') {
      ({ x, y } = unprojectMainPlaneWorld(this.presentedPointer, MAIN_WALL_PLANE));
    }
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
    const point = this.presentedPointer ?? { x, y };
    const hits = state.decor.placed
      .map((p, i) => ({ p, i, def: furnitureDef(p.id) }))
      .filter(({ p, def }) => {
        if (!def) return false;
        let b =
          def.surface === 'wall'
            ? cellRect('wall', p.col, p.row, def.w, def.h)
            : floorFurnitureBounds(p.id, floorAnchor(def, p.col, p.row).cx, floorAnchor(def, p.col, p.row).foot);
        if (this.presentedPointer) {
          if (def.surface === 'wall') {
            const left = projectMainPlaneWorld(b, MAIN_WALL_PLANE);
            const right = projectMainPlaneWorld({ x: b.x + b.w, y: b.y }, MAIN_WALL_PLANE);
            b = { ...b, x: left.x, w: right.x - left.x };
          } else {
            const foot = floorAnchor(def, p.col, p.row);
            b = { ...b, ...projectMainAttachment(b, { x: foot.cx, y: foot.foot }) };
          }
        }
        return point.x >= b.x && point.x < b.x + b.w && point.y >= b.y && point.y < b.y + b.h;
      })
      .sort((a, b) => (b.def!.surface === 'floor' ? b.p.row : -1) - (a.def!.surface === 'floor' ? a.p.row : -1));
    return hits[0]?.i ?? -1;
  }
}
