import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rolldown } from 'rolldown';
import woff2 from 'wawoff2';
import { decodePng, encodePng } from './pixel-conform.mjs';

const out = process.env.ART_GRID_OUT ?? 'artifacts/art-grid/round-3';
fs.mkdirSync(out, { recursive: true });
const zh = JSON.parse(fs.readFileSync('src/locales/zh.json'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-qa-'));
let rasters;
try {
  const font = path.join(temporary, 'pixel.ttf');
  fs.writeFileSync(font, await woff2.decompress(fs.readFileSync('src/assets/pixel-zh.woff2')));
  const result = spawnSync('swift', ['-module-cache-path', path.join(temporary, 'modules'), 'scripts/art-grid-offline-fonts.swift', font, Object.entries(zh).filter(([key]) => key.startsWith('thought.')).map(([, text]) => text).join('')], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr);
  rasters = JSON.parse(result.stdout);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }

class SoftwareCanvas {
  constructor(width = 1, height = 1) { this.width = width; this.height = height; }
  set width(value) { this.rectWidth = Math.round(value); this.pixels = null; }
  get width() { return this.rectWidth; }
  set height(value) { this.rectHeight = Math.round(value); this.pixels = null; }
  get height() { return this.rectHeight; }
  get data() { return this.pixels ??= new Uint8ClampedArray(this.rectWidth * this.rectHeight * 4); }
  getContext() { return this.ctx ??= new SoftwareContext(this); }
}
class SoftwareImage extends SoftwareCanvas {
  get naturalWidth() { return this.width; }
  get naturalHeight() { return this.height; }
}
class SoftwareContext {
  constructor(canvas) { this.canvas = canvas; this.fillStyle = '#000000'; this.globalAlpha = 1; this.transform = [1, 1, 0, 0]; this.stack = []; this.box = null; this.points = []; }
  save() { this.stack.push([this.fillStyle, this.globalAlpha, [...this.transform], this.box, this.globalCompositeOperation]); }
  restore() { [this.fillStyle, this.globalAlpha, this.transform, this.box, this.globalCompositeOperation] = this.stack.pop(); }
  scale(positionX, positionY) { this.transform[0] *= positionX; this.transform[1] *= positionY; }
  translate(positionX, positionY) { this.transform[2] += positionX * this.transform[0]; this.transform[3] += positionY * this.transform[1]; }
  getTransform() { const [scaleX,scaleY,translateX,translateY]=this.transform;return {'a':scaleX,'b':0,'c':0,'d':scaleY,'e':translateX,'f':translateY}; }
  setTransform(scaleX,_b,_c,scaleY,translateX,translateY) { this.transform=[scaleX,scaleY,translateX,translateY]; }
  beginPath() { this.points = []; this.pending = null; this.circle = null; }
  rect(positionX, positionY, rectWidth, rectHeight) { const [sx, sy, tx, ty] = this.transform; this.pending = [positionX * sx + tx, positionY * sy + ty, rectWidth * sx, rectHeight * sy]; }
  clip() { this.box = this.pending; }
  moveTo(positionX, positionY) { this.points.push([positionX, positionY]); }
  lineTo(positionX, positionY) { this.points.push([positionX, positionY]); }
  closePath() {}
  setLineDash() {}
  arc(positionX, positionY, radius) { this.circle = [positionX, positionY, radius]; }
  ellipse(positionX, positionY, rx, ry) { this.circle = [positionX, positionY, rx, ry]; }
  fill() {
    if (this.circle) {
      const [cx, cy, rx, ry = rx] = this.circle;
      for (let positionY = cy - ry; positionY < cy + ry; positionY += .5) { const half = rx * Math.sqrt(Math.max(0, 1 - ((positionY + .25 - cy) / ry) ** 2)); this.fillRect(cx - half, positionY, half * 2, .5); }
    } else if (this.pending) {
      const old = this.transform; this.transform = [1, 1, 0, 0]; this.fillRect(...this.pending); this.transform = old;
    }
  }
  stroke() { for (let index = 1; index < this.points.length; index++) { const start = this.points[index - 1], end = this.points[index], count = Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) * 2); const old = this.fillStyle; this.fillStyle = this.strokeStyle; for (let step = 0; step <= count; step++) this.fillRect(start[0] + (end[0] - start[0]) * step / count, start[1] + (end[1] - start[1]) * step / count, .5, .5); this.fillStyle = old; } }
  strokeRect(positionX, positionY, rectWidth, rectHeight) { const old = this.fillStyle; this.fillStyle = this.strokeStyle; for (const rect of [[positionX,positionY,rectWidth,.5],[positionX,positionY+rectHeight-.5,rectWidth,.5],[positionX,positionY,.5,rectHeight],[positionX+rectWidth-.5,positionY,.5,rectHeight]]) this.fillRect(...rect); this.fillStyle = old; }
  pixel(positionX, positionY, rgba) {
    const canvas = this.canvas;
    if (positionX < 0 || positionY < 0 || positionX >= canvas.width || positionY >= canvas.height || (this.box && (positionX < this.box[0] || positionY < this.box[1] || positionX >= this.box[0] + this.box[2] || positionY >= this.box[1] + this.box[3]))) return;
    const offset = (positionY * canvas.width + positionX) * 4, data = canvas.data;
    const alpha = rgba[3] / 255 * this.globalAlpha, previous = data[offset + 3] / 255;
    if (this.globalCompositeOperation === 'lighter') {
      for (let channel = 0; channel < 3; channel++) data[offset + channel] = Math.min(255, data[offset + channel] + rgba[channel] * alpha);
      data[offset + 3] = Math.min(255, (previous + alpha) * 255); return;
    }
    const final = alpha + previous * (1 - alpha);
    for (let channel = 0; channel < 3; channel++) data[offset + channel] = final ? Math.round((rgba[channel] * alpha + data[offset + channel] * previous * (1 - alpha)) / final) : 0;
    data[offset + 3] = Math.round(final * 255);
  }
  fillRect(positionX, positionY, rectWidth, rectHeight) {
    const [sx, sy, tx, ty] = this.transform, color = [1,3,5].map(index => parseInt(this.fillStyle.slice(index,index+2),16)); color.push(255);
    const x0 = Math.round(Math.min(positionX*sx+tx,(positionX+rectWidth)*sx+tx)), x1 = Math.round(Math.max(positionX*sx+tx,(positionX+rectWidth)*sx+tx));
    const y0 = Math.round(Math.min(positionY*sy+ty,(positionY+rectHeight)*sy+ty)), y1 = Math.round(Math.max(positionY*sy+ty,(positionY+rectHeight)*sy+ty));
    for (let row = Math.max(0,y0); row < Math.min(this.canvas.height,y1); row++) for (let col = Math.max(0,x0); col < Math.min(this.canvas.width,x1); col++) this.pixel(col,row,color);
  }
  drawImage(source, ...args) {
    let crop = [0,0,source.width,source.height], dest;
    if (args.length === 2) dest = [...args,source.width,source.height];
    else if (args.length === 4) dest = args;
    else { crop = args.slice(0,4); dest = args.slice(4); }
    const [sx,sy,tx,ty] = this.transform, [positionX,positionY,rectWidth,rectHeight] = dest;
    const left = Math.round(positionX*sx+tx), top = Math.round(positionY*sy+ty), width = Math.round(rectWidth*sx), height = Math.round(rectHeight*sy);
    const data = source.data;
    for (let row = 0; row < Math.abs(height); row++) for (let col = 0; col < Math.abs(width); col++) {
      const px = Math.floor(crop[0] + (col+.5)/Math.abs(width)*crop[2]), py = Math.floor(crop[1] + (row+.5)/Math.abs(height)*crop[3]);
      if (px < 0 || py < 0 || px >= source.width || py >= source.height) continue;
      const offset = (py*source.width+px)*4;
      this.pixel(width < 0 ? left-col-1 : left+col,height < 0 ? top-row-1 : top+row,data.subarray(offset,offset+4));
    }
  }
  fillText(text) { this.text = text; }
  getImageData(positionX,positionY,rectWidth,rectHeight) {
    if (this.text) return { data: Buffer.from(rasters[(this.font.includes('"Pixel ZH"')?'pixel':'platform')+':'+this.text] ?? '', 'base64') };
    const data = new Uint8ClampedArray(rectWidth*rectHeight*4);
    for (let row = 0; row < rectHeight; row++) for (let col = 0; col < rectWidth; col++) data.set(this.canvas.data.subarray(((positionY+row)*this.canvas.width+positionX+col)*4,((positionY+row)*this.canvas.width+positionX+col)*4+4),(row*rectWidth+col)*4);
    return {data,width:rectWidth,height:rectHeight};
  }
  putImageData(image,positionX,positionY) { const width = image.width ?? this.canvas.width, height = image.height ?? this.canvas.height; for(let row=0;row<height;row++)for(let col=0;col<width;col++)this.canvas.data.set(image.data.subarray((row*width+col)*4,(row*width+col)*4+4),((row+positionY)*this.canvas.width+col+positionX)*4); }
}
globalThis.document = { createElement: () => new SoftwareCanvas(), fonts: new Set([{family:'Pixel ZH',status:'loaded'}]) };
globalThis.HTMLCanvasElement = SoftwareCanvas;
globalThis.HTMLImageElement = SoftwareImage;
globalThis.ImageData = class { constructor(data,width,height) { Object.assign(this,{data,width,height}); } };

