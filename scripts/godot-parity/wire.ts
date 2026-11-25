// Lossless values for Godot's own JSON parser: plain integers stay JSON numbers (it reads those exactly);
// every other number is "#" + its 64 bits in hex, undefined is "#u", and a real "#" string is escaped.
const view = Buffer.alloc(8);
/** The eight bytes of a double, low byte first, as Godot's decode_double reads them. */
export const hex = (x: number): string => {
  view.writeDoubleLE(Number.isNaN(x) ? NaN : x);
  return Number.isNaN(x) ? '000000000000f87f' : view.toString('hex');
};
export function wire(v: unknown): unknown {
  if (v === undefined) return '#u';
  if (typeof v === 'number') return Number.isInteger(v) && Math.abs(v) < 1e15 && !Object.is(v, -0) ? v : `#${hex(v)}`;
  if (typeof v === 'string') return v.startsWith('#') ? `#s${v}` : v;
  if (v === null || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(wire);
  if (v instanceof Map) return { '#map': [...v].map(([k, x]) => [wire(k), wire(x)]) };
  if (v instanceof Set) return { '#set': [...v].map(wire) };
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== 'function').map(([k, x]) => [k, wire(x)])); // A goal's condition is code, not data.
  throw new Error(`Cannot send ${typeof v} to Godot`);
}

/** Large values repeat (a state before and after a call, a wardrobe no call touches): each distinct one is stored once. */
export class Pool {
  readonly items: string[] = [];
  private readonly index = new Map<string, number>();
  put(v: unknown): unknown { return this.share(wire(v)); }
  private share(v: unknown): unknown {
    if (!v || typeof v !== 'object') return v;
    const out: unknown = Array.isArray(v) ? v.map((x) => this.share(x)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, this.share(x)]));
    const text = JSON.stringify(out);
    if (text.length < 120) return out;
    let at = this.index.get(text);
    if (at === undefined) { at = this.items.length; this.items.push(text); this.index.set(text, at); }
    return { '#p': at };
  }
}

export interface Rng { (): number; draws(): number }
export function lcg(seed: number): Rng {
  let n = seed >>> 0, draws = 0;
  const f = (() => { draws++; n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; }) as Rng;
  f.draws = () => draws;
  return f;
}
