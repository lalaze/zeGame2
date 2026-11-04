// Native 96-art-pixel originals: tabletop creative objects, never scaled icons.
// Seasonal changes alter working contents, mechanisms and assembled parts.
import { createPainter } from './build-seasonal-reserve-art.mjs';
const groups = [
  ['writing','书写珍藏','Writing keepsakes',[
    ['typewriter','便携打字机','Portable typewriter'],['quill-ink','羽笔墨水台','Quill and ink stand'],['pen-tray','钢笔陈列盘','Fountain pen tray'],['seal-press','桌面压印机','Desktop seal press'],['letter-rack','分格信札架','Letter sorting rack'],['calligraphy-rest','书法笔山','Calligraphy brush rest'],['pencil-sharpener','手摇削笔机','Crank pencil sharpener'],['bookmark-stand','书签样品架','Bookmark sample stand']]],
  ['painting','绘画工坊','Painting workshop',[
    ['easel','微型写生画架','Miniature easel'],['palette','拇指孔调色板','Thumbhole palette'],['paint-tubes','颜料管木匣','Paint tube case'],['brush-roll','卷帘画笔包','Roll-up brush wallet'],['pastel-case','粉彩色条盒','Pastel stick case'],['drafting-compass','制图圆规套装','Drafting compass set'],['print-brayer','版画滚筒台','Printmaking brayer'],['mini-print-press','微型版画压床','Miniature print press']]],
  ['textile','针线织造','Textile craft',[
    ['sewing-box','展开针线盒','Open sewing organizer'],['table-loom','桌面织布机','Tabletop weaving loom'],['embroidery-hoop','桌面刺绣绷','Standing embroidery hoop'],['crochet-tools','钩针工具卷','Crochet tool roll'],['knitting-swatches','针织试样架','Knitted swatch stand'],['spool-rack','缝线轴陈列架','Thread spool rack'],['lace-shuttle','梭编蕾丝台','Lace shuttle work'],['felt-animals','羊毛毡动物座','Felt animal study']]],
  ['music','音乐练习','Music practice',[
    ['guitar','木吉他支架','Acoustic guitar stand'],['violin','小提琴陈列座','Violin display stand'],['metronome','木壳节拍器','Wooden metronome'],['record-rack','黑胶唱片架','Vinyl record rack'],['accordion','手风琴模型','Accordion model'],['thumb-piano','拇指琴','Thumb piano'],['hand-drum','手鼓陈列座','Hand drum stand'],['harmonica-case','口琴开盒','Open harmonica case']]],
  ['games','益智桌游','Tabletop puzzles',[
    ['chess-board','木制棋盘','Wooden chess board'],['puzzle-tray','拼图工作盘','Jigsaw working tray'],['domino-rack','骨牌样品架','Domino display rack'],['tangram','七巧板盒','Tangram case'],['marble-solitaire','弹珠独立棋','Marble solitaire'],['dice-tower','骰子塔','Dice tower'],['wooden-abacus','木珠算盘','Wooden abacus'],['mechanical-puzzle','榫卯解锁球','Interlocking wooden puzzle']]],
  ['studio','创作收藏','Creative collections',[
    ['camera','折叠皮腔相机','Folding bellows camera'],['film-reels','胶片卷陈列台','Film reel display'],['ceramic-tools','陶艺塑形工具','Ceramic sculpting tools'],['clay-sculpture','陶土习作座','Clay sculpture study'],['paper-cranes','折纸鹤展台','Origami crane display'],['model-plane','木制滑翔机','Wooden glider model'],['stamp-album','邮票陈列册','Stamp display folio'],['bead-board','串珠设计盘','Bead design board']]],
];
export const PACK = {
  id:'hobby-reserve-v1', titleZh:'四季手作阅读角', titleEn:'Seasonal Creative Corner',
  categories:groups.map(([id,nameZh,nameEn])=>({id:`hobby-${id}`,nameZh,nameEn})),
  catalog:groups.flatMap(([category,,,items])=>items.map(([id,nameZh,nameEn])=>({id:`hobby-${id}`,nameZh,nameEn,category:`hobby-${category}`,tags:['hobby','tabletop','native-96','seasonal-structure',category]}))),
  variants:[{id:'spring',nameZh:'春日',nameEn:'Spring'},{id:'summer',nameZh:'夏日',nameEn:'Summer'},{id:'autumn',nameZh:'秋日',nameEn:'Autumn'},{id:'winter',nameZh:'冬日',nameEn:'Winter'}],
};
export function paintSprite(palette,base,variantIndex) {
  const s=((variantIndex%4)+4)%4, p=createPainter(palette);
  const {color:C,put,rect:R,line:L,ellipse:E,poly:P,box:B}=p;
  const ink=C('walnut',0),wd=C('oak',1),w=C('oak',3),wl=C('oak',5),paper=C('porcelain',2),pd=C('porcelain',0),hi=C('porcelain',3),gold=C('brass',3),gd=C('brass',1),metal=C('steel',2),md=C('steel',0),blue=C('cloth-1',1),bd=C('cloth-1',0),sage=C('sage',3),sd=C('sage',0),red=C('gingham',1),pink=C('cloth-5',1);
  const a=[pink,blue,C('terracotta',2),C('cloth-6',1)][s], al=[C('cloth-5',2),C('cloth-1',2),C('terracotta',3),C('cloth-6',2)][s];
  // All coordinates are art pixels. Contacts remain at y=80, no loose floor motifs.
  E(48,80,30,3,pd,undefined,undefined,pd); E(50,80,21,2,C('hair-option-0',1),undefined,undefined,C('hair-option-0',1));
  const panel=(x,y,ww,hh,c=w,d=wd,h=wl)=>{B(x,y,ww,hh,c,d,h);L(x+2,y+2,x+ww-3,y+2,h);L(x+2,y+3,x+2,y+hh-4,h);};
  const plank=(x,y,ww,hh)=>{panel(x,y,ww,hh);L(x+6,y+hh-4,x+ww-6,y+hh-4,C('oak',2));if(ww>30)L(x+9,y+5,x+24,y+5,C('oak',4));};
  const deck=(x=19,y=68,ww=58,hh=10)=>{P([[x,y],[x+8,y-6],[x+ww-5,y-6],[x+ww,y],[x+ww-2,y+hh],[x+2,y+hh]],w,wd,wl);L(x+3,y+1,x+ww-3,y+1,wl);};
  const pin=(x,y,r=2,c=gold)=>E(x,y,r,r,c,gd,hi);
  const page=(x,y,ww,hh)=>{panel(x,y,ww,hh,paper,pd,hi);for(let yy=y+6;yy<y+hh-3;yy+=4)L(x+4,yy,x+ww-5-(yy%3),yy,pd);};
  const rod=(x,y,x1,y1,c=w)=>{L(x,y,x1,y1,ink,3);L(x,y,x1,y1,c,2);};
  const spool=(x,y,c=a,hh=17)=>{panel(x-5,y,10,hh,c,sd,al);for(let yy=y+3;yy<y+hh;yy+=3)L(x-4,yy,x+3,yy,al);E(x,y,7,2,wl,wd,hi);E(x,y+hh,7,2,w,wd,wl);};
  const brush=(x,y,hh=30,tilt=0)=>{rod(x,y,x+tilt,y-hh,w);L(x+tilt,y-hh,x+tilt,y-hh-5,gold,3);P([[x+tilt-2,y-hh-5],[x+tilt-2,y-hh-10],[x+tilt+1,y-hh-15],[x+tilt+3,y-hh-5]],wd,ink,wl);};
  const stitch=(x,y,ww,hh)=>{for(let xx=x;xx<x+ww;xx+=4){put(xx,y,hi);put(xx,y+hh,hi);}for(let yy=y;yy<y+hh;yy+=4){put(x,yy,hi);put(x+ww,yy,hi);}};
  // Distinct landscape contents, used only on actual painted/printed work surfaces.
  const scene=(x,y,ww,hh)=>{
    R(x,y,ww,hh,hi);R(x+1,y+1,ww-2,Math.floor(hh*.55),s===3?C('cloth-1',2):C('sky',1));
    const yb=y+hh-2;
    if(s===0){P([[x+1,yb],[x+ww*.38,y+hh*.5],[x+ww*.7,yb]],sage,sd,C('sage',4));L(x+ww*.65,yb,x+ww*.65,y+5,wd);for(const [dx,dy]of[[-3,8],[3,6],[0,3]])E(x+ww*.65+dx,y+dy,3,2,pink,undefined,al);}
    if(s===1){R(x+1,y+hh*.55,ww-2,hh*.4,blue);P([[x+ww*.5,y+4],[x+ww*.5,yb-3],[x+3,yb-3]],paper,pd,hi);L(x+ww*.53,y+3,x+ww*.53,yb,wd);pin(x+ww-5,y+5,2,gold);}
    if(s===2){P([[x+1,yb],[x+ww*.5,y+hh*.43],[x+ww-2,yb]],w,wd,wl);for(let i=0;i<3;i++){L(x+5+i*7,yb,x+5+i*7,y+6,wd);E(x+5+i*7,y+7+(i%2)*3,4,5,C('terracotta',2),red,gold);}}
    if(s===3){P([[x+1,yb],[x+ww*.4,y+4],[x+ww-2,yb]],bd,md,hi);P([[x+ww*.4,y+4],[x+ww*.55,y+hh*.5],[x+ww*.4,y+hh*.4],[x+ww*.25,y+hh*.5]],hi,paper);R(x+1,yb-2,ww-2,3,paper);}
  };
  const chessman=(x,y,type,c)=>{E(x,y,4,2,c,wd,hi);panel(x-2,y-8,4,7,c,wd,hi);if(type%3===0){E(x,y-10,3,3,c,wd,hi);}else if(type%3===1){P([[x-3,y-8],[x-3,y-15],[x+3,y-13],[x+4,y-10]],c,wd,hi);}else{panel(x-4,y-13,8,4,c,wd,hi);R(x-3,y-15,2,3,c);R(x+1,y-15,2,3,c);}};
  switch(base.id.replace(/^hobby-/,'')) {
    case 'typewriter': {
      panel(23,39,50,26,a,bd,al);panel(19,60,58,17,a,bd,al);P([[24,60],[30,51],[66,51],[73,60]],metal,md,hi);
      page(31,15,33,28+s*3);L(29,42+s*3,67,42+s*3,ink,4);L(29,42+s*3,67,42+s*3,metal);pin(23,43,4);pin(74,43,4);
      for(let row=0;row<3;row++)for(let j=0;j<9-row%2;j++)E(26+j*5+row%2*2,60+row*4,2,1,paper,md,hi);
      panel(36,73,25,2,ink);L(74,36,81,36,metal,2);L(81,36,81,31,metal,2);
      if(s===0)L(35,25,57,25,pink);if(s===1){R(35,20,17,9,blue);L(35,22,49,27,hi);}if(s===2)for(let i=0;i<3;i++)R(36+i*8,25+i*3,5,3,w);if(s===3){L(38,25,55,25,red);L(44,19,44,32,red);}
      break;
    }
    case 'quill-ink': {
      deck(23,71,50,7);panel(29,54,24,21,blue,bd,al);P([[29,54],[34,49],[49,49],[53,54]],blue,bd,hi);panel(36,44,12,7,gold,gd,hi);
      rod(43,48,61+s*2,16,wd);P([[47,38],[49,24],[62+s*2,10],[65+s*2,21],[57,36]],s===3?hi:paper,pd,hi);for(let j=0;j<5;j++)L(51+j*2,31-j*3,59+j*2,25-j*3,pd);
      panel(34,61,14,8,paper,pd,hi);L(37,65,45,65,blue);
      if(s===0){page(55,57,15,14);L(57,60,66,65,pink);}if(s===1){panel(57,48,10,27,gold,gd,hi);E(62,48,5,2,ink);}if(s===2){E(63,64,8,6,red,ink,pink);pin(63,64,3);}if(s===3){panel(56,55,14,20,wd,ink,w);R(58,59,10,6,hi);}
      break;
    }
    case 'pen-tray': {
      deck(16,45,64,33);P([[22,46],[29,40],[72,40],[75,46],[72,72],[25,72]],wd,ink,w);
      const count=[3,4,2,3][s];for(let i=0;i<count;i++){let x=29+i*11;rod(x,68,x+7,44,[blue,red,sage,wd][i]);L(x+5,48,x+7,43,gold,3);P([[x+7,42],[x+8,36],[x+10,42]],gold,gd,hi);pin(x+1,65,1);}
      if(s===2){page(55,48,14,22);E(62,58,4,3,red,ink,pink);}if(s===3){panel(21,25,52,12,blue,bd,al);L(25,29,66,29,gold);}
      break;
    }
    case 'seal-press': {
      deck(26,70,48,8);panel(58,29,9,43,metal,md,hi);panel(33,29,33,7,metal,md,hi);panel(34,36,6,24,gold,gd,hi);E(37,60,10,3,gold,gd,hi);
      rod(62,29,39+s*5,15,wd);E(39+s*5,15,5,4,wd,ink,w);page(29,65,29+s*2,6);E(41+s*3,66,5,2,a,red,al);
      for(let i=0;i<2+s;i++)L(37+i*5,42,40+i*5,44,md);pin(62,32,3);break;
    }
    case 'letter-rack': {
      plank(22,70,53,8);for(let i=0;i<3;i++){let y=39+i*12;panel(24,y,46,5,w,wd,wl);page(29+i*2,y-18-(s+i)%3*3,20,20);P([[31+i*2,y-15],[40+i*2,y-8],[48+i*2,y-15]],paper,pd,hi);panel(23,y+3,49,8,w,wd,wl);}
      if(s===0){E(44,58,3,3,pink,red,hi);}if(s===1){R(55,40,9,9,blue);L(56,48,62,41,hi);}if(s===2){page(54,24,10,24);L(57,26,57,45,wd);}if(s===3){panel(53,37,13,14,red,ink,pink);R(58,38,2,12,gold);}
      break;
    }
    case 'calligraphy-rest': {
      deck(19,71,60,7);P([[25,60],[31,49],[38,59],[47,47],[55,59],[64,51],[70,62],[69,69],[26,69]],paper,pd,hi);
      for(let i=0;i<2+s%2;i++){const x=33+i*12;rod(x-9,57,x+9,33+i*3,wd);L(x-9,57,x-13,63,gold,3);P([[x-13,61],[x-10,65],[x-18,70]],ink,wd,w);}
      if(s===0){page(49,19,19,20);}if(s===1){E(67,72,6,3,ink,wd,w);}if(s===2){panel(24,23,9,16,red,ink,pink);}if(s===3){panel(56,18,15,22,wd,ink,w);R(59,22,9,14,hi);L(63,24,63,33,ink);}
      break;
    }
    case 'pencil-sharpener': {
      panel(28,31,38,41,a,bd,al);P([[28,31],[36,25],[65,25],[69,31],[66,70],[62,75],[28,75]],a,bd,al);
      E(46,38,10,10,metal,md,hi);E(46,38,4,4,ink);rod(46,38,35-s*3,17,wl);P([[32-s*3,16],[36-s*3,13],[35-s*3,19]],ink);
      panel(34,57,25,15,paper,pd,hi);for(let i=0;i<3+s;i++)L(37+i*4,62+(i%2)*4,41+i*4,64+(i%2)*4,w);
      L(67,43,76,47,metal,3);L(76,47,76,59,metal,3);E(76,61,4,6,wd,ink,w);pin(46,67,2);break;
    }
    case 'bookmark-stand': {
      plank(20,73,58,6);rod(27,73,27,24);rod(70,73,70,24);rod(26,26,71,26);for(let i=0;i<4;i++){let x=31+i*10,h=29+(s+i)%4*5;L(x+3,25,x+3,31,gold);P([[x,31],[x+7,31],[x+7,31+h],[x+3,27+h],[x,31+h]],i%2?a:paper,pd,hi);for(let yy=36;yy<25+h;yy+=6)L(x+2,yy,x+5,yy,i%2?hi:a);if(s===3)L(x+3,31+h,x+3,36+h,gold);}
      break;
    }
    case 'easel': {
      rod(27,79,43,19);rod(70,79,54,19);rod(49,54,51,77,wd);panel(26,24,45,42,w,wd,wl);scene(30,28,37,33);plank(23,65,52,5);panel(45,16,7,11,w,wd,wl);pin(48,21);if(s===1)brush(75,71,28,-2);if(s===2)panel(24,49,4,10,red);if(s===3)L(31,61,65,61,hi,2);break;
    }
    case 'palette': {
      P([[21,50],[27,35],[43,28],[62,31],[75,43],[78,59],[70,73],[54,79],[33,75],[21,64]],w,wd,wl);E(62,43,7,8,null,undefined,undefined,null);
      const dots=[[34,40],[26,54],[35,66],[50,70],[65,63]];dots.forEach(([x,y],i)=>E(x,y,4+(i+s)%3,3,[pink,blue,gold,sage,red][(i+s)%5],wd,hi));
      rod(32,64,65,20,wd);L(63,23,68,17,gold,4);P([[66,18],[66,12],[74,9],[71,18]],s===3?hi:a,wd,al);if(s===2){rod(46,63,76,37);P([[73,39],[79,28],[83,31],[78,41]],metal,md,hi);}break;
    }
    case 'paint-tubes': {
      panel(20,24,56,24,w,wd,wl);panel(25,28,46,15,paper,pd,hi);deck(17,49,63,29);for(let i=0;i<4;i++){let x=25+i*12,y=46+(i+s)%3*4;panel(x,y,9,25,paper,pd,hi);panel(x+1,y-5,7,6,metal,md,hi);R(x+1,y+8,7,9,[red,blue,sage,gold][(i+s)%4]);L(x+2,y+23,x+7,y+23,md);}if(s===3){panel(28,30,32,7,blue,bd,al);}else for(let i=0;i<2+s;i++)L(30+i*10,31,35+i*10,36,a,2);break;
    }
    case 'brush-roll': {
      P([[19,38],[68,34],[74,75],[23,79]],a,bd,al);stitch(25,44,43,27);for(let i=0;i<4;i++)brush(31+i*10,65,25+(i+s)%3*6,i%2?2:-2);P([[23,58],[69,55],[71,75],[24,78]],a,bd,al);for(let i=0;i<4;i++)L(28+i*10,59,29+i*10,74,bd);E(76,56,7,21,a,bd,al);L(73,41,73,68,al);if(s===3)P([[35,57],[45,56],[44,70],[36,69]],paper,pd,hi);break;
    }
    case 'pastel-case': {
      panel(21,24,53,22,w,wd,wl);panel(25,28,44,14,wd,ink,w);deck(17,49,63,29);for(let i=0;i<7;i++){let x=24+i*7;panel(x,47+(i+s)%3*3,5,23-(i+s)%3*3,[pink,blue,sage,gold,red,hi,metal][(i+s)%7],pd,hi);R(x,64,5,5,paper);}if(s===0)R(28,31,13,6,pink);if(s===1)L(28,36,61,32,blue,3);if(s===2){R(29,31,12,7,w);R(44,31,12,7,red);}if(s===3){R(30,31,27,7,hi);L(34,34,54,34,bd);}break;
    }
    case 'drafting-compass': {
      deck(21,30,54,48);P([[27,34],[33,29],[65,29],[69,34],[67,70],[28,70]],paper,pd,hi);E(48,52,14+s*2,12+s,undefined); // filled construction circle below
      E(48,52,14+s*2,12+s,blue,bd,hi);E(48,52,12+s*2,10+s,paper,undefined,undefined,paper);
      rod(47,30,33-s,67,metal);rod(49,30,64+s,66,metal);pin(48,30,4);panel(45,20,6,9,gold,gd,hi);L(34,63,31,70,ink);L(63,63,66,70,ink);L(32,47,63,47,gold);for(let i=0;i<4;i++)put(37+i*6,47,ink);break;
    }
    case 'print-brayer': {
      deck(19,58,59,20);panel(24,59,46,12,paper,pd,hi);R(28,61,20+s*5,7,a);panel(32,42,34,13,ink,wd,w);E(33,48,5,8,ink,wd,w);E(66,48,5,8,ink,wd,w);L(28,47,28,35,metal,2);L(71,47,71,35,metal,2);L(28,35,71,35,metal,2);panel(44,18,11,18,w,wd,wl);pin(49,33);if(s===3)panel(23,63,10,7,hi,pd,hi);break;
    }
    case 'mini-print-press': {
      deck(18,69,62,9);panel(24,30,7,40,metal,md,hi);panel(66,30,7,40,metal,md,hi);panel(25,26,47,8,metal,md,hi);panel(45,21,6,34,gold,gd,hi);for(let y=34;y<51;y+=4)L(44,y,51,y-2,gd);panel(31,54,34,6,metal,md,hi);page(28,64,39,6);R(34,64,22+s*3,3,a);L(31,19,65,19,wd,3);pin(32,19,3);pin(65,19,3);if(s%2===1){L(73,46,82,42,gold,2);pin(82,42,4);}break;
    }
    case 'sewing-box': {
      deck(18,61,62,18);panel(21,24,53,33,w,wd,wl);panel(26,28,43,25,paper,pd,hi);
      // The raised lid has two legible tool compartments, not tiny generic marks.
      panel(48,29,3,24,w,wd,wl);L(28,51,46,51,pd);
      // Full-size tailor scissors: crossed steel blades and two open brass eyes.
      P([[35,41],[40+s,30],[43+s,30],[38,43]],metal,md,hi);
      P([[39,42],[29+s,31],[30+s,28],[42,40]],metal,md,hi);
      L(37,39,41+s,31,hi);L(39,39,31+s,31,hi);
      E(32,46,5,5,gold,gd,hi);E(32,46,2,3,paper,undefined,undefined,paper);
      E(42,46,5,5,gold,gd,hi);E(42,46,2,3,paper,undefined,undefined,paper);
      L(34,43,37,40,gd,2);L(40,43,38,40,gd,2);pin(38,40,2);
      // Pins protrude above the pad with separate colored heads and steel shafts.
      if(s===0){E(60,45,8,6,pink,red,al);L(60,40,60,49,red);}
      if(s===1){panel(53,38,14,13,blue,bd,al);L(55,48,64,48,hi);}
      if(s===2){E(60,44,8,7,w,wd,wl);L(57,39,56,49,wd);L(63,39,64,49,wd);}
      if(s===3){panel(53,37,14,15,red,ink,pink);stitch(55,39,10,10);}
      for(const [x,y,c]of[[55,33,pink],[61,30,gold],[66,34,blue]]){L(x,y+1,60+(x-60)*.6,44,metal);pin(x,y,2,c);}
      // Deep lower compartments separate recognisable thread reels.
      panel(23,55,51,15,wd,ink,w);panel(38,56,3,14,w,wd,wl);panel(55,56,3,14,w,wd,wl);
      spool(30,56,a,11);spool(47,56,paper,11);
      if(s===3){panel(59,57,11,11,paper,pd,hi);L(60,61,68,61,blue);L(60,65,68,65,blue);}
      else spool(64,56,s===1?gold:sage,11);
      panel(22,70,53,7,w,wd,wl);pin(47,73);break;
    }
    case 'table-loom': {
      plank(24,23,7,54);plank(65,23,7,54);plank(24,26,48,5);plank(24,67,48,6);for(let x=33;x<64;x+=4)L(x,31,x,67,paper);for(let y=39+s*3;y<65;y+=3)L(32,y,64,y,(Math.floor(y/3)+s)%2?a:paper,2);plank(28,34+s*3,40,4);P([[35,50],[52,46],[61,49],[45,54]],w,wd,wl);L(40,50,55,49,a);for(let x=33;x<65;x+=4)L(x,71,x,77,al);break;
    }
    case 'embroidery-hoop': {
      deck(29,73,39,5);rod(47,73,47,62);E(48,43,27,27,w,wd,wl);E(48,43,23,23,paper,pd,hi);panel(40,13,16,6,gold,gd,hi);L(43,11,43,20,metal);L(53,11,53,20,metal);
      if(s===0){L(48,58,48,31,sage,2);for(let i=0;i<4;i++){let x=40+i%2*15,y=32+i*5;L(48,y+4,x,y,sage);E(x,y,4,3,pink,red,hi);}}
      if(s===1){P([[32,52],[48,34],[64,52]],blue,bd,hi);L(48,28,48,57,wd);L(32,57,64,57,blue);}
      if(s===2){P([[32,43],[43,37],[48,27],[54,38],[64,42],[54,51],[48,59],[41,51]],w,red,wl);L(48,31,48,57,wd);}
      if(s===3){for(let i=-1;i<=1;i++)L(35,43+i*5,61,43-i*5,blue);L(48,28,48,58,blue);for(let i=0;i<3;i++)R(38+i*8,33+i%2*17,2,2,hi);}
      for(let j=0;j<7;j++){put(31+j*5,61-j%2,pd);}rod(65,50,73,34,metal);break;
    }
    case 'crochet-tools': {
      P([[20,33],[72,33],[76,76],[22,78]],a,bd,al);for(let i=0;i<5;i++){let x=28+i*9,y=23+(i+s)%3*5;rod(x,66,x,y,gold);L(x,y,x+4,y-3,gold,2);L(x+4,y-3,x+4,y+2,gold,2);}P([[23,55],[73,55],[75,76],[23,77]],a,bd,al);for(let x=30;x<69;x+=9)L(x,56,x,74,bd);stitch(25,59,45,13);if(s===0){R(31,60,16,9,pink);}if(s===1){L(35,65,60,65,paper,3);}if(s===2){for(let i=0;i<3;i++)E(39+i*8,65,4,4,w,wd,wl);}if(s===3){panel(37,58,20,14,hi,pd,paper);for(let i=0;i<4;i++)L(40+i*4,60,40+i*4,70,blue);}break;
    }
    case 'knitting-swatches': {
      deck(24,73,48,5);rod(28,73,28,24);rod(67,73,67,24);rod(27,27,69,27);const hh=[31,23,36,42][s];P([[34,27],[61,27],[61,27+hh],[56,25+hh],[51,28+hh],[45,25+hh],[34,27+hh]],a,bd,al);for(let y=32;y<24+hh;y+=5)for(let x=37;x<59;x+=5){L(x-1,y,x+1,y+2,al);L(x+1,y+2,x+3,y,bd);}rod(31,48,67,18,metal);pin(67,18,3);if(s===3)for(let x=35;x<61;x+=4)L(x,68,x,73,paper);break;
    }
    case 'spool-rack': {
      plank(21,73,55,6);rod(27,74,27,29);rod(70,74,70,29);for(let row=0;row<2;row++){let y=46+row*25;plank(24,y,49,4);for(let i=0;i<3;i++){if(s===1&&row===0&&i===2)continue;spool(34+i*14,y-17,[a,paper,sage,gold][(i+row+s)%4],13);}}if(s===2)rod(70,38,79,24,metal);if(s===3){L(33,30,47,24,paper);L(47,24,62,29,paper);}break;
    }
    case 'lace-shuttle': {
      deck(19,60,60,18);for(let i=0;i<5+s;i++){E(29+i*6,61+(i%2)*5,6,5,paper,pd,hi);E(29+i*6,61+(i%2)*5,3,2,w,undefined,undefined,w);}P([[27,42],[44,31],[69,34],[77,41],[61,49],[38,49]],w,wd,wl);P([[34,41],[47,36],[63,37],[69,41],[58,44],[43,44]],a,bd,al);L(45,39,58,42,paper,2);L(66,43,70,55,paper);L(70,55,57,61,paper);if(s===3)P([[29,58],[32,50],[44,50],[47,58]],paper,pd,hi);break;
    }
    case 'felt-animals': {
      deck(25,74,47,5);const c=s===3?paper:s===2?w:a;
      E(48,60,18,17,c,pd,hi);E(47,37,16,15,c,pd,hi);
      if(s===0){E(37,20,5,12,c,pd,hi);E(55,19,5,12,c,pd,hi);L(37,15,37,25,pink,2);L(55,14,55,25,pink,2);}
      if(s===1){P([[32,33],[32,21],[43,26]],c,pd,hi);P([[52,26],[62,21],[62,35]],c,pd,hi);rod(64,64,75,53,c);}
      if(s===2){P([[32,33],[28,18],[43,26]],c,wd,wl);P([[52,26],[65,19],[62,36]],c,wd,wl);P([[60,63],[74,49],[77,62],[67,74]],w,wd,wl);}
      if(s===3){E(34,25,7,7,c,pd,hi);E(59,25,7,7,c,pd,hi);panel(33,48,28,7,red,ink,pink);panel(56,53,6,16,red,ink,pink);}
      E(39,74,7,4,c,pd,hi);E(57,74,7,4,c,pd,hi);put(41,36,ink);put(54,36,ink);E(47,43,5,4,hi,pd);put(47,41,ink);stitch(43,56,9,11);break;
    }
    case 'guitar': {
      rod(34,78,42,66,wd);rod(61,78,55,66,wd);E(46,63,18,17,w,wd,wl);E(46,46,13,12,w,wd,wl);E(46,49,6,6,ink,wd,w);panel(43,21,7,26,wd,ink,w);panel(41,11,12,13,w,wd,wl);for(let i=0;i<3;i++){pin(40,14+i*4,1);pin(54,14+i*4,1);}panel(39,67,15,4,wd,ink,w);for(let x=44;x<49;x+=2)L(x,19,x,69,paper);for(let y=26;y<45;y+=5)L(43,y,49,y,metal);
      if(s===0){L(59,43,69,70,pink,3);}if(s===1){panel(57,32,8,4,gold,gd,hi);L(57,35,47,35,gold,2);}if(s===2){panel(62,51,13,23,w,wd,wl);for(let i=0;i<3;i++)L(65+i*3,55,65+i*3,70,metal);}if(s===3){P([[54,54],[65,52],[64,71],[57,74]],blue,bd,al);stitch(57,57,5,12);}break;
    }
    case 'violin': {
      deck(29,75,38,4);rod(48,74,49,64,wd);
      P([[35,68],[31,61],[33,52],[39,48],[34,43],[35,35],[44,31],[56,34],[59,42],[53,49],[61,56],[60,67],[52,72],[42,72]],w,wd,wl);
      L(35,57,34,63,wl);L(36,38,38,35,wl);
      panel(43,19,9,31,ink,wd,metal);E(48,16,5,6,w,wd,wl);
      for(let y=19;y<26;y+=4){pin(41,y,1);pin(54,y,1);}
      // Paired curved f-holes: distinct heads, dark stems and hooked feet.
      E(39,48,2,2,ink,undefined,undefined,ink);L(39,49,36,58,ink,2);
      L(36,58,39,61,ink,2);E(40,61,2,1,ink,undefined,undefined,ink);L(35,54,40,54,ink);
      E(56,49,2,2,ink,undefined,undefined,ink);L(56,50,54,59,ink,2);
      L(54,59,56,62,ink,2);E(57,62,2,1,ink,undefined,undefined,ink);L(53,55,58,55,ink);
      // Light bridge with two arch openings; dark tailpiece anchors four strings.
      P([[41,60],[42,55],[46,53],[50,53],[54,55],[55,60],[52,61],[51,58],[45,58],[44,61]],paper,pd,hi);
      L(43,55,52,55,hi);R(46,58,4,3,w);
      P([[42,63],[53,63],[50,70],[45,70]],ink,wd,metal);
      for(let i=0;i<4;i++){const x=44+i*2;L(x,23,x,57,i%2?paper:hi);L(x,58,46+i,66,i%2?paper:hi);}
      rod(67,74,70+s*2,18,w);L(65,73,68+s*2,19,hi);
      if(s===3)panel(32,65,9,7,ink,wd,w);if(s===1)panel(59,67,9,5,gold,gd,hi);break;
    }
    case 'metronome': {
      P([[24,76],[37,20],[59,20],[73,76]],w,wd,wl);P([[32,67],[42,27],[54,27],[65,67]],ink,wd,w);for(let y=32;y<63;y+=5)L(44,y,53,y,wl);const xx=[39,57,43,53][s];rod(48,65,xx,27,metal);panel(xx-3,34+s*4,7,6,gold,gd,hi);pin(48,65,4);panel(29,71,39,6,w,wd,wl);panel(69,61,8,5,gold,gd,hi);if(s===3)P([[34,21],[39,14],[57,14],[62,21]],paper,pd,hi);break;
    }
    case 'record-rack': {
      deck(20,69,58,9);rod(25,67,28,38);rod(71,68,69,38);for(let i=0;i<3+s%2;i++){const x=25+i*9,y=28+i*4;panel(x,y,30,40,[a,w,paper,blue][i],wd,hi);E(x+15,y+18,12,12,ink,wd,w);E(x+15,y+18,4,4,[gold,pink,blue,sage][(i+s)%4],wd,hi);put(x+15,y+18,paper);}plank(22,69,54,6);if(s===2)panel(48,60,20,7,paper,pd,hi);break;
    }
    case 'accordion': {
      panel(18,34,16,38,a,bd,al);panel(64,30,15,42,a,bd,al);const left=34-s*2;P([[left,36],[63,32],[65,69],[left,72]],wd,ink,w);for(let x=left+2;x<64;x+=4){L(x,36,x+2,69,paper);L(x+2,36,x+3,69,ink);}panel(19,39,12,27,paper,pd,hi);for(let y=40;y<65;y+=5){L(21,y,29,y,pd);R(21,y,5,2,ink);}for(let y=39;y<67;y+=6){pin(69,y,1);pin(75,y+3,1);}rod(22,32,37,22,wd);rod(37,22,67,28,wd);panel(23,73,7,5,wd);panel(68,73,7,5,wd);if(s===3)panel(37,51,24,6,red,ink,pink);break;
    }
    case 'thumb-piano': {
      P([[27,32],[36,26],[65,26],[70,32],[67,77],[29,77]],w,wd,wl);E(48,61,9,8,ink,wd,w);panel(32,36,31,4,gold,gd,hi);for(let i=0;i<7;i++){let h=19+(3-Math.abs(3-i))*4;panel(34+i*4,34,3,h,metal,md,hi);}panel(32,33,32,3,gold,gd,hi);if(s===0)L(33,72,61,72,pink);if(s===1){pin(30,31,2);pin(66,31,2);}if(s===2){P([[32,65],[39,70],[32,75]],wd);P([[64,65],[57,70],[64,75]],wd);}if(s===3){P([[57,61],[63,61],[63,74],[58,72]],blue,bd,al);stitch(59,63,2,7);}break;
    }
    case 'hand-drum': {
      rod(31,78,37,65,wd);rod(64,78,59,65,wd);E(48,49,26,25,w,wd,wl);E(47,45,24,22,paper,pd,hi);E(47,45,20,18,hi,paper);for(let i=0;i<8;i++){let t=i*Math.PI/4;pin(48+Math.cos(t)*24,49+Math.sin(t)*23,2);}
      if(s===0){L(29,61,35,68,pink,3);}if(s===1){rod(27,68,66,30,w);E(67,29,5,5,paper,pd,hi);}if(s===2){for(let j=0;j<3;j++)L(59+j*4,64,60+j*4,76,gold);}if(s===3){rod(28,73,67,24,w);rod(67,73,28,24,w);E(27,23,4,5,paper,pd,hi);E(68,23,4,5,paper,pd,hi);}break;
    }
    case 'harmonica-case': {
      panel(19,35,58,21,wd,ink,w);panel(24,39,48,12,a,bd,al);deck(16,59,65,19);panel(24,55,48,14,metal,md,hi);panel(25,60,46,6,ink,wd,w);for(let i=0;i<10;i++)panel(28+i*4,61,2,3,paper,pd,hi);L(28,57,67,57,hi);pin(28,57,1);pin(68,57,1);if(s===0)page(29,40,16,9);if(s===1)panel(57,40,12,8,gold,gd,hi);if(s===2){R(27,42,40,2,w);R(27,46,28,2,w);}if(s===3){P([[38,42],[68,42],[66,51],[39,50]],paper,pd,hi);}break;
    }
    case 'chess-board': {
      deck(17,47,64,31);for(let y=0;y<6;y++)for(let x=0;x<6;x++)R(23+x*8,45+y*4,8,4,(x+y)%2?wd:paper);const positions=[[[31,51,0],[63,64,2],[47,69,1]],[[39,51,2],[55,59,0],[31,69,1],[63,69,0]],[[31,59,1],[47,55,2],[63,69,0]],[[39,55,0],[55,63,1],[31,69,2],[63,51,2]]][s];positions.forEach(([x,y,t],i)=>chessman(x,y,t,i%2?wd:paper));break;
    }
    case 'puzzle-tray': {
      deck(16,41,65,37);panel(23,41,50,29,wd,ink,w);scene(26,43,44,24);for(let x=36;x<68;x+=11){L(x,44,x,65,pd);E(x,51,2,2,paper,pd);}for(let y=50;y<65;y+=7)L(27,y,68,y,pd);let xx=28+s*10;R(xx,56,9,9,wd);P([[xx+2,31],[xx+9,31],[xx+9,35],[xx+12,36],[xx+9,39],[xx+9,43],[xx+1,43]],a,bd,al);break;
    }
    case 'domino-rack': {
      deck(19,69,59,10);for(let i=0;i<5;i++){let x=24+i*10,y=38+(i+s)%2*4;panel(x,y,9,29,paper,pd,hi);L(x+1,y+14,x+7,y+14,pd);const n=1+(i+s)%5;for(let j=0;j<n;j++)put(x+3+j%2*3,y+5+Math.floor(j/2)*3,ink);for(let j=0;j<6-n;j++)put(x+3+j%2*3,y+19+Math.floor(j/2)*3,ink);}plank(21,68,55,6);if(s===3)panel(30,27,30,7,w,wd,wl);break;
    }
    case 'tangram': {
      deck(20,34,55,44);panel(26,35,43,35,paper,pd,hi);const shift=s*2;P([[28,38],[48+shift,38],[28,58+shift]],a,bd,al);P([[67,39],[67,64],[43,64]],sage,sd,C('sage',4));P([[30,66],[45,50],[48,66]],gold,gd,hi);P([[48,39],[61,39],[55,48]],red,ink,pink);P([[40,54],[47,46],[54,53],[47,61]],w,wd,wl);P([[59,47],[66,47],[66,55],[59,55]],blue,bd,al);P([[29,59],[35,53],[42,53],[36,59]],paper,pd,hi);if(s===2)panel(30,23,33,5,w,wd,wl);break;
    }
    case 'marble-solitaire': {
      E(48,59,31,20,w,wd,wl);E(48,55,30,18,w,wd,wl);for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){if(Math.abs(i)+Math.abs(j)>3)continue;let x=48+i*10,y=55+j*6;E(x,y,4,2,wd,ink);if((i*3+j*5+s+20)%5!==0)E(x,y-2,3,3,(i+j+s)%2?blue:a,bd,hi);}if(s===3){panel(64,71,9,5,gold,gd,hi);}break;
    }
    case 'dice-tower': {
      P([[30,72],[30,25],[56,20],[68,27],[68,69],[57,76]],w,wd,wl);P([[31,25],[43,17],[68,25],[56,32]],wd,ink,w);panel(39,36,17,18,wd,ink,w);P([[39,56],[56,56],[59,67],[36,67]],paper,pd,hi);deck(25,73,48,6);for(let i=0;i<1+s;i++){let x=34+i*9,y=70-(i%2)*6;panel(x,y-5,8,7,paper,pd,hi);put(x+2,y-2,ink);if(i%2)put(x+5,y,ink);}for(let y=33;y<63;y+=8)L(60,y,64,y-2,wd);if(s===3)panel(28,25,4,14,gold,gd,hi);break;
    }
    case 'wooden-abacus': {
      panel(21,32,55,44,w,wd,wl);panel(27,38,43,31,wd,ink,w);for(let i=0;i<6;i++){const x=31+i*7;L(x,39,x,68,gold);for(let j=0;j<3;j++){const y=46+j*6-((i+s)%3===0?4:0);E(x,y,3,2,j===0?a:wl,wd,hi);}}panel(26,52,45,3,w,wd,wl);if(s===3){panel(31,25,35,6,paper,pd,hi);}break;
    }
    case 'mechanical-puzzle': {
      deck(27,73,44,5);const k=s*2;P([[29,40],[47,29],[68,41],[68,65],[48,77],[28,65]],w,wd,wl);P([[29,40],[47,29],[68,41],[48,52]],wl,w,hi);P([[48,52],[68,41],[68,65],[48,77]],wd,ink,w);panel(35-k,40,9,29,w,wd,wl);P([[28,49],[57,31],[64,36],[36,54]],paper,pd,hi);P([[40,60],[66,44],[73,48],[47,66]],w,wd,wl);L(49,54,49,73,ink);if(s%2)P([[23,38],[35,31],[42,35],[29,43]],gold,gd,hi);break;
    }
    case 'camera': {
      deck(25,72,48,7);panel(26,34,46,32,wd,ink,w);panel(30,29,14,7,metal,md,hi);panel(30,39,10,8,blue,bd,hi);P([[40,44],[58,40],[67,49],[63,68],[42,67]],ink,wd,w);for(let i=0;i<5;i++)L(42+i*4,45,43+i*4,64,md);E(58,57,13,13,metal,md,hi);E(58,57,9,9,ink,bd,metal);E(56,54,4,4,blue,bd,hi);pin(67,37,3);if(s===0){panel(64,19,8,13,paper,pd,hi);}if(s===1){panel(24,23,7,17,metal,md,hi);E(27,19,8,7,paper,pd,hi);}if(s===2){L(25,42,18,56,wd,3);L(18,56,26,70,wd,3);}if(s===3){panel(32,20,22,10,wd,ink,w);R(35,22,15,5,blue);}break;
    }
    case 'film-reels': {
      deck(22,71,53,8);for(const [x,y,r]of[[38,50,22],[63,63,14]]){E(x,y,r,r,metal,md,hi);for(let i=0;i<5;i++){let t=(i+s*.25)*Math.PI*2/5;E(x+Math.cos(t)*r*.57,y+Math.sin(t)*r*.57,r*.22,r*.22,ink,wd,w);}pin(x,y,3);}P([[22,48],[17,47],[16,66],[26,70],[34,66],[34,61],[28,64],[22,61]],wd,ink,w);for(let y=51;y<64;y+=4)R(18,y,2,2,paper);if(s===2){panel(61,28,12,15,ink,wd,w);R(63,31,8,8,gold);}if(s===3)panel(30,73,21,5,paper,pd,hi);break;
    }
    case 'ceramic-tools': {
      P([[20,49],[68,43],[76,75],[23,79]],paper,pd,hi);stitch(25,57,44,15);for(let i=0;i<3;i++){const x=31+i*15;rod(x,68,x+2,36+(i+s)%3*4,w);if(i===0){E(x+2,31,5,7,metal,md,hi);E(x+2,31,3,5,null,undefined,undefined,null);}if(i===1)P([[x,38],[x-3,26],[x+5,21],[x+6,36]],metal,md,hi);if(i===2){L(x-2,37,x-5,28,metal,2);L(x-5,28,x+6,26,metal,2);L(x+6,26,x+4,37,metal,2);}}
      P([[24,59],[69,55],[72,75],[25,77]],a,bd,al);for(let i=0;i<3;i++)L(37+i*15,59,39+i*15,74,bd);if(s===3)E(63,67,5,3,w,wd,wl);break;
    }
    case 'clay-sculpture': {
      deck(25,72,48,7);E(48,68,18,7,C('terracotta',2),wd,wl);if(s===0){E(48,49,15,18,C('terracotta',2),wd,wl);E(48,29,12,12,C('terracotta',2),wd,wl);L(43,31,46,31,wd);L(54,31,57,31,wd);P([[49,31],[46,39],[52,39]],w,wd,wl);}if(s===1){P([[32,65],[34,41],[48,30],[61,42],[65,65]],C('terracotta',2),wd,wl);E(48,48,8,9,null,undefined,undefined,null);}if(s===2){E(42,53,15,13,w,wd,wl);E(58,39,10,12,w,wd,wl);P([[50,32],[49,21],[57,29]],w,wd,wl);P([[61,30],[68,22],[67,36]],w,wd,wl);L(29,59,24,45,wd,3);put(60,38,ink);}if(s===3){E(48,55,18,14,C('terracotta',2),wd,wl);E(48,35,12,11,C('terracotta',2),wd,wl);E(40,24,5,5,w,wd,wl);E(56,24,5,5,w,wd,wl);L(39,53,57,53,wd);}break;
    }
    case 'paper-cranes': {
      deck(22,74,54,5);const crane=(x,y,k,c)=>{P([[x-k,y],[x,y-k],[x+k,y],[x+3,y+5]],c,pd,hi);P([[x,y],[x-14,y-18],[x-11,y+5]],c,pd,hi);P([[x,y],[x+17,y-15],[x+10,y+4]],c,pd,hi);P([[x+6,y+2],[x+13,y-5],[x+20,y-4],[x+14,y-1],[x+11,y+8]],c,pd,hi);L(x-7,y+1,x+1,y+4,pd);};rod(42,73,42,53,gold);crane(42,48,12,a);if(s===0){rod(67,74,67,62,gold);crane(64,62,6,paper);}if(s===1){rod(27,74,27,33,gold);crane(30,28,7,paper);}if(s===2){panel(27,65,9,7,w,wd,wl);}if(s===3){L(44,53,55,61,paper);crane(58,66,7,hi);}break;
    }
    case 'model-plane': {
      deck(29,75,40,4);rod(48,74,48,57,gold);P([[18,49],[35,45],[56,19],[63,20],[54,44],[78,49],[82,54],[54,56],[62,71],[56,73],[43,58],[23,57]],w,wd,wl);P([[22,48],[77,49],[80,53],[25,54]],paper,pd,hi);P([[42,45],[47,41],[59,44],[62,48]],blue,bd,hi);L(27,47,27,59,wd,2);pin(24,52,3);if(s===0)R(59,24,3,8,pink);if(s===1){rod(41,59,41,66,metal);E(39,66,4,3,ink,wd,w);}if(s===2)P([[57,66],[69,66],[72,70],[59,71]],red,wd,wl);if(s===3){P([[44,59],[40,68],[49,69],[54,60]],blue,bd,hi);L(40,70,54,70,metal,2);}break;
    }
    case 'stamp-album': {
      // Upright archival display folio, not an open reading book or book stack.
      P([[24,24],[65,19],[73,25],[73,75],[31,79],[24,72]],a,bd,al);panel(29,28,37,43,paper,pd,hi);for(let j=0;j<2;j++)for(let i=0;i<2;i++){const x=34+i*15,y=33+j*17;panel(x,y,11,13,[a,w,blue,sage][(i+j+s)%4],pd,hi);for(let yy=y;yy<y+13;yy+=3){put(x,yy,hi);put(x+10,yy,hi);}if((i+j+s)%2)P([[x+2,y+9],[x+5,y+4],[x+9,y+9]],paper);else E(x+5,y+6,3,3,gold,gd,hi);}L(27,27,27,70,gold);panel(61,59,10,6,gold,gd,hi);if(s===0){panel(35,20,17,9,paper,pd,hi);L(38,23,48,23,pink);L(38,26,46,26,pd);}if(s===1){panel(48,17,12,14,paper,pd,hi);R(51,20,6,6,blue);}if(s===2){panel(34,53,25,12,paper,pd,hi);for(let j=0;j<3;j++){panel(36+j*7,55,5,7,w,wd,wl);put(38+j*7,58,hi);}P([[56,18],[64,17],[67,29],[59,31]],paper,pd,hi);}if(s===3)page(33,19,17,6);break;
    }
    case 'bead-board': {
      deck(19,36,59,42);panel(25,38,46,34,paper,pd,hi);for(let r=0;r<2;r++){E(48,54,18-r*6,13-r*4,pd,undefined,undefined,pd);E(48,54,16-r*6,11-r*4,paper,undefined,undefined,paper);}for(let i=0;i<13+s*2;i++){let t=Math.PI*.15+i*Math.PI*1.65/(13+s*2);E(48+Math.cos(t)*18,54+Math.sin(t)*13,2,2,[a,gold,blue,paper][(i+s)%4],wd,hi);}for(let i=0;i<3;i++)pin(43+i*5,52,2,[a,gold,blue][i]);rod(69,42,77,24,metal);if(s===3){L(33,44,47,26,paper);L(47,26,63,43,paper);pin(47,26,3);}break;
    }
    default: throw new Error(`Unknown hobby reserve base: ${base.id}`);
  }
  return {width:96,height:96,pixels:p.pixels};
}
