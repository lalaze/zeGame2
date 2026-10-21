import { syncPartners, activePartner, recordPartnerWork, partnerServerSpeed, partnerTraySize, partnerBrewMultiplier, partnerCookSpeed, partnerStationTime } from './partners';
import { conditionSeating, menuWeights, weightedIndex } from './conditions';
import { recordStyleHandoff, styleOrderPairs, styleComboChance, styleSeatChance, styleStationMultiplier, styleDwellExtra, styleServerMultiplier } from './styles';
import { recordRegularGuestArrival, recordRegularGuestDeparture, recordRegularGuestService, regularGuestForAppearance, regularGuestOrder } from './regular-guests';
import { CUSTOMER_CAST, CustomerCastCycle } from './customer-cast';
import { updatePromotion } from './promotion';
import { updatePetCare } from './pets';
import { DAY_SECONDS, MAX_QUEUE, PASS_SLOTS, RING_AGAIN, VIP_CHANCE, type ItemId } from './data';
import { finishDay, type DayReport } from './day';
import { CELL, furnitureDef } from './furniture';
import { routeFloorSegment, segmentCrossesObstacle, type FloorObstacle, type FloorPoint } from './navigation';
import {
  arrivalRate,
  isBakery,
  baristaCount,
  consumeServing,
  canPrepareItem,
  cookCount,
  earn,
  hasServiceSupply,
  menuItems,
  patienceSeconds,
  prepTime,
  salePrice,
  serverCount,
  tablePatience,
} from './economy';
import {
  PASS_BELL,
  COUNTER,
  COUNTER_GATE,
  FLOOR_Y,
  MAIN_CUPBOARDS,
  SCENE_W,
  TOTAL_TABLE_SPOTS,
  TABLE_HALF_WIDTH,
  areaAtPoint,
  areaOrigin,
  baristaSpot,
  baristaWorkSpot,
  doorSpot,
  doorPlantSpots,
  floorY,
  doorwayY,
  kitchenFloorY,
  setKitchenLevel,
  passSpot,
  queueSpot,
  resizeRoomPoint,
  roomRoute,
  sceneHeight,
  seatApproach,
  seatSpot,
  serverHome,
  serviceSpot,
  tableArea,
  tableFootprint,
  tablePos,
  tablePosAtHeight,
} from './layout';
import { batchSteps, cookHome, kitchenPath, nextBatch, shelveBatch, startBatch, stationSpot, kitchenObstacles, STATION_SECONDS, type Station } from './kitchen';
import { AREA_IDS, activeTableIndices, adjacentArea, areaAtX, areaConnections, regionOffset, type AreaId } from './regions';
import type { GameState, Look } from './state';
import { validSnapshot, type SimSnapshot } from './sim-snapshot';

import { recordReview, mealReview, type ReviewInput } from './reputation';
import { recordServings } from './taste';
import { integratedTrafficSeconds } from './traffic';

export type { Look };

/**
 * A customer's visit. Takeaway: queue, walk up, order, wait at the counter, leave
 * with it. Dining in: order, take a seat ('toSeat'), wait for a server to bring the
 * order over ('waiting'), then eat ('sitting') and leave.
 */
export type CustomerPhase = 'queue' | 'toCounter' | 'ordering' | 'toSeat' | 'waiting' | 'sitting' | 'exiting';

/** Anyone who walks: a position, where they're heading, and the stops after that. */
export interface Walker {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Distance walked, drives the walk animation. */
  stride: number;
  /** Points still to walk through after reaching the current target. */
  via: { x: number; y: number }[];
  /** A blocked route waits for the floor plan to change; it must not count as arrival. */
  pathBlocked?: boolean;
  /** Remaining semantic stops, separate from generated obstacle-corner waypoints. */
  journey?: FloorPoint[];
}

export interface Customer extends Walker {
  /** One review per visit, persisted with in-flight orders. */
  reviewed: boolean;
  waitSeconds: number;
  missingExtra: boolean;
  id: number;
  phase: CustomerPhase;
  /** Visual cast identity, kept with the live visit when service is saved. */
  appearanceId?: number;
  /** Narrative identity is fixed at arrival, never inferred for an older live visit. */
  regularGuestId?: string;
  regularGuestVisitId?: number;
  look: Look;
  order: ItemId;
  /** A bakery item with a drink, or a drink with a bakery item. */
  extra: ItemId | null;
  vip: boolean;
  patience: number;
  spot: number;
  seat: number;
  timer: number;
  mood: 'happy' | 'sad' | null;
  moodTimer: number;
  hasCup: boolean;
  /** Their order was sold out; they leave without buying. */
  soldOut: boolean;
  /** Having it at a table, brought over by a server, rather than to take away. */
  dineIn: boolean;
  /** Extra share of the bill for a moment the player answered (a recommendation or a greeting). */
  momentTip?: number;
}

export interface Barista {
  partnerId?: string;
  /** Persisted with the in-flight job; a full pass must not reward again. */
  brewCredited?: boolean;
  look: Look;
  customerId: number | null;
  remaining: number;
  total: number;
  /** Seconds left on their "order up!" call for a server. */
  calling: number;
}

/** A finished table order waiting on the pass, and the server coming for it. */
export interface Plate {
  customerId: number;
  items: ItemId[];
  /** The barista who made it, who calls for a server. */
  barista: number;
  /** The server who has taken it on, or null while it waits for one. */
  server: number | null;
  /** Seconds since the bell last rang for it. */
  waited: number;
}

/** A batch a cook is baking: the stations it visits in turn, and seconds left at the current one. */
export interface Batch {
  item: ItemId;
  n: number;
  steps: Station[];
  step: number;
  timer: number;
}

/** A cook in the kitchen, free or seeing a batch through. */
export interface Cook extends Walker {
  partnerId?: string;
  look: Look;
  batch: Batch | null;
}

/** Idle by the pass, heading to it, carrying a plate out, or walking back. */
export type ServerPhase = 'idle' | 'toPass' | 'delivering' | 'returning';

export interface Server extends Walker {
  partnerId?: string;
  look: Look;
  phase: ServerPhase;
  /** Orders they're fetching or carrying: one, or two bound for the same room. */
  plates: Plate[];
  /** Seconds left showing that they heard the bell. */
  ack: number;
}

export type SimEvent =
  /** `customerId` names the paying visit so the renderer can anchor the pop-up on them. */
  | { type: 'sale'; amount: number; x: number; y: number; vip: boolean; customerId?: number }
  | { type: 'bell'; x: number; y: number }
  | { type: 'walkout'; x: number; y: number }
  | { type: 'soldout'; item: ItemId; x: number; y: number }
  | { type: 'restock'; item: ItemId; n: number };

export const WALK_SPEED = 62;
/** Servers walk briskly. */
export const SERVER_SPEED = WALK_SPEED * 1.5;
/** A tray holds this many orders, delivered nearest room first. */
const TRAY_PLATES = 3;
const BOOST_SECONDS = 0.3;
/** How long a dine-in customer stands at the counter ordering before taking a seat. */
const ORDER_SECONDS = 0.8;
const CALL_SECONDS = 1.4;
const WALK_CLEARANCE = 8;

