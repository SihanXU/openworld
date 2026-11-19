// Hunter's yard props at the native pixel scale; local looks preserve fixture behavior.
import { Raster, type Palette } from './raster.ts'
import { writePng } from './png.ts'
const a=new Raster(208,96)
const p:Palette={ink:[58,43,32,255],dark:[83,57,39,255],wood:[120,82,49,255],warm:[148,103,62,255],lit:[178,133,82,255],cut:[192,153,101,255],ring:[143,101,62,255],rope:[173,148,102,255],iron:[97,101,94,255],metal:[166,166,145,255],hide:[160,137,98,255],bone:[218,205,163,255],meat:[130,64,47,255],red:[172,95,65,255],stone:[139,143,119,255],shade:[106,112,89,255],moss:[110,124,59,255],water:[107,141,143,255]}
function log(x:number,y:number,r:number){a.ellipse(x,y,r,r,'ink');a.ellipse(x,y,r-1,r-1,'cut');a.ellipse(x,y,r-2,r-2,'ring');a.ellipse(x,y,r-3,r-3,'cut');a.set(x,y,'wood')}
// A sloping roof shelters cut logs, framed by timber uprights.
a.rect(3,18,26,27,'ink');a.rect(5,20,22,23,'dark')
for(const [x,y] of [[9,37],[17,37],[25,37],[8,29],[16,29],[24,29],[12,22],[21,22]])log(x,y,4)
a.rect(2,17,3,30,'ink');a.rect(3,18,1,28,'warm');a.rect(28,18,3,29,'ink');a.rect(29,19,1,27,'lit')
a.rect(3,44,27,3,'wood');a.line(4,44,28,44,'lit')
a.poly([[0,15],[10,7],[32,14],[32,22],[22,24],[0,18]],'ink')
a.poly([[2,15],[10,9],[30,15],[30,20],[22,21],[2,17]],'warm')
for(let i=0;i<4;i++)a.line(5+i*6,13+i,4+i*6,18+i,'dark')
a.line(2,15,10,9,'lit');a.set(5,46,'moss');a.set(27,46,'moss')
// A working rack: rope lashings, hide, dressed game, antlers and a small water tub.
a.poly([[35,46],[37,12],[40,11],[39,46]],'ink');a.line(38,13,37,44,'warm')
a.poly([[74,46],[71,12],[74,11],[78,46]],'ink');a.line(73,14,76,44,'lit')
a.rect(35,9,41,5,'ink');a.rect(36,10,39,2,'wood');a.line(37,10,73,10,'lit')
for(const x of [38,72]){a.line(x-2,8,x+2,14,'rope');a.line(x-1,8,x+3,14,'rope')}
for(const x of [46,57,66])a.line(x,13,x,19,'iron')
a.poly([[44,18],[47,18],[49,22],[51,24],[49,26],[50,38],[47,41],[46,39],[43,41],[42,36],[43,27],[40,25],[43,22]],'ink')
a.poly([[44,20],[47,20],[48,25],[47,28],[48,36],[46,38],[44,37],[44,26],[42,25]],'hide');a.line(45,23,45,34,'lit')
a.poly([[55,19],[58,19],[59,23],[62,30],[60,37],[58,39],[57,36],[54,38],[53,32],[55,25]],'ink')
a.poly([[56,20],[58,20],[57,25],[60,31],[59,36],[57,34],[55,36],[55,30]],'meat');a.line(57,24,57,34,'bone')
for(let y=27;y<34;y+=3){a.line(55,y,57,y+1,'red');a.line(58,y,60,y+1,'bone')}
a.line(66,24,66,20,'bone');a.line(66,24,63,22,'bone');a.line(63,22,62,18,'bone');a.line(66,24,70,21,'bone');a.line(70,21,70,17,'bone');a.line(66,24,67,29,'bone')
a.rect(65,38,11,8,'ink');a.rect(66,39,9,6,'wood');a.ellipse(70,38,6,2,'iron');a.ellipse(70,38,4,1,'water');a.line(66,43,74,43,'iron')
// Chopping block, radial cuts, bark and an axe left in the split.
a.ellipse(105,44,16,3,'dark');a.rect(90,28,29,15,'ink');a.rect(92,29,25,13,'wood')
for(let x=94;x<117;x+=4)a.line(x,31,x-1,41,'dark')
a.ellipse(104,28,15,7,'ink');a.ellipse(104,27,13,6,'cut');a.ellipse(104,27,9,4,'ring');a.ellipse(104,27,7,3,'cut')
a.line(93,27,99,27,'dark');a.line(108,29,115,30,'ring');a.line(103,23,105,26,'dark')
a.line(102,23,119,12,'ink',4);a.line(103,22,118,13,'warm',2)
a.poly([[100,17],[105,17],[105,23],[108,26],[100,28]],'ink');a.poly([[101,18],[104,18],[104,23],[106,25],[101,26]],'iron');a.line(101,26,106,25,'metal')
a.set(91,43,'moss');a.set(116,42,'moss')
// Door-side logs, restrained rope bands and distinct cut ends.
for(const [x,y] of [[136,24],[145,24],[153,24],[140,16],[149,16]]){a.rect(x,y-3,5,7,'wood');log(x,y,4)}
a.line(143,11,147,27,'rope',2);a.line(155,17,157,27,'rope')
// Ground-only pieces: a flat glove stone, split wood, ribs and a broken rail.
a.ellipse(14,58,12,5,'shade');a.poly([[3,58],[7,52],[21,51],[27,56],[24,61],[6,62]],'stone');a.line(8,53,20,52,'metal')
for(const [x,y] of [[85,56],[112,54],[91,61],[122,61]]){a.poly([[x,y],[x+7,y-3],[x+11,y],[x+4,y+3]],'dark');a.line(x+1,y,x+7,y-2,'cut');a.line(x+4,y+2,x+10,y,'wood')}
a.poly([[34,55],[68,54],[76,62],[38,63]],'hide');a.line(35,56,67,55,'dark')
a.line(7,75,23,75,'dark');for(let i=0;i<4;i++){a.line(9+i*3,74,10+i*3,69,'bone');a.line(10+i*3,69,13+i*3,71,'bone')}
a.poly([[35,69],[59,78],[62,76],[39,67]],'dark');a.line(38,68,60,76,'warm');a.line(38,69,57,76,'lit');a.set(42,70,'iron')
// A staggered bundle: long bark-covered shafts behind large readable cut faces.
for(const [x,y] of [[168,10],[179,13],[168,23],[180,25]]) {
 a.poly([[x,y-5],[x+19,y-6],[x+24,y-2],[x+24,y+3],[x+3,y+5]],'ink')
 a.poly([[x+3,y-4],[x+18,y-5],[x+22,y-2],[x+22,y+2],[x+4,y+4]],'wood')
 a.line(x+6,y-3,x+19,y-3,'lit');a.line(x+7,y+2,x+21,y+1,'dark')
 log(x,y,5);a.line(x-2,y+1,x,y+2,'ring');a.set(x+1,y-2,'lit')
}
a.line(190,6,194,14,'dark',3);a.line(194,14,197,27,'dark',3)
a.line(190,6,194,14,'rope');a.line(194,14,197,27,'rope');a.line(192,15,196,16,'rope')
// A single pickup picture shows a leather glove, never a ground decal.
// The cuff, four separated fingers and opposed thumb remain distinct at gameplay zoom.
a.poly([[172,53],[168,50],[168,45],[165,43],[166,40],[169,40],[171,44],
 [172,36],[174,35],[176,36],[176,41],[177,34],[180,34],[180,41],
 [181,36],[184,36],[184,43],[185,39],[188,40],[187,48],[184,53],[184,58],[172,58]],'ink')
