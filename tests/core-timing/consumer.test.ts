import test from 'node:test';
import assert from 'node:assert/strict';
import {createConsumer} from './consumer.ts';
import {core,copy,legal,fixture,flight,enemy,advance} from './helpers.ts';

test('K: late attach restores current windup/flight only; impact outranks interpolation at 0/.5/1',()=>{
 for(const ticks of [1,4,5,6,17]){const r=advance(legal(),ticks),o=core.observe(r.state),owner={},c=createConsumer();c.bind(owner);const hash=core.stateHash(r.state);
 const late=c.present(owner,o,[],.5)!;assert.equal(late.flights.length,o.flights.length);assert.equal(late.windups.length,o.windups.length);assert.equal(late.aftermath.length,0);
 for(const alpha of [0,.5,1]){const display=c.present(owner,o,r.events,alpha)!;for(const e of r.events)if(e.type==='attackImpacted')assert(!display.flights.some(f=>f.attackId===e.attackId));assert.equal(core.stateHash(r.state),hash);}
 }
});
test('K: same tick IDs retained, duplicate events/pending+event do not double impact; final hit and result coexist',()=>{
 const s=fixture();s.enemies=[copy(enemy(100,10))];s.units[0].cooldown=99;s.flights=[copy(flight(s,1)),copy(flight(s,2))];s.nextAttackId=3;const r=advance(s),owner={},c=createConsumer();c.bind(owner);const a=c.present(owner,core.observe(r.state),r.events,0)!;assert.equal(a.phase,'preparation');assert.equal(a.flights.length,0);assert.deepEqual(a.aftermath.map(e=>e.attackId),[1,2]);assert.deepEqual(c.present(owner,core.observe(r.state),r.events,1),a);assert.equal(a.hp.length,0);
 // Bounded aftermath is frozen in the same phase; no extra simulation tick.
 assert.deepEqual(c.present(owner,core.observe(r.state),[],.5),a);
});
test('K: pause/hidden do not call advance; owner reset rejects old numeric IDs and late decode',()=>{
 const s=advance(legal(),4).state,before=JSON.stringify(s),c=createConsumer(),oldOwner={},nextOwner={};c.bind(oldOwner);for(let i=0;i<20;i++)c.present(oldOwner,core.observe(s),[],.5);assert.equal(JSON.stringify(s),before);c.bind(nextOwner);assert.equal(c.present(oldOwner,core.observe(s),[],1),null);const next=legal(),v=c.present(nextOwner,core.observe(next),[],0)!;assert.equal(v.flights.length,0);assert.equal(v.aftermath.length,0);
});

test('K: existing RAF scheduler freezes pending/hash/log on pause/hidden, no catch-up, stale owner callback inert',async()=>{
 const {createScheduler}=await import('../../src/web/scheduler.ts');
 const callbacks:Array<(t:number)=>void>=[];let match={state:legal()};
 const scheduler=createScheduler({tickMs:50,getMatch:()=>match,getPhase:m=>m.state.phase,
  advance:(m,n)=>{m.state=advance(m.state,n).state;},requestFrame:cb=>{callbacks.push(cb);return callbacks.length;},cancelFrame:()=>{}});
 const frame=(t:number)=>{const cb=callbacks.shift();assert(cb);cb(t);};
 frame(0);frame(50);assert.equal(match.state.tick,1);const frozen=JSON.stringify(match.state),old=callbacks.shift()!;
 scheduler.setPaused(true);old(100);assert.equal(JSON.stringify(match.state),frozen);scheduler.setPaused(false);frame(10000);assert.equal(match.state.tick,1);frame(10050);assert.equal(match.state.tick,2);
 const oldHidden=callbacks.shift()!,hidden=JSON.stringify(match.state);scheduler.setHidden(true);oldHidden(20000);assert.equal(JSON.stringify(match.state),hidden);scheduler.setHidden(false);frame(30000);assert.equal(match.state.tick,2);frame(30050);assert.equal(match.state.tick,3);
 const oldOwner=callbacks.shift()!;match={state:legal()};scheduler.sync();oldOwner(30100);assert.equal(match.state.tick,0);frame(40000);assert.equal(match.state.tick,0);scheduler.dispose();
});