export class Sim {
  customers: Customer[] = [];
  baristas: Barista[] = [];
  /** Customer ids waiting in line, front first. */
  queue: number[] = [];
  /** Customer id occupying each seat (2 per table). */
  seats: (number | null)[] = [];
  servers: Server[] = [];
  /** Table orders on the pass, oldest first. */
  pass: Plate[] = [];
  cooks: Cook[] = [];
  /** The last few batches out of the oven, newest first, cooling on the rack by the kitchen door. */
  rack: ItemId[] = [];
  private spawnTimer = 1.5;
  private nextId = 1;
  private customerCast: CustomerCastCycle;
  private castRandomState = 1;
  private floorState: GameState | null = null;
  private navigationSignature = '';
  private kitchenStage = -1;
  private navigationTables: number[] = [];
  private navigationObstacles = new Map<AreaId, FloorObstacle[]>();
  private boostCooldown = 0;

  constructor(private rng: () => number = Math.random) {
    this.customerCast = new CustomerCastCycle(() => {
      this.castRandomState = (Math.imul(this.castRandomState, 1664525) + 1013904223) >>> 0;
      return this.castRandomState / 2 ** 32;
    });
  }

  /** A new café starts with no staff jobs, customer visits, or cached routes. */
  reset(): void {
    this.customers = []; this.baristas = []; this.queue = []; this.seats = [];
    this.servers = []; this.pass = []; this.cooks = []; this.rack = [];
    this.spawnTimer = 1.5; this.nextId = 1; this.boostCooldown = 0;
    this.castRandomState = 1;
    this.customerCast = new CustomerCastCycle(() => {
      this.castRandomState = (Math.imul(this.castRandomState, 1664525) + 1013904223) >>> 0;
      return this.castRandomState / 2 ** 32;
    });
    this.floorState = null; this.navigationSignature = ''; this.kitchenStage = -1;
    this.navigationTables = []; this.navigationObstacles.clear();
    setKitchenLevel(0);
  }

  snapshot(state: GameState): SimSnapshot {
    // Capture routes and cook positions against the same layout as the economic save.
    this.sync(state);
    return structuredClone({
      version: 2, kitchenLevel: this.kitchenStage, day: state.day, phase: state.phase, served: state.today.served, height: sceneHeight(),
      customers: this.customers, baristas: this.baristas, servers: this.servers, cooks: this.cooks,
      queue: this.queue, seats: this.seats, pass: this.pass, rack: this.rack,
      spawnTimer: this.spawnTimer, nextId: this.nextId, boostCooldown: this.boostCooldown,
      customerCast: this.customerCast.snapshot(), castRandomState: this.castRandomState,
    });
  }

  restore(raw: unknown, state: GameState): boolean {
    if (!validSnapshot(raw, state)) return false;
    const saved = structuredClone(raw);
    saved.kitchenLevel = state.kitchen ? state.upgrades.cook : 0;
    setKitchenLevel(saved.kitchenLevel);
    if (saved.version === 1) {
      // v1 used a different counter, kitchen footprint and unchecked straight
      // paths. Migrate visits and paid work at safe semantic anchors rather than
      // replaying obsolete coordinates or discarding already-consumed stock.
      const place = (w: Walker, point: FloorPoint) => {
        w.x = w.tx = point.x; w.y = w.ty = point.y;
        w.via = []; w.journey = []; w.pathBlocked = false;
      };
      for (const c of saved.customers) {
        const point = seated(c) && c.seat >= 0 ? seatSpot(Math.floor(c.seat / 2), c.seat % 2 as 0 | 1)
          : c.phase === 'queue' ? queueSpot(saved.queue.indexOf(c.id))
          : c.phase === 'exiting' ? doorSpot()
          : c.phase === 'toCounter' ? queueSpot(0)
          : serviceSpot(Math.max(0, c.spot));
        place(c, point);
      }
      saved.servers.forEach((server, i) => place(server, server.phase === 'delivering' ? passSpot() : serverHome(i)));
      saved.cooks.forEach((cook, i) => place(cook, cook.batch ? stationSpot(cook.batch.steps[cook.batch.step]) : cookHome(i)));
      saved.height = sceneHeight();
    }
    // A layout-incompatible runtime is discarded atomically; economic progress
    // remains valid. Do not carry old coordinates through counters or appliances.
    const geometry = new Sim(this.rng);
    geometry.refreshNavigation(state, false);
    const guestPositionClear = (w: Walker) => {
      const p = resizeRoomPoint(w, saved.height);
      if (Math.abs(p.x - 160) < 0.001 && p.y >= sceneHeight() - 8 && p.y <= sceneHeight() + 12) return true;
      const area = areaAtPoint(p.x, p.y);
      if (!area || area === 'kitchen' || area !== 'main' && !state.regions.includes(area)) return false;
      if (geometry.chairApproach(p, false)) return true;
      return !(geometry.navigationObstacles.get(area) ?? []).some((r) => segmentCrossesObstacle(p, p, r));
    };
    if ([...saved.customers, ...saved.servers].some((w) => !guestPositionClear(w))) return false;
    if (saved.cooks.some((w) => {
      if (w.x >= -12 && w.x <= 202 && Math.abs(w.y - doorwayY('main', 'left')) < 0.001) return false;
      const area = areaAtPoint(w.x, w.y);
      return area !== 'kitchen' || kitchenObstacles().some((r) => segmentCrossesObstacle(w, w, r));
    })) return false;
    let cookRoutes: FloorPoint[][];
    try {
      cookRoutes = saved.cooks.map((cook, i) => kitchenPath(cook,
        cook.batch ? stationSpot(cook.batch.steps[cook.batch.step]) : cookHome(i)));
    } catch {
      return false;
    }
    this.customers = saved.customers.map((c) => ({
      ...c,
      reviewed: c.reviewed ?? (c.hasCup || c.soldOut || c.phase === 'sitting' || c.phase === 'exiting'),
      waitSeconds: c.waitSeconds ?? 0,
      missingExtra: c.missingExtra ?? false,
    }));
    this.baristas = saved.baristas;
    this.servers = saved.servers;
    this.cooks = saved.cooks;
    this.queue = saved.queue;
    this.seats = saved.seats;
    this.pass = saved.pass;
    this.rack = saved.rack;
    this.spawnTimer = saved.spawnTimer;
    this.nextId = saved.nextId;
    this.boostCooldown = saved.boostCooldown;
    this.castRandomState = saved.version === 1 ? 1 : saved.castRandomState;
    if (saved.version === 1) {
      const known = saved.customers.flatMap((c) => c.appearanceId === undefined ? [] : [c.appearanceId]);
      this.customerCast.restore({
        remaining: known.length ? CUSTOMER_CAST.map((c) => c.id).filter((id) => !known.includes(id)) : [],
        previous: known.at(-1) ?? -1,
      });
    } else this.customerCast.restore(saved.customerCast);
    // JSON duplicates tray objects that also live on the pass. Restore shared identity.
    for (const server of this.servers) server.plates = server.plates.map((p) => this.pass.find((plate) => plate.customerId === p.customerId) ?? p);
    this.kitchenStage = saved.kitchenLevel;
    this.navigationSignature = '';
    this.refreshNavigation(state, false);
    // Rebuild semantic destinations against the current viewport and furniture;
    // never trust saved obstacle-corner waypoints from a stale arrangement.
    this.resizeScene(saved.height);
    for (const [i, cook] of this.cooks.entries()) this.walk(cook, ...cookRoutes[i]);
    state.inProduction = {};
    for (const cook of this.cooks) if (cook.batch) state.inProduction[cook.batch.item] = (state.inProduction[cook.batch.item] ?? 0) + cook.batch.n;
    return true;
  }

