import { describe, expect, it } from 'vitest';
import { beam, lightingAt, roomAmbient } from './lighting';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const brightness = (hex: string) => rgb(hex).reduce((a, b) => a + b, 0);
const warmth = (hex: string) => rgb(hex)[0] - rgb(hex)[2];

describe('lighting through the day', () => {
  it('changes gradually, with no jumps between moments', () => {
    let prev = lightingAt(0);
    for (let h = 0.01; h <= 24; h += 0.01) {
      const now = lightingAt(h);
      rgb(now.ambient).forEach((c, i) => expect(Math.abs(c - rgb(prev.ambient)[i])).toBeLessThanOrEqual(3));
      expect(Math.abs(now.lamps - prev.lamps)).toBeLessThan(0.02);
      expect(Math.abs(now.sun.strength - prev.sun.strength)).toBeLessThan(0.02);
      prev = now;
    }
    expect(lightingAt(24)).toEqual(lightingAt(0));
  });

  it('is brightest at midday and darkest at night', () => {
    const noon = lightingAt(12);
    const night = lightingAt(23);
    expect(noon.ambient).toBe('#ffffff');
    expect(brightness(night.ambient)).toBeLessThan(brightness(lightingAt(19).ambient));
    expect(night.dark).toBe(1);
    expect(noon.dark).toBe(0);
  });

  it('turns golden late in the afternoon', () => {
    expect(warmth(lightingAt(17.5).ambient)).toBeGreaterThan(warmth(lightingAt(12).ambient) + 50);
    expect(warmth(lightingAt(17.5).sun.color)).toBeGreaterThan(warmth(lightingAt(12).sun.color));
  });

  it('switches the lamps on as it gets dark while the shop is open', () => {
    expect(lightingAt(12).lamps).toBe(0);
    expect(lightingAt(9).lamps).toBe(0);
    for (let h = 16; h < 20; h += 0.25) expect(lightingAt(h + 0.25).lamps).toBeGreaterThanOrEqual(lightingAt(h).lamps);
    expect(lightingAt(20).lamps).toBe(1);
  });

  it('moves the sun across the sky, slanting the beams the other way after noon', () => {
    const morning = lightingAt(9).sun;
    const afternoon = lightingAt(16).sun;
    expect(morning.x).toBeLessThan(afternoon.x);
    expect(lightingAt(12.75).sun.elevation).toBeCloseTo(1, 1);
    expect(lightingAt(22).sun.elevation).toBe(0);
    expect(lightingAt(22).sun.strength).toBe(0);
    expect(beam(morning).lean).toBeGreaterThan(0);
    expect(beam(afternoon).lean).toBeLessThan(0);
    expect(beam(lightingAt(18).sun).length).toBeGreaterThan(beam(lightingAt(12.75).sun).length);
  });

  it('lets more of the sky into the glasshouse and patio than the walled rooms', () => {
    const dusk = lightingAt(20);
    expect(brightness(roomAmbient(dusk, 'terrace'))).toBeLessThan(brightness(roomAmbient(dusk, 'greenhouse')));
    expect(brightness(roomAmbient(dusk, 'greenhouse'))).toBeLessThan(brightness(roomAmbient(dusk, 'main')));
    expect(roomAmbient(lightingAt(12), 'main')).toBe('#ffffff');
  });
});
