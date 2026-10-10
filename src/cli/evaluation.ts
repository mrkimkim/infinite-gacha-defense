/** Rules-independent harness. No policy or engine is implemented in this file. */
export type Policy<O, R, C> = (observation: Readonly<O>, rules: Readonly<R>) => readonly C[];
export type Partition = 'tuning' | 'validation';
export type Cohort = 'comparison' | 'stress';
export type Job = Readonly<{profile:string; policy:string; seed:number; partition:Partition; cohort:Cohort}>;
export type PolicyDefinition = Readonly<{id:string;cohort:Cohort}>;
const privateKeys = new Set(['seed','rngState','nextEntityId','acceptedLog','prng','futureOffers','replay']);
/** Fail closed before either callback: policy inputs must be plain public JSON. */
export function publicSnapshot<T>(value:T):Readonly<T> {
  const seen=new Set<object>();
  function copy(v:unknown):unknown {
    if(v===null||typeof v==='string'||typeof v==='boolean') return v;
    if(typeof v==='number'&&Number.isFinite(v)) return v;
    if(typeof v!=='object'||v===null||seen.has(v)) throw new Error('NON_PUBLIC_POLICY_INPUT');
    const proto=Object.getPrototypeOf(v);
    if(!Array.isArray(v)&&proto!==Object.prototype&&proto!==null) throw new Error('NON_PUBLIC_POLICY_INPUT');
    seen.add(v);
    const descriptors=Object.getOwnPropertyDescriptors(v);
    const out:unknown[]|Record<string,unknown>=Array.isArray(v)?[]:{};
    for(const [key,d] of Object.entries(descriptors)) {
      if(Array.isArray(v)&&key==='length') continue;
      if(privateKeys.has(key)||!('value' in d)||key==='__proto__') throw new Error('NON_PUBLIC_POLICY_INPUT');
      Object.defineProperty(out,key,{value:copy(d.value),enumerable:true,writable:false,configurable:false});
    }
    if(Object.getOwnPropertySymbols(v).length) throw new Error('NON_PUBLIC_POLICY_INPUT');
    seen.delete(v);return Object.freeze(out);
  }
  return copy(value) as Readonly<T>;
}
export function evaluationPlan(profiles:readonly string[], policies:readonly PolicyDefinition[], tuning:readonly number[], validation:readonly number[]):Job[] {
  const valid=(xs:readonly number[])=>xs.length>0&&new Set(xs).size===xs.length&&xs.every(n=>Number.isSafeInteger(n)&&n>=1&&n<=4294967295);
  if(!valid(tuning)||!valid(validation)||tuning.some(n=>validation.includes(n))) throw new Error('BAD_SEED_PARTITION');
  if(!profiles.length||profiles.some(x=>!x)||new Set(profiles).size!==profiles.length) throw new Error('BAD_PROFILE_SET');
  if(!policies.length||policies.some(p=>!p.id)||new Set(policies.map(p=>p.id)).size!==policies.length) throw new Error('BAD_POLICY_SET');
  return profiles.flatMap(profile=>policies.flatMap(p=>(['tuning','validation'] as const).flatMap(partition=>
    (partition==='tuning'?tuning:validation).map(seed=>({profile,policy:p.id,cohort:p.cohort,partition,seed})))));
}
export interface EnginePort<S,O,R,C,E> {
  create(seed:number,profile:string):S;
  publicRules(state:S):R;
  observe(state:S):O;
  inspect(observation:O):{phase:'preparation'|'combat'|'result';tick:number;wave:number;outcome:'win'|'loss'|null;reason:string|null};
  dispatch(state:S,command:C):{state:S;events:readonly E[]};
  advance(state:S):{state:S;events:readonly E[]};
  finish(state:S):{canonical:string;hash:string;replay:unknown};
}
/** Adapter exceptions abort the run; incomplete/rejected execution is never a game loss. */
export function runEvaluation<S,O,R,C,E>(engine:EnginePort<S,O,R,C,E>, policy:Policy<O,R,C>, job:Job,
  onAccepted:(before:O,after:O,events:readonly E[])=>void=()=>{}, maxSteps=20000) {
  if(!Number.isSafeInteger(maxSteps)||maxSteps<1) throw new Error('BAD_STEP_LIMIT');
  let state=engine.create(job.seed,job.profile);
  for(let step=0;step<maxSteps;step++) {
    const before=engine.observe(state),info=engine.inspect(before);
    if(info.phase==='result') {
      if(info.outcome===null) throw new Error('INVALID_TERMINAL_RESULT');
      return {...job,status:'engine-completed' as const,outcome:info.outcome,reason:info.reason,
        wave:info.wave,tick:info.tick,...engine.finish(state)};
    }
    if(info.phase==='combat') {
      const next=engine.advance(state),after=engine.observe(next.state);
      if(engine.inspect(after).tick<=info.tick) throw new Error('ADVANCE_NO_PROGRESS');
      onAccepted(before,after,next.events);state=next.state;
    } else {
      const commands=policy(publicSnapshot(before),publicSnapshot(engine.publicRules(state)));
      if(commands.length===0) throw new Error('POLICY_STUCK');
      // One decision per observed state; multi-step search must re-observe after each action.
      const next=engine.dispatch(state,commands[0]),after=engine.observe(next.state);
      onAccepted(before,after,next.events);state=next.state;
    }
  }
  throw new Error('EVALUATION_STEP_LIMIT');
}
export type CompletedRun = Job & {outcome:'win'|'loss';reason:string|null;wave:number;bossWavesStarted:readonly number[]};
export function summarize(runs:readonly CompletedRun[]) {
  const groups=new Map<string,{games:number;wins:number;lossReasons:Record<string,number>;bossWalls:Record<string,{started:number;failed:number}>}>();
  for(const r of runs) {
    const key=JSON.stringify([r.profile,r.policy,r.partition,r.cohort]);
    const g=groups.get(key)??{games:0,wins:0,lossReasons:{},bossWalls:{}};g.games++;if(r.outcome==='win')g.wins++;
    if(r.outcome==='loss')g.lossReasons[r.reason??'unknown']=(g.lossReasons[r.reason??'unknown']??0)+1;
    for(const wave of new Set(r.bossWavesStarted)) {const wall=g.bossWalls[wave]??{started:0,failed:0};wall.started++;
      if(r.outcome==='loss'&&r.wave===wave)wall.failed++;g.bossWalls[wave]=wall;}
    groups.set(key,g);
  }
  return [...groups].map(([key,g])=>({key,...g,winRate:g.wins/g.games}));
}