  beginClosing(state: GameState): void {
    if (state.phase !== 'open') return;
    state.phase = 'closing';
    for (const c of this.customers) if (c.phase === 'queue') this.exit(c);
    this.queue = [];
  }

  get finishedService(): boolean {
    return !this.customers.some((c) => !['sitting', 'exiting'].includes(c.phase)) && !this.cooks.some((c) => c.batch);
  }

  resizeScene(fromHeight: number): void {
    const move = (w: Walker) => {
      const position = resizeRoomPoint(w, fromHeight);
      // Floor stretching must not squeeze an ordinary aisle into a chair's
      // fixed-depth footprint. Preserve the side of each table the walker was on.
      for (const table of this.navigationTables) {
        if (tableArea(table) !== areaAtPoint(w.x, w.y, fromHeight)) continue;
        const before = tablePosAtHeight(table, fromHeight), after = tablePos(table);
        if (Math.abs(w.x - before.x) >= TABLE_HALF_WIDTH + WALK_CLEARANCE) continue;
        if (w.y <= before.y - 10 - WALK_CLEARANCE) position.y = Math.min(position.y, after.y - 10 - WALK_CLEARANCE);
        else if (w.y >= before.y + 3 + WALK_CLEARANCE) position.y = Math.max(position.y, after.y + 3 + WALK_CLEARANCE);
      }
      const target = resizeRoomPoint({ x: w.tx, y: w.ty }, fromHeight);
      w.x = position.x; w.y = position.y;
      w.tx = target.x; w.ty = target.y;
      w.via = w.via.map((point) => resizeRoomPoint(point, fromHeight));
      w.journey = w.journey?.map((point) => resizeRoomPoint(point, fromHeight));
    };
    this.servers.forEach(move);
    // Kitchen geometry and its delivery lane are independent of viewport height.
    for (const c of this.customers) {
      move(c);
      if (c.seat >= 0) {
        const seat = seatSpot(Math.floor(c.seat / 2), c.seat % 2 as 0 | 1);
        if (seated(c)) { c.x = c.tx = seat.x; c.y = c.ty = seat.y; }
        else if (c.phase === 'toSeat') {
          if (c.via.length) c.via[c.via.length - 1] = seat;
          else { c.tx = seat.x; c.ty = seat.y; }
          if (c.journey?.length) c.journey[c.journey.length - 1] = seat;
        }
      }
    }
    if (this.floorState) {
      this.refreshNavigation(this.floorState);
      // Restore semantic destinations. Service positions stay attached to the
      // counter and doorway margins stay 12px, rather than stretching with floor.
      for (const c of this.customers) {
        const area = areaAtPoint(c.x, c.y) ?? 'main';
        if (c.phase === 'queue') this.walk(c, queueSpot(this.queue.indexOf(c.id)));
        else if (c.phase === 'toCounter') this.walk(c, serviceSpot(c.spot));
        else if (c.phase === 'ordering') {
          const p = serviceSpot(c.spot);
          c.x = c.tx = p.x; c.y = c.ty = p.y; c.via = []; c.journey = [];
        } else if (c.phase === 'toSeat') this.walk(c, ...this.toTable(c.seat, area), seatSpot(Math.floor(c.seat / 2), c.seat % 2 as 0 | 1));
        else if (c.phase === 'exiting') this.walk(c, ...roomRoute(area, 'main'), doorSpot());
      }
      for (const [i, server] of this.servers.entries()) {
        if (server.phase === 'idle') {
          const home = serverHome(i);
          server.x = server.tx = home.x; server.y = server.ty = home.y;
        } else if (server.phase === 'toPass') this.walk(server, passSpot());
        else this.headOut(server);
      }
    }
  }

  private randInt(n: number): number {
    return Math.floor(this.rng() * n);
  }

  private randomLook(): Look {
    return {
      skin: this.randInt(4),
      hair: this.randInt(6),
      hairStyle: this.randInt(4),
      shirt: this.randInt(8),
      pants: this.randInt(3),
    };
  }

  private sync(state: GameState): void {
    syncPartners(state);
    const stage = state.kitchen ? state.upgrades.cook : 0;
    setKitchenLevel(stage);
    if (this.kitchenStage >= 0 && this.kitchenStage !== stage) {
      // Keep cooks attached to their part of the floor as an expansion shifts
      // storage and washing forward, then rebuild routes around the new fixtures.
      const previous = this.kitchenStage;
      for (const [i, cook] of this.cooks.entries()) {
        if (cook.x < 0 && cook.y > 134) {
          const oldEnd = kitchenFloorY(168, previous);
          const anchor = cook.y >= oldEnd ? cook.y + 168 - oldEnd :
            134 + (cook.y - 134) * 34 / (oldEnd - 134);
          cook.y = kitchenFloorY(anchor);
        }
        const target = cook.batch ? stationSpot(cook.batch.steps[cook.batch.step]) : cookHome(i);
        this.walk(cook, ...kitchenPath(cook, target));
      }
    }
    this.kitchenStage = stage;
    this.refreshNavigation(state);
    while (this.baristas.length < baristaCount(state)) {
      this.baristas.push({ look: this.randomLook(), customerId: null, remaining: 0, total: 0, calling: 0 });
    }
    while (this.servers.length < serverCount(state)) {
      const home = serverHome(this.servers.length);
      this.servers.push({ ...home, tx: home.x, ty: home.y, stride: 0, via: [], look: this.randomLook(), phase: 'idle', plates: [], ack: 0 });
    }
    while (this.cooks.length < cookCount(state)) {
      const home = cookHome(this.cooks.length);
      this.cooks.push({ x: home.x, y: home.y, tx: home.x, ty: home.y, stride: 0, via: [], look: this.randomLook(), batch: null });
    }
    this.baristas.forEach((barista, i) => {
      if (i === 0) { barista.partnerId = undefined; return; }
      const partner = activePartner(state, 'barista', i - 1);
      if (partner) { barista.partnerId = partner.id; barista.look = { ...partner.look }; }
    });
    this.cooks.forEach((cook, i) => {
      const partner = activePartner(state, 'cook', i);
      if (partner) { cook.partnerId = partner.id; cook.look = { ...partner.look }; }
    });
    this.servers.forEach((server, i) => {
      const partner = activePartner(state, 'server', i);
      if (partner) {
        server.partnerId = partner.id;
        server.look = { ...partner.look };
      }
    });
    while (this.seats.length < TOTAL_TABLE_SPOTS * 2) this.seats.push(null);
  }

