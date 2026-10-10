import test from 'node:test';
import assert from 'node:assert/strict';
import {core,copy,initial,legal,fixture,enemy,flight,windup,snapshot,advance,checkReplay,command} from './helpers.ts';
import type {CombatEvent,MatchState} from '../../src/core-timing/types.ts';
import {home,flightDuration} from '../../src/core-timing/timing.ts';
const impacts=(events:readonly CombatEvent[])=>events.filter(e=>e.type==='attackImpacted');
const terminal=(events:readonly CombatEvent[])=>events.filter(e=>e.type==='attackImpacted'||e.type==='attackCancelled');

test('A: positive start/windup/flight boundaries; HP only changes at exact arrival and replay at each boundary',()=>{
 let s=legal();const events:CombatEvent[]=[];
 for(let tick=1;tick<=6;tick++){const r=advance(s);s=r.state;events.push(...r.events);assert.equal(s.enemies[0].hp,tick<6?16:10);checkReplay(s);}
 const start=events.find(e=>e.type==='attackStarted'),release=events.find(e=>e.type==='attackReleased'),impact=impacts(events)[0];
 assert(start?.type==='attackStarted'&&release?.type==='attackReleased');assert.deepEqual([start.tick,release.tick,impact.tick],[1,4,6]);assert(!('hits'in start));assert(!('hits'in release));assert.equal(impact.attackId,start.attackId);assert.equal(terminal(events).length,1);
});
test('A: splash gets four windup ticks; snapshot fixes all damage/range/period/behavior/timing fields',()=>{
 const r=advance(fixture(['fixture-02']));const w=r.state.windups[0];assert.equal(w.releaseTick-w.startTick,4);assert.equal(w.snapshot.behavior,'splash');assert.equal(w.snapshot.radius,1100);assert.equal(w.snapshot.damage,5);assert.equal(w.snapshot.effect,null);
 const s=copy(r.state);s.units[0].star=3;const release=advance(s,4);assert.equal(release.state.flights[0].snapshot.damage,5);
});
test('B: inclusive release range and out-of-range cancellation, no refund or same-tick retry',()=>{
 for(const range of [4000,3999]){const s=fixture();s.enemies=[copy(enemy(100,100,6000)),copy(enemy(101,100,15000))];s.windups=[copy(windup(s,1,{snapshot:{...snapshot(),range}}))];s.nextAttackId=2;
 const r=advance(s);assert(!r.events.some(e=>e.type==='attackStarted'));assert.equal(r.state.units[0].cooldown,0);
 assert(r.events.some(e=>e.type===(range===4000?'attackReleased':'attackCancelled')));if(range===3999)assert(r.events.some(e=>e.type==='attackCancelled'&&e.reason==='outOfRange'));}
});
test('B: locked target never changes to higher priority newcomer; flight outside caster range continues',()=>{
 const s=fixture();s.enemies=[copy(enemy(100,100,15000)),copy(enemy(101,100,20000))];s.flights=[copy(flight(s,1,{snapshot:{...snapshot(),range:1}}))];s.nextAttackId=2;s.units[0].cooldown=99;
 const r=advance(s);assert.equal(impacts(r.events)[0].targetId,100);assert.equal(impacts(r.events)[0].hits[0].enemyId,100);
});
for(const kind of ['windup','flight'] as const)test(`B: ${kind} target death cancels once, no retarget; later tick may acquire a new ID`,()=>{
 const s=fixture();s.enemies=[copy(enemy(101))];s.nextAttackId=2;if(kind==='windup')s.windups=[copy(windup(s))];else s.flights=[copy(flight(s))];const r=advance(s);assert.equal(terminal(r.events).length,1);assert(r.events.some(e=>e.type==='attackCancelled'&&e.reason==='targetMissing'));assert(!r.events.some(e=>e.type==='attackStarted'));const next=advance(r.state);const start=next.events.find(e=>e.type==='attackStarted');assert(start?.type==='attackStarted');assert.equal(start.targetId,101);assert.equal(start.attackId,2);
});
test('B/E: earlier impact kills primary; later AoE cancels wholly, one defeat and terminal per attack',()=>{
 const s=fixture();s.enemies=[copy(enemy(100,1)),copy(enemy(101,100,1200))];s.units[0].cooldown=99;s.nextAttackId=3;s.flights=[copy(flight(s,2,{snapshot:snapshot('splash')})),copy(flight(s,1))];const r=advance(s);assert.deepEqual(terminal(r.events).map(e=>[e.type,e.attackId]),[['attackImpacted',1],['attackCancelled',2]]);assert.equal(r.events.filter(e=>e.type==='enemyDefeated').length,1);assert.equal(r.state.enemies.find(e=>e.id===101)!.hp,100);
});
test('C: signed homing, four directions, diagonals, zero distance, exact final position and fixed arrival',()=>{
 for(const p of [{x:101,y:0},{x:-101,y:0},{x:0,y:101},{x:0,y:-101},{x:-101,y:101},{x:0,y:0}]){let pos={x:0,y:0};assert.equal(flightDuration(pos,p,2,600),2);pos=home(pos,p,2);assert.deepEqual(pos,{x:Math.trunc(p.x/2),y:Math.trunc(p.y/2)});assert.deepEqual(home(pos,p,1),p);}
 assert.equal(flightDuration({x:-500,y:0},{x:701,y:0},2,600),3);
});
for(const distance of [4900,9900,14900,19900])test(`C: moving live target around corner/seam ${distance}; no path-index shortcut`,()=>{
 const s=fixture();s.units[0].cooldown=99;s.enemies=[copy(enemy(100,100,distance))];s.flights=[copy(flight(s,1,{arrivalTick:s.tick+3}))];s.nextAttackId=2;let state:MatchState=s;for(let i=0;i<3;i++){const target=core.pathPosition(state.enemies[0].totalDistance)!;const r=advance(state);if(i===2)assert.deepEqual(impacts(r.events)[0].center,target);else{const f=r.state.flights[0];assert.deepEqual(f.previousPosition,state.flights[0].position);assert.equal(f.arrivalTick,13);assert.deepEqual(f.position,home(state.flights[0].position,target,3-i));}state=r.state;}
});
test('D: period below windup does not duplicate windup; release blocks start; old flights may overlap',()=>{
 const s=fixture();s.windups=[copy(windup(s,1,{releaseTick:s.tick+4,snapshot:{...snapshot(),period:1}}))];s.nextAttackId=2;s.units[0].cooldown=0;
 const wait=advance(s,3);assert.equal(wait.state.windups.length,1);assert(!wait.events.some(e=>e.type==='attackStarted'));
 const released=advance(wait.state);assert(released.events.some(e=>e.type==='attackReleased'));assert(!released.events.some(e=>e.type==='attackStarted'));
 const next=advance(released.state);assert.equal(next.state.windups.length,1);assert.equal(next.state.flights.length,1);
 const long=fixture();long.flights=[copy(flight(long,1,{arrivalTick:100}))];long.nextAttackId=2;
 const overlapped=advance(long,17);assert(overlapped.state.flights.some(f=>f.attackId===1));assert(overlapped.events.filter(e=>e.type==='attackStarted').length>=2);
});
test('E: AoE includes1100 not1101, outside caster range; own lethal primary does not cancel remaining snapshot',()=>{
 const s=fixture();s.units[0].cooldown=99;s.enemies=[copy(enemy(100,1,6000)),copy(enemy(101,1,7100)),copy(enemy(102,1,7101))];s.flights=[copy(flight(s,1,{sourcePosition:{x:1500,y:500},snapshot:snapshot('splash')}))];s.nextAttackId=2;const r=advance(s);assert.deepEqual(impacts(r.events)[0].hits.map(h=>h.enemyId),[100,101]);assert.deepEqual(impacts(r.events)[0].hits.map(h=>h.damage),[1,1]);assert.equal(r.state.enemies.length,1);assert.equal(r.state.enemies[0].id,102);
});
test('E/consumer: same unit two attack IDs at same tick retain ordered clamped damage and one death',()=>{
 const s=fixture();s.enemies=[copy(enemy(100,10)),copy(enemy(101,100,15000))];s.units[0].cooldown=99;s.nextAttackId=3;s.flights=[copy(flight(s,2)),copy(flight(s,1))];const r=advance(s);assert.deepEqual(impacts(r.events).map(e=>[e.attackId,e.hits[0].damage]),[[1,6],[2,4]]);assert.equal(r.events.filter(e=>e.type==='enemyDefeated').length,1);
});
for(const wave of [5,20])for(const due of [600,601])test(`F: wave${wave} due${due} uses waveTick, global tick distinct, no late grace`,()=>{
 const s=fixture([],wave);s.tick=1234;s.waveTick=599;s.enemies=[copy(enemy(100,1,0,'boss'))];s.flights=[copy(flight(s,1,{arrivalTick:s.tick+(due-599)}))];s.nextAttackId=2;const r=advance(s);assert.equal(r.state.tick,1235);assert.equal(impacts(r.events).length,due===600?1:0);assert.equal(r.state.outcome,due===601?'loss':wave===20?'win':null);assert.equal(r.state.flights.length,0);if(due===601){assert.equal(r.state.outcomeReason,'bossTimeout');assert.deepEqual(r.events.slice(-2).map(e=>e.type),['attackCancelled','matchEnded']);}
});
test('F: accumulation precedes deadline/success; ordinary400 retains surviving enemies but not pending',()=>{
 const s=fixture([],5);s.waveTick=599;s.enemies=Array.from({length:40},(_,i)=>copy(enemy(100+i,1,0,i===0?'boss':'basic')));const r=advance(s);assert.equal(r.state.outcomeReason,'accumulation');
 const carry=fixture();carry.waveTick=399;carry.units[0].cooldown=99;carry.windups=[copy(windup(carry,1,{releaseTick:carry.tick+3}))];carry.nextAttackId=2;const c=advance(carry);assert.equal(c.state.phase,'preparation');assert.equal(c.state.enemies.length,1);assert.equal(c.state.windups.length,0);assert.deepEqual(c.events.slice(-3).map(e=>e.type),['attackCancelled','waveCompleted','shopRefreshed']);
});
test('F/G: future spawns prevent early clear; pending cannot delay true clear or cross phases',()=>{
 const s=fixture();s.enemies=[];s.spawnCursor=1;s.waveTick=1;s.units[0].cooldown=99;assert.equal(advance(s).state.phase,'combat');
 const clear=fixture();clear.enemies=[copy(enemy(100,1))];clear.units[0].cooldown=99;clear.flights=[copy(flight(clear,1)),copy(flight(clear,2,{arrivalTick:clear.tick+5}))];clear.nextAttackId=3;const r=advance(clear);assert.equal(r.state.phase,'preparation');assert.equal(r.state.flights.length,0);assert.equal(terminal(r.events).length,2);const next=command(r.state,{type:'startWave'});assert.equal(next.flights.length,0);assert.equal(next.windups.length,0);assert(!advance(next).events.some(e=>e.type==='attackImpacted'&&e.attackId<=2));
});
test('G: every combat composition command remains BAD_PHASE',()=>{for(const c of [{type:'recruit',offerSlot:0},{type:'move',unitId:1,to:{kind:'board',row:1,col:0}},{type:'swap',aId:1,bId:2},{type:'sell',unitId:1},{type:'reroll'}]){const s=legal(),r=core.dispatch(s,c);assert(!r.ok);assert.equal(r.error.code,'BAD_PHASE');assert.strictEqual(r.state,s);}});
for(const n of [3,4,5,17])test(`H: 1tick vs batch${n} canonical/hash/concatenated events, legal replay`,()=>{
 const run=(batch:number)=>{let state=legal();const events:CombatEvent[]=[];while(state.phase==='combat'&&state.tick<180){const r=advance(state,Math.min(batch,180-state.tick));state=r.state;events.push(...r.events);}return{state,events};};const a=run(1),b=run(n);assert.equal(core.canonicalState(a.state),core.canonicalState(b.state));assert.equal(core.stateHash(a.state),core.stateHash(b.state));assert.deepEqual(a.events,b.events);checkReplay(a.state);checkReplay(b.state);
});
test('I: whole-batch rollback after earlier damage, later allocator overflow',()=>{
 const s=fixture(['fixture-01','fixture-03']);s.nextAttackId=Number.MAX_SAFE_INTEGER-1;s.units[1].cooldown=2;s.flights=[copy(flight(s,1))];const original=copy(s),r=core.advance(s,3);assert(!r.ok);assert.equal(r.error.code,'INTEGER_OVERFLOW');assert.strictEqual(r.state,s);assert.equal(r.executedTicks,0);assert(!('events'in r));assert.deepEqual(s,original);
});
for(const kind of ['tick','arrival','coordinate','distance','movement'] as const)test(`I: ${kind} overflow fully rolls back`,()=>{
 const s=fixture();s.units[0].cooldown=99;s.nextAttackId=2;
 if(kind==='tick')s.tick=Number.MAX_SAFE_INTEGER-1;
 if(kind==='arrival'){s.tick=Number.MAX_SAFE_INTEGER-1;s.windups=[copy(windup(s,1,{startTick:0,releaseTick:Number.MAX_SAFE_INTEGER}))];}
 if(kind==='coordinate'){s.flights=[copy(flight(s,1,{position:{x:Number.MAX_SAFE_INTEGER,y:0}}))];s.enemies[0].totalDistance=0;}
 if(kind==='distance')s.windups=[copy(windup(s,1,{sourcePosition:{x:100000000,y:0}}))];
 if(kind==='movement')s.enemies[0].totalDistance=Number.MAX_SAFE_INTEGER-100;
 const before=copy(s),r=core.advance(s,3);assert(!r.ok,kind);assert.equal(r.error.code,'INTEGER_OVERFLOW');assert.strictEqual(r.state,s);assert.equal(r.executedTicks,0);assert.deepEqual(s,before);assert(!('events'in r));
});
test('immediate multi/slow/support/bossFirst behavior remains immediate, explicit delayed roles only',()=>{
 for(const id of ['fixture-03','fixture-04','fixture-05','fixture-06']){const r=advance(fixture([id]));assert(r.events.some(e=>e.type==='attack'));assert(!r.events.some(e=>e.type==='attackStarted'));assert.equal(r.state.windups.length,0);}
 const s=fixture();s.windups=[copy(windup(s,1,{snapshot:{...snapshot(),behavior:'slow' as 'single'}}))];s.nextAttackId=2;const r=core.advance(s,1);assert(!r.ok);assert.equal(r.error.code,'BAD_FORMAT');
});
test('snapshots, events and observations are detached, frozen; owner/display cursor never hashed',()=>{
 const s=advance(legal()).state,o=core.observe(s);assert.notStrictEqual(o.windups,s.windups);assert.notStrictEqual(o.windups[0].snapshot,s.windups[0].snapshot);assert(Object.isFrozen(o.windups[0]));for(const k of ['seed','rngState','nextAttackId','nextEntityId','acceptedLog'])assert(!(k in o));assert.equal(Object.keys(JSON.parse(core.canonicalState(s))).length,20);
 const empty=initial(),changed=copy(empty);changed.nextAttackId++;assert.notEqual(core.stateHash(empty),core.stateHash(changed));
 const pending=copy(s);pending.windups[0].snapshot.damage++;assert.notEqual(core.stateHash(s),core.stateHash(pending));
});

test('B/D: cancelled windup/flight does not refund a positive cooldown',()=>{
 for(const kind of ['windup','flight']){const s=fixture();s.enemies=[copy(enemy(101))];s.units[0].cooldown=7;s.nextAttackId=2;if(kind==='windup')s.windups=[copy(windup(s))];else s.flights=[copy(flight(s))];const r=advance(s);assert.equal(r.state.units[0].cooldown,6);assert(!r.events.some(e=>e.type==='attackStarted'));}
});
test('I: entity allocation overflow does not leak spawned enemy, pending or RNG/log changes',()=>{
 const s=copy(legal());s.nextEntityId=Number.MAX_SAFE_INTEGER;const before=copy(s),r=core.advance(s,5);assert(!r.ok);assert.equal(r.error.code,'INTEGER_OVERFLOW');assert.strictEqual(r.state,s);assert.equal(r.executedTicks,0);assert(!('events'in r));assert.deepEqual(s,before);
});
