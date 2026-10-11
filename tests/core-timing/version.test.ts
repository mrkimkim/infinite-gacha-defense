import test from 'node:test';
import assert from 'node:assert/strict';
import * as old from '../../src/core-v2/index.ts';
import {canonicalJson,sha256} from '../../src/core-timing/serialization.ts';
import {core,copy,initial,legal,advance,fixture,flight,windup} from './helpers.ts';
import type {MatchState} from '../../src/core-timing/types.ts';
const header=(s=initial())=>({schemaVersion:4,rulesId:s.rulesId,rulesDigest:s.rulesDigest,seed:s.seed});
test('J: immutable full rules digests, exact canonical20 vs schema3 canonical17',()=>{
 assert.deepEqual(core.RULES_DIGESTS,{'attack-timing-v4-r2-count40':'c495c9f090730d614a4a565ef224b9154d0efb9ca753e3aaa97da3bfe133ecb0','attack-timing-v4-r2-count80':'530cc41abcb3ffe9997152f094f175487d57e46a44ec20c299d23cbdfa2891d8'});
 for(const id of Object.keys(core.RULES_PROPOSALS) as Array<keyof typeof core.RULES_PROPOSALS>){assert.equal(sha256(canonicalJson(core.RULES_PROPOSALS[id])),core.RULES_DIGESTS[id]);assert(Object.isFrozen(core.RULES_PROPOSALS[id].timing));}
 assert.deepEqual(Object.keys(JSON.parse(core.canonicalState(initial()))),core.CANONICAL_STATE_KEYS);
 const v3=old.createMatch(1,old.EXPERIMENT_RULES_ID);assert(v3.ok);assert.equal(Object.keys(JSON.parse(old.canonicalState(v3.state))).length,17);
 assert.deepEqual(old.RULES_DIGESTS,{'playable-v2-gen2-fixture1-count40':'83462afeda2fe1756f130669f4b77af45c518390c04248d1d006909fb911c886','playable-v2-gen2-fixture1-count80':'f4f82d384a0a0774eefb75b9b7428cee45564749d815f0df3d3964ba64ba63d2'});
});
test('J: rejects schema/rules/digest crossing, unknown and malformed replay/commands without invoking getters',()=>{
 for(const [h,code]of [[{...header(),schemaVersion:3},'UNSUPPORTED_SCHEMA'],[{...header(),rulesId:old.EXPERIMENT_RULES_ID},'UNKNOWN_RULES'],[{...header(),rulesDigest:old.RULES_DIGESTS[old.EXPERIMENT_RULES_ID]},'RULES_DIGEST_MISMATCH'],[{...header(),extra:1},'BAD_FORMAT']]as const){const r=core.replay(h,[]);assert(!r.ok);assert.equal(r.error.code,code);}
 assert.equal(core.getRules(old.EXPERIMENT_RULES_ID),null);assert(!core.createMatch(1,old.EXPERIMENT_RULES_ID).ok);assert(!old.replay(header(),[]).ok);
 let invoked=false;const getter={get type(){invoked=true;return'startWave';}};for(const x of [getter,{type:'startWave',extra:true},{type:'move',unitId:1,to:{kind:'board',col:.5,row:0}},{type:'setRules',timing:{slow:5}}]){const s=initial(),r=core.dispatch(s,x);assert(!r.ok);assert.strictEqual(r.state,s);}assert.equal(invoked,false);
 const v3=old.createMatch(1,old.EXPERIMENT_RULES_ID);assert(v3.ok);const mismatch=core.advance(v3.state as unknown as MatchState,1);assert(!mismatch.ok);assert.equal(mismatch.error.code,'UNSUPPORTED_SCHEMA');
 const bad=copy(legal());bad.rulesDigest='0'.repeat(64);const d=core.dispatch(bad,{type:'sell',unitId:1});assert(!d.ok);assert.equal(d.error.code,'RULES_DIGEST_MISMATCH');
 const s=advance(legal(),6).state;const log=copy(s.acceptedLog);log.push({type:'advance',seq:log.length+1,startTick:s.tick,executedTicks:0});const r=core.replay(header(s),log);assert(!r.ok);assert.equal(r.error.code,'BAD_FORMAT');
});
test('J: every persisted pending field affects hash; array insertion order and log batching do not',()=>{
 const s=fixture();s.units[0].cooldown=99;s.windups=[copy(windup(s,3,{unitId:2}))];s.flights=[copy(flight(s,1)),copy(flight(s,2))];s.nextAttackId=4;
 const mutate=(path:string[])=>{const n=copy(s);let object:Record<string,unknown>=n as unknown as Record<string,unknown>;for(const key of path.slice(0,-1))object=object[key] as Record<string,unknown>;const k=path.at(-1)!;object[k]=(object[k] as number)+1;assert.notEqual(core.stateHash(n),core.stateHash(s),path.join('.'));};
 for(const path of [['nextAttackId'],['windups','0','attackId'],['windups','0','targetId'],['windups','0','releaseTick'],['windups','0','sourcePosition','x'],['windups','0','snapshot','damage'],['windups','0','snapshot','bossDamage'],['windups','0','snapshot','range'],['windups','0','snapshot','period'],['windups','0','snapshot','radius'],['windups','0','snapshot','windupTicks'],['windups','0','snapshot','minFlightTicks'],['windups','0','snapshot','distancePerFlightTick'],['flights','0','arrivalTick'],['flights','0','previousPosition','x'],['flights','0','position','y'],['flights','0','positionTick'],['flights','0','previousPositionTick']])mutate(path);
 const reverse=copy(s);reverse.flights.reverse();assert.equal(core.canonicalState(reverse),core.canonicalState(s));reverse.acceptedLog=[];assert.equal(core.stateHash(reverse),core.stateHash(s));
});

