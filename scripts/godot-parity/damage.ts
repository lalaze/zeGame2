// Values the game never writes itself: what an old, edited or torn save might hold.
import type { Random } from './ops';

type Dict = Record<string, unknown>;
export const JUNK: unknown[] = [null, undefined, NaN, Infinity, -1, 0, -0, 0.5, 1, 3, 1e20, 2 ** 53, '', '1', 'x', '__proto__', 'constructor', '👍🏽é', true, false, [], {}, [null], [1, 1]];
export const NUMBERS = [0, -0, 1, 2, 3, 4, 5, 7, 9, 10, 25, 50, 100, 0.1, 0.5, 0.999, 1.5, 2.5, 59.5, 60, 119.95, 179.999, 180, 181, 240, 300, 3600, 7200.25, 1e5, 1e9, 1e16, -1, -0.5, NaN, Infinity];
const clone = <T,>(v: T): T => structuredClone(v);

/** A value like a real one, with a few places damaged, the way an old or edited save might be. */
export function damage(v: unknown, r: Random, hits = 1 + r.int(4)): unknown {
  let out = clone(v);
  for (; hits > 0; hits--) {
    const spots: [Dict, string][] = [];
    const walk = (x: unknown) => { if (x && typeof x === 'object') for (const k of Object.keys(x)) { spots.push([x as Dict, k]); walk((x as Dict)[k]); } };
    walk(out);
    if (!spots.length || r.chance(0.06)) { out = clone(r.pick(JUNK)); continue; }
    const [at, key] = r.pick(spots);
    const how = r.int(6);
    if (how === 0 && !Array.isArray(at)) delete at[key];
    else if (how === 1 && Array.isArray(at)) at.push(clone(r.pick(at)), clone(r.pick(JUNK)));
    else if (how === 2 && !Array.isArray(at)) at[r.pick(['0', '7', '12', 'zzz', 'toString'])] = clone(at[key]);
    else if (how === 3 && typeof at[key] === 'number') at[key] = r.pick(NUMBERS);
    else if (how === 4 && typeof at[key] === 'number') at[key] = (at[key] as number) * r.pick([-1, 0.5, 2, 1000]);
    else at[key] = clone(r.pick(JUNK));
  }
  return out;
}
