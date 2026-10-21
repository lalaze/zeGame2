// Optional café moments during service: a guest in line asks what to order, a regular
// waves hello, the cat knocks over a cup, a seated guest wants a photo, or a supplier's
// parcel turns up at the door. They reward watching and never punish looking away: an
// unanswered moment simply fades and changes nothing. Only the player's answer alters
// an order, a tip, a regular's patience, the coins or the pantry. Timing uses its own
// random source, so the seeded simulation (and every balance audit) is untouched when
// nobody plays.
import { averageDishPrice, earn, isBakery, menuItems, readyServings, recipe, servingCost } from './economy';
import { guestTaste, itemFlavors, type GuestTaste } from './flavors';
import type { IngredientId, ItemId } from './data';
import { DOOR_W, DOOR_X, SCENE_W, areaAtPoint, sceneHeight } from './layout';
import type { AreaId } from './regions';
import { regularGuestDefinition, regularGuestProgress } from './regular-guests';
import { seated, type Customer, type Sim } from './sim';
import type { GameState } from './state';
import type { MessageKey } from '../i18n';

export type MomentKind = 'recommend' | 'greet' | 'cat' | 'photo' | 'delivery';
/** Where a moment without a guest sits: the knocked-over cup, or the parcel by the door. */
export interface MomentSpot { x: number; y: number; area: AreaId; catId?: string; sill?: boolean }
export interface Moment {
  kind: MomentKind;
  /** The guest the cue hangs over (recommendations, greetings and photos). */
  customerId?: number;
  /** Dishes the guest is choosing between (recommendations only). */
  options: ItemId[];
  spot?: MomentSpot;
  /** What the parcel holds (deliveries only). */
  gift?: MomentGift;
  /** Real seconds the cue has waited for a tap. */
  age: number;
}
export type RecommendVerdict = 'love' | 'fine' | 'meh';
/** A supplier's sample: the ingredients for a few servings of one of today's dishes. */
export interface MomentGift { item: ItemId; servings: number; ingredients: Partial<Record<IngredientId, number>> }
/** The guest's spoken answer, shown above them for a few real seconds. */
export interface MomentReaction { customerId: number; key: MessageKey; context: string; ttl: number }

/** A cat that could tip a cup over right now: awake, standing still, at its feet. */
export interface MomentCat { id: string; x: number; y: number; area: AreaId; sill?: boolean }
/** What the player can see, so a cue only starts where it can be noticed. */
export interface MomentStage {
  /** The room on screen; null while the map is open or the camera is moving. */
  area: AreaId | null;
  cats: readonly MomentCat[];
}
const MAIN_STAGE: MomentStage = { area: 'main', cats: [] };

/** Extra share of the visit's bill, paid with it. */
export const RECOMMEND_TIP: Record<RecommendVerdict, number> = { love: 0.5, fine: 0.15, meh: 0 };
export const GREET_TIP = 0.2;
/** A greeted regular waits this much longer in line before giving up. */
export const GREET_PATIENCE = 8;
/** Coins for tidying the cat's mess or taking a photo, in average dishes. */
export const CAT_REWARD = 0.5;
export const PHOTO_REWARD = 0.75;
/** A supplier's free sample covers about this many average dishes' takings, within a
 * sensible number of servings: ingredients are cheap next to a levelled dish's price. */
export const DELIVERY_VALUE = 1.5;
export const SAMPLE_SERVINGS = { min: 3, max: 12 } as const;
/** Parcels offered per day, signed for or not. */
export const DELIVERIES_PER_DAY = 2;
/** Real seconds of open service before the first moment and between later ones. The
 * speed setting changes how fast a day passes, not how often the player is asked. */
