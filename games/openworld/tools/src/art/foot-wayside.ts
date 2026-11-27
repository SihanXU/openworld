// Local Woundstone wayside fixtures, drawn at the native pixel scale.
import { Raster, type Palette } from './raster.ts'
import { writePng } from './png.ts'
const r=new Raster(96,64)
const p:Palette={edge:[65,61,50,255],stone:[153,151,129,255],light:[200,193,164,255],side:[111,113,99,255],moss:[112,127,62,255],wood:[126,88,56,255],grain:[159,117,74,255],darkwood:[84,59,42,255],gold:[188,151,79,255],ink:[66,53,39,255]}
// An old hooded pilgrim in a carved niche: readable silhouette, worn shoulders, mossy foot.
r.rect(4,56,24,5,'edge');r.rect(5,56,22,2,'light');r.rect(7,58,18,2,'stone')
r.poly([[6,55],[6,25],[10,18],[16,15],[23,19],[26,26],[26,55]],'edge')
r.poly([[8,54],[8,26],[12,20],[16,18],[22,22],[24,27],[24,54]],'light')
r.poly([[10,53],[10,28],[13,23],[17,21],[21,26],[22,53]],'side')
r.poly([[12,48],[12,37],[14,32],[13,28],[16,25],[19,28],[19,33],[21,39],[21,48]],'stone')
r.rect(15,29,3,4,'light');r.line(12,39,15,36,'light');r.line(15,36,20,39,'light')
r.line(17,39,17,45,'gold');r.line(15,41,19,41,'gold')
r.rect(10,49,13,4,'stone');r.line(10,49,22,49,'light');r.line(8,24,8,48,'light')
r.line(23,22,22,26,'edge');r.rect(5,54,4,3,'moss');r.rect(23,55,3,3,'moss')
// A carved wayside cross, with bevels, a stone collar and an aged two-step base.
r.rect(34,57,26,5,'edge');r.rect(35,57,24,2,'light');r.rect(37,52,20,5,'stone')
r.rect(39,50,16,3,'light');r.rect(44,18,7,33,'edge');r.rect(36,27,23,7,'edge')
r.rect(45,19,4,31,'stone');r.rect(37,28,21,4,'stone')
r.line(45,19,45,49,'light');r.line(37,28,57,28,'light');r.line(49,34,49,48,'side')
r.rect(43,26,9,9,'side');r.rect(44,27,7,7,'stone');r.rect(46,29,3,3,'gold')
r.line(53,30,56,31,'side');r.rect(37,56,3,3,'moss');r.rect(55,58,3,2,'moss')
// A small real timber sign, framed and nailed, keeping the original direction text in its interaction.
r.rect(77,46,4,16,'darkwood');r.rect(78,47,2,14,'wood')
r.poly([[66,36],[91,36],[94,39],[91,49],[66,49]],'darkwood')
r.rect(67,37,24,10,'wood');r.line(68,37,90,37,'grain');r.line(68,46,90,46,'grain')
r.line(70,40,80,40,'light');r.line(70,43,79,43,'grain');r.line(85,39,85,44,'light')
r.line(83,42,85,44,'light');r.line(85,44,87,42,'light')
r.set(68,39,'ink');r.set(90,39,'ink');r.set(68,45,'ink');r.set(90,45,'ink')
r.set(76,61,'moss');r.set(81,61,'moss')
const bytes=new Uint8Array(r.w*r.h*4);r.px.forEach((k,i)=>{if(k)bytes.set(p[k],i*4)})
writePng('Fixtures/FootWayside.png',r.w,r.h,bytes)
