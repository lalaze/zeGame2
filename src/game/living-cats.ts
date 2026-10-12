import { CELL, furnitureDef } from './furniture';
import { AREA_IDS, activeTableIndices, adjacentArea, areaAtX, areaConnections, isAreaOpen, regionOffset, type AreaId } from './regions';
import { COUNTER, COUNTER_GATE, FLOOR_Y, MAIN_CUPBOARDS, areaAtPoint, areaOrigin, doorwayY, doorPlantSpots, floorY, resizeRoomPoint, roomRoute, sceneHeight, seatApproach, seatSpot, tableArea, tablePos } from './layout';
import { routeFloorSegment, segmentCrossesObstacle, type FloorObstacle, type FloorPoint } from './navigation';
import { petActive, petPreferences, type CatArea, type CatId, type CatPersonality, type Pet } from './pets';
import type { GameState } from './state';

export type CatBehavior = 'patrol' | 'sleep' | 'groom' | 'stretch' | 'watch';
export type CatGuestInteractionPhase = 'approach' | 'nuzzle' | 'response' | 'leave';
export interface CatGuestInteraction { guestId: number; phase: CatGuestInteractionPhase; elapsed: number }
/** Structural, read-only visitor input. Plain floor blockers never become guests. */
export interface CatGuestCandidate extends FloorPoint { id?: number; seat?: number; phase?: string }
interface SeatedGuest extends FloorPoint { id: number; seat: number }
interface GuestBinding { guest: SeatedGuest; origin: FloorPoint; age: number }
export interface LivingCatActor extends FloorPoint {
  id: CatId; area: CatArea; personality: CatPersonality; behavior: CatBehavior;
  remaining: number; elapsed: number; facing: -1 | 1; stride: number;
  affection: number; route: FloorPoint[]; targetKind: 'bed' | 'window' | 'cozy' | 'explore' | 'people';
  resting: boolean;
  interaction?: CatGuestInteraction;
}
export interface CatBlockers { customers?: readonly CatGuestCandidate[]; servers?: readonly FloorPoint[] }
interface Destination extends FloorPoint { area: AreaId; kind: LivingCatActor['targetKind'] }
const CLEARANCE = 4;
const WEIGHTS: Record<CatPersonality, readonly number[]> = {
  playful: [7, 1, 2, 3, 2], quiet: [1, 7, 3, 2, 4], affectionate: [4, 2, 3, 2, 7],
};
const BEHAVIORS: readonly CatBehavior[] = ['patrol', 'sleep', 'groom', 'stretch', 'watch'];
const duration = (b: CatBehavior, random: number) => ({ patrol: 5, sleep: 22, groom: 9, stretch: 4, watch: 12 }[b]) * (0.8 + random * 0.7);
const padded = (r: FloorObstacle): FloorObstacle => ({ x: r.x - CLEARANCE, y: r.y - CLEARANCE, w: r.w + CLEARANCE * 2, h: r.h + CLEARANCE * 2 });

