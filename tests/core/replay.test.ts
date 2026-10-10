import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMatch, dispatch, advance, replay, stateHash, canonicalState, getRules, pathPosition } from '../../src/core/index.ts';
import type { MatchState, ReplayHeader } from '../../src/core/index.ts';
import { RULE_DATA, RULES_DIGEST } from '../../src/core/rules.ts';

function initial():MatchState { const r=createMatch(2); if(!r.ok)throw new Error(); return r.state; }
function fixture():MatchState {
  let state=initial();
  const bought=dispatch(state,{type:'recruit',offerSlot:0,to:{kind:'board',col:0,row:0}}); if(!bought.ok)throw new Error(); state=bought.state;
  const started=dispatch(state,{type:'startWave'}); if(!started.ok)throw new Error();
  const result=advance(started.state,10000); if(!result.ok)throw new Error(); return result.state;
}
function header(state:MatchState):ReplayHeader { return {schemaVersion:state.schemaVersion,rulesId:state.rulesId,rulesDigest:state.rulesDigest,seed:state.seed}; }
function failure(h:unknown,e:unknown,code:string,index:number|null=null,hash?:string):void {
  const result=replay(h,e,hash); assert.deepEqual(result,{ok:false,error:{code,entryIndex:index}});
  assert.equal(Object.hasOwn(result,'state'),false);
}

test('replay header, versions, digest, seed, and expected hash strict validation',()=>{
  const state=fixture(), h=header(state), log=state.acceptedLog;
  for(const bad of [null,[],{}, {...h,extra:1},{...h,schemaVersion:NaN},{...h,schemaVersion:1.1}]) failure(bad,log,'BAD_FORMAT');
  failure({...h,schemaVersion:2},log,'UNSUPPORTED_SCHEMA');
  failure({...h,rulesId:'growth'},log,'UNKNOWN_RULES');
  failure({...h,rulesDigest:'bad'},log,'RULES_DIGEST_MISMATCH');
  for(const seed of [0,-1,NaN,Infinity,1.2,4294967296,'1'])failure({...h,seed},log,'BAD_SEED');
  failure(h,log,'BAD_FORMAT',null,'not-a-hash');
  failure(h,log,'FINAL_HASH_MISMATCH',null,'0'.repeat(64));
  assert.equal(replay(h,log,stateHash(state)).ok,true);
});

test('whole entry preflight checks nested command/events, numeric shape, sequence and arrays',()=>{
  const state=fixture(), h=header(state), log=structuredClone(state.acceptedLog);
  const first=log[0]; if(first.type!=='command')throw new Error();
  const badEntries:unknown[]=[null,{}, {...first,extra:1},{...first,seq:1.5},{...first,atTick:Infinity},
    {...first,command:{type:'recruit',offerSlot:0,to:{kind:'board',col:NaN,row:0}}},
    {...first,command:{type:'startWave',extra:1}},
    {...first,events:[{...first.events[0],extra:1}]},
    {...first,events:[{...first.events[0],location:{kind:'board',col:0,row:4}}]},
    {...first,events:[{...first.events[0],id:NaN}]},
    {...first,events:new Array(1)},
    {type:'advance',seq:1,startTick:0,executedTicks:0},
    {type:'advance',seq:1,startTick:0,executedTicks:10001},
  ];
  for(const entry of badEntries)failure(h,[entry],'BAD_FORMAT',0);
  failure(h,[{...first,seq:2}],'BAD_SEQUENCE',0);
  for(const entries of [null,{},new Array(1),Object.assign([], {extra:1})])failure(h,entries,'BAD_FORMAT');
  // A late malformed entry must win over an earlier tick mismatch: no replay application before preflight.
  failure(h,[{...first,atTick:999},null],'BAD_FORMAT',1);
  failure(h,[{...first,atTick:999},{...log[1],seq:3}],'BAD_SEQUENCE',1);
});

test('replay rejects tick, rejected command, altered ID events, and excess actual ticks with no partial state',()=>{
  const state=fixture(), h=header(state), log=structuredClone(state.acceptedLog);
  const first=log[0]; if(first.type!=='command')throw new Error();
  failure(h,[{...first,atTick:1}],'TICK_MISMATCH',0);
  failure(h,[{...first,command:{type:'startWave'},events:[]}],'COMMAND_REJECTED',0);
  failure(h,[{...first,events:[{...first.events[0],id:999}]}],'EVENT_MISMATCH',0);
  failure(h,[{...first,events:[]}],'EVENT_MISMATCH',0);
  const advanceIndex=log.findIndex(e=>e.type==='advance'), last=log[advanceIndex]; if(last.type!=='advance')throw new Error();
  failure(h,[...log.slice(0,advanceIndex),{...last,startTick:1}],'TICK_MISMATCH',advanceIndex);
  failure(h,[...log.slice(0,advanceIndex),{...last,executedTicks:last.executedTicks+1}],'ADVANCE_MISMATCH',advanceIndex);
  failure(h,[{type:'advance',seq:1,startTick:0,executedTicks:1}],'ADVANCE_MISMATCH',0);
  const copy=structuredClone(state); replay(h,[...log,null]); assert.deepEqual(state,copy);
});

