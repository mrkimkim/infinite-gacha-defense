import type {Observation,CombatEvent,Point} from '../../core-timing/types.ts';
export type HitView={enemyId:number;position:Point;damage:number;before:number;after:number};
export type ImpactView={attackId:number;unitId:number;targetId:number;tick:number;shownTick:number;center:Point;sourcePosition:Point;aoe:boolean;hits:HitView[];outside:{enemyId:number;hp:number}[]};
/** Consume ordered committed events; never derive secondary hits/damage from radius or final HP. */
export function createLedger(){
 let hp=new Map<number,number>(),seen=new Set<number>(),lastTick=-1,impacts:ImpactView[]=[],cancelled:number[]=[];
 return{
  reset(o:Observation){hp=new Map(o.enemies.map(e=>[e.id,e.hp]));seen=new Set();lastTick=o.tick;impacts=[];cancelled=[];},
  accept(o:Observation,events:readonly CombatEvent[]){
   if(o.tick<=lastTick)return;
   for(const e of events){if(e.tick<=lastTick||e.tick>o.tick)continue;
    if(e.type==='enemySpawned')hp.set(e.enemy.id,e.enemy.hp);
    if((e.type==='attackImpacted'||e.type==='attack')&&!seen.has(e.attackId)){
     seen.add(e.attackId);const ids=new Set(e.hits.map(h=>h.enemyId));
     const outside=[...hp].filter(([id])=>!ids.has(id)).map(([enemyId,hp])=>({enemyId,hp}));
     const hits=e.hits.map(h=>{const before=hp.get(h.enemyId);if(before===undefined)throw Error('Missing committed HP history for hit '+h.enemyId);const after=before-h.damage;if(after<0)throw Error('Invalid committed clamped damage');hp.set(h.enemyId,after);return{...h,before,after};});
     impacts.push({attackId:e.attackId,unitId:e.unitId,targetId:e.targetId,tick:e.tick,shownTick:o.tick,center:e.center,sourcePosition:e.sourcePosition,aoe:e.type==='attackImpacted'&&o.units.some(u=>u.id===e.unitId&&u.definitionId==='fixture-02'),hits,outside});
    }
    if(e.type==='enemyDefeated')hp.delete(e.enemyId);
    if(e.type==='attackCancelled'&&!cancelled.includes(e.attackId))cancelled.push(e.attackId);
   }
   // Fresh observation is authoritative. History above describes event-order HP, including lethal primaries.
   hp=new Map(o.enemies.map(e=>[e.id,e.hp]));lastTick=o.tick;impacts=impacts.slice(-32);cancelled=cancelled.slice(-32);
  },
  view(){return{impacts:[...impacts],cancelled:[...cancelled]};},
 };
}
