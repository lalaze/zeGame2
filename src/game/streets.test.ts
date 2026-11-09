import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize, SAVE_KEY } from './state';
import { BUSINESSES, buyStreetPlot, collectStreetShop, collectStreetShops, fitOutStreetPlot, fitOutSeconds, migrateIndoorShops, parseStreetEstate, plotPurchaseBlock, setStreetSchedule, streetProduction, streetUnlocked, upgradeStreetShop } from './streets';
import { buyBlueprint } from './room-projects';
import { activeTableIndices } from './regions';
import { openBranch } from './chain';
import { SaveSession } from './save-session';
const MIN = 60_000, HOUR = 60 * MIN;
const rich = () => { const s = createInitialState(0); s.day = 3; s.coins = 10_000_000; return s; };

describe('street properties, independent of the café interior', () => {
  it('allows any affordable property without the old sequential room chain and charges only once', () => {
    const s = rich(); s.day = 2;
    expect(buyStreetPlot(s, 'town', '05', 0)).toBe(false);
    s.day = 3;
    expect(buyStreetPlot(s, 'town', '05', 0)).toBe(true);
    const balance = s.coins;
    expect(buyStreetPlot(s, 'town', '05', 0)).toBe(false);
    expect(s.coins).toBe(balance);
    expect(s.regions).toEqual([]);
    expect(activeTableIndices(s)).toEqual([0, 1]);
    expect(s.streets.lots['town:05']?.business).toBeNull();
  });
  it('unlocks streets from total ownership and allows browsing without moving the café', () => {
    const s = rich(); s.streets.selected = 'seaside';
    expect(s.chain.location).toBe('town');
    expect(plotPurchaseBlock(s, 'flowers', '01')).toBe('street');
    buyStreetPlot(s, 'town', '03', 0); buyStreetPlot(s, 'town', '01', 0);
    expect(streetUnlocked(s, 'flowers')).toBe(true);
    expect(buyStreetPlot(s, 'flowers', '01', 0)).toBe(true);
    expect(s.streets.lots['town:01']).not.toBe(s.streets.lots['flowers:01']);
    expect(s.chain.location).toBe('town');
  });
  it('separates land from fit-out, gates advanced businesses, and starts production only after renovation', () => {
    const s = rich(); buyStreetPlot(s, 'town', '01', 0);
    expect(fitOutStreetPlot(s, 'town:02', 'reading', 0)).toBe(false);
    expect(fitOutStreetPlot(s, 'town:01', 'workshop', 0)).toBe(false);
    expect(fitOutStreetPlot(s, 'town:01', 'reading', 0)).toBe(true);
    expect(fitOutStreetPlot(s, 'town:01', 'reading', 0)).toBe(false);
    expect(streetProduction(s, 'town:01', 30 * MIN - 1).coins).toBe(0);
    expect(streetProduction(s, 'town:01', 40 * MIN)).toMatchObject({ batches: 1, coins: 30, inspiration: 2 });
    expect(s.manager.hired).toBe(false);
    expect(s.construction).toEqual([]);
  });
  it('lets the player put different businesses at the same address on different streets', () => {
    const s = rich();
    buyStreetPlot(s, 'town', '01', 0); buyStreetPlot(s, 'town', '02', 0); buyStreetPlot(s, 'flowers', '01', 0);
    fitOutStreetPlot(s, 'town:01', 'reading', 0); fitOutStreetPlot(s, 'flowers:01', 'greenhouse', 0);
    expect(s.streets.lots['town:01']?.business).toBe('reading');
    expect(streetProduction(s, 'flowers:01', 2 * HOUR + 10 * MIN).coins).toBe(144);
    expect(s.regions).toEqual([]);
  });
  it('caps offline output, survives reload, retains partial batches and refuses duplicate claims', () => {
    const s = rich(); buyStreetPlot(s, 'town', '01', 0); fitOutStreetPlot(s, 'town:01', 'reading', 0);
    const loaded = deserialize(serialize(s), 45 * MIN);
    expect(collectStreetShop(loaded, 'town:01', 45 * MIN).coins).toBe(30);
    expect(streetProduction(loaded, 'town:01', 50 * MIN).batches).toBe(1);
    expect(collectStreetShop(loaded, 'town:01', 3 * HOUR)).toMatchObject({ batches: 6, full: true, coins: 180 });
    expect(collectStreetShop(loaded, 'town:01', 3 * HOUR).coins).toBe(0);
    expect(streetProduction(loaded, 'town:01', 3 * HOUR + 9 * MIN).batches).toBe(0);
  });
  it('settles the old schedule and level before restarting production', () => {
    const s = rich(); buyStreetPlot(s, 'town', '01', 0); fitOutStreetPlot(s, 'town:01', 'reading', 0);
    expect(setStreetSchedule(s, 'town:01', 'overnight', MIN)).toBe(false);
    s.roomProjects.inspiration = 500;
    expect(upgradeStreetShop(s, 'town:01', 45 * MIN)).toBe(true);
    expect(s.roomProjects.inspiration).toBe(472);
    expect(streetProduction(s, 'town:01', 50 * MIN).batches).toBe(0);
    expect(collectStreetShop(s, 'town:01', 55 * MIN).coins).toBe(60);
    setStreetSchedule(s, 'town:01', 'overnight', HOUR);
    expect(streetProduction(s, 'town:01', 17 * HOUR)).toMatchObject({ batches: 2, coins: 2_880 });
  });
  it('applies permanent blueprints to every street without changing unfinished renovations or paying overflow', () => {
    const s = rich(); buyStreetPlot(s, 'town', '01', 0); buyStreetPlot(s, 'town', '02', 0);
    fitOutStreetPlot(s, 'town:01', 'reading', 0); fitOutStreetPlot(s, 'town:02', 'greenhouse', 0);
    s.roomProjects.inspiration = 1_000;
    expect(buyBlueprint(s, 'clockwork', 35 * MIN)).toBe(true);
    expect(streetProduction(s, 'town:01', 39 * MIN).batches).toBe(1);
    expect(s.streets.lots['town:02']!.since).toBe(2 * HOUR);
    expect(buyBlueprint(s, 'shelves', 24 * HOUR)).toBe(true);
    expect(streetProduction(s, 'town:01', 24 * HOUR)).toMatchObject({ batches: 0, capacity: 8 });
    expect(s.roomProjects.collected).toBe(30);
  });
  it('keeps property assets and ongoing production when the café opens a new branch', () => {
    const s = rich(); s.totalEarned = 100_000;
    s.streets.lots['town:03'] = { business: 'terrace', level: 2, mode: 'long', since: 0, readyAt: 0 };
    const next = openBranch(s, 'seaside', HOUR)!;
    expect(next.streets).toEqual(s.streets);
    expect(next.streets).not.toBe(s.streets);
    expect(streetProduction(next, 'town:03', 2 * HOUR).coins).toBe(8_000);
    expect(next.chain.location).toBe('seaside');
    expect(next.regions).toEqual([]);
  });
  it('sanitizes property ids, malformed values and clock rollback', () => {
    const parsed = parseStreetEstate({ selected: 'bad', lots: { 'town:01': { business: 'reading', level: 99, mode: '__proto__', readyAt: -1, since: 9 * HOUR }, 'town:02': { business: 'unknown' }, 'bad:03': {}, 'city:99': {} } }, HOUR);
    expect(Object.keys(parsed.lots)).toEqual(['town:01', 'town:02']);
    expect(parsed.lots['town:01']).toMatchObject({ level: 3, mode: 'short', since: HOUR });
    expect(parsed.lots['town:02']?.business).toBeNull();
    const s = rich(); s.streets = parsed;
    expect(collectStreetShops(s, HOUR - MIN).coins).toBe(0);
  });
  it('retains the existing builders perk for shop renovation', () => {
    const s = rich(); const before = fitOutSeconds(s, 'workshop');
    s.chain.perks = ['builders'];
    expect(fitOutSeconds(s, 'workshop')).toBeLessThan(before);
  });
});