const FIRST_GAP = 12, GAP_MIN = 20, GAP_SPREAD = 20;
/** Real seconds a cue waits for a tap before quietly fading. */
export const CUE_SECONDS = 14;
/** Long enough to read a line of a regular's story. */
const REACTION_SECONDS = 5.5;
/** Guests close to giving up are not asked to wait on a decision. */
const MIN_PATIENCE = 15;
/** Seated guests about to leave (or give up on their order) don't pose for photos. */
const PHOTO_SITTING = 5, PHOTO_WAITING = 20;
/** How often each kind comes up when several could; the last kind is less likely again. */
const WEIGHTS = { recommend: 3, photo: 2, cat: 2, delivery: 1 } as const;
type Pickable = keyof typeof WEIGHTS;

/** How a dish lands with a guest: a liked note without an avoided one is a hit. */
export function recommendVerdict(item: ItemId, taste: GuestTaste): RecommendVerdict {
  const flavors = itemFlavors(item), liked = flavors.includes(taste.liked), avoided = flavors.includes(taste.avoided);
  return liked && !avoided ? 'love' : avoided && !liked ? 'meh' : 'fine';
}

/** Servings already spoken for by guests ahead in line or at the counter. */
function claimed(sim: Sim, id: ItemId, guest: Customer): number {
  return sim.customers.filter((c) => c !== guest && (c.phase === 'queue' || c.phase === 'toCounter') && (c.order === id || c.extra === id)).length;
}

/**
 * Two of today's dishes of the same kind as the guest's own pick (drink or bakery, so
 * combos stay valid), each with stock to spare after everyone ahead: one they would
 * love and one they would not, ideally one they'd rather avoid. Empty when the menu
 * can't offer that real choice.
 */
export function recommendOptions(state: GameState, sim: Sim, c: Customer, random: () => number): ItemId[] {
  const bakery = isBakery(c.order), taste = guestTaste(c);
  const pool = menuItems(state).map((m) => m.id)
    .filter((id) => id !== c.order && id !== c.extra && isBakery(id) === bakery && readyServings(state, id) >= claimed(sim, id, c) + 2);
  const loved = pool.filter((id) => recommendVerdict(id, taste) === 'love');
  const meh = pool.filter((id) => recommendVerdict(id, taste) === 'meh');
  const others = meh.length ? meh : pool.filter((id) => recommendVerdict(id, taste) === 'fine');
  if (!loved.length || !others.length) return [];
  const pick = (list: ItemId[]) => list[Math.floor(random() * list.length)];
  const options = [pick(loved), pick(others)];
  return random() < 0.5 ? options : options.reverse();
}

/** Set down just inside the front door, off the runner: clear of the centred toast and
 * of the doorstep, which phone layouts can cover with the guide card. */
export const deliverySpot = (): MomentSpot => ({ x: DOOR_X + DOOR_W + 44, y: sceneHeight() - 32, area: 'main' });

/** The ingredients for a few servings of one of today's dishes. */
export function deliveryGift(state: GameState, random: () => number): MomentGift | null {
  // Bakery stock is baked ahead; only a kitchen turns new flour into more of it.
  const dishes = menuItems(state).filter(({ id }) => (!isBakery(id) || state.kitchen) && servingCost(id) > 0);
  if (!dishes.length) return null;
  const item = dishes[Math.floor(random() * dishes.length)].id;
  const servings = Math.max(SAMPLE_SERVINGS.min, Math.min(SAMPLE_SERVINGS.max,
    Math.round(DELIVERY_VALUE * averageDishPrice(state) / servingCost(item))));
  return { item, servings, ingredients: Object.fromEntries(recipe(item).map(([ing, n]) => [ing, n * servings])) };
}

/** Coins paid on the spot; they count toward today's takings. */
function reward(state: GameState, dishes: number): number {
  const amount = Math.round(dishes * averageDishPrice(state) * 100) / 100;
  if (amount <= 0) return 0;
  earn(state, amount);
  state.today.revenue += amount;
  return amount;
}

const stillWaiting = (m: Moment, c: Customer) =>
  m.kind === 'recommend' ? c.phase === 'queue'
    : m.kind === 'photo' ? seated(c)
    : c.phase === 'queue' || c.phase === 'toCounter';

