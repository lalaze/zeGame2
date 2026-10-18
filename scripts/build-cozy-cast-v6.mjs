// Compile whole, image-generated figures. No head/body slicing or anatomy transforms.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng, encodePng, oklab } from './pixel-conform.mjs';
import { resampleRgba } from '../src/render/pixel-resample.ts';

const root = 'assets/generated/cozy-cast-v6', out = 'public/art/generated/cozy-cast-v6';
const groups = [[27,0,17],[1,2,3],[4,5,6],[7,8,9],[10,11,12],[13,14,15],[16,18,19],[20,21,22],[23,24,25],[26,28,29]];
const palette = JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.map(c => [1,3,5].map(i => parseInt(c.hex.slice(i,i+2),16)));
const labs = palette.map(c => oklab(...c)), colours = new Map();
const snap = (r,g,b) => {
  const key = r*65536+g*256+b;
  if (!colours.has(key)) {
    const lab = oklab(r,g,b); let best = 0, distance = Infinity;
    labs.forEach((p,i) => { const d = p.reduce((n,v,k) => n+(v-lab[k])**2,0); if(d<distance){distance=d;best=i;} });
    colours.set(key,palette[best]);
  }
  return colours.get(key);
};
function extract(image) {
  const {width,height,pixels} = image;
  // Generated cells have unequal padding. Find the transparent gutters rather
  // than clipping the figures to an assumed 256-pixel grid.
  const seams = histogram => {
    const edges=[0];
    for(let n=1;n<6;n++) {
      const start=Math.round(histogram.length*(n-.25)/6),end=Math.round(histogram.length*(n+.25)/6);
      let at=start;
      for(let i=start;i<end;i++)if(histogram[i]<histogram[at])at=i;
      edges.push(at);
    }
    return [...edges,histogram.length];
  };
  const columns=new Uint32Array(width);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>=128)columns[x]++;
  const xs=seams(columns), ordered=Array(36);
  for(let column=0;column<6;column++) {
    const rows=new Uint32Array(height);
    for(let y=0;y<height;y++)for(let x=xs[column];x<xs[column+1];x++)if(pixels[(y*width+x)*4+3]>=128)rows[y]++;
    const ys=seams(rows);
    for(let row=0;row<6;row++) {
      let l=width,t=height,r=0,b=0,count=0;
      for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[column];x<xs[column+1];x++)if(pixels[(y*width+x)*4+3]>=128){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);count++;}
      if(count<500)throw Error(`Missing figure in row ${row}, column ${column}`);
      ordered[row*6+column]={l,t,r,b};
    }
  }
  return ordered.map(box=>{
    const w=box.r-box.l,h=box.b-box.t,rgba=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)rgba.set(pixels.subarray(((y+box.t)*width+box.l)*4,((y+box.t)*width+box.r)*4),y*w*4);
    // Adjacent rows occasionally leave a detached shoe-tip in the gutter.
    // Extract the connected person, rather than allowing that fragment to
    // enlarge its crop or appear as a floating mark above the hair.
    const seen=new Uint8Array(w*h);let person=[];
    for(let n=0;n<seen.length;n++) {
      if(seen[n]||rgba[n*4+3]<128)continue;
      const island=[n];seen[n]=1;
      for(let k=0;k<island.length;k++) {
        const at=island[k],x=at%w,y=Math.floor(at/w);
        for(const v of [x?at-1:-1,x<w-1?at+1:-1,y?at-w:-1,y<h-1?at+w:-1])
          if(v>=0&&!seen[v]&&rgba[v*4+3]>=128){seen[v]=1;island.push(v);}
      }
      if(island.length>person.length)person=island;
    }
    let l=w,t=h,r=0,b=0;
    for(const at of person){const x=at%w,y=Math.floor(at/w);l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);}
    const clean=new Uint8ClampedArray((r-l)*(b-t)*4);
    for(const at of person){const x=at%w,y=Math.floor(at/w);clean.set(rgba.subarray(at*4,at*4+4),((y-t)*(r-l)+x-l)*4);}
    return {width:r-l,height:b-t,pixels:clean,box:[box.l+l,box.t+t,box.l+r,box.t+b]};
  });
}
const manifest={version:6,density:2,width:40,height:44,characters:[]};
for(const [group,ids] of groups.entries()) {
  const file=`${root}/sources/group-${group}.png`;
  if(!fs.existsSync(file)&&process.argv.includes('--partial'))continue;
  const poses=extract(decodePng(file));
  for(const [row,id] of ids.entries()) {
    const source=poses.slice(row*12,row*12+12);
    // Keep head/shoulder size identical across walking and seated actions.
    // Furniture meets the person; sitting never enlarges the whole figure.
    const scale=Math.min(78/Math.max(...source.slice(0,9).map(p=>p.height)),72/Math.max(...source.map(p=>p.width)));
    const seatedScale=scale;
    const atlas={width:80*12,height:88,pixels:new Uint8ClampedArray(80*12*88*4)}, frames=[];
    for(const [index,p] of source.entries()) {
      const seated=index>=9,fit=seated?seatedScale:scale,w=Math.round(p.width*fit),h=Math.round(p.height*fit);
      const x=seated?Math.round(36-w*.38):40-Math.round(w/2),y=seated?64-Math.round(h*.76):84-h;
      if(x<1||y<1||x+w>79||y+h>87)throw Error(`Clipped figure ${id}/${index}: ${[x,y,w,h]}`);
      const pixels=resampleRgba(p.pixels,p.width,p.height,w,h);
      for(let n=0;n<pixels.length;n+=4) {
        pixels[n+3]=pixels[n+3]>=128?255:0;
        if(pixels[n+3])pixels.set(snap(pixels[n],pixels[n+1],pixels[n+2]),n);
        else pixels.fill(0,n,n+4);
      }
      for(let dy=0;dy<h;dy++)atlas.pixels.set(pixels.subarray(dy*w*4,(dy+1)*w*4),((dy+y)*atlas.width+index*80+x)*4);
      const neck=[Math.round(x+w*(index>=6?.56:.50)),Math.round(y+h*(seated?.51:.47))];
      const hand=[Math.round(x+w*(index>=6?.94:.86)),Math.round(y+h*(index===9?.58:index>=10?.72:.72))];
      frames.push({box:[index*80,0,(index+1)*80,88],sourceBox:p.box,top:y,neck,foot:seated?[36,82]:[40,84],hip:seated?[36,64]:[40,64],hand});
    }
    const filename=`customer-${id}.png`;encodePng(`${out}/${filename}`,atlas);
    manifest.characters.push({id,file:filename,source:`sources/group-${group}.png`,scale,seatedScale,frames});
  }
}
manifest.characters.sort((a,b)=>a.id-b.id);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
const files=[...fs.readdirSync(`${root}/sources`).map(f=>`${root}/sources/${f}`),...fs.readdirSync(root).filter(f=>f.endsWith('.txt')||f==='README.md'||f==='generation.json').map(f=>`${root}/${f}`),...fs.readdirSync(out).map(f=>`${out}/${f}`),'scripts/build-cozy-cast-v6.mjs'];
fs.writeFileSync(`${root}/hashes.json`,JSON.stringify(Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),null,2)+'\n');
console.log(`Compiled ${manifest.characters.length} complete identities, ${manifest.characters.length*12} poses.`);
