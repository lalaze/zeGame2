// What people order, carry and think in the floors view, in its painted art (floors-fx.ts): the
// drink or pastry in front of each seated guest, the tray a server carries, takeaway cups, finished
// orders, the tip jar and the bell on the counter, a catering order waiting there, the cake display
// filled with what is in stock, a parcel at the door, Mina's map and reserved table, the order bubbles
// and thoughts over heads, the bars over people at work, and the coins, tips and sparkles the page asks for.
// The scene (floors-scene.ts) walks everyone; this only reads where they are and what the Sim says.
import Phaser from 'phaser';
import { menuItems } from '../../game/economy';
import { formatMoney } from '../../game/format';
import { orderReady } from '../../game/orders';
import { minaMapChoice, minaReservedTable } from '../../game/regular-wishes';
import type { Customer, Sim } from '../../game/sim';
import type { GameState } from '../../game/state';
import { outerWallShown } from '../../ui/floors-ui';
import type { CafeView } from '../cafe-view';
import { tillJarLevel } from '../idle-props-art';
import { FX, FX_CASE, FX_ITEMS, cueTexture, isDrinkItem, isHotDrink, itemFrame, loadFx, type FxFrame } from './floors-fx';
import { BARISTAS, COUNTER_FRONT, DISPLAY, LIFT_HATCH, LIFT_TOP, PARCEL, SERVICE, tableSeats, worldPoint, type Building, type FloorPoint } from './floors-layout';
import { bakeShare, brewShare } from './floors-work';
import { BAR } from './textures';

/** What this needs of one of the scene's walkers. */
export interface PropActor {
  sprite: Phaser.GameObjects.Sprite;
  art: string;
  at: FloorPoint;
  clock: number;
  /** What is left of their way: empty once they are there. */
  steps?: readonly unknown[];
  /** How much of them a stairwell's front edge hides, from their feet up (wellSink in floors-layout.ts). */
  sunk?: number;
  /** The scene's cup in hand: a takeaway guest's becomes a paper cup or a bakery bag, a server's a tray. */
  cup?: Phaser.GameObjects.Image;
}
/** The scene's people, as it keeps them. */
export interface PropsCast {
  customers: ReadonlyMap<number, PropActor>;
  servers: readonly (PropActor | undefined)[];
  cooks: readonly (PropActor | undefined)[];
  baristas: readonly Phaser.GameObjects.Sprite[];
  /** The cue bobbing over the waiting moment, once there has been one. */
  cue(): Phaser.GameObjects.Image | null;
  /** Who is thinking in words now (floors-thoughts.ts): no picture over them meanwhile. */
  speaking(): ReadonlySet<string>;
}

/** Seated frames of a guest's moves sheet: hands in the lap, cup held, sipping, laughing with the cup. */
const SEATED = { sit: 8, hold: 9, sip: 10, laugh: 11 } as const;
/** A served guest's drink stands on the table, then is picked up, sipped and enjoyed, in seconds of this cycle. */
const SIP_CYCLE = { all: 7, table: 3.4, hold: 4.3, sip: 5.5 } as const;
/** Where things stand on a table, from a seat (plate pixels): the table top's near half, towards the guest. */
const TABLE = { top: -84, near: 62, single: 46, far: 28, size: 56 } as const;
/**
 * The ground floor's counter (plate pixels): its top's front edge, the pass beside the display, the bell,
 * the tip jar, a catering order at its left end, and Mina's map hanging on its front.
 */
const COUNTER = { top: 375, pass: [872, 914, 728], bell: 1066, jar: 742, order: 520, map: { x: 560, y: 492 }, size: 50 } as const;
/**
 * The cake display on the ground floor's plate: where its emptied picture goes (floor-fx-build.py
 * CASE, 24 rows lower on the plate than in its layer) and where baked goods stand on its shelves.
 */
