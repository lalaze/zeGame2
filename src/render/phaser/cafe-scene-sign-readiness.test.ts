import { afterEach, expect, it, vi } from 'vitest';
import { createInitialState } from '../../game/state';
import { lightingAt } from '../lighting';
vi.mock('phaser',()=>({default:{Scene:class{},Scenes:{Events:{SHUTDOWN:'shutdown',DESTROY:'destroy'}}}}));
vi.mock('../reference-character-art',async(importOriginal)=>({...await importOriginal<typeof import('../reference-character-art')>(),preloadReferenceCharacters:vi.fn(async()=>{})}));
vi.mock('../cozy-cat-assets',async(importOriginal)=>({...await importOriginal<typeof import('../cozy-cat-assets')>(),preloadCozyCats:vi.fn(async()=>{})}));
import { CafeScene } from './cafe-scene';
afterEach(()=>vi.unstubAllGlobals());
it('invalidates both main-room lettering layers when the pixel font becomes ready, even while time is frozen',()=>{
  const face={family:'"Pixel ZH"',status:'loading'};
  vi.stubGlobal('document',{fonts:new Set([face])});
  const signatures=new Map<string,string>(), repaints:string[]=[];
  const scene=Object.assign(Object.create(CafeScene.prototype),{
    view:{kitchenDoor:0},sim:{baristas:[]},
    layer:(name:string)=>({name}),
    paint:(layer:{name:string},_x:number,_y:number,sig:string)=>{if(signatures.get(layer.name)!==sig){signatures.set(layer.name,sig);repaints.push(layer.name);}},
    drawCat(){},drawBaristas(){},drawPass(){},
  });
  const state=createInitialState(0), now=new Date(2026,0,1,10,30),light=lightingAt(10.5);
  scene.drawRoom('main',true,state,0,now,light);
  repaints.length=0;scene.drawRoom('main',true,state,0,now,light);
  expect(repaints).toEqual([]);
  face.status='loaded';scene.drawRoom('main',true,state,0,now,light);
  expect(repaints).toContain('room-main');expect(repaints).toContain('room-main-counter');
});
it('holds the first scene paint behind the pending font download in the real preload/create path',async()=>{
  let finish!:()=>void;
  const font=new Promise<void>(resolve=>{finish=resolve;});
  const load=vi.fn(()=>font);
  vi.stubGlobal('document',{fonts:{load}});
  const createCafe=vi.fn(), onLoadError=vi.fn();
  const scene=Object.assign(Object.create(CafeScene.prototype),{
    events:{once:vi.fn(),off:vi.fn()},hooks:{},load:{on:vi.fn(),once:vi.fn(),image:vi.fn()},
    loadGeneration:0,createCafe,onLoadError,
  });
  scene.preload();scene.create();
  await Promise.resolve();await Promise.resolve();
  expect(load).toHaveBeenCalledWith('12px "Pixel ZH"');
  expect(createCafe).not.toHaveBeenCalled();
  finish();await new Promise(resolve=>setTimeout(resolve,0));
  expect(createCafe).toHaveBeenCalledOnce();expect(scene.initialized).toBe(true);
  expect(onLoadError).not.toHaveBeenCalled();
});
