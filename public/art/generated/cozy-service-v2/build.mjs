/** Mechanical crop and nearest-neighbor packing only. Generated alpha is preserved. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const sharp=(await import(process.env.SHARP_MODULE??'/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js')).default;
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../../../..'),config=JSON.parse(await fs.readFile(path.join(root,'generation.json'),'utf8'));
const source=path.join(root,config.sourceFile),{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height;
const guides={},assets={},manifest={version:config.version,processing:'Rectangular extraction, nearest-neighbor resize, 8px transparent safety border; no recoloring or alpha masking.',assets:{}};
for(let i=0;i<config.ids.length;i++){
 const id=config.ids[i],col=i%2,row=Math.floor(i/2),x0=Math.floor(col*w/2),x1=Math.floor((col+1)*w/2),y0=Math.floor(row*h/2),y1=Math.floor((row+1)*h/2);
 let left=x1,top=y1,right=x0,bottom=y0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*w+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
 left=Math.max(x0,left-4);top=Math.max(y0,top-4);right=Math.min(x1,right+4);bottom=Math.min(y1,bottom+4);
 const sourceRect={left,top,width:right-left,height:bottom-top},scale=176/Math.max(sourceRect.width,sourceRect.height),cw=Math.round(sourceRect.width*scale),ch=Math.round(sourceRect.height*scale),width=cw+16,height=ch+16,filename=id+'.png';
 const cropped=await sharp(source).extract(sourceRect).resize(cw,ch,{kernel:'nearest'}).toBuffer();
 await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:cropped,left:8,top:8}]).png().toFile(path.join(root,filename));
 const {data:raw}=await sharp(path.join(root,filename)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let ax=width,ay=height,bx=0,by=0,edge=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=raw[(y*width+x)*4+3];if(a>16){ax=Math.min(ax,x);ay=Math.min(ay,y);bx=Math.max(bx,x+1);by=Math.max(by,y+1);}if((x===0||y===0||x===width-1||y===height-1)&&a)edge++;}
 const round=n=>Math.round(n*100)/100,tx=x=>round((x-left)*cw/sourceRect.width+8),ty=y=>round((y-top)*ch/sourceRect.height+8);
 const guide={size:[width,height],artBounds:[ax,ay,bx-ax,by-ay],foot:[round((ax+bx)/2),by],aspect:round((bx-ax)/(by-ay))};
 if(id==='cozy-cake-dome'){
  guide.interiorRect=[tx(215),ty(817),round(270*cw/sourceRect.width),round(135*ch/sourceRect.height)];
  guide.cakeFoot=[tx(350),ty(1008)];
  guide.glassOverlayBottom=ty(955);
  const [ix,iy,iw,ih]=guide.interiorRect;let zero=0,n=0;
  for(let y=Math.ceil(iy);y<Math.floor(iy+ih);y++)for(let x=Math.ceil(ix);x<Math.floor(ix+iw);x++){if(raw[(y*width+x)*4+3]===0)zero++;n++;}
  guide.interiorTransparency=round(zero/n);
 }
 if(id==='cozy-table-tent')guide.numberRect=[tx(840),ty(833),round(163*cw/sourceRect.width),round(185*ch/sourceRect.height)];
 guides[id]=guide;assets[id]='cozy-service-v2/'+filename;
 const bytes=await fs.readFile(path.join(root,filename));
 manifest.assets[id]={file:filename,source:config.sourceFile,sourceRect,guide,nonTransparentOuterEdgePixels:edge,sha256:createHash('sha256').update(bytes).digest('hex')};
}
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(repo,'src/render/cozy-service-assets.ts'),'/** Additional service props redrawn from the approved cozy cafe style. */\nexport const COZY_SERVICE_ASSETS = '+JSON.stringify(assets,null,2)+' as const;\n\n/** Pixel coordinates in each delivered PNG, including its transparent border. */\nexport const COZY_SERVICE_GUIDES = '+JSON.stringify(guides,null,2)+' as const;\n');
const layers=[],tile=256;
for(let i=0;i<config.ids.length;i++){
 const id=config.ids[i],g=guides[id],x=i%2*tile,y=Math.floor(i/2)*tile;
 layers.push({input:path.join(root,id+'.png'),left:x+Math.floor((tile-g.size[0])/2),top:y+Math.floor((220-g.size[1])/2)});
 layers.push({input:Buffer.from('<svg width="256" height="32"><text x="128" y="22" text-anchor="middle" fill="#4c3427" font-family="Arial" font-size="15">'+id+'</text></svg>'),left:x,top:y+220});
}
await sharp({create:{width:512,height:512,channels:4,background:'#f1e1c3'}}).composite(layers).png().toFile(path.join(root,'contact-sheet.png'));
const g=guides['cozy-cake-dome'],[ix,iy,iw,ih]=g.interiorRect,cake=await sharp(path.join(repo,'public/art/generated/cozy-menu-v2/cake.png')).resize(Math.floor(iw*.95),Math.floor(ih*1.35),{fit:'inside',kernel:'nearest'}).png().toBuffer(),cakeSize=await sharp(cake).metadata();
const upperGlass=await sharp(path.join(root,'cozy-cake-dome.png')).extract({left:0,top:0,width:g.size[0],height:Math.floor(g.glassOverlayBottom)}).png().toBuffer();
const domePreview=await sharp({create:{width:g.size[0],height:g.size[1],channels:4,background:'#f1e1c3'}}).composite([{input:path.join(root,'cozy-cake-dome.png'),left:0,top:0},{input:cake,left:Math.round(g.cakeFoot[0]-cakeSize.width/2),top:Math.round(g.cakeFoot[1]-cakeSize.height)},{input:upperGlass,left:0,top:0}]).png().toBuffer();
await sharp(domePreview).resize(g.size[0]*3,g.size[1]*3,{kernel:'nearest'}).png().toFile(path.join(root,'dome-overlay-preview.png'));
console.log(JSON.stringify(guides,null,2));
