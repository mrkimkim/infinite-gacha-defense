import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {execFileSync}from'node:child_process';
import {chromium}from'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const root='/workspace/scratch/pr52-motion-21948a8',width=Number(process.env.WIDTH??390),mode=process.env.MODE??'png',run=process.env.RUN??`${width}-${mode}-memory`,seconds=Number(process.env.SECONDS??23),dir=root+'/'+run;await fs.mkdir(dir,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:'/workspace/scratch/schema4-graphics-play',encoding:'utf8'}).trim();assert.equal(sha,'21948a8458837dcf93da91e1c9278928f4c2ccee');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:4244/schema4-play.html');await page.waitForFunction(()=>window.graphicsReview?.snapshot().ready);
 for(const [slot,col,row]of [[0,0,3],[2,1,3]]){await page.locator('#offers button').nth(slot).click();await page.click('#buy');await page.locator(`#board button[data-col="${col}"][data-row="${row}"]`).click();}
 await page.locator('canvas').evaluate(e=>e.scrollIntoView({block:'center'}));
 const client=await page.context().newCDPSession(page),frames=[];
 const handler=e=>{const f={timestamp:e.metadata.timestamp,receivedAt:Date.now(),ackedAt:null,data:e.data};frames.push(f);f.done=client.send('Page.screencastFrameAck',{sessionId:e.sessionId}).then(()=>{f.ackedAt=Date.now()});};client.on('Page.screencastFrame',handler);
 await client.send('Page.startScreencast',{format:mode,quality:mode==='jpeg'?95:undefined,everyNthFrame:1});
 await page.click('#start');await page.waitForTimeout(seconds*1000);
 await client.send('Page.stopScreencast');client.off('Page.screencastFrame',handler);await Promise.all(frames.map(f=>f.done));
 const snapshot=await page.evaluate(()=>window.graphicsReview.snapshot()),replay=await page.evaluate(()=>window.graphicsReview.replay());await page.screenshot({path:dir+'/end.png'});
 const ext=mode==='jpeg'?'jpg':'png',metadata=[];
 for(let i=0;i<frames.length;i++){const f=frames[i],file=String(i).padStart(5,'0')+'.'+ext;await fs.writeFile(dir+'/'+file,Buffer.from(f.data,'base64'));metadata.push({file,timestamp:f.timestamp,receivedAt:f.receivedAt,ackedAt:f.ackedAt});}
 await fs.writeFile(dir+'/frames.json',JSON.stringify(metadata));await fs.writeFile(dir+'/snapshot.json',JSON.stringify(snapshot));await fs.writeFile(dir+'/replay.json',JSON.stringify(replay));await fs.writeFile(dir+'/run.json',JSON.stringify({sha,run,viewport:{width,height:844},normalRAF:true,clockInstalled:false,mode,quality:mode==='jpeg'?95:null,secondsRequested:seconds,frames:frames.length,originalSeconds:frames.at(-1).timestamp-frames[0].timestamp,writeStrategy:'base64 frames buffered in host memory; immediate ACK; no disk writes/encoding/snapshot polling during combat capture',errors},null,2));console.log(run,frames.length,snapshot.observation.tick,snapshot.observation.phase);
}finally{await browser.close()}
