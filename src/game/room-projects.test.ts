import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize } from './state';
import { BLUEPRINTS, ROOM_PROJECTS, buyBlueprint, collectAllProjects, collectProject, projectProduction, setProjectMode, upgradeProject } from './room-projects';
import { REGIONS, activeTableIndices, regionOffset, startConstruction, finishConstruction } from './regions';
import { awayHourly } from './manager';
import { branchUnlocked, openBranch } from './chain';
import { areaAtPoint, roomRoute, tableArea, tablePos } from './layout';
import { canPlace, placeFurniture } from './furniture';

const MINUTE = 60_000, HOUR = 60 * MINUTE;
function ready() {
  const s = createInitialState(0); s.day = 3; s.coins = 10_000_000;
  return s;
}

describe('real-time room projects', () => {
  it('gates early production by day, later facilities by room, and pays exactly once', () => {
    const s = ready(); s.day = 2;
    expect(upgradeProject(s, 'postcards', 0)).toBe(false);
    s.day = 3; s.coins = 179;
    expect(upgradeProject(s, 'postcards', 0)).toBe(false);
    s.coins++;
    expect(upgradeProject(s, 'postcards', 0)).toBe(true);
    expect(s.coins).toBe(0);
    expect(upgradeProject(s, 'bookbinding', 0)).toBe(false);
    expect(collectProject(s, 'postcards', 10 * MINUTE - 1).coins).toBe(0);
    expect(collectProject(s, 'postcards', 10 * MINUTE)).toMatchObject({ coins: 12, inspiration: 1 });
    expect(collectProject(s, 'postcards', 10 * MINUTE).coins).toBe(0);
    expect(s.coins).toBe(12); expect(s.totalEarned).toBe(12);
  });

  it('uses wall time without a manager, ignores game speed, and preserves partial cycles through reload', () => {
    const s = ready(); upgradeProject(s, 'postcards', 0); s.speed = 4;
    expect(s.manager.hired).toBe(false);
    expect(collectProject(s, 'postcards', 15 * MINUTE).batches).toBe(1);
    const restored = deserialize(serialize(s), 18 * MINUTE);
    expect(projectProduction(restored, 'postcards', 20 * MINUTE - 1).batches).toBe(0);
    expect(collectProject(restored, 'postcards', 20 * MINUTE).batches).toBe(1);
    expect(restored.roomProjects.inspiration).toBe(2);
  });

  it('caps long absences and restarts a full store without paying its overflow', () => {
    const s = ready(); upgradeProject(s, 'postcards', 0);
    expect(projectProduction(s, 'postcards', 48 * HOUR)).toMatchObject({ batches: 6, full: true, coins: 72 });
    collectProject(s, 'postcards', 48 * HOUR);
    expect(collectProject(s, 'postcards', 48 * HOUR + 9 * MINUTE).batches).toBe(0);
    expect(collectProject(s, 'postcards', 48 * HOUR + 10 * MINUTE).batches).toBe(1);
  });

  it('offers lower hourly yields and longer coverage for long and overnight schedules', () => {
    const s = ready(); upgradeProject(s, 'postcards', 0);
    setProjectMode(s, 'postcards', 'long', 0);
    expect(projectProduction(s, 'postcards', 8 * HOUR)).toMatchObject({ batches: 4, full: true, inspiration: 32, coins: 384 });
    setProjectMode(s, 'postcards', 'overnight', 8 * HOUR);
    expect(s.roomProjects.inspiration).toBe(32);
    expect(projectProduction(s, 'postcards', 24 * HOUR)).toMatchObject({ batches: 2, full: true, inspiration: 48 });
  });

  it('settles old production before upgrades or schedule changes and does not restart on the selected mode', () => {
    const s = ready(); upgradeProject(s, 'postcards', 0); s.roomProjects.inspiration = 100;
    expect(upgradeProject(s, 'postcards', 15 * MINUTE)).toBe(true);
    expect(s.roomProjects.inspiration).toBe(86);
    expect(projectProduction(s, 'postcards', 20 * MINUTE).batches).toBe(0);
    expect(setProjectMode(s, 'postcards', 'short', 20 * MINUTE)).toBe(false);
    expect(collectProject(s, 'postcards', 25 * MINUTE)).toMatchObject({ coins: 24, inspiration: 2 });
    expect(upgradeProject(s, 'postcards', 25 * MINUTE)).toBe(true);
    expect(upgradeProject(s, 'postcards', 25 * MINUTE)).toBe(false);
    expect(s.roomProjects.facilities.postcards?.level).toBe(3);
  });

  it('researches once, preserves speed-up progress, and never retroactively fills extra shelves', () => {
    const s = ready(); upgradeProject(s, 'postcards', 0); s.roomProjects.inspiration = 1_000;
    expect(buyBlueprint(s, 'clockwork', 5 * MINUTE)).toBe(true);
    expect(projectProduction(s, 'postcards', 5 * MINUTE).progress).toBeCloseTo(.5);
    expect(collectProject(s, 'postcards', 9 * MINUTE).batches).toBe(1);
    expect(buyBlueprint(s, 'clockwork', 9 * MINUTE)).toBe(false);
    expect(buyBlueprint(s, 'shelves', 24 * HOUR)).toBe(true);
    expect(projectProduction(s, 'postcards', 24 * HOUR)).toMatchObject({ batches: 0, capacity: 8 });
    expect(s.roomProjects.collected).toBe(7);
  });

  it('does not reset ongoing progress when buying the earnings blueprint', () => {
    const s = ready(); upgradeProject(s, 'postcards', 0); s.roomProjects.inspiration = 500;
    const hourly = awayHourly(s);
    buyBlueprint(s, 'ledger', 15 * MINUTE);
    expect(awayHourly(s)).toBeCloseTo(hourly * 1.1);
    expect(projectProduction(s, 'postcards', 20 * MINUTE).batches).toBe(1);
  });

  it('collects independent rooms together and makes a second collect a no-op', () => {
    const s = ready(); s.regions = REGIONS.map(r => r.id);
    for (const p of ROOM_PROJECTS) expect(upgradeProject(s, p.id, 0)).toBe(true);
    const reward = collectAllProjects(s, 10 * MINUTE);
    expect(reward.inspiration).toBe(21);
    expect(reward.coins).toBe(5_662);
    expect(collectAllProjects(s, 10 * MINUTE)).toEqual({ coins: 0, inspiration: 0 });
  });

  it('migrates missing data and rejects malformed or locked facilities and future clocks', () => {
    expect(deserialize('{"version":24}', 0).roomProjects.facilities).toEqual({});
    const s = deserialize(JSON.stringify({ day: 3, roomProjects: {
      inspiration: -2, collected: 'bad', blueprints: ['clockwork', 'bad', 'clockwork'],
      facilities: { postcards: { level: 99, mode: '__proto__', since: 99 * HOUR }, herbs: { level: 1, mode: 'short', since: 0 } },
    } }), HOUR);
    expect(s.roomProjects).toMatchObject({ inspiration: 0, collected: 0, blueprints: ['clockwork'], facilities: { postcards: { level: 3, mode: 'short', since: HOUR } } });
    expect(s.roomProjects.facilities.herbs).toBeUndefined();
    expect(projectProduction(s, 'postcards', HOUR - MINUTE).batches).toBe(0);
  });

  it('carries inspiration and blueprints to branches, settles batches, and rebuilds facilities there', () => {
    const s = ready(); s.regions = ['reading', 'greenhouse', 'terrace']; s.totalEarned = 100_000;
    expect(branchUnlocked(s)).toBe(true);
    upgradeProject(s, 'postcards', 0); s.roomProjects.blueprints = BLUEPRINTS.map(b => b.id);
    const before = serialize(s), next = openBranch(s, 'town', 8 * MINUTE)!;
    expect(next.roomProjects.inspiration).toBe(1);
    expect(next.roomProjects.blueprints).toEqual(s.roomProjects.blueprints);
    expect(next.roomProjects.facilities).toEqual({});
    expect(next.coins).toBe(12);
    expect(serialize(s)).toBe(before);
  });
});

