import { CLOSING_GRACE, COMBO_CHANCE, DAY_SECONDS, MAX_QUEUE, VIP_CHANCE, isDrink, type ItemId } from './data';
import { finishDay, type DayReport } from './day';
import {
  arrivalRate,
  baristaCount,
  consumeServing,
  earn,
  menuItems,
  patienceSeconds,
  prepTime,
  salePrice,
  tableCount,
} from './economy';
import { DOOR_SPOT, queueSpot, seatSpot, serviceSpot } from './layout';
import type { GameState, Look } from './state';

export type { Look };

export type CustomerPhase = 'queue' | 'toCounter' | 'ordering' | 'toSeat' | 'sitting' | 'exiting';

export interface Customer {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: CustomerPhase;
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
  /** Distance walked, drives the walk animation. */
  stride: number;
}

export interface Barista {
  look: Look;
  customerId: number | null;
  remaining: number;
  total: number;
}

export type SimEvent =
  | { type: 'sale'; amount: number; x: number; y: number; vip: boolean }
  | { type: 'walkout'; x: number; y: number }
  | { type: 'soldout'; item: ItemId; x: number; y: number }
  | { type: 'dayEnd'; report: DayReport };

export const WALK_SPEED = 62;
const SEAT_CHANCE = 0.6;
const BOOST_SECONDS = 0.3;

export class Sim {
  customers: Customer[] = [];
  baristas: Barista[] = [];
  /** Customer ids waiting in line, front first. */
  queue: number[] = [];
  /** Customer id occupying each seat (2 per table). */
  seats: (number | null)[] = [];
  private spawnTimer = 1.5;
  private nextId = 1;

