import assert from 'node:assert/strict';
import * as core from '../../src/core-timing/index.ts';
import type { Enemy, MatchState, Command, Flight, Windup, AttackSnapshot } from '../../src/core-timing/types.ts';
import { copy } from '../../src/core-timing/util.ts';
export { core, copy };
export function initial(){const r=core.createMatch(1,core.EXPERIMENT_RULES_ID);assert(r.ok);return r.state;}
export function command(s:MatchState,c:Command){const r=core.dispatch(s,c);assert(r.ok);return r.state;}
export function legal(){let s=command(initial(),{type:'recruit',offerSlot:0});s=command(s,{type:'move',unitId:1,to:{kind:'board',row:0,col:0}});return command(s,{type:'startWave'});}
export function advance(s:MatchState,n=1){const r=core.advance(s,n);assert(r.ok,JSON.stringify(r));return r;}
export function enemy(id=100,hp=1000,totalDistance=1000,typeId:Enemy['typeId']='basic'):Enemy{return{id,typeId,hp,maxHp:hp,totalDistance,spawnTick:0,slow:null};}
/** Diagnostic boundary state only; NOT a legal-command replay or gameplay claim. */
export function fixture(ids=['fixture-01'],wave=1){const s=copy(initial());s.phase='combat';s.wave=wave;s.tick=10;s.waveTick=10;s.spawnCursor=core.getRules(s.rulesId)!.waves[wave-1].spawns.length;s.nextEntityId=1000;s.units=ids.map((definitionId,i)=>({id:i+1,definitionId,star:1,location:{kind:'board',col:i%4,row:Math.floor(i/4)},cooldown:0}));s.enemies=[copy(enemy())];return s;}
export function snapshot(behavior:'single'|'splash'='single'):AttackSnapshot{return{damage:6,bossDamage:12,range:3200,period:12,behavior,radius:behavior==='splash'?1100:0,effect:null,windupTicks:behavior==='single'?3:4,minFlightTicks:2,distancePerFlightTick:600};}
export function flight(s:MatchState,id=1,overrides:Partial<Flight>={}):Flight{return{kind:'flight',attackId:id,unitId:1,targetId:100,startTick:0,releaseTick:4,arrivalTick:s.tick+1,sourcePosition:{x:500,y:500},position:{x:500,y:500},previousPosition:{x:500,y:500},positionTick:s.tick,previousPositionTick:s.tick-1,snapshot:snapshot(),...overrides};}
export function windup(s:MatchState,id=1,overrides:Partial<Windup>={}):Windup{return{kind:'windup',attackId:id,unitId:1,targetId:100,startTick:s.tick-2,releaseTick:s.tick+1,sourcePosition:{x:500,y:500},snapshot:snapshot(),...overrides};}
export function checkReplay(s:MatchState){const r=core.replay({schemaVersion:4,rulesId:s.rulesId,rulesDigest:s.rulesDigest,seed:s.seed},s.acceptedLog,core.stateHash(s));assert(r.ok);assert.equal(core.canonicalState(r.state),core.canonicalState(s));}
