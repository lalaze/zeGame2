// Run only in an isolated QA browser at the Vite preview origin. This sets initial
// conditions, never a learned memory or successful recommendation result.
(async () => {
  const { createInitialState, serialize, SAVE_KEY } = await import('/src/game/state.ts');
  const { openShop } = await import('/src/game/day.ts');
  const { Sim } = await import('/src/game/sim.ts');
  const { CUSTOMER_CAST } = await import('/src/game/customer-cast.ts');
  const { REGULAR_GUESTS } = await import('/src/game/regular-guests-content.ts');
  const { recordRegularGuestArrival, recordRegularGuestDeparture } = await import('/src/game/regular-guests.ts');
  const { validSnapshot } = await import('/src/game/sim-snapshot.ts');
  let seed = 42;
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const s = createInitialState(123); s.day = 11;
  s.profile = { cafeName: '推荐记忆测试', ownerName: 'QA', look: { skin: 1, hair: 1, hairStyle: 1, shirt: 1, pants: 1 } };
  s.items.latte = 1; s.onMenu = ['latte']; s.pantry.beans = s.pantry.milk = 10000; s.coins = 1000; s.upgrades.marketing = 3;
  openShop(s); const sim = new Sim(rng);
  for (let n = 0; n < 10000 && sim.queue.length < 5; n++) sim.update(s, .05);
  if (sim.queue.length < 5) throw Error('Fixture queue not ready');
  const queue = sim.queue.map(id => sim.customers.find(c => c.id === id));
  queue.forEach((c, i) => {
    if (c.regularGuestId) recordRegularGuestDeparture(s, c.regularGuestId, c.regularGuestVisitId);
    delete c.regularGuestId; delete c.regularGuestVisitId;
    if (i < queue.length - 1) {
      const g = REGULAR_GUESTS[i]; c.regularGuestId = g.id; c.appearanceId = g.appearanceId;
      c.regularGuestVisitId = recordRegularGuestArrival(s, g.id);
    } else { c.appearanceId = 11; c.order = 'espresso'; }
    c.look = { ...CUSTOMER_CAST[c.appearanceId].look }; c.patience = 200;
  });
  s.onMenu = ['espresso', 'latte']; const runtime = sim.snapshot(s); runtime.spawnTimer = 30;
  if (!validSnapshot(runtime, s)) throw Error('Invalid fixture snapshot');
  const raw = serialize({ ...s, runtime });
  localStorage.setItem('tiny-bean-cafe/locale', 'zh'); localStorage.setItem(SAVE_KEY, raw);
  localStorage.setItem('qa/memory-fixture', raw);
  location.reload();
  return { fixture: 'Queued milk-loving guest; named guests ahead and delayed arrivals for repeatable UI timing.', time: s.dayTime, targetId: queue.at(-1).id };
})()