export const CASE = { x: 1066, y: 286, shelves: [386, 452], columns: [1140, 1206, 1272], size: 46 } as const;
const BUBBLE_DEPTH = 100000;
const TEXT = { fontFamily: 'ui-rounded, "PingFang SC", system-ui, sans-serif', fontStyle: 'bold', stroke: '#fffaf0' } as const;
/** How much of a bubble's height, from its bottom, is tail, and so where its picture is centred. */
const INSIDE: Record<'bubble' | 'thought' | 'bubble-wide', number> = { bubble: .59, thought: .64, 'bubble-wide': .6 };
/** Where a speech bubble's paper ends and its tail begins, from its bottom. */
const BUBBLE_FOOT = .2;

type Picture = { texture: string; frame: string; alpha?: number };

export class FloorsProps {
  private ready = false;
  private pool = new Map<string, Phaser.GameObjects.Image>();
  private used = new Set<string>();
  /** Seconds of play: stops while the game is paused. */
  private clock = 0;
  private steam = 0;
  private bellRang = -1e9;
  /** Where the moment's cue last was, for the tip or the flash its answer brings. */
  private lastCue: { x: number; y: number; at: number } | null = null;

  constructor(private scene: Phaser.Scene, private sim: Sim, private view: CafeView, private getState: () => GameState,
    private cast: PropsCast, base: string) {
    void loadFx(scene, base).then(ok => { this.ready = ok; });
  }

  // ------------------------------------------------------------ drawing

  /** An image kept from frame to frame under a key; whatever is not asked for again goes. */
  private show(key: string, texture: string, frame: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    let image = this.pool.get(key);
    if (!image) {
      image = this.scene.add.image(x, y, texture, frame).setOrigin(.5, 1);
      this.pool.set(key, image);
    } else if (image.texture.key !== texture || image.frame.name !== frame) image.setTexture(texture, frame);
    this.used.add(key);
    return image.setPosition(x, y).setDepth(depth).setAlpha(1).setAngle(0).setScale(1);
  }

  /** A menu item's picture standing at a point, `size` across; a cup stands in for one without a picture. */
  private item(key: string, id: string, x: number, y: number, depth: number, size: number): Phaser.GameObjects.Image {
    const frame = itemFrame(id), has = this.scene.textures.get(FX_ITEMS).has(frame);
    const image = this.show(key, has ? FX_ITEMS : FX, has ? frame : 'cup', x, y, depth);
    return image.setScale(size / Math.max(image.width, image.height));
  }

  private picture(id: string): Picture {
    const frame = itemFrame(id);
    return this.scene.textures.get(FX_ITEMS).has(frame) ? { texture: FX_ITEMS, frame } : { texture: FX, frame: 'cup' };
  }

  /** A bubble over a head with one or two pictures in it, kept while it is asked for. */
  private bubble(key: string, head: { x: number; y: number }, kind: 'bubble' | 'thought' | 'bubble-wide', pictures: Picture[], scale: number): void {
    const back = this.show(key, FX, kind, head.x, head.y, BUBBLE_DEPTH).setScale(scale);
    const width = back.displayWidth, height = back.displayHeight, y = head.y - height * INSIDE[kind];
    const side = Math.min(height * .52, width * (pictures.length > 1 ? .4 : .62));
    pictures.forEach((p, k) => {
      const x = head.x + (k - (pictures.length - 1) / 2) * width * .44;
      const image = this.show(`${key}:${k}`, p.texture, p.frame, x, y, BUBBLE_DEPTH + .1 + k * .01).setOrigin(.5, .5);
      image.setScale(side / Math.max(image.width, image.height)).setAlpha(p.alpha ?? 1);
    });
  }

  /** A one-off picture that pops in, drifts up and fades. */
  private pop(frame: FxFrame, x: number, y: number, o: { size?: number; rise?: number; ms?: number; delay?: number; depth?: number } = {}): void {
    const image = this.scene.add.image(x, y, FX, frame).setDepth(o.depth ?? BUBBLE_DEPTH + 1).setAlpha(0);
    const scale = (o.size ?? 60) / Math.max(image.width, image.height);
    image.setScale(scale * .3);
    this.scene.tweens.add({ targets: image, scale, alpha: 1, delay: o.delay ?? 0, duration: 200, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: image, y: y - (o.rise ?? 60), alpha: 0, delay: (o.delay ?? 0) + (o.ms ?? 700), duration: 450, onComplete: () => image.destroy(),
    });
  }

