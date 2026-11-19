// Woundstone's broken court, using one granite material and worn stone courses.
import type { Model } from '../oblique.ts'
import { archNS, box, drum, type Solid } from '../shapes.ts'
import { ivy, moss } from '../ornaments.ts'

function wall(name: string, heights: number[], vertical = false): Model {
 const count=heights.length
 const solids: Solid[]=heights.map((height,i)=>vertical
  ? box(4,i*16,0,13,(i+1)*16,height,'graniteRough')
  : box(i*16,4,0,(i+1)*16,14,height,'graniteRough'))
 // A few fallen blocks make the transition from standing wall to rubble.
 const length=count*16
 solids.push(vertical ? box(1,length-10,0,8,length,5,'graniteRough')
  : box(length-10,1,0,length,8,5,'graniteRough'))
 return {name,footprint:vertical?Array(count).fill('#'):['#'.repeat(count)],solids,
  ornaments:[moss(vertical?9:18,6,45).at(4,vertical?length-2:14,0),
   ivy(9,vertical?23:30,72).at(vertical?4:12,vertical?length-2:14,0)]}
}

function column(name: string, height: number, broken: boolean): Model {
 const solids: Solid[]=[box(1,1,0,15,15,5,'graniteRough')]
 solids.push({b:[3,3,5,13,13,height],mat:'graniteRough',
  inside:(x,y,z)=>Math.hypot(x-8,y-8)<=5&&z<=height-(broken?Math.max(0,x-6)*0.8+(y>8?3:0):0)})
 if(!broken)solids.push(box(1,1,height-3,15,15,height+1,'graniteRough'))
 return {name,footprint:['#'],solids,ornaments:[moss(10,6,19).at(3,14,0,true)]}
}

function tower(): Model {
 const outer=drum(24,24,21,0,63,'graniteRough')
 outer.inside=(x,y,z)=>Math.hypot(x-24,y-24)<=21&&
  z<=52+(Math.floor((x-3)/9)%3)*4
 return {name:'foot_court_tower',footprint:['###','###','###'],solids:[outer],
  voids:[drum(24,24,15,43,70,'graniteRough'),archNS(24,28,48,23,9,18,'round')],
  ornaments:[ivy(14,40,11).at(10,44,0,true),moss(25,7,30).at(10,44,0,true)]}
}

export const FOOT_RUINS: Record<string,()=>Model> = {
 foot_court_north_west:()=>wall('foot_court_north_west',[26,43,33]),
 foot_court_north_east:()=>wall('foot_court_north_east',[22,34,27]),
 foot_court_west:()=>wall('foot_court_west',[30,35,22,13],true),
 foot_court_east:()=>wall('foot_court_east',[21,28,14],true),
 foot_court_south_west:()=>wall('foot_court_south_west',[16,24,10]),
 foot_court_south_east:()=>wall('foot_court_south_east',[12,20,27]),
 foot_court_column_tall:()=>column('foot_court_column_tall',45,false),
 foot_court_column_broken:()=>column('foot_court_column_broken',31,true),
 foot_court_column_low:()=>column('foot_court_column_low',18,true),
 foot_court_tower:tower,
}