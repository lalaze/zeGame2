import { describe, expect, it } from 'vitest';
import { ThoughtBubbles, URGENT_THOUGHT, placeThought, thoughtBubbleWidth } from './thought-bubbles';
import type { ThoughtCandidate } from './thoughts';
const c = (id: string, priority = 1): ThoughtCandidate => ({ id, priority, key: 'thought.arrival' as ThoughtCandidate['key'], context: 'queue', x: 160, y: 100 });
function tick(b: ThoughtBubbles, seconds: number, candidates = [c('a'), c('b'), c('c')], room = 'main', enabled = true) {
  let shown: ThoughtCandidate[] = [];
  for (let t = 0; t < seconds; t += .25) shown = b.update(.25, room, enabled, candidates);
  return shown;
}
describe('thought bubble pacing', () => {
  it('caps simultaneous thoughts, spaces starts, and favors meaningful moments', () => {
    const b = new ThoughtBubbles();
    expect(tick(b, 1, [c('a'), c('b', 9), c('c')]).map(c => c.id)).toEqual(['b']);
    for (let i = 0; i < 60; i++) expect(tick(b, .25).length).toBeLessThanOrEqual(2);
  });
  it('lets a reply to the player speak at once, even mid-thought and during cooldown, but only once', () => {
    const b = new ThoughtBubbles();
    expect(tick(b, 1, [c('a'), c('b')]).map(c => c.id)).toEqual(['a']);
    const reply = { ...c('b', URGENT_THOUGHT), context: 'moment:1' };
    expect(b.update(.1, 'main', true, [c('a'), reply]).map(c => c.id)).toEqual(['b']);
    expect(tick(b, 5, [c('a'), { ...c('b'), context: 'queue' }]).map(c => c.id)).not.toContain('b');
    expect(tick(b, 1, [c('a'), reply]).map(c => c.id)).not.toContain('b');
  });
  it('does not repeat a character during cooldown', () => {
    const b = new ThoughtBubbles();
    expect(tick(b, 1, [c('a')])).toHaveLength(1);
    expect(tick(b, 6, [c('a')])).toHaveLength(0);
    expect(tick(b, 8, [c('a')])).toHaveLength(0);
    expect(tick(b, 6, [c('a')])).toHaveLength(1);
  });
  it('clears immediately when paused, switching rooms, or characters disappear', () => {
    const b = new ThoughtBubbles();
    expect(tick(b, 1)).toHaveLength(1);
    expect(b.update(.1, 'main', false, [c('a')])).toEqual([]);
    tick(b, 1);
    expect(b.update(.1, 'kitchen', true, [c('a')])).toEqual([]);
    tick(b, 1, [c('a')], 'kitchen');
    expect(b.update(.1, 'kitchen', true, [])).toEqual([]);
  });
  it('lets the first taste follow a service thought within a short meal', () => {
    const b = new ThoughtBubbles();
    const served = { ...c('a'), context: 'table:served' };
    expect(tick(b, 1, [served])).toHaveLength(1);
    expect(tick(b, 3, [{ ...served, context: 'taste:like:espresso:bold' }])).toHaveLength(1);
  });
  it('invalidates a thought as soon as the action changes', () => {
    const b = new ThoughtBubbles(); tick(b, 1, [c('a')]);
    expect(b.update(.1, 'main', true, [{ ...c('a'), context: 'exiting' }])).toEqual([]);
  });
});
describe('speaker-attached thought placement', () => {
  const room = { x: 0, y: 0, w: 320, h: 240 };
  const speaker = { id: 'customer:12', x: 160, y: 100 };
  const head = { x: 151, y: 100, w: 18, h: 18 };
  const overlaps = (a: {x:number;y:number;w:number;h:number}, b: typeof a) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  it('keeps a complete close trail attached to the identified head', () => {
    const p = placeThought(speaker, 90, 22, room, [head])!;
    expect(p).not.toBeNull(); expect(p.speakerId).toBe(speaker.id); expect(p.anchor).toEqual({x:160,y:100});
    expect(speaker.y - (p.y+p.h)).toBe(12); expect(p.dots).toHaveLength(3);
    const end=p.dots.at(-1)!;
    expect(end.x+end.w/2).toBe(speaker.x); expect(speaker.y-(end.y+end.h)).toBe(1);
    expect(p.dots.every(dot=>!overlaps(dot,head))).toBe(true);
  });
  it('reroutes the entire trail around task indicators, never through them', () => {
    const progress={x:150,y:94,w:20,h:5};
    const p=placeThought(speaker,90,22,room,[head,progress])!;
    expect(p).not.toBeNull(); expect(p.dots).toHaveLength(4);
    expect(p.dots.every(dot=>!overlaps(dot,progress)&&!overlaps(dot,head))).toBe(true);
    const end=p.dots.at(-1)!; expect(Math.abs(end.x+end.w/2-speaker.x)).toBe(12);
  });
  it('rejects the entire cloud if its identifying trail cannot fit', () => {
    const blocker={x:130,y:89,w:60,h:11};
    expect(placeThought(speaker,90,22,room,[head,blocker])).toBeNull();
  });
  it('never finds distant space when the close placement is blocked', () => {
    const blocker={x:100,y:65,w:120,h:23};
    expect(placeThought(speaker,90,22,room,[head,blocker])).toBeNull();
    expect(placeThought({id:'edge',x:6,y:120},90,22,room,[])).toBeNull();
    expect(placeThought({...speaker,y:20},90,22,room,[])).toBeNull();
  });
  it('follows a moving speaker without keeping their old screen anchor', () => {
    const first=placeThought(speaker,90,22,room,[head])!;
    const second=placeThought({...speaker,x:178,y:110},90,22,room,[{...head,x:169,y:110}])!;
    expect(second.speakerId).toBe(first.speakerId); expect(second.anchor).toEqual({x:178,y:110});
    expect(second.x-first.x).toBe(18); expect(second.y-first.y).toBe(10);
    second.dots.forEach((dot,i)=>{expect(dot.x-first.dots[i].x).toBe(18);expect(dot.y-first.dots[i].y).toBe(10)});
  });
  it('keeps the same trail while a walking head crosses fractional pixels', () => {
    for (const offset of [.01,.25,.49,.51,.75,.99,1.01]) {
      const p=placeThought({...speaker,x:160+offset,y:100+offset},90,22,room,[{...head,x:151+offset,y:100+offset}])!;
      expect(p.dots).toHaveLength(3);
      const end=p.dots.at(-1)!;
      expect(end.x+end.w/2).toBe(Math.round(160+offset));
      expect(p.anchor).toEqual({x:Math.round(160+offset),y:Math.round(100+offset)});
    }
  });
  it.each([138,182])('does not attach a side trail to a neighboring staff member at x=%s', neighborX => {
    const neighbor={x:neighborX-9,y:100,w:18,h:18};
    const progress={x:150,y:94,w:20,h:5};
    const p=placeThought(speaker,90,22,room,[head,neighbor,progress])!;
    expect(p).not.toBeNull();
    const end=p.dots.at(-1)!; const x=end.x+end.w/2;
    expect(Math.abs(x-speaker.x)).toBeLessThan(Math.abs(x-neighborX));
    expect(p.dots.every(dot=>!overlaps(dot,neighbor))).toBe(true);
  });
  it('keeps two complete bubble assemblies separate', () => {
    const a=placeThought({id:'a',x:70,y:110},80,22,room,[])!;
    const b=placeThought({id:'b',x:235,y:155},90,22,room,[a,...a.dots])!;
    expect(a).not.toBeNull();expect(b).not.toBeNull();
    expect([b,...b.dots].every(part=>[a,...a.dots].every(other=>!overlaps(part,other)))).toBe(true);
  });
});


