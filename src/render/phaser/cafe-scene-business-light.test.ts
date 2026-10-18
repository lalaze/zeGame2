import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { CafeScene } from './cafe-scene';


describe('business-day scene lighting', () => {
  it('renders morning, sunset and night from service time even when the real clock stays at night', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 18, 23, 0));
    vi.stubGlobal('window', { location: { href: 'https://example.com/' } });
    const scene = Object.create(CafeScene.prototype);
    const state = { phase: 'open', dayTime: 0 };
    const pool = { begin: vi.fn(), end: vi.fn() };
    const camera = { width: 1000, height: 800, setZoom: vi.fn(), setScroll: vi.fn() };
    Object.assign(scene, {
      initialized: true,
      sim: { customers: [] },
      hooks: { tick: vi.fn() },
      getState: () => state,
      backing: 1,
      viewportFrame: { x: 0, y: 0 },
      cameras: { main: camera },
      view: { viewX: 0, viewY: 0, zoom: 1 },
      images: pool, rects: pool, glows: pool,
      drawRoom: vi.fn(), drawLight: vi.fn(), drawFloorStanding: vi.fn(),
      drawThoughts: vi.fn(), spawnEffects: vi.fn(), drawOverviewFrame: vi.fn(), drawGhost: vi.fn(),
    });
    try {
      const render = (seconds: number) => {
        state.dayTime = seconds;
        scene.update(0, 16);
        return scene.drawRoom.mock.calls.at(-1);
      };
      const morning = render(0);
      expect(morning[5].dark).toBe(0);
      expect(morning[4].getHours()).toBe(8);
      const sunset = render(180 * 9.5 / 12);
      expect(sunset[5].sky).not.toEqual(morning[5].sky);
      expect(sunset[5].dark).toBeCloseTo(.1, 1);
      const night = render(180);
      expect(night[5].dark).toBe(.85);
      expect(night[5].lamps).toBe(1);
      expect(night[4].getHours()).toBe(20);
      expect(render(3600)[5]).toEqual(night[5]);
      state.phase = 'closing';
      expect(render(180)[5]).toEqual(night[5]);
      state.phase = 'prep';
      expect(render(180)[5]).toEqual(morning[5]);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
