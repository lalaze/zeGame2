// What guests like. Each dish carries a few authored flavor notes, and each guest a
// lasting liked and avoided flavor, so a regular face keeps the same taste on every visit.
import type { ItemId, StaticItemId } from './data';
import { signatureDefinition } from './signature-drinks';
import type { Look } from './state';

/** Just enough of a customer to know who they are. */
type Guest = { appearanceId?: number; look: Look };

export type Flavor = 'bold' | 'milky' | 'cocoa' | 'sweet' | 'tea' | 'spiced' | 'fruity' | 'buttery' | 'toasty' | 'tangy';
export const FLAVORS: readonly Flavor[] = ['bold', 'milky', 'cocoa', 'sweet', 'tea', 'spiced', 'fruity', 'buttery', 'toasty', 'tangy'];

/**
 * Deliberately authored flavor notes, not an inference from category or price.
 * They color guests' thoughts and decide how a recommended dish lands; they never
 * change recipes, prices or the simulation's own choices.
 * Record<StaticItemId, ...> requires an authored choice for every stock dish.
 * Custom recipes derive their notes from their immutable ingredients.
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

/** Immutable recipe flavors, independent of delivery accounting. */
export function itemFlavors(id: ItemId): readonly Flavor[] {
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

/** A stable number per guest: their cast appearance, or their look for older visits. */
export function guestIdentity(c: Guest): number {
  if (Number.isInteger(c.appearanceId) && c.appearanceId! >= 0) return c.appearanceId!;
  // Old/test customers without a cast ID still keep a stable, appearance-based taste.
  const l = c.look;
  return (((l.skin * 6 + l.hair) * 4 + l.hairStyle) * 8 + l.shirt) * 3 + l.pants;
}


export interface GuestTaste { liked: Flavor; avoided: Flavor }
/** A guest's lasting taste: with ten flavors the two can never be the same. */
export function guestTaste(c: Guest): GuestTaste {
  const person = guestIdentity(c);
  return { liked: FLAVORS[person % FLAVORS.length], avoided: FLAVORS[(person * 3 + 5) % FLAVORS.length] };
}
