import { describe, expect, it } from 'vitest';
import { buyItem, quoteItem } from './economy';
import { GOALS, claimGoal, currentGoal, goalDone } from './goals';
import { MENU } from './data';
import { createInitialState, deserialize, serialize } from './state';
import { adoptCat } from './pets';
import { useDecor } from './decor';
import { milestonesStarted } from './milestones';
import { styleStages } from './styles';

describe('guided goals that support specialist cafés', () => {
  it('asks for one recipe upgrade after opening day instead of four', () => {
    const s = createInitialState(0); s.day = 2; s.coins = 30;
    expect(claimGoal(s)).toBe(30);
    expect(currentGoal(s)!.progress(s)).toEqual([1, 2]);
    expect(quoteItem(s, 'espresso', 1).cost).toBeCloseTo(89.6);
    // Another few paid orders can fund the step; its reward can then fund supplies.
    s.coins += 30;
    expect(buyItem(s, 'espresso', 1)).toBe(true);
    expect(goalDone(s)).toBe(true);
    expect(claimGoal(s)).toBe(40);
    expect(s.coins).toBeCloseTo(40.4);
  });

  it('accepts tea progression and actual drink supply without coffee or milk purchases', () => {
    const s = createInitialState(0); s.goal = 2; s.items.blacktea = 1;
    expect(goalDone(s)).toBe(true); claimGoal(s);
    expect(goalDone(s)).toBe(false);
    s.items.blacktea = 3;
    expect(goalDone(s)).toBe(true); claimGoal(s);
    s.onMenu = ['blacktea']; s.pantry.tea = 19;
    expect(goalDone(s)).toBe(false);
    s.pantry.tea = 20;
    expect(goalDone(s)).toBe(true);
    expect(s.items.americano + s.items.latte + s.items.cappuccino).toBe(0);
  });

  it('does not treat one stocked ingredient as twenty complete multi-ingredient drinks', () => {
    const s = createInitialState(0); s.goal = 4;
    s.items.latte = 1; s.onMenu = ['latte']; s.pantry.beans = 20; s.pantry.milk = 0;
    expect(goalDone(s)).toBe(false);
    // The legacy 20-milk alternative remains valid for an old, ready-to-claim goal.
    s.pantry.milk = 20;
    expect(goalDone(s)).toBe(true);
  });

  it('lets a resident-cat specialist finish the guide without latte, cappuccino or croissant', () => {
    const s = createInitialState(0); s.coins = 100000; s.day = 10; s.served = 500;
    s.cafeStyle.focus = 'cats'; s.items.espresso = 5; s.items.blacktea = 1;
    s.upgrades.machine = 1; s.upgrades.tables = 1; s.upgrades.server = 1;
    expect(adoptCat(s, 'ginger')).toBe(true); expect(adoptCat(s, 'tuxedo')).toBe(true);
    expect(useDecor(s, 'rug_red')).toBe(true);
    expect(useDecor(s, 'counter_marble')).toBe(true);
    expect(styleStages(s, 'cats').slice(0, 2).every(stage => stage.done)).toBe(true);
    const paid: string[] = [];
    while (goalDone(s)) { paid.push(currentGoal(s)!.id); claimGoal(s); }
    expect(paid).toHaveLength(15);
    expect(milestonesStarted(s)).toBe(true);
    expect(s.items.latte + s.items.cappuccino + s.items.croissant).toBe(0);
  });

  it('lets a garden café reach milestones through its tea-and-pastry route', () => {
    const s = createInitialState(0); s.coins = 100000; s.day = 10; s.served = 500;
    s.cafeStyle.focus = 'garden'; s.kitchen = true;
    s.items.blacktea = 5; s.items.donut = 1; s.items.scone = 3;
    s.onMenu = ['blacktea']; s.pantry.tea = 50; s.taste.served.blacktea = 30;
    s.upgrades.machine = 1; s.upgrades.server = 1;
    useDecor(s, 'rug_red'); useDecor(s, 'counter_marble'); useDecor(s, 'sill_cactus');
    expect(styleStages(s, 'garden').slice(0, 2).every(stage => stage.done)).toBe(true);
    while (goalDone(s)) claimGoal(s);
    expect(milestonesStarted(s)).toBe(true);
    expect(s.items.espresso).toBe(1);
    expect(s.items.americano + s.items.latte + s.items.cappuccino + s.items.croissant).toBe(0);
  });

  it('requires a real completed early and middle style stage for the final alternative', () => {
    const s = createInitialState(0); s.goal = 14; s.cafeStyle.focus = 'cats';
    expect(goalDone(s)).toBe(false);
    s.coins = 100000; adoptCat(s, 'ginger'); useDecor(s, 'rug_red');
    expect(styleStages(s, 'cats')[0].done).toBe(true);
    expect(goalDone(s)).toBe(false);
    adoptCat(s, 'tuxedo'); s.upgrades.server = 1; useDecor(s, 'counter_marble');
    expect(goalDone(s)).toBe(true);
    // Switching to an unbuilt route is not progress, and there is still one reward slot.
    s.cafeStyle.focus = 'garden'; expect(goalDone(s)).toBe(false);
    s.cafeStyle.focus = 'cats'; expect(claimGoal(s)).toBe(8000);
    s.cafeStyle.focus = 'garden'; expect(claimGoal(s)).toBe(0);
  });

  it('keeps all fifteen saved indexes and never reissues already claimed rewards on reload', () => {
    expect(GOALS.map(goal => goal.id)).toEqual(['firstDay', 'espresso5', 'americano', 'latte', 'milk', 'sign', 'decor', 'table', 'barista', 'days5', 'variety', 'comfort', 'cappuccino', 'served', 'croissant']);
    for (let claimed = 0; claimed <= GOALS.length; claimed++) {
      let s = createInitialState(0); s.goal = claimed; s.day = 30; s.served = 1000; s.coins = 100000;
      for (const item of MENU) s.items[item.id] = 10;
      s.pantry.milk = 20; s.upgrades.machine = 1; s.upgrades.tables = 1; s.upgrades.server = 1;
      useDecor(s, 'rug_red'); useDecor(s, 'counter_marble');
      const before = s.coins;
      while (goalDone(s)) {
        const index = s.goal;
        s = deserialize(serialize(s), 0);
        expect(s.goal).toBe(index);
        claimGoal(s);
      }
      expect(s.coins - before).toBe(GOALS.slice(claimed).reduce((sum, goal) => sum + goal.reward, 0));
      expect(s.goal).toBe(15);
      expect(claimGoal(deserialize(serialize(s), 0))).toBe(0);
    }
  });
});