describe('optional late-game rooms', () => {
  it('builds after the terrace, protects old storage slots, and routes to every new table', () => {
    const s = ready(); s.regions = ['reading', 'greenhouse', 'terrace'];
    expect(regionOffset('kitchen')).toBe(1_280);
    expect(regionOffset('workshop')).toBe(1_600);
    expect(startConstruction(s, 'observatory', 0)).toBe(false);
    expect(startConstruction(s, 'workshop', 0)).toBe(true);
    expect(finishConstruction(s, 24 * HOUR)).toEqual(['workshop']);
    expect(startConstruction(s, 'observatory', 24 * HOUR)).toBe(true);
    expect(finishConstruction(s, 60 * HOUR)).toEqual(['observatory']);
    expect(activeTableIndices(s)).toHaveLength(22);
    for (const index of activeTableIndices(s).filter(i => i >= 20)) {
      const p = tablePos(index), area = tableArea(index);
      expect(areaAtPoint(p.x, p.y)).toBe(area);
      expect(roomRoute('main', area).length).toBeGreaterThan(0);
    }
    s.decor.stored.plant_fern = 2;
    expect(canPlace(s, 'plant_fern', 213, 9, 2)).toBe(true);
    expect(placeFurniture(s, 'plant_fern', 213, 9, 2)).toBe(true);
    const restored = deserialize(serialize(s), 60 * HOUR);
    expect(restored.decor.placed).toContainEqual({ id: 'plant_fern', col: 213, row: 9 });
    expect(restored.regions).toEqual(REGIONS.map(r => r.id));
  });
});
