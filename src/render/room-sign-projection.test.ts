import { afterEach, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { RoomPainter } from './room-art';
import { clearGeneratedMainAssets } from './generated-main-art';
afterEach(()=>vi.unstubAllGlobals());
it('paints final half-room-pixel lettering after the wall resample, preserving thin Chinese strokes',()=>{
  const order:string[]=[],pixels:number[][]=[];
  const context=()=>({
    fillStyle:'',imageSmoothingEnabled:false,
    save(){},restore(){},beginPath(){},rect(){},clip(){},setTransform(){},clearRect(){},
    fillRect(...args:number[]){pixels.push(args);order.push('glyph');},
    drawImage(){order.push('plane');},
  });
  const target=context(),source={...context(),fillRect:vi.fn(),drawImage:vi.fn()};
  vi.stubGlobal('document',{createElement:()=>({width:640,height:480,getContext:()=>source})});
  clearGeneratedMainAssets();
  const state=createInitialState(0);state.onMenu=[];
  state.profile={cafeName:'TEST',ownerName:'test',look:{skin:0,hair:0,hairStyle:0,shirt:0,pants:0}};
  new RoomPainter(target as unknown as CanvasRenderingContext2D,2).drawMenuBoard(state);
  expect(order[0]).toBe('plane');expect(pixels.length).toBeGreaterThan(0);
  expect(pixels.every(([x,y,w,h])=>Number.isInteger(x*2)&&Number.isInteger(y*2)&&w===.5&&h===.5)).toBe(true);
});
