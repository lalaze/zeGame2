/** Controlled fixture tests, not evidence of new-game financial reachability. */
import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize } from './state';
import { STYLE_IDS, setCafeStyle } from './styles';
import { Sim } from './sim';
import { openShop } from './day';
import { adoptCat } from './pets';
import { useDecor } from './decor';
import { bakeForForecast, buyUpgrade, restock } from './economy';
import { researchSignature } from './taste';

const rng=(n:number)=>()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
const tick=(s:ReturnType<typeof createInitialState>,sim:Sim,n:number)=>{for(let i=0;i<n;i++)sim.update(s,.05);};
function mixedFixture(){
  const s=createInitialState(0);s.coins=50000;s.kitchen=true;s.items.espresso=10;s.items.blacktea=3;s.items.donut=3;s.onMenu=['espresso','blacktea','donut'];
  useDecor(s,'sill_cactus');useDecor(s,'rug_red');adoptCat(s,'ginger');buyUpgrade(s,'barista',1);buyUpgrade(s,'server',1);
  s.taste.served.espresso=100;researchSignature(s,'espresso');bakeForForecast(s);restock(s);return s;
}
describe('mixed styles, live saves and settlement',()=>{
  it.each(STYLE_IDS)('%s survives repeated live reloads without replaying handoff counters or purchases',style=>{
    const s=mixedFixture();setCafeStyle(s,style);openShop(s);
    let sourceRng=rng(870);const sim=new Sim(()=>sourceRng());tick(s,sim,2000);sim.beginClosing(s);
    const saved=serialize(s),snapshot=sim.snapshot(s);
    // Accepted guests can still choose a seat after closing. Exact continuation
    // comparisons require matching future random draws, not two unrelated seeds.
    sourceRng=rng(901);const loaded=deserialize(saved,0),resumed=new Sim(rng(901));
    expect(resumed.restore(snapshot,loaded)).toBe(true);expect(loaded.cafeStyle).toEqual(s.cafeStyle);expect(loaded.pantry).toEqual(s.pantry);
    expect(setCafeStyle(loaded,'coffee')).toBe(false);expect(loaded.cafeStyle.focus).toBe(style);
    for(let j=0;j<3;j++){
      const before={...loaded.cafeStyle.handoffs};const snap=resumed.snapshot(loaded);expect(resumed.restore(snap,loaded)).toBe(true);expect(loaded.cafeStyle.handoffs).toEqual(before);
    }
    for(let i=0;i<6000&&!sim.finishedService;i++)sim.update(s,.05);for(let i=0;i<6000&&!resumed.finishedService;i++)resumed.update(loaded,.05);
    expect(sim.finishedService).toBe(true);expect(resumed.finishedService).toBe(true);
    const report=sim.closeShop(s)!,reloadReport=resumed.closeShop(loaded)!;
    expect(reloadReport.served).toBe(report.served);expect(reloadReport.revenue).toBeCloseTo(report.revenue,7);expect(loaded.cafeStyle.handoffs).toEqual(s.cafeStyle.handoffs);
    const before=serialize(loaded);expect(resumed.closeShop(loaded)).toBeNull();expect(serialize(loaded)).toBe(before);
    expect(loaded.taste.signature).toContain('espresso');expect(loaded.pets).toHaveLength(1);expect(loaded.kitchen).toBe(true);expect(loaded.onMenu).toEqual(['espresso','blacktea','donut']);
  });
  it('switching keeps all paid mixed investments and uses only one operating focus',()=>{
    const s=mixedFixture();const assets={coins:s.coins,items:{...s.items},pets:structuredClone(s.pets),decor:structuredClone(s.decor),taste:structuredClone(s.taste),pantry:{...s.pantry},upgrades:{...s.upgrades}};
    for(const id of STYLE_IDS){setCafeStyle(s,id);const restored=deserialize(serialize(s),0);expect(restored.cafeStyle.focus).toBe(id);expect(restored.coins).toBe(assets.coins);expect(restored.items).toEqual(assets.items);expect(restored.taste).toEqual(assets.taste);expect(restored.pets).toEqual(assets.pets);expect(restored.decor).toEqual(assets.decor);expect(restored.pantry).toEqual(assets.pantry);expect(restored.upgrades).toEqual(assets.upgrades);}
  });
});
