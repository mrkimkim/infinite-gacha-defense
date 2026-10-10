import type {Observation,CombatEvent,Point} from '../../core-timing/types.ts';
import {createConsumer} from './consumer.ts';import {createLedger} from './ledger.ts';
import {point,boardPoint,supported,anchored,guard} from './projection.ts';
import {surfaceContact,contactVisible,type IncomingSample,type SurfaceContact} from './contact.ts';
export function createPresentation(){
 const consumer=createConsumer(),ledger=createLedger();let owner:object|null=null,incoming=new Map<number,IncomingSample>(),surfaces=new Map<string,SurfaceContact|null>();
 function bind(token:object,o:Observation){owner=token;consumer.bind(token);ledger.reset(o);incoming=new Map();surfaces=new Map();}
 return{bind,clear:bind,present(token:object,o:Observation,events:readonly CombatEvent[],alpha:number){
  if(token!==owner)return null;const v=consumer.present(token,o,events,alpha);if(!v)return null;o=v.observation;ledger.accept(o,events);
  const history=ledger.view(),recent=history.impacts.filter(a=>o.tick-a.shownTick<=8),hits=recent.flatMap(a=>a.hits.map(h=>({...h,attackId:a.attackId,unitId:a.unitId,shownTick:a.shownTick,aoe:a.aoe})));
  const latestHit=new Map(hits.map(h=>[h.enemyId,h]));const enemies=o.enemies.map(e=>{const h=latestHit.get(e.id);return{id:e.id,position:h&&o.tick===h.shownTick?point(h.position):point(e.position),hp:e.hp,maxHp:e.maxHp,dead:false,hit:!!h&&o.tick-h.shownTick<=2};});
  for(const h of latestHit.values())if(h.after===0&&!o.enemies.some(e=>e.id===h.enemyId))enemies.push({id:h.enemyId,position:point(h.position),hp:0,maxHp:h.before,dead:true,hit:o.tick-h.shownTick<=2});
  const units=o.units.filter(u=>u.location.kind==='board').map(u=>{const l=u.location as {col:number;row:number},source={x:500+1000*l.col,y:500+1000*l.row},pending=[...v.windups,...o.flights].filter(f=>f.unitId===u.id).sort((a,b)=>b.attackId-a.attackId)[0],target=pending?o.enemies.find(e=>e.id===pending.targetId):null,art=!!target&&supported(u.definitionId,source,target.position);
   const pose=art&&pending?(pending.kind==='windup'?'preparation':o.tick===pending.releaseTick?'release':'recoil'):recent.some(a=>a.unitId===u.id)?'recovery':'idle';
   return{id:u.id,definitionId:u.definitionId,star:u.star,position:boardPoint(l.col,l.row),pose,unsupported:!!pending&&!art};});
  const contacts=recent.flatMap(a=>a.hits.map(h=>{const unit=o.units.find(u=>u.id===a.unitId),key=a.attackId+':'+h.enemyId;
   if(!surfaces.has(key)&&unit?.definitionId==='fixture-01'&&supported(unit.definitionId,a.sourcePosition,h.position))surfaces.set(key,surfaceContact(point(h.position),point(a.sourcePosition),h.enemyId,a.tick,incoming.get(a.attackId)));
   const surface=surfaces.get(key);return{attackId:a.attackId,targetId:h.enemyId,unitId:a.unitId,popoSurface:unit?.definitionId==='fixture-01'&&supported(unit.definitionId,a.sourcePosition,h.position),position:point(h.position),aoe:a.aoe,shownTick:a.shownTick,surface:surface&&o.tick===a.shownTick&&contactVisible(surface,enemies.map(e=>e.position))?surface:null};}));
  const flights=v.flights.flatMap(f=>{const pending=o.flights.find(p=>p.attackId===f.attackId)!,unit=o.units.find(u=>u.id===pending.unitId),target=o.enemies.find(e=>e.id===pending.targetId);if(!unit||!target)return[];
   const art=supported(unit.definitionId,pending.sourcePosition,target.position),start=art?anchored(f.currentPosition,pending,o.tick,0,unit.definitionId,target.position):point(f.currentPosition),end=art?anchored(f.position,pending,o.tick,f.fraction,unit.definitionId,target.position):point(f.position),position=guard(start,end,enemies.map(e=>e.position),art?27:16);if(!position)return[];
   incoming.set(f.attackId,{position,targetId:pending.targetId,tick:o.tick});return[{attackId:f.attackId,targetId:pending.targetId,unitId:unit.id,definitionId:unit.definitionId,position,target:point(target.position),art}];});
  for(const id of incoming.keys())if(!o.flights.some(f=>f.attackId===id))incoming.delete(id);
  return{tick:o.tick,phase:o.phase,units,enemies,flights,contacts,hits,impacts:recent,history,cancelled:history.cancelled};
 }};
}
export type BattleView=NonNullable<ReturnType<ReturnType<typeof createPresentation>['present']>>;
export type Images=Record<string,HTMLImageElement>;
export const name=(id:string)=>id==='fixture-01'?'포포 후보 (01)':id==='fixture-02'?'누리 후보 (02)':`기본 기물 ${id.slice(-2)}`;
export function unitAt(units:Observation['units'],position:Point){return units.find(u=>u.location.kind==='board'&&Math.hypot(boardPoint(u.location.col,u.location.row).x-position.x,boardPoint(u.location.col,u.location.row).y-position.y)<25);}
