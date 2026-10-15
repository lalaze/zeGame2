import { describe, expect, it } from 'vitest';
import { viewportFrame, insideRoomFrame } from './viewport-frame';
import { fitFullscreenRoom } from '../ui/fullscreen-layout';
describe('passive surrounding room viewport', () => {
  for (const [w,h] of [[1920,1080],[390,844],[844,390],[1200,900]]) for (const dpr of [1,1.25,2]) {
    it(`preserves central room at ${w}×${h} DPR${dpr}`, () => {
      const room=fitFullscreenRoom(w,h,dpr), frame=viewportFrame(room,{width:w,height:h});
      expect(frame.cssWidth).toBe(w); expect(frame.cssHeight).toBe(h);
      expect(frame.left).toBe((room.cssWidth-w)/2); expect(frame.top).toBe((room.cssHeight-h)/2);
      expect(room.cssWidth/room.cssHeight).toBeCloseTo(4/3);
      for(const zoom of [1,1/3]) {
        const cameraZoom=room.backing*zoom;
        for(const origin of [{x:0,y:0},{x:320,y:-240},{x:-320,y:-28},{x:113.5,y:-81.2}]) {
          const scrollX=origin.x-frame.x/cameraZoom,scrollY=origin.y-frame.y/cameraZoom;
          expect((origin.x-scrollX)*cameraZoom).toBeCloseTo(frame.x);
          expect((origin.y-scrollY)*cameraZoom).toBeCloseTo(frame.y);
        }
      }
      expect(insideRoomFrame(frame.x,frame.y,frame)).toBe(true);
      expect(insideRoomFrame(frame.x+frame.roomWidth/2,frame.y+frame.roomHeight/2,frame)).toBe(true);
      expect(insideRoomFrame(frame.x-1,frame.y,frame)).toBe(false);
      expect(insideRoomFrame(frame.x+frame.roomWidth,frame.y,frame)).toBe(false);
      expect(insideRoomFrame(frame.x,frame.y-1,frame)).toBe(false);
      expect(insideRoomFrame(frame.x,frame.y+frame.roomHeight,frame)).toBe(false);
    });
  }
});
