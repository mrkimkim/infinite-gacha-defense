import assert from 'node:assert/strict';
/** Separate from proof acceptance: one budget for all post-proof recorder work. */
export function recorderEnd(timeoutMs=10000){
 assert(Number.isFinite(timeoutMs)&&timeoutMs>0,'Invalid recorder end timeout');const end=performance.now()+timeoutMs;
 const remaining=()=>{const ms=end-performance.now();if(ms<=0)throw Error('Recorder end deadline exceeded');return Math.max(1,Math.ceil(ms));};
 return{remaining,async wait(operation){remaining();let timer;try{const value=await Promise.race([Promise.resolve().then(()=>{remaining();return operation();}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Recorder end deadline exceeded')),remaining());})]);remaining();return value;}finally{clearTimeout(timer);}}};
}
export async function stopAndDrain(client,frames,onFrame,end=recorderEnd()){
 // Stop completion establishes the cutoff. Remove the listener before taking the drain snapshot.
 // On failure, also remove it so cleanup cannot accumulate more frame writes/ACKs.
 try{await end.wait(()=>client.send('Page.stopScreencast'));}finally{client.off('Page.screencastFrame',onFrame);}
 await end.wait(()=>Promise.all(frames.map(frame=>frame.completed)));
}
export async function closeRecorderBrowser(browser,timeoutMs=5000){
 // Explicit failure if close itself stalls; do not hang the runner or report successful cleanup.
 await recorderEnd(timeoutMs).wait(()=>browser.close());
}