  /** Cache static floor geometry; ordering and walking do not rebuild it. */
  private refreshNavigation(state: GameState, replan = true): void {
    this.floorState = state;
    const tables = activeTableIndices(state);
    const signature = `${sceneHeight()}:${tables.join(',')}:${state.decor.placed.map((p) => `${p.id},${p.col},${p.row}`).join(';')}`;
    if (signature === this.navigationSignature) return;
    this.navigationSignature = signature;
    this.navigationTables = tables;
    this.navigationObstacles = new Map(AREA_IDS.map((area) => [area, []]));
    for (const area of AREA_IDS) {
      const origin = areaOrigin(area);
      const boxes = this.navigationObstacles.get(area)!;
      if (area === 'main') {
        boxes.push({ x: COUNTER.x, y: FLOOR_Y, w: COUNTER.w + COUNTER_GATE.w, h: COUNTER.bottom - FLOOR_Y });
        boxes.push(...MAIN_CUPBOARDS.map((r) => ({ ...r })));
        boxes.push(...doorPlantSpots().map((p) => ({ x: p.x - 5, y: p.y - 4, w: 10, h: 6 })));
      } else if (adjacentArea(area, 'up')) {
        // The north passage is the only walkable part of the back wall.
        boxes.push({ x: origin.x, y: origin.y, w: 142, h: FLOOR_Y },
          { x: origin.x + 178, y: origin.y, w: 142, h: FLOOR_Y });
      }
    }
    for (const i of tables) {
      this.navigationObstacles.get(tableArea(i))!.push(tableFootprint(i));
    }
    for (const p of state.decor.placed) {
      const def = furnitureDef(p.id), area = areaAtX(p.col * CELL);
      if (!def || def.surface !== 'floor' || !area) continue;
      const origin = areaOrigin(area), y = floorY(FLOOR_Y + p.row * CELL);
      this.navigationObstacles.get(area)!.push({
        x: origin.x + p.col * CELL - regionOffset(area), y: origin.y + y,
        w: def.w * CELL, h: floorY(FLOOR_Y + (p.row + def.h) * CELL) - y,
      });
    }
    for (const w of [...this.customers.filter((c) => !seated(c)), ...this.servers])
      if (replan && w.journey?.length) this.walk(w, ...w.journey);
  }

  /** Keep Arrange from placing solid furniture on a customer's or staff member's feet. */
  furnitureSpaceClear(id: string, col: number, row: number): boolean {
    const def = furnitureDef(id);
    if (!def) return false;
    if (def.surface === 'wall') return true;
    const area = areaAtX(col * CELL);
    if (!area || !Number.isFinite(col) || !Number.isFinite(row)) return false;
    const origin = areaOrigin(area);
    const left = origin.x + col * CELL - regionOffset(area) - WALK_CLEARANCE;
    const right = left + def.w * CELL + WALK_CLEARANCE * 2;
    const top = origin.y + floorY(FLOOR_Y + row * CELL) - WALK_CLEARANCE;
    const bottom = origin.y + floorY(FLOOR_Y + (row + def.h) * CELL) + WALK_CLEARANCE;
    return [...this.customers, ...this.servers, ...this.cooks].every((w) =>
      w.x < left || w.x > right || w.y < top || w.y > bottom);
  }

  /** The only exemptions for table footprints are the short steps out of chairs. */
  private chairApproach(point: FloorPoint, exact: boolean): FloorPoint | undefined {
    for (const table of this.navigationTables) {
      const p = tablePos(table);
      for (const side of [0, 1] as const) {
        const seat = seatSpot(table, side);
        if (exact) {
          if (Math.abs(point.x - seat.x) < 0.001 && Math.abs(point.y - seat.y) < 0.001) return seatApproach(table, side);
        } else if (Math.abs(point.x - seat.x) < 2 && point.y >= p.y - 20 && point.y <= p.y + 13) {
          // Preserve an in-progress chair step across floor resizes, leaving
          // through the apron on the side the guest already occupies.
          return point.y < seat.y ? { x: seat.x, y: p.y - 20 } : seatApproach(table, side);
        }
      }
    }
    return undefined;
  }

  /** Route one already-selected room/door segment without inventing wall shortcuts. */
  private floorRoute(from: FloorPoint, to: FloorPoint): FloorPoint[] | null {
    const H = sceneHeight();
    const street = (p: FloorPoint) => Math.abs(p.x - 160) < 0.001 && p.y > H - 8 + 0.001;
    const threshold = { x: 160, y: H - 8 };
    if (street(from) && street(to)) return [to];
    if (street(from)) {
      const rest = this.floorRoute(threshold, to);
      return rest && [threshold, ...rest];
    }
    if (street(to)) {
      const rest = this.floorRoute(from, threshold);
      return rest && [...rest, to];
    }
    const a = areaAtPoint(from.x, from.y), b = areaAtPoint(to.x, to.y);
    // Guest/server routes never use the staff-only production room.
    if (!a || !b || a === 'kitchen' || b === 'kitchen') return null;
    if (a !== b) {
      const connection = areaConnections(a).find((edge) => edge.to === b);
      if (!connection) return null;
      const origin = areaOrigin(a);
      if (connection.direction === 'left' || connection.direction === 'right') {
        const boundary = origin.x + (connection.direction === 'right' ? SCENE_W : 0);
        return Math.abs(from.y - origin.y - doorwayY(a, connection.direction)) < 0.001 && Math.abs(to.y - from.y) < 0.001 &&
          Math.abs(from.x - boundary) <= 12.001 && Math.abs(to.x - boundary) <= 12.001 ? [to] : null;
      }
      const boundary = origin.y + (connection.direction === 'down' ? H : 0);
      return Math.abs(from.x - origin.x - 160) < 0.001 && Math.abs(to.x - from.x) < 0.001 &&
        Math.abs(from.y - boundary) <= 12.001 && Math.abs(to.y - boundary) <= 12.001 ? [to] : null;
    }
    const origin = areaOrigin(a);
    const north = !!adjacentArea(a, 'up');
    const bounds = { x: origin.x + 5, y: origin.y + (north ? 0 : FLOOR_Y), w: 310, h: H - 8 - (north ? 0 : FLOOR_Y) };
    // A reroute may happen while feet are actually inside an open doorway.
    const inset = (point: FloorPoint): FloorPoint | null => {
      if (point.x < bounds.x || point.x > bounds.x + bounds.w) {
        const direction = point.x < bounds.x ? 'left' : 'right';
        if (!adjacentArea(a, direction) || Math.abs(point.y - origin.y - doorwayY(a, direction)) > 0.001) return null;
        return { x: origin.x + (direction === 'left' ? 12 : 308), y: point.y };
      }
      if (point.y > bounds.y + bounds.h) {
        if (!adjacentArea(a, 'down') || Math.abs(point.x - origin.x - 160) > 0.001) return null;
        return { x: point.x, y: origin.y + H - 12 };
      }
      return point;
    };
    const start = inset(from), end = inset(to);
    if (!start || !end) return null;
    const boxes = this.navigationObstacles.get(a) ?? [];
    let startApproach = this.chairApproach(start, false);
    // Resizing may consume some clearance without moving feet into furniture.
    // Recover by walking outward to the nearest clear margin, never teleporting
    // or granting a pass through the furniture's actual footprint.
    if (!startApproach && !boxes.some((r) => segmentCrossesObstacle(start, start, r))) {
      const padded = boxes.map((r) => ({ x: r.x - WALK_CLEARANCE, y: r.y - WALK_CLEARANCE, w: r.w + WALK_CLEARANCE * 2, h: r.h + WALK_CLEARANCE * 2 }));
      if (padded.some((r) => segmentCrossesObstacle(start, start, r))) {
        const candidates = padded.flatMap((r) => [
          { x: r.x, y: start.y }, { x: r.x + r.w, y: start.y },
          { x: start.x, y: r.y }, { x: start.x, y: r.y + r.h },
        ]).filter((p) => p.x >= bounds.x && p.x <= bounds.x + bounds.w && p.y >= bounds.y && p.y <= bounds.y + bounds.h &&
          !padded.some((r) => segmentCrossesObstacle(p, p, r)) && !boxes.some((r) => segmentCrossesObstacle(start, p, r)));
        candidates.sort((p, q) => Math.hypot(p.x - start.x, p.y - start.y) - Math.hypot(q.x - start.x, q.y - start.y));
        startApproach = candidates[0];
      }
    }
    const path = routeFloorSegment(start, end, boxes, {
      bounds, clearance: WALK_CLEARANCE, startApproach, endApproach: this.chairApproach(end, true),
    });
    return path && [start, ...path, to];
  }