const files = ['render/extension-surfaces','render/extension-table-art','render/region-art','render/kitchen-art','render/passages','render/generated-main-art','render/generated-furniture-art','render/generated-decor-art','render/cozy-furniture-assets','render/cozy-materials','render/main-room-surfaces','render/main-room-lighting','render/world-art-grid','render/thought-text','render/thought-bubbles','render/sign-lettering','render/lighting','render/materials','game/state','game/layout','game/kitchen'];
const bundle = await rolldown({input:'qa',plugins:[{name:'qa',resolveId:id=>id==='qa'?id:null,load:id=>id==='qa'?files.map(file=>`export * from ${JSON.stringify(path.resolve('src',file+'.ts'))};`).join('\n'):null}]});
const {output} = await bundle.generate({format:'esm'}); await bundle.close();
const art = await import('data:text/javascript;base64,'+Buffer.from(output.find(item=>item.type==='chunk').code).toString('base64'));
const load = file => { const image = decodePng('public/art/generated/'+file), canvas = new SoftwareImage(image.width,image.height); canvas.pixels = image.pixels; return canvas; };
for (const [key,file] of Object.entries(art.GENERATED_MAIN_ASSETS)) if (key.startsWith('cozy-region-') || key.startsWith('cozy-kitchen-')) art.installGeneratedMainAsset(key,load(file));
art.setGeneratedFurnitureAdapter(art.createGeneratedFurnitureArt(Object.fromEntries(['bench','plant_lemon','plant_monstera','plant_fern'].map(id=>[id,load(art.GENERATED_MAIN_ASSETS['furniture-'+id])])),{catalog:art.COZY_FURNITURE_CATALOG}));
art.setGeneratedDecorAdapter(art.createGeneratedDecorArt(Object.fromEntries(['floor_herringbone-tile'].map(id=>[id,load(art.GENERATED_MAIN_ASSETS['decor-'+id])])),{catalog:art.COZY_DECOR_CATALOG}));
const palette = JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.map(color=>[1,3,5].map(index=>parseInt(color.hex.slice(index,index+2),16)));
function save(canvas,name) {
  const pixels = canvas.data.slice(), cache = new Map();
  for(let offset=0;offset<pixels.length;offset+=4) {
    const key = pixels[offset]*65536+pixels[offset+1]*256+pixels[offset+2];
    let color=cache.get(key);
    if(!color){let best=Infinity;for(const candidate of palette){const distance=candidate.reduce((sum,value,index)=>sum+(value-pixels[offset+index])**2,0);if(distance<best){best=distance;color=candidate;}}cache.set(key,color);}
    pixels.set(color,offset);pixels[offset+3]=pixels[offset+3]>=128?255:0;
  }
  encodePng(path.join(out,name+'.png'),{width:canvas.width,height:canvas.height,pixels});
}
function board(width=320,height=240) { const canvas=new SoftwareCanvas(width*2,height*2),ctx=art.gridSafeContext(canvas.getContext('2d'));ctx.scale(2,2);ctx.fillStyle='#efdfbe';ctx.fillRect(0,0,width,height);return {canvas,ctx}; }
const tableSource = load('cozy-seating-v3/ensemble.png');
const table = new SoftwareCanvas(80,60);table.getContext('2d').drawImage(tableSource,88,71,608,457,2,2,76,57);
const chair = new SoftwareCanvas(68,84);chair.getContext('2d').drawImage(tableSource,805,77,348,455,8.612,32.86,37.584,49.14);
const state=art.createInitialState(0);state.regions=['reading','greenhouse','terrace'];state.kitchen=true;
function kitchenFloor(ctx) {
  art.paintBench(ctx,art.BENCH['x']+art.BENCH['w']/2,art.kitchenFloorY(art.BENCH.front),false,false);
  art.paintRack(ctx,art.RACK['x'],art.kitchenFloorY(art.RACK.foot),[]);
  art.paintBins(ctx,art.BINS['x'],art.kitchenFloorY(art.BINS.foot));
  art.paintDishPit(ctx,art.DISH_PIT['x'],art.kitchenFloorY(art.DISH_PIT.foot));
}
for (const hour of [10.5,21]) for (const area of ['reading','greenhouse','terrace','kitchen']) {
  const light=art.lightingAt(hour),{canvas,ctx}=board();
  if(area==='kitchen') {art.paintKitchen(ctx,240,0,false,new Set(['mixer','proofer','deckOven','fryer']),new Set());kitchenFloor(ctx);}
  else {
    art.paintRegion(ctx,area,240,0,light,false);art.paintPassageFloor(ctx,area,false);
    for(const [positionX,positionY] of [[64,112],[256,112],[64,180],[256,180]]) {
      art.paintContactShade(ctx,positionX,positionY,38,.25);
      const variant=new SoftwareCanvas(80,60);variant.pixels=table.data.slice();art.remapTablecloth(variant.data,80,60,area);
      ctx.drawImage(chair,positionX-38,positionY-41,34,42);ctx.save();ctx.translate(positionX+38,positionY-41);ctx.scale(-1,1);ctx.drawImage(chair,0,0,34,42);ctx.restore();ctx.drawImage(variant,positionX-20,positionY-29,40,30);
    }
  }
  art.paintRoomBoundaries(ctx,area,state);
  const grade=art.roomAmbient(light,area),rgb=[1,3,5].map(index=>parseInt(grade.slice(index,index+2),16)/255);
  for(let offset=0;offset<canvas.data.length;offset+=4)for(let channel=0;channel<3;channel++)canvas.data[offset+channel]*=rgb[channel];
  const lamps = area==='reading'?[[100,art.floorY(98)-27,30,1,'#ffcf7a']]:area==='terrace'?Array.from({length:9},(_,index)=>{const positionX=22+index*34;return [positionX,19+Math.round(Math.sin(positionX/320*Math.PI)*12),14,.9,'#ffcf7a'];}):area==='kitchen'?[[74,12,44,.8,'#fbf6e4'],[218,12,44,.8,'#fbf6e4'],[182,30,16,.7,'#ffcf7a'],[236,30,16,.7,'#ffcf7a'],[290,30,16,.7,'#ffcf7a'],[218,56,26,.6,'#ffa64a']]:[];
  for(const [positionX,positionY,radius,strength,tint] of lamps) {
    const pool=new SoftwareCanvas(radius*4,radius*4),poolCtx=pool.getContext('2d');poolCtx.scale(2,2);art.extensionLampPool(poolCtx,radius,tint);
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=light.lamps*strength;ctx.drawImage(pool,positionX-radius,positionY-radius,radius*2,radius*2);ctx.restore();
  }
  save(canvas,area+(hour===21?'-night':'-day'));
  if (area === 'reading') {
    const corner = new SoftwareCanvas(840,720);
    corner.getContext('2d').drawImage(canvas,0,0,280,240,0,0,840,720);
    save(corner,'reading-corner'+(hour===21?'-night':'-day'));
  }
}
{
  const {canvas,ctx}=board();art.paintKitchen(ctx,240,0,false,new Set(),new Set());kitchenFloor(ctx);save(canvas,'kitchen-reserved');
}
for(const [locale,text] of [['en','My little café dream'],['zh',zh['thought.owner.idle']]]) {
  const lines=art.wrapThoughtText(text,locale==='zh'),rectWidth=art.thoughtBubbleWidth(Math.max(...lines.map(art.thoughtTextWidth)));
  const raster=art.thoughtTextRaster(lines,'',rectWidth),{canvas,ctx}=board(rectWidth,raster.height);
  ctx.drawImage(raster.canvas,0,raster.sourceY,rectWidth*2,raster.inkHeight,0,raster.textY,rectWidth,raster.inkHeight/2);save(canvas,'thought-'+locale);
}
console.log('Offline production-painter boards saved to '+out+'; palette-snapped composites; lamp painters at runtime anchors; no Phaser actors or camera.');
