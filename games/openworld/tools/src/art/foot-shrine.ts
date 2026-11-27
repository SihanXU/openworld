// Woundstone's shrine and Pell's ground drawing, on the native 16-pixel grid.
import { Raster, type Palette } from './raster.ts'
import { writePng } from './png.ts'

const palette: Palette = {
  ink: [49, 43, 39, 255], edge: [76, 75, 66, 255], side: [105, 106, 95, 255],
  stone: [152, 151, 132, 255], light: [199, 193, 163, 255], shadow: [80, 86, 72, 150],
  moss: [108, 122, 58, 255], grass: [146, 150, 73, 255], chalk: [239, 226, 184, 255],
  ash: [57, 51, 51, 255], wound: [107, 76, 64, 255], cloth: [207, 187, 139, 255],
  gold: [155, 116, 63, 255], faded: [148, 94, 65, 255],
  paving: [170, 158, 124, 255], pavingLight: [190, 177, 140, 255], mortar: [136, 132, 103, 255],
}
const art = new Raster(144, 64)
// The squat stone has a broad lit face, a chipped shoulder and a deep first wound.
art.ellipse(16,59,15,3,'shadow')
art.rect(1,54,30,6,'edge'); art.rect(2,54,28,3,'light')
art.rect(4,57,24,2,'stone')
art.poly([[4,23],[9,17],[21,16],[28,22],[28,52],[4,52]],'edge')
art.poly([[22,19],[27,23],[27,51],[23,53]],'side')
art.poly([[5,24],[10,19],[20,18],[23,22],[23,53],[5,53]],'stone')
art.line(6,25,10,20,'light'); art.line(10,19,19,18,'light')
art.line(5,27,5,49,'light')
for(let i=0;i<5;i++){
 const y=26+i*5
 art.line(10,y+3,20,y,i===0?'ash':'edge',i===0?3:1)
 if(i>0)art.line(10,y+4,19,y+1,'wound')
}
art.line(17,18,15,21,'ash'); art.line(15,21,17,24,'ash')
art.rect(3,50,4,4,'moss'); art.rect(23,52,4,3,'moss')
art.set(8,53,'grass')
// A child has drawn a hooded person touching the five-mark stone.
art.line(34,39,34,57,'chalk'); art.line(34,39,38,35,'chalk')
art.line(38,35,43,38,'chalk'); art.line(43,38,44,57,'chalk')
art.line(34,57,44,57,'chalk')
for(let i=0;i<5;i++)art.line(37,40+i*3,40,39+i*3,i===0?'ash':'chalk')
art.line(47,43,49,40,'chalk'); art.line(49,40,52,43,'chalk')
art.line(47,43,52,43,'chalk'); art.line(48,44,46,53,'chalk')
art.line(51,44,54,53,'chalk'); art.line(46,53,54,53,'chalk')
art.line(47,46,43,44,'chalk'); art.line(52,46,56,49,'chalk')
art.line(48,54,47,57,'chalk'); art.line(52,54,53,57,'chalk')
art.rect(55,50,4,4,'chalk'); art.rect(56,51,2,2,'side')
// Two restrained faded cloth banners reuse this frame.
art.line(65,29,77,29,'edge')
art.poly([[66,30],[76,30],[76,53],[71,57],[66,53]],'edge')
art.poly([[67,31],[75,31],[75,52],[71,55],[67,52]],'cloth')
art.line(71,36,71,46,'faded'); art.line(68,40,74,40,'faded')
art.set(69,38,'gold'); art.set(73,44,'gold')

// Repack the chalk drawing at 75% on the native grid, keeping its ground anchor.
const drawing = Array.from({length:32*32},(_,i)=>art.get(32+i%32,32+Math.floor(i/32)))
for(let y=32;y<64;y++)for(let x=32;x<64;x++)art.set(x,y,null)
for(let y=0;y<24;y++)for(let x=0;x<24;x++)
  art.set(36+x,40+y,drawing[Math.floor(y*32/24)*32+Math.floor(x*32/24)])