  private find(id: number): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  private spawn(state: GameState): void {
    const menu = menuItems(state);
    if (menu.length === 0) return;
    // Still one draw: today's condition only reshapes which dish it lands on.
    const weights = menuWeights(state, menu);
    const main = weights ? menu[weightedIndex(weights, this.rng())] : menu[this.randInt(menu.length)];
    const pairs = styleOrderPairs(state, main, menu);
    const extra = pairs.length > 0 && this.rng() < styleComboChance(state, main, pairs) ? pairs[this.randInt(pairs.length)].id : null;
    const pos = queueSpot(this.queue.length);
    const door = doorSpot();
    // Keep exactly the old five appearance RNG draws: adding a visual cast must
    // not perturb orders, VIP rolls, arrival timing, or economic simulation.
    const seedLook = this.randomLook();
    this.castRandomState = 1 + ((((seedLook.skin * 6 + seedLook.hair) * 4 + seedLook.hairStyle) * 8 + seedLook.shirt) * 3 + seedLook.pants);
    const appearance = this.customerCast.next();
    const regularGuest = regularGuestForAppearance(appearance.id, state.day);
    const visitId = regularGuest ? recordRegularGuestArrival(state, regularGuest.id) : null;
    const chosen = regularGuestOrder(state, regularGuest?.id, main.id, extra);
    const c: Customer = {
      id: this.nextId++,
      reviewed: false,
      waitSeconds: 0,
      missingExtra: false,
      x: door.x,
      y: door.y,
      tx: pos.x,
      ty: pos.y,
      phase: 'queue',
      appearanceId: appearance.id,
      ...(regularGuest && visitId !== null ? { regularGuestId: regularGuest.id, regularGuestVisitId: visitId } : {}),
      look: { ...appearance.look },
      order: chosen.order,
      extra: chosen.extra,
      vip: this.rng() < VIP_CHANCE,
      patience: patienceSeconds(state),
      spot: -1,
      seat: -1,
      timer: 0,
      mood: null,
      moodTimer: 0,
      hasCup: false,
      soldOut: false,
      dineIn: false,
      stride: 0,
      via: [],
    };
    this.customers.push(c);
    this.queue.push(c.id);
    this.walk(c, pos);
  }

  private relayoutQueue(): void {
    this.queue.forEach((id, i) => {
      const c = this.find(id);
      if (!c) return;
      this.walk(c, queueSpot(i));
    });
  }

  /** Sets someone walking through `points` in order. */
  private walk(c: Walker, ...points: { x: number; y: number }[]): void {
    c.journey = points.map((p) => ({ ...p }));
    c.pathBlocked = false;
    const routed: FloorPoint[] = [];
    let start = { x: c.x, y: c.y };
    for (const point of points) {
      const path = this.cooks.includes(c as Cook) ? [point] : this.floorRoute(start, point);
      if (!path) {
        c.pathBlocked = true;
        c.tx = c.x; c.ty = c.y; c.via = [];
        return;
      }
      routed.push(...path);
      start = point;
    }
    let previous = { x: c.x, y: c.y };
    const unique = routed.filter((point) => {
      const different = point.x !== previous.x || point.y !== previous.y;
      previous = point;
      return different;
    });
    const [first, ...rest] = unique;
    c.tx = first?.x ?? c.x;
    c.ty = first?.y ?? c.y;
    c.via = rest;
  }

  private exit(c: Customer): void {
    if (this.floorState && c.regularGuestId && c.regularGuestVisitId !== undefined) {
      recordRegularGuestDeparture(this.floorState, c.regularGuestId, c.regularGuestVisitId);
    }
    // Someone getting up from a table steps into its clear apron first.
    const from = seated(c) ? [seatApproach(Math.floor(c.seat / 2), (c.seat % 2) as 0 | 1)] : [];
    const area = seated(c) ? tableArea(Math.floor(c.seat / 2)) : areaAtPoint(c.x, c.y) ?? 'main';
    if (c.seat >= 0) this.seats[c.seat] = null;
    c.seat = -1;
    c.phase = 'exiting';
    this.walk(c, ...from, ...roomRoute(area, 'main'), doorSpot());
  }

  /** From a room to the spot in front of a seat, through the shared doors. */
  private toTable(seat: number, from: AreaId = 'main'): { x: number; y: number }[] {
    const table = Math.floor(seat / 2);
    const approach = seatApproach(table, (seat % 2) as 0 | 1);
    const area = tableArea(table);
    if (area === from) return [approach];
    return [...roomRoute(from, area), { x: areaOrigin(area).x + 160, y: approach.y }, approach];
  }

  private freeSeat(state: GameState): number {
    const available = activeTableIndices(state).flatMap((i) => [i * 2, i * 2 + 1]).filter((i) => this.seats[i] === null);
    return available.length > 0 ? available[this.randInt(available.length)] : -1;
  }

  private review(state: GameState, c: Customer, review: ReviewInput): void {
    if (c.reviewed) return;
    c.reviewed = true;
    recordReview(state, review);
  }

