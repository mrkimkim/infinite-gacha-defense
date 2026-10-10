import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {recorderEnd,stopAndDrain,closeRecorderBrowser} from './recorder-end.mjs';
const never=()=>new Promise(()=>{});
function fixture(send){const client=new EventEmitter();client.send=send;const onFrame=()=>{};client.on('Page.screencastFrame',onFrame);return{client,onFrame};}
async function cleanupRun(work){let cleanup=0,accepted=false;const browser={close:async()=>{cleanup++;}};try{await work();accepted=true;}catch(error){return{error,accepted,get cleanup(){return cleanup;}};}finally{await closeRecorderBrowser(browser,10);}}
test('successful proof then late unfinished frame rejects drain and reaches cleanup without release',{timeout:1000},async()=>{
 const proof={received:true,acked:true};assert(proof.acked);let release;const frames=[{completed:Promise.resolve()}];const {client,onFrame}=fixture(async()=>{frames.push({completed:new Promise(r=>release=r)});});
 const result=await cleanupRun(()=>stopAndDrain(client,frames,onFrame,recorderEnd(10)));
 assert.match(result.error.message,/deadline/);assert.equal(result.cleanup,1);assert.equal(result.accepted,false);assert.equal(client.listenerCount('Page.screencastFrame'),0);
 release();await new Promise(r=>setTimeout(r,0));assert.equal(result.accepted,false);
});
test('stalled stop rejects within end budget, detaches listener, reaches cleanup',{timeout:1000},async()=>{
 const {client,onFrame}=fixture(never);const result=await cleanupRun(()=>stopAndDrain(client,[],onFrame,recorderEnd(10)));assert.match(result.error.message,/deadline/);assert.equal(result.cleanup,1);assert.equal(client.listenerCount('Page.screencastFrame'),0);
});
test('stop rejection and drain rejection both reach cleanup',{timeout:1000},async()=>{
 for(const stage of ['stop','drain']){const {client,onFrame}=fixture(async()=>{if(stage==='stop')throw Error('stop failed');});const frames=stage==='drain'?[{completed:Promise.reject(Error('write failed'))}]:[];frames.forEach(f=>f.completed.catch(()=>{}));const result=await cleanupRun(()=>stopAndDrain(client,frames,onFrame,recorderEnd(50)));assert.match(result.error.message,/failed/);assert.equal(result.cleanup,1);assert.equal(client.listenerCount('Page.screencastFrame'),0);}
});
test('normal stop includes frames received during stop and freezes intake before drain',async()=>{
 const frames=[];let drained=false;const {client,onFrame}=fixture(async()=>{frames.push({completed:Promise.resolve().then(()=>{drained=true;})});});await stopAndDrain(client,frames,onFrame,recorderEnd(100));assert(drained);assert.equal(frames.length,1);assert.equal(client.listenerCount('Page.screencastFrame'),0);
});
test('late stop fulfillment cannot drain or accept after timeout',{timeout:1000},async()=>{
 let release,read=false;const {client,onFrame}=fixture(()=>new Promise(r=>release=r));const frames=[{get completed(){read=true;return Promise.resolve();}}];await assert.rejects(stopAndDrain(client,frames,onFrame,recorderEnd(10)),/deadline/);release();await new Promise(r=>setTimeout(r,0));assert.equal(read,false);
});
test('post-drain output stall reaches cleanup instead of blocking finally',{timeout:1000},async()=>{
 const {client,onFrame}=fixture(async()=>{}),end=recorderEnd(10);const result=await cleanupRun(async()=>{await stopAndDrain(client,[],onFrame,end);await end.wait(never);});assert.match(result.error.message,/deadline/);assert.equal(result.cleanup,1);
});
test('browser close has its own deadline and cannot report successful cleanup when stalled',{timeout:1000},async()=>{let requested=false;await assert.rejects(closeRecorderBrowser({close:()=>{requested=true;return never();}},10),/deadline/);assert(requested);});