test('successful replay owns a detached log and state',()=>{
  const state=fixture(), entries=structuredClone(state.acceptedLog), result=replay(header(state),entries);
  assert.equal(result.ok,true); if(!result.ok)return;
  assert.deepEqual(result.state,state);
  const first=entries[0]; if(first.type==='command'&&first.command.type==='recruit') {
    (first.command as {offerSlot:number}).offerSlot=2;
    (first.events[0] as {id:number}).id=1000;
  }
  assert.deepEqual(result.state,state);
});

/** Independent test serializer, deliberately not importing the production canonicalizer. */
function independentJson(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(independentJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+independentJson((value as Record<string,unknown>)[key])).join(',')+'}';
}

test('complete rule projection and Node SHA-256 independently verify digest and public path',()=>{
  const expected={
    schemaVersion:1,rulesId:'technical-v1',tickMs:50,startingLives:10,startingGold:6,recruitCost:2,offerCount:3,waveReward:3,
    board:{columns:4,rows:4,tileSize:1000,capacity:4},benchCapacity:0,
    path:{length:20000,vertices:[{x:-500,y:-500},{x:4500,y:-500},{x:4500,y:4500},{x:-500,y:4500}]},
    units:{single:{damage:4,range:3000,cooldownTicks:10,splashRadius:0},splash:{damage:2,range:3000,cooldownTicks:15,splashRadius:1000}},
    enemies:{basic:{speed:100,leakDamage:1}},
    waves:[1,2,3,4,5].map(wave=>({wave,spawns:Array.from({length:3+2*wave},(_,i)=>({atWaveTick:10*i,typeId:'basic',hp:8+4*wave}))})),
    prng:{algorithm:'xorshift32',shifts:[13,17,5],seedMin:1,seedMax:4294967295,offerMapping:['single','splash'],modulus:2},
    semantics:{phaseOrder:['preparation','combat','result'],tickOrder:['spawn','cooldown','attack','moveLeak','increment','loss','waveEnd'],
      targeting:['distanceDescending','numericIdAscending'],unitOrder:'numericIdAscending',hitOrder:'numericIdAscending',
      rangeBoundary:'inclusiveSquaredDistance',splashBoundary:'inclusiveSquaredDistance',leakBoundary:'distanceGreaterThanOrEqualLength',
      firstEntityId:1,initialWave:1,initialTick:0,initialWaveTick:0,initialCooldown:0,star:1,growthEnabled:false},
  };
  assert.deepEqual(RULE_DATA,expected);
  const digest=createHash('sha256').update(independentJson(expected),'utf8').digest('hex'); assert.equal(RULES_DIGEST,digest);
  assert.equal(getRules()!.rulesDigest,digest);
  const state=fixture(); assert.equal(stateHash(state),createHash('sha256').update(canonicalState(state),'utf8').digest('hex'));
  const vertices=getRules()!.path.vertices;
  for(let i=0;i<4;i++)assert.deepEqual(pathPosition(i*5000),vertices[i]);
  assert.deepEqual(pathPosition(19999),{x:vertices[0].x,y:vertices[0].y+1});
});


test('merge distinct IDs and keep membership are preflight shape constraints before replay applies entries',()=>{
  const state=fixture(), h=header(state), first=state.acceptedLog[0];
  if(first.type!=='command')throw new Error();
  const before=structuredClone(state);
  for(const command of [
    {type:'merge',ids:[1,1,1],keepId:1},
    {type:'merge',ids:[1,2,2],keepId:1},
    {type:'merge',ids:[1,2,3],keepId:4},
  ]) {
    failure(h,[{...first,atTick:999},{type:'command',seq:2,atTick:0,command,events:[]}],'BAD_FORMAT',1);
  }
  failure(h,[{type:'command',seq:1,atTick:0,
    command:{type:'merge',ids:[1,2,3],keepId:1},events:[]}],'COMMAND_REJECTED',0);
  assert.deepEqual(state,before);
});
