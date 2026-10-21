import type { StaticItemId, IngredientId } from '../game/data';

/** Authored on a 32-pixel workbench, then rasterized without smoothing.
 * The original game/icon bounding boxes remain the source of layout truth. */
export const MINIATURE_INK = '#39281f';
const C = { ink: MINIATURE_INK, cream: '#f4e6c7', white: '#fff5dc', porcelain: '#dcc69e', wood: '#865332', toast: '#c98c4d', crust: '#96552c', honey: '#e4af61', butter: '#f5d599', shade: '#543425', sage: '#627451', mint: '#9bb46b', brass: '#c8a15e', red: '#ba5d50', pink: '#dd998c', glass: '#8faeae', glint: '#deeee0', coffee: '#68402b', cocoa: '#895336', foam: '#eddbb8' };
export class MiniGrid {
  readonly side = 32;
  readonly cells: (string | undefined)[] = Array(32 * 32);
  p(x: number, y: number, c: string | undefined): void { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < 32 && y < 32) this.cells[y * 32 + x] = c; }
  r(x: number, y: number, w: number, h: number, c: string | undefined): void { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.p(xx, yy, c); }
  line(x: number, y: number, xx: number, yy: number, c: string, thick = 1): void { const steps = Math.max(Math.abs(xx - x), Math.abs(yy - y), 1); for (let i = 0; i <= steps; i++) this.r(Math.round(x + (xx - x) * i / steps), Math.round(y + (yy - y) * i / steps), thick, thick, c); }
  oval(x: number, y: number, w: number, h: number, c: string | undefined): void { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (((xx + .5 - x - w / 2) / (w / 2)) ** 2 + ((yy + .5 - y - h / 2) / (h / 2)) ** 2 <= 1) this.p(xx, yy, c); }
  poly(points: readonly (readonly [number, number])[], c: string): void { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { let inside = false; for (let i = 0, j = points.length - 1; i < points.length; j = i++) { const a = points[i], b = points[j]; if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside; } if (inside) this.p(x, y, c); } }
}
const plate = (g: MiniGrid, y = 27) => { g.oval(2,y-1,28,5,C.ink); g.oval(3,y-1,26,4,C.porcelain); g.oval(5,y-1,21,2,C.white); };
const steam = (g: MiniGrid, x = 12) => { g.line(x,2,x-1,4,C.porcelain); g.line(x-1,4,x,6,C.porcelain); g.line(x+7,1,x+6,3,C.foam); g.p(x+6,5,C.foam); };
function cup(g: MiniGrid, body: string, drink: string, tall = false, foam = false): void {
  const y = tall ? 8 : 12, h = tall ? 18 : 13;
  plate(g); g.oval(22,y+3,8,10,C.ink); g.oval(23,y+4,5,7,body); g.oval(24,y+5,3,4,undefined);
  g.r(5,y,19,h-3,C.ink); g.oval(5,y+h-8,19,10,C.ink); g.r(6,y+2,17,h-4,body); g.oval(6,y+h-8,17,9,body);
  g.r(7,y+3,2,h-4,C.white); g.r(21,y+3,2,h-5,C.porcelain); g.oval(6,y-1,18,6,C.porcelain); g.oval(7,y,16,4,drink); g.line(8,y,17,y,C.foam);
  if(foam){g.oval(9,y,12,4,C.foam);g.p(19,y+2,C.cocoa);}
}
function glass(g: MiniGrid, lower: string, upper: string, top = 5, foot = false): void {
  const bottom = foot ? 25 : 29;
  g.poly([[5,top],[26,top],[23,bottom],[9,bottom]],C.ink); g.poly([[7,top+1],[24,top+1],[21,bottom-1],[10,bottom-1]],C.glass);
  g.poly([[8,top+3],[23,top+3],[20,bottom-2],[11,bottom-2]],lower); g.r(8,top+3,15,Math.max(2,Math.floor((bottom-top)/2)-2),upper);
  g.line(7,top+2,10,bottom-3,C.glint); g.line(9,top+4,10,top+9,C.white); g.line(23,top+3,21,bottom-4,C.porcelain);
  g.oval(5,top-1,21,5,C.glass);g.oval(7,top,17,3,upper);g.line(8,top,19,top,C.white);g.line(10,bottom-1,20,bottom-1,C.glint);
  if(foot){g.r(14,25,3,3,C.glass);g.oval(10,28,12,3,C.glass);g.line(12,28,18,28,C.glint);}
}
const cream = (g:MiniGrid,x=11,y=3) => {g.oval(x-3,y+6,17,7,C.porcelain);g.oval(x-2,y+5,15,6,C.white);g.oval(x,y+2,11,6,C.foam);g.oval(x+2,y,7,5,C.white);g.r(x+3,y-2,3,3,C.white);g.line(x+5,y+4,x+8,y+4,C.porcelain);};
const berry = (g:MiniGrid,x:number,y:number) => {g.oval(x,y+1,5,6,C.red);g.p(x+1,y+2,C.pink);g.p(x+3,y+4,C.butter);g.line(x+1,y,x+4,y,C.sage);};
const leaf = (g:MiniGrid,x:number,y:number) => {g.poly([[x,y+3],[x+2,y],[x+7,y],[x+5,y+4]],C.sage);g.line(x+1,y+3,x+5,y+1,C.mint);};
const seed = (g:MiniGrid,x:number,y:number) => {g.r(x,y,2,1,C.cream);g.p(x,y+1,C.butter);};
function bun(g:MiniGrid,x=3,y=9,w=26,h=18,color:string=C.toast):void {g.oval(x,y+2,w,h,C.ink);g.oval(x+1,y+1,w-2,h-1,C.crust);g.oval(x+2,y,w-4,h-3,color);g.oval(x+4,y+1,w-10,Math.max(2,h-8),C.honey);g.oval(x+5,y+2,Math.max(3,w-16),2,C.butter);g.line(x+6,y+h-3,x+w-5,y+h-3,C.shade);}
function loaf(g:MiniGrid,color:string=C.toast):void {g.poly([[3,11],[8,6],[23,6],[29,12],[27,26],[7,27],[3,23]],C.ink);g.poly([[4,12],[9,7],[22,7],[28,13],[26,23],[7,25],[4,22]],C.crust);g.poly([[5,11],[10,8],[21,8],[26,12],[24,21],[7,22]],color);g.line(7,12,23,10,C.honey);g.line(6,24,24,25,C.shade);}
function breadArt(id:StaticItemId,g:MiniGrid): boolean {
  switch(id){
    case 'roll': bun(g);g.line(10,11,13,20,C.butter,2);g.line(17,10,20,19,C.butter,2);g.line(9,12,12,21,C.crust);return true;
    case 'bagel': bun(g,3,9,26,18);g.oval(11,14,10,8,C.shade);g.oval(12,14,8,6,undefined);[[8,12],[17,11],[23,16],[8,21],[18,24]].forEach(([x,y])=>seed(g,x,y));return true;
    case 'baguette':g.line(7,25,25,6,C.ink,5);g.line(6,24,24,5,C.crust,5);g.line(7,23,24,5,C.honey,3);for(let i=0;i<4;i++){g.line(8+i*5,21-i*5,11+i*5,23-i*5,C.shade);g.line(8+i*5,20-i*5,11+i*5,22-i*5,C.butter);}return true;
    case 'cheesebun':bun(g);g.oval(7,10,17,10,C.butter);g.poly([[9,11],[24,14],[20,20],[7,17]],C.honey);g.r(13,16,2,2,C.crust);g.p(20,13,C.crust);g.line(9,11,19,11,C.cream);return true;
    case 'pretzel':g.oval(2,6,16,16,C.ink);g.oval(14,6,16,16,C.ink);g.oval(4,8,12,12,C.toast);g.oval(16,8,12,12,C.toast);g.oval(7,10,7,7,undefined);g.oval(18,10,7,7,undefined);g.line(6,21,19,10,C.crust,4);g.line(23,21,10,10,C.honey,4);g.oval(5,19,22,10,C.ink);g.oval(6,19,20,8,C.toast);g.oval(10,20,12,4,undefined);[[7,9],[23,10],[9,25],[20,25],[15,15]].forEach(([x,y])=>seed(g,x,y));return true;
    case 'focaccia':loaf(g,C.honey);for(const [x,y] of [[9,13],[18,11],[23,16],[14,19],[7,19]]){g.oval(x,y,3,3,C.crust);g.p(x,y,C.brass);}leaf(g,10,12);leaf(g,19,19);g.p(8,10,C.white);return true;
    case 'ciabatta':loaf(g,C.porcelain);g.oval(7,9,17,8,C.butter);for(const [x,y] of [[9,13],[17,16],[21,11],[8,20],[20,20]]){g.r(x,y,2,1,C.crust);g.p(x,y-1,C.cream);}return true;
    case 'raisinbread':loaf(g);for(const [x,y] of [[9,12],[18,11],[23,17],[14,19],[8,20]]){g.oval(x,y,3,3,C.shade);g.p(x,y,C.cocoa);}g.line(8,8,22,8,C.butter);return true;
    case 'sourdough':bun(g,2,7,28,21);g.line(9,11,21,22,C.shade,2);g.line(10,10,22,21,C.butter,2);g.line(9,16,18,9,C.butter);g.line(15,23,25,16,C.butter);seed(g,6,17);return true;
    case 'rye':loaf(g,C.wood);for(let i=0;i<12;i++)seed(g,7+(i*7)%17,10+(i*5)%12);g.line(12,9,10,18,C.shade);return true;
    case 'chocobread':loaf(g,C.cocoa);g.line(8,11,23,17,C.shade,3);g.line(7,17,23,22,C.shade,2);g.line(9,10,24,16,C.toast);return true;
    case 'shokupan':g.r(5,13,23,16,C.ink);g.oval(3,4,16,16,C.crust);g.oval(14,4,15,16,C.crust);g.r(6,12,21,16,C.crust);g.oval(5,6,14,13,C.butter);g.oval(15,6,12,13,C.butter);g.r(7,13,17,13,C.cream);g.line(8,25,22,25,C.porcelain);g.line(8,8,12,8,C.white);return true;
    case 'brioche':bun(g,2,14,28,15);for(let i=0;i<3;i++)bun(g,4+i*7,5-i%2*3,10,17);g.line(6,24,25,24,C.honey);return true;
    case 'fruitbrioche':bun(g,3,12,26,17);bun(g,8,4,16,17);berry(g,7,15);berry(g,20,13);g.oval(16,6,4,4,'#73627d');g.line(11,7,14,7,C.white);return true;
    case 'garlicbread':loaf(g);g.poly([[6,11],[22,8],[25,17],[8,22]],C.butter);g.line(10,11,12,20,C.crust);g.line(17,9,19,18,C.crust);for(const [x,y] of [[8,13],[15,15],[21,12],[19,18],[9,19]])g.line(x,y,x+2,y-1,C.sage);return true;
  }return false;
}
function pastryArt(id:StaticItemId,g:MiniGrid):boolean {
 switch(id){
  case 'donut':bun(g,3,7,26,21);g.oval(5,8,22,15,C.pink);g.oval(12,12,9,8,C.crust);g.oval(13,12,7,5,undefined);for(const [x,y,c]of [[9,10,C.white],[21,11,C.butter],[7,16,C.sage],[21,18,C.white],[11,22,C.butter]]as const)g.line(x,y,x+2,y,c);return true;
  case 'scone':g.poly([[3,25],[11,6],[21,8],[29,26]],C.ink);g.poly([[5,24],[12,8],[20,9],[26,24]],C.toast);g.poly([[7,18],[12,8],[20,9],[24,18]],C.butter);g.line(7,19,23,20,C.shade);g.line(9,21,25,22,C.honey);g.p(14,12,C.cocoa);g.p(18,15,C.cocoa);return true;
  case 'cookie':bun(g,3,5,26,23,C.honey);for(const [x,y]of [[9,9],[19,8],[23,15],[13,15],[7,20],[18,22]]){g.oval(x,y,4,3,C.shade);g.p(x,y,C.cocoa);}return true;
  case 'croissant':g.oval(2,10,28,18,C.shade);g.oval(3,9,26,17,C.toast);g.oval(7,15,18,15,undefined);g.poly([[5,23],[2,20],[6,10],[10,8],[13,16]],C.crust);g.poly([[20,16],[22,7],[27,11],[29,20],[26,23]],C.crust);for(let i=0;i<4;i++){g.oval(7+i*4,7-Math.abs(1-i),8,14,C.crust);g.oval(7+i*4,6-Math.abs(1-i),6,12,C.honey);g.line(9+i*4,8,10+i*4,10,C.butter);}return true;
  case 'painchoc':loaf(g);g.line(10,8,11,22,C.butter,2);g.line(18,8,19,21,C.butter,2);g.oval(8,23,5,4,C.shade);g.oval(20,22,5,4,C.shade);g.p(9,23,C.cocoa);return true;
  case 'brownie':plate(g);g.poly([[4,12],[11,7],[28,10],[27,25],[7,27],[4,22]],C.ink);g.poly([[5,13],[27,11],[26,23],[8,25],[5,21]],C.shade);g.poly([[5,12],[11,8],[27,10],[23,18],[6,18]],C.cocoa);g.line(7,12,23,11,C.toast);for(const [x,y]of [[10,13],[19,12],[24,16],[12,19]]){g.r(x,y,3,2,C.wood);g.p(x,y,C.honey);}return true;
  case 'cinnamon':bun(g,3,6,26,23);g.oval(6,7,21,18,C.butter);g.oval(8,9,17,14,C.crust);g.oval(10,10,13,11,C.honey);g.oval(12,12,9,7,C.shade);g.oval(14,13,5,4,C.butter);g.line(8,9,10,18,C.white);g.line(21,8,24,17,C.white);return true;
  case 'muffin':g.poly([[5,16],[27,16],[23,29],[10,29]],C.ink);g.poly([[7,17],[25,17],[22,28],[11,28]],C.brass);for(let i=0;i<4;i++)g.line(10+i*4,18,12+i*3,27,C.wood);bun(g,2,4,28,17);for(const [x,y]of [[8,9],[18,6],[23,12],[14,15]]){g.oval(x,y,3,3,'#655368');g.p(x,y,'#a493a2');}return true;
  case 'creampuff':bun(g,3,12,26,17);g.oval(4,15,24,7,C.cream);g.line(7,19,24,19,C.porcelain);bun(g,4,5,24,15);g.line(9,11,15,8,C.white);g.p(18,10,C.white);return true;
  case 'melonpan':bun(g,3,5,26,24,C.butter);for(let y=7;y<25;y++)for(let x=5;x<27;x++){if(g.cells[y*32+x] && g.cells[y*32+x]!==C.ink && ((x+y)%6===0 || (x-y+36)%6===0))g.p(x,y,C.toast);}g.oval(3,24,26,5,C.crust);g.line(8,26,22,26,C.honey);return true;
  case 'eggtart':g.poly([[3,13],[7,8],[25,8],[29,13],[26,26],[7,26]],C.ink);g.poly([[4,13],[8,9],[24,9],[28,13],[25,25],[8,25]],C.toast);for(let i=0;i<6;i++)g.line(6+i*4,14,8+i*3,25,C.crust);g.oval(4,8,24,13,C.crust);g.oval(6,9,20,10,C.honey);g.oval(8,10,16,7,C.butter);g.oval(10,10,7,2,C.white);return true;
  case 'cake':plate(g);g.poly([[4,12],[22,5],[28,12],[28,27],[5,26]],C.ink);g.poly([[5,13],[27,13],[27,25],[5,24]],C.butter);g.r(5,17,22,3,C.pink);g.r(5,23,22,2,C.cream);g.poly([[5,12],[22,6],[27,12],[26,15],[5,15]],C.white);g.r(25,15,2,10,C.porcelain);berry(g,18,4);leaf(g,22,5);return true;
  case 'swissroll':plate(g);g.r(9,8,16,18,C.crust);g.oval(15,8,14,18,C.honey);g.oval(3,8,20,19,C.butter);g.oval(5,10,16,15,C.white);g.oval(7,12,12,11,C.pink);g.oval(9,13,9,8,C.white);g.oval(11,15,5,4,C.pink);g.line(21,9,26,11,C.butter);return true;
  case 'cheesecake':plate(g);g.poly([[4,12],[23,5],[28,12],[28,26],[5,26]],C.ink);g.poly([[5,13],[27,13],[27,24],[5,24]],C.butter);g.poly([[5,12],[23,6],[27,12],[27,15],[5,15]],C.white);g.r(5,23,22,3,C.toast);g.r(25,15,2,8,C.honey);g.line(7,16,7,21,C.cream);berry(g,20,6);return true;
  case 'macaron':g.oval(2,17,19,12,C.ink);g.oval(3,18,17,9,C.sage);g.r(4,21,15,3,C.cream);g.oval(2,14,19,10,C.mint);g.line(6,16,13,16,C.cream);g.oval(12,8,18,13,C.ink);g.oval(13,9,16,11,C.red);g.r(14,13,14,3,C.cream);g.oval(12,5,18,10,C.pink);g.line(16,7,22,7,C.white);return true;
 }return false;
}
function drinkArt(id:StaticItemId,g:MiniGrid):void {
 switch(id){
  case 'espresso':steam(g);cup(g,C.cream,C.coffee);g.oval(10,13,9,2,C.toast);break;
  case 'americano':steam(g,10);cup(g,C.cream,C.shade,true);g.line(10,10,17,10,C.cocoa);break;
  case 'latte':cup(g,C.cream,C.toast,true,true);g.oval(10,9,10,3,C.white);g.p(15,12,C.white);g.line(15,10,17,12,C.toast);break;
  case 'cappuccino':steam(g);cup(g,C.red,C.foam,false,true);for(const [x,y] of [[10,13],[17,14],[20,13]])g.p(x,y,C.cocoa);break;
  case 'flatwhite':cup(g,C.cream,C.toast);g.oval(12,12,6,3,C.white);g.line(11,13,19,15,C.foam);break;
  case 'cortado':glass(g,C.coffee,C.foam,12);g.r(10,21,11,4,C.toast);g.line(10,22,19,22,C.butter);break;
  case 'mocha':cup(g,C.cocoa,C.coffee);cream(g,10,4);g.line(12,8,22,11,C.shade);g.p(16,6,C.shade);break;
  case 'vienna':cup(g,C.cream,C.coffee);cream(g,11,2);g.p(16,3,C.honey);g.line(10,24,19,24,C.brass);break;
  case 'macchiato':glass(g,C.butter,C.coffee,7);g.r(10,16,12,4,C.toast);cream(g,10,1);g.line(11,8,21,10,C.honey);break;
  case 'coldbrew':glass(g,C.shade,C.coffee,5);g.line(23,1,18,17,C.sage,2);for(const [x,y]of [[10,10],[18,14],[12,20]]){g.r(x,y,4,3,C.glass);g.line(x,y,x+2,y,C.glint);}break;
  case 'dirty':glass(g,C.cream,C.coffee,10);g.r(10,17,12,3,C.toast);g.line(14,16,16,23,C.honey);g.line(11,11,18,11,C.butter);break;
  case 'pourover':glass(g,C.coffee,C.toast,17);g.poly([[3,5],[29,5],[20,17],[12,17]],C.ink);g.poly([[5,6],[27,6],[19,15],[13,15]],C.red);for(let i=0;i<4;i++)g.line(9+i*5,7,13+i*2,14,C.pink);g.r(14,16,3,3,C.coffee);break;
  case 'creamcoffee':glass(g,C.coffee,C.toast,10,true);cream(g,9,1);g.line(13,7,22,10,C.honey);g.r(24,1,2,16,C.wood);g.p(25,2,C.honey);break;
  case 'affogato':glass(g,C.coffee,C.toast,17,true);g.oval(7,5,19,17,C.porcelain);g.oval(8,4,17,15,C.white);g.line(12,10,21,16,C.coffee,2);g.line(11,10,20,15,C.toast);break;
  case 'blacktea':steam(g);cup(g,C.cream,'#ae7037');g.line(22,13,24,19,C.brass);g.r(23,19,4,5,C.sage);g.p(24,20,C.white);break;
  case 'hotchoc':cup(g,C.red,C.cocoa,true);cream(g,10,1);for(const [x,y]of [[12,6],[18,5],[20,10]])g.r(x,y,2,2,C.cocoa);break;
  case 'lemontea':glass(g,'#bd8946','#d8ab60',7);g.oval(18,4,11,11,C.crust);g.oval(19,4,9,9,C.butter);g.line(20,6,26,11,C.white);g.line(21,11,26,6,C.white);g.line(8,2,14,19,C.sage);break;
  case 'chai':steam(g);cup(g,C.sage,C.foam);g.line(21,4,19,14,C.wood,2);g.line(23,4,21,14,C.toast);g.p(12,13,C.cocoa);g.p(17,14,C.cocoa);break;
  case 'fruittea':glass(g,'#ae644a','#d69460',7);berry(g,10,20);berry(g,18,15);g.oval(9,10,7,5,C.butter);leaf(g,18,5);break;
  case 'hojicha':cup(g,C.wood,'#a58158',true,true);g.line(9,21,20,21,C.brass);g.line(9,23,20,23,C.brass);leaf(g,20,3);break;
  case 'matcha':glass(g,C.sage,C.cream,6);g.r(10,18,12,5,C.mint);g.line(10,15,20,16,C.butter);leaf(g,21,3);break;
  case 'frappe':glass(g,C.cocoa,C.toast,11);cream(g,10,2);g.line(24,1,19,15,C.red,2);g.line(10,20,20,23,C.butter);break;
  case 'smoothie':glass(g,C.red,C.pink,8);g.line(25,1,18,18,C.sage,2);berry(g,4,5);g.p(13,16,C.cream);g.p(17,20,C.cream);break;
  case 'milktea':glass(g,C.toast,C.foam,6);g.line(23,1,19,14,C.wood,2);for(let i=0;i<7;i++)g.oval(10+(i*5)%12,23+(i%2)*3,3,3,C.shade);break;
  case 'matchafloat':glass(g,C.sage,C.mint,15,true);g.oval(7,4,18,17,C.porcelain);g.oval(8,3,16,15,C.white);g.line(10,12,21,15,C.sage);leaf(g,21,7);g.line(26,2,22,14,C.red,2);break;
  default:throw new Error(`No authored miniature for ${id}`);
 }
}
export function menuMiniatureGrid(id:StaticItemId):MiniGrid { const g = new MiniGrid(); if(!breadArt(id,g)&&!pastryArt(id,g))drinkArt(id,g);return g; }

