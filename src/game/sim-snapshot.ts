import { signatureDefinition } from './signature-drinks';
import { isGuestKind } from './customer-demand';
import { regularGuestDefinition } from './regular-guests';
import { memoryGuest } from './guest-memories';
import { MAX_COOK_BATCH, MAX_PASS_SLOTS, MENU } from './data';
import { MAX_SCENE_H, MAX_SERVERS, MIN_SCENE_H, TOTAL_TABLE_SPOTS } from './layout';
import { CUSTOMER_CAST, validCustomerCastSnapshot, type CustomerCastSnapshot } from './customer-cast';
import { STATION_SECONDS } from './kitchen';
import type { Barista, Cook, Customer, Plate, Server } from './sim';
import type { GameState, Phase } from './state';
import type { ItemId } from './data';

export interface SimSnapshot {
  version: number; kitchenLevel: number; day: number; phase: Phase; served: number; height: number;
  customers: Customer[]; baristas: Barista[]; cooks: Cook[]; servers: Server[];
  queue: number[]; seats: (number | null)[]; pass: Plate[]; rack: ItemId[];
  spawnTimer: number; nextId: number; boostCooldown: number;
  customerCast: CustomerCastSnapshot; castRandomState: number;
}

type Obj = Record<string, unknown>;
const obj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const positive = (x: unknown): x is number => finite(x) && x >= 0;
const integer = (x: unknown): x is number => positive(x) && Number.isSafeInteger(x);
const item = (x: unknown): x is ItemId => MENU.some((m) => m.id === x) || typeof x === 'string' && signatureDefinition(x) !== null;
const list = (x: unknown, max: number, check: (v: unknown) => boolean): x is unknown[] => Array.isArray(x) && x.length <= max && x.every(check);
const point = (x: unknown) => obj(x) && finite(x.x) && finite(x.y) && Math.abs(x.x) < 10000 && Math.abs(x.y) < 10000;
const look = (x: unknown) => obj(x) && ['skin','hair','hairStyle','shirt','pants'].every((k) => integer(x[k]) && x[k] < 8);
const walker = (x: Obj) => point(x) && point({ x: x.tx, y: x.ty }) && positive(x.stride) && list(x.via, 128, point) &&
  (x.pathBlocked === undefined || typeof x.pathBlocked === 'boolean') &&
  (x.journey === undefined || list(x.journey, 64, point));
const nullableId = (x: unknown) => x === null || integer(x);
const plate = (x: unknown) => obj(x) && integer(x.customerId) && list(x.items, 2, item) && integer(x.barista) && x.barista < 4 && (x.server === null || integer(x.server) && x.server < MAX_SERVERS) && finite(x.waited);
const customer = (x: unknown) => obj(x) && walker(x) && look(x.look) && integer(x.id) && item(x.order) && (x.extra === null || item(x.extra)) &&
  (x.guestKind === undefined || isGuestKind(x.guestKind)) &&
  (x.appearanceId === undefined || integer(x.appearanceId) && x.appearanceId < CUSTOMER_CAST.length) &&
  (x.regularGuestId === undefined || typeof x.regularGuestId === 'string') &&
  (x.regularGuestVisitId === undefined || integer(x.regularGuestVisitId) && x.regularGuestVisitId > 0) &&
  (x.trialSale === undefined || x.trialSale === 'reserved' || x.trialSale === 'prepared') &&
  (x.recommendation === undefined || item(x.recommendation)) &&
  (x.rememberedOrder === undefined || item(x.rememberedOrder)) &&
  (x.reviewed === undefined || typeof x.reviewed === 'boolean') &&
  (x.waitSeconds === undefined || positive(x.waitSeconds)) &&
  (x.missingExtra === undefined || typeof x.missingExtra === 'boolean') &&
  ['queue','toCounter','ordering','toSeat','waiting','sitting','exiting'].includes(String(x.phase)) &&
  ['patience','timer','moodTimer','spot','seat'].every((k) => finite(x[k])) && Number.isInteger(x.seat) && Number(x.seat) >= -1 && Number(x.seat) < TOTAL_TABLE_SPOTS * 2 &&
  ['vip','hasCup','soldOut','dineIn'].every((k) => typeof x[k] === 'boolean') && [null,'happy','sad'].includes(x.mood as null) &&
  (x.momentTip === undefined || finite(x.momentTip) && Number(x.momentTip) >= 0 && Number(x.momentTip) <= 1);
const barista = (x: unknown) => obj(x) && look(x.look) && nullableId(x.customerId) && ['remaining','total','calling'].every((k) => finite(x[k]));
const cook = (x: unknown) => obj(x) && walker(x) && look(x.look) && (x.batch === null || obj(x.batch) && item(x.batch.item) && integer(x.batch.n) && x.batch.n > 0 && x.batch.n <= MAX_COOK_BATCH &&
  list(x.batch.steps, 16, (s) => typeof s === 'string' && Object.hasOwn(STATION_SECONDS, s)) && integer(x.batch.step) && x.batch.step < x.batch.steps.length && finite(x.batch.timer));
const server = (x: unknown) => obj(x) && walker(x) && look(x.look) && ['idle','toPass','delivering','returning'].includes(String(x.phase)) && list(x.plates, 3, plate) && finite(x.ack);