  /** The customer pays for their order, wherever they get it. */
  private charge(state: GameState, c: Customer, events: SimEvent[]): void {
    const bought = (c.extra ? [c.order, c.extra] : [c.order]).filter((id) => canPrepareItem(state, id));
    if (bought.length === 0) return;
    const amount = bought.reduce((sum, id) => sum + salePrice(state, id, c.vip, c.dineIn, bought), 0) * (1 + (c.momentTip ?? 0));
    earn(state, amount);
    state.served++;
    state.today.served++;
    state.today.revenue += amount;
    for (const id of bought) state.today.sales[id] = (state.today.sales[id] ?? 0) + 1;
    events.push({ type: 'sale', amount, x: c.x, y: c.y - 52, vip: c.vip, customerId: c.id });
    this.review(state, c, mealReview(state, bought, c.waitSeconds, c.missingExtra));
    recordServings(state, bought);
    recordStyleHandoff(state, bought, c.dineIn);
    if (c.regularGuestId && c.regularGuestVisitId !== undefined) recordRegularGuestService(state, c.regularGuestId, c.regularGuestVisitId);
    c.hasCup = true;
    c.mood = 'happy';
    c.moodTimer = 1.5;
  }

  private callNext(): void {
    for (let i = 0; i < this.baristas.length && this.queue.length > 0; i++) {
      const b = this.baristas[i];
      if (b.customerId !== null) continue;
      const c = this.find(this.queue.shift()!);
      if (!c) continue;
      c.phase = 'toCounter';
      c.spot = i;
      this.walk(c, serviceSpot(i));
      b.customerId = c.id;
      b.brewCredited = false;
      b.remaining = 0;
      b.total = 0;
      this.relayoutQueue();
    }
  }

  private arrive(state: GameState, c: Customer, events: SimEvent[]): void {
    if (c.phase === 'toCounter') {
      const b = this.baristas[c.spot];
      if (!consumeServing(state, c.order, state.today)) {
        // Out of ingredients: sorry, no sale.
        b.customerId = null;
        c.spot = -1;
        c.soldOut = true;
        c.mood = 'sad';
        c.moodTimer = 2.2;
        state.today.missed++;
        state.today.soldOut++;
        this.review(state, c, { stars: 1, reason: 'soldOut' });
        state.today.shortages[c.order] = (state.today.shortages[c.order] ?? 0) + 1;
        events.push({ type: 'soldout', item: c.order, x: c.x, y: c.y - 30 });
        this.exit(c);
        return;
      }
      // The add-on is skipped (not a deal breaker) if it has sold out.
      if (c.extra && !consumeServing(state, c.extra, state.today)) {
        state.today.extraLost++;
        c.missingExtra = true;
        state.today.shortages[c.extra] = (state.today.shortages[c.extra] ?? 0) + 1;
        c.extra = null;
      }
      c.phase = 'ordering';
      b.total = b.remaining = prepTime(state, c.order) * partnerBrewMultiplier(state, b.partnerId, isBakery(c.order)) + (c.extra ? prepTime(state, c.extra) * partnerBrewMultiplier(state, b.partnerId, isBakery(c.extra)) : 0);
      // With a table free, some stay: they take a seat and the order is brought over.
      const seat = this.freeSeat(state);
      if (seat >= 0 && this.rng() < styleSeatChance(state, c.extra ? [c.order, c.extra] : [c.order]) * conditionSeating(state)) {
        this.seats[seat] = c.id;
        c.seat = seat;
        c.dineIn = true;
        c.timer = ORDER_SECONDS;
      }
    } else if (c.phase === 'toSeat') {
      c.phase = 'waiting';
      c.timer = tablePatience(state);
    }
  }

  /** Takeaway: handed over the counter, paid for, and out the door. */
  private serveAtCounter(state: GameState, b: Barista, c: Customer, events: SimEvent[]): void {
    this.charge(state, c, events);
    b.customerId = null;
    c.spot = -1;
    this.exit(c);
  }

  /**
   * A table order is ready: onto the pass, and ring for a server. With the pass
   * full the barista holds on to it, and keeps calling, until there's room.
   */
  private sendToPass(c: Customer, i: number, events: SimEvent[]): void {
    const b = this.baristas[i];
    if (this.pass.length >= PASS_SLOTS) {
      if (b.calling <= 0) b.calling = CALL_SECONDS;
      return;
    }
    this.pass.push({ customerId: c.id, items: c.extra ? [c.order, c.extra] : [c.order], barista: i, server: null, waited: 0 });
    b.customerId = null;
    b.calling = CALL_SECONDS;
    events.push({ type: 'bell', ...PASS_BELL });
  }

  /**
   * A server at a guest's table hands over the order and the guest pays, then they
   * go on to the next table on their tray or head back. Returns false while the
   * guest hasn't sat down yet.
   */
  private deliver(state: GameState, server: Server, events: SimEvent[]): boolean {
    const c = this.find(server.plates[0].customerId);
    // Their order can beat them to the table; the server waits for them to sit down.
    if (c && (c.phase === 'ordering' || c.phase === 'toSeat')) return false;
    if (c && c.phase === 'waiting') {
      const unpaid = !c.hasCup;
      this.charge(state, c, events);
      if (unpaid && c.hasCup) recordPartnerWork(state, server.partnerId);
      c.phase = 'sitting';
      c.timer = 6 + this.rng() * 8 + styleDwellExtra(state, c.extra ? [c.order, c.extra] : [c.order]);
    }
    server.plates.shift();
    this.headOut(server);
    return true;
  }

  /**
   * On to the next table on the tray, or back to the kitchen door when it's empty.
   * The rooms run in a line from the main café, so the tray is delivered nearest
   * room first, and within a room, nearest table first.
   */
  private headOut(server: Server): void {
    // Orders for guests who gave up waiting are cleared away.
    server.plates = server.plates.filter((p) => {
      const c = this.find(p.customerId);
      return !!c && c.seat >= 0 && c.phase !== 'exiting';
    });
    const area = areaAtPoint(server.x, server.y) ?? 'main';
    if (server.plates.length > 0) {
      const distance = (p: Plate) => {
        const c = this.find(p.customerId)!;
        const spot = seatApproach(Math.floor(c.seat / 2), (c.seat % 2) as 0 | 1);
        return roomDepth(this.plateRoom(p)) * 1e6 + Math.hypot(spot.x - server.x, spot.y - server.y);
      };
      server.plates.sort((a, b) => distance(a) - distance(b));
      server.phase = 'delivering';
      this.walk(server, ...this.toTable(this.find(server.plates[0].customerId)!.seat, area));
      return;
    }
    server.phase = 'returning';
    const exitSide = area === 'main' ? [] : [{ x: areaOrigin(area).x + 160, y: server.y }];
    this.walk(server, ...exitSide, ...roomRoute(area, 'main'), serverHome(this.servers.indexOf(server)));
  }

