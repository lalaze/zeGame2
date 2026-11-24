// @vitest-environment happy-dom
// What the building says in words, the next table's place, and the starter themes' pictures.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { STARTER_THEMES } from '../../game/decor';
import { URGENT_THOUGHT } from '../thought-bubbles';
import type { ThoughtCandidate } from '../thoughts';

vi.mock('phaser', () => ({ default: {} }));
const { showableThoughts } = await import('./floors-thoughts');
const { themeLayers } = await import('./floors-theme-preview');
const { nextTableSpot, tableSeats } = await import('./floors-layout');

const BUILD = 'assets/generated/floor-sample-v1/build/';

describe('thoughts in the building', () => {
  const view = { x: 0, y: 1000, w: 1672, h: 3600 };
  const thought = (id: string, context = 'queue:waiting', priority = 30): ThoughtCandidate => ({ id, key: 'thought.customer.queue', x: 0, y: 0, priority, context });
  const at = (x: number, y: number, arrived = true) => () => ({ x, y, arrived });

  it('show over the heads the player can see, clear of the bars', () => {
    expect(showableThoughts([thought('customer:1')], at(800, 2600), view)).toMatchObject([{ id: 'customer:1', x: 800, y: 2600 }]);
    expect(showableThoughts([thought('customer:1')], at(800, 1200), view)).toEqual([]);
    expect(showableThoughts([thought('customer:1')], at(800, 4400), view)).toEqual([]);
    expect(showableThoughts([thought('customer:1')], () => null, view)).toEqual([]);
  });

  it('wait until a guest the Sim has at a table has come up the stairs', () => {
    for (const context of ['table:served', 'taste:like:latte:milky', 'memory:learned:latte']) {
      expect(showableThoughts([thought('customer:1', context)], at(800, 2600, false), view)).toEqual([]);
      expect(showableThoughts([thought('customer:1', context)], at(800, 2600, true), view)).toHaveLength(1);
    }
    expect(showableThoughts([thought('customer:1', 'exit:dined')], at(800, 2600, false), view)).toHaveLength(1);
  });

  it('keep a moment\'s guest quiet, except to answer the player', () => {
    expect(showableThoughts([thought('customer:1')], at(800, 2600), view, 1)).toEqual([]);
    expect(showableThoughts([thought('customer:1', 'reply', URGENT_THOUGHT)], at(800, 2600), view, 1)).toHaveLength(1);
    expect(showableThoughts([thought('customer:2')], at(800, 2600), view, 1)).toHaveLength(1);
  });
});

describe('the next table', () => {
  it('goes between its two seats, until the building is full', () => {
    const active = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let tables = 2; tables < 8; tables++) {
      const [left, right] = tableSeats(tables, active), spot = nextTableSpot(tables)!;
      expect(spot.floor).toBe(left.floor);
      expect(spot.x).toBe((left.x + right.x) / 2);
    }
    expect(nextTableSpot(8)).toBeNull();
  });
});

describe('starter theme pictures', () => {
  const decor = JSON.parse(readFileSync(`${BUILD}decor/decor.json`, 'utf8'));

  it('are made of layers that exist, different for every theme', () => {
    const stacks = STARTER_THEMES.map(theme => {
      const layers = themeLayers(theme.id, decor).map(layer => layer.file);
      for (const file of layers) expect(existsSync(BUILD + file), file).toBe(true);
      for (const part of ['wall_', 'floor_', 'counter_', 'tablecloth_']) expect(layers.some(file => file.includes(part)), `${theme.id} ${part}`).toBe(true);
      return layers.join();
    });
    expect(new Set(stacks).size).toBe(STARTER_THEMES.length);
  });

  it('are left to the pixel room without the decor layers', () => {
    expect(themeLayers('classic', null)).toEqual([]);
    expect(themeLayers('unknown', decor)).toEqual([]);
  });
});