/** Downsample into the legacy envelope. A crisp one-pixel contour is computed
 * after sampling so coffee handles, toasted crusts and glass rims survive 1×. */
export function miniatureCanvas(g:MiniGrid,w:number,h:number,outline:boolean,density=1):HTMLCanvasElement {
 const pad=outline?1:0;const canvas=document.createElement('canvas');canvas.width=(w+pad*2)*density;canvas.height=(h+pad*2)*density;const context=canvas.getContext('2d');if(!context)return canvas;context.imageSmoothingEnabled=false;
 const iw=w*density,ih=h*density,px=pad*density;const cells:(string|undefined)[]=Array(iw*ih);
 for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){const sx=Math.min(31,Math.floor((x+.5)/iw*32)),sy=Math.min(31,Math.floor((y+.5)/ih*32));cells[y*iw+x]=g.cells[sy*32+sx];}
 const at=(x:number,y:number)=>x>=0&&y>=0&&x<iw&&y<ih?cells[y*iw+x]:undefined;
 // The master owns material edges. Native icons need a selective one-pixel
 // legibility contour; exported art gets only one physical edge pixel too.
 const edgeWidth = 1;
 if(outline && edgeWidth)for(let y=-edgeWidth;y<ih+edgeWidth;y++)for(let x=-edgeWidth;x<iw+edgeWidth;x++){if(at(x,y))continue;if([[0,edgeWidth],[0,-edgeWidth],[edgeWidth,0],[-edgeWidth,0]].some(([dx,dy])=>at(x+dx,y+dy))){context.fillStyle=density===1 && (at(x+1,y)||at(x,y+1))?'#79583a':C.ink;context.fillRect(x+px,y+px,1,1);}}
 for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){const color=cells[y*iw+x];if(color){context.fillStyle=color;context.fillRect(x+px,y+px,1,1);}}
 return canvas;
}
const cache=new Map<string,HTMLCanvasElement>();
export function menuMiniature(id:StaticItemId,w:number,h:number,outline=true,density=1):HTMLCanvasElement{const key=`${id}.${w}.${h}.${outline}.${density}`;let canvas=cache.get(key);if(!canvas){canvas=miniatureCanvas(menuMiniatureGrid(id),w,h,outline,density);cache.set(key,canvas);}return canvas;}

