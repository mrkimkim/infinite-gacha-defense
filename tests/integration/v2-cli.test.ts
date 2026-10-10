import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {routeInput,requireV2Core,replayHeader} from '../../src/cli/schema-routing.ts';
import * as checkpoint from '../../src/core-v2/index.ts';
test('schema1 stays default, schema3 requires explicit profile; replay envelopes are strict',()=>{
  assert.equal(routeInput('run',{seed:1,steps:[]}).schema,1);
  assert.equal(routeInput('run',{schemaVersion:3,rulesId:checkpoint.EXPERIMENT_RULES_ID,seed:1,steps:[]}).schema,3);
  assert.throws(()=>routeInput('run',{schemaVersion:3,seed:1,steps:[]}),/RULES_REQUIRED/);
  assert.throws(()=>routeInput('run',{schemaVersion:2,seed:1,steps:[]}),/UNSUPPORTED_SCHEMA/);
  const header={schemaVersion:3,rulesId:checkpoint.EXPERIMENT_RULES_ID,rulesDigest:'a'.repeat(64),seed:1};
  assert.equal(routeInput('replay',{header,entries:[],finalHash:'b'.repeat(64)}).data.expectedFinalHash,'b'.repeat(64));
  for(const bad of [{header,entries:{}},{header:{...header,extra:1},entries:[]},{header,entries:[],finalHash:'b'.repeat(64),expectedFinalHash:'b'.repeat(64)}]) assert.throws(()=>routeInput('replay',bad),/BAD_INPUT/);
});
test('real schema3 CLI purchases, upgrades, advances and replays canonical state; v1 still runs',()=>{
  assert.equal(requireV2Core(checkpoint),checkpoint);
  const invoke=(mode:string,input:unknown)=>{
    const result=spawnSync(process.execPath,['src/cli/main.ts',mode,'--input','-'],
      {input:JSON.stringify(input),encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const output=JSON.parse(result.stdout);assert.equal(output.ok,true);return output;
  };
  for(const rulesId of Object.keys(checkpoint.RULES_PROPOSALS)) {
    const output=invoke('run',{schemaVersion:3,rulesId,seed:1,steps:[
      {command:{type:'recruit',offerSlot:0}},
      {command:{type:'move',unitId:1,to:{kind:'board',col:3,row:3}}},
      {command:{type:'recruit',offerSlot:1}},
      {command:{type:'reroll'}},
      {command:{type:'recruit',offerSlot:2}},
      {command:{type:'startWave'}},{advance:17},
    ]});
    assert.deepEqual(output.header,{schemaVersion:3,rulesId,seed:1,
      rulesDigest:checkpoint.RULES_DIGESTS[rulesId as keyof typeof checkpoint.RULES_DIGESTS]});
    assert.equal(output.summary.phase,'combat');assert.equal(output.summary.tick,17);
    assert.equal(output.summary.gold,5);assert.equal(output.entries.length,7);
    const purchase=output.entries[4].events[0];assert.equal(purchase.type,'recruited');
    assert.equal(purchase.result.id,4);assert.equal(purchase.result.star,2);
    assert.deepEqual(purchase.result.location,{kind:'board',col:3,row:3});
    assert.equal(output.stateHash,createHash('sha256').update(output.canonicalState).digest('hex'));
    for(const hashKey of ['finalHash','expectedFinalHash']) {
      const replayed=invoke('replay',{header:output.header,entries:output.entries,[hashKey]:output.stateHash});
      assert.deepEqual(replayed,output);
    }
  }
  assert.equal(invoke('run',{seed:1,steps:[]}).header.schemaVersion,1);
});
test('API-only and partially implemented module fixtures remain unavailable',()=>{
  assert.throws(()=>requireV2Core({SCHEMA_VERSION:3}),/CORE_NOT_IMPLEMENTED/);
  for(const key of ['createMatch','dispatch','advance','replay','stateHash']) {
    assert.throws(()=>requireV2Core({...checkpoint,[key]:undefined}),/CORE_NOT_IMPLEMENTED/);
  }
});

test('schema2 replay is explicitly unsupported and schema3 header projection preserves identity',()=>{
  const header={schemaVersion:3 as const,rulesId:checkpoint.EXPERIMENT_RULES_ID,
    rulesDigest:checkpoint.RULES_DIGESTS[checkpoint.EXPERIMENT_RULES_ID],seed:1};
  // Static transport data, not a fabricated engine or gameplay result.
  assert.deepEqual(replayHeader(header),header);
  assert.equal(routeInput('replay',{header,entries:[],finalHash:'b'.repeat(64)}).schema,3);
  assert.throws(()=>routeInput('replay',{header:{...header,schemaVersion:2},entries:[]}),/UNSUPPORTED_SCHEMA/);
});
test('schema3 capability guard rejects a legacy-shaped port lacking previewRecruit',()=>{
  // Never execute these markers as an engine; this tests unavailable capability only.
  const marker=()=>{throw new Error('NOT_AN_ENGINE')};
  const legacy=Object.fromEntries(['createMatch','dispatch','advance','observe','getRules',
    'canonicalState','stateHash','replay','pathPosition','boardPosition'].map(k=>[k,marker]));
  assert.throws(()=>requireV2Core(legacy),/CORE_NOT_IMPLEMENTED/);
});
test('schema2 is unsupported while real schema3 replay rejects the wrong rules digest',()=>{
  const header={schemaVersion:2,rulesId:checkpoint.EXPERIMENT_RULES_ID,rulesDigest:'a'.repeat(64),seed:1};
  for(const [mode,input] of [
    ['run',{schemaVersion:2,seed:1,rulesId:header.rulesId,steps:[]}],
    ['replay',{header,entries:[]}],
    ['replay',{header:{...header,schemaVersion:3},entries:[]}],
  ] as const){
    const r=spawnSync(process.execPath,['src/cli/main.ts',mode,'--input','-'],{input:JSON.stringify(input),encoding:'utf8'});
    const isNew=mode==='replay'&&'header' in input&&input.header.schemaVersion===3;
    assert.equal(r.status,isNew?3:2,r.stderr);
    assert.deepEqual(JSON.parse(r.stdout),{ok:false,error:{code:isNew?'RULES_DIGEST_MISMATCH':'UNSUPPORTED_SCHEMA',entryIndex:null}});
  }
});