test('r2 never silently reinterprets r1 rules/logs; delayed definition table is deeply immutable',()=>{
 for(const id of ['attack-timing-v4-r1-count40','attack-timing-v4-r1-count80']){const r=core.replay({...header(),rulesId:id},[]);assert(!r.ok);assert.equal(r.error.code,'UNKNOWN_RULES');assert(!core.createMatch(1,id).ok);assert.equal(core.getRules(id),null);}
 const table=core.RULES_PROPOSALS[core.EXPERIMENT_RULES_ID].timing.delayedDefinitions;assert.deepEqual(table,{'fixture-01':{behavior:'single',windupTicks:3},'fixture-02':{behavior:'splash',windupTicks:4}});assert(Object.isFrozen(table));assert(Object.isFrozen(table['fixture-01']));
});
test('decoder rejects nested getter and cycle without invoking accessors or changing input state',()=>{
 let called=0;const nested={type:'move',unitId:1,to:{kind:'board',get col(){called++;return 0;},row:0}};const cycle:Record<string,unknown>={type:'reroll'};cycle.self=cycle;
 for(const input of [nested,cycle]){const s=initial(),r=core.dispatch(s,input);assert(!r.ok);assert.equal(r.error.code,'BAD_FORMAT');assert.strictEqual(r.state,s);}
 const logs=copy(legal().acceptedLog);const nestedEvent={...logs[0],events:[{type:'recruited',get arrival(){called++;return{};}}]};for(const entries of [[nestedEvent],[cycle]]){const r=core.replay(header(),entries);assert(!r.ok);assert.equal(r.error.code,'BAD_FORMAT');assert.equal(r.error.entryIndex,0);}assert.equal(called,0);
});
test('decoder preflights a later malformed entry before earlier sequence or command semantics',()=>{
 const entries=copy(legal().acceptedLog);entries[0].seq=99;const bad=[...entries,{type:'advance',seq:4,startTick:0,executedTicks:0}];const r=core.replay(header(),bad);assert(!r.ok);assert.equal(r.error.code,'BAD_FORMAT');assert.equal(r.error.entryIndex,3);
 const invalid=[{type:'command',seq:1,atTick:0,command:{type:'startWave'},events:[]},bad[3]];const q=core.replay(header(),invalid);assert(!q.ok);assert.equal(q.error.code,'BAD_FORMAT');assert.equal(q.error.entryIndex,1);
});
test('decoder detects well-shaped command event tampering and final hash mismatch',()=>{
 const s=legal(),entries=copy(s.acceptedLog);const first=entries[0];assert(first.type==='command');const e=first.events[0];assert(e.type==='recruited');e.goldDelta-=1;const tampered=core.replay(header(),entries);assert(!tampered.ok);assert.equal(tampered.error.code,'EVENT_MISMATCH');assert.equal(tampered.error.entryIndex,0);
 const mismatch=core.replay(header(),s.acceptedLog,'0'.repeat(64));assert(!mismatch.ok);assert.equal(mismatch.error.code,'FINAL_HASH_MISMATCH');
});
