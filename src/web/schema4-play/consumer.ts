/** Review image adapter consumer. Display cursors/owner never enter the core state or hash. */
import {nextFlightPosition} from './projection.ts';
import type {Observation,CombatEvent,Point} from '../../core-timing/types.ts';
const phaseOrder={preparation:0,combat:1,result:2} as const;
function compareStamp(a:Observation,b:Observation){
 for(const [x,y] of [[a.tick,b.tick],[a.wave,b.wave],[phaseOrder[a.phase],phaseOrder[b.phase]],[a.waveTick,b.waveTick]]){
  if(x!==y)return x<y?-1:1;
 }
 return 0;
}
export function createConsumer(){
 let owner:object|null=null,latest:Observation|null=null;
 let completed=new Set<number>(),seen=new Set<number>(),forecast=new Map<number,number>();
 let aftermath:Extract<CombatEvent,{type:'attackImpacted'}>[]=[],shownAlpha=0,eventFloor=-1;
 return{
  bind(next:object){owner=next;latest=null;completed=new Set();seen=new Set();forecast=new Map();aftermath=[];shownAlpha=0;eventFloor=-1;},
  present(from:object,o:Observation,events:readonly CombatEvent[],alpha:number){
   if(owner!==from||!Number.isFinite(alpha))return null;
   const order=latest?compareStamp(o,latest):1;
   // A late decode/RAF must discard this render, not repaint old HP or pending.
   if(order<0)return null;
   if(order>0){
    const previous=latest;forecast=new Map();eventFloor=previous?.tick??-1;
    const contiguous=previous&&previous.tick+1===o.tick&&previous.wave===o.wave&&previous.waveTick+1===o.waveTick&&previous.phase==='combat'&&o.phase==='combat';
    for(const f of o.flights){
     if(!contiguous||f.positionTick!==o.tick)continue;
     const before=previous.flights.find(p=>p.attackId===f.attackId);
     if(before&&before.startTick===f.startTick&&before.sourcePosition.x===f.sourcePosition.x&&before.sourcePosition.y===f.sourcePosition.y&&before.targetId===f.targetId&&before.unitId===f.unitId&&before.releaseTick===f.releaseTick&&before.arrivalTick===f.arrivalTick
       &&before.positionTick===f.previousPositionTick&&before.position.x===f.previousPosition.x&&before.position.y===f.previousPosition.y){forecast.set(f.attackId,0);continue;}
     // First release presentation starts at current even with a high incoming fraction.
     if(f.releaseTick===o.tick&&f.position.x===f.sourcePosition.x&&f.position.y===f.sourcePosition.y&&previous.windups.some(w=>w.attackId===f.attackId&&w.startTick===f.startTick&&w.releaseTick===f.releaseTick&&w.sourcePosition.x===f.sourcePosition.x&&w.sourcePosition.y===f.sourcePosition.y&&w.targetId===f.targetId&&w.unitId===f.unitId))forecast.set(f.attackId,Math.min(1,Math.max(0,alpha)));
    }
    latest=o;shownAlpha=0;
   }
   // Equal stamps use the accepted snapshot. A callback cannot replace it with older payload.
   const current=latest!;shownAlpha=Math.max(shownAlpha,Math.min(1,Math.max(0,alpha)));
   for(const e of events){
    if(e.tick<eventFloor||e.tick>current.tick)continue;
    if(e.type==='attackImpacted'||e.type==='attackCancelled')completed.add(e.attackId);
    if(e.type==='attackImpacted'&&!seen.has(e.attackId)){seen.add(e.attackId);aftermath.push(e);}
   }
   aftermath=aftermath.slice(-32);
   const flights=current.flights.filter(f=>!completed.has(f.attackId)).map(f=>{
    const target=current.enemies.find(e=>e.id===f.targetId),origin=forecast.get(f.attackId);
    const fraction=target&&origin!==undefined&&origin<1?Math.max(0,(shownAlpha-origin)/(1-origin)):0;
    const next=target&&origin!==undefined?nextFlightPosition(f,target.position,current.tick):f.position;
    return{attackId:f.attackId,fraction,currentPosition:f.position,nextPosition:next,
     position:{x:f.position.x+(next.x-f.position.x)*fraction,y:f.position.y+(next.y-f.position.y)*fraction} as Point};
   });
   return{observation:current,phase:current.phase,tick:current.tick,hp:current.enemies.map(e=>[e.id,e.hp]),
    windups:current.windups.filter(w=>!completed.has(w.attackId)),flights,aftermath:[...aftermath]};
  },
 };
}