  /**
   * What a server answering the bell takes: the order whose guest is closest to
   * giving up, plus whatever else fits on the tray, preferring orders for the same
   * room, then rooms on the way there, then rooms beyond it.
   */
  private loadTray(limit = TRAY_PLATES): Plate[] {
    const open = this.pass.filter((p) => p.server === null);
    if (open.length === 0) return [];
    const patience = (p: Plate) => {
      const c = this.find(p.customerId);
      return c?.phase === 'waiting' ? c.timer : Infinity;
    };
    const first = open.reduce((best, p) => (patience(p) < patience(best) ? p : best));
    const room = this.plateRoom(first);
    const rank = (p: Plate) => (this.plateRoom(p) === room ? 0 : roomDepth(this.plateRoom(p)) < roomDepth(room) ? 1 : 2);
    const rest = open.filter((p) => p !== first).sort((a, b) => rank(a) - rank(b));
    return [first, ...rest].slice(0, limit);
  }

  /** The room a plate's table is in. */
  private plateRoom(plate: Plate) {
    const c = this.find(plate.customerId);
    return c && c.seat >= 0 ? tableArea(Math.floor(c.seat / 2)) : null;
  }

  private updateServers(state: GameState, dt: number, events: SimEvent[]): void {
    // Plates nobody has come for: the barista rings again.
    for (const plate of this.pass) {
      if (plate.server !== null) continue;
      plate.waited += dt;
      if (plate.waited >= RING_AGAIN) {
        plate.waited = 0;
        const b = this.baristas[plate.barista];
        if (b) b.calling = CALL_SECONDS;
        events.push({ type: 'bell', ...PASS_BELL });
      }
    }
    this.servers.forEach((server, i) => {
      server.ack = Math.max(0, server.ack - dt);
      step(server, dt, SERVER_SPEED * styleServerMultiplier(state) * partnerServerSpeed(state, server.partnerId, server.plates.length));
      const there = resting(server);
      if (server.phase === 'idle') {
        const tray = this.loadTray(partnerTraySize(state, server.partnerId));
        if (tray.length === 0) return;
        for (const plate of tray) plate.server = i;
        server.plates = tray;
        server.phase = 'toPass';
        server.ack = 0.9;
        this.walk(server, passSpot());
      } else if (server.phase === 'toPass' && there) {
        this.pass = this.pass.filter((p) => !server.plates.includes(p));
        this.headOut(server);
      } else if (server.phase === 'delivering' && there) {
        this.deliver(state, server, events);
      } else if (server.phase === 'returning' && there) {
        server.phase = 'idle';
      }
    });
  }

  /**
   * A free cook starts on whatever is running low in the pastry case, fetching its
   * ingredients and taking it from station to station; the finished batch cools on
   * the rack and goes out through the door into the case.
   */
  private updateCooks(state: GameState, dt: number, events: SimEvent[]): void {
    this.cooks.forEach((cook, i) => {
      step(cook, dt, WALK_SPEED * partnerCookSpeed(state, cook.partnerId));
      if (!resting(cook)) return;
      const batch = cook.batch;
      if (!batch) {
        const next = nextBatch(state, this.cooks.flatMap((c) => (c.batch ? [c.batch.item] : [])));
        if (!next) return;
        startBatch(state, next.item, next.n);
        const steps = batchSteps(next.item);
        cook.batch = { ...next, steps, step: 0, timer: STATION_SECONDS[steps[0]] * styleStationMultiplier(state) * partnerStationTime(state, cook.partnerId) };
        this.walk(cook, ...kitchenPath(cook, stationSpot(steps[0])));
        return;
      }
      batch.timer -= dt;
      if (batch.timer > 0) return;
      const station = batch.steps[++batch.step];
      if (station) {
        batch.timer = STATION_SECONDS[station] * styleStationMultiplier(state) * partnerStationTime(state, cook.partnerId);
        this.walk(cook, ...kitchenPath(cook, stationSpot(station)));
        return;
      }
      const bakedBefore = state.today.baked[batch.item] ?? 0;
      shelveBatch(state, batch.item, batch.n);
      if ((state.today.baked[batch.item] ?? 0) > bakedBefore) recordPartnerWork(state, cook.partnerId);
      this.rack = [batch.item, ...this.rack].slice(0, 3);
      events.push({ type: 'restock', item: batch.item, n: batch.n });
      cook.batch = null;
      this.walk(cook, ...kitchenPath(cook, cookHome(i)));
    });
  }

  /** Where a cook's batch is: the station they're at or heading to, and whether they've started there. */
  cookStation(i: number): { station: Station; working: boolean } | null {
    const cook = this.cooks[i];
    const batch = cook?.batch;
    if (!batch) return null;
    return { station: batch.steps[batch.step], working: resting(cook) };
  }

  update(state: GameState, dt: number): SimEvent[] {
    const events: SimEvent[] = [];
    this.sync(state);
    if (!Number.isFinite(dt) || dt <= 0) return events;
    this.boostCooldown = Math.max(0, this.boostCooldown - dt);

    // Close before admitting arrivals when a loaded or newly depleted menu is empty.
    if (state.phase === 'open' && (state.dayTime >= DAY_SECONDS || !hasServiceSupply(state))) this.beginClosing(state);
    const open = state.phase === 'open';
    const running = state.phase !== 'prep';
    const arrivalSeconds = open ? integratedTrafficSeconds(state.dayTime, Math.min(dt, DAY_SECONDS - state.dayTime)) : dt;
    if (running) state.dayTime += dt;
    if (state.phase === 'open' && state.dayTime >= DAY_SECONDS) this.beginClosing(state);
    updatePetCare(state, dt);
    updatePromotion(state, dt);
    // Keep the saved timer in mean-rate seconds, including legacy snapshots.
    // Only open-shop arrivals follow the wave; prep/closing retain their clock.
    this.spawnTimer -= arrivalSeconds;
    if (dt > 0 && this.spawnTimer <= 0) {
      // Jittered so customers don't march in like clockwork.
      this.spawnTimer = (0.5 + this.rng()) / arrivalRate(state);
      if (state.phase === 'open') {
        if (this.queue.length < MAX_QUEUE) this.spawn(state);
        else state.today.doorLost++;
      }
    }

    this.callNext();

    for (const c of this.customers) {
      if (running && !c.reviewed && c.phase !== 'sitting' && c.phase !== 'exiting') c.waitSeconds += dt;
      if (step(c, dt)) this.arrive(state, c, events);

      if (c.moodTimer > 0) {
        c.moodTimer -= dt;
        if (c.moodTimer <= 0) c.mood = null;
      }

      if (c.phase === 'queue') {
        c.patience -= dt;
        if (c.patience <= 0) {
          this.queue = this.queue.filter((id) => id !== c.id);
          this.relayoutQueue();
          c.mood = 'sad';
          c.moodTimer = 2;
          if (running) {
            state.today.missed++; state.today.queueLost++;
            this.review(state, c, { stars: 2, reason: 'queueWait' });
          }
          events.push({ type: 'walkout', x: c.x, y: c.y - 30 });
          this.exit(c);
        }
      } else if (c.phase === 'ordering' && c.dineIn) {
        // Ordered; payment happens when the server delivers.
        c.timer -= dt;
        if (c.timer <= 0) {
          c.phase = 'toSeat';
          c.spot = -1;
          this.walk(c, ...this.toTable(c.seat), seatSpot(Math.floor(c.seat / 2), (c.seat % 2) as 0 | 1));
        }
      } else if (c.phase === 'waiting') {
        c.timer -= dt;
        if (c.timer <= 0) {
          // Nobody brought it over: they leave without paying, and the order is wasted.
          this.pass = this.pass.filter((p) => p.customerId !== c.id || p.server !== null);
          c.mood = 'sad';
          c.moodTimer = 2;
          if (running) {
            state.today.missed++; state.today.tableLost++;
            this.review(state, c, { stars: 1, reason: 'tableWait' });
          }
          events.push({ type: 'walkout', x: c.x, y: c.y - 30 });
          this.exit(c);
        }
      } else if (c.phase === 'sitting') {
        c.timer -= dt;
        if (c.timer <= 0) this.exit(c);
      }
    }

    this.baristas.forEach((b, i) => {
      b.calling = Math.max(0, b.calling - dt);
      if (b.customerId === null || b.total === 0) return;
      b.remaining -= dt;
      if (b.remaining > 0) return;
      const c = this.find(b.customerId);
      if (c && c.phase !== 'exiting' && !b.brewCredited) { recordPartnerWork(state, b.partnerId); b.brewCredited = true; }
      if (!c || c.phase === 'exiting') b.customerId = null;
      else if (c.dineIn) this.sendToPass(c, i, events);
      // A takeaway order waits for its customer to reach the counter.
      else if (c.phase === 'ordering') this.serveAtCounter(state, b, c, events);
    });

    this.updateServers(state, dt, events);
    this.updateCooks(state, dt, events);

    // The final serving can be reserved during this update. Finish that order
    // through ordinary closing service rather than cancelling its unpaid work.
    if (state.phase === 'open' && !hasServiceSupply(state)) this.beginClosing(state);
    this.customers = this.customers.filter(
      (c) => !(c.phase === 'exiting' && resting(c)),
    );
    return events;
  }

