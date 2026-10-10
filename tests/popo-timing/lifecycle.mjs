/** Browser regressions: real adapter, injected browser decode rejection, actual RAF pause. */
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const root=process.env.EVIDENCE_DIR??'artifacts/popo-lifecycle';await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[],captures=[];
for(const viewport of [{width:390,height:844},{width:1165,height:747}]){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const capture=async name=>{const file=viewport.width+'-'+name+'.png';await page.screenshot({path:root+'/'+file});captures.push({file,viewport,condition:name,snapshot:await page.evaluate(()=>{const s=window.popoReview.snapshot();return{tick:s.tick,hash:s.hash,frame:s.audit.at(-1),status:document.querySelector('#status').textContent};})});};
 await page.addInitScript(()=>{const decode=HTMLImageElement.prototype.decode;window.decodeMode='reject';window.heldDecodes=[];
  HTMLImageElement.prototype.decode=function(){const mode=window.decodeMode;if(mode==='reject')return Promise.reject(Error('test decode rejection'));
   if(mode==='hold')return new Promise((resolve,reject)=>window.heldDecodes.push({resolve:()=>decode.call(this).then(resolve,reject),reject:()=>reject(Error('late decode rejection'))}));return decode.call(this);};
 });
 await page.goto(process.env.REVIEW_URL??'http://127.0.0.1:4198/popo-timing.html');
 await page.waitForSelector('#retry:visible');
 const blank=()=>page.evaluate(()=>!document.querySelector('canvas').getContext('2d').getImageData(0,0,360,260).data.some(v=>v));
 assert(await blank());assert.equal(await page.locator('#pause').isDisabled(),true);assert.match(await page.locator('#status').textContent(),/불러오지 못했습니다/);
 await page.screenshot({path:`${root}/${viewport.width}-initial-failure.png`});
 await page.evaluate(()=>window.decodeMode='normal');await page.click('#retry');await page.waitForFunction(()=>window.popoReview.snapshot().audit.length>0);
 assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).tick,122);await capture('retry-recovered-122');
 // Failure replacing a painted flight clears its canvas, phase and damage ledger immediately.
 await page.evaluate(()=>window.popoReview.attach(127));assert(!(await blank()));await capture('late-attach-flight-before-reject');
 await page.evaluate(async()=>{window.decodeMode='reject';return window.popoReview.reset(146,false);});
 assert(await blank());assert.equal(await page.locator('#ledger').textContent(),'');assert.equal(await page.locator('.steps .active').count(),0);
 const failedHash=(await page.evaluate(()=>window.popoReview.snapshot())).hash;await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).hash,failedHash);
 await page.screenshot({path:`${root}/${viewport.width}-replacement-failure.png`});
 await page.evaluate(()=>window.decodeMode='normal');await page.click('#retry');await page.waitForFunction(()=>window.popoReview.snapshot().audit.length>0);assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).tick,146);await capture('retry-recovered-146');
 // Old failure cannot clear a successfully painted new owner.
 await page.evaluate(()=>{window.decodeMode='hold';window.oldReset=window.popoReview.reset(127,false);});assert(await blank());
 await page.evaluate(async()=>{window.decodeMode='normal';await window.popoReview.reset(146,false);});
 await capture('reset-new-owner-before-old-rejection');const beforeLate=await page.locator('canvas').evaluate(c=>c.toDataURL());
 assert.equal(await page.evaluate(async()=>{window.heldDecodes.splice(0).forEach(d=>d.reject());return window.oldReset;}),false);
 assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),beforeLate);await capture('reset-new-owner-after-old-rejection');assert.equal(await page.locator('#retry').isVisible(),false);
 // Old success cannot erase a newer owner's failure or its retry scene.
 await page.evaluate(()=>{window.decodeMode='hold';window.oldReset=window.popoReview.reset(127,false);});
 await page.evaluate(async()=>{window.decodeMode='reject';await window.popoReview.reset(122,false);});
 assert.equal(await page.evaluate(async()=>{window.heldDecodes.splice(0).forEach(d=>d.resolve());return window.oldReset;}),false);
 assert(await blank());assert.equal(await page.locator('#retry').isVisible(),true);await capture('new-failure-after-old-success');
 await page.evaluate(()=>window.decodeMode='normal');await page.click('#retry');await page.waitForFunction(()=>window.popoReview.snapshot().audit.length>0);assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).tick,122);await capture('retry-recovered-122');
 // Before/after evidence for the adapter's actual delayed RAF and reset probe.
 await page.evaluate(()=>window.popoReview.attach(127));await capture('before-stale-RAF-flight127');
 const callbackProbe=await page.evaluate(()=>window.popoReview.lifecycle());
 assert.equal(callbackProbe.stale,null);assert.equal(callbackProbe.resetStale,null);assert.equal(callbackProbe.impact.flights.length,0);
 await capture('after-rejected-stale-RAF-reset122');
 // Intercept a real RAF frame in-flight, then exercise the real size select handler.
 const paused=await page.evaluate(async()=>{
  window.popoReview.configure(36,0);await window.popoReview.reset(122,true);
  return new Promise(resolve=>{function inspect(){const s=window.popoReview.snapshot(),f=s.audit.at(-1);if(s.tick===127&&f.flightPixels.length&&f.flightPixels[0].position.x>135){window.popoReview.pause();resolve(s);}else requestAnimationFrame(inspect);}requestAnimationFrame(inspect);});
 });
 const position=paused.audit.at(-1).flightPixels;assert.equal(position.length,1);await capture('paused-before-resize-36');let resizeIndex=0;
 for(const size of ['32','36','32']){await page.selectOption('#size',size);const after=await page.evaluate(()=>window.popoReview.snapshot());assert.deepEqual(after.audit.at(-1).flightPixels,position);assert.equal(after.hash,paused.hash);for(const f of after.audit.at(-1).rasterFlights)if(f.raster?.bodyGapPx!=null)assert(f.raster.bodyGapPx>=2);await capture('paused-after-resize-'+(++resizeIndex)+'-'+size);}
 for(const width of ['12','10','8','0','12']){await page.selectOption('#effect',width);const after=await page.evaluate(()=>window.popoReview.snapshot());assert.deepEqual(after.audit.at(-1).flightPixels,position);assert.equal(after.hash,paused.hash);for(const f of after.audit.at(-1).rasterFlights)if(f.raster?.bodyGapPx!=null)assert(f.raster.bodyGapPx>=2);await capture('paused-effect-'+width);}
 await page.waitForTimeout(120);assert.deepEqual((await page.evaluate(()=>window.popoReview.snapshot())).audit.at(-1).flightPixels,position);
 await page.screenshot({path:`${root}/${viewport.width}-paused-resize.png`});
 await page.evaluate(()=>window.popoReview.resume());await page.waitForFunction(()=>window.popoReview.snapshot().tick===136);
 // Resize effects at the actual pre-contact guard, not only midway through flight.
 const guarded=await page.evaluate(async()=>{window.popoReview.configure(32,0,8);await window.popoReview.reset(122,true);return new Promise((resolve,reject)=>{function inspect(){const s=window.popoReview.snapshot(),a=s.audit.at(-1),f=a.flightPixels[0],t=a.enemyPixels.find(e=>e.id===5);if(s.tick===127&&f&&t&&Math.hypot(f.position.x-t.position.x,f.position.y-t.position.y)<=a.clearance+.001){window.popoReview.pause();resolve(s);}else if(s.tick>=128)reject(Error('missed guard RAF'));else requestAnimationFrame(inspect);}requestAnimationFrame(inspect);});});
 await capture('guard-before-effect-resize');
 for(const width of ['12','10','8','0','12']){await page.selectOption('#effect',width);const s=await page.evaluate(()=>window.popoReview.snapshot());assert.equal(s.hash,guarded.hash);assert.deepEqual(s.audit.at(-1).flightPixels,guarded.audit.at(-1).flightPixels);for(const f of s.audit.at(-1).rasterFlights)if(f.raster?.bodyGapPx!=null)assert(f.raster.bodyGapPx>=2);await capture('guard-effect-'+width);}
 assert.equal(errors.length,0);results.push({viewport,initialReject:true,retry:true,paintedSceneReject:true,lateReject:true,lateSuccessAfterNewReject:true,pauseResizePosition:position,callbackProbe,noUnhandledErrors:true});await page.close();
}
await fs.writeFile(`${root}/captures.json`,JSON.stringify(captures,null,2));
await fs.writeFile(`${root}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