  private label(text: string, x: number, y: number, size: number, color: string, rise = 70): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, text, { ...TEXT, fontSize: `${size}px`, color, strokeThickness: Math.round(size / 4.8) })
      .setOrigin(.5, 1).setDepth(BUBBLE_DEPTH + 2);
    this.scene.tweens.add({ targets: label, y: y - rise, alpha: { from: 1, to: 0 }, delay: 500, duration: 1000, onComplete: () => label.destroy() });
    return label;
  }

  private puff(x: number, y: number, depth: number): void {
    const puff = this.scene.add.image(x + Phaser.Math.Between(-6, 6), y, FX, 'puff').setDepth(depth).setScale(.3).setAlpha(.8);
    this.scene.tweens.add({ targets: puff, y: y - 46, scale: .62, alpha: 0, duration: 1500, onComplete: () => puff.destroy() });
  }

  private head(sprite: Phaser.GameObjects.Sprite): { x: number; y: number } {
    return { x: sprite.x, y: sprite.y - sprite.displayHeight - 4 };
  }

  // ------------------------------------------------------------ each frame

  /** Draws the props for where everyone is now. `dt` is 0 while the game is paused. */
  sync(b: Building, active: readonly number[], dt: number): void {
    if (!this.ready) return;
    this.clock += dt;
    this.steam -= dt;
    const steaming = this.steam <= 0;
    if (steaming) this.steam = .9;
    this.used.clear();
    const state = this.getState();
    // Behind the front walls only what floats over them would show: leave the heads bare.
    const heads = !outerWallShown();
    for (const c of this.sim.customers) {
      const actor = this.cast.customers.get(c.id);
      if (!actor) continue;
      this.atTable(b, c, actor, active, steaming);
      if (actor.cup) {
        // Leaving with their order: a paper cup, or a bakery bag when there was nothing to drink.
        const drink = isDrinkItem(c.order) || (!!c.extra && isDrinkItem(c.extra));
        if (actor.cup.frame.name !== (drink ? 'takeaway' : 'bag')) actor.cup.setTexture(FX, drink ? 'takeaway' : 'bag');
      }
      if (heads && actor.sprite.visible && actor.sprite.alpha > .6) this.overHead(c, actor);
    }
    this.onCounter(b, state, steaming);
    this.reserved(b, state, active);
    this.parcel(b);
    this.trays(heads);
    this.batches(heads, state);
    this.brewing(heads);
    this.display(b, state);
    this.cue();
    for (const [key, image] of this.pool) {
      if (this.used.has(key)) continue;
      image.destroy();
      this.pool.delete(key);
    }
  }

  /** A seated guest's table: its number card while they wait, then what they ordered. */
  private atTable(b: Building, c: Customer, actor: PropActor, active: readonly number[], steaming: boolean): void {
    if (c.seat < 0 || (c.phase !== 'waiting' && c.phase !== 'sitting')) return;
    const { sprite } = actor;
    // Only once they have sat down: the scene has them on a seated frame.
    if (sprite.texture.key !== `${actor.art}-moves` || Number(sprite.frame.name) < SEATED.sit || sprite.alpha < .6) return;
    const seats = tableSeats(Math.floor(c.seat / 2), active), seat = seats[c.seat % 2];
    const centre = (seats[0].x + seats[1].x) / 2, side = seat.x < centre ? -1 : 1;
    const place = (reach: number, lift = 0) => worldPoint(b, { floor: seat.floor, x: centre + side * reach, y: seat.y + TABLE.top + lift });
    const depth = sprite.depth + .5;
    if (c.phase === 'waiting' || !c.hasCup) {
      const at = place(TABLE.single);
      this.show(`tent:${c.id}`, FX, 'tent', at.x, at.y, depth).setFlipX(side > 0);
      sprite.setFrame(SEATED.sit);
      return;
    }
    const items = c.extra ? [c.order, c.extra] : [c.order];
    const drink = items.find(isDrinkItem), food = items.find(id => !isDrinkItem(id));
    // With a drink they pick it up to sip; with only a pastry their hands stay in their lap.
    const phase = (actor.clock + c.id * 1.3) % SIP_CYCLE.all;
    const onTable = !drink || phase < SIP_CYCLE.table;
    sprite.setFrame(onTable ? SEATED.sit : phase < SIP_CYCLE.hold ? SEATED.hold : phase < SIP_CYCLE.sip ? SEATED.sip : SEATED.laugh);
    if (food) {
      const at = drink ? place(TABLE.far, 8) : place(TABLE.single);
      this.item(`food:${c.id}`, food, at.x, at.y, depth + .01, TABLE.size);
    }
    if (drink && onTable) {
      const at = food ? place(TABLE.near, -2) : place(TABLE.single);
      const image = this.item(`drink:${c.id}`, drink, at.x, at.y, depth, TABLE.size);
      if (steaming && isHotDrink(drink) && Math.random() < .45) this.puff(at.x, at.y - image.displayHeight + 6, depth + .02);
    }
  }

  /** Over a guest's head: a crown for a VIP, then what they ask for, miss, or wait for. */
  private overHead(c: Customer, actor: PropActor): void {
    const head = this.head(actor.sprite), now = this.scene.time.now;
    let top = head.y;
    // The moment's cue has the space over its guest.
    if (this.view.moment?.customerId === c.id && c.phase !== 'ordering') return;
    if (this.cast.speaking().has(`customer:${c.id}`)) return;
    const order = [c.order, ...(c.extra ? [c.extra] : [])].map(id => this.picture(id));
    const urgent = (c.phase === 'queue' && c.patience < 12) || (c.phase === 'waiting' && c.timer < 15);
    if (c.phase === 'ordering') {
      this.bubble(`say:${c.id}`, head, order.length > 1 ? 'bubble-wide' : 'bubble', order, order.length > 1 ? .92 : 1);
      top -= 150;
    } else if (c.soldOut && c.moodTimer > 0) {
      // "Sorry, we're out": the order, crossed out.
      this.bubble(`say:${c.id}`, head, 'bubble', [{ ...order[0], alpha: .45 }], 1);
      const cross = this.show(`out:${c.id}`, FX, 'cross', head.x, head.y - 156 * INSIDE.bubble, BUBBLE_DEPTH + .2).setOrigin(.5, .5);
      cross.setScale(84 / cross.width);
      top -= 150;
    } else if (c.mood === 'sad') {
      const drop = this.show(`drop:${c.id}`, FX, 'drop', head.x + (actor.sprite.flipX ? -46 : 46), head.y + 74, actor.sprite.depth + .2);
      drop.setScale(.8);
    } else if (urgent) {
      // Running out of patience: the hourglass blinks.
      if (Math.floor(now / 520) % 2 === 0) this.bubble(`think:${c.id}`, head, 'thought', [{ texture: FX, frame: 'hourglass' }], .78);
      top -= 110;
    } else if (c.phase === 'waiting' && actor.sprite.texture.key === `${actor.art}-moves` && Number(actor.sprite.frame.name) === SEATED.sit) {
      // At a table, thinking of what is on its way.
      this.bubble(`think:${c.id}`, head, 'thought', order.slice(0, 1), .74);
      top -= 106;
    } else if (c.phase === 'queue') {
      // In line, a few at a time think of what they came for, so neighbours' bubbles never collide.
      const place = Math.max(0, this.sim.queue.indexOf(c.id));
      if (Math.floor(this.clock / 2.6) % 3 === place % 3) {
        this.bubble(`think:${c.id}`, head, 'thought', order.slice(0, 1), .74);
        top -= 106;
      }
    }
    if (c.vip) {
      const crown = this.show(`vip:${c.id}`, FX, 'crown', head.x, top + 16, BUBBLE_DEPTH - 1);
      crown.setScale(.9);
    }
  }

  /** Mina's table, kept for her until she has sat there. */
  private reserved(b: Building, state: GameState, active: readonly number[]): void {
    const table = minaReservedTable(state);
    if (table === null || !active.includes(table)) return;
    const [left, right] = tableSeats(table, active);
    const at = worldPoint(b, { floor: left.floor, x: (left.x + right.x) / 2 + 48, y: left.y + TABLE.top + 12 });
    this.show('reserved', FX, 'reserved', at.x, at.y, worldPoint(b, left).y + .6);
  }

  /** The supplier's parcel waits on the front step until it is signed for or taken back. */
  private parcel(b: Building): void {
    if (this.view.moment?.kind !== 'delivery') return;
    const at = worldPoint(b, PARCEL);
    this.show('parcel', FX, 'parcel', at.x, at.y, at.y);
  }

  /**
   * On the counter: the tip jar, the bell, a catering order waiting to go, each barista's order as it is
   * finished, and plates waiting on the pass; on its front, Mina's map once she has brought it.
   */
  private onCounter(b: Building, state: GameState, steaming: boolean): void {
    if (b.offsets.ground === undefined) return;
    const depth = worldPoint(b, COUNTER_FRONT).y + .5, y = worldPoint(b, { floor: 'ground', x: 0, y: COUNTER.top }).y;
    const now = Date.now();
    this.show('jar', FX, `jar-${tillJarLevel(state, now)}`, COUNTER.jar, y, depth);
    if (state.orders.active && orderReady(state, now)) this.show('order', FX, `order-${state.orders.active.kind}`, COUNTER.order, y, depth);
    const map = minaMapChoice(state);
    if (map) this.show('map', FX, `map-${map}`, COUNTER.map.x, worldPoint(b, { floor: 'ground', ...COUNTER.map }).y, depth);
    const rung = (this.scene.time.now - this.bellRang) / 1000;
    this.show('bell', FX, 'bell', COUNTER.bell, y, depth).setScale(.7).setAngle(rung < .6 ? 14 * Math.sin(rung * 42) * (1 - rung / .6) : 0);
    this.sim.baristas.forEach((barista, i) => {
      const guest = barista.customerId === null ? undefined : this.sim.customers.find(c => c.id === barista.customerId);
      // The order appears on the counter as it nears done, and waits there while the barista calls it.
      const done = barista.total > 0 && barista.remaining < barista.total * .4;
      if (!guest || !(done || barista.calling > 0)) return;
      const spot = BARISTAS[i % BARISTAS.length], x = spot.x + Math.floor(i / BARISTAS.length) * 60;
      const items = guest.extra ? [guest.order, guest.extra] : [guest.order];
      items.forEach((id, k) => {
        const at = x + (k - (items.length - 1) / 2) * 52;
        const image = this.item(`made:${i}:${k}`, id, at, y, depth + .01 * k, COUNTER.size);
        if (steaming && isHotDrink(id)) this.puff(at, y - image.displayHeight + 6, depth + .1);
      });
    });
    this.sim.pass.slice(0, COUNTER.pass.length).forEach((plate, k) => {
      if (plate.items[0]) this.item(`pass:${k}`, plate.items[0], COUNTER.pass[k], y - 2, depth + .2, COUNTER.size);
    });
  }

  /** A server on the way to a table carries a tray with the dishes on it; one who heard the bell says so. */
  private trays(heads: boolean): void {
    this.sim.servers.forEach((server, i) => {
      const actor = this.cast.servers[i];
      if (!actor) return;
      // The tray takes the place of the scene's cup.
      actor.cup?.setVisible(false);
      const { sprite } = actor;
      if (!sprite.visible || sprite.alpha < .05 || actor.sunk) return;
      if (server.plates.length > 0 && server.phase !== 'toPass' && server.phase !== 'idle') {
        const x = sprite.x + (sprite.flipX ? -44 : 44), y = sprite.y - 84, depth = sprite.depth + .02;
        const tray = this.show(`tray:${i}`, FX, 'tray', x, y, depth).setScale(.8).setAlpha(sprite.alpha);
        const dishes = server.plates.slice(0, 3);
        dishes.forEach((plate, k) => {
          const id = plate.items[0];
          if (!id) return;
          const at = x + (k - (dishes.length - 1) / 2) * 30;
          this.item(`dish:${i}:${k}`, id, at, y - tray.displayHeight * .42 + (k % 2) * 5, depth + .01 + k * .001, 44).setAlpha(sprite.alpha);
        });
      }
      if (heads && server.ack > 0 && sprite.alpha > .6) {
        const head = this.head(sprite);
        this.show(`ack:${i}`, FX, 'bang', head.x, head.y - 6 * Math.abs(Math.sin(this.scene.time.now / 120)), BUBBLE_DEPTH).setScale(.62);
      }
    });
  }

  /** A bar filled as far as the work is, standing on a point. */
  private bar(key: string, at: { x: number; y: number }, done: number, depth = BUBBLE_DEPTH - 2): void {
    this.show(key, BAR.key, '__BASE', at.x, at.y, depth);
    const inside = BAR.width - 2 * BAR.edge;
    this.show(`${key}:fill`, BAR.fill, '__BASE', at.x, at.y, depth + .01).setCrop(0, 0, BAR.edge + inside * Math.max(.06, done), BAR.height);
  }

  /** How much of each barista's order is made: on the bubble their guest orders in, which is in front of them, or over their head. */
  private brewing(heads: boolean): void {
    if (!heads) return;
    this.sim.baristas.forEach((barista, i) => {
      const sprite = this.cast.baristas[i], done = brewShare(barista);
      if (done === null || !sprite?.visible) return;
      const key = `say:${barista.customerId}`, said = this.used.has(key) ? this.pool.get(key) : undefined;
      if (said) this.bar(`brew:${i}`, { x: said.x, y: said.y - said.displayHeight * BUBBLE_FOOT + BAR.height / 2 }, done, BUBBLE_DEPTH + .3);
      else if (!this.cast.speaking().has(`barista:${i}`)) this.bar(`brew:${i}`, this.head(sprite), done);
    });
  }

  /** A cook with a batch on thinks of what it is; at work on it, a bar shows how long they have left there. */
  private batches(heads: boolean, state: GameState): void {
    if (!heads) return;
    this.sim.cooks.forEach((cook, i) => {
      const actor = this.cast.cooks[i];
      if (!actor || !cook.batch || !actor.sprite.visible || actor.sprite.alpha < .6 || this.cast.speaking().has(`cook:${i}`)) return;
      const head = this.head(actor.sprite), done = actor.steps?.length ? null : bakeShare(this.sim, state, i);
      if (done !== null) this.bar(`bake:${i}`, head, done);
      // Cooks work side by side: every other thought floats higher, clear of its neighbour.
      const lift = Math.max(done === null ? 0 : BAR.height, (i % 2) * 64);
      this.bubble(`batch:${i}`, { x: head.x, y: head.y - lift }, 'thought', [this.picture(cook.batch.item)], .7);
    });
  }

  /** The cake display holds what is baked: today's plan while preparing, the shelf's stock once open. */
  private display(b: Building, state: GameState): void {
    if (b.offsets.ground === undefined || !this.scene.textures.exists(FX_CASE)) return;
    const depth = worldPoint(b, COUNTER_FRONT).y + .3;
    const corner = worldPoint(b, { floor: 'ground', x: CASE.x, y: CASE.y });
    this.show('case', FX_CASE, '__BASE', corner.x, corner.y, depth).setOrigin(0, 0);
    const count = (id: string) => (state.phase === 'prep' ? state.bakePlan : state.shelf)[id as keyof typeof state.shelf] ?? 0;
    const baked = menuItems(state).filter(m => !isDrinkItem(m.id) && count(m.id) > 0).slice(0, CASE.shelves.length * CASE.columns.length);
    baked.forEach((m, k) => {
      const at = worldPoint(b, { floor: 'ground', x: CASE.columns[k % CASE.columns.length], y: CASE.shelves[Math.floor(k / CASE.columns.length)] });
      this.item(`case:${k}`, m.id, at.x, at.y, depth + .01, CASE.size);
    });
  }

  /** The moment's cue shows what kind of moment it is, and remembers where it was. */
  private cue(): void {
    const cue = this.cast.cue(), moment = this.view.moment;
    if (!cue || !moment) return;
    const key = cueTexture(moment.kind);
    if (cue.texture.key !== key && this.scene.textures.exists(key)) cue.setTexture(key).setOrigin(.5, 1);
    if (!cue.visible) return;
    this.lastCue = { x: cue.x, y: cue.y - cue.displayHeight * .6, at: this.scene.time.now };
    // The page pops a moment's tip at this rectangle of the room view; here only its being there matters.
    this.view.momentTarget ??= { x: 0, y: 0, w: 1, h: 1 };
  }

  // ------------------------------------------------------------ what the page asks for

  /** A batch out of the oven rides up the food lift and turns up in the cake display. False until the art is here. */
  restocked(b: Building, item: string): boolean {
    if (!this.ready) return false;
    const picture = this.picture(item);
    const arrive = () => {
      const top = worldPoint(b, { floor: 'ground', x: 0, y: DISPLAY.top }).y, bottom = worldPoint(b, { floor: 'ground', x: 0, y: DISPLAY.bottom }).y;
      const x = (DISPLAY.left + DISPLAY.right) / 2;
      const back = this.scene.add.image(x, top - 8, FX, 'bubble').setOrigin(.5, 1).setDepth(BUBBLE_DEPTH);
      const inside = this.scene.add.image(x, top - 8 - back.height * INSIDE.bubble, picture.texture, picture.frame).setDepth(BUBBLE_DEPTH + .1);
      inside.setScale(back.width * .62 / Math.max(inside.width, inside.height));
      const parts = [back, inside];
      this.scene.tweens.add({ targets: parts, alpha: { from: 0, to: 1 }, duration: 180 });
      this.scene.time.delayedCall(1600, () => this.scene.tweens.add({ targets: parts, alpha: 0, duration: 220, onComplete: () => parts.forEach(p => p.destroy()) }));
      for (let k = 0; k < 7; k++) {
        this.pop('sparkle', Phaser.Math.Between(DISPLAY.left, DISPLAY.right), Phaser.Math.Between(top + 30, bottom), { size: 64, rise: 20, ms: 500, delay: k * 130 });
      }
    };
    if (b.offsets.basement === undefined) { arrive(); return true; }
    const hatch = worldPoint(b, LIFT_HATCH), shaft = worldPoint(b, LIFT_TOP);
    const riding = this.scene.add.image(hatch.x, hatch.y, picture.texture, picture.frame).setDepth(2);
    riding.setScale(84 / Math.max(riding.width, riding.height));
    this.scene.tweens.add({ targets: riding, y: shaft.y, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Sine.In', onComplete: () => { riding.destroy(); arrive(); } });
    return true;
  }

  /**
   * Shows what the page queued on the view: sale coins over the paying guest, a moment's tip, the
   * bell, help given to a barista or a guest, and celebrations. False until the art is here, when
   * the scene draws them its own way.
   */
  drain(b: Building | null): boolean {
    if (!this.ready) return false;
    const effects = this.view.effects.splice(0), labels = this.view.assistanceLabels.splice(0);
    const sales = this.view.sales.splice(0), tips = this.view.tips.splice(0);
    if (!b || this.view.renderSuspended) return true;
    const now = this.scene.time.now;
    if (effects.some(e => e.kind === 'bell')) {
      this.bellRang = now;
      if (b.offsets.ground !== undefined) {
        const at = worldPoint(b, { floor: 'ground', x: COUNTER.bell, y: COUNTER.top });
        this.pop('sparkle', at.x + 26, at.y - 64, { size: 40, rise: 26, ms: 250 });
      }
    }
    // Help: the words rise from whoever was helped, with sparkles and a heart (a guest) or steam (a brew).
    const forGuest = effects.some(e => e.kind === 'heart');
    labels.forEach((label, i) => {
      let sprite: Phaser.GameObjects.Sprite | undefined;
      if (forGuest) {
        const near = this.sim.customers.map(c => ({ c, d: Math.hypot(c.x - label.x, c.y - 38 - label.y) })).sort((a, c) => a.d - c.d)[0];
        sprite = near ? this.cast.customers.get(near.c.id)?.sprite : undefined;
      }
      sprite ??= this.cast.baristas.filter((_, k) => this.sim.isBrewing(k))[i] ?? this.cast.baristas[0];
      if (!sprite) return;
      const head = this.head(sprite);
      this.label(label.text, head.x, head.y - 130, 58, '#4f3b2f', 80);
      for (const dx of [-46, 0, 46]) this.pop('sparkle', head.x + dx, head.y - 20 - Math.abs(dx) * .5, { size: 46, rise: 40, ms: 400, delay: Math.abs(dx) * 3 });
      this.pop(forGuest ? 'heart' : 'puff', head.x, head.y - 60, { size: 60, rise: 70, ms: 600 });
    });
    for (const sale of sales) {
      const actor = sale.customerId === undefined ? undefined : this.cast.customers.get(sale.customerId);
      const at = actor ? this.head(actor.sprite) : worldPoint(b, { floor: 'ground', x: SERVICE[0].x, y: 330 });
      if (actor) this.pop('heart', at.x, at.y - 6, { size: 56, rise: 46, ms: 650 });
      const text = this.label(`+${formatMoney(sale.amount)}`, at.x + 30, at.y - 96, sale.vip ? 80 : 68, sale.vip ? '#b7791f' : '#8a5a1c');
      // The coin rides up beside the amount.
      const coin = this.scene.add.image(text.x - text.width / 2 - 36, text.y - text.height / 2, FX, 'coin').setDepth(BUBBLE_DEPTH + 2);
      coin.setScale((sale.vip ? 66 : 56) / coin.width);
      this.scene.tweens.add({ targets: coin, y: coin.y - 70, alpha: { from: 1, to: 0 }, delay: 500, duration: 1000, onComplete: () => coin.destroy() });
      if (sale.vip) for (let k = 0; k < 6; k++) this.pop('sparkle', at.x + Phaser.Math.Between(-90, 90), at.y - Phaser.Math.Between(0, 150), { size: 50, rise: 30, ms: 350, delay: k * 70 });
    }
    const cue = this.lastCue && now - this.lastCue.at < 1500 ? this.lastCue : null;
    const view = this.scene.cameras.main.worldView;
    for (const tip of tips) {
      const at = cue ?? { x: view.centerX, y: view.centerY - view.height * .1 };
      this.pop('tip', at.x - 70, at.y, { size: 84, rise: 70, ms: 900 });
      this.label(`+${formatMoney(tip.amount)}`, at.x + 40, at.y + 26, 68, '#8a5a1c');
    }
    // Sparkles the page scatters over the room: a camera flash at the moment just answered, or a
    // celebration (a goal reached, something bought) over the middle of the screen.
    const sparkles = effects.filter(e => e.kind === 'sparkle').length - labels.length * 3;
    if (sparkles >= 5) {
      for (let k = 0; k < Math.min(14, sparkles); k++) {
        const x = cue ? cue.x + Phaser.Math.Between(-110, 110) : view.centerX + Phaser.Math.Between(-view.width * .4, view.width * .4);
        const y = cue ? cue.y + Phaser.Math.Between(-60, 150) : view.centerY + Phaser.Math.Between(-view.height * .28, view.height * .12);
        this.pop('sparkle', x, y, { size: Phaser.Math.Between(50, 84), rise: 30, ms: 380, delay: k * 55 });
      }
    }
    return true;
  }
}
