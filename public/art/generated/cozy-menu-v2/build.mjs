/**
 * Mechanical extraction only: generated bitmap pixels are cropped, fitted using
 * nearest-neighbor sampling, and given transparent safety padding. No art redraw.
 * Usage: SHARP_MODULE=/path/to/sharp/lib/index.js node public/art/generated/cozy-menu-v2/build.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const sharp = (await import(process.env.SHARP_MODULE ?? '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js')).default;
const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../../../..');
const generation = JSON.parse(await fs.readFile(path.join(root, 'generation.json'), 'utf8'));
const runtime = JSON.parse(await fs.readFile(path.join(repo, 'assets/generated/runtime-catalog-v1/runtime.json'), 'utf8'));
const foodSource = await fs.readFile(path.join(repo, 'src/render/generated-food-art.ts'), 'utf8');
const ingredientSource = await fs.readFile(path.join(repo, 'src/render/generated-ingredient-art.ts'), 'utf8');
const envelopes = Object.fromEntries([...foodSource.matchAll(/^\s+(\w+): \[(\d+), (\d+)\],?$/gm)].map(m => [m[1], [+m[2], +m[3]]]));
for (const m of ingredientSource.matchAll(/(\w+): \[(\d+), (\d+)\]/g)) envelopes['ingredient-' + m[1]] = [+m[2], +m[3]];
const manifest = { version:'cozy-menu-v2', generator:'built-in image_gen', processing:'Rectangular extraction; nearest-neighbor fit; transparent safety border. Original atlas alpha retained without threshold masking or recoloring.', assets:{} };
const mapping = {};
const choose = (counts, ideal, span) => {
  let min=Infinity,best=0;
  for(let n=Math.round(ideal-span);n<=Math.round(ideal+span);n++){
    if(counts[n]<min||(counts[n]===min&&Math.abs(n-ideal)<Math.abs(best-ideal))){min=counts[n];best=n}
  }
  return best;
};
for(const atlas of generation.atlases) {
  const input=path.join(root,atlas.sourceFile);
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info;
  const visible=(x,y)=>data[(y*w+x)*4+3]>16;
  const rowCounts=Array.from({length:h},(_,y)=>{let n=0;for(let x=0;x<w;x++)if(visible(x,y))n++;return n;});
  const ys=[0,...Array.from({length:atlas.rows-1},(_,i)=>choose(rowCounts,(i+1)*h/atlas.rows,h/atlas.rows*.2)),h];
  for(let row=0;row<atlas.rows;row++){
    const counts=Array.from({length:w},(_,x)=>{let n=0;for(let y=ys[row];y<ys[row+1];y++)if(visible(x,y))n++;return n;});
    const xs=[0,...Array.from({length:atlas.columns-1},(_,i)=>choose(counts,(i+1)*w/atlas.columns,w/atlas.columns*.2)),w];
    for(let col=0;col<atlas.columns;col++){
      const id=atlas.ids[row*atlas.columns+col];if(!id)continue;
      let left=xs[col+1],top=ys[row+1],right=xs[col],bottom=ys[row],count=0;
      for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[col];x<xs[col+1];x++)if(visible(x,y)){
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);count++;
      }
      if(count<100)throw new Error('Missing sprite '+id);
      left=Math.max(xs[col],left-4);top=Math.max(ys[row],top-4);
      right=Math.min(xs[col+1],right+4);bottom=Math.min(ys[row+1],bottom+4);
      const sourceRect={left,top,width:right-left,height:bottom-top};
      const envelope=envelopes[id];if(!envelope)throw new Error('Missing logical envelope '+id);
      const size=runtime.mainStaticMetadata[id]?.originalSize ?? [192,Math.round(192*envelope[1]/envelope[0])];
      const pad=Math.max(8,Math.round(Math.min(...size)*.06));
      const scale=Math.min((size[0]-pad*2)/sourceRect.width,(size[1]-pad*2)/sourceRect.height);
      const fw=Math.max(1,Math.round(sourceRect.width*scale)),fh=Math.max(1,Math.round(sourceRect.height*scale));
      const rendered=await sharp(input).extract(sourceRect).resize(fw,fh,{kernel:'nearest'}).png().toBuffer();
      const dest={left:Math.floor((size[0]-fw)/2),top:Math.floor((size[1]-fh)/2),width:fw,height:fh};
      const filename=id+'.png';
      await sharp({create:{width:size[0],height:size[1],channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:rendered,left:dest.left,top:dest.top}]).png().toFile(path.join(root,filename));
      const bytes=await fs.readFile(path.join(root,filename));
      manifest.assets[id]={file:filename,source:atlas.sourceFile,sourceSize:[w,h],cell:[col,row],sourceRect,outputSize:size,contentRect:dest,logicalEnvelope:envelope,legacyOriginalSize:!!runtime.mainStaticMetadata[id],sha256:createHash('sha256').update(bytes).digest('hex')};
      mapping[id]='cozy-menu-v2/'+filename;
    }
  }
}
if(Object.keys(mapping).length!==67)throw new Error('Expected 67 assets');
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(repo,'src/render/cozy-menu-assets.ts'), 'import { COZY_SIGNATURE_ASSETS } from \'./cozy-signature-registration\';\n\n/** Redrawn cozy menu, pantry and signature sprites; source provenance is stored beside the PNGs. */\nexport const COZY_MENU_ASSETS = {\n  ...COZY_SIGNATURE_ASSETS,\n  ...'+JSON.stringify(mapping,null,2)+'\n} as const;\n');
const ids=Object.keys(mapping),tile=144,cols=9,rows=Math.ceil(ids.length/cols),layers=[];
for(let i=0;i<ids.length;i++){
  const id=ids[i],x=(i%cols)*tile,y=Math.floor(i/cols)*tile;
  layers.push({input:await sharp(path.join(root,id+'.png')).resize(122,112,{fit:'inside',kernel:'nearest'}).toBuffer(),left:x+11,top:y+4});
  const label='<svg width="144" height="22"><text x="72" y="16" text-anchor="middle" fill="#4c3427" font-size="11" font-family="Arial">'+id+'</text></svg>';
  layers.push({input:Buffer.from(label),left:x,top:y+120});
}
await sharp({create:{width:cols*tile,height:rows*tile,channels:4,background:'#f1e1c3'}}).composite(layers).png().toFile(path.join(root,'contact-sheet.png'));
console.log('Extracted and registered '+ids.length+' sprites.');
