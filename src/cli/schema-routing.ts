import { createHash } from 'node:crypto';
import type { CoreApi as V2Core, MatchState } from '../core-v2/index.ts';
import { CliError, validateInput, type Mode } from './adapter.ts';
function record(v: unknown): Record<string,unknown> {
  if(v===null||typeof v!=='object'||Array.isArray(v)) throw new CliError('BAD_INPUT',2);
  return v as Record<string,unknown>;
}
export function routeInput(mode: Mode, input: unknown): {schema:1|2;data:Record<string,unknown>} {
  const source=record(input),data={...source};
  let schema:unknown;
  if(mode==='run') {schema=Object.hasOwn(data,'schemaVersion')?data.schemaVersion:1;delete data.schemaVersion;}
  else schema=record(data.header).schemaVersion;
  // Native schema2 replay documents use finalHash; CLI legacy uses expectedFinalHash.
  if(mode==='replay' && Object.hasOwn(data,'finalHash')) {
    if(Object.hasOwn(data,'expectedFinalHash')) throw new CliError('BAD_INPUT',2);
    data.expectedFinalHash=data.finalHash;delete data.finalHash;
  }
  validateInput(mode,data);
  if(schema===undefined) throw new CliError('BAD_INPUT',2);
  if(schema!==1&&schema!==2) throw new CliError('UNSUPPORTED_SCHEMA',2);
  if(schema===2 && mode==='run' && typeof data.rulesId!=='string') throw new CliError('RULES_REQUIRED',2);
  if(mode==='replay') {
    const h=record(data.header);
    if(Object.keys(h).sort().join(',')!=='rulesDigest,rulesId,schemaVersion,seed'
      ||typeof h.rulesId!=='string'||typeof h.rulesDigest!=='string'||!/^[a-f0-9]{64}$/.test(h.rulesDigest)
      ||!Number.isSafeInteger(h.seed)||!Array.isArray(data.entries)) throw new CliError('BAD_INPUT',2);
  }
  return {schema,data};
}
export function requireV2Core(candidate: unknown): V2Core {
  const c=record(candidate);
  for(const key of ['createMatch','dispatch','advance','observe','getRules','canonicalState','stateHash','replay','pathPosition','boardPosition']) {
    if(typeof c[key]!=='function') throw new CliError('CORE_NOT_IMPLEMENTED',1);
  }
  return c as unknown as V2Core;
}
export function executeV2(core: V2Core, mode: Mode, data: Record<string,unknown>) {
  let state: MatchState;
  if(mode==='run') {
    const made=core.createMatch(data.seed,data.rulesId);if(!made.ok) throw new CliError(made.error.code,3);state=made.state;
    for(const [index,step] of (data.steps as Record<string,unknown>[]).entries()) {
      const result=Object.hasOwn(step,'command')?core.dispatch(state,step.command):core.advance(state,step.advance);
      if(!result.ok) throw new CliError(result.error.code,3,index);state=result.state;
    }
  } else {
    const result=core.replay(data.header,data.entries,data.expectedFinalHash);
    if(!result.ok) throw new CliError(result.error.code,3,result.error.entryIndex);state=result.state;
  }
  const canonicalState=core.canonicalState(state),stateHash=createHash('sha256').update(canonicalState).digest('hex');
  if(stateHash!==core.stateHash(state)) throw new CliError('CORE_HASH_MISMATCH',1);
  if(mode==='replay'&&data.expectedFinalHash!==undefined&&stateHash!==data.expectedFinalHash) throw new CliError('FINAL_HASH_MISMATCH',3);
  return {ok:true,summary:{phase:state.phase,outcome:state.outcome,outcomeReason:state.outcomeReason,
    tick:state.tick,wave:state.wave,gold:state.gold},canonicalState,stateHash,
    header:{schemaVersion:2,rulesId:state.rulesId,rulesDigest:state.rulesDigest,seed:state.seed},entries:state.acceptedLog};
}
