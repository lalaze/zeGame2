import type { ItemId, StaticItemId } from '../game/data';
import { signatureDefinition } from '../game/signature-drinks';
import { Sim, seated, type Customer } from '../game/sim';
import type { GameState } from '../game/state';
import type { MessageKey } from '../i18n';
import { CHAR_H } from './sprites';

/** One cosmetic suggestion; the view owns timing, visibility and collision avoidance. */
export interface ThoughtCandidate {
  /** Stable actor identity for one visit (customers) or one job slot (staff). */
  id: string;
  key: MessageKey;
  x: number;
  /** Head top in world coordinates, not the top of the bubble. */
  y: number;
  /** Higher values favor time-sensitive moments over idle chatter. */
  priority: number;
  /** Stable while the same situation holds; never includes animation time. */
  context: string;
}

type Flavor = 'bold' | 'milky' | 'cocoa' | 'sweet' | 'tea' | 'spiced' | 'fruity' | 'buttery' | 'toasty' | 'tangy';
const FLAVORS: readonly Flavor[] = ['bold', 'milky', 'cocoa', 'sweet', 'tea', 'spiced', 'fruity', 'buttery', 'toasty', 'tangy'];

/**
 * Deliberately authored flavor notes, not an inference from category or price.
 * Kept in the view: these are subjective daydreams, never recipe/economy data.
 * Record<StaticItemId, ...> requires an authored choice for every stock dish.
 * Custom recipes derive cosmetic notes from their immutable ingredients.
 */
const ITEM_FLAVORS: Record<StaticItemId, readonly Flavor[]> = {
  espresso: ['bold'],
  americano: ['bold'],
  latte: ['milky', 'bold'],
  cappuccino: ['milky', 'bold'],
  flatwhite: ['bold', 'milky'],
  cortado: ['bold', 'milky'],
  mocha: ['cocoa', 'milky'],
  vienna: ['bold', 'milky', 'cocoa'],
  macchiato: ['sweet', 'milky'],
  coldbrew: ['bold', 'sweet'],
  dirty: ['bold', 'milky'],
  pourover: ['bold'],
  creamcoffee: ['bold', 'milky', 'sweet'],
  affogato: ['sweet', 'milky', 'bold'],
  blacktea: ['tea'],
  hotchoc: ['cocoa', 'sweet'],
  lemontea: ['tea', 'tangy', 'fruity'],
  chai: ['spiced', 'tea', 'milky'],
  fruittea: ['tea', 'fruity', 'sweet'],
  hojicha: ['tea', 'toasty', 'milky'],
  matcha: ['tea', 'milky'],
  frappe: ['sweet', 'milky'],
  smoothie: ['fruity', 'milky'],
  milktea: ['tea', 'milky'],
  matchafloat: ['tea', 'milky', 'sweet'],
  roll: ['buttery', 'toasty'],
  bagel: ['toasty'],
  baguette: ['toasty'],
  cheesebun: ['milky', 'buttery'],
  pretzel: ['toasty', 'buttery'],
  focaccia: ['spiced', 'toasty'],
  ciabatta: ['toasty'],
  raisinbread: ['fruity', 'sweet', 'toasty'],
  sourdough: ['tangy', 'toasty'],
  rye: ['spiced', 'toasty'],
  chocobread: ['cocoa', 'milky', 'buttery'],
  shokupan: ['milky', 'sweet'],
  brioche: ['buttery', 'sweet'],
  fruitbrioche: ['fruity', 'buttery', 'sweet'],
  garlicbread: ['spiced', 'buttery'],
  donut: ['sweet'],
  scone: ['buttery', 'fruity'],
  cookie: ['sweet', 'buttery', 'cocoa'],
  croissant: ['buttery', 'toasty'],
  painchoc: ['cocoa', 'buttery'],
  brownie: ['cocoa', 'sweet'],
  cinnamon: ['spiced', 'sweet'],
  muffin: ['fruity', 'sweet'],
  creampuff: ['milky', 'buttery', 'sweet'],
  melonpan: ['sweet', 'buttery'],
  eggtart: ['milky', 'buttery'],
  cake: ['fruity', 'sweet'],
  swissroll: ['milky', 'fruity', 'sweet'],
  cheesecake: ['tangy', 'milky'],
  macaron: ['sweet'],
};