describe('legacy indoor expansion migration at the live save boundary', () => {
  it('preserves paid properties, renovations, facility levels, stored goods and furniture exactly once', () => {
    const s = rich(); s.regions = ['reading', 'greenhouse']; s.construction = [{ id: 'terrace', finishAt: 6 * HOUR }];
    s.roomProjects.facilities.bookbinding = { level: 2, mode: 'short', since: 0 };
    s.decor.placed.push({ id: 'plant_fern', col: 53, row: 9 });
    const before = s.coins;
    expect(migrateIndoorShops(s, HOUR)).toBe(true);
    expect(s.streets.lots['town:01']).toMatchObject({ business: 'reading', level: 2, since: 0 });
    expect(s.streets.lots['town:03']).toMatchObject({ business: 'terrace', readyAt: 6 * HOUR });
    expect(s.roomProjects.facilities.bookbinding).toBeUndefined();
    expect(s.decor.stored.plant_fern).toBe(1);
    expect(s.regions).toEqual([]); expect(s.construction).toEqual([]);
    expect(s.coins).toBe(before);
    expect(collectStreetShop(s, 'town:01', HOUR).coins).toBe(360);
    expect(migrateIndoorShops(s, 2 * HOUR)).toBe(false);
    expect(s.decor.stored.plant_fern).toBe(1);
  });
  it('keeps an ongoing service intact and removes connected rooms only at closing', () => {
    const s = rich(); s.regions = ['reading']; s.phase = 'open';
    migrateIndoorShops(s, HOUR);
    expect(s.regions).toEqual(['reading']);
    const since = s.streets.lots['town:01']!.since;
    s.phase = 'prep'; migrateIndoorShops(s, 2 * HOUR);
    expect(s.regions).toEqual([]);
    expect(s.streets.lots['town:01']!.since).toBe(since);
  });
  it('migrates through the actual save session and persists a reload without losing lots', () => {
    const s = rich(); s.version = 25; s.regions = BUSINESSES.map(b => b.id);
    let raw = serialize(s);
    const storage = { getItem: (key: string) => key === SAVE_KEY ? raw : null, setItem: (_key: string, value: string) => { raw = value; } };
    const session = new SaveSession(storage, HOUR, () => {});
    expect(Object.keys(session.state.streets.lots)).toHaveLength(5);
    expect(session.state.regions).toEqual([]);
    expect(session.save(session.state)).toBe('saved'); session.close();
    const reload = new SaveSession(storage, 2 * HOUR, () => {});
    expect(Object.keys(reload.state.streets.lots)).toHaveLength(5);
    expect(reload.state.regions).toEqual([]);
  });
});
