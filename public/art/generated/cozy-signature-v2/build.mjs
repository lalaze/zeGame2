/**
 * Pure crop / nearest-neighbor packing of image_gen output. Registration values
 * describe the newly drawn cup apertures; recipe logic and layer sizes are unchanged.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const sharp=(await import(process.env.SHARP_MODULE??'/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js')).default;
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../../../..');
const generation=JSON.parse(await fs.readFile(path.join(root,'generation.json'),'utf8'));
const runtime=JSON.parse(await fs.readFile(path.join(repo,'assets/generated/runtime-catalog-v1/signature.json'),'utf8'));
const meta={
 'cup-coffee':{anchor:[221,336],width:368},'cup-tea':{anchor:[183,331],width:332},
 'cup-milk':{anchor:[118,353],width:220},'cup-fruit':{anchor:[150.5,357],width:241},
 'liquid-coffee':{anchor:[195.5,102.5],width:313},'liquid-tea':{anchor:[168,102],width:308},
 'liquid-milk':{anchor:[163.5,100.5],width:303},'liquid-fruit':{anchor:[162,100.5],width:308},
 'topping-sugar':{anchor:[156,210],width:250},'topping-spice':{anchor:[150,209],width:280},
 'topping-cocoa':{anchor:[162,207],width:264},'topping-cream':{anchor:[181,241],width:318},
 'topping-fruit':{anchor:[144,224],width:264},'topping-matcha':{anchor:[168.5,194],width:323},
};
const cupGeometry={
 coffee:{rim:[328,254,130,44]},
 tea:{rim:[886,227,142,46],body:[[747,229],[1026,229],[1008,482],[775,484]]},
 milk:{rim:[341,748,119,37],body:[[224,750],[458,750],[432,1084],[247,1084]]},
 fruit:{rim:[915,753,139,42],body:[[778,754],[1053,754],[1026,1092],[806,1092]]},
};
const manifest={version:'cozy-signature-v2',processing:'Rectangular extraction, nearest-neighbor fitting, preserved generated alpha. Runtime production dimensions and source-coordinate metadata size/anchor contracts retained.',assets:{}},assets={},vessels={};
for(const atlas of generation.atlases){
 const source=path.join(root,atlas.sourceFile),{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height;
 for(let i=0;i<atlas.ids.length;i++){
  const id=atlas.ids[i],row=Math.floor(i/atlas.columns),col=i%atlas.columns;
  const x0=Math.floor(col*w/atlas.columns),x1=Math.floor((col+1)*w/atlas.columns),y0=Math.floor(row*h/atlas.rows),y1=Math.floor((row+1)*h/atlas.rows);
  let left=x1,top=y1,right=x0,bottom=y0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*w+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  left=Math.max(x0,left-4);top=Math.max(y0,top-4);right=Math.min(x1,right+4);bottom=Math.min(y1,bottom+4);
  const rect={left,top,width:right-left,height:bottom-top},m=runtime[id],original=m.originalSize,metrics=meta[id];
  let scale,dx,dy,fw,fh;
  if(id.startsWith('cup-')){
    scale=Math.min(original[0]*.9/rect.width,original[1]*.9/rect.height);
    fw=Math.round(rect.width*scale);fh=Math.round(rect.height*scale);dx=Math.floor((original[0]-fw)/2);dy=Math.floor((original[1]-fh)/2);
    const base=id.slice(4),geometry=cupGeometry[base],sx=fw/rect.width,sy=fh/rect.height;
    const tx=x=>(x-left)*sx+dx,ty=y=>(y-top)*sy+dy,round=n=>Math.round(n*100)/100;
    vessels[base]={size:original,rim:[round(tx(geometry.rim[0])),round(ty(geometry.rim[1])),round(geometry.rim[2]*sx),round(geometry.rim[3]*sy)]};
    if(geometry.body)vessels[base].body=geometry.body.map(([x,y])=>[round(tx(x)),round(ty(y))]);
  } else {
    const [ax,ay]=metrics.anchor,isLiquid=id.startsWith('liquid-');
    scale=Math.min(metrics.width/rect.width,2*(ax-3)/rect.width,2*(original[0]-ax-3)/rect.width,(isLiquid?2*Math.min(ay-3,original[1]-ay-3):ay-3)/rect.height);
    fw=Math.max(1,Math.round(rect.width*scale));fh=Math.max(1,Math.round(rect.height*scale));
    dx=Math.round(ax-fw/2);dy=Math.round(ay-(isLiquid?fh/2:fh));
  }
  const crop=await sharp(source).extract(rect).resize(fw,fh,{kernel:'nearest'}).toBuffer();
  const authored=await sharp({create:{width:original[0],height:original[1],channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:crop,left:dx,top:dy}]).png().toBuffer();
  const file=id+'.png';
  await sharp(authored).resize(m.size[0],m.size[1],{fit:'fill',kernel:'nearest'}).png().toFile(path.join(root,file));
  const bytes=await fs.readFile(path.join(root,file));
  manifest.assets[id]={file,source:atlas.sourceFile,sourceRect:rect,originalSize:original,outputSize:m.size,contentRect:[dx,dy,fw,fh],sha256:createHash('sha256').update(bytes).digest('hex')};
  assets['signature-'+id]='cozy-signature-v2/'+file;
 }
}
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({...manifest,vessels},null,2)+'\n');
await fs.writeFile(path.join(repo,'src/render/cozy-signature-registration.ts'),'/** Image-generated layer registration; coordinates stay in each original authored canvas. */\nexport const COZY_SIGNATURE_VESSELS = '+JSON.stringify(vessels,null,2)+' as const;\n\nexport const COZY_SIGNATURE_ASSETS = '+JSON.stringify(assets,null,2)+' as const;\n');
const ids=Object.keys(manifest.assets),tile=180,cols=7,layers=[];
for(let i=0;i<ids.length;i++){
 const id=ids[i],x=i%cols*tile,y=Math.floor(i/cols)*tile;
 const preview=await sharp(path.join(root,id+'.png')).resize(150,140,{fit:'inside',kernel:'nearest'}).png().toBuffer(),d=await sharp(preview).metadata();
 layers.push({input:preview,left:x+Math.floor((tile-d.width)/2),top:y+Math.floor((150-d.height)/2)});
 layers.push({input:Buffer.from('<svg width="180" height="24"><text x="90" y="17" text-anchor="middle" fill="#4c3427" font-family="Arial" font-size="12">'+id+'</text></svg>'),left:x,top:y+150});
}
await sharp({create:{width:cols*tile,height:Math.ceil(ids.length/cols)*tile,channels:4,background:'#f1e1c3'}}).composite(layers).png().toFile(path.join(root,'contact-sheet.png'));
console.log(JSON.stringify({assets:ids.length,vessels},null,2));