/** Immutable recipe flavors; display-only and independent of delivery accounting. */
function itemFlavors(id: ItemId): readonly Flavor[] {
  const custom = signatureDefinition(id);
  if (!custom) return ITEM_FLAVORS[id as StaticItemId] ?? [];
  const recipe = custom.recipe;
  const flavors: Flavor[] = [];
  if (recipe.beans) flavors.push('bold');
  if (recipe.milk || recipe.cream) flavors.push('milky');
  if (recipe.cocoa) flavors.push('cocoa');
  if (recipe.sugar) flavors.push('sweet');
  if (recipe.tea || recipe.matcha) flavors.push('tea');
  if (recipe.spice) flavors.push('spiced');
  if (recipe.fruit) flavors.push('fruity');
  return flavors;
}

function identity(c: Customer): number {
  if (Number.isInteger(c.appearanceId) && c.appearanceId! >= 0) return c.appearanceId!;
  // Old/test customers without a cast ID still keep a stable, appearance-based taste.
  const l = c.look;
  return (((l.skin * 6 + l.hair) * 4 + l.hairStyle) * 8 + l.shirt) * 3 + l.pants;
}

type Thought = Pick<ThoughtCandidate, 'key' | 'priority' | 'context'>;
const thought = (key: MessageKey, context: string, priority: number): Thought => ({ key, context, priority });

function taste(c: Customer): Thought {
  const person = identity(c);
  const liked = FLAVORS[person % FLAVORS.length];
  // With ten flavors these can never be the same; tastes persist across visits.
  const avoided = FLAVORS[(person * 3 + 5) % FLAVORS.length];
  const items = c.extra ? [c.order, c.extra] : [c.order];
  for (const item of items) {
    const flavors = itemFlavors(item);
    if (flavors.includes(liked))
      return thought(`thought.like.${liked}`, `taste:like:${item}:${liked}`, 50);
    if (flavors.includes(avoided))
      return thought(`thought.dislike.${avoided}`, `taste:dislike:${item}:${avoided}`, 50);
  }
  return thought(person % 2 ? 'thought.customer.enjoy' : 'thought.customer.cozy', 'taste:enjoy', 40);
}

function customerThought(c: Customer): Thought | null {
  // The existing order and crossed-out sold-out icons have right of way.
  if (c.phase === 'ordering' || (c.soldOut && c.moodTimer > 0)) return null;
  switch (c.phase) {
    case 'queue':
      if (c.patience < 12) return thought('thought.customer.urgent', 'queue:urgent', 100);
      if (c.stride < 24) return thought('thought.customer.arrive', 'queue:arrive', 35);
      return thought('thought.customer.queue', 'queue:waiting', 30);
    case 'toCounter':
      return thought('thought.customer.myTurn', 'counter:approaching', 45);
    case 'toSeat':
      return thought('thought.customer.findSeat', 'seat:approaching', 40);
    case 'waiting':
      return c.timer < 15
        ? thought('thought.customer.urgent', 'table:urgent', 100)
        : thought('thought.customer.wait', 'table:waiting', 35);
    case 'sitting':
      // Delivery sets both fields. Never invent a taste before the order arrives,
      // and takeaway guests never enter this branch.
      if (!c.dineIn || !c.hasCup) return null;
      if (c.mood === 'happy' && c.moodTimer > 0)
        return thought('thought.customer.served', 'table:served', 80);
      return taste(c);
    case 'exiting':
      if (c.soldOut) return thought('thought.customer.nextTime', 'exit:soldout', 45);
      if (!c.hasCup) return thought('thought.customer.leave', 'exit:unserved', 40);
      return c.dineIn
        ? thought('thought.customer.goodbye', 'exit:dined', 40)
        : thought('thought.customer.takeaway', 'exit:takeaway', 55);
  }
}

