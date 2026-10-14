import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } } } }));
vi.mock('../reference-character-art', () => ({
  preloadReferenceCharacters: vi.fn(), referenceCharacterContacts: vi.fn(), referenceCharacterOffset: vi.fn(),
  resolveReferenceCharacter: vi.fn(() => null),
}));
import { CafeScene } from './cafe-scene';
import { GENERATED_MAIN_ASSETS } from '../generated-main-art';
import { preloadReferenceCharacters } from '../reference-character-art';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let characters: ReturnType<typeof deferred>;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  vi.clearAllMocks();
  characters = deferred();
  vi.mocked(preloadReferenceCharacters).mockReturnValue(characters.promise);
});
function harness() {
  const handlers = new Map<string, (...args: any[]) => void>();
  const lifecycle = new Map<string, () => void>();
  const progress = vi.fn(), fail = vi.fn(), ready = vi.fn(), tick = vi.fn();
  const create = vi.fn(() => ready());
  const scene = Object.assign(Object.create(CafeScene.prototype), {
    hooks: { loadingProgress: progress, tick }, onLoadError: fail, createCafe: create,
    events: { once: (event: string, fn: () => void) => lifecycle.set(event, fn),
      off: (event: string) => lifecycle.delete(event) },
    load: { image: vi.fn(), on: (event: string, fn: (...args: any[]) => void) => handlers.set(event, fn),
      once: (event: string, fn: (...args: any[]) => void) => handlers.set(event, fn) },
  });
  return { scene, handlers, lifecycle, progress, fail, create, ready, tick };
}
const mainAssets = Object.keys(GENERATED_MAIN_ASSETS).filter(id => !/^(?:barista|server|mina|customer)-/.test(id));
const total = mainAssets.length + 5;

describe('café image startup', () => {
  it('reports completed images and never initializes or ticks a failed scene', async () => {
    const h = harness();
    h.scene.preload();
    expect(h.scene.load.image).toHaveBeenCalledTimes(mainAssets.length);
    expect(h.scene.load.image.mock.calls.every(([key]: [string]) => !/^generated-main:(?:barista|server|mina|customer)-/.test(key))).toBe(true);
    expect(h.progress).toHaveBeenCalledWith(0, total);
    h.handlers.get('filecomplete')!();
    expect(h.progress).toHaveBeenLastCalledWith(1, total);
    h.handlers.get('loaderror')!({ key: 'generated-main:cat-ginger' });
    expect(h.fail.mock.calls[0][0].message).toContain('cat-ginger');
    h.handlers.get('filecomplete')!();
    characters.resolve(); await flush();
    expect(h.progress).toHaveBeenLastCalledWith(1, total);
    h.scene.create();
    h.scene.update(0, 16);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.ready).not.toHaveBeenCalled();
    expect(h.tick).not.toHaveBeenCalled();
  });

  it('waits for all five atlases before initialization or the first scene update', async () => {
    const h = harness();
    h.scene.preload();
    h.scene.create();
    h.scene.update(0, 16);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.ready).not.toHaveBeenCalled();
    expect(h.tick).not.toHaveBeenCalled();
    for (let i = 0; i < mainAssets.length; i++) h.handlers.get('filecomplete')!();
    expect(h.progress).toHaveBeenLastCalledWith(mainAssets.length, total);
    characters.resolve(); await flush();
    expect(h.progress).toHaveBeenLastCalledWith(total, total);
    expect(h.create).toHaveBeenCalledOnce();
    expect(h.ready).toHaveBeenCalledOnce();
    expect(h.scene.initialized).toBe(true);
  });

  it('rejects atlas failures without exposing a partially initialized scene', async () => {
    const h = harness(), failure = new Error('Could not load café character atlas: chef');
    h.scene.preload(); h.scene.create();
    characters.reject(failure); await flush();
    expect(h.fail).toHaveBeenCalledExactlyOnceWith(failure);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.ready).not.toHaveBeenCalled();
    h.scene.update(0, 16);
    expect(h.tick).not.toHaveBeenCalled();
  });

  it('rejects scene initialization exceptions rather than leaving ready pending', async () => {
    const h = harness(), failure = new Error('texture initialization failed');
    h.scene.preload();
    h.create.mockImplementation(() => { throw failure; });
    h.scene.create();
    characters.resolve(); await flush();
    expect(h.fail).toHaveBeenCalledExactlyOnceWith(failure);
    expect(h.ready).not.toHaveBeenCalled();
    h.scene.update(0, 16);
    expect(h.tick).not.toHaveBeenCalled();
  });

  it.each(['shutdown', 'destroy'])('ignores late atlas completion after %s', async event => {
    const h = harness();
    h.scene.preload(); h.scene.create();
    h.lifecycle.get(event)!();
    characters.resolve(); await flush();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.ready).not.toHaveBeenCalled();
    expect(h.fail).not.toHaveBeenCalled();
    expect(h.progress).toHaveBeenLastCalledWith(0, total);
    h.scene.update(0, 16);
    expect(h.tick).not.toHaveBeenCalled();
  });
});