/** Reject corrupt snapshots atomically; the validated economic save remains usable. */
export function validSnapshot(value: unknown, state: GameState): value is SimSnapshot {
  if (!obj(value) || value.version !== 1 && value.version !== 2 || value.version === 2 && value.kitchenLevel !== (state.kitchen ? state.upgrades.cook : 0) || value.day !== state.day || value.phase !== state.phase || value.served !== state.today.served ||
    !finite(value.height) || value.height < (value.version === 1 ? 192 : MIN_SCENE_H) || value.height > MAX_SCENE_H || !finite(value.spawnTimer) || !integer(value.nextId) || !positive(value.boostCooldown) || value.boostCooldown > 1 ||
    !list(value.customers, 150, customer) || !list(value.baristas, 4, barista) || !list(value.cooks, 3, cook) || !list(value.servers, MAX_SERVERS, server) ||
    !list(value.queue, 6, integer) || !list(value.seats, TOTAL_TABLE_SPOTS * 2, nullableId) || !list(value.pass, MAX_PASS_SLOTS, plate) || !list(value.rack, 3, item)) return false;
  if (value.version === 2 && (!validCustomerCastSnapshot(value.customerCast) || !integer(value.castRandomState) || value.castRandomState > 0xffffffff)) return false;
  const s = value as unknown as SimSnapshot;
  // A syntactically valid custom recipe must still exist in this economic save.
  // Definitions themselves are immutable, so an edited name cannot change an order.
  const savedRecipe = (id: ItemId) => MENU.some((m) => m.id === id) || state.signatureDrinks.recipes.some((recipe) => recipe.id === id);
  const inFlight = [
    ...s.customers.flatMap((c) => c.extra === null ? [c.order] : [c.order, c.extra]),
    ...s.pass.flatMap((p) => p.items), ...s.rack,
    ...s.servers.flatMap((server) => server.plates.flatMap((p) => p.items)),
    ...s.cooks.flatMap((cook) => cook.batch === null ? [] : [cook.batch.item]),
  ];
  if (!inFlight.every(savedRecipe)) return false;
  if (s.customers.some(c =>
    c.recommendation !== undefined && (c.recommendation !== c.order || c.trialSale || c.regularGuestId || c.hasCup || c.phase === 'exiting')
    || c.rememberedOrder !== undefined && (!memoryGuest(c.appearanceId) || c.trialSale || c.regularGuestId
      || c.rememberedOrder !== c.order && c.rememberedOrder !== c.extra
      || !state.guestMemories[c.appearanceId!]))) return false;
  const trial = state.trialSales?.active;
  const trying = s.customers.filter(c => c.trialSale);
  if (trying.some(c => !trial || trial.day !== state.day || c.hasCup || c.phase === 'exiting'
      || c.order !== trial.item && c.extra !== trial.item
      || (c.trialSale === 'reserved' ? !['queue', 'toCounter'].includes(c.phase) : !['ordering', 'toSeat', 'waiting'].includes(c.phase)))) return false;
  if (trying.filter(c => c.trialSale === 'reserved').length !== (trial?.reserved ?? 0)
      || trying.filter(c => c.trialSale === 'prepared').length > (trial ? trial.prepared - trial.served : 0)) return false;
  if (!state.kitchen && s.cooks.length > 0) return false;
  // Legacy live customers without narrative fields retain their original identity.
  // Present fields must agree with their saved appearance, debut and visit receipt.
  for (const c of s.customers) {
    if (c.regularGuestId === undefined && c.regularGuestVisitId === undefined) continue;
    const guest = c.regularGuestId ? regularGuestDefinition(c.regularGuestId) : undefined;
    if (!guest || guest.appearanceId !== c.appearanceId || state.day < guest.debutDay ||
      c.regularGuestVisitId === undefined || c.regularGuestVisitId >= state.regularGuests.nextVisitId ||
      !state.regularGuests.guests[guest.id]) return false;
    const progress = state.regularGuests.guests[guest.id]!;
    if (!c.hasCup && c.phase !== 'exiting' &&
      (progress.pendingDay !== state.day || !progress.pendingVisitIds.includes(c.regularGuestVisitId))) return false;
  }
  const visitIds = s.customers.flatMap((c) => c.regularGuestVisitId === undefined ? [] : [c.regularGuestVisitId]);
  if (new Set(visitIds).size !== visitIds.length) return false;
  const ids = new Set(s.customers.map((c) => c.id));
  if (ids.size !== s.customers.length || s.customers.some((c) => c.id >= s.nextId)) return false;
  if (s.queue.some((id) => !s.customers.some((c) => c.id === id && c.phase === 'queue')) || new Set(s.queue).size !== s.queue.length) return false;
  if (s.seats.some((id) => id !== null && !ids.has(id))) return false;
  if (s.customers.some((c) => c.seat >= s.seats.length || c.spot < -1 || c.spot >= s.baristas.length || !Number.isInteger(c.spot))) return false;
  if (s.baristas.some((b) => b.customerId !== null && !ids.has(b.customerId))) return false;
  return s.pass.every((p) => ids.has(p.customerId) && p.barista < s.baristas.length && (p.server === null || p.server < s.servers.length));
}
