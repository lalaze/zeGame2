// Saved services with one thing that does not add up: each check of `validSnapshot` must be what refuses some of them.
import { MODS } from './mods';
import { IDS, anyItem, type Random } from './ops';
import type { GameState } from '../../src/game/state';

type Dict = Record<string, unknown>;
interface Snap extends Dict { customers: Dict[]; servers: Dict[]; cooks: Dict[]; baristas: Dict[]; pass: Dict[]; queue: number[]; seats: (number | null)[]; rack: string[]; nextId: number }
const BLEND = 'sig:coffee:beans=1';

/** Changes a snapshot (and the save it belongs to) in one or two ways a real one could be wrong, or nearly wrong. */
export function tamper(snap: Snap, s: GameState, r: Random): void {
  const who = (): Dict => (snap.customers.length ? r.pick(snap.customers) : {}), item = () => anyItem(s, r), day = () => r.pick([s.day, s.day, s.day, s.day - 1]);
  const trial = () => { s.trialSales.active = { item: r.pick([who().order ?? 'latte', item()]) as never, day: day(), prepared: r.int(4), served: r.int(3), reserved: r.int(3), visits: 0, ingredientCost: 0, revenue: 0, feedback: { love: 0, fine: 0, meh: 0 }, practiceBefore: 0, qualityBefore: 0 }; };
  const tries = (c: Dict) => { c.trialSale = r.pick(['reserved', 'prepared']); c.hasCup = r.chance(0.2); c.phase = r.pick(['queue', 'toCounter', 'ordering', 'toSeat', 'waiting', 'exiting']); delete c.recommendation; delete c.rememberedOrder; delete c.regularGuestId; delete c.regularGuestVisitId; };
  const regular = r.pick(MODS['regular-guests-content'].REGULAR_GUESTS as { id: string; appearanceId: number; debutDay: number }[]);
  const progress = () => { const visit = 1 + r.int(3); s.regularGuests.nextVisitId = r.pick([visit, visit + 1, visit + 4]); (s.regularGuests.guests as Dict)[regular.id] = r.chance(0.1) ? undefined : { unlockedChapters: [], readChapters: [], pendingDay: day(), pendingVisitIds: r.pick([[visit], [], [visit, 9]]), visits: 0 }; if (!(s.regularGuests.guests as Dict)[regular.id]) delete (s.regularGuests.guests as Dict)[regular.id]; s.day = Math.max(s.day, r.pick([1, regular.debutDay])); snap.day = s.day; return visit; };
  const ways: (() => void)[] = [
    () => { who().momentTip = r.pick([0, 0.5, 1, 1.5, -0.1, NaN, '1']); }, () => { who().order = r.pick([BLEND, item()]); }, () => { snap.rack.unshift(r.pick([BLEND, item()])); snap.rack.length = Math.min(3, snap.rack.length); }, () => { who().extra = r.pick([BLEND, item(), null]); },
    () => { const c = who(); c.recommendation = r.pick([c.order, item()]); if (r.chance(0.3)) c.trialSale = 'reserved'; if (r.chance(0.2)) c.regularGuestId = regular.id; }, () => { const c = who(); c.rememberedOrder = r.pick([c.order, c.extra ?? c.order, item()]); c.appearanceId = r.int(40); if (r.chance(0.6)) (s.guestMemories as Dict)[c.appearanceId as number] ??= {}; },
    () => { trial(); tries(who()); }, () => { trial(); for (const c of snap.customers) if (r.chance(0.3)) tries(c); s.trialSales.active!.reserved = snap.customers.filter((c) => c.trialSale === 'reserved').length; }, () => { trial(); const c = who(); tries(c); s.trialSales.active!.item = c.order as never; s.trialSales.active!.day = s.day; s.trialSales.active!.reserved = c.trialSale === 'reserved' ? 1 : 0; c.hasCup = false; }, () => { s.trialSales.active = null; if (r.chance(0.5)) tries(who()); },
    () => { s.kitchen = false; snap.kitchenLevel = 0; }, () => { s.kitchen = true; snap.kitchenLevel = s.upgrades.cook; }, () => { snap.kitchenLevel = r.int(4); },
    () => { const c = who(), visit = progress(); c.regularGuestId = r.chance(0.1) ? r.pick(['nobody', '']) : regular.id; c.appearanceId = r.chance(0.8) ? regular.appearanceId : 3; if (r.chance(0.9)) c.regularGuestVisitId = visit; delete c.recommendation; delete c.rememberedOrder; delete c.trialSale; if (r.chance(0.3)) c.hasCup = true; },
    () => { const visit = progress(); for (const c of snap.customers.slice(0, 2)) { c.regularGuestId = regular.id; c.appearanceId = regular.appearanceId; c.regularGuestVisitId = visit; c.hasCup = true; delete c.recommendation; delete c.rememberedOrder; delete c.trialSale; } },
    () => { if (snap.customers.length) snap.customers.push(structuredClone(r.pick(snap.customers))); }, () => { snap.nextId = r.int(snap.nextId + 1); }, () => { snap.queue.push(r.pick([...snap.queue, 99_999, ...snap.customers.map((c) => c.id as number)])); snap.queue.length = Math.min(6, snap.queue.length); },
    () => { snap.seats[r.int(snap.seats.length || 1)] = r.pick([99_999, null, ...snap.customers.map((c) => c.id as number)]); }, () => { who().seat = r.pick([-1, 0, snap.seats.length, snap.seats.length - 1, 63, 1.5]); }, () => { who().spot = r.pick([-1, 0, 3, -2, 0.5, snap.baristas.length]); },
    () => { if (snap.baristas.length) r.pick(snap.baristas).customerId = r.pick([null, 99_999, ...snap.customers.map((c) => c.id as number)]); },
    () => { snap.pass.push({ customerId: r.pick([99_999, ...snap.customers.map((c) => c.id as number)]), items: [r.pick([BLEND, item()])], barista: r.int(5), server: r.pick([null, 0, 5]), waited: 1 }); },
    () => { if (snap.servers.length) (r.pick(snap.servers).plates as Dict[]).push({ customerId: 1, items: [r.pick([BLEND, item()])], barista: 0, server: 0, waited: 0 }); }, () => { if (snap.cooks.length) r.pick(snap.cooks).batch = r.pick([null, { item: r.pick([BLEND, r.pick(IDS.menu)]), n: 1 + r.int(40), steps: ['mixer', 'deckOven'], step: r.int(3), timer: 2 }]); },
    () => { snap.version = 1; delete snap.customerCast; delete snap.castRandomState; snap.height = r.pick([150, 192, 230, 240, 400]); }, () => { snap.height = r.pick([150, 239, 240, 360, 361]); }, () => { snap.castRandomState = r.pick([0, 0xffffffff, 2 ** 32, -1, 0.5]); },
  ];
  for (let n = 1 + r.int(2); n > 0; n--) r.pick(ways)();
}