/** Visual companions only: never writes GameState, charges care, reserves seats or blocks service. */
export class LivingCats {
  readonly actors = new Map<CatId, LivingCatActor>();
  private geometry = new Map<AreaId, FloorObstacle[]>();
  private signature = '';
  private height = sceneHeight();
  private arrivals = new Map<CatId, CatBehavior>();
  private preferences = new Map<CatId, string>();
  private reselectAfterArrival = new Set<CatId>();
  private guests = new Map<number, { guest: SeatedGuest; stable: number }>();
  private guestBindings = new Map<CatId, GuestBinding>();
  private guestCooldowns = new Map<CatId, number>();
  private greetedGuests = new Set<number>();
  private guestCooldown = 12;
  private blockedSeconds = new Map<CatId, number>();
  constructor(private readonly random: () => number = Math.random) {}
  reset(): void { this.actors.clear(); this.arrivals.clear(); this.preferences.clear(); this.reselectAfterArrival.clear(); this.signature = ''; this.height = sceneHeight(); this.guests.clear(); this.guestBindings.clear(); this.guestCooldowns.clear(); this.greetedGuests.clear(); this.guestCooldown = 12; this.blockedSeconds.clear(); }
  interact(id: CatId): boolean {
    const actor = this.actors.get(id);
    if (!actor || actor.resting) return false;
    actor.affection = actor.personality === 'affectionate' ? 5 : 3;
    // Keep doorway journeys intact, so a greeting can never strand a cat in a wall.
    if (!actor.route.length) {
      actor.behavior = actor.personality === 'playful' ? 'stretch' : 'watch';
      actor.remaining = duration(actor.behavior, this.random()); actor.elapsed = 0;
    }
    return true;
  }
  furnitureSpaceClear(id: string, col: number, row: number): boolean {
    const def = furnitureDef(id), area = areaAtX(col * CELL);
    if (!def || !area || !Number.isFinite(col) || !Number.isFinite(row)) return false;
    if (def.surface === 'wall') return true;
    const origin = areaOrigin(area), top = floorY(FLOOR_Y + row * CELL);
    const box = padded({ x: origin.x + col * CELL - regionOffset(area), y: origin.y + top,
      w: def.w * CELL, h: floorY(FLOOR_Y + (row + def.h) * CELL) - top });
    return [...this.actors.values()].every((a) => !segmentCrossesObstacle(a, a, box));
  }
  update(state: GameState, dt: number, blockers: CatBlockers = {}): void {
    const changed = this.refresh(state);
    const timeStep = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 60) : 0;
    if (timeStep > 0) this.observeGuests(state, blockers, timeStep);
    for (const id of this.actors.keys()) if (!state.pets.some((p) => p.id === id)) {
      this.actors.delete(id); this.arrivals.delete(id); this.preferences.delete(id); this.reselectAfterArrival.delete(id); this.guestBindings.delete(id); this.guestCooldowns.delete(id); this.blockedSeconds.delete(id);
    }
    for (const pet of state.pets) {
      const prefs = petPreferences(pet);
      let actor = this.actors.get(pet.id);
      if (!actor) {
        const places = this.destinations(state, pet);
        const home = places.find((p) => ![...this.actors.values()].some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 15));
        if (!home) continue;
        actor = { id: pet.id, x: home.x, y: home.y, area: home.area as CatArea, personality: prefs.personality,
          behavior: petActive(pet) ? 'watch' : 'sleep', remaining: 2 + this.actors.size * 2, elapsed: 0, facing: 1, stride: 0,
          affection: 0, route: [], targetKind: home.kind, resting: !petActive(pet) };
        this.actors.set(pet.id, actor);
        this.guestCooldowns.set(pet.id, prefs.personality === 'playful' ? 40 : 12);
      }
      actor.personality = prefs.personality;
      const key = JSON.stringify(prefs), preferenceChanged = this.preferences.has(pet.id) && this.preferences.get(pet.id) !== key;
      this.preferences.set(pet.id, key);
      if (changed) {
        if (actor.targetKind === 'bed' || actor.targetKind === 'window') {
          const destination = actor.route[actor.route.length - 1] ?? actor;
          const stillPresent = this.destinations(state, pet).some((p) => p.kind === actor!.targetKind && Math.hypot(p.x - destination.x, p.y - destination.y) < 2);
          if (!stillPresent) {
            actor.targetKind = actor.route.length ? 'explore' : 'cozy'; actor.remaining = Math.min(actor.remaining, 1);
            if (actor.route.length) {
              // The destination furnishing disappeared. Finish the safe doorway
              // journey to its clear apron, then choose from the new layout.
              this.arrivals.set(actor.id, 'stretch'); this.reselectAfterArrival.add(actor.id);
            }
          }
        }
        if (actor.route.length) {
          const goal = actor.route[actor.route.length - 1];
          actor.route = this.route(actor, goal, state) ?? [];
        }
        // Construction and floor stretching can consume a stationary actor's
        // clearance. Walk out of that newly occupied footprint, never teleport.
        if (!actor.route.length) {
          const area = areaAtPoint(actor.x, actor.y);
          const escape = area && area !== 'kitchen' ? this.escapeMargin(actor, area) : undefined;
          if (escape) { actor.route = [escape]; actor.behavior = 'patrol'; this.arrivals.set(actor.id, 'stretch'); }
        }
      }
      // Arrangement is synchronized during pause. Invalidate the visit now,
      // before dt=0 returns and consumes the geometry-change signal.
      if (changed && actor.interaction) this.cancelGuestInteraction(actor, state);
      if (preferenceChanged && dt > 0) { actor.remaining = 0; if (!actor.route.length) this.choose(actor, pet, state); }
      // Geometry/adoption synchronization is permitted at dt=0, but all clocks and movement freeze.
      if (!Number.isFinite(dt) || dt <= 0) continue;
      actor.affection = Math.max(0, actor.affection - dt);
      if (actor.interaction && (changed || !petActive(pet) || !this.guestStillSeated(actor))) this.cancelGuestInteraction(actor, state);
      if (!petActive(pet)) {
        const newlyEmpty = !actor.resting;
        actor.resting = true; actor.remaining = 30; actor.elapsed += Math.min(dt, 60);
        // Finish an existing doorway journey. If supplies run out in an aisle,
        // walk to the nearest clear resting apron before curling up.
        const origin = areaOrigin(areaAtPoint(actor.x, actor.y) ?? 'main');
        const local = { x: actor.x - origin.x, y: actor.y - origin.y };
        const inPassage = local.x < 20 || local.x > 300 || local.y < FLOOR_Y + 10 ||
          local.y > sceneHeight() - 16 || Math.abs(local.y - floorY(138)) < 10;
        if (newlyEmpty && !actor.route.length && inPassage) {
          const choices = this.destinations(state, pet).filter((p) => (p.kind === 'bed' || p.kind === 'cozy') && this.destinationFree(p, actor!.id))
            .sort((p, q) => Math.hypot(actor!.x - p.x, actor!.y - p.y) - Math.hypot(actor!.x - q.x, actor!.y - q.y));
          for (const p of choices) { const route = this.route(actor, p, state); if (route) { actor.route = route; actor.targetKind = p.kind; break; } }
        }
        this.arrivals.set(actor.id, 'sleep');
        actor.behavior = actor.route.length ? 'patrol' : 'sleep';
        let restTime = Math.min(dt, 60);
        while (actor.route.length && restTime > 1e-8) { const step = Math.min(restTime, 0.1); restTime -= step; this.walk(actor, step, blockers, state); }
        actor.area = this.actorArea(actor);
        continue;
      }
      if (actor.resting) { actor.resting = false; actor.behavior = 'stretch'; actor.remaining = 4; actor.elapsed = 0; }
      if (!actor.interaction) this.maybeGreetGuest(actor, state);
      // Bounded substeps prevent huge background deltas from skipping through a doorway or guest.
      let time = Math.min(dt, 60);
      while (time > 1e-8) {
        const step = Math.min(time, 0.1); time -= step; actor.elapsed += step;
        if (actor.interaction) this.advanceGuestInteraction(actor, state, step, blockers);
        else if (actor.route.length) this.walk(actor, step, blockers, state);
        else {
          actor.remaining -= step;
          if (actor.remaining <= 0) this.choose(actor, pet, state);
        }
      }
      actor.area = this.actorArea(actor);
    }
  }

  private observeGuests(state: GameState, blockers: CatBlockers, dt: number): void {
    this.guestCooldown = Math.max(0, this.guestCooldown - dt);
    for (const [id, time] of this.guestCooldowns) this.guestCooldowns.set(id, Math.max(0, time - dt));
    const tableIds = activeTableIndices(state), seen = new Set<number>();
    for (const candidate of blockers.customers ?? []) {
      const { id, seat, phase } = candidate;
      if (!Number.isInteger(id) || id! < 0 || !Number.isInteger(seat) || seat! < 0 ||
        (phase !== 'sitting' && phase !== 'waiting') || !tableIds.includes(Math.floor(seat! / 2))) continue;
      const position = seatSpot(Math.floor(seat! / 2), seat! % 2 as 0 | 1);
      if (Math.hypot(position.x - candidate.x, position.y - candidate.y) > 1 || !Number.isFinite(candidate.x + candidate.y)) continue;
      seen.add(id!);
      const previous = this.guests.get(id!);
      const stable = previous && previous.guest.seat === seat && Math.hypot(previous.guest.x - candidate.x, previous.guest.y - candidate.y) < 0.1 ? previous.stable + dt : 0;
      this.guests.set(id!, { guest: { id: id!, seat: seat!, x: candidate.x, y: candidate.y }, stable });
    }
    for (const id of this.guests.keys()) if (!seen.has(id)) this.guests.delete(id);
    for (const id of this.greetedGuests) if (!seen.has(id)) this.greetedGuests.delete(id);
  }
  private guestStillSeated(actor: LivingCatActor): boolean {
    const binding = this.guestBindings.get(actor.id), current = binding && this.guests.get(binding.guest.id);
    return !!binding && !!current && current.guest.seat === binding.guest.seat &&
      Math.hypot(current.guest.x - binding.guest.x, current.guest.y - binding.guest.y) < 0.1;
  }
  private maybeGreetGuest(actor: LivingCatActor, state: GameState): void {
    if (actor.personality === 'quiet' || actor.resting || actor.route.length || actor.behavior === 'sleep' ||
      this.guestBindings.size || this.guestCooldown > 0 || (this.guestCooldowns.get(actor.id) ?? 0) > 0) return;
    // Retry on a sparse clock, not every frame, so frame rate cannot increase sociability.
    this.guestCooldowns.set(actor.id, actor.personality === 'affectionate' ? 8 : 20);
    if (this.random() >= (actor.personality === 'affectionate' ? 0.8 : 0.2)) return;
    const guests = [...this.guests.values()].filter(({ guest, stable }) => stable >= 1.5 &&
      !this.greetedGuests.has(guest.id) && tableArea(Math.floor(guest.seat / 2)) === this.actorArea(actor));
    guests.sort((a, b) => Math.hypot(a.guest.x - actor.x, a.guest.y - actor.y) - Math.hypot(b.guest.x - actor.x, b.guest.y - actor.y));
    for (const { guest } of guests) {
      const approach = seatApproach(Math.floor(guest.seat / 2), guest.seat % 2 as 0 | 1);
      const target = { ...approach };
      if (!this.destinationFree(target, actor.id)) continue;
      const route = this.route(actor, target, state);
      if (!route || !route.length || route.some((p) => areaAtPoint(p.x, p.y) !== this.actorArea(actor))) continue;
      let distance = 0, previous: FloorPoint = actor;
      for (const p of route) { distance += Math.hypot(p.x - previous.x, p.y - previous.y); previous = p; }
      if (distance > 150) continue;
      this.guestBindings.set(actor.id, { guest: { ...guest }, origin: { x: actor.x, y: actor.y }, age: 0 });
      actor.interaction = { guestId: guest.id, phase: 'approach', elapsed: 0 };
      actor.route = route; actor.behavior = 'patrol'; actor.targetKind = 'people';
      this.arrivals.set(actor.id, 'watch');
      this.greetedGuests.add(guest.id);
      this.guestCooldowns.set(actor.id, actor.personality === 'affectionate' ? 45 : 100);
      return;
    }
  }
  private guestRetreat(actor: LivingCatActor, binding: GuestBinding, state: GameState): FloorPoint[] | null {
    const pet = state.pets.find((p) => p.id === actor.id);
    const destinations: FloorPoint[] = [binding.origin, ...(pet ? this.destinations(state, pet).filter((p) => p.area === this.actorArea(actor)) : [])];
    for (const destination of destinations) {
      if (!this.destinationFree(destination, actor.id)) continue;
      const route = this.route(actor, destination, state);
      if (route) return route;
    }
    return null;
  }
  private cancelGuestInteraction(actor: LivingCatActor, state: GameState): void {
    const binding = this.guestBindings.get(actor.id);
    delete actor.interaction; this.guestBindings.delete(actor.id);
    this.guestCooldown = 24;
    // Visits are room-local. Return along a newly validated route rather than
    // following a departing customer or retaining a stale furnishing route.
    const retreat = binding && this.guestRetreat(actor, binding, state);
    const escape = !retreat && this.escapeMargin(actor, this.actorArea(actor));
    actor.route = retreat ?? (escape ? [escape] : []);
    actor.behavior = actor.route.length ? 'patrol' : 'watch'; actor.remaining = 3; actor.elapsed = 0;
    this.arrivals.set(actor.id, 'watch');
  }
  private advanceGuestInteraction(actor: LivingCatActor, state: GameState, dt: number, blockers: CatBlockers): void {
    const interaction = actor.interaction!, binding = this.guestBindings.get(actor.id);
    if (!binding) { delete actor.interaction; return; }
    binding.age += dt; interaction.elapsed += dt;
    if (binding.age > 28 || (interaction.phase === 'approach' && interaction.elapsed > 10)) { this.cancelGuestInteraction(actor, state); return; }
    if (interaction.phase === 'approach' || interaction.phase === 'leave') {
      if (actor.route.length) this.walk(actor, dt, blockers, state);
      // A blocked approach can cancel its own binding while planning retreat.
      if (actor.interaction !== interaction) return;
      if (actor.route.length) return;
      if (interaction.phase === 'leave') {
        delete actor.interaction; this.guestBindings.delete(actor.id); this.guestCooldown = 24;
        actor.behavior = 'watch'; actor.remaining = 4; return;
      }
      const target = seatApproach(Math.floor(binding.guest.seat / 2), binding.guest.seat % 2 as 0 | 1);
      if (Math.hypot(actor.x - target.x, actor.y - target.y) > 0.5) { this.cancelGuestInteraction(actor, state); return; }
      interaction.phase = 'nuzzle'; interaction.elapsed = 0; actor.behavior = 'watch'; actor.elapsed = 0;
      actor.facing = binding.guest.seat % 2 === 0 ? 1 : -1; return;
    }
    actor.behavior = 'watch';
    if (interaction.phase === 'nuzzle' && interaction.elapsed >= 2) {
      interaction.phase = 'response'; interaction.elapsed = 0; actor.affection = 2; return;
    }
    if (interaction.phase === 'response' && interaction.elapsed >= 3) {
      const route = this.guestRetreat(actor, binding, state);
      if (!route) { this.cancelGuestInteraction(actor, state); return; }
      actor.route = route; actor.behavior = 'patrol'; interaction.phase = 'leave'; interaction.elapsed = 0;
      this.arrivals.set(actor.id, 'watch');
    }
  }
  private actorArea(actor: LivingCatActor): CatArea {
    const area = areaAtPoint(actor.x, actor.y);
    return area && area !== 'kitchen' ? area : actor.area;
  }
  private refresh(state: GameState): boolean {
    const H = sceneHeight();
    if (this.height !== H) {
      for (const binding of this.guestBindings.values()) binding.origin = resizeRoomPoint(binding.origin, this.height);
      for (const a of this.actors.values()) { Object.assign(a, resizeRoomPoint(a, this.height)); a.route = a.route.map((p) => resizeRoomPoint(p, this.height)); }
      this.height = H;
    }
    const tables = activeTableIndices(state);
    const signature = JSON.stringify([H, state.regions, tables, state.decor.placed]);
    if (signature === this.signature) return false;
    this.signature = signature;
    this.geometry = new Map(AREA_IDS.map((area) => [area, []]));
    for (const area of AREA_IDS) {
      const o = areaOrigin(area), boxes = this.geometry.get(area)!;
      if (area === 'main') boxes.push({ x: COUNTER.x, y: FLOOR_Y, w: COUNTER.w + COUNTER_GATE.w, h: COUNTER.bottom - FLOOR_Y },
        ...MAIN_CUPBOARDS, ...doorPlantSpots().map((p) => ({ x: p.x - 5, y: p.y - 4, w: 10, h: 6 })));
      if (adjacentArea(area, 'up')) boxes.push({ x: o.x, y: o.y, w: 142, h: FLOOR_Y }, { x: o.x + 178, y: o.y, w: 142, h: FLOOR_Y });
    }
    for (const i of tables) { const p = tablePos(i); this.geometry.get(tableArea(i))!.push({ x: p.x - 23, y: p.y - 10, w: 46, h: 13 }); }
    for (const p of state.decor.placed) {
      const d = furnitureDef(p.id), area = areaAtX(p.col * CELL);
      if (!d || !area || d.surface !== 'floor') continue;
      const o = areaOrigin(area), y = floorY(FLOOR_Y + p.row * CELL);
      this.geometry.get(area)!.push({ x: o.x + p.col * CELL - regionOffset(area), y: o.y + y, w: d.w * CELL, h: floorY(FLOOR_Y + (p.row + d.h) * CELL) - y });
    }
    return true;
  }
  private destinations(state: GameState, pet: Pet): Destination[] {
    const prefs = petPreferences(pet);
    const result: Destination[] = [];
    const add = (area: AreaId, x: number, y: number, kind: Destination['kind']) => {
      const o = areaOrigin(area), p = { area, x: o.x + x, y: o.y + y, kind };
      if (area === 'kitchen' || !isAreaOpen(state, area) || x < 9 || x > 311 || y < FLOOR_Y + 8 || y > sceneHeight() - 12) return;
      if (!(this.geometry.get(area) ?? []).some((r) => segmentCrossesObstacle(p, p, padded(r)))) result.push(p);
    };
    for (const p of state.decor.placed) {
      const area = areaAtX(p.col * CELL);
      if (p.id === 'catbed' && area) add(area, p.col * CELL - regionOffset(area) + 8, floorY(FLOOR_Y + (p.row + 1) * CELL) + 8, 'bed');
    }
    for (const area of AREA_IDS) {
      add(area, 26, floorY(112), 'window'); add(area, 294, floorY(120), 'window');
      for (const x of [26, 66, 194, 294]) add(area, x, floorY(200), 'cozy');
      for (const x of [50, 130, 190, 270]) add(area, x, floorY(145), 'explore');
      add(area, 130, floorY(192), 'people'); add(area, 190, floorY(192), 'people');
    }
    const rank = (p: Destination) => (p.area === prefs.preferredArea ? 8 : 0) + (p.kind === prefs.preferredSpot ? 4 : 0) + (p.kind === 'bed' ? 2 : 0);
    return result.sort((a, b) => rank(b) - rank(a));
  }
  private escapeMargin(point: FloorPoint, area: AreaId, extra: readonly FloorObstacle[] = []): FloorPoint | undefined {
    const boxes = [...(this.geometry.get(area) ?? []), ...extra], expanded = boxes.map(padded);
    if (!expanded.some((r) => segmentCrossesObstacle(point, point, r))) return undefined;
    const origin = areaOrigin(area);
    const candidates = expanded.flatMap((r) => [
      { x: r.x - 0.01, y: point.y }, { x: r.x + r.w + 0.01, y: point.y },
      { x: point.x, y: r.y - 0.01 }, { x: point.x, y: r.y + r.h + 0.01 },
    ]).filter((p) => p.x >= origin.x + 5 && p.x <= origin.x + 315 &&
      p.y >= origin.y + FLOOR_Y + 5 && p.y <= origin.y + sceneHeight() - 8 &&
      !expanded.some((r) => segmentCrossesObstacle(p, p, r)) &&
      !expanded.some((r) => segmentCrossesObstacle(point, p, r) && !segmentCrossesObstacle(point, point, r)));
    candidates.sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y));
    return candidates[0];
  }
  private route(from: FloorPoint, goal: FloorPoint, state: GameState, dynamic = new Map<AreaId, FloorObstacle[]>()): FloorPoint[] | null {
    const a = areaAtPoint(from.x, from.y), b = areaAtPoint(goal.x, goal.y);
    if (!a || !b || a === 'kitchen' || b === 'kitchen' || !isAreaOpen(state, b)) return null;
    const stops = [...roomRoute(a, b), goal], route: FloorPoint[] = [];
    let previous = from;
    for (const target of stops) {
      const sourceArea = areaAtPoint(previous.x, previous.y), targetArea = areaAtPoint(target.x, target.y);
      if (!sourceArea || !targetArea || !isAreaOpen(state, targetArea) || targetArea === 'kitchen') return null;
      if (sourceArea !== targetArea) {
        const link = areaConnections(sourceArea).find((p) => p.to === targetArea);
        if (!link) return null;
        const o = areaOrigin(sourceArea);
        const horizontal = link.direction === 'left' || link.direction === 'right';
        const boundary = horizontal ? o.x + (link.direction === 'right' ? 320 : 0) : o.y + (link.direction === 'down' ? sceneHeight() : 0);
        if (horizontal ? Math.abs(previous.y - o.y - doorwayY(sourceArea, link.direction)) > 0.01 || Math.abs(target.y - previous.y) > 0.01 || Math.abs(previous.x - boundary) > 12.01 || Math.abs(target.x - boundary) > 12.01
          : Math.abs(previous.x - o.x - 160) > 0.01 || Math.abs(target.x - previous.x) > 0.01 || Math.abs(previous.y - boundary) > 12.01 || Math.abs(target.y - boundary) > 12.01) return null;
        route.push(target);
      } else {
        const o = areaOrigin(sourceArea), top = adjacentArea(sourceArea, 'up') ? 0 : FLOOR_Y;
        const segment = routeFloorSegment(previous, target, [...(this.geometry.get(sourceArea) ?? []), ...(dynamic.get(sourceArea) ?? [])], { clearance: CLEARANCE, startApproach: this.escapeMargin(previous, sourceArea, dynamic.get(sourceArea)), bounds: { x: o.x, y: o.y + top, w: 320, h: sceneHeight() - top } });
        if (!segment) return null;
        route.push(...segment);
      }
      previous = target;
    }
    return route.length <= 100 ? route : null;
  }
  private destinationFree(point: FloorPoint, id: CatId): boolean {
    return [...this.actors.values()].every((other) => {
      if (other.id === id) return true;
      const destination = other.route[other.route.length - 1] ?? other;
      return Math.hypot(destination.x - point.x, destination.y - point.y) >= 14 &&
        Math.hypot(other.x - point.x, other.y - point.y) >= 14;
    });
  }
  private choose(a: LivingCatActor, pet: Pet, state: GameState): void {
    const weights = WEIGHTS[a.personality];
    let value = Math.max(0, Math.min(0.999999, this.random())) * weights.reduce((n, w) => n + w, 0), index = 0;
    while (index < weights.length - 1 && (value -= weights[index]) >= 0) index++;
    let behavior = BEHAVIORS[index];
    if (behavior === a.behavior && behavior !== 'patrol') behavior = 'stretch';
    a.elapsed = 0; a.remaining = duration(behavior, this.random()) * (a.personality === 'quiet' && behavior === 'sleep' ? 2 : 1);
    const choices = this.destinations(state, pet).filter((p) => this.destinationFree(p, a.id));
    const availableBed = choices.some((p) => p.kind === 'bed');
    // Grooming and stretching happen where the cat settled. Quiet companions
    // also watch locally rather than making a trip for every idle transition.
    if (behavior === 'groom' || behavior === 'stretch' || (behavior === 'watch' && a.personality === 'quiet' && a.targetKind === 'window') || (behavior === 'sleep' && (a.targetKind === 'bed' || (a.targetKind === 'cozy' && !availableBed)))) {
      a.behavior = behavior; return;
    }
    // Quiet cats linger locally; playful cats roam; affectionate cats watch from an aisle apron.
    const watchPeople = a.personality === 'affectionate' && petPreferences(pet).preferredSpot !== 'window' && this.random() < 0.7;
    const areaChoices = a.personality === 'quiet' && choices.some((p) => p.area === petPreferences(pet).preferredArea) ? choices.filter((p) => p.area === petPreferences(pet).preferredArea) : choices;
    const preferred = areaChoices.filter((p) => behavior === 'sleep' ? (availableBed ? p.kind === 'bed' : p.kind === 'cozy')
      : behavior === 'watch' ? p.kind === (watchPeople ? 'people' : 'window')
      : a.personality === 'quiet' ? p.area === petPreferences(pet).preferredArea : true);
    const candidates = preferred.length ? [...preferred, ...choices.filter((p) => !preferred.includes(p))] : choices;
    const primaryCount = preferred.length || candidates.length;
    const start = Math.floor(this.random() * Math.min(primaryCount, behavior === 'sleep' && availableBed ? 1 : a.personality === 'playful' ? primaryCount : 4));
    for (let i = 0; i < candidates.length; i++) {
      const destination = candidates[i < primaryCount ? (start + i) % primaryCount : i];
      if (Math.hypot(a.x - destination.x, a.y - destination.y) < 12) continue;
      const route = this.route(a, destination, state);
      if (!route) continue;
      a.route = route; a.targetKind = destination.kind; a.behavior = 'patrol'; this.arrivals.set(a.id, behavior === 'patrol' ? 'watch' : behavior); return;
    }
    a.behavior = behavior === 'patrol' ? 'watch' : behavior;
  }
  private dynamicObstacles(blockers: CatBlockers): Map<AreaId, FloorObstacle[]> {
    const result = new Map<AreaId, FloorObstacle[]>();
    for (const b of [...(blockers.customers ?? []), ...(blockers.servers ?? [])]) {
      const area = areaAtPoint(b.x, b.y);
      if (!area || area === 'kitchen' || !Number.isFinite(b.x + b.y)) continue;
      // The normal 4px planner clearance expands this 10px square to the
      // same 9px personal space used by walking. Corners are conservative.
      const boxes = result.get(area) ?? [];
      boxes.push({ x: b.x - 5, y: b.y - 5, w: 10, h: 10 }); result.set(area, boxes);
    }
    return result;
  }
  private inPassage(a: FloorPoint): boolean {
    const area = areaAtPoint(a.x, a.y);
    if (!area || area === 'kitchen') return true;
    const o = areaOrigin(area), x = a.x - o.x, y = a.y - o.y;
    return x < 20 || x > 300 || y < FLOOR_Y + 10 || y > sceneHeight() - 16 || Math.abs(y - floorY(138)) < 10;
  }
  private recoverBlockedWalk(a: LivingCatActor, state: GameState, blockers: CatBlockers): void {
    this.blockedSeconds.set(a.id, 0);
    const dynamic = this.dynamicObstacles(blockers), goal = a.route[a.route.length - 1];
    // Keep a social approach tied to its exact seat apron. If it is no longer
    // reachable, cancel before trying an ordinary fallback destination.
    if (a.interaction) {
      const route = goal && this.route(a, goal, state, dynamic);
      if (route?.length) { a.route = route; return; }
      this.cancelGuestInteraction(a, state);
    }
    if (!a.resting && goal) {
      const route = this.route(a, goal, state, dynamic);
      if (route?.length) { a.route = route; return; }
    }
    const pet = state.pets.find((p) => p.id === a.id);
    const candidates = pet ? this.destinations(state, pet).filter((p) => p.area === this.actorArea(a) &&
      (!a.resting || p.kind === 'bed' || p.kind === 'cozy') && this.destinationFree(p, a.id)) : [];
    candidates.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
    for (const candidate of candidates) {
      if (Math.hypot(candidate.x - a.x, candidate.y - a.y) < 2 || this.inPassage(candidate)) continue;
      const route = this.route(a, candidate, state, dynamic);
      if (!route?.length) continue;
      a.route = route; a.targetKind = candidate.kind; a.behavior = 'patrol';
      this.arrivals.set(a.id, a.resting ? 'sleep' : 'watch'); return;
    }
    // A settled clear floor point is a valid last resort, but never curl up
    // in a doorway, on furniture, or inside a person's personal space.
    const area = this.actorArea(a), boxes = [...(this.geometry.get(area) ?? []), ...(dynamic.get(area) ?? [])];
    if (!this.inPassage(a) && !boxes.some((r) => segmentCrossesObstacle(a, a, padded(r)))) {
      a.route = []; a.behavior = a.resting ? 'sleep' : 'watch'; a.remaining = 4; a.elapsed = 0;
      this.arrivals.delete(a.id);
    }
  }
  private walk(a: LivingCatActor, dt: number, blockers: CatBlockers, state: GameState): void {
    const target = a.route[0], dx = target.x - a.x, dy = target.y - a.y, distance = Math.hypot(dx, dy);
    const step = Math.min(distance, dt * (a.personality === 'playful' ? 25 : a.personality === 'quiet' ? 15 : 20));
    const p = distance < 1e-8 ? target : { x: a.x + dx / distance * step, y: a.y + dy / distance * step };
    // Yield without changing the service simulation or trapping guests behind a solid cat.
    if ([...(blockers.customers ?? []), ...(blockers.servers ?? [])].some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 9 && Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(b.x - a.x, b.y - a.y))) {
      const blocked = (this.blockedSeconds.get(a.id) ?? 0) + dt;
      this.blockedSeconds.set(a.id, blocked);
      if (blocked >= (a.resting ? 1 : 2)) this.recoverBlockedWalk(a, state, blockers);
      return;
    }
    if (step > 1e-8) this.blockedSeconds.set(a.id, 0);
    if (Math.abs(dx) > 0.01) a.facing = dx < 0 ? -1 : 1;
    a.x = p.x; a.y = p.y; a.stride += step;
    if (distance <= step + 1e-8) a.route.shift();
    if (!a.route.length) { a.behavior = this.arrivals.get(a.id) ?? 'watch'; a.remaining = duration(a.behavior, this.random()) * (a.personality === 'quiet' && a.behavior === 'sleep' ? 2 : 1); a.elapsed = 0; this.arrivals.delete(a.id);
      if (this.reselectAfterArrival.delete(a.id)) { a.behavior = 'stretch'; a.remaining = 0.1; }
      if (a.resting && this.inPassage(a)) this.recoverBlockedWalk(a, state, blockers);
    }
  }
}
