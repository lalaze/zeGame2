import { describe, expect, it } from 'vitest';
import { WALK_CYCLE_STRIDE, walkFrame, type CharacterFrames, type Facing } from './sprites';

const frame = (name: string) => ({ name }) as unknown as HTMLCanvasElement;
const three = (side: string) => [frame(`${side}-stand`), frame(`${side}-stepA`), frame(`${side}-stepB`)];
const base = (): CharacterFrames => ({
  down: three('down'), up: three('up'), left: three('left'), right: three('right'), stand: frame('stand'),
  sitLeft: frame('sitLeft'), sitRight: frame('sitRight'), sitPetLeft: [frame('a'), frame('b')], sitPetRight: [frame('c'), frame('d')],
});
const name = (f: HTMLCanvasElement) => (f as unknown as { name: string }).name;

describe('walkFrame', () => {
  it('stands still on the standing pose, with or without a painted cycle', () => {
    const plain = base(), painted = { ...base(), walk: { down: [frame('w0')], up: [], left: [], right: [] } };
    expect(walkFrame(plain, 'down', 7, false)).toEqual({ frame: plain.down[0], bob: 0 });
    expect(walkFrame(painted, 'down', 7, false)).toEqual({ frame: painted.down[0], bob: 0 });
  });
  it('alternates the two step poses through the standing pose, bobbing on each step', () => {
    const frames = base(), seen = [0, 5, 10, 15, 20].map(stride => walkFrame(frames, 'right', stride, true));
    expect(seen.map(s => name(s.frame))).toEqual(['right-stepA', 'right-stand', 'right-stepB', 'right-stand', 'right-stepA']);
    expect(seen.map(s => s.bob)).toEqual([1, 0, 1, 0, 1]);
  });
  it('plays every frame of a painted cycle once per two steps and leaves the bob to the art', () => {
    const cycle = Array.from({ length: 6 }, (_, n) => frame(`c${n}`));
    const frames: CharacterFrames = { ...base(), walk: { down: cycle, up: cycle, left: cycle, right: cycle } };
    const strides = Array.from({ length: 13 }, (_, n) => n * WALK_CYCLE_STRIDE / 6 + .01);
    expect(strides.map(stride => name(walkFrame(frames, 'left', stride, true).frame))).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c0']);
    for (const facing of ['down', 'up', 'left', 'right'] as Facing[]) expect(walkFrame(frames, facing, 3, true).bob).toBe(0);
  });
  it('falls back to the three poses for a direction whose cycle is empty', () => {
    const frames: CharacterFrames = { ...base(), walk: { down: [], up: [], left: [], right: [] } };
    expect(name(walkFrame(frames, 'up', 0, true).frame)).toBe('up-stepA');
  });
});
