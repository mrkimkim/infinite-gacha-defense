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

test('public snapshot rejects sparse/extended/nonstandard arrays and hidden properties without exposing them',()=>{
  const extra=Object.assign([1],{extra:2});
  const unusual=[1];Object.setPrototypeOf(unusual,{});
  const hidden=Object.defineProperty({},'value',{value:5,enumerable:false});
  const hiddenIndex=Object.defineProperty([1],'0',{value:1,enumerable:false});
  for(const value of [new Array(2),[1,,3],extra,unusual,hidden,hiddenIndex]) {
    assert.throws(()=>publicSnapshot({nested:value}),/NON_PUBLIC_POLICY_INPUT/);
  }
  const dense=[null,{value:5},[]];const copied=publicSnapshot(dense);
  assert.deepEqual(copied,dense);assert.equal(copied.length,3);
  assert.notEqual(copied[1],dense[1]);assert.ok(Object.isFrozen(copied));
});

test('action budget accepts terminal on last advance/dispatch and rejects unfinished execution',()=>{
  // Minimal control-flow fixture only; no gameplay rules, policy score or real game outcome.
  type State={phase:'preparation'|'combat'|'result';tick:number;wave:number;outcome:'win'|null;reason:null};
  const job=evaluationPlan(['control-flow-only'],[{id:'test',cohort:'stress'}],[1],[2])[0];
  for(const initial of ['combat','preparation'] as const) {
    for(const terminalAfter of [1,2]) {
      let actions=0,finishes=0,accepted=0;
      const step=(s:State)=>{actions++;return {state:{...s,tick:s.tick+1,
        phase:actions===terminalAfter?'result' as const:s.phase,outcome:actions===terminalAfter?'win' as const:null},events:[]};};
      const engine:EnginePort<State,State,{},'step',never>={
        create:()=>({phase:initial,tick:0,wave:1,outcome:null,reason:null}),publicRules:()=>({}),observe:s=>s,inspect:s=>s,
        dispatch:step,advance:step,finish:()=>{finishes++;return {canonical:'control-flow-only',hash:'not-a-game-hash',replay:null};},
      };
      if(terminalAfter===1){
        const result=runEvaluation(engine,()=>['step'],job,()=>{accepted++;},1);
        assert.equal(result.tick,1);assert.equal(finishes,1);
      } else {
        assert.throws(()=>runEvaluation(engine,()=>['step'],job,()=>{accepted++;},1),/EVALUATION_STEP_LIMIT/);
        assert.equal(finishes,0);
      }
      assert.equal(actions,1);assert.equal(accepted,1);
    }
  }
});
