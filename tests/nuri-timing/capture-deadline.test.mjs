import test from 'node:test';import assert from 'node:assert/strict';
import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
import {terminalFrame,finalCanvasFrame} from './terminal-frame.mjs';
const options=()=>({page:{waitForTimeout:ms=>new Promise(r=>setTimeout(r,ms))},frames:[{file:'fixture.jpg',timestamp:100,receivedAt:1,ackedAt:2,completed:Promise.resolve()}],root:'/unused',terminalTick:10,renderedAt:100,statusBox:{},box:{},reference:'/unused',timeoutMs:10});
for(const [name,helper] of Object.entries({terminalFrame,finalCanvasFrame})){
 test(`${name}: 10ms deadline rejects unfinished first frame despite ready second frame`,async()=>{
  const args=options();let release,settled=false;args.frames.unshift({...args.frames[0],completed:new Promise(r=>release=r)});
  const pending=helper(args).finally(()=>{settled=true;});const rejection=assert.rejects(pending,/Capture deadline exceeded/);
  await new Promise(r=>setTimeout(r,40));assert(settled,'must reject without waiting for first completion');await rejection;
  release();await new Promise(r=>setTimeout(r,0)); // Late completion cannot turn the rejected request into success.
 });
 test(`${name}: subprocess receives remaining deadline and is killed on timeout`,async t=>{
  const real=cp.execFileSync;let called=false;
  t.mock.method(cp,'execFileSync',(_command,_args,opts)=>{called=true;assert(opts.timeout>0&&opts.timeout<=10);assert.equal(opts.killSignal,'SIGKILL');return real(process.execPath,['-e','setTimeout(()=>{},1000)'],{timeout:opts.timeout,killSignal:opts.killSignal,stdio:'ignore'});});syncBuiltinESMExports();
  try{await assert.rejects(helper(options()),e=>e.code==='ETIMEDOUT'||/Capture deadline exceeded/.test(e.message));assert(called);}finally{t.mock.restoreAll();syncBuiltinESMExports();}
 });
 test(`${name}: a late otherwise-valid subprocess result cannot succeed`,async t=>{
  t.mock.method(cp,'execFileSync',()=>{const end=performance.now()+25;while(performance.now()<end){}return name==='terminalFrame'?Buffer.from('crop'):JSON.stringify({meanAbsoluteError:0,largeErrorPixels:0,pixels:122400});});syncBuiltinESMExports();
  try{await assert.rejects(helper(options()),/Capture deadline exceeded/);}finally{t.mock.restoreAll();syncBuiltinESMExports();}
 });
}
