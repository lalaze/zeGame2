import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize } from './state';
import { prepTime, salePrice, buyItem, buyUpgrade } from './economy';
import { MENU } from './data';
import { setCafeStyle, styleStages, nextStyleGoal, STYLE_IDS, parseCafeStyle } from './styles';
import { openShop } from './day';
import { Sim } from './sim';
import { researchSignature } from './taste';

const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
describe('café style foundation and first complete route', () => {
  it('old saves retain the unchanged mixed policy and assets', () => {
    const old = createInitialState(0); old.coins = 456; old.items.espresso = 7;
    const raw = JSON.parse(serialize(old)); delete raw.cafeStyle; raw.version = 13;
    const s = deserialize(JSON.stringify(raw), 5);
    expect(s.cafeStyle.focus).toBeNull(); expect(s.coins).toBe(456); expect(s.items.espresso).toBe(7);
    expect(salePrice(s, 'espresso')).toBe(salePrice(old, 'espresso'));
  });
  it('normalizes malformed focus values and persists all six choices', () => {
    for (const invalid of [null, [], 'coffee', {focus:'unknown'}, {focus:[]}, {focus:4}]) expect(parseCafeStyle(invalid).focus).toBeNull();
    for (const id of STYLE_IDS) { const s = createInitialState(0); expect(setCafeStyle(s,id)).toBe(true); expect(deserialize(serialize(s), 0).cafeStyle.focus).toBe(id); }
  });
  it('switching is prep-only and never changes or rewards assets', () => {
    const s = createInitialState(0); s.coins = 5000; buyItem(s, 'espresso', 10); buyUpgrade(s,'machine',1);
    const before = serialize(s);
    for (let i=0;i<20;i++) for (const id of [...STYLE_IDS,null]) expect(setCafeStyle(s,id)).toBe(true);
    expect(serialize(s)).toBe(before);
    for (const phase of ['open','closing'] as const) { s.phase=phase; expect(setCafeStyle(s,'coffee')).toBe(false); expect(s.cafeStyle.focus).toBeNull(); }
  });
  it('coffee gains a real quality-dependent premium at a brewing cost', () => {
    const s=createInitialState(0); const plain=salePrice(s,'espresso'); const time=prepTime(s,'espresso');
    setCafeStyle(s,'coffee'); expect(salePrice(s,'espresso')).toBeCloseTo(plain*1.04); expect(prepTime(s,'espresso')).toBeCloseTo(time*1.12);
    s.taste.served.espresso=30; expect(salePrice(s,'espresso')).toBeCloseTo(plain*1.08);
    s.taste.served.espresso=100;s.coins=200;expect(researchSignature(s,'espresso')).toBe(true);expect(salePrice(s,'espresso')).toBeCloseTo(plain*1.12);
    const restored=deserialize(serialize(s),0); expect(salePrice(restored,'espresso')).toBe(salePrice(s,'espresso'));
    setCafeStyle(s,null); expect(salePrice(s,'espresso')).toBe(plain);
  });
  it('coffee does not alter other dishes or compound by switching', () => {
    const s=createInitialState(0);s.items.blacktea=1;const plain=salePrice(s,'blacktea');setCafeStyle(s,'coffee');
    expect(salePrice(s,'blacktea')).toBe(plain);expect(prepTime(s,'blacktea')).toBe(MENU.find(m=>m.id==='blacktea')!.prepTime);
    const price=salePrice(s,'espresso');for(let i=0;i<20;i++){setCafeStyle(s,null);setCafeStyle(s,'coffee');}expect(salePrice(s,'espresso')).toBe(price);
  });
  it('offers attainable first steps even before route capital is owned', () => {
    const s=createInitialState(0);
    for(const id of STYLE_IDS){const stages=styleStages(s,id);expect(stages.map(x=>x.id)).toEqual(['early','mid','late']);expect(stages.every(x=>x.goals.length>=3)).toBe(true);expect(nextStyleGoal(s,id)).not.toBeNull();}
    expect(nextStyleGoal(s,'bakery')!.id).toBe('espresso5');expect(nextStyleGoal(s,'cats')!.id).toBe('espresso5');
  });
  it('a genuine zero-coin coffee opening makes money without manual boosts or endowed fixtures', () => {
    const s=createInitialState(0);setCafeStyle(s,'coffee');openShop(s);const sim=new Sim(rng(123));
    for(let i=0;i<3600;i++)sim.update(s,.05);sim.beginClosing(s);
    for(let i=0;i<6000&&!sim.finishedService;i++)sim.update(s,.05);
    expect(sim.finishedService).toBe(true);const report=sim.closeShop(s)!;
    expect(report.profit).toBeGreaterThan(0);expect(s.served).toBeGreaterThan(20);expect(s.coins).toBeGreaterThan(0);expect(s.taste.served.espresso).toBe(s.served);
  });
});

describe('style history integrity', () => {
  it('never invents legacy table or pair history from lifetime totals', () => {
    const s=createInitialState(0);s.served=1000;const raw=JSON.parse(serialize(s));delete raw.cafeStyle;
    expect(deserialize(JSON.stringify(raw),0).cafeStyle.handoffs).toEqual({tableServed:0,catServed:0,fastServed:0,teaPairs:0});
  });
  it('only accepts bounded nonnegative integer handoff counters', () => {
    expect(parseCafeStyle({focus:'coffee',handoffs:{tableServed:NaN,catServed:-2,fastServed:1.5,teaPairs:1e12}}).handoffs).toEqual({tableServed:0,catServed:0,fastServed:0,teaPairs:1e9});
  });
  it('real coffee service records exactly one table or fast handoff per paid guest', () => {
    const s=createInitialState(0);setCafeStyle(s,'coffee');openShop(s);const sim=new Sim(rng(234));
    for(let i=0;i<3600;i++)sim.update(s,.05);sim.beginClosing(s);for(let i=0;i<6000&&!sim.finishedService;i++)sim.update(s,.05);sim.closeShop(s);
    expect(s.cafeStyle.handoffs.tableServed+s.cafeStyle.handoffs.fastServed).toBe(s.served);
    const loaded=deserialize(serialize(s),0);expect(loaded.cafeStyle.handoffs).toEqual(s.cafeStyle.handoffs);
    for(const id of STYLE_IDS)setCafeStyle(loaded,id);expect(loaded.cafeStyle.handoffs).toEqual(s.cafeStyle.handoffs);
  });
});
