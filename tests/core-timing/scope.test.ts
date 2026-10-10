import test from 'node:test';import assert from 'node:assert/strict';
import * as v3 from '../../src/core-v2/index.ts';
import {core,copy,fixture,enemy,advance,command,checkReplay} from './helpers.ts';
import type {CombatEvent,MatchState} from '../../src/core-timing/types.ts';

test('only01/02 delay;07 single and08 splash attack immediately',()=>{
 for(const id of ['fixture-01','fixture-02','fixture-07','fixture-08']){const r=advance(fixture([id]));const delayed=id==='fixture-01'||id==='fixture-02';assert.equal(r.events.some(e=>e.type==='attackStarted'),delayed,id);assert.equal(r.events.some(e=>e.type==='attack'),!delayed,id);assert.equal(r.state.enemies[0].hp,delayed?1000:id==='fixture-07'?994:995);}
});
test('08 preserves immediate splash1100 boundary and baseline target-priority hit order',()=>{
 const s=fixture(['fixture-08']);s.units[0].location={kind:'board',row:0,col:1};s.enemies=[copy(enemy(100,1,6000)),copy(enemy(101,1,7100)),copy(enemy(102,1,7101))];const r=advance(s),a=r.events.find(e=>e.type==='attack');assert(a?.type==='attack');assert.deepEqual(a.hits.map(h=>h.enemyId),[101,100]);assert.equal(r.state.enemies[0].id,102);assert.equal(r.state.flights.length,0);
});
test('mixed immediate multi/slow/support/bossFirst/07/08 retains schema3 event and gameplay semantics',()=>{
 const s=fixture(['fixture-03','fixture-04','fixture-05','fixture-06','fixture-07','fixture-08']);s.enemies=[copy(enemy(100,1000,1000,'boss')),copy(enemy(101,1000,1800)),copy(enemy(102,1000,2000))];
 const created=v3.createMatch(1,v3.EXPERIMENT_RULES_ID);assert(created.ok);const old=copy(created.state);for(const key of ['tick','waveTick','spawnCursor','nextEntityId','units','enemies','phase'] as const)Object.assign(old,{[key]:copy(s[key])});
 const baseline=v3.advance(old,1);assert(baseline.ok);const r=advance(s);const normalized=r.events.map(e=>{if(e.type==='attack'){const{attackId:_,...rest}=e;return rest;}return e;});assert.deepEqual(normalized,baseline.events);assert.deepEqual(r.state.units,baseline.state.units);assert.deepEqual(r.state.enemies,baseline.state.enemies);
 const multi=r.events.find(e=>e.type==='attack'&&e.unitId===1);assert(multi?.type==='attack');assert.equal(multi.hits.length,2);assert(r.events.some(e=>e.type==='effectApplied'));assert.equal(r.state.units[1].cooldown,18);const boss=r.events.find(e=>e.type==='attack'&&e.unitId===4);assert(boss?.type==='attack');assert.equal(boss.targetId,100);
});
function mixed(seed:number):MatchState{const r=core.createMatch(seed,core.EXPERIMENT_RULES_ID);assert(r.ok);let s=r.state;for(const slot of [0,2]){s=command(s,{type:'recruit',offerSlot:slot});const id=s.units.at(-1)!.id;s=command(s,{type:'move',unitId:id,to:{kind:'board',row:0,col:slot===0?0:1}});}return command(s,{type:'startWave'});}
for(const seed of [9,24])for(const batch of [3,4,5,17])test(`mixed legal seed${seed}: single vs batch${batch}, both delayed and immediate events, replay parity`,()=>{
 const run=(n:number)=>{let s=mixed(seed);const events:CombatEvent[]=[];while(s.tick<160&&s.phase==='combat'){const r=advance(s,Math.min(n,160-s.tick));s=r.state;events.push(...r.events);}return{s,events};};const a=run(1),b=run(batch);assert.equal(core.canonicalState(a.s),core.canonicalState(b.s));assert.equal(core.stateHash(a.s),core.stateHash(b.s));assert.deepEqual(a.events,b.events);assert(a.events.some(e=>e.type==='attackStarted'&&e.unitId===1));assert(a.events.some(e=>e.type==='attack'&&e.unitId===2));checkReplay(a.s);checkReplay(b.s);
});

test('all four IDs simultaneously:01/02 windups,07/08 immediate; identical mixed timeline across batches',()=>{
 const start=fixture(['fixture-01','fixture-02','fixture-07','fixture-08']);start.enemies=[copy(enemy(100,1000,1000)),copy(enemy(101,1000,1200))];const first=advance(start);assert.deepEqual(first.state.windups.map(w=>w.unitId),[1,2]);assert.deepEqual(first.events.filter(e=>e.type==='attack').map(e=>e.unitId),[3,4]);
 const run=(n:number)=>{let s:MatchState=start;const events:CombatEvent[]=[];while(s.tick<60&&s.phase==='combat'){const r=advance(s,Math.min(n,60-s.tick));s=r.state;events.push(...r.events);}return{s,events};};const one=run(1);for(const n of[3,4,5,17]){const b=run(n);assert.equal(core.stateHash(one.s),core.stateHash(b.s));assert.deepEqual(one.events,b.events);}
});
