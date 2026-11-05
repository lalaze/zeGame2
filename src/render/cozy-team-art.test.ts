import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { TEAM_BASE_STYLES, TEAM_HAIRSTYLES, TEAM_STANDING_SIZE, clearCozyTeam, cozyTeamReady, cozyTeamStyleReady, preloadCozyTeam, preloadCozyTeamStyle, teamStandingTransform, validateTeamManifest, wantCozyTeamStyle, type TeamManifest } from './cozy-team-art';

// The v8 manifest lists every family; v7 sheets are referenced from it by relative path.
const manifest = (): TeamManifest => JSON.parse(readFileSync('public/art/generated/cozy-team-v8/manifest.json', 'utf8'));

describe('whole-figure cozy team art', () => {
  it('keeps every existing hairstyle ID in place and all authored animation poses', () => {
    // Saved looks store the index, so the original eight stay first and in order.
    expect(TEAM_HAIRSTYLES.slice(0, 8)).toEqual(['short', 'bun', 'long', 'bob', 'pony', 'sidepart', 'braids', 'waves']);
    expect(TEAM_HAIRSTYLES).toHaveLength(32);
    expect(new Set(TEAM_HAIRSTYLES).size).toBe(TEAM_HAIRSTYLES.length);
    const m = manifest();
    expect(() => validateTeamManifest(m)).not.toThrow();
    for (const sheet of [...m.families, m.chef, ...m.seated, m.chefSeated]) {
      const png = readFileSync(`public/art/generated/cozy-team-v8/${sheet.file}`);
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
    // Every family can be chosen for the owner.
    expect(readFileSync('src/game/state.ts', 'utf8')).toContain(`hairStyle: ${TEAM_HAIRSTYLES.length}`);
  });
});

describe('loading owner looks on demand', () => {
  const requested: string[] = [];
  let failing: (file: string) => boolean = () => false;
  const names = () => requested.map(src => src.split('/').pop()!);
  beforeEach(() => {
    clearCozyTeam(); requested.length = 0; failing = () => false;
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => manifest() }));
    vi.stubGlobal('Image', class {
      naturalWidth = 4096; naturalHeight = 4096; src = '';
      async decode() { requested.push(this.src); if (failing(this.src)) throw Error('offline'); }
    });
    const ctx = { drawImage() {}, putImageData() {}, getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  });
  afterEach(() => { vi.unstubAllGlobals(); clearCozyTeam(); });

  it('opens with the eight staff families and the cook, and no owner-only sheet', async () => {
    await preloadCozyTeam();
    expect(cozyTeamReady()).toBe(true);
    expect(cozyTeamStyleReady(TEAM_BASE_STYLES - 1)).toBe(true);
    expect(cozyTeamStyleReady(TEAM_BASE_STYLES)).toBe(false);
    expect(names().filter(name => /^hair-/.test(name))).toHaveLength(TEAM_BASE_STYLES);
    expect(names().filter(name => /^hair-(?:[89]|\d\d)-/.test(name))).toEqual([]);
  });
  it('decodes one look when asked, sharing its seated sheet with its neighbour', async () => {
    await preloadCozyTeam(); requested.length = 0;
    await Promise.all([preloadCozyTeamStyle(12), preloadCozyTeamStyle(13)]);
    expect(names().sort()).toEqual(['hair-12-beard-v1.png', 'hair-13-buzz-v1.png', 'seated-d.png']);
    expect(cozyTeamStyleReady(12)).toBe(true);
    expect(cozyTeamStyleReady(14)).toBe(false);
  });
  it('holds the first picture for a saved owner look, but still opens if it cannot load', async () => {
    wantCozyTeamStyle(24);
    await preloadCozyTeam();
    expect(cozyTeamStyleReady(24)).toBe(true);
    clearCozyTeam(); requested.length = 0;
    failing = src => src.includes('hair-25-');
    wantCozyTeamStyle(25);
    await expect(preloadCozyTeam()).resolves.toBeUndefined();
    expect(cozyTeamReady()).toBe(true);
    expect(cozyTeamStyleReady(25)).toBe(false);
  });
  it('keeps the owner-only sheets small enough to ship', () => {
    for (const sheet of [...manifest().families.slice(TEAM_BASE_STYLES), ...manifest().seated.slice(TEAM_BASE_STYLES / 4)])
      expect(statSync(`public/art/generated/cozy-team-v8/${sheet.file}`).size).toBeLessThan(200_000);
  });
});
