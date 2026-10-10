import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {routeInput,requireV2Core} from '../../src/cli/schema-routing.ts';
import * as checkpoint from '../../src/core-v2/index.ts';
test('schema1 stays default, schema2 requires explicit profile; replay envelopes are strict',()=>{
  assert.equal(routeInput('run',{seed:1,steps:[]}).schema,1);
  assert.equal(routeInput('run',{schemaVersion:2,rulesId:checkpoint.EXPERIMENT_RULES_ID,seed:1,steps:[]}).schema,2);
  assert.throws(()=>routeInput('run',{schemaVersion:2,seed:1,steps:[]}),/RULES_REQUIRED/);
  assert.throws(()=>routeInput('run',{schemaVersion:3,seed:1,steps:[]}),/UNSUPPORTED_SCHEMA/);
  const header={schemaVersion:2,rulesId:checkpoint.EXPERIMENT_RULES_ID,rulesDigest:'a'.repeat(64),seed:1};
  assert.equal(routeInput('replay',{header,entries:[],finalHash:'b'.repeat(64)}).data.expectedFinalHash,'b'.repeat(64));
  for(const bad of [{header,entries:{}},{header:{...header,extra:1},entries:[]},{header,entries:[],finalHash:'b'.repeat(64),expectedFinalHash:'b'.repeat(64)}]) assert.throws(()=>routeInput('replay',bad),/BAD_INPUT/);
});
test('API-only v2 CLI reports unavailable engine with no partial state; real v1 still runs',()=>{
  assert.throws(()=>requireV2Core(checkpoint),/CORE_NOT_IMPLEMENTED/);
  const run=(input:unknown)=>spawnSync(process.execPath,['src/cli/main.ts','run','--input','-'],{input:JSON.stringify(input),encoding:'utf8'});
  const v2=run({schemaVersion:2,rulesId:checkpoint.EXPERIMENT_RULES_ID,seed:1,steps:[]});
  assert.equal(v2.status,1);assert.deepEqual(JSON.parse(v2.stdout),{ok:false,error:{code:'CORE_NOT_IMPLEMENTED',entryIndex:null}});
  const v1=run({seed:1,steps:[]});assert.equal(v1.status,0,v1.stderr);assert.equal(JSON.parse(v1.stdout).header.schemaVersion,1);
});
