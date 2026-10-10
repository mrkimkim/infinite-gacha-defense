import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSnapshot,evaluationPlan,runEvaluation,summarize,type EnginePort} from '../../src/cli/evaluation.ts';
test('policy boundary rejects private fields recursively, accessors and non-JSON values',()=>{
  for(const key of ['seed','rngState','nextEntityId','acceptedLog','prng','futureOffers','replay']) {
    assert.throws(()=>publicSnapshot({nested:[{[key]:1}]}),/NON_PUBLIC_POLICY_INPUT/);
  }
  let touched=false;const getter={get gold(){touched=true;return 5;}};
  assert.throws(()=>publicSnapshot(getter));assert.equal(touched,false);
  assert.throws(()=>publicSnapshot({value:NaN}));assert.throws(()=>publicSnapshot({call:()=>0}));
  const cycle:{self?:unknown}={};cycle.self=cycle;assert.throws(()=>publicSnapshot(cycle));
  const source={gold:3,offers:[{character:'test'}]};const detached=publicSnapshot(source);
  assert.notEqual(detached,source);assert.ok(Object.isFrozen(detached.offers[0]));assert.deepEqual(detached,source);
});
test('profile matrix pairs identical seeds while tuning/validation and stress stay separate',()=>{
  const jobs=evaluationPlan(['A40','A80','B40','B80'],[{id:'regular',cohort:'comparison'},{id:'expert',cohort:'comparison'},{id:'stress',cohort:'stress'}],[1,2],[101,102]);
  assert.equal(jobs.length,48);assert.equal(jobs.filter(j=>j.cohort==='stress').length,16);
  for(const profile of ['A40','A80','B40','B80']) assert.deepEqual(jobs.filter(j=>j.profile===profile&&j.policy==='regular').map(j=>j.seed),[1,2,101,102]);
  assert.throws(()=>evaluationPlan(['x'],[{id:'r',cohort:'comparison'}],[1],[1]),/BAD_SEED_PARTITION/);
  assert.throws(()=>evaluationPlan(['x'],[{id:'r',cohort:'comparison'}],[1,1],[2]),/BAD_SEED_PARTITION/);
});
test('aggregation keeps stress and validation out of comparison/tuning totals',()=>{
  const base={profile:'A',policy:'regular',seed:1,partition:'validation' as const,cohort:'comparison' as const,wave:5,bossWavesStarted:[5]};
  const groups=summarize([{...base,outcome:'loss',reason:'bossTimeout'},{...base,seed:2,outcome:'win',reason:'cleared',wave:20},
    {...base,cohort:'stress',outcome:'loss',reason:'accumulation'}]);
  assert.equal(groups.length,2);assert.equal(groups[0].winRate,0.5);assert.deepEqual(groups[0].bossWalls['5'],{started:2,failed:1});
});
test('rejection-only injected port aborts, never fabricates a successful game',()=>{
  const job=evaluationPlan(['pending'],[{id:'unimplemented',cohort:'comparison'}],[1],[2])[0];
  const engine=new Proxy({} as EnginePort<never,never,never,never,never>,{get(_target,key){assert.equal(key,'create');return ()=>{throw new Error('ENGINE_NOT_IMPLEMENTED');};}});
  assert.throws(()=>runEvaluation(engine,()=>[],job),/ENGINE_NOT_IMPLEMENTED/);
});

test('neutral census tracks stars and composition without XP, books, IDs or board-cap constants',async()=>{
  const {createCensusMetrics}=await import('../../src/cli/evaluation.ts');const m=createCensusMetrics();
  const first={wave:1,gold:2,benchCount:0,benchCapacity:8,remainingCount:0,formation:[{character:'a',star:1}]};
  m.observe(first,true);m.observe(first,true);m.observe({...first,wave:2,formation:[{character:'a',star:3}]},true);
  assert.equal(m.value.firstStar3Wave,2);assert.equal(m.value.formationChanges,0);assert.equal(m.value.maxStagnantWaves,1);
  m.observe({...first,wave:3,formation:[{character:'b',star:1}]},true);
  assert.equal(m.value.formationChanges,1);assert.equal(m.value.formationDiversity,2);assert.equal(m.value.idleGoldAtStart.length,3);
});
