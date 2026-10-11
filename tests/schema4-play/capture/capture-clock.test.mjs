import test from 'node:test';import assert from 'node:assert/strict';
import {terminalFrame,finalCanvasFrame} from './terminal-frame.mjs';
const invalid=[undefined,NaN,Infinity,-Infinity,null,'100'];
const frame=()=>({file:'must-not-read.jpg',timestamp:100,receivedAt:101000,ackedAt:101001,completed:Promise.resolve()});
const options=()=>({page:{waitForTimeout:async()=>{throw Error('unexpected wait');}},frames:[frame()],root:'/no-pixel-io-expected',terminalTick:10,renderedAt:100,statusBox:{},reference:'must-not-read.png',box:{}});
for(const [name,helper] of Object.entries({terminalFrame,finalCanvasFrame})){
 for(const clock of ['timestamp','renderedAt','receivedAt','ackedAt'])test(`${name} rejects missing/nonfinite/nonnumeric ${clock} before pixel success`,async()=>{
  for(const value of invalid){const args=options();if(clock==='renderedAt')args.renderedAt=value;else args.frames[0][clock]=value;
   await assert.rejects(helper(args),new RegExp(`Invalid ${clock==='renderedAt'?'':'CDP '}${clock}: expected a finite number`));
  }
 });
 test(`${name} rejects ACK before receipt`,async()=>{const args=options();args.frames[0].ackedAt=args.frames[0].receivedAt-1;await assert.rejects(helper(args),/CDP ACK precedes receipt/);});
 test(`${name} retains finite stale-frame filtering`,async()=>{const args=options();args.frames[0].timestamp=99;await assert.rejects(helper(args),/unexpected wait/);});
}