export class MomentDirector {
  active: Moment | null = null;
  reaction: MomentReaction | null = null;
  /** Real open-service seconds since the last moment ended. */
  private since = 0;
  private nextGap = FIRST_GAP;
  private offered = new Set<number>();
  private deliveries = 0;
  private last: MomentKind | null = null;
  private day = -1;
  private serial = 0;

  constructor(private random: () => number = Math.random) {}

  /** A new café or a reloaded service: nothing pending, nobody asked yet. */
  reset(): void {
    this.active = null; this.reaction = null; this.offered.clear();
    this.since = 0; this.nextGap = FIRST_GAP; this.day = -1; this.deliveries = 0; this.last = null;
  }

  /**
   * `simDt` follows the café clock; `realDt` is how much real time passed. Both are 0
   * while paused, so cues neither start nor fade behind a dialog.
   */
  update(state: GameState, sim: Sim, simDt: number, realDt: number, stage: MomentStage = MAIN_STAGE): void {
    if (this.reaction && (this.reaction.ttl -= realDt) <= 0) this.reaction = null;
    if (state.day !== this.day) { this.reset(); this.day = state.day; }
    if (state.phase !== 'open') { this.active = null; return; }
    if (this.active) {
      const m = this.active;
      const c = m.customerId === undefined ? undefined : sim.customers.find((x) => x.id === m.customerId);
      m.age += realDt;
      if ((m.customerId !== undefined && (!c || !stillWaiting(m, c))) || m.age > CUE_SECONDS) this.end();
      return;
    }
    if (simDt <= 0 || realDt <= 0) return;
    this.since += realDt;
    const unasked = (c: Customer) => !this.offered.has(c.id);
    if (this.since < this.nextGap || !stage.area) return;
    // A regular in line comes first: their story is the rarest thing to see.
    if (stage.area === 'main') {
      const regular = sim.customers.find((c) => c.regularGuestId && c.phase === 'queue' && unasked(c));
      if (regular) return this.start({ kind: 'greet', customerId: regular.id, options: [], age: 0 });
    }
    const offers: Partial<Record<Pickable, () => Moment | null>> = {};
    if (stage.area === 'main') {
      offers.recommend = () => {
        const waiting = sim.customers.filter((c) => c.phase === 'queue' && !c.regularGuestId && unasked(c) && c.patience >= MIN_PATIENCE);
        while (waiting.length) {
          const c = waiting.splice(Math.floor(this.random() * waiting.length), 1)[0];
          const options = recommendOptions(state, sim, c, this.random);
          if (options.length === 2) return { kind: 'recommend', customerId: c.id, options, age: 0 };
        }
        return null;
      };
      if (this.deliveries < DELIVERIES_PER_DAY) offers.delivery = () => {
        const gift = deliveryGift(state, this.random);
        return gift ? { kind: 'delivery', options: [], spot: deliverySpot(), gift, age: 0 } : null;
      };
    }
    offers.photo = () => {
      const posing = sim.customers.filter((c) => unasked(c) && areaAtPoint(c.x, c.y) === stage.area &&
        (c.phase === 'sitting' ? c.timer >= PHOTO_SITTING : c.phase === 'waiting' && c.timer >= PHOTO_WAITING));
      const c = posing[Math.floor(this.random() * posing.length)];
      return c ? { kind: 'photo', customerId: c.id, options: [], age: 0 } : null;
    };
    offers.cat = () => {
      const cats = stage.cats.filter((cat) => cat.area === stage.area);
      const cat = cats[Math.floor(this.random() * cats.length)];
      // The cup lands beside the cat: on the sill, or on the floor away from the near wall.
      const side = cat && !cat.sill && cat.x % SCENE_W > SCENE_W - 60 ? -10 : 10;
      return cat ? { kind: 'cat', options: [], spot: { x: cat.x + side, y: cat.y, area: cat.area, catId: cat.id, sill: cat.sill }, age: 0 } : null;
    };
    const kinds = Object.keys(offers) as Pickable[];
    while (kinds.length) {
      const weight = (kind: Pickable) => WEIGHTS[kind] * (kind === this.last ? 0.25 : 1);
      let roll = this.random() * kinds.reduce((sum, kind) => sum + weight(kind), 0);
      const kind = kinds.find((k) => (roll -= weight(k)) < 0) ?? kinds[kinds.length - 1];
      kinds.splice(kinds.indexOf(kind), 1);
      const moment = offers[kind]!();
      if (moment) return this.start(moment);
    }
  }

