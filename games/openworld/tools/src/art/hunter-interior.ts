// Local hunter-cabin furniture; native pixels and existing fixture interactions.
import { Raster, type Palette } from './raster.ts'
import { writePng } from './png.ts'
const r=new Raster(64,48)
const p:Palette={edge:[52,39,31,255],dark:[82,56,39,255],wood:[117,78,48,255],warm:[145,100,61,255],light:[179,133,82,255],grain:[103,68,43,255],iron:[102,103,88,255],cloth:[153,137,98,255],cup:[173,167,133,255],inside:[80,79,62,255],food:[170,131,76,255]}
// Worn planks, framed edges, thick legs and a visible lower brace.
r.rect(5,27,4,10,'edge');r.rect(23,27,4,10,'edge')
r.rect(6,28,2,8,'wood');r.rect(24,28,2,8,'warm')
r.rect(8,31,16,3,'dark');r.line(9,31,23,31,'wood')
r.rect(3,14,26,15,'edge');r.rect(4,15,24,12,'wood')
r.rect(4,15,24,3,'light');r.rect(5,18,22,7,'warm')
r.line(5,19,27,19,'grain');r.line(5,23,27,23,'grain')
r.line(7,17,14,17,'warm');r.line(18,21,24,21,'light');r.line(8,25,15,25,'grain')
r.rect(4,27,24,2,'dark');r.line(5,26,27,26,'light')
for(const x of [5,26])for(const y of [16,25])r.set(x,y,'iron')
r.line(21,15,19,18,'grain');r.line(6,24,8,24,'light')
// A plain cup and shallow bowl: visual evidence of daily meals, no invented loot.
r.ellipse(13,21,4,2,'edge');r.ellipse(13,20,3,2,'cup');r.ellipse(13,20,2,1,'inside')
r.rect(21,13,4,6,'edge');r.rect(22,14,2,4,'cup');r.ellipse(23,13,2,1,'inside');r.line(25,14,26,15,'cup');r.set(26,16,'cup')
// Side-facing chair: high back to the west, a worn seat towards the table.
r.poly([[35,9],[39,8],[41,30],[37,32]],'edge');r.line(37,10,39,29,'wood')
r.rect(38,25,4,12,'edge');r.rect(51,25,4,12,'edge')
r.line(39,27,39,35,'warm');r.line(52,27,52,35,'wood')
r.poly([[38,21],[52,21],[56,25],[54,28],[39,28]],'edge')
r.poly([[40,22],[51,22],[54,25],[40,25]],'warm');r.line(40,22,50,22,'light')
r.line(40,24,51,24,'grain');r.line(40,26,53,26,'wood')
r.rect(37,11,4,4,'warm');r.line(38,12,40,12,'light')
r.line(40,32,51,32,'dark');r.set(39,27,'iron');r.set(52,27,'iron')
// A slightly smaller chair keeps its feet anchor and leaves more air beside the table.
const chair=Array.from({length:32*48},(_,i)=>r.get(32+i%32,Math.floor(i/32)))
for(let y=0;y<48;y++)for(let x=32;x<64;x++)r.set(x,y,null)
for(let y=0;y<42;y++)for(let x=0;x<28;x++)
 r.set(35+x,5+y,chair[Math.floor(y*48/42)*32+Math.floor(x*32/28)])
const rgba=new Uint8Array(r.w*r.h*4);r.px.forEach((k,i)=>{if(k)rgba.set(p[k],i*4)})
writePng('Fixtures/HunterInterior.png',r.w,r.h,rgba)