/**
 * Pure, deterministic snapshot of plausible thoughts. No clocks, random draws,
 * simulation writes, save fields or gameplay consequences. Customer identity
 * supplies flavor preferences; urgency comes only from real simulation timers.
 *
 * Anchors match the character head tops. The renderer should reserve room for
 * remaining crown/heart/progress icons above them. Order/sold-out bubbles,
 * barista calls and server acknowledgements suppress thoughts entirely.
 */
export function thoughtCandidates(sim: Sim, state: GameState): ThoughtCandidate[] {
  if (state.phase !== 'open') return [];
  const candidates: ThoughtCandidate[] = [];
  const add = (id: string, x: number, y: number, value: Thought) => {
    candidates.push({ id, x, y, ...value });
  };

  for (const c of sim.customers) {
    const value = customerThought(c);
    if (value) add(`customer:${c.id}`, c.x, c.y - CHAR_H - (seated(c) ? 5 : 0), value);
  }

  sim.baristas.forEach((b, i) => {
    if (b.calling > 0) return;
    const pose = sim.baristaPose(i);
    let value: Thought;
    if (sim.isHolding(i)) value = thought('thought.staff.orderReady', 'order:ready', 65);
    else if (sim.isBrewing(i)) value = thought(i === 0 ? 'thought.owner.working' : 'thought.barista.working', 'order:working', 35);
    else if (b.customerId !== null) value = thought(i === 0 ? 'thought.owner.welcome' : 'thought.barista.welcome', 'order:welcome', 30);
    else value = thought(i === 0 ? 'thought.owner.idle' : 'thought.barista.idle', 'order:idle', 15);
    add(`barista:${i}`, pose.x, pose.y - CHAR_H, value);
  });

  sim.servers.forEach((server, i) => {
    if (server.ack > 0) return;
    let value: Thought;
    if (server.phase === 'delivering' && server.plates.length > 0)
      value = thought('thought.server.deliver', 'tray:delivering', 55);
    else if (server.phase === 'toPass') value = thought('thought.server.pickup', 'tray:pickup', 35);
    else if (server.phase === 'returning') value = thought('thought.server.return', 'tray:returning', 25);
    else value = thought('thought.server.idle', 'tray:idle', 15);
    add(`server:${i}`, server.x, server.y - CHAR_H, value);
  });

  if (state.kitchen) sim.cooks.forEach((cook, i) => {
    const at = sim.cookStation(i);
    let value: Thought;
    if (!at) value = thought('thought.cook.idle', 'batch:idle', 15);
    else if (at.station === 'door') value = thought('thought.cook.ready', 'batch:ready', 65);
    else if (!at.working) value = thought('thought.cook.carry', `batch:carry:${at.station}`, 25);
    else {
      const stationKeys: Record<typeof at.station, MessageKey> = {
        cooler: 'thought.cook.gather', dryStore: 'thought.cook.gather',
        mixer: 'thought.cook.mix', standMixer: 'thought.cook.mix',
        proofer: 'thought.cook.rise', bench: 'thought.cook.prep',
        sheeter: 'thought.cook.fold', kettle: 'thought.cook.boil',
        deckOven: 'thought.cook.bake', convection: 'thought.cook.bake',
        fryer: 'thought.cook.fry', rack: 'thought.cook.cool',
        pastryFridge: 'thought.cook.chill',
      };
      value = thought(stationKeys[at.station], `batch:working:${at.station}`, 35);
    }
    add(`cook:${i}`, cook.x, cook.y - CHAR_H, value);
  });
  return candidates;
}
