import { describe, it, expect } from 'vitest';
import { createInitialState, serialize, deserialize } from './state';
import { Sim } from './sim';
import { openShop } from './day';
import { syncPartners, recruitPartner, assignPartner, trainPartner, recordPartnerWork, readPartnerChapter, partnerServerSpeed, partnerTraySize, partnerSlots } from './partners';
const rng = (seed = 7) => () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed / 2**32; };
describe('partner starter-server vertical slice', () => {
  it('keeps all legacy purchased slots without recharging or invented experience', () => {
    const s = createInitialState(1); s.upgrades.barista=3; s.upgrades.server=2; s.upgrades.cook=2; s.kitchen=true; s.coins=123;
    const legacy=JSON.parse(serialize(s)); delete legacy.partners; legacy.version=15;
    const loaded=deserialize(JSON.stringify(legacy),2);
    expect(Object.keys(loaded.partners.roster)).toHaveLength(9);
    expect(loaded.coins).toBe(123); expect(loaded.partners.active.barista).toHaveLength(3);
    expect(Object.values(loaded.partners.roster).every(p=>p.xp===0)).toBe(true);
    expect(deserialize(serialize(loaded),3).partners).toEqual(loaded.partners);
  });
  it('separates reserve candidates from capacity and only swaps when closed', () => {
    const s=createInitialState(1); s.coins=500;
    expect(recruitPartner(s,'ari')).toBe(true); expect(partnerSlots(s,'server')).toBe(1);
    expect(s.partners.active.server).toEqual(['yue']); expect(assignPartner(s,'ari',0)).toBe(true);
    openShop(s); expect(assignPartner(s,'yue',0)).toBe(false);
    const sim=new Sim(rng());sim.update(s,0);
    expect(sim.servers[0].partnerId).toBe('ari');
  });
  it('earns server XP only from actual successful sim deliveries; paired refresh is identical', () => {
    const s=createInitialState(1); openShop(s); const sim=new Sim(rng());
    for(let i=0;i<2400;i++)sim.update(s,.05);
    expect(s.partners.roster.yue.xp).toBeGreaterThan(0);
    expect(s.partners.roster.yue.xp).toBeLessThanOrEqual(s.today.served);
    const copy=deserialize(serialize(s),2), snap=sim.snapshot(s), resumed=new Sim(rng());
    expect(resumed.restore(snap,copy)).toBe(true);
    const xp=copy.partners.roster.yue.xp;
    resumed.update(copy,0); resumed.update(copy,0);
    expect(copy.partners.roster.yue.xp).toBe(xp);
    expect(resumed.servers[0].partnerId).toBe('yue');
    const report=resumed.closeShop(copy)!;
    expect(report.partners?.find(p=>p.id==='yue')?.jobs).toBe(xp);
    expect(copy.partners.roster.yue.xp).toBe(xp);
  });
  it('requires real worked business days; reading and prep cannot farm XP', () => {
    const s=createInitialState(1);
    recordPartnerWork(s,'yue');expect(s.partners.roster.yue.xp).toBe(0);
    openShop(s);for(let i=0;i<60;i++)recordPartnerWork(s,'yue');
    expect(s.partners.roster.yue.unlocked).toBe(1);
    expect(readPartnerChapter(s,'yue',0)).toBe(true);expect(readPartnerChapter(s,'yue',0)).toBe(false);
    expect(readPartnerChapter(s,'yue',1)).toBe(false);
    s.day++;recordPartnerWork(s,'yue');expect(s.partners.roster.yue.unlocked).toBe(2);
    s.day++;recordPartnerWork(s,'yue');expect(s.partners.roster.yue.unlocked).toBe(3);
  });
  it('prices mutually exclusive closed-shop training with explicit throughput tradeoffs', () => {
    const s=createInitialState(1);s.coins=100;s.partners.roster.yue.xp=20;
    expect(trainPartner(s,'yue','a')).toBe(true);expect(s.coins).toBe(20);
    expect(partnerServerSpeed(s,'yue',1)).toBe(1.2);expect(partnerTraySize(s,'yue')).toBe(1);
    expect(trainPartner(s,'yue','b')).toBe(false);
    s.coins=100;expect(trainPartner(s,'yue','b')).toBe(true);
    expect(partnerServerSpeed(s,'yue',1)).toBe(.9);expect(partnerServerSpeed(s,'yue',2)).toBe(1.1);
    s.phase='open';expect(trainPartner(s,'yue','a')).toBe(false);
  });
  it('retains bought upgrades while repairing malformed roster records', () => {
    const s=createInitialState(1);s.upgrades.barista=1;
    const raw=JSON.parse(serialize(s)); raw.partners={roster:{yue:{xp:Infinity,unlocked:99,read:[0,0,50]}},active:{server:['ghost','yue','yue']}};
    const copy=deserialize(JSON.stringify(raw),1);syncPartners(copy);
    expect(copy.partners.active.server).toEqual(['yue']);expect(copy.partners.active.barista).toEqual(['lin']);
    expect(copy.partners.roster.yue.unlocked).toBe(0);
  });
});
