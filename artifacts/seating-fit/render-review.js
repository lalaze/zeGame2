(async()=>{
  const source=await fetch('/src/render/cozy-cast-art.ts').then(r=>r.text());
  const seatUrl=source.match(/from "([^"]*cozy-seating-art[^"]*)"/)[1];
  const art=await import('/src/render/cozy-cast-art.ts'),fine=await import('/src/render/fine-sprite-art.ts'),seat=await import(seatUrl),{CUSTOMER_CAST}=await import('/src/game/customer-cast.ts');
  await art.preloadBatchCharacters();await seat.preloadSeatingEnsemble();
  const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.fillStyle='#eaddc4';x.fillRect(0,0,w,h);return {c,x};};
  const draw=(x,f,dx,dy,scale)=>x.drawImage(fine.fineSpriteArt(f).canvas,dx,dy,f.width*scale,f.height*scale);
  const pair=(x,frames,cx,floor,scale)=>{
    const poses=[frames.sitRight,frames.sitLeft];
    poses.forEach((p,i)=>{const g=seat.seatingGeometry(p),wx=cx+(i?seat.SEATING_LAYOUT.seatX:-seat.SEATING_LAYOUT.seatX)*scale;draw(x,seat.seatingFurniture('chair',i===1),wx-(i?21:13)*scale,floor-41*scale,scale);draw(x,p,wx-g.floor.x*scale,floor-g.floor.y*scale,scale);});
    const table=seat.seatingFurniture('table');draw(x,table,cx-table.width/2*scale,floor-table.height*scale,scale);
    poses.forEach((p,i)=>{const g=seat.seatingGeometry(p);draw(x,g.foreground,cx+(i?seat.SEATING_LAYOUT.seatX:-seat.SEATING_LAYOUT.seatX)*scale-g.floor.x*scale,floor-g.floor.y*scale,scale);});
  };
  const frames=id=>art.makeBatchCharacter(CUSTOMER_CAST[id].look,'customer',id,()=>{});
  const compare=make(1000,360),before=new Image();before.src='/artifacts/seating-fit/before.png';await before.decode();
  compare.x.drawImage(before,330,390,440,280,30,60,440,280);
  pair(compare.x,frames(27),750,320,5);
  compare.x.fillStyle='#44352d';compare.x.font='22px sans-serif';compare.x.fillText('修正前',30,36);compare.x.fillText('修正后：肩膀高于桌面',530,36);
  const roster=make(1600,1440);
  CUSTOMER_CAST.forEach(d=>{const ox=d.id%5*320,oy=Math.floor(d.id/5)*240;pair(roster.x,frames(d.id),ox+160,oy+218,4);roster.x.fillStyle='#44352d';roster.x.font='16px sans-serif';roster.x.fillText(d.id+' '+d.name,ox+10,oy+25);});
  window.seatingFitReview={compare:compare.c,roster:roster.c};
  return {table:[seat.SEATING_LAYOUT.tableWidth,seat.SEATING_LAYOUT.tableHeight],surface:seat.SEATING_LAYOUT.surfaceY,identities:CUSTOMER_CAST.length};
})()
