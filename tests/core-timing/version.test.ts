import test from 'node:test';
import assert from 'node:assert/strict';
import * as old from '../../src/core-v2/index.ts';
import {canonicalJson,sha256} from '../../src/core-timing/serialization.ts';
import {core,copy,initial,legal,advance,fixture,flight,windup} from './helpers.ts';
import type {MatchState} from '../../src/core-timing/types.ts';
const header=(s=initial())=>({schemaVersion:4,rulesId:s.rulesId,rulesDigest:s.rulesDigest,seed:s.seed});
test('J: immutable full rules digests, exact canonical20 vs schema3 canonical17',()=>{
 assert.deepEqual(core.RULES_DIGESTS,{'attack-timing-v4-r1-count40':'50b9506a8dda1d5710db1efb54c51d886a4dbcc95b5b97fa16e6f971cc8f7088','attack-timing-v4-r1-count80':'de5b21fe483b59ac324c672577110f95c7e44bd30f5b1071e581331a233026cb'});
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
