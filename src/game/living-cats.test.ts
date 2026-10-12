import { afterEach, describe, expect, it } from 'vitest';
import { LivingCats, type CatBehavior, type CatGuestCandidate }  from './living-cats';
import { Sim } from './sim';
import { canPlace } from './furniture';
import { createInitialState } from './state';
import { adoptCat, petTraffic } from './pets';
import { areaAtPoint, floorY, seatSpot, sceneHeight, setSceneHeight } from './layout';
import { segmentCrossesObstacle } from './navigation';
function setup() { const s = createInitialState(0); s.coins = 10000; adoptCat(s, 'ginger'); return s; }
function seeded() { let n = 13; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
afterEach(() => setSceneHeight(240));
describe('living café cats', () => {
  it('creates distinct keyed actors and resets without changing the game', () => {
    const s = setup(); adoptCat(s, 'tuxedo'); adoptCat(s, 'calico'); const cats = new LivingCats(seeded()); const before = JSON.stringify(s);
    cats.update(s, 0); expect(cats.actors.size).toBe(3);
    expect(new Set([...cats.actors.values()].map((p) => `${p.x},${p.y}`)).size).toBe(3);
    cats.update(s, 60); expect(JSON.stringify(s)).toBe(before); cats.reset(); expect(cats.actors.size).toBe(0);
  });
  it('sustains every behavior and varies selection by personality', () => {
    const s = setup(), cats = new LivingCats(seeded()); cats.update(s, 0);
    const seen = new Set<CatBehavior>(); const a = cats.actors.get('ginger')!;
    for (let i = 0; i < 6000; i++) { cats.update(s, 0.5); seen.add(a.behavior); }
    expect([...seen].sort()).toEqual(['groom', 'patrol', 'sleep', 'stretch', 'watch']);
    a.route = []; a.behavior = 'groom'; a.remaining = 10; cats.update(s, 1); expect(a.behavior).toBe('groom'); expect(a.remaining).toBeCloseTo(9);
    const occupancy = (personality: 'quiet'|'playful') => {
      const state = setup(); state.pets[0].personality = personality;
      const engine = new LivingCats(seeded()); let sleep = 0, patrol = 0;
      for (let i = 0; i < 3000; i++) { engine.update(state, 0.5); const b = engine.actors.get('ginger')!.behavior; if (b === 'sleep') sleep++; if (b === 'patrol') patrol++; }
      return {sleep, patrol};
    };
    const quiet = occupancy('quiet'), playful = occupancy('playful'); expect(quiet.sleep).toBeGreaterThan(playful.sleep); expect(playful.patrol).toBeGreaterThan(quiet.patrol);
  });
  it('freezes motion, clocks and interaction feedback at dt zero', () => {
    const s = setup(), cats = new LivingCats(seeded()); cats.update(s, 20); cats.interact('ginger');
    const before = JSON.stringify([...cats.actors]); cats.update(s, 0); cats.update(s, Number.NaN); expect(JSON.stringify([...cats.actors])).toBe(before);
  });
  it('sleeps when care is empty and stretches after refill without paying for it', () => {
    const s = setup(), cats = new LivingCats(seeded()); cats.update(s, 1); s.pets[0].careSeconds = 0;
    const coins = s.coins, cost = s.today.petCost; cats.update(s, 20); const a = cats.actors.get('ginger')!;
    expect(a.behavior).toBe('sleep'); expect(a.resting).toBe(true); const point = {x:a.x,y:a.y};
    expect(cats.interact('ginger')).toBe(false); cats.update(s, 60); expect({x:a.x,y:a.y}).toEqual(point); expect(s.coins).toBe(coins); expect(s.today.petCost).toBe(cost); expect(petTraffic(s)).toBe(1);
    s.pets[0].careSeconds = 180; cats.update(s, 0.5); expect(a.behavior).toBe('stretch'); expect(a.resting).toBe(false);
  });
  it('uses the shared right doorway, never the kitchen or wall, to reach a newly preferred room', () => {
    const s = setup(), cats = new LivingCats(seeded()); s.pets[0].preferredArea = 'main'; cats.update(s, 0);
    s.regions.push('reading'); s.pets[0].preferredArea = 'reading'; s.pets[0].personality = 'quiet';
    const a = cats.actors.get('ginger')!; let crossed = false;
    for (let i = 0; i < 1200; i++) {
      const previous = {x:a.x,y:a.y}; cats.update(s, 0.1);
      expect(areaAtPoint(a.x,a.y)).not.toBe('kitchen');
      if (previous.x < 320 && a.x >= 320) { crossed = true; expect(a.y).toBeCloseTo(floorY(138)); }
    }
    expect(crossed).toBe(true); expect(a.area).toBe('reading');
  });
  it('follows the north door corridor into the greenhouse', () => {
    const s = setup(), cats = new LivingCats(seeded()); s.regions.push('reading','greenhouse'); s.pets[0].preferredArea = 'reading'; s.pets[0].personality = 'quiet'; cats.update(s,0);
    s.pets[0].preferredArea = 'greenhouse'; const a = cats.actors.get('ginger')!; let crossed = false;
    for(let i=0;i<1600;i++) { const oldY=a.y; cats.update(s,0.1); if(oldY>=0 && a.y<0) {crossed=true;expect(a.x).toBeCloseTo(480);} }
    expect(crossed).toBe(true); expect(a.area).toBe('greenhouse');
  });
  it('avoids floor furniture and selects a reachable bed apron for sleep', () => {
    const s = setup(); s.pets[0].personality='quiet'; s.pets[0].preferredArea='main'; s.decor.placed.push({id:'catbed',col:2,row:10});
    const cats = new LivingCats(() => 0.1); cats.update(s,0); const a = cats.actors.get('ginger')!; let sleptNearBed=false;
    const box = {x:16,y:floorY(160),w:16,h:floorY(168)-floorY(160)};
    for(let i=0;i<1200;i++) { const old={x:a.x,y:a.y}; cats.update(s,0.1); expect(segmentCrossesObstacle(old,a,box)).toBe(false); if(a.behavior==='sleep' && a.targetKind==='bed') sleptNearBed=true; }
    expect(sleptNearBed).toBe(true);
  });
  it('replans safely after resize and furniture changes without arbitrary relocation', () => {
    const s=setup(), cats=new LivingCats(seeded()); cats.update(s,20); const a=cats.actors.get('ginger')!;
    setSceneHeight(360); cats.update(s,0); expect(a.x).toBeGreaterThan(0); expect(a.y).toBeLessThan(sceneHeight());
    const old={x:a.x,y:a.y}; s.decor.placed.push({id:'plant_fern',col:2,row:9}); cats.update(s,0); expect({x:a.x,y:a.y}).toEqual(old);
    for(let i=0;i<100;i++) cats.update(s,.1); expect(Number.isFinite(a.x+a.y)).toBe(true);
  });
  it('yields to service actors and refuses furnishing over its feet', () => {
    const s=setup(), cats=new LivingCats(seeded()); cats.update(s,0); const a=cats.actors.get('ginger')!;
    a.x=26;a.y=140;a.route=[{x:50,y:140}];a.behavior='patrol'; cats.update(s,1,{customers:[{x:34,y:140}]}); expect(a.x).toBe(26);
    a.x=20;a.y=floorY(164); expect(cats.furnitureSpaceClear('catbed',2,10)).toBe(false); expect(cats.furnitureSpaceClear('clock',2,1)).toBe(true);
  });
  it('finishes a door crossing before sleeping when care runs out', () => {
    const s=setup(); s.regions.push('reading'); const cats=new LivingCats(seeded()); cats.update(s,0);
    const a=cats.actors.get('ginger')!; a.x=319; a.y=floorY(138); a.route=[{x:332,y:floorY(138)},{x:370,y:floorY(145)}];
    s.pets[0].careSeconds=0; cats.update(s,.1); expect(a.behavior).toBe('patrol');
    for(let i=0;i<200;i++) cats.update(s,.1);
    expect(a.area).toBe('reading');expect(a.behavior).toBe('sleep');expect(a.route).toHaveLength(0);expect(Math.abs(a.y-floorY(138))).toBeGreaterThan(10);
  });
  it('walks out continuously if a new table consumes its existing footprint', () => {
    const s=setup(), cats=new LivingCats(seeded());cats.update(s,0);const a=cats.actors.get('ginger')!;
    a.x=40;a.y=floorY(174);a.route=[];a.behavior='sleep';a.remaining=30;
    s.upgrades.tables=1;const old={x:a.x,y:a.y};cats.update(s,0);expect({x:a.x,y:a.y}).toEqual(old);expect(a.route.length).toBeGreaterThan(0);
    cats.update(s,.1);expect(Math.hypot(a.x-old.x,a.y-old.y)).toBeLessThanOrEqual(2.51);
    for(let i=0;i<100;i++) cats.update(s,.1);
    expect(segmentCrossesObstacle(a,a,{x:17,y:floorY(174)-10,w:46,h:13})).toBe(false);
  });
  it('honors window watching and clears a stored beds stale resting target', () => {
    const s=setup();s.pets[0].personality='quiet';s.pets[0].preferredArea='main';s.pets[0].preferredSpot='window';
    const cats=new LivingCats(()=>.99);cats.update(s,0);const a=cats.actors.get('ginger')!;
    a.x=66;a.y=floorY(200);a.targetKind='explore';a.behavior='groom';a.remaining=0;
    cats.update(s,.1);expect(a.targetKind).toBe('window');for(let i=0;i<300;i++) {cats.update(s,.1);if((a.behavior as CatBehavior)==='watch')break;}
    expect(a.behavior).toBe('watch');expect(a.targetKind).toBe('window');
    s.decor.placed.push({id:'catbed',col:2,row:10});cats.update(s,0);
    a.x=24;a.y=floorY(168)+8;a.route=[];a.targetKind='bed';a.behavior='sleep';a.remaining=30;
    s.decor.placed=s.decor.placed.filter((p)=>p.id!=='catbed');cats.update(s,0);
    expect(a.targetKind).not.toBe('bed');expect(a.remaining).toBeLessThanOrEqual(1);
  });
  it.each(['stored', 'moved'] as const)('invalidates an en-route bed when it is %s without teleporting', (change) => {
    const s=setup();s.pets[0].personality='quiet';s.pets[0].preferredArea='main';
    s.decor.placed.push({id:'catbed',col:2,row:10});const cats=new LivingCats(()=>.1);cats.update(s,0);
    const a=cats.actors.get('ginger')!;a.x=24;a.y=200;a.route=[{x:24,y:176}];a.targetKind='bed';a.behavior='patrol';
    if(change==='stored') s.decor.placed=s.decor.placed.filter((p)=>p.id!=='catbed');
    else s.decor.placed.find((p)=>p.id==='catbed')!.col=6;
    cats.update(s,0);expect({x:a.x,y:a.y}).toEqual({x:24,y:200});expect(a.targetKind).not.toBe('bed');expect(a.route.length).toBeGreaterThan(0);
    cats.update(s,2);expect(a.behavior).not.toBe('sleep');
    for(let i=0;i<400;i++) cats.update(s,.1);
    if(change==='moved') {expect(a.targetKind).toBe('bed');expect(a.x).toBe(56);}
  });
  it('keeps all three residents visible in a densely legally furnished main room', () => {
    const s=setup();adoptCat(s,'tuxedo');adoptCat(s,'calico');s.upgrades.tables=6;
    for(let row=0;row<19;row++) for(let col=1;col<39;col++) if(canPlace(s,'plant_snake',col,row,8)) s.decor.placed.push({id:'plant_snake',col,row});
    expect(s.decor.placed.filter((p)=>p.id==='plant_snake').length).toBeGreaterThan(20);
    const cats=new LivingCats(seeded());cats.update(s,0);expect(cats.actors.size).toBe(3);
    expect(new Set([...cats.actors.values()].map((a)=>a.x+','+a.y)).size).toBe(3);
  });
  it('does not reserve the same resting destination for two residents', () => {
    const s=setup();adoptCat(s,'tuxedo');adoptCat(s,'calico');s.decor.placed.push({id:'catbed',col:2,row:10});
    for(const p of s.pets) {p.personality='quiet';p.preferredArea='main';p.preferredSpot='cozy';}
    const cats=new LivingCats(seeded());
    for(let i=0;i<2000;i++) {
      cats.update(s,.2);const actors=[...cats.actors.values()];
      for(let a=0;a<actors.length;a++) for(let b=a+1;b<actors.length;b++) {
        if(actors[a].route.length || actors[b].route.length)continue;
        expect(Math.hypot(actors[a].x-actors[b].x,actors[a].y-actors[b].y)).toBeGreaterThanOrEqual(14);
      }
    }
  });
  it('greets affectionately without awarding money or affecting traffic', () => {
    const s=setup(); s.pets[0].personality='affectionate'; const cats=new LivingCats(seeded()); cats.update(s,0);
    const before=JSON.stringify(s); expect(cats.interact('ginger')).toBe(true); expect(cats.actors.get('ginger')!.affection).toBe(5); expect(JSON.stringify(s)).toBe(before);
    s.pets=[];cats.update(s,0);expect(cats.actors.size).toBe(0);
  });
});


function guestSetup(personality: 'affectionate'|'playful'|'quiet' = 'affectionate') {
  const state=setup();state.pets[0].personality=personality;state.pets[0].preferredArea='main';
  const engine=new LivingCats(()=>0);engine.update(state,0);
  const actor=engine.actors.get('ginger')!;actor.x=66;actor.y=floorY(200);actor.route=[];actor.behavior='watch';actor.remaining=1000;
  const guest: CatGuestCandidate={id:42,seat:0,phase:'sitting',...seatSpot(0,0)};
  return {state,engine,actor,guest};
}
describe('real seated guest visits',()=>{
  it('runs approach, nuzzle, guest response and leave without changing customers or economy',()=>{
    const {state,engine,actor,guest}=guestSetup();const stateBefore=JSON.stringify(state), guestBefore=JSON.stringify(guest);
    const phases=new Set<string>();let began=false,ended=false;
    for(let i=0;i<400;i++){engine.update(state,.1,{customers:[guest]});if(actor.interaction){began=true;phases.add(actor.interaction.phase);}else if(began)ended=true;}
    expect([...phases]).toEqual(['approach','nuzzle','response','leave']);expect(ended).toBe(true);
    expect(JSON.stringify(state)).toBe(stateBefore);expect(JSON.stringify(guest)).toBe(guestBefore);
    expect(actor.interaction).toBeUndefined();
  });
  it('has one global visit and never repeats a greeting to the same seated guest',()=>{
    const {state,engine,guest}=guestSetup();adoptCat(state,'tuxedo');adoptCat(state,'calico');
    for(const pet of state.pets)pet.personality='affectionate';engine.update(state,0);
    let starts=0,previous=false;
    for(let i=0;i<1600;i++){
      engine.update(state,.1,{customers:[guest]});const active=[...engine.actors.values()].filter((a)=>a.interaction);
      expect(active.length).toBeLessThanOrEqual(1);if(active.length&&!previous)starts++;previous=!!active.length;
    }
    expect(starts).toBe(1);
  });
  it.each(['queue','ordering','toSeat','exiting','plain'] as const)('ignores %s visitors even at a seat coordinate',phase=>{
    const {state,engine,actor,guest}=guestSetup();guest.phase=phase;if(phase==='plain'){delete guest.id;delete guest.seat;delete guest.phase;}
    for(let i=0;i<300;i++)engine.update(state,.1,{customers:[guest]});expect(actor.interaction).toBeUndefined();
  });
  it('requires real active seats and matching still coordinates',()=>{
    for(const variant of ['moving','invalidSeat','notBuilt'] as const){
      const {state,engine,actor,guest}=guestSetup();if(variant==='moving')guest.x+=8;else guest.seat=variant==='invalidSeat'?-1:16;
      for(let i=0;i<300;i++)engine.update(state,.1,{customers:[guest]});expect(actor.interaction).toBeUndefined();
    }
  });
  it('makes quiet cats noninitiating and delays playful cats more than affectionate cats',()=>{
    for(const personality of ['quiet','playful','affectionate'] as const){
      const {state,engine,actor,guest}=guestSetup(personality);let began=false;
      for(let i=0;i<250;i++){engine.update(state,.1,{customers:[guest]});began ||= !!actor.interaction;}
      expect(began).toBe(personality==='affectionate');
    }
  });
  it.each(['leaves','moves','care','furniture'] as const)('cancels immediately when %s changes and never follows the guest',reason=>{
    const {state,engine,actor,guest}=guestSetup();
    for(let i=0;i<200&&!actor.interaction;i++)engine.update(state,.1,{customers:[guest]});expect(actor.interaction).toBeDefined();
    if(reason==='leaves')guest.phase='exiting';if(reason==='moves')guest.x+=30;if(reason==='care')state.pets[0].careSeconds=0;
    if(reason==='furniture')state.decor.placed.push({id:'clock',col:9,row:0});
    const before={x:actor.x,y:actor.y};engine.update(state,.1,{customers:[guest]});expect(actor.interaction).toBeUndefined();
    expect(Math.hypot(actor.x-before.x,actor.y-before.y)).toBeLessThanOrEqual(2.01);
  });
  it('pauses all visit clocks and clears transient bindings on reset',()=>{
    const {state,engine,actor,guest}=guestSetup();for(let i=0;i<200&&!actor.interaction;i++)engine.update(state,.1,{customers:[guest]});
    const before=JSON.stringify(actor);for(let i=0;i<20;i++)engine.update(state,0,{customers:[guest]});expect(JSON.stringify(actor)).toBe(before);
    engine.reset();engine.update(state,0,{customers:[guest]});expect(engine.actors.get('ginger')!.interaction).toBeUndefined();
  });
  it('does not route across rooms for a visit or through a blocked seat apron',()=>{
    for(const blocked of [false,true]){
      const {state,engine,actor,guest}=guestSetup();
      if(blocked){state.decor.placed.push({id:'sideboard',col:9,row:13});}
      else {state.regions.push('reading');guest.seat=16;Object.assign(guest,seatSpot(8,0));}
      let began=false;for(let i=0;i<300;i++){engine.update(state,.1,{customers:[guest]});began ||= !!actor.interaction;}
      expect(began).toBe(false);
    }
  });
  it.each(['furniture','resize'] as const)('cancels a paused %s change without movement or a stale remote nuzzle',reason=>{
    const {state,engine,actor,guest}=guestSetup();for(let i=0;i<200&&!actor.interaction;i++)engine.update(state,.1,{customers:[guest]});
    expect(actor.interaction?.phase).toBe('approach');const before={x:actor.x,y:actor.y};
    if(reason==='furniture')state.decor.placed.push({id:'sideboard',col:9,row:13});else setSceneHeight(360);
    engine.update(state,0,{customers:[guest]});expect(actor.interaction).toBeUndefined();
    if(reason==='furniture')expect({x:actor.x,y:actor.y}).toEqual(before);
    else expect(actor.x).toBe(before.x);
    engine.update(state,.1,{customers:[guest]});expect(actor.interaction).toBeUndefined();
  });
  it('never treats a discarded approach route as arrival beside a guest',()=>{
    const {state,engine,actor,guest}=guestSetup();for(let i=0;i<200&&!actor.interaction;i++)engine.update(state,.1,{customers:[guest]});
    expect(actor.interaction?.phase).toBe('approach');actor.route=[];
    engine.update(state,.1,{customers:[guest]});expect(actor.interaction).toBeUndefined();
  });
  it('times out a blocked approach rather than remaining bound forever',()=>{
    const {state,engine,actor,guest}=guestSetup();for(let i=0;i<200&&!actor.interaction;i++)engine.update(state,.1,{customers:[guest]});
    expect(actor.interaction?.phase).toBe('approach');const obstacle={x:actor.x+1,y:actor.y-1};
    for(let i=0;i<120;i++)engine.update(state,.1,{customers:[guest],servers:[obstacle]});expect(actor.interaction).toBeUndefined();
  });
});


describe('bounded service yielding',()=>{
  it('keeps moving through 1200 seconds of the real seeded default-server simulation',()=>{
    const state=setup(),control=structuredClone(state),sim=new Sim(()=>.5),baseline=new Sim(()=>.5),cats=new LivingCats(seeded());
    let lastMotion=0,blocked=0,longestBlocked=0;
    const samples: {time:number;lastMotion:number}[]=[];
    for(let i=1;i<=12000;i++){
      const old=cats.actors.get('ginger'),point=old&&{x:old.x,y:old.y};
      sim.update(state,.1);baseline.update(control,.1);cats.update(state,.1,sim);
      const a=cats.actors.get('ginger')!,distance=point?Math.hypot(a.x-point.x,a.y-point.y):0;
      expect(distance).toBeLessThanOrEqual(2.501);
      if(distance>1e-8){lastMotion=i*.1;blocked=0;}else if(a.route.length){blocked+=.1;longestBlocked=Math.max(longestBlocked,blocked);}else blocked=0;
      if(i===3000||i===6000||i===12000)samples.push({time:i*.1,lastMotion});
    }
    expect(longestBlocked).toBeLessThan(5);expect(samples.every((sample)=>sample.time-sample.lastMotion<60)).toBe(true);
    expect(state).toEqual(control);expect(sim.servers).toEqual(baseline.servers);
    state.pets[0].careSeconds=0;let sleepAt:number|null=null;
    for(let i=1;i<=600;i++){sim.update(state,.1);cats.update(state,.1,sim);const a=cats.actors.get('ginger')!;if(a.behavior==='sleep'&&sleepAt===null)sleepAt=i*.1;}
    expect(sleepAt).not.toBeNull();expect(sleepAt!).toBeLessThan(20);expect(cats.actors.get('ginger')!.route).toHaveLength(0);
    console.info('default-server yielding regression',{samples,longestBlocked,sleepAt});
  });
  it.each([false,true])('safely escapes the reported idle-server trap with care empty=%s',empty=>{
    const state=setup(),cats=new LivingCats(seeded());cats.update(state,0);const a=cats.actors.get('ginger')!;
    a.x=263.642053928;a.y=128.348435170;a.route=[{x:294,y:120}];a.behavior='patrol';a.targetKind='window';
    if(empty)state.pets[0].careSeconds=0;const server={x:264,y:119},before=JSON.stringify(server);
    let moved=false,slept=false;
    for(let i=0;i<300;i++){
      const old={x:a.x,y:a.y};cats.update(state,.1,{servers:[server]});const distance=Math.hypot(a.x-old.x,a.y-old.y);
      expect(distance).toBeLessThanOrEqual(2.501);expect(Math.hypot(a.x-server.x,a.y-server.y)).toBeGreaterThanOrEqual(9-1e-7);
      moved ||= distance>0;slept ||= (a.behavior as CatBehavior)==='sleep';
    }
    expect(moved).toBe(true);if(empty){expect(slept).toBe(true);expect(a.behavior).toBe('sleep');expect(Math.abs(a.y-floorY(138))).toBeGreaterThan(10);}
    expect(JSON.stringify(server)).toBe(before);
  });
  it('abandons an occupied target and recovers from repeated blockers without crossing furniture',()=>{
    const state=setup(),cats=new LivingCats(seeded());cats.update(state,0);const a=cats.actors.get('ginger')!;
    for(let cycle=0;cycle<4;cycle++){
      a.x=263.642053928;a.y=128.348435170;a.route=[{x:294,y:120}];a.behavior='patrol';
      const servers=[{x:264,y:119},{x:281,y:119},{x:298,y:119}];let moved=false;
      for(let i=0;i<100;i++){
        const old={x:a.x,y:a.y};cats.update(state,.1,{servers});moved ||= Math.hypot(a.x-old.x,a.y-old.y)>0;
        for(const server of servers)expect(Math.hypot(a.x-server.x,a.y-server.y)).toBeGreaterThanOrEqual(9-1e-7);
        expect(segmentCrossesObstacle(old,a,{x:266,y:80,w:40,h:28})).toBe(false);
      }
      expect(moved).toBe(true);expect(Math.hypot(a.x-294,a.y-120)).toBeGreaterThan(9);
    }
  });
  it('does not accrue blocked time while paused and bounds oversized deltas',()=>{
    const state=setup(),cats=new LivingCats(seeded());cats.update(state,0);const a=cats.actors.get('ginger')!;
    a.x=263.642053928;a.y=128.348435170;a.route=[{x:294,y:120}];a.behavior='patrol';const blockers={servers:[{x:264,y:119}]};
    cats.update(state,1,blockers);const before=JSON.stringify(a);for(let i=0;i<50;i++)cats.update(state,0,blockers);expect(JSON.stringify(a)).toBe(before);
    cats.update(state,.5,blockers);expect(a.x).toBe(263.642053928);cats.update(state,1e9,blockers);expect(Number.isFinite(a.x+a.y)).toBe(true);
  });
});
