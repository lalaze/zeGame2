import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CAST } from './customer-cast';
import { openShop } from './day';
import { PARTNERS } from './partners';
import { Sim } from './sim';
import { createInitialState, deserialize, hairClashes, serialize, withoutHairClash, type Look } from './state';

const look = (skin: number, hair: number): Look => ({ skin, hair, hairStyle: 9, shirt: 4, pants: 2 });

afterEach(() => { vi.restoreAllMocks(); });

describe('golden hair on the deepest skin', () => {
  it('is the one pairing ruled out', () => {
    for (let skin = 0; skin < 4; skin++) for (let hair = 0; hair < 6; hair++) {
      expect(hairClashes({ skin, hair }), `skin ${skin} hair ${hair}`).toBe(skin === 3 && hair === 2);
    }
    expect(withoutHairClash(look(3, 2))).toEqual(look(3, 0));
    const fine = look(2, 2);
    expect(withoutHairClash(fine)).toBe(fine);
  });

  it('is dropped from an owner saved with it, keeping the rest of the look', () => {
    const s = createInitialState(0);
    s.profile = { cafeName: 'Cafe', ownerName: 'Owner', look: look(3, 2) };
    expect(deserialize(serialize(s), 0).profile!.look).toEqual(look(3, 0));
    s.profile.look = look(2, 2);
    expect(deserialize(serialize(s), 0).profile!.look).toEqual(look(2, 2));
  });

  it('is never worn by staff hired at random', () => {
    vi.spyOn(Sim.prototype as unknown as { randomLook: () => Look }, 'randomLook').mockImplementation(() => look(3, 2));
    const s = createInitialState(0);
    for (const k of Object.keys(s.pantry) as (keyof typeof s.pantry)[]) s.pantry[k] = 1e6;
    s.upgrades.barista = 2;
    openShop(s);
    const sim = new Sim(() => .5);
    sim.update(s, .05);
    const staff = [...sim.baristas, ...sim.servers, ...sim.cooks];
    expect(sim.baristas.length).toBe(3);
    for (const member of staff) expect(hairClashes(member.look), JSON.stringify(member.look)).toBe(false);
  });

  it('is not given to any partner or guest', () => {
    expect(PARTNERS.filter((partner) => hairClashes(partner.look)).map((partner) => partner.id)).toEqual([]);
    expect(CUSTOMER_CAST.filter((guest) => hairClashes(guest.look)).map((guest) => guest.name)).toEqual([]);
  });
});
