/** Test consumer only. No art/production UI: reference checks for the agreed boundary. */
import type {Observation,CombatEvent,Point} from '../../src/core-timing/types.ts';
export function createConsumer(){
 let owner:object|null=null,seen=new Set<number>(),aftermath:Extract<CombatEvent,{type:'attackImpacted'}>[]=[];
 return{
  bind(next:object){owner=next;seen=new Set();aftermath=[];},
  present(from:object,o:Observation,events:readonly CombatEvent[],alpha:number){
   if(owner!==from)return null;
   for(const e of events)if(e.type==='attackImpacted'&&!seen.has(e.attackId)){seen.add(e.attackId);aftermath.push(e);}
   aftermath=aftermath.slice(-32);
   const completed=new Set(events.filter(e=>e.type==='attackImpacted'||e.type==='attackCancelled').map(e=>e.attackId));
   // No event-launch replay. Only currently pending flight can be interpolated.
   const flights=o.flights.filter(f=>!completed.has(f.attackId)).map(f=>({attackId:f.attackId,position:{x:f.previousPosition.x+(f.position.x-f.previousPosition.x)*alpha,y:f.previousPosition.y+(f.position.y-f.previousPosition.y)*alpha} as Point}));
   return{phase:o.phase,tick:o.tick,hp:o.enemies.map(e=>[e.id,e.hp]),windups:o.windups,flights,aftermath:[...aftermath]};
  },
 };
}
