import test from 'node:test';import assert from 'node:assert/strict';
import * as core from '../../src/core-timing/index.ts';
import {scenario} from '../../src/web/popo-timing/scenario.ts';
import {createConsumer} from '../../src/web/popo-timing/consumer.ts';
import {nextFlightPosition,point,anchoredPosition,clearanceRadius,letterDimensions,stopBeforeEnemies} from '../../src/web/popo-timing/projection.ts';
import {fixture,flight,enemy,copy,advance} from '../core-timing/helpers.ts';
const setup=()=>{const c=createConsumer(),owner={};c.bind(owner);return{c,owner};};
test('first release starts current at high incoming alpha; windup never creates a flight',()=>{
 const {c,owner}=setup();assert.equal(c.present(owner,core.observe(scenario(125)),[],.99)!.flights.length,0);
 const o=core.observe(scenario(126)),f=o.flights[0],first=c.present(owner,o,[],.8)!.flights[0];assert.deepEqual(first.position,f.position);assert.equal(first.fraction,0);
 const half=c.present(owner,o,[],.9)!.flights[0],end=nextFlightPosition(f,o.enemies.find(e=>e.id===f.targetId)!.position,126);
 assert(Math.abs(half.fraction-.5)<1e-12);assert.deepEqual(c.present(owner,o,[],1)!.flights[0].position,end);
});
test('first attach, skipped tick, missing target and stale stamp never extrapolate',()=>{
 const o=core.observe(scenario(127));for(const a of [.8,1,9]){const {c,owner}=setup();assert.deepEqual(c.present(owner,o,[],a)!.flights[0].position,o.flights[0].position);}
 const {c,owner}=setup();c.present(owner,core.observe(scenario(124)),[],0);assert.deepEqual(c.present(owner,o,[],.9)!.flights[0].position,o.flights[0].position);
 assert.equal(c.present(owner,core.observe(scenario(126)),[],1),null);c.bind({});assert.equal(c.present(owner,o,[],1),null);
 const missing=setup();missing.c.present(missing.owner,core.observe(scenario(126)),[],0);const noTarget={...o,enemies:o.enemies.filter(e=>e.id!==5)};
 const view=missing.c.present(missing.owner,noTarget,[],.9)!;assert.equal(view.flights[0].fraction,0);assert.deepEqual(view.flights[0].position,o.flights[0].position);
});
for(const distance of [4990,9990,14990,19990])test(`diagnostic moving target corner${distance}: forecast equals exactly next core home, no speed extrapolation`,()=>{
 const s=fixture();s.units[0].cooldown=99;s.enemies=[copy(enemy(100,100,distance))];s.flights=[copy(flight(s,1,{arrivalTick:s.tick+3}))];s.nextAttackId=2;
 const {c,owner}=setup();c.present(owner,core.observe(s),[],0);const mid=advance(s),o=core.observe(mid.state),view=c.present(owner,o,mid.events,1)!;
 const next=advance(mid.state);assert.deepEqual(view.flights[0].position,next.state.flights[0].position);
 const last=c.present(owner,core.observe(next.state),next.events,1)!.flights[0];const impact=advance(next.state).events.find(e=>e.type==='attackImpacted');assert(impact?.type==='attackImpacted');assert.deepEqual(last.position,impact.center);
});
test('diagnostic earlier same-tick lethal cancels forecast2: no speculative contact or later replay',()=>{
 const s=fixture();s.units[0].cooldown=99;s.enemies=[copy(enemy(100,1))];s.flights=[copy(flight(s,1,{arrivalTick:12})),copy(flight(s,2,{arrivalTick:12}))];s.nextAttackId=3;
 const {c,owner}=setup();c.present(owner,core.observe(s),[],0);const mid=advance(s),o=core.observe(mid.state),v=c.present(owner,o,mid.events,1)!;assert.equal(v.aftermath.length,0);
 for(const f of v.flights){const original=o.flights.find(x=>x.attackId===f.attackId)!,target=point(o.enemies[0].position),start=anchoredPosition(f.currentPosition,original,o.tick,0,36),wanted=anchoredPosition(f.position,original,o.tick,f.fraction,36);const pixel=stopBeforeEnemies(start,wanted,[target],36);if(pixel)assert(Math.hypot(pixel.x-target.x,pixel.y-target.y)>=clearanceRadius(36)-1e-7);}
 const terminal=advance(mid.state);assert.deepEqual(terminal.events.filter(e=>e.type==='attackImpacted'||e.type==='attackCancelled').map(e=>[e.type,e.attackId]),[['attackImpacted',1],['attackCancelled',2]]);
 for(const a of [0,.5,1]){const after=c.present(owner,core.observe(terminal.state),terminal.events,a)!;assert.equal(after.flights.length,0);assert.deepEqual(after.aftermath.map(e=>e.attackId),[1]);}
 assert.equal(c.present(owner,o,[],1),null);
});
test('absence overrides a forecast even without terminal event delivery',()=>{
 const {c,owner}=setup();c.present(owner,core.observe(scenario(126)),[],0);assert(c.present(owner,core.observe(scenario(127)),[],.9)!.flights.length);
 const out=c.present(owner,core.observe(scenario(128)),[],0)!;assert.equal(out.flights.length,0);assert.equal(out.aftermath.length,0);
});
test('pixel guard uses letter bounds + stroked silhouette +2px; reserves36px for frozen resize',()=>{
 const target={x:210,y:140};for(const size of [32,36])for(let deg=0;deg<360;deg+=5){const r=deg*Math.PI/180,start={x:target.x+100*Math.cos(r),y:target.y+100*Math.sin(r)},p=stopBeforeEnemies(start,target,[target],size)!;assert(p);const d=Math.hypot(p.x-target.x,p.y-target.y);assert(Math.abs(d-clearanceRadius(size))<1e-7);const letter=letterDimensions(size);assert(d-Math.hypot(letter.width,letter.height)/2-11.75>=2-1e-7);}
 assert.equal(stopBeforeEnemies(target,target,[target],36),null);
 assert.deepEqual(stopBeforeEnemies({x:0,y:0},{x:5,y:0},[],36),{x:5,y:0});
});
test('hand offset is continuous at tick boundaries and reaches zero at arrival, independent of target distance',()=>{
 const f=core.observe(scenario(126)).flights[0],pos={x:4000,y:650};assert.deepEqual(anchoredPosition(pos,f,126,1,36),anchoredPosition(pos,f,127,0,36));assert.deepEqual(anchoredPosition(pos,f,128,0,36),point(pos));
});
