// Build the six appended guest identities; retain the original atlas bytes through relative references.
import fs from 'node:fs';
import { decodePng, encodePng, oklab } from './pixel-conform.mjs';
import { resampleRgba } from '../src/render/pixel-resample.ts';

{
// Compile complete new figures using the same v7 crop, scale and palette rules.

const root = 'assets/generated/neighborhood-cast-v1', out = 'public/art/generated/cozy-cast-v8';
const groups = [[30,31,32],[33,34,35]];
// Team ramps' extra midtones are for the recoloured staff only; guests keep the three-shade ramps their looks swap.
const palette = JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.filter(c => !c.ramp.startsWith('team-')).map(c => [1,3,5].map(i => parseInt(c.hex.slice(i,i+2),16)));
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
fs.mkdirSync(out,{recursive:true});
const manifest={version:8,density:2,width:40,height:44,characters:[]};
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
manifest.characters.push(...JSON.parse(fs.readFileSync('public/art/generated/cozy-cast-v7/manifest.json')).characters.map(c=>({...c,file:'../cozy-cast-v7/'+c.file})));
manifest.characters.sort((a,b)=>a.id-b.id);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log('Compiled walking cast:', manifest.characters.length);
}

{
// Compile complete authored chair-and-person units. No body-part transforms.
const root='assets/generated/neighborhood-cast-v1',out='public/art/generated/cozy-dining-v4';
const handContacts=JSON.parse(fs.readFileSync(`${root}/contacts.json`));
const groups=[[30,31,32],[33,34,35]];
// Team ramps' extra midtones are for the recoloured staff only.
const palette=JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.filter(c=>!c.ramp.startsWith('team-')).map(c=>[1,3,5].map(i=>parseInt(c.hex.slice(i,i+2),16))),labs=palette.map(c=>oklab(...c)),cache=new Map();
function snap(p){for(let n=0;n<p.length;n+=4){if(p[n+3]<128){p.fill(0,n,n+4);continue}p[n+3]=255;const key=p[n]*65536+p[n+1]*256+p[n+2];if(!cache.has(key)){const lab=oklab(p[n],p[n+1],p[n+2]);let best=0,d=Infinity;labs.forEach((v,i)=>{const e=v.reduce((a,c,k)=>a+(c-lab[k])**2,0);if(e<d){best=i;d=e}});cache.set(key,palette[best])}p.set(cache.get(key),n)}return p}
// Trace the actual outer palm in the complete painting, not a guessed wrist.
function palm(pixels,w,h,pet){
  const top=Math.floor(h*(pet?.60:.48)),bottom=Math.floor(h*(pet?.89:.68));let right=0;
  for(let y=top;y<=bottom;y++)for(let x=Math.floor(w*.55);x<w;x++)if(pixels[(y*w+x)*4+3])right=Math.max(right,x);
  const x=Math.max(0,right-2),rows=[];
  for(let y=top;y<=bottom;y++)if(pixels[(y*w+x)*4+3])rows.push(y);
  if(!rows.length)throw Error('Missing painted palm');
  return[x,rows[Math.floor(rows.length/2)]];
}
function seams(hist){const cuts=[0];for(let i=1;i<3;i++){let start=Math.round(hist.length*(i-.25)/3),end=Math.round(hist.length*(i+.25)/3),min=Infinity;for(let k=start;k<end;k++)min=Math.min(min,hist[k]);let best=[],run=[];for(let k=start;k<=end;k++){if(k<end&&hist[k]===min)run.push(k);else{if(run.length>best.length)best=run;run=[]}}cuts.push(best[Math.floor(best.length/2)])}return[...cuts,hist.length]}
function cut(image,box){const[l,t,r,b]=box,w=r-l,h=b-t,pixels=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)pixels.set(image.pixels.subarray(((y+t)*image.width+l)*4,((y+t)*image.width+r)*4),y*w*4);return{width:w,height:h,pixels,sourceBox:box}}
function extract(image){const{width,height,pixels}=image,cols=new Uint32Array(width);for(let n=0;n<width*height;n++)if(pixels[n*4+3]>=128)cols[n%width]++;const xs=seams(cols),result=Array(9);for(let col=0;col<3;col++){const rows=new Uint32Array(height);for(let y=0;y<height;y++)for(let x=xs[col];x<xs[col+1];x++)if(pixels[(y*width+x)*4+3]>=128)rows[y]++;const ys=seams(rows);for(let row=0;row<3;row++){const source=cut(image,[xs[col],ys[row],xs[col+1],ys[row+1]]),seen=new Uint8Array(source.width*source.height);let largest=[];for(let at=0;at<seen.length;at++){if(seen[at]||source.pixels[at*4+3]<128)continue;const island=[at];seen[at]=1;for(let i=0;i<island.length;i++){const n=island[i],x=n%source.width,y=Math.floor(n/source.width);for(const v of[x?n-1:-1,x<source.width-1?n+1:-1,y?n-source.width:-1,y<source.height-1?n+source.width:-1])if(v>=0&&!seen[v]&&source.pixels[v*4+3]>=128){seen[v]=1;island.push(v)}}if(island.length>largest.length)largest=island}if(largest.length<1000)throw Error('Missing seated unit');let l=source.width,t=source.height,r=0,b=0;for(const n of largest){const x=n%source.width,y=Math.floor(n/source.width);l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1)}const clean=new Uint8ClampedArray(source.pixels.length);for(const n of largest)clean.set(source.pixels.subarray(n*4,n*4+4),n*4);source.pixels=clean;const p=cut(source,[l,t,r,b]);p.sourceBox=[xs[col]+l,ys[row]+t,xs[col]+r,ys[row]+b];result[row*3+col]=p}}return result}
fs.mkdirSync(out,{recursive:true});
const manifest={version:4,density:2,width:40,height:44,embeddedChair:true,characters:[]};
for(const[group,ids]of groups.entries()){const file=`${root}/sources/dining-${group}.png`;if(!fs.existsSync(file)&&process.argv.includes('--partial'))continue;const cells=extract(decodePng(file));for(const[row,id]of ids.entries()){const poses=cells.slice(row*3,row*3+3),scale=Math.min(72/poses[0].height,68/Math.max(...poses.map(p=>p.width))),atlas={width:240,height:88,pixels:new Uint8ClampedArray(240*88*4)},frames=[];for(const[index,p]of poses.entries()){const w=Math.round(p.width*scale),h=Math.round(p.height*scale),x=Math.round(36-w*.4),y=84-h;if(x<1||y<1||x+w>79||y+h>87)throw Error(`Clipped unit ${id}/${index}`);const pixels=snap(resampleRgba(p.pixels,p.width,p.height,w,h)),hand=palm(pixels,w,h,index>0);for(let r=0;r<h;r++)atlas.pixels.set(pixels.subarray(r*w*4,(r+1)*w*4),((r+y)*atlas.width+index*80+x)*4);frames.push({box:[index*80,0,(index+1)*80,88],sourceBox:p.sourceBox,top:y,neck:[Math.round(x+w*.55),Math.round(y+h*.46)],foot:[36,84],hip:[36,64],hand:handContacts[id]?.[index]??[x+hand[0],y+hand[1]]})}const file=`customer-${id}.png`;encodePng(`${out}/${file}`,atlas);manifest.characters.push({id,file,source:`sources/dining-${group}.png`,scale,frames})}}
manifest.characters.push(...JSON.parse(fs.readFileSync('public/art/generated/cozy-dining-v3/manifest.json')).characters.map(c=>({...c,file:'../cozy-dining-v3/'+c.file})));
manifest.characters.sort((a,b)=>a.id-b.id);fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`Compiled ${manifest.characters.length} seated identities (${manifest.characters.length*3} complete chair/body poses)`);
}