export function ingredientMiniatureGrid(id:IngredientId):MiniGrid {
 const g=new MiniGrid();switch(id){
 case 'beans':g.poly([[7,3],[23,3],[24,8],[28,27],[5,28],[7,8]],C.ink);g.r(8,5,15,3,C.brass);g.poly([[8,9],[22,9],[26,26],[7,26]],C.wood);g.r(9,12,14,10,C.cream);g.oval(12,14,7,6,C.coffee);g.line(16,14,14,19,C.honey);g.line(9,9,10,23,C.toast);break;
 case 'milk':g.poly([[9,3],[21,3],[26,8],[26,28],[6,28],[6,8]],C.ink);g.poly([[10,4],[21,4],[24,8],[8,8]],C.glass);g.r(7,9,18,18,C.cream);g.r(7,10,18,5,C.glass);g.r(21,15,4,12,C.porcelain);g.r(10,18,9,6,C.glass);g.r(10,18,2,5,C.glint);g.line(11,5,20,5,C.white);break;
 case 'flour':g.poly([[8,4],[23,4],[23,8],[28,25],[25,29],[6,29],[3,25],[8,8]],C.ink);g.poly([[9,5],[22,5],[22,9],[26,25],[24,27],[7,27],[5,25],[9,9]],C.cream);g.r(9,6,13,2,C.brass);g.r(10,14,11,9,C.wood);g.line(15,15,15,22,C.butter);for(let i=0;i<3;i++){g.line(12,16+i*2,15,18+i*2,C.butter);g.line(18,16+i*2,15,18+i*2,C.butter);}break;
 case 'butter':plate(g);g.poly([[5,13],[13,7],[28,12],[27,24],[6,24]],C.ink);g.poly([[7,14],[14,9],[26,13],[25,22],[7,22]],C.honey);g.poly([[7,13],[14,8],[26,12],[20,17]],C.butter);g.line(9,13,15,10,C.white);g.r(20,17,5,5,C.toast);break;
 case 'eggs':g.poly([[2,19],[29,19],[26,29],[6,29]],C.wood);g.oval(3,6,13,20,C.ink);g.oval(4,6,11,18,C.cream);g.oval(15,8,14,19,C.ink);g.oval(16,8,12,17,C.butter);g.oval(6,8,4,9,C.white);g.oval(18,10,4,7,C.cream);g.line(4,25,26,25,C.brass);break;
 case 'sugar':for(const [x,y]of [[3,15],[12,7],[19,17]]){g.poly([[x,y+3],[x+5,y],[x+11,y+3],[x+11,y+12],[x,y+12]],C.ink);g.r(x+1,y+4,9,7,C.porcelain);g.poly([[x+1,y+3],[x+5,y+1],[x+10,y+3],[x+5,y+5]],C.white);g.r(x+1,y+5,4,6,C.cream);}break;
 case 'tea':g.r(6,10,21,19,C.ink);g.r(7,12,19,15,C.sage);g.r(5,9,23,4,C.brass);g.r(10,15,13,10,C.cream);leaf(g,12,17);g.line(8,13,8,25,C.mint);leaf(g,9,3);leaf(g,18,2);break;
 case 'spice':g.line(6,26,17,5,C.ink,5);g.line(7,25,17,5,C.wood,3);g.line(8,24,18,5,C.toast);g.line(15,28,25,9,C.ink,4);g.line(16,26,25,9,C.crust,2);g.oval(23,8,5,4,C.honey);g.p(25,10,C.wood);break;
 case 'cocoa':g.poly([[5,7],[23,3],[28,24],[10,29]],C.ink);g.poly([[6,8],[22,4],[27,23],[11,27]],C.cocoa);for(let y=0;y<3;y++)for(let x=0;x<2;x++){g.r(9+x*7+y,8+y*5,5,4,C.shade);g.line(9+x*7+y,8+y*5,12+x*7+y,8+y*5,C.toast);}g.poly([[7,19],[25,15],[28,24],[10,29]],C.porcelain);g.line(12,25,22,23,C.cream);break;
 case 'cream':g.oval(3,19,27,10,C.ink);g.oval(4,19,25,8,C.glass);g.line(8,25,22,25,C.glint);cream(g,10,6);break;
 case 'fruit':berry(g,7,14);berry(g,18,20);g.oval(12,7,15,15,C.red);g.oval(14,9,5,6,C.pink);leaf(g,15,3);g.line(19,3,18,8,C.wood);break;
 case 'matcha':g.oval(3,16,26,13,C.ink);g.oval(4,17,24,10,C.wood);g.oval(4,14,24,11,C.sage);g.oval(6,15,20,7,C.mint);g.line(8,16,17,16,C.butter);g.line(23,3,20,18,C.brass,2);for(let i=0;i<4;i++)g.line(18+i*2,9,18+i,20,C.honey);leaf(g,4,6);break;
 }return g;
}
export function ingredientMiniature(id:IngredientId,w:number,h:number):HTMLCanvasElement {const key=`ingredient.${id}.${w}.${h}`;let c=cache.get(key);if(!c){c=miniatureCanvas(ingredientMiniatureGrid(id),w,h,true);cache.set(key,c);}return c;}
export function upgradeMiniature(id:'marketing'|'machine'|'tables'|'pass',w:number,h:number):HTMLCanvasElement {const key=`upgrade.${id}`;let c=cache.get(key);if(c)return c;const g=new MiniGrid();if(id==='marketing'){g.r(5,2,23,24,C.ink);g.r(6,3,21,21,C.wood);g.r(8,5,17,17,C.sage);g.line(9,7,23,7,C.mint);g.r(11,11,8,6,C.cream);g.oval(17,12,5,4,C.cream);g.r(19,13,2,2,C.sage);g.line(10,20,21,20,C.brass);g.line(7,25,4,30,C.wood,2);g.line(25,25,28,30,C.wood,2);}else if(id==='machine'){g.r(2,7,28,22,C.ink);g.r(3,8,26,18,'#617579');g.r(4,9,24,6,'#9daea9');g.r(5,10,11,3,C.glint);g.r(21,11,3,2,C.red);g.r(4,16,24,10,'#455452');g.r(5,17,4,2,C.brass);g.r(20,17,4,2,C.brass);g.r(9,18,2,4,C.ink);g.r(21,18,2,4,C.ink);g.r(7,22,8,4,C.cream);g.r(5,27,23,2,C.glass);g.r(8,4,6,4,C.cream);g.r(18,4,6,4,C.cream);g.line(5,8,25,8,C.white);}else if(id==='pass'){/* the pickup window: two steel shelves of plates under a brass bell */g.r(3,6,26,22,C.ink);g.r(4,7,24,20,'#8f9c9a');g.r(4,7,24,2,'#c9d2cf');g.r(3,16,26,2,C.ink);g.r(4,16,24,1,'#c9d2cf');g.oval(5,11,9,4,C.cream);g.oval(17,11,9,4,C.cream);g.oval(5,22,9,4,C.cream);g.oval(17,22,9,4,C.cream);g.r(7,10,5,2,C.toast);g.r(19,10,5,2,C.red);g.r(7,21,5,2,C.sage);g.r(19,21,5,2,C.toast);g.oval(21,1,7,5,C.brass);g.r(24,0,2,1,C.ink);g.r(5,28,3,3,C.ink);g.r(24,28,3,3,C.ink);}else{g.oval(1,7,30,14,C.ink);g.oval(2,6,28,12,C.toast);g.oval(4,7,24,8,C.cream);for(let y=8;y<15;y+=4)for(let x=5;x<28;x+=5)g.r(x,y,3,2,C.red);g.r(14,19,4,8,C.wood);g.line(14,26,8,30,C.wood,2);g.line(17,26,24,30,C.wood,2);g.r(13,4,5,7,C.glass);leaf(g,12,1);}c=miniatureCanvas(g,w,h,true);cache.set(key,c);return c;}

/** Source-grid compatibility for callers that inspect ITEM_ART. The geometry
 * is generated from the same master painter used by both runtime and export. */
export function miniatureSource(g:MiniGrid,w:number,h:number):{rows:string[];palette:Record<string,string>} {
 const symbols='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!$%&?@';const colors=new Map<string,string>();const palette:Record<string,string>={};const rows:string[]=[];
 for(let y=0;y<h;y++){let row='';for(let x=0;x<w;x++){const color=g.cells[Math.min(31,Math.floor((y+.5)/h*32))*32+Math.min(31,Math.floor((x+.5)/w*32))];if(!color){row+='.';continue;}let symbol=colors.get(color);if(!symbol){symbol=symbols[colors.size];if(!symbol)throw new Error('Miniature palette overflow');colors.set(color,symbol);palette[symbol]=color;}row+=symbol;}rows.push(row);}return{rows,palette};
}