  /**
   * The player closes the shop: the doors shut on anyone still waiting (they leave
   * without paying, and aren't counted as lost), the staff stop, and the day's
   * books are settled.
   */
  closeShop(state: GameState): DayReport | null {
    if (state.phase === 'prep') return null;
    for (const c of this.customers) {
      if (c.phase === 'toCounter' || c.phase === 'ordering' || c.phase === 'toSeat' || c.phase === 'waiting') {
        this.review(state, c, { stars: 1, reason: 'cancelled' });
      }
    }
    this.sendHome();
    return finishDay(state);
  }

  /** Closing up: anyone still waiting leaves, the baristas stop, and the servers head back. */
  sendHome(): void {
    for (const c of this.customers) {
      if (c.phase !== 'sitting' && c.phase !== 'exiting') this.exit(c);
    }
    this.queue = [];
    this.pass = [];
    for (const b of this.baristas) {
      b.customerId = null;
      b.remaining = b.total = 0;
      b.calling = 0;
    }
    this.cooks.forEach((cook, i) => {
      cook.batch = null;
      this.walk(cook, ...kitchenPath(cook, cookHome(i)));
    });
    this.servers.forEach((server, i) => {
      if (server.phase === 'idle') return;
      server.plates = [];
      server.phase = 'returning';
      const area = areaAtPoint(server.x, server.y) ?? 'main';
      this.walk(server, ...roomRoute(area, 'main'), serverHome(i));
    });
  }

  /** Player taps to help: every brewing barista jumps ahead a bit. */
  boost(): boolean {
    if (this.boostCooldown > 0) return false;
    let any = false;
    for (const b of this.baristas) {
      if (b.customerId !== null && b.total > 0 && b.remaining > 0) {
        b.remaining = Math.max(0.01, b.remaining - BOOST_SECONDS);
        any = true;
      }
    }
    if (any) this.boostCooldown = 1;
    return any;
  }

  /** A barista is done but the pass is full, so they're holding a table order. */
  isHolding(i: number): boolean {
    const b = this.baristas[i];
    return !!b && b.customerId !== null && b.total > 0 && b.remaining <= 0;
  }

  isBrewing(i: number): boolean {
    const b = this.baristas[i];
    return !!b && b.customerId !== null && b.total > 0;
  }

  /**
   * Where a barista is inside the bar. Taking an order they face the room at the
   * counter; then they step back to the back bar to make it, and bring it forward
   * just as it's ready. Follows the order's progress, so a boost hurries them too.
   */
  baristaPose(i: number): BaristaPose {
    const front = baristaSpot(i);
    const b = this.baristas[i];
    if (!b || !this.isBrewing(i)) return { ...front, facing: 'down', walking: false, working: false };
    const back = baristaWorkSpot(i);
    const depth = front.y - back.y;
    const trip = Math.min(depth / WALK_SPEED, b.total / 4);
    const elapsed = b.total - b.remaining;
    const left = Math.max(0, b.remaining);
    if (elapsed < trip) return { x: front.x, y: Math.round(front.y - (depth * elapsed) / trip), facing: 'up', walking: true, working: false };
    if (left > trip) return { ...back, facing: 'up', walking: false, working: true };
    return { x: front.x, y: Math.round(front.y - (depth * left) / trip), facing: 'down', walking: left > 0, working: false };
  }
}

export interface BaristaPose {
  x: number;
  y: number;
  facing: 'up' | 'down';
  walking: boolean;
  /** At the back bar, making the order. */
  working: boolean;
}

/** At a table, whether still waiting for the order or eating it. */
export const seated = (c: Customer) => c.phase === 'waiting' || c.phase === 'sitting';

/** How far a room is from the main café along the shared doors; 0 for the main café. */
const roomDepth = (area: AreaId | null) => (area ? roomRoute('main', area).length : 0);

/** Standing still at the end of their path. */
const resting = (w: Walker) => !w.pathBlocked && w.x === w.tx && w.y === w.ty && w.via.length === 0;

/** Moves a walker along its path; true on the step it reaches the end. */
function step(w: Walker, dt: number, speed = WALK_SPEED): boolean {
  if (w.pathBlocked) return false;
  let left = speed * dt;
  while (left > 0) {
    const dx = w.tx - w.x;
    const dy = w.ty - w.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
      const next = w.via.shift();
      if (!next) return false;
      w.tx = next.x; w.ty = next.y;
      continue;
    }
    if (dist > left) {
      w.x += (dx / dist) * left;
      w.y += (dy / dist) * left;
      w.stride += left;
      return false;
    }
    w.x = w.tx;
    w.y = w.ty;
    while (w.journey?.length && Math.abs(w.journey[0].x - w.x) < 0.001 && Math.abs(w.journey[0].y - w.y) < 0.001) w.journey.shift();
    w.stride += dist;
    left = 0;
    const next = w.via.shift();
    if (!next) return true;
    w.tx = next.x;
    w.ty = next.y;
  }
  return false;
}
