// Color ramps in the Stardew style: shadows shift toward purple/blue and get
// more saturated, highlights shift toward yellow, instead of plain darkening.

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Moves a hue toward a target hue by up to `amount` degrees. */
function hueToward(h: number, target: number, amount: number): number {
  const diff = ((target - h + 540) % 360) - 180;
  return h + Math.sign(diff) * Math.min(Math.abs(diff), amount);
}

export function shade(hex: string, steps: number): string {
  const [h, s, l] = hexToHsl(hex);
  if (steps < 0) {
    // Shadows: darker, a bit more saturated, hue slides toward violet.
    return hslToHex(hueToward(h, 265, 12 * -steps), s + 0.06 * -steps, l - 0.11 * -steps);
  }
  // Highlights: lighter, hue slides toward warm yellow.
  return hslToHex(hueToward(h, 50, 8 * steps), s - 0.02 * steps, l + 0.08 * steps);
}

export interface Ramp {
  hi: string;
  base: string;
  lo: string;
  dark: string;
}

const rampCache = new Map<string, Ramp>();
export function ramp(base: string): Ramp {
  let r = rampCache.get(base);
  if (!r) {
    r = { hi: shade(base, 1), base, lo: shade(base, -1), dark: shade(base, -2.4) };
    rampCache.set(base, r);
  }
  return r;
}

const edgeCache = new Map<string, string>();
/**
 * Outline color for pixels touching `hex`: a deep, hue-shifted version of the
 * fill, as in Stardew's selective outlines, never lighter than a dark brown.
 */
export function edge(hex: string): string {
  let e = edgeCache.get(hex);
  if (!e) {
    const [h, s, l] = hexToHsl(hex);
    e = mix(hslToHex(hueToward(h, 345, 25), Math.min(0.55, s * 0.7 + 0.15), Math.min(0.2, l * 0.3 + 0.04)), '#2e1c16', 0.45);
    edgeCache.set(hex, e);
  }
  return e;
}

/** Linear blend of two hex colors; t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16);
  const pb = parseInt(b.slice(1, 7), 16);
  const ch = (shift: number) => {
    const v = Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
    return v.toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
