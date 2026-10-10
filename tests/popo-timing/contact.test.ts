import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceContact,contactVisible,protectedEnemyPixel} from '../../src/web/popo-timing/contact.ts';
import {scenario} from '../../src/web/popo-timing/scenario.ts';
import {point} from '../../src/web/popo-timing/projection.ts';
import * as core from '../../src/core-timing/index.ts';
import {createConsumer} from '../../src/web/popo-timing/consumer.ts';
import {fixture,flight,enemy,copy,advance} from '../core-timing/helpers.ts';

test('surface cue stays outside own body/eyes/HP over supported incoming angles',()=>{
 const hit={x:210,y:140};
 for(let degrees=-35;degrees<=35;degrees++){
  const angle=degrees*Math.PI/180,source={x:hit.x-100*Math.cos(angle),y:hit.y-100*Math.sin(angle)};
  const c=surfaceContact(hit,source,5,128)!;assert(c);assert(contactVisible(c,[hit]),String(degrees));
  assert(c.points.every(p=>!protectedEnemyPixel(p,hit)));
  assert(Math.hypot(c.anchor.x-hit.x,c.anchor.y-hit.y)>=14);
 }
});
test('actual previous frame direction is preferred; stale/wrong-target/missing/degenerate uses event source',()=>{
 const hit={x:210,y:140},source={x:100,y:130};
 const sample={position:{x:180,y:120},tick:127,targetId:5};
 assert.equal(surfaceContact(hit,source,5,128,sample)!.direction,'flight');
 const fallback=surfaceContact(hit,source,5,128)!;assert.equal(fallback.direction,'source');
 for(const bad of [{...sample,tick:126},{...sample,tick:128},{...sample,targetId:6},{...sample,position:hit},{...sample,position:{x:NaN,y:0}}])
  assert.deepEqual(surfaceContact(hit,source,5,128,bad),fallback);
 assert.equal(surfaceContact(hit,hit,5,128),null);
});
test('overlapping body or another HP bar suppresses cue instead of relocating it',()=>{
 const hit={x:210,y:140},c=surfaceContact(hit,{x:100,y:140},5,128)!;
 assert(contactVisible(c,[hit]));
 const original=structuredClone(c);
 assert(!contactVisible(c,[hit,{x:196,y:140}]));
 assert(!contactVisible(c,[hit,{x:196,y:158}]));
 assert.deepEqual(c,original);
});
test('legal lethal/nonlethal impact snapshots and canonical hashes are unaffected by contact geometry',()=>{
 for(const tick of [127,151]){
  const before=scenario(tick),result=core.advance(before,1);assert(result.ok);
  const event=result.events.find(e=>e.type==='attackImpacted');assert(event?.type==='attackImpacted');
  const hash=core.stateHash(result.state),events=structuredClone(result.events),target=event.hits[0];
  const hit=point(target.position),source=point(event.sourcePosition);
  const c=surfaceContact(hit,source,target.enemyId,event.tick)!;assert(c);assert(contactVisible(c,[hit]));
  assert.notDeepEqual(c.anchor,hit);assert.deepEqual(result.events,events);assert.equal(core.stateHash(result.state),hash);
  assert.equal(result.state.enemies.find(e=>e.id===target.enemyId)?.hp,tick===127?undefined:13);
 }
});

test('diagnostic same-tick cancellation has no aftermath/contact authority, even at late fractions',()=>{
 const s=fixture();s.units[0].cooldown=99;s.enemies=[copy(enemy(100,1))];
 s.flights=[copy(flight(s,1,{arrivalTick:12})),copy(flight(s,2,{arrivalTick:12}))];s.nextAttackId=3;
 const c=createConsumer(),owner={};c.bind(owner);c.present(owner,core.observe(s),[],0);
 const next=advance(s);c.present(owner,core.observe(next.state),next.events,1);const terminal=advance(next.state);
 assert(terminal.events.some(e=>e.type==='attackCancelled'&&e.attackId===2));
 for(const alpha of [0,.5,1]){const view=c.present(owner,core.observe(terminal.state),terminal.events,alpha)!;
  assert.equal(view.flights.length,0);assert.deepEqual(view.aftermath.map(a=>a.attackId),[1]);}
});
