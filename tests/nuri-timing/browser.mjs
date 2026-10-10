const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {terminalFrame} from './terminal-frame.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import * as core from '../../src/core-timing/index.ts';import {scenario,scenes} from '../../src/web/nuri-timing/scenario.ts';
const root=process.env.EVIDENCE_DIR??'artifacts/nuri-timing';await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});const results=[],runs=[];
const url=process.env.REVIEW_URL??'http://127.0.0.1:4200/nuri-timing.html';
try{
for(const viewport of [{width:390,height:844},{width:1165,height:747}])for(const size of [32,36])for(const delay of (process.env.DELAYS??'0,150,250').split(',').map(Number))for(const name of Object.keys(scenes)){
 const config=scenes[name],id=`${name}-${viewport.width}-${size}-${delay}`,dir=root+'/'+id;await fs.mkdir(dir,{recursive:true});
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(url);await page.waitForFunction(()=>window.nuriReview?.snapshot().audit.length>0);
 const client=await page.context().newCDPSession(page),frames=[];client.on('Page.screencastFrame',e=>{const file=id+'/'+String(frames.length).padStart(4,'0')+'.jpg',frame={file,timestamp:e.metadata.timestamp,receivedAt:Date.now(),ackedAt:null,completed:null};frame.completed=Promise.all([fs.writeFile(root+'/'+file,Buffer.from(e.data,'base64')),client.send('Page.screencastFrameAck',{sessionId:e.sessionId}).then(()=>{frame.ackedAt=Date.now();})]);frame.completed.catch(()=>{});frames.push(frame);});
 await client.send('Page.startScreencast',{format:'jpeg',quality:90,everyNthFrame:1});await page.evaluate(async({name,size,delay})=>{window.nuriReview.configure(size,delay);await window.nuriReview.reset(name);},{name,size,delay});
 await page.waitForFunction(({attack,cancel})=>window.nuriReview.snapshot().audit.some(a=>cancel?a.cancelled.includes(attack):a.contacts.some(c=>c.attackId===attack)),{attack:config.attack,cancel:name==='cancel'});
 const terminal=await page.evaluate(({attack,cancel})=>{const s=window.nuriReview.snapshot(),a=s.audit.find(a=>cancel?a.cancelled.includes(attack):a.contacts.some(c=>c.attackId===attack));return{terminalTick:a.tick,renderedAt:(s.timeOrigin+a.wall)/1000};},{attack:config.attack,cancel:name==='cancel'});
 const proof=await terminalFrame({page,frames,root,...terminal,statusBox:await page.locator('#status').boundingBox()});await fs.writeFile(dir+'/terminal-frame.json',JSON.stringify(proof,null,2));
 // The first impact/cancel pixels have arrived and their ACK completed before recording can stop.
 await page.waitForFunction(end=>window.nuriReview.snapshot().tick===end,config.end);await client.send('Page.stopScreencast');await Promise.all(frames.map(f=>f.completed));
 const snap=await page.evaluate(()=>window.nuriReview.snapshot()),replay=await page.evaluate(()=>window.nuriReview.replay());
 assert.equal(errors.length,0);assert.equal(snap.hash,core.stateHash(scenario(name,config.end)));const replayed=core.replay(replay.header,replay.entries,replay.finalHash);assert(replayed.ok);assert.equal(core.stateHash(replayed.state),snap.hash);
 const hit=snap.ledger.impacts.find(a=>a.attackId===config.attack);
 if(name==='cancel'){assert(!hit);assert(snap.ledger.cancelled.includes(config.attack));assert(!snap.audit.some(a=>a.contacts.some(c=>c.attackId===config.attack)));}
 else{assert(hit);assert.deepEqual(hit.hits.map(h=>h.enemyId),config.hits);assert.deepEqual(hit.hits.filter(h=>h.after===0).map(h=>h.enemyId),config.dead);
  const first=snap.audit.find(a=>a.contacts.some(c=>c.attackId===config.attack));assert(first);assert.deepEqual(first.hits.filter(h=>h.attackId===config.attack).map(h=>h.enemyId),config.hits);
  for(const e of hit.outside)assert.equal(first.hp.find(([id])=>id===e.enemyId)?.[1],e.hp,'outside HP changed');
 }
 for(const a of snap.audit){if(a.tick<config.terminal)assert(!a.contacts.some(c=>c.attackId===config.attack));if(a.tick>=config.terminal)assert(!a.flights.some(f=>f.attackId===config.attack));for(const f of a.flights)for(const e of a.enemies)assert(Math.hypot(f.position.x-e.position.x,f.position.y-e.position.y)>=a.clearance-1e-6);}
 if(delay===0){assert(snap.audit.some(a=>a.pose==='preparation'));assert(snap.audit.some(a=>a.pose==='release'));assert(snap.audit.some(a=>a.flights.some(f=>f.attackId===config.attack)));}
 await page.screenshot({path:dir+'/final.png'});await fs.writeFile(dir+'/audit.json',JSON.stringify(snap,null,2));await fs.writeFile(dir+'/replay.json',JSON.stringify(replay));
 const last=[...snap.audit].reverse().find(a=>a.flights.some(f=>f.attackId===config.attack)),contact=snap.audit.find(a=>a.contacts.some(c=>c.attackId===config.attack));const p=last?.flights.find(f=>f.attackId===config.attack)?.position,q=contact?.contacts.find(c=>c.attackId===config.attack)?.position;
 results.push({id,name,viewport,size,delay,hash:snap.hash,frames:frames.length,hits:hit?.hits??[],cancelled:snap.ledger.cancelled,terminalFrame:proof.file,terminalFrameTick:proof.statusTickFromPixels,terminalAckedAt:proof.ackedAt,terminalGap:p&&q?Math.hypot(p.x-q.x,p.y-q.y):null});runs.push({id,frames:frames.map(({completed,...f})=>f)});await page.close();
}
await fs.writeFile(root+'/results.json',JSON.stringify(results,null,2));await fs.writeFile(root+'/runs.json',JSON.stringify(runs,null,2));
await fs.writeFile(root+'/normal-speed-player.html',`<!doctype html><meta charset="utf-8"><title>Nuri real RAF captures</title><style>body{background:#152c30;color:#eff5df;font:16px system-ui}select,button{padding:8px;margin:8px}img{display:block}</style><p>Real Chromium captures, original CDP timestamps. Native pixel dimensions; scroll for larger screens. No generated frames.</p><select id="pick">${runs.map((r,i)=>`<option value="${i}">${r.id}</option>`).join('')}</select><button id="play">Play normal speed</button><span id="time"></span><img id="frame"><script>const runs=${JSON.stringify(runs)};let token=0;const pick=document.querySelector('#pick');function play(){const own=++token,f=runs[+pick.value].frames,start=performance.now();function step(now){if(own!==token)return;let i=0,t=(now-start)/1000;while(i+1<f.length&&f[i+1].timestamp-f[0].timestamp<=t)i++;document.querySelector('#frame').src=f[i].file;document.querySelector('#time').textContent=t.toFixed(2)+'s';if(i+1<f.length)requestAnimationFrame(step)}requestAnimationFrame(step)}pick.onchange=play;document.querySelector('#play').onclick=play;play();</script>`);
console.log(JSON.stringify(results.map(({id,hash,hits,cancelled,terminalGap})=>({id,hash,hits,cancelled,terminalGap})),null,2));}finally{await browser.close();}
