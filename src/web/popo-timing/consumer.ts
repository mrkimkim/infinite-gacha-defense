/** Review image adapter consumer. Display cursors/owner never enter the core state or hash. */
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
 let completed=new Set<number>(),seen=new Set<number>(),interpolatable=new Set<number>();
 let aftermath:Extract<CombatEvent,{type:'attackImpacted'}>[]=[],shownAlpha=0,eventFloor=-1;
 return{
  bind(next:object){owner=next;latest=null;completed=new Set();seen=new Set();interpolatable=new Set();aftermath=[];shownAlpha=0;eventFloor=-1;},
  present(from:object,o:Observation,events:readonly CombatEvent[],alpha:number){
   if(owner!==from||!Number.isFinite(alpha))return null;
   const order=latest?compareStamp(o,latest):1;
   // A late decode/RAF must discard this render, not repaint old HP or pending.
   if(order<0)return null;
   if(order>0){
    const previous=latest;interpolatable=new Set();eventFloor=previous?.tick??-1;
    for(const f of o.flights){const before=previous?.flights.find(p=>p.attackId===f.attackId);
     if(before&&before.positionTick===f.previousPositionTick
       &&before.position.x===f.previousPosition.x&&before.position.y===f.previousPosition.y)interpolatable.add(f.attackId);
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
   const flights=current.flights.filter(f=>!completed.has(f.attackId)).map(f=>({attackId:f.attackId,
    position:interpolatable.has(f.attackId)?{
     x:f.previousPosition.x+(f.position.x-f.previousPosition.x)*shownAlpha,
     y:f.previousPosition.y+(f.position.y-f.previousPosition.y)*shownAlpha,
    } as Point:{...f.position}}));
   return{phase:current.phase,tick:current.tick,hp:current.enemies.map(e=>[e.id,e.hp]),
    windups:current.windups.filter(w=>!completed.has(w.attackId)),flights,aftermath:[...aftermath]};
  },
 };
}
