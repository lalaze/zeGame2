import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TEAM_HAIRSTYLES, TEAM_STANDING_SIZE, teamStandingTransform, validateTeamManifest, type TeamManifest } from './cozy-team-art';

const manifest = (): TeamManifest => JSON.parse(readFileSync('public/art/generated/cozy-team-v7/manifest.json', 'utf8'));

describe('whole-figure cozy team art', () => {
  it('keeps every existing hairstyle ID and all authored animation poses', () => {
    expect(TEAM_HAIRSTYLES).toEqual(['short', 'bun', 'long', 'bob', 'pony', 'sidepart', 'braids', 'waves']);
    const m = manifest();
    expect(() => validateTeamManifest(m)).not.toThrow();
    for (const sheet of [...m.families, m.chef, ...m.seated, m.chefSeated]) {
      const png = readFileSync(`public/art/generated/cozy-team-v7/${sheet.file}`);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      for (const [x, y, r, b] of sheet.bounds) {
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(width); expect(b).toBeLessThanOrEqual(height);
      }
    }
  });
  it('rejects partial manifests rather than silently reverting one role', () => {
    const m = manifest(); m.families[0].bounds.pop();
    expect(() => validateTeamManifest(m)).toThrow('Incomplete cozy team poses');
    const bad = manifest(); bad.chef.bounds[0] = [0, 0, -1, 10];
    expect(() => validateTeamManifest(bad)).toThrow('Invalid cozy team bounds');
  });
  it('scales the complete head, torso and short limbs uniformly', () => {
    for (const sheet of [...manifest().families, manifest().chef]) {
      const sizes = sheet.bounds.slice(0, 9).map(([x, y, r, b]) => ({ width: r - x, height: b - y }));
      const t = teamStandingTransform(sizes);
      expect(t.foot).toEqual({ x: 16, y: 42 });
      expect([t.width, t.height]).toEqual([32, 44]);
      for (const p of sizes) {
        expect(p.height * t.scale).toBeLessThanOrEqual(TEAM_STANDING_SIZE.figureHeight + 1e-8);
        expect(p.width * t.scale).toBeLessThanOrEqual(28 + 1e-8);
        expect((p.width * t.scale) / (p.height * t.scale)).toBeCloseTo(p.width / p.height, 12);
      }
    }
  });
  it('publishes both whole-figure families without the retired customer leg transform', () => {
    const source = readFileSync('src/render/reference-character-art.ts', 'utf8');
    expect(source).toContain('makeCozyTeam(look, role');
    expect(source).toContain('makeBatchCharacter(look, role, appearanceId');
    expect(source).not.toContain('applyCozyCharacter(');
    expect(source).not.toContain('const standing=');
    expect(source).not.toContain('legExtension*density');
    expect(readFileSync('src/game/state.ts', 'utf8')).toContain('hairStyle: 4');
  });
});
