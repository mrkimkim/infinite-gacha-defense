import test from 'node:test';import assert from 'node:assert/strict';
import * as core from '../../src/core-timing/index.ts';
import {scenario,scenes,type Scene} from '../../src/web/nuri-timing/scenario.ts';
import {createLedger} from '../../src/web/nuri-timing/ledger.ts';
import {createConsumer} from '../../src/web/nuri-timing/consumer.ts';
import {nextFlightPosition,stopBeforeEnemies,clearanceRadius} from '../../src/web/nuri-timing/projection.ts';
import {fixture,enemy,flight,copy,advance,snapshot} from '../core-timing/helpers.ts';
for(const name of Object.keys(scenes) as Scene[])test(`legal replay ${name}: committed terminal and final hash`,()=>{
 const config=scenes[name];let s=scenario(name);const events=[];while(s.tick<config.end){const r=core.advance(s,1);assert(r.ok);s=r.state;events.push(...r.events);}
 const terminal=events.find(e=>(e.type==='attackImpacted'||e.type==='attackCancelled')&&e.attackId===config.attack);assert(terminal);assert.equal(terminal.tick,config.terminal);
 if(name==='cancel'){assert.equal(terminal.type,'attackCancelled');assert(events.some(e=>e.type==='attack'&&e.tick===621&&e.hits.some(h=>h.enemyId===21)));}
 else{assert.equal(terminal.type,'attackImpacted');if(terminal.type==='attackImpacted')assert.deepEqual(terminal.hits.map(h=>h.enemyId),config.hits);}
 const replay=core.replay({schemaVersion:4,rulesId:s.rulesId,rulesDigest:s.rulesDigest,seed:s.seed},s.acceptedLog,core.stateHash(s));assert(replay.ok);assert.equal(core.canonicalState(replay.state),core.canonicalState(s));
});
for(const name of ['single','lethal','multi'] as const)test(`${name}: each HP/position snapshot and outside-radius nonreaction`,()=>{
 const config=scenes[name],before=scenario(name,config.terminal-1),o=core.observe(before),ledger=createLedger();ledger.reset(o);const r=core.advance(before,1);assert(r.ok);ledger.accept(core.observe(r.state),r.events);const a=ledger.view().impacts.find(a=>a.attackId===config.attack)!;assert(a.aoe);assert.equal(a.hits.length,config.hits.length);
 for(const h of a.hits){const prior=o.enemies.find(e=>e.id===h.enemyId)!;assert.deepEqual(h.position,prior.position);assert.equal(h.before,prior.hp);assert.equal(h.after,prior.hp-h.damage);assert(Math.hypot(h.position.x-a.center.x,h.position.y-a.center.y)<=1100);}
 for(const e of o.enemies.filter(e=>!config.hits.some(id=>id===e.id))){assert(Math.hypot(e.position.x-a.center.x,e.position.y-a.center.y)>1100);assert.equal(r.state.enemies.find(x=>x.id===e.id)?.hp,e.hp);assert(!a.hits.some(h=>h.enemyId===e.id));}
 assert.deepEqual(a.hits.filter(h=>h.after===0).map(h=>h.enemyId),config.dead);
 if(name==='multi'){assert.equal(a.hits[0].after,0);assert(a.hits[1].after>0);assert(a.hits[2].after>0);}
 ledger.accept(core.observe(r.state),r.events);assert.equal(ledger.view().impacts.length,1);
});
test('1/3/5-tick batching preserves ordered hit ledger and core hash',()=>{
 const run=(count:number)=>{let s=scenario('multi');const ledger=createLedger();ledger.reset(core.observe(s));while(s.tick<scenes.multi.end){const r=core.advance(s,Math.min(count,scenes.multi.end-s.tick));assert(r.ok);s=r.state;ledger.accept(core.observe(s),r.events);}return{hash:core.stateHash(s),impacts:ledger.view().impacts.map(({shownTick:_,...event})=>event)};};assert.deepEqual(run(1),run(3));assert.deepEqual(run(1),run(5));
});
test('late attach high alpha starts current; terminal wins; stale owner/stamp cannot restore flight',()=>{
 const s=scenario('multi',1065),o=core.observe(s),owner={},c=createConsumer();c.bind(owner);assert.deepEqual(c.present(owner,o,[],.99)!.flights[0].position,o.flights[0].position);const r=core.advance(s,1);assert(r.ok);for(const a of [0,.5,1])assert.equal(c.present(owner,core.observe(r.state),r.events,a)!.flights.length,0);assert.equal(c.present(owner,o,[],1),null);c.bind({});assert.equal(c.present(owner,core.observe(r.state),r.events,0),null);
});
test('first release starts current; no windup projectile; missing target does not extrapolate',()=>{
 const owner={},c=createConsumer();c.bind(owner);assert.equal(c.present(owner,core.observe(scenario('single',93)),[],.8)!.flights.length,0);const o=core.observe(scenario('single',94));assert.deepEqual(c.present(owner,o,[],.9)!.flights[0].position,o.flights[0].position);
 const next=core.observe(scenario('single',95)),missing={...next,enemies:next.enemies.filter(e=>e.id!==2)};assert.deepEqual(c.present(owner,missing,[],1)!.flights[0].position,next.flights[0].position);
});
test('diagnostic same-tick earlier AoE lethal cancels later bubble, while retaining earlier hit snapshot',()=>{
 const s=fixture(['fixture-02']);s.units[0].cooldown=99;s.enemies=[copy(enemy(100,1)),copy(enemy(101,20,1200))];s.nextAttackId=3;s.flights=[copy(flight(s,1,{snapshot:snapshot('splash')})),copy(flight(s,2,{snapshot:snapshot('splash')}))];const ledger=createLedger();ledger.reset(core.observe(s));const r=advance(s);ledger.accept(core.observe(r.state),r.events);const v=ledger.view();assert.deepEqual(v.cancelled,[2]);assert.equal(v.impacts.length,1);assert.deepEqual(v.impacts[0].hits.map(h=>[h.enemyId,h.after]),[[100,0],[101,14]]);
});
test('diagnostic same-tick distinct attacks preserve sequential target HP, not final-HP back-calculation',()=>{
 const s=fixture(['fixture-02']);s.units[0].cooldown=99;s.enemies=[copy(enemy(100,10))];s.nextAttackId=3;s.flights=[copy(flight(s,1,{snapshot:snapshot('splash')})),copy(flight(s,2,{snapshot:snapshot('splash')}))];const ledger=createLedger();ledger.reset(core.observe(s));const r=advance(s);ledger.accept(core.observe(r.state),r.events);assert.deepEqual(ledger.view().impacts.map(a=>a.hits.map(h=>[h.before,h.damage,h.after])),[[[10,6,4]],[[4,4,0]]]);
});
test('one-step prediction follows current observed target and full bubble clearance',()=>{
 const s=scenario('single',94),o=core.observe(s),f=o.flights[0],r=advance(s);assert.deepEqual(nextFlightPosition(f,o.enemies.find(e=>e.id===f.targetId)!.position,o.tick),r.state.flights[0].position);
 const p=stopBeforeEnemies({x:0,y:0},{x:100,y:0},[{x:100,y:0}])!;assert(Math.abs(Math.hypot(p.x-100,p.y)-clearanceRadius)<1e-7);assert.equal(stopBeforeEnemies({x:100,y:0},{x:100,y:0},[{x:100,y:0}]),null);
});