// Low courtyard flowers keep every original harvest cell readable without tall blooms.
for (let variant=0;variant<3;variant++) {
 const x=80+variant*16;
 art.line(x+8,14,x+6,9,'moss'); art.line(x+7,13,x+11,11,'moss');
 art.line(x+4,14,x+11,14,'grass');
 for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])art.set(x+6+dx,8+dy,'light');
 art.set(x+6,8,'gold');
 if(variant!==1){art.set(x+11,10,'chalk');art.set(x+10,11,'gold')}
}
// A one-pixel charcoal edge keeps chalk legible over light paving.
const chalkPixels = art.px.flatMap((key, i) => key === 'chalk' ? [[i % art.w, Math.floor(i / art.w)]] : [])
for (const [x, y] of chalkPixels) art.under(x + 1, y + 1, 'side')
const rgba = new Uint8Array(art.w * art.h * 4)
art.px.forEach((key,i) => { if (key) rgba.set(palette[key], i * 4) })
writePng('Fixtures/FootShrine.png', art.w, art.h, rgba)
// One connected courtyard picture. Its stone joints span the map's tile boundaries.
const court = new Raster(224,160)
const pavingPalette: Palette = {
 earth:[142,133,99,255], seam:[134,129,99,255],
 slab:[182,166,129,255], warm:[188,172,134,255], cool:[174,163,129,255],
 rim:[201,187,149,255], moss:[126,139,65,255], grass:[150,155,73,255],
 petal:[235,229,189,255], yellow:[206,173,75,255], stalk:[104,122,53,255],
}
court.poly([[32,6],[83,3],[116,9],[163,2],[198,8],[214,29],[207,44],
 [222,60],[215,94],[219,118],[201,140],[171,151],[125,155],[92,149],
 [65,158],[25,146],[14,126],[19,110],[4,92],[12,64],[6,44],[25,32]],'earth')
const surface = court.px.map(key=>key!==null)
const widths=[37,29,46,34,42,31]
for(let row=0;row<8;row++){
 const top=row*22-5
 let left=-32+(row%3)*13
 let column=0
 while(left<court.w){
  const width=widths[(row*2+column)%widths.length]
  const bottom=top+18+(column%3)
  const paint=new Raster(court.w,court.h)
  paint.poly([[left+2,top+1],[left+width-4,top],[left+width-1,top+3],
   [left+width-2,bottom-2],[left+width-5,bottom],[left+3,bottom-1],[left,bottom-4]],
   ['slab','warm','cool'][(row+column*2)%3])
  paint.line(left+3,top+1,left+width-5,top+1,'rim')
  if((row*3+column)%5===0){
   paint.line(left+width-5,top+1,left+width-9,top+7,'seam')
   paint.line(left+width-9,top+7,left+width-7,top+10,'seam')
  }
  for(let i=0;i<paint.px.length;i++)if(surface[i]&&paint.px[i])court.px[i]=paint.px[i]
  left+=width; column++
 }
}
// Weathered holes enter from the perimeter, leaving the heart of the court intact.
for(const [x,y,rx,ry] of [[17,36,10,8],[208,47,13,9],[11,94,16,12],
 [214,112,16,10],[34,142,13,8],[179,150,18,7]] as const){
 for(let py=y-ry;py<=y+ry;py++)for(let px=x-rx;px<=x+rx;px++){
  const d=((px-x)/rx)**2+((py-y)/ry)**2
  if(d<0.65)court.set(px,py,null)
  else if(d<1&&court.get(px,py))court.set(px,py,(px+py)%3?'moss':'grass')
 }
}
// Sparse low plants collect beside walls and the exit, with two tufts inside.
for(const [x,y,flower] of [[28,31,1],[33,35,1],[200,56,1],[196,62,0],
 [19,105,0],[53,149,1],[164,149,1],[169,145,1],[57,87,0],[179,108,0]] as const){
 court.line(x,y,x-2,y-5,'stalk'); court.line(x,y,x+2,y-4,'stalk')
 court.line(x-3,y,x+4,y,'grass')
 if(flower){
  court.set(x-2,y-6,'yellow')
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])court.set(x-2+dx,y-6+dy,'petal')
  court.set(x-2,y-6,'yellow')
 }
}
const courtRgba=new Uint8Array(court.w*court.h*4)
court.px.forEach((key,i)=>{if(key)courtRgba.set(pavingPalette[key],i*4)})
writePng('Fixtures/FootCourtyard.png',court.w,court.h,courtRgba)
