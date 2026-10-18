import { SEAT_OFFSET } from '../game/layout';
import diningTable from './dining-table-manifest.json';
import { registerFineSpriteArt } from './fine-sprite-art';

type Identity = 'owner' | 'guest';
type Point = { x: number; y: number };
type Box = readonly [number, number, number, number];
type Spec = { box: Box; anchor: Point; scale: number; foreground?: readonly Point[]; hand?: Point };
const D = 3;
// The tabletop plane sits at the guests' forearms, below their shoulders.
// Keep its painted height and cup/vase contact on the same calibration.
export const SEATING_LAYOUT = Object.freeze({ seatX: SEAT_OFFSET, floorY: 1, surfaceY: -15, tableWidth: 34, tableHeight: 24, tableFloorY: 1.5 });
let atlas: HTMLImageElement | null = null, petAtlas: HTMLImageElement | null = null;
let idleAtlas: HTMLImageElement | null = null, tableAtlas: HTMLImageElement | null = null;
let pending: Promise<void> | null = null, epoch = 0;
const cache = new Map<string, HTMLCanvasElement>();
const diningTables = new WeakSet<HTMLCanvasElement>();
export function isDiningTableSprite(frame:HTMLCanvasElement):boolean{return diningTables.has(frame);}
const metadata = new WeakMap<HTMLCanvasElement, { foreground: HTMLCanvasElement; floor: Point; hip: Point; petContact?: Point; embeddedChair?: boolean }>();
const normal: Record<Identity, Spec> = {
  owner:{box:[225,10,839,855],anchor:{x:418,y:855},scale:.0445,
    foreground:[{x:270,y:10},{x:839,y:10},{x:839,y:484},{x:430,y:484},{x:395,y:335},{x:300,y:290}]},
  guest:{box:[987,34,1592,855],anchor:{x:1173,y:855},scale:.0445,
    foreground:[{x:1030,y:34},{x:1592,y:34},{x:1592,y:490},{x:1210,y:510},{x:1080,y:500},{x:1030,y:305}]}
};
const pets: Record<Identity, readonly Spec[]> = {
  owner: [
    {box:[155,28,580,619],anchor:{x:287,y:619},scale:.065,hand:{x:551,y:380},
      foreground:[{x:205,y:28},{x:580,y:28},{x:580,y:401},{x:451,y:391},{x:337,y:383},{x:282,y:321},{x:250,y:225},{x:205,y:205}]},
    {box:[700,28,1135,619],anchor:{x:834,y:619},scale:.065,hand:{x:1099,y:410},
      foreground:[{x:750,y:28},{x:1135,y:28},{x:1135,y:430},{x:1025,y:392},{x:884,y:383},{x:830,y:321},{x:800,y:225},{x:750,y:205}]}
  ],
  guest: [
    {box:[155,640,602,1225],anchor:{x:288,y:1225},scale:.065,hand:{x:578,y:968},
      foreground:[{x:198,y:640},{x:602,y:640},{x:602,y:991},{x:493,y:980},{x:332,y:978},{x:243,y:928},{x:198,y:834}]},
    {box:[700,640,1142,1225],anchor:{x:834,y:1225},scale:.065,hand:{x:1120,y:1006},
      foreground:[{x:745,y:640},{x:1142,y:640},{x:1142,y:1029},{x:1030,y:993},{x:878,y:978},{x:790,y:928},{x:745,y:834}]}
  ]
};
function canvas(w:number,h:number) { const c=document.createElement('canvas'); c.width=w;c.height=h;return c; }
export function clearSeatingEnsemble():void {epoch++;atlas=null;petAtlas=null;idleAtlas=null;tableAtlas=null;pending=null;cache.clear();}
export function preloadSeatingEnsemble():Promise<void> {
  if(atlas&&petAtlas&&idleAtlas&&tableAtlas)return Promise.resolve();
  if(pending)return pending;
  const generation=epoch;
  const files=['ensemble.png','petting.png','idle-v4.png'].map(name=>'art/generated/cozy-seating-v3/'+name);
  files.push(diningTable.file);
  pending=Promise.all(files.map(async file=>{
    const image=new Image();image.src=import.meta.env.BASE_URL+file;
    await image.decode();return image;
  })).then(([a,p,i,table])=>{if(generation===epoch){atlas=a;petAtlas=p;idleAtlas=i;tableAtlas=table;}}).catch(error=>{if(generation===epoch)pending=null;throw error;});
  return pending;
}
function make(spec:Spec,image:HTMLImageElement,mirror:boolean,w=34,h=42):HTMLCanvasElement {
  const art=canvas(w*D,h*D),ctx=art.getContext('2d')!;
  const [x,y,r,b]=spec.box;
  const dx=13-(spec.anchor.x-x)*spec.scale,dy=41-(spec.anchor.y-y)*spec.scale;
  ctx.imageSmoothingEnabled=false;
  if(mirror){ctx.translate(w*D,0);ctx.scale(-1,1);}
  ctx.drawImage(image,x,y,r-x,b-y,dx*D,dy*D,(r-x)*spec.scale*D,(b-y)*spec.scale*D);
  // Remove only near-transparent edge noise; never infer furniture/character silhouettes from RGB.
  const pixels=ctx.getImageData(0,0,art.width,art.height);
  for(let n=3;n<pixels.data.length;n+=4)if(pixels.data[n]<100)pixels.data[n]=0;
  ctx.putImageData(pixels,0,0);
  const frame=canvas(w,h);frame.getContext('2d')!.drawImage(art,0,0,w,h);registerFineSpriteArt(frame,art,D);
  const point=(p:Point):Point=>({x:mirror?w-(13+(p.x-spec.anchor.x)*spec.scale):13+(p.x-spec.anchor.x)*spec.scale,y:41+(p.y-spec.anchor.y)*spec.scale});
  if(spec.foreground){
    const foreground=canvas(w,h),high=canvas(w*D,h*D),f=high.getContext('2d')!;
    f.beginPath();spec.foreground.forEach((p,i)=>{const q=point(p);i?f.lineTo(q.x*D,q.y*D):f.moveTo(q.x*D,q.y*D);});f.closePath();f.clip();f.drawImage(art,0,0);
    foreground.getContext('2d')!.drawImage(high,0,0,w,h);registerFineSpriteArt(foreground,high,D);
    metadata.set(frame,{foreground,floor:{x:mirror?w-13:13,y:41},hip:{x:mirror?w-13:13,y:27},...(spec.hand?{petContact:point(spec.hand)}:{})});
  }
  return frame;
}
export function seatingUnit(identity:Identity,mirror=false,petFrame?:number):HTMLCanvasElement|undefined {
  if(!atlas||!petAtlas||!idleAtlas)return;
  const key=identity+':'+mirror+':'+(petFrame??'normal');if(cache.has(key))return cache.get(key);
  const frame=make(petFrame===undefined?normal[identity]:pets[identity][petFrame%2],petFrame===undefined?idleAtlas:petAtlas,mirror);
  cache.set(key,frame);return frame;
}
export function seatingGeometry(frame:HTMLCanvasElement){return metadata.get(frame);}
export function seatingFurniture(part:'table'|'chair',mirror=false):HTMLCanvasElement|undefined {
  if(!atlas||!tableAtlas)return;
  const key=part+':'+mirror;if(cache.has(key))return cache.get(key);
  if(part==='chair'){
    const chair=diningTable.chair;
    const frame=make({box:chair.bounds as [number,number,number,number],anchor:{x:chair.anchor[0],y:chair.anchor[1]},scale:chair.scale},tableAtlas,mirror!==chair.mirror);
    cache.set(key,frame);return frame;
  }
  const w=SEATING_LAYOUT.tableWidth,h=SEATING_LAYOUT.tableHeight;
  const frame=canvas(w,h),art=canvas(w*D,h*D),ctx=art.getContext('2d')!;
  // One scale preserves the round top, cloth drape and pedestal proportions.
  // Complete authored furniture uses one uniform scale and one floor baseline.
  const [x,y,right,bottom]=diningTable.bounds,sw=right-x,sh=bottom-y;
  const scale=Math.min((w*D-6)/sw,(h*D-6)/sh),dw=sw*scale,dh=sh*scale;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(tableAtlas,x,y,sw,sh,(w*D-dw)/2,h*D-3-dh,dw,dh);
  const pixels=ctx.getImageData(0,0,art.width,art.height);for(let n=3;n<pixels.data.length;n+=4)if(pixels.data[n]<100)pixels.data[n]=0;ctx.putImageData(pixels,0,0);
  frame.getContext('2d')!.drawImage(art,0,0,w,h);registerFineSpriteArt(frame,art,D);diningTables.add(frame);cache.set(key,frame);return frame;
}

/** Register newly authored cast units with the shared scene chair/foreground contract. */
export function registerSeatingUnit(frame:HTMLCanvasElement,geometry:{foreground:HTMLCanvasElement;floor:{x:number;y:number};hip:{x:number;y:number};petContact?:{x:number;y:number};embeddedChair?:boolean}):void {metadata.set(frame,geometry);}
