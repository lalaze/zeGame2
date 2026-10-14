import type { CharacterFrames } from './sprites';
import { character } from './sprites';
import { fineSpriteArt, registerFineSpriteArt } from './fine-sprite-art';
import { preloadReferenceCharacters, referenceCharacterContacts, referenceCharacterOffset } from './reference-character-art';

// This module is imported only by cozy-character-sample.html. The main game,
// saved looks, cast registry and production source atlases are unchanged.
export const OWNER_LOOK = {skin:0,hair:0,hairStyle:1,shirt:2,pants:1};
export const GUEST_LOOK = {skin:0,hair:0,hairStyle:2,shirt:0,pants:1};
type Box = readonly [number,number,number,number];
type Pose = {source:HTMLCanvasElement;width:number;height:number};
export const POSES = [
  ...['down','up','right','left'].flatMap(direction=>[0,1,2].map(i=>({name:`${direction}[${i}]`,index:(direction==='down'?0:direction==='up'?3:6)+i,mirror:direction==='left',get:(f:CharacterFrames)=>f[direction as 'down'][i]}))),
  {name:'sitRight',index:9,mirror:false,get:(f:CharacterFrames)=>f.sitRight},
  {name:'sitLeft',index:12,mirror:false,get:(f:CharacterFrames)=>f.sitLeft},
  {name:'sitPetRight[0]',index:10,mirror:false,get:(f:CharacterFrames)=>f.sitPetRight[0]},
  {name:'sitPetRight[1]',index:11,mirror:false,get:(f:CharacterFrames)=>f.sitPetRight[1]},
  {name:'sitPetLeft[0]',index:13,mirror:false,get:(f:CharacterFrames)=>f.sitPetLeft[0]},
  {name:'sitPetLeft[1]',index:14,mirror:false,get:(f:CharacterFrames)=>f.sitPetLeft[1]},
];
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function copy(source:HTMLCanvasElement){const c=canvas(source.width,source.height);c.getContext('2d')!.drawImage(source,0,0);return c;}
async function loadAtlas(url:string,boxes:readonly Box[]):Promise<Pose[]>{
  const image=new Image(); image.src=url; await image.decode();
  return boxes.map(([x0,y0,x1,y1])=>{
    const source=canvas(x1-x0,y1-y0),ctx=source.getContext('2d')!;
    ctx.drawImage(image,x0,y0,source.width,source.height,0,0,source.width,source.height);
    // Runtime sprite extraction only; the original generated PNG is retained.
    const pixels=ctx.getImageData(0,0,source.width,source.height);
    for(let p=3;p<pixels.data.length;p+=4)if(pixels.data[p]<100)pixels.data[p]=0;
    ctx.putImageData(pixels,0,0);return {source,width:source.width,height:source.height};
  });
}
export async function prepareCozyCharacterSample(install:boolean){
  await preloadReferenceCharacters();
  const manifest=await fetch('/art/generated/cozy-character-sample-v1/manifest.json').then(r=>{if(!r.ok)throw Error('Sample manifest unavailable');return r.json();});
  const [ownerPoses,guestPoses]=await Promise.all(['owner','guest'].map(key=>loadAtlas(`/art/generated/cozy-character-sample-v1/${key}.png`,manifest[key].bounds)));
  const identities=[
    {name:'店主',frames:character(OWNER_LOOK,'owner'),poses:ownerPoses},
    {name:'顾客',frames:character(GUEST_LOOK,'customer'),poses:guestPoses},
    // The fixture demonstrates this same owner artwork carrying the game's
    // real tray with the existing server actor. This is not a staffing change.
    {name:'店主端盘演示',frames:character(OWNER_LOOK,'server'),poses:ownerPoses},
    {name:'店主坐姿演示',frames:character(OWNER_LOOK,'customer'),poses:ownerPoses},
  ];
  return identities.map(({name,frames,poses})=>{
    const scale=Math.min(25/Math.max(...poses.slice(0,9).map(p=>p.height)),16/Math.max(...poses.slice(0,9).map(p=>p.width)));
    const entries=POSES.map(desc=>{
      const target=desc.get(frames),before=copy(fineSpriteArt(target).canvas),art=canvas(target.width*3,target.height*3),ctx=art.getContext('2d')!;
      ctx.imageSmoothingEnabled=false;
      const p=poses[desc.index],seated=desc.index>=9,left=desc.index>=12,offset=referenceCharacterOffset(target),contact=referenceCharacterContacts(target);
      const fit=Math.min(scale*3,(art.width-4)/p.width,(art.height-4)/p.height);
      const w=Math.round(p.width*fit),h=Math.round(p.height*fit);
      const anchorX=seated?Math.round(((left?11:7)-offset.x)*3-w*(left ? .69 : .31)):Math.round(27-w/2);
      const x=Math.max(2,Math.min(art.width-w-2,anchorX));
      const anchorY=seated?Math.round(66-h*.72):81-h;
      const y=Math.max(2,Math.min(art.height-h-2,anchorY));
      if(desc.mirror){ctx.translate(art.width,0);ctx.scale(-1,1);}
      ctx.drawImage(p.source,x,y,w,h);
      if(install){const logical=target.getContext('2d')!;logical.clearRect(0,0,target.width,target.height);logical.drawImage(art,0,0,target.width,target.height);registerFineSpriteArt(target,art,3);}
      return {name:desc.name,before,after:art,target,offset,contact};
    });
    return {name,frames,entries};
  });
}
