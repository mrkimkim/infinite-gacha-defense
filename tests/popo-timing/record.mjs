const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const root=process.env.EVIDENCE_DIR??'artifacts/popo-timing';await fs.mkdir(root,{recursive:true});
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});const results=[],runs=[];
for(const viewport of [{width:390,height:844},{width:1165,height:747}])for(const size of [32,36])for(const delay of [0,150,250])for(const startTick of [122,146]){
 if(startTick===146&&delay!==0)continue;
 const id=`${startTick}-${viewport.width}-${size}-${delay}`,dir=`${root}/${id}`;await fs.mkdir(dir,{recursive:true});
 const p=await b.newPage({viewport});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(process.env.REVIEW_URL??'http://127.0.0.1:4198/popo-timing.html');await p.waitForFunction(()=>window.popoReview?.snapshot().audit.length>0);
 const client=await p.context().newCDPSession(p),frames=[],writes=[];
 client.on('Page.screencastFrame',e=>{const file=`${String(frames.length).padStart(4,'0')}.jpg`;frames.push({file:`${id}/${file}`,timestamp:e.metadata.timestamp});writes.push(fs.writeFile(`${dir}/${file}`,Buffer.from(e.data,'base64')));void client.send('Page.screencastFrameAck',{sessionId:e.sessionId});});
 await client.send('Page.startScreencast',{format:'jpeg',quality:90,everyNthFrame:1});
 await p.evaluate(async ({size,delay,startTick})=>{window.popoReview.configure(size,delay);await window.popoReview.reset(startTick,true);},{size,delay,startTick});
 await p.waitForFunction(t=>window.popoReview.snapshot().tick===(t===122?136:160),startTick);await p.waitForTimeout(100);
 const snap=await p.evaluate(()=>window.popoReview.snapshot());assert.equal(errors.length,0);assert(snap.audit.some(a=>a.impact.includes(startTick===122?10:12)));
 for(const a of snap.audit.filter(a=>a.tick>=(startTick===122?128:152)))assert(!a.flights.includes(startTick===122?10:12),'dead attack resurrected');
 if(delay===0){for(const phase of ['준비','방출','비행','접촉·피해'])assert(snap.audit.some(a=>a.phase===phase),`missing ${phase}`);}
 await client.send('Page.stopScreencast');await Promise.all(writes);
 await p.screenshot({path:`${dir}/final.png`});
 const lifecycle=await p.evaluate(()=>window.popoReview.lifecycle());assert.equal(lifecycle.stale,null);assert.equal(lifecycle.resetStale,null);assert.equal(lifecycle.impact.flights.length,0);assert.equal(lifecycle.after.flights.length,0);
 const current=await p.evaluate(()=>window.popoReview.snapshot());await p.waitForTimeout(180);assert.equal((await p.evaluate(()=>window.popoReview.snapshot())).hash,current.hash);
 for(const tick of [124,127,128]){await p.evaluate(t=>window.popoReview.attach(t),tick);const at=await p.evaluate(()=>window.popoReview.snapshot());assert.equal(at.audit.at(-1).tick,tick);if(tick===128)assert.equal(at.audit.at(-1).flights.length,0);}
 const race=await p.evaluate(()=>Promise.all([window.popoReview.reset(127,false),window.popoReview.reset(122,false)]));assert.deepEqual(race,[false,true]);
 results.push({id,viewport,size,delay,startTick,hash:snap.hash,frames:frames.length,phases:[...new Set(snap.audit.map(a=>a.phase))],lifecycle,race});runs.push({id,frames});await fs.writeFile(`${dir}/audit.json`,JSON.stringify(snap,null,2));await p.close();
}
for(const tick of [122,146])assert.equal(new Set(results.filter(r=>r.startTick===tick).map(r=>r.hash)).size,1);
await fs.writeFile(`${root}/results.json`,JSON.stringify(results,null,2));await fs.writeFile(`${root}/runs.json`,JSON.stringify(runs,null,2));
await fs.writeFile(`${root}/normal-speed-player.html`,`<!doctype html><meta charset="utf-8"><title>Actual RAF captures</title><style>body{background:#15251f;color:white;font:16px system-ui}img{max-width:100%;max-height:85vh}button,select{margin:10px;padding:8px}</style><p>Actual Chromium screencast JPEGs. Original CDP timestamps, normal speed. No synthesized intermediate frames.</p><select id="choose">${runs.map((r,i)=>`<option value="${i}">${r.id}</option>`).join('')}</select><button id="play">Play</button><span id="time"></span><br><img id="frame"><script>const runs=${JSON.stringify(runs)};let token=0;const choose=document.querySelector('#choose'),img=document.querySelector('#frame');function play(){const mine=++token,frames=runs[+choose.value].frames,start=performance.now(),first=frames[0].timestamp;function step(now){if(mine!==token)return;const seconds=(now-start)/1000;let i=0;while(i+1<frames.length&&frames[i+1].timestamp-first<=seconds)i++;img.src=frames[i].file;document.querySelector('#time').textContent=seconds.toFixed(2)+'s';if(i+1<frames.length)requestAnimationFrame(step)}requestAnimationFrame(step)}document.querySelector('#play').onclick=play;choose.onchange=play;play();</script>`);
console.log(JSON.stringify(results.map(({id,hash,frames,phases})=>({id,hash,frames,phases})),null,2));await b.close();
