import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../src/core-v2/index.ts';
import {createReviewMatch,createFeedback} from '../../src/web/art-review/model.ts';
import {createImpactLedger,geometry} from '../../src/web/art-review/impacts.ts';
import {scenes} from '../../src/web/art-review/scenes.ts';
for(const batch of [3,4,5])test(`batch ${batch}: first presentation survives elapsed attack window without moving core damage`,()=>{
 const m=createReviewMatch(),f=createFeedback(),l=createImpactLedger();f.bind(m.owner,1);l.bind(m.owner);m.command({type:'startWave'});const before=m.observe().enemies,events=m.advance(batch);f.consume(m.owner,events,m.state.tick);l.consume(m.owner,before,events,m.state.tick);
 assert.equal(f.sample(m.owner,m.state.tick).pose,'attack');const rows=l.active(m.owner,m.state.tick);assert(rows.length);assert(rows.every(r=>r.attack.tick===1&&r.shownTick===batch));assert(rows.every(r=>r.beforeHp-r.damage===r.afterHp));
 assert.deepEqual(f.sample(m.owner,m.state.tick),f.sample(m.owner,m.state.tick));assert.equal(f.sample(m.owner,m.state.tick+2).pose,'recovery');assert.equal(l.active(m.owner,m.state.tick+8).length,0);
 const r=m.record();assert(core.replay(r.header,r.entries,r.finalHash).ok);
});
test('multiple real attacks in one batch preserve ordered HP, lethal transition and removed target silhouette data',()=>{
 const m=createReviewMatch(),l=createImpactLedger();l.bind(m.owner);m.command({type:'startWave'});const before=m.observe().enemies,events=m.advance(30);l.consume(m.owner,before,events,30);const rows=l.active(m.owner,30),dead=rows.find(r=>r.defeated);assert(dead);assert.equal(dead.afterHp,0);assert(dead.beforeHp>0);assert(!m.observe().enemies.some(e=>e.id===dead.enemyId));assert.deepEqual(dead.position,dead.attack.hits.find(h=>h.enemyId===dead.enemyId)!.position);
 for(const id of new Set(rows.map(r=>r.enemyId))){const chain=rows.filter(r=>r.enemyId===id);for(let i=1;i<chain.length;i++)assert.equal(chain[i].beforeHp,chain[i-1].afterHp);}
 l.consume(m.owner,before,events,30);assert.equal(l.active(m.owner,30).length,rows.length);l.bind({});assert.equal(l.active(m.owner,30).length,0);
});
test('legal scenario checkpoints cover four directions, near/far and multiple actual hits',()=>{
 const directions=new Set(),ranges=new Set();let multiple=false;
 for(const scene of scenes){const m=createReviewMatch(scene.setup);m.command({type:'startWave'});const events=m.advance(scene.tick),a=events.find(e=>e.type==='attack'&&e.tick===scene.tick);assert(a?.type==='attack',scene.id);for(const h of a.hits){const g=geometry(a.sourcePosition,h.position);directions.add(g.direction);ranges.add(g.range);}multiple ||= a.hits.length>1;const r=m.record();assert(core.replay(r.header,r.entries,r.finalHash).ok);}
 assert.deepEqual([...directions].sort(),['diagonal','down','horizontal','up']);assert.deepEqual([...ranges].sort(),['far','near']);assert(multiple);
});
