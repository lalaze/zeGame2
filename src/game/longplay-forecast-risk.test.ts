import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState } from './state';
import { Sim } from './sim';
import { openShop } from './day';
import { bakeForForecast, restock, restockQuote } from './economy';
import { MIN_SCENE_H, setSceneHeight, setKitchenLevel } from './layout';
describe('long-play forecast risk diagnostic', () => {
 it('records 60 seeded three-minute mixed-menu runs without asserting guaranteed coverage', () => {
  const rows = [];
  for (const stage of [1,2]) for(let seed=1;seed<=30;seed++) {
   setSceneHeight(MIN_SCENE_H); setKitchenLevel(stage);
   const s=createInitialState(0); s.coins=25000; s.kitchen=true;
   s.items.espresso=stage===1?10:20; s.items.americano=1; s.items.roll=1;
   s.onMenu=['espresso','americano','roll']; s.upgrades.barista=1; s.upgrades.machine=1; s.upgrades.cook=stage-1;
   if(stage===2){s.items.latte=1;s.onMenu.push('latte');s.regions=['reading'];s.upgrades.server=1;}
   for(const key of Object.keys(s.pantry)) s.pantry[key as keyof typeof s.pantry]=0;
   bakeForForecast(s); const q=restockQuote(s);expect(restock(s)).toBe(true);
   expect(restockQuote(s).cost).toBe(0); expect(openShop(s)).toBeTruthy();
   let rng=seed;const sim=new Sim(()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296});
   for(let step=0;step<3600;step++)sim.update(s,.05);
   rows.push({stage,seed,window:180,quote:q.cost,served:s.today.served,soldOut:s.today.soldOut,extraLost:s.today.extraLost,shortages:{...s.today.shortages}});
   expect(Object.values(s.pantry).every(n=>Number.isFinite(n)&&n>=0)).toBe(true);
  }
  setSceneHeight(MIN_SCENE_H);setKitchenLevel(0);
  mkdirSync('artifacts/longplay-fixes-1a309fcc',{recursive:true});
  writeFileSync('artifacts/longplay-fixes-1a309fcc/forecast-risk.json',JSON.stringify({scope:'Synthetic representative fixtures, not a replay of the original unseeded days 4 and 6. No saved game used.',rows},null,2));
 }, 60000);
});