/** Authoritative public observations projected by a future reviewed adapter. No XP/Lv/books. */
export type Census = Readonly<{wave:number;gold:number;benchCount:number;benchCapacity:number;remainingCount:number;
  formation:readonly {character:string;star:number}[]}>;
export function createCensusMetrics() {
  const value={firstStar2Wave:null as number|null,firstStar3Wave:null as number|null,
    formationChanges:0,formationDiversity:0,maxStagnantWaves:0,benchFullStarts:0,
    idleGoldAtStart:[] as number[],maxRemainingCount:0};
  let previous:string|null=null,stagnant=0;const seen=new Set<string>(),waves=new Set<number>();
  return {value,observe(c:Census,atWaveStart=false) {
    value.maxRemainingCount=Math.max(value.maxRemainingCount,c.remainingCount);
    if(c.formation.some(u=>u.star>=2)&&value.firstStar2Wave===null)value.firstStar2Wave=c.wave;
    if(c.formation.some(u=>u.star>=3)&&value.firstStar3Wave===null)value.firstStar3Wave=c.wave;
    if(!atWaveStart||waves.has(c.wave))return;
    waves.add(c.wave);value.idleGoldAtStart.push(c.gold);if(c.benchCount>=c.benchCapacity)value.benchFullStarts++;
    // Compare character counts; identity churn and star changes alone are not role replacement.
    const key=JSON.stringify(c.formation.map(u=>u.character).sort());seen.add(key);value.formationDiversity=seen.size;
    if(previous!==null){if(previous!==key){value.formationChanges++;stagnant=0;}else stagnant++;}
    previous=key;value.maxStagnantWaves=Math.max(value.maxStagnantWaves,stagnant);
  }};
}
