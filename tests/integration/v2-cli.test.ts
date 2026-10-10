import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
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
test('API-only v2 CLI reports unavailable engine with no partial state; real v1 still runs',()=>{
  assert.throws(()=>requireV2Core(checkpoint),/CORE_NOT_IMPLEMENTED/);
  const run=(input:unknown)=>spawnSync(process.execPath,['src/cli/main.ts','run','--input','-'],{input:JSON.stringify(input),encoding:'utf8'});
  const v2=run({schemaVersion:3,rulesId:checkpoint.EXPERIMENT_RULES_ID,seed:1,steps:[]});
  assert.equal(v2.status,1);assert.deepEqual(JSON.parse(v2.stdout),{ok:false,error:{code:'CORE_NOT_IMPLEMENTED',entryIndex:null}});
  const v1=run({seed:1,steps:[]});assert.equal(v1.status,0,v1.stderr);assert.equal(JSON.parse(v1.stdout).header.schemaVersion,1);
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
test('schema2 run and replay fail before engine loading; schema3 replay remains unavailable',()=>{
  const header={schemaVersion:2,rulesId:checkpoint.EXPERIMENT_RULES_ID,rulesDigest:'a'.repeat(64),seed:1};
  for(const [mode,input] of [
    ['run',{schemaVersion:2,seed:1,rulesId:header.rulesId,steps:[]}],
    ['replay',{header,entries:[]}],
    ['replay',{header:{...header,schemaVersion:3},entries:[]}],
  ] as const){
    const r=spawnSync(process.execPath,['src/cli/main.ts',mode,'--input','-'],{input:JSON.stringify(input),encoding:'utf8'});
    const isNew=mode==='replay'&&'header' in input&&input.header.schemaVersion===3;
    assert.equal(r.status,isNew?1:2,r.stderr);
    assert.deepEqual(JSON.parse(r.stdout),{ok:false,error:{code:isNew?'CORE_NOT_IMPLEMENTED':'UNSUPPORTED_SCHEMA',entryIndex:null}});
  }
});
