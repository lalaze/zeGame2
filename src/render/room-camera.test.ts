import { describe, expect, it } from 'vitest';
import { adjacentArea } from '../game/regions';
import { areaOrigin } from '../game/layout';
import { RoomCamera } from './room-camera';

describe('room navigation', () => {
  it('only visits adjacent rooms and stops at both ends', () => {
    expect(adjacentArea('main', 'right')).toBe('reading');
    expect(adjacentArea('main', 'up')).toBeNull();
    expect(adjacentArea('reading', 'up')).toBe('greenhouse');
    expect(adjacentArea('greenhouse', 'down')).toBe('reading');
    expect(adjacentArea('greenhouse', 'left')).toBe('terrace');
    expect(adjacentArea('terrace', 'down')).toBeNull();
    expect(adjacentArea('terrace', 'right')).toBe('greenhouse');
  });

  it('moves through the space between rooms and lands exactly on the destination', () => {
    const camera = new RoomCamera();
    camera.moveTo(areaOrigin('reading'));
    camera.update(0.2);
    expect(camera.x).toBeGreaterThan(0);
    expect(camera.x).toBeLessThan(areaOrigin('reading').x);
    expect(camera.moving).toBe(true);
    camera.update(1);
    expect(camera.x).toBe(areaOrigin('reading').x);
    expect(camera.moving).toBe(false);
    camera.moveTo(areaOrigin('main'));
    camera.update(0.2);
    expect(camera.x).toBeGreaterThan(0);
    expect(camera.x).toBeLessThan(areaOrigin('reading').x);
    camera.update(1);
    expect(camera.x).toBe(0);
  });

  it('pans towards a rear room vertically without changing its horizontal position', () => {
    const camera = new RoomCamera();
    camera.moveTo(areaOrigin('reading'), true);
    camera.moveTo(areaOrigin('greenhouse'));
    camera.update(0.2);
    expect(camera.x).toBe(areaOrigin('reading').x);
    expect(camera.y).toBeLessThan(0);
    expect(camera.y).toBeGreaterThan(areaOrigin('greenhouse').y);
    camera.update(1);
    expect(camera.y).toBe(areaOrigin('greenhouse').y);
    expect(camera.moving).toBe(false);
  });

  it('reverses an unfinished move without jumping or overshooting', () => {
    const camera = new RoomCamera();
    camera.moveTo(areaOrigin('reading'));
    camera.update(0.2);
    const halfway = camera.x;
    camera.moveTo(areaOrigin('main'));
    expect(camera.x).toBe(halfway);
    camera.update(0.1);
    expect(camera.x).toBeGreaterThan(0);
    expect(camera.x).toBeLessThan(halfway);
    camera.update(1);
    expect(camera.x).toBe(0);
  });

  it('skips camera movement when reduced motion is requested', () => {
    const camera = new RoomCamera();
    camera.moveTo(areaOrigin('terrace'), true);
    expect(camera.x).toBe(areaOrigin('terrace').x);
    expect(camera.y).toBe(areaOrigin('terrace').y);
    expect(camera.moving).toBe(false);
    camera.update(0.1);
    expect(camera.x).toBe(areaOrigin('terrace').x);
  });

  it('zooms to the whole building and returns smoothly to the chosen room', () => {
    const camera = new RoomCamera();
    camera.moveTo(areaOrigin('reading'), true);
    camera.moveTo(areaOrigin('terrace'), false, 0.5);
    camera.update(0.2);
    expect(camera.zoom).toBeGreaterThan(0.5);
    expect(camera.zoom).toBeLessThan(1);
    camera.update(1);
    expect(camera.zoom).toBe(0.5);
    expect(camera.y).toBe(areaOrigin('terrace').y);
    camera.moveTo(areaOrigin('greenhouse'));
    camera.update(1);
    expect(camera.zoom).toBe(1);
    expect({ x: camera.x, y: camera.y }).toEqual(areaOrigin('greenhouse'));
  });
});
