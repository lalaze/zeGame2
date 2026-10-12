import sceneSource from './phaser/cafe-scene.ts?raw';
import { afterEach, describe, expect, it } from 'vitest';
import { CafeView } from './cafe-view';
import { createInitialState } from '../game/state';
import { adoptCat } from '../game/pets';
import { areaOrigin, MIN_SCENE_H, setSceneHeight } from '../game/layout';
import { CELL } from '../game/furniture';
import { regionOffset } from '../game/regions';

afterEach(() => setSceneHeight(MIN_SCENE_H));
function residents() {
  const state = createInitialState(0); state.coins = 1e6; state.regions = ['reading'];
  for (const id of ['ginger', 'tuxedo', 'calico']) adoptCat(state, id);
  const view = new CafeView(); view.livingCats.update(state, 0); return { state, view };
}
describe('resident view interaction', () => {
  it('finds each real actor only in its room and ignores old window decorations', () => {
    const { view } = residents();
    for (const actor of view.livingCats.actors.values()) {
      view.moveToArea(actor.area, true);
      expect(view.hitResidentCat(actor.x, actor.y - 8)).toBe(actor.id);
    }
    view.moveToArea('main', true);
    expect(view.hitResidentCat(26, 49)).toBe(null);
  });
  it('selects the nearest of overlapping generous hit targets', () => {
    const { view } = residents();
    const [a,b] = [...view.livingCats.actors.values()];
    Object.assign(a, { area: 'main', x: 100, y: 150 }); Object.assign(b, { area: 'main', x: 108, y: 150 });
    expect(view.hitResidentCat(107, 142)).toBe(b.id);
  });
  it('supports a 44 CSS-pixel mobile hit target without enlarging the sprite', () => {
    const { view } = residents(); const cat = view.livingCats.actors.get('ginger')!;
    expect(view.hitResidentCat(cat.x + 23, cat.y - 8, 24)).toBe(cat.id);
    expect(view.hitResidentCat(cat.x + 25, cat.y - 8, 24)).toBe(null);
  });
  it('does not interact through overview or paused dialogs', () => {
    const { view } = residents(); const cat = view.livingCats.actors.get('ginger')!;
    view.paused = true; expect(view.hitResidentCat(cat.x, cat.y)).toBe(null);
    view.paused = false; view.setOverview(true, true); expect(view.hitResidentCat(cat.x, cat.y)).toBe(null);
  });
  it('pets the selected actor, places feedback there, and does not touch economics', () => {
    const { state, view } = residents(); const before = JSON.stringify(state);
    const cat = view.livingCats.actors.get('tuxedo')!;
    expect(view.petResidentCat(cat.id)).toBe(true); expect(view.selectedCat).toBe(cat.id);
    expect(view.catSelectionSeconds).toBe(6); expect(view.effects[0].x).toBe(cat.x - 4);
    expect(JSON.stringify(state)).toBe(before);
    state.pets.find(p => p.id === cat.id)!.careSeconds = 0; view.livingCats.update(state, 0.01);
    expect(view.petResidentCat(cat.id)).toBe(false);
  });
  it('blocks placing floor furnishings onto cats in each storage-coordinate room', () => {
    const { view } = residents(); const cat = view.livingCats.actors.get('ginger')!;
    const o = areaOrigin('reading'); Object.assign(cat, {area:'reading',x:o.x+44,y:o.y+145});
    const col = regionOffset('reading') / CELL + 5;
    expect(view.catSpaceClear('catbed',col,7)).toBe(false);
    expect(view.catSpaceClear('clock',col,7)).toBe(true);
    expect(view.catSpaceClear('catbed',col+10,7)).toBe(true);
  });
});

describe('resident rendering integration', () => {
  it('renders residents exactly once per frame, in the floor depth pass', () => {
    const source = sceneSource;
    expect(source.match(/this\.drawResidents\(state\)/g)).toHaveLength(1);
    expect(source).toContain('private drawFloorStanding(state: GameState, t: number): void {\n    this.drawResidents(state);');
    expect(source).toContain('.setAlpha(1).setFlipX(false)');
    expect(source).toContain('.setFlipX(residentCatFlipX(walking, cat.facing))');
  });
});

describe('reciprocal guest rendering integration', () => {
  it('uses paired seated sprites for both table passes and static reduced-motion poses', () => {
    expect(sceneSource).toContain("cat.interaction?.guestId === c.id && cat.interaction.phase === 'response'");
    expect(sceneSource).toContain('frames.sitPetRight : frames.sitPetLeft');
    expect(sceneSource).toContain('this.motionPreference.matches || this.view.paused');
    expect(sceneSource.match(/sitter\(side, c\)/g)).toHaveLength(2);
    expect(sceneSource).toContain('quiet ? frames.lookUp : frames.nuzzle');
    expect(sceneSource).not.toContain('c.id % 4 === 0');
  });
  it('shares the existing thought-cloud budget instead of spawning independent dialogue', () => {
    expect(sceneSource).toContain("key: 'pet.living.thought.response'");
    expect(sceneSource).toContain('candidates = candidates.filter(c => c.id !== id)');
    expect(sceneSource).toContain('this.thoughts.update(dt,');
    expect(sceneSource).toContain('x: cat.x - 11, y: cat.y - 20, w: 22, h: 24');
  });
});