  constructor(private rng: () => number = Math.random) {}

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
    while (this.baristas.length < baristaCount(state)) {
      this.baristas.push({ look: this.randomLook(), customerId: null, remaining: 0, total: 0 });
    }
    while (this.seats.length < tableCount(state) * 2) this.seats.push(null);
  }

  private find(id: number): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  private spawn(state: GameState): void {
    const menu = menuItems(state);
    if (menu.length === 0) return;
    const main = menu[this.randInt(menu.length)];
    const pairs = menu.filter((m) => isDrink(m.category) !== isDrink(main.category));
    const extra = pairs.length > 0 && this.rng() < COMBO_CHANCE ? pairs[this.randInt(pairs.length)].id : null;
    const pos = queueSpot(this.queue.length);
    const c: Customer = {
      id: this.nextId++,
      x: DOOR_SPOT.x,
      y: DOOR_SPOT.y,
      tx: pos.x,
      ty: pos.y,
      phase: 'queue',
      look: this.randomLook(),
      order: main.id,
      extra,
      vip: this.rng() < VIP_CHANCE,
      patience: patienceSeconds(state),
      spot: -1,
      seat: -1,
      timer: 0,
      mood: null,
      moodTimer: 0,
      hasCup: false,
      soldOut: false,
      stride: 0,
    };
    this.customers.push(c);
    this.queue.push(c.id);
  }

  private relayoutQueue(): void {
    this.queue.forEach((id, i) => {
      const c = this.find(id);
      if (!c) return;
      const p = queueSpot(i);
      c.tx = p.x;
      c.ty = p.y;
    });
  }

  private exit(c: Customer): void {
    c.phase = 'exiting';
    c.tx = DOOR_SPOT.x;
    c.ty = DOOR_SPOT.y;
  }

  private callNext(): void {
    for (let i = 0; i < this.baristas.length && this.queue.length > 0; i++) {
      const b = this.baristas[i];
      if (b.customerId !== null) continue;
      const c = this.find(this.queue.shift()!);
      if (!c) continue;
      const p = serviceSpot(i);
      c.phase = 'toCounter';
      c.spot = i;
      c.tx = p.x;
      c.ty = p.y;
      b.customerId = c.id;
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
        events.push({ type: 'soldout', item: c.order, x: c.x, y: c.y - 30 });
        this.exit(c);
        return;
      }
      // The add-on is skipped (not a deal breaker) if it has sold out.
      if (c.extra && !consumeServing(state, c.extra, state.today)) c.extra = null;
      c.phase = 'ordering';
      b.total = b.remaining = prepTime(state, c.order) + (c.extra ? prepTime(state, c.extra) : 0);
    } else if (c.phase === 'toSeat') {
      c.phase = 'sitting';
      c.timer = 6 + this.rng() * 8;
    }
  }

  private serve(state: GameState, b: Barista, c: Customer, events: SimEvent[]): void {
    const bought = c.extra ? [c.order, c.extra] : [c.order];
    const amount = bought.reduce((sum, id) => sum + salePrice(state, id, c.vip), 0);
    earn(state, amount);
    state.served++;
    state.today.served++;
    state.today.revenue += amount;
    for (const id of bought) state.today.sales[id] = (state.today.sales[id] ?? 0) + 1;
    events.push({ type: 'sale', amount, x: c.x, y: c.y - 52, vip: c.vip });
    b.customerId = null;
    c.hasCup = true;
    c.mood = 'happy';
    c.moodTimer = 1.5;
    c.spot = -1;
    const free = this.seats.findIndex((s) => s === null);
    if (free >= 0 && this.rng() < SEAT_CHANCE) {
      this.seats[free] = c.id;
      c.seat = free;
      c.phase = 'toSeat';
      const p = seatSpot(Math.floor(free / 2), (free % 2) as 0 | 1);
      c.tx = p.x;
      c.ty = p.y;
    } else {
      this.exit(c);
    }
  }

  update(state: GameState, dt: number): SimEvent[] {
    const events: SimEvent[] = [];
    this.sync(state);

    const open = state.phase === 'open';
    if (open) state.dayTime += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      // Jittered so customers don't march in like clockwork.
      this.spawnTimer = (0.5 + this.rng()) / arrivalRate(state);
      if (open && state.dayTime < DAY_SECONDS && this.queue.length < MAX_QUEUE) this.spawn(state);
    }

    this.callNext();

    for (const c of this.customers) {
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const dist = Math.hypot(dx, dy);
      const step = WALK_SPEED * dt;
      if (dist > 0) {
        if (dist <= step) {
          c.x = c.tx;
          c.y = c.ty;
          c.stride += dist;
          this.arrive(state, c, events);
        } else {
          c.x += (dx / dist) * step;
          c.y += (dy / dist) * step;
          c.stride += step;
        }
      }

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
          if (open) state.today.missed++;
          events.push({ type: 'walkout', x: c.x, y: c.y - 30 });
          this.exit(c);
        }
      } else if (c.phase === 'sitting') {
        c.timer -= dt;
        if (c.timer <= 0) {
          this.seats[c.seat] = null;
          c.seat = -1;
          this.exit(c);
        }
      }
    }

    for (const b of this.baristas) {
      if (b.customerId === null || b.total === 0) continue;
      b.remaining -= dt;
      if (b.remaining <= 0) {
        const c = this.find(b.customerId);
        if (c) this.serve(state, b, c, events);
        else b.customerId = null;
      }
    }

    this.customers = this.customers.filter(
      (c) => !(c.phase === 'exiting' && c.x === c.tx && c.y === c.ty),
    );

    // After closing time the staff finish whoever is still in line, then close up.
    if (open && state.dayTime >= DAY_SECONDS) {
      const busy = this.customers.some((c) => c.phase !== 'sitting' && c.phase !== 'exiting');
      if (!busy || state.dayTime >= DAY_SECONDS + CLOSING_GRACE) {
        this.sendHome();
        events.push({ type: 'dayEnd', report: finishDay(state) });
      }
    }
    return events;
  }

  /** Closing up: anyone still waiting leaves, and the baristas stop. */
  sendHome(): void {
    for (const c of this.customers) {
      if (c.phase !== 'sitting' && c.phase !== 'exiting') this.exit(c);
    }
    this.queue = [];
    for (const b of this.baristas) {
      b.customerId = null;
      b.remaining = b.total = 0;
    }
  }

  /** Player taps to help: every brewing barista jumps ahead a bit. */
  boost(): boolean {
    let any = false;
    for (const b of this.baristas) {
      if (b.customerId !== null && b.total > 0 && b.remaining > 0) {
        b.remaining = Math.max(0.01, b.remaining - BOOST_SECONDS);
        any = true;
      }
    }
    return any;
  }

  isBrewing(i: number): boolean {
    const b = this.baristas[i];
    return !!b && b.customerId !== null && b.total > 0;
  }
}