  /** The player's pick: the guest orders it, and tips by how well it suits them. */
  recommend(sim: Sim, item: ItemId): RecommendVerdict | null {
    const m = this.active;
    const c = m?.kind === 'recommend' && m.options.includes(item) ? sim.customers.find((x) => x.id === m.customerId) : undefined;
    if (!c || c.phase !== 'queue') { this.end(); return null; }
    const verdict = recommendVerdict(item, guestTaste(c));
    c.order = item;
    c.momentTip = RECOMMEND_TIP[verdict];
    if (verdict === 'love') { c.mood = 'happy'; c.moodTimer = 1.5; }
    this.react(c, `moment.recommend.${verdict}` as MessageKey);
    this.end();
    return verdict;
  }

  /**
   * Waving back: the regular shares what's on their mind (the story they'll tell in the
   * journal next), waits a little longer and tips a little more.
   */
  greet(state: GameState, sim: Sim): MessageKey | null {
    const m = this.active;
    const c = m?.kind === 'greet' ? sim.customers.find((x) => x.id === m.customerId) : undefined;
    const guest = c?.regularGuestId ? regularGuestDefinition(c.regularGuestId) : undefined;
    if (!c || !guest || !stillWaiting(m!, c)) { this.end(); return null; }
    c.momentTip = GREET_TIP;
    if (c.phase === 'queue') c.patience += GREET_PATIENCE;
    c.mood = 'happy'; c.moodTimer = 1.5;
    const unlocked = regularGuestProgress(state, guest.id)?.unlockedChapters.length ?? 0;
    this.react(c, `moment.greet.${guest.id}.${Math.min(unlocked, guest.chapters.length - 1) + 1}` as MessageKey);
    this.end();
    return guest.nameKey;
  }

  /** Tidying up after the cat: a guest who saw it all laughs and tips. Returns the coins. */
  tidy(state: GameState): number | null {
    if (this.active?.kind !== 'cat' || state.phase !== 'open') { this.end(); return null; }
    this.end();
    return reward(state, CAT_REWARD);
  }

  /** Taking the guest's photo: they beam, say thanks and tip. Returns the coins. */
  photo(state: GameState, sim: Sim): number | null {
    const m = this.active;
    const c = m?.kind === 'photo' ? sim.customers.find((x) => x.id === m.customerId) : undefined;
    if (!c || !stillWaiting(m!, c) || state.phase !== 'open') { this.end(); return null; }
    c.mood = 'happy'; c.moodTimer = 1.5;
    this.react(c, 'moment.photo.thanks');
    this.end();
    return reward(state, PHOTO_REWARD);
  }

  /** Signing for the parcel: the sample goes straight into the pantry. */
  signDelivery(state: GameState): MomentGift | null {
    const gift = this.active?.kind === 'delivery' ? this.active.gift : undefined;
    if (!gift || state.phase !== 'open') { this.end(); return null; }
    for (const [ing, n] of Object.entries(gift.ingredients) as [IngredientId, number][]) state.pantry[ing] += n;
    this.end();
    return gift;
  }

  /** "Let them choose": the guest keeps their own order. */
  dismiss(): void { this.end(); }

  private start(moment: Moment): void {
    if (moment.customerId !== undefined) this.offered.add(moment.customerId);
    if (moment.kind === 'delivery') this.deliveries++;
    this.active = moment;
    this.last = moment.kind;
  }

  private end(): void {
    this.active = null;
    this.since = 0;
    this.nextGap = GAP_MIN + this.random() * GAP_SPREAD;
  }

  private react(c: Customer, key: MessageKey): void {
    this.reaction = { customerId: c.id, key, context: `moment:${++this.serial}`, ttl: REACTION_SECONDS };
  }
}