describe('thought centerline polish', () => {
  const bounds = {x:0,y:0,w:320,h:240};
  it.each([12,35,36,47.5,59,84,95.1])('centers line width %s on the same head/cloud/dot axis', lineWidth => {
    const width=thoughtBubbleWidth(lineWidth);
    expect(width%2).toBe(0);expect(width-lineWidth).toBeGreaterThanOrEqual(12);
    for(const x of [100,159.49,159.51,220]) {
      const p=placeThought({id:'speaker',x,y:120},width,22,bounds,[])!;
      expect(p.x+p.w/2).toBe(Math.round(x));
      expect(p.dots.every(dot=>dot.x+dot.w/2===Math.round(x))).toBe(true);
    }
  });
  it('pads an odd-width cloud rather than biasing its center by half a pixel', () => {
    const p=placeThought({id:'speaker',x:160,y:120},89,22,bounds,[])!;
    expect(p.w).toBe(90);expect(p.x+p.w/2).toBe(160);
  });
  it('uses the smallest safe occlusion offset rather than a twelve-pixel jump', () => {
    const p=placeThought({id:'speaker',x:160,y:120},90,22,bounds,[{x:110,y:86,w:6,h:10}])!;
    expect(p.x+p.w/2-160).toBe(2);
    expect(p.dots.every(dot=>dot.x+dot.w/2===160)).toBe(true);
  });
  it('allows only the needed edge clamp while the trail stays on the head', () => {
    const p=placeThought({id:'speaker',x:35,y:120},90,22,bounds,[])!;
    expect(p.x).toBe(3);expect(p.x+p.w/2).toBe(48);
    expect(p.dots.every(dot=>dot.x+dot.w/2===35)).toBe(true);
  });
});


describe('stable symmetric fallback', () => {
  it('keeps the same safe side when a speaker crosses the room center', () => {
    const bounds={x:0,y:0,w:320,h:240};
    const plans=[159,160,161,162].map(x=>placeThought({id:'moving-owner',x,y:120},90,22,bounds,[{x:x-9,y:120,w:18,h:18},{x:x-10,y:114,w:20,h:5}])!);
    expect(plans.every(p=>p.dots.length===4)).toBe(true);
    const offsets=plans.map(p=>p.dots[0].x+p.dots[0].w/2-p.anchor.x);
    expect(new Set(offsets).size).toBe(1);
    expect(plans.every(p=>p.x+p.w/2===p.anchor.x)).toBe(true);
  });
});
