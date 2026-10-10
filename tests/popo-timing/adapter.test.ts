import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../src/core-timing/index.ts';
import {scenario,supported} from '../../src/web/popo-timing/scenario.ts';
import {createConsumer} from '../../src/web/popo-timing/consumer.ts';
test('legal scene: windup123 release126 impact128 is the only HP change, kills target5',()=>{
 let s=scenario(122);const events=[];for(let i=0;i<6;i++){const r=core.advance(s,1);assert(r.ok);s=r.state;events.push(...r.events);const enemy=s.enemies.find(e=>e.id===5);assert.equal(enemy?.hp,i===5?undefined:4);}
 assert.deepEqual(events.filter(e=>e.type.startsWith('attack')).map(e=>[e.type,e.tick]),[['attackStarted',123],['attackReleased',126],['attackImpacted',128]]);
 assert.equal(events.find(e=>e.type==='enemyDefeated')?.enemyId,5);
});
test('display consumer rejects stale same-owner snapshots and reset owners; impact wins every alpha',()=>{
 const before=scenario(127),r=core.advance(before,1);assert(r.ok);const owner={},c=createConsumer();c.bind(owner);
 const o=core.observe(before);const first=c.present(owner,o,[],0)!;assert.deepEqual(first.flights[0].position,o.flights[0].position);
 for(const alpha of [0,.5,1]){const impact:NonNullable<ReturnType<typeof c.present>>=c.present(owner,core.observe(r.state),r.events,alpha)!;assert.equal(impact.flights.length,0);assert.equal(impact.aftermath.length,1);assert(!impact.hp.some(([id])=>id===5));}
 assert.equal(c.present(owner,o,[],1),null);c.bind({});assert.equal(c.present(owner,o,[],1),null);
});
test('late attach at windup, flight and after impact never replays completed events or changes core hash',()=>{
 for(const tick of [124,126,127,128]){const s=scenario(tick),hash=core.stateHash(s),o=core.observe(s),owner={},c=createConsumer();c.bind(owner);
 for(const a of [0,.5,1]){const v=c.present(owner,o,[],a)!;assert.deepEqual(v.flights.map(f=>f.position),o.flights.map(f=>f.position));assert.equal(v.aftermath.length,0);}
 assert.equal(core.stateHash(s),hash);}
});
test('50/150/250ms batch grouping preserves canonical state and impact event sequence',()=>{
 const run=(batch:number)=>{let s=scenario(122);const events=[];while(s.tick<136){const r=core.advance(s,Math.min(batch,136-s.tick));assert(r.ok);s=r.state;events.push(...r.events);}return{hash:core.stateHash(s),events};};
 assert.deepEqual(run(1),run(3));assert.deepEqual(run(1),run(5));
});
test('right-facing cone only, no left/up/down flip fallback',()=>{
 assert(supported({x:0,y:0},{x:100,y:0}));assert(supported({x:0,y:0},{x:100,y:60}));
 for(const p of [{x:-100,y:0},{x:0,y:100},{x:0,y:-100},{x:100,y:61}])assert(!supported({x:0,y:0},p));
});