a.poly([[173,52],[170,49],[170,44],[167,42],[168,42],[173,47],
 [174,37],[175,37],[175,45],[178,44],[178,36],[179,36],[179,45],
 [182,44],[182,38],[183,38],[183,46],[185,44],[186,42],[185,48],[182,52]],'warm')
a.line(173,47,174,50,'lit');a.line(175,47,181,47,'lit')
a.rect(173,53,10,4,'wood');a.line(174,53,181,53,'cut')
a.line(174,56,181,56,'dark');a.set(180,54,'rope')
// Finish the fingers, then repack a smaller horizontal glove on the stone.
for(const [x,y,h] of [[174,37,9],[178,36,10],[182,38,9],[185,42,6]]) {
 a.rect(x,y,1,h,'warm');a.set(x,y,'lit')
}
const glove=Array.from({length:1024},(_,i)=>a.get(160+i%32,32+Math.floor(i/32)))
for(let y=32;y<64;y++)for(let x=160;x<192;x++)a.set(x,y,null)
for(let y=0;y<24;y++)for(let x=0;x<24;x++)
 a.set(164+x,36+y,glove[(31-Math.floor(x*32/24))*32+Math.floor(y*32/24)])
const rgba=new Uint8Array(a.w*a.h*4);a.px.forEach((k,i)=>{if(k)rgba.set(p[k],i*4)})
writePng('Fixtures/HunterYard.png',a.w,a.h,rgba)
