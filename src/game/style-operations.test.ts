import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { MENU } from './data';
import { orderShares, prepTime, salePrice, dayDemand, baseArrivalRate, tablePatience } from './economy';
import { batchSeconds, batchSteps, STATION_SECONDS } from './kitchen';
import { fastDrinkMeal, setCafeStyle, styleComboChance, styleOrderPairs, styleSeatChance, styleStationMultiplier, gardenReady, styleDwellExtra, styleServerMultiplier, styleSaleMultiplier, recordStyleHandoff } from './styles';
import { openShop } from './day';
import { Sim } from './sim';
import { adoptCat, updatePetCare } from './pets';
import { useDecor } from './decor';
import { mealReview } from './reputation';

const def=(id:string)=>MENU.find(m=>m.id===id)!;
describe('bakery operating route',()=>{
  it('aligns mixed-order demand with real pairing and retains ingredient workload',()=>{
    const s=createInitialState(0);s.kitchen=true;s.items.roll=1;s.onMenu=['espresso','roll'];const items=[def('espresso'),def('roll')];
    const plain=orderShares(items,s);setCafeStyle(s,'bakery');
    expect(styleComboChance(s,items[0],styleOrderPairs(s,items[0],items))).toBe(.5);
    expect(orderShares(items,s).get('espresso')).toBe(.75);expect(orderShares(items,s).get('roll')).toBe(.75);
    expect(plain.get('espresso')).toBe(.675);expect(dayDemand(s).get('roll')).toBeGreaterThan(0);
    expect(prepTime(s,'espresso')).toBe(1.2);expect(prepTime(s,'roll')).toBe(.8);
  });
  it('speeds station work only, never cook walking, and cannot help without a kitchen',()=>{
    const s=createInitialState(0);setCafeStyle(s,'bakery');expect(styleStationMultiplier(s)).toBe(1);
    s.kitchen=true;const plain=batchSeconds('roll');const work=batchSteps('roll').reduce((sum,station)=>sum+STATION_SECONDS[station],0);
    expect(styleStationMultiplier(s)).toBe(.9);expect(batchSeconds('roll',s)).toBeCloseTo(plain-work*.1);expect(batchSeconds('roll',s)).toBeGreaterThan(plain*.9);
    setCafeStyle(s,null);expect(batchSeconds('roll',s)).toBe(plain);
  });
  it('cannot create a combo when no complementary dish is on sale',()=>{
    const s=createInitialState(0);s.kitchen=true;setCafeStyle(s,'bakery');
    expect(orderShares([def('roll')],s).get('roll')).toBe(1);
    expect(styleOrderPairs(s,def('roll'),[def('roll')])).toEqual([]);
  });
});
describe('commuter counter route',()=>{
  it('uses recipe time, never machine speed, to qualify real drink-only meals',()=>{
    expect(fastDrinkMeal(['espresso'])).toBe(true);expect(fastDrinkMeal(['americano'])).toBe(true);expect(fastDrinkMeal(['cortado'])).toBe(true);
    expect(fastDrinkMeal(['flatwhite'])).toBe(false);expect(fastDrinkMeal(['latte'])).toBe(false);expect(fastDrinkMeal(['espresso','roll'])).toBe(false);expect(fastDrinkMeal([])).toBe(false);
    const s=createInitialState(0);s.upgrades.machine=20;setCafeStyle(s,'takeaway');expect(styleSeatChance(s,['latte'])).toBe(.6);expect(styleSeatChance(s,['espresso'])).toBe(0);
  });
  it('discounts actual eligible counter handoffs only and does not stack coffee focus',()=>{
    const s=createInitialState(0);const plain=salePrice(s,'espresso');setCafeStyle(s,'takeaway');
    expect(salePrice(s,'espresso')).toBeCloseTo(plain*.94);expect(salePrice(s,'espresso',false,true)).toBe(plain);
    expect(salePrice(s,'espresso',false,false,['espresso','roll'])).toBe(plain);setCafeStyle(s,'coffee');expect(salePrice(s,'espresso')).toBeCloseTo(plain*1.04);
  });
  it('actual espresso guests bypass the pass and tables, paying the visible discount',()=>{
    const s=createInitialState(0);setCafeStyle(s,'takeaway');openShop(s);let seed=143;const sim=new Sim(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
    for(let i=0;i<3600;i++){sim.update(s,.05);expect(sim.customers.some(c=>c.dineIn)).toBe(false);expect(sim.pass.length).toBe(0);}
    sim.beginClosing(s);for(let i=0;i<6000&&!sim.finishedService;i++)sim.update(s,.05);const report=sim.closeShop(s)!;
    expect(report.profit).toBeGreaterThan(0);expect(s.cafeStyle.handoffs.fastServed).toBe(s.served);expect(s.cafeStyle.handoffs.tableServed).toBe(0);
  });
});

const cozy=(s:ReturnType<typeof createInitialState>)=>{s.coins=100000;useDecor(s,'sill_cactus');useDecor(s,'rug_red');};
describe('cat lifestyle handoff and care',()=>{
  it('requires actual cared cats, comfort and table service; care expiry removes both effects',()=>{
    const s=createInitialState(0);s.coins=10000;adoptCat(s,'ginger');setCafeStyle(s,'cats');
    expect(styleSaleMultiplier(s,'espresso',true)).toBe(1);cozy(s);
    expect(styleSaleMultiplier(s,'espresso',false)).toBe(1);expect(styleSaleMultiplier(s,'espresso',true)).toBe(1.04);expect(styleDwellExtra(s,['espresso'])).toBe(4);
    s.pets[0].autoRefill=false;s.phase='open';updatePetCare(s,180);
    expect(styleSaleMultiplier(s,'espresso',true)).toBe(1);expect(styleDwellExtra(s,['espresso'])).toBe(0);expect(s.today.petCost).toBeCloseTo(8);
  });
  it('caps per-cat stacking and cannot stack with another focus',()=>{
    const s=createInitialState(0);cozy(s);for(const cat of ['ginger','tuxedo','calico'])adoptCat(s,cat);setCafeStyle(s,'cats');
    expect(styleSaleMultiplier(s,'espresso',true)).toBe(1.12);expect(styleDwellExtra(s,['espresso'])).toBe(12);
    setCafeStyle(s,'coffee');expect(styleSaleMultiplier(s,'espresso',true)).toBe(1.04);expect(styleDwellExtra(s,['espresso'])).toBe(0);
  });
});
describe('garden tea and pastry service',()=>{
  it('needs genuine planted surroundings, not a stored decoration or late room',()=>{
    const s=createInitialState(0);s.coins=100000;useDecor(s,'rug_red');s.decor.stored.plant_fern=1;setCafeStyle(s,'garden');
    expect(gardenReady(s)).toBe(false);expect(styleSaleMultiplier(s,'blacktea',true)).toBe(1);useDecor(s,'sill_cactus');
    expect(gardenReady(s)).toBe(true);expect(s.regions).toEqual([]);expect(styleSaleMultiplier(s,'blacktea',true)).toBe(1.06);
  });
  it('pays pairs once at actual table delivery and keeps counter/bread distinction',()=>{
    const s=createInitialState(0);cozy(s);setCafeStyle(s,'garden');const meal=['blacktea','donut'] as const;
    expect(styleSaleMultiplier(s,'blacktea',true,meal)).toBe(1.12);expect(styleSaleMultiplier(s,'donut',true,meal)).toBe(1.12);
    expect(styleSaleMultiplier(s,'blacktea',false,meal)).toBe(1);expect(styleSaleMultiplier(s,'roll',true,['blacktea','roll'])).toBe(1);
    expect(styleDwellExtra(s,meal)).toBe(6);expect(styleSeatChance(s,meal)).toBe(.8);expect(styleSeatChance(s,['espresso'])).toBe(.6);
    recordStyleHandoff(s,meal,true);recordStyleHandoff(s,meal,false);recordStyleHandoff(s,['blacktea'],true);expect(s.cafeStyle.handoffs.teaPairs).toBe(1);
  });
  it('uses the same directed tea/pastry pairing for simulation and forecasts',()=>{
    const s=createInitialState(0);cozy(s);setCafeStyle(s,'garden');const items=['espresso','blacktea','roll','donut'].map(def);
    expect(styleOrderPairs(s,def('blacktea'),items).map(m=>m.id)).toEqual(['donut']);expect(styleOrderPairs(s,def('donut'),items).map(m=>m.id)).toEqual(['blacktea']);
    const shares=orderShares(items,s);expect([...shares.values()].reduce((a,b)=>a+b,0)).toBeCloseTo(1.425);
    expect(shares.get('donut')).toBeGreaterThan(shares.get('roll')!);expect(shares.get('blacktea')).toBeGreaterThan(shares.get('espresso')!);
  });
});
describe('bookish community reliability',()=>{
  it('trades arrivals for physical server speed and patience, with no manufactured review quality',()=>{
    const s=createInitialState(0);setCafeStyle(s,'community');expect(styleServerMultiplier(s)).toBe(1);cozy(s);setCafeStyle(s,null);
    const arrivals=baseArrivalRate(s),patience=tablePatience(s),rating=mealReview(s,['espresso'],35,false);setCafeStyle(s,'community');
    expect(baseArrivalRate(s)).toBeCloseTo(arrivals*.9);expect(tablePatience(s)).toBe(patience+10);expect(styleServerMultiplier(s)).toBe(1.15);
    expect(mealReview(s,['espresso'],35,false)).toEqual(rating);expect(rating.stars).toBe(3);
  });
});
