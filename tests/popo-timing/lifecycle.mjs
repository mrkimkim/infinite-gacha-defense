/** Browser regressions: real adapter, injected browser decode rejection, actual RAF pause. */
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const root=process.env.EVIDENCE_DIR??'artifacts/popo-lifecycle';await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
for(const viewport of [{width:390,height:844},{width:1165,height:747}]){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
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
 assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).tick,122);
 // Failure replacing a painted flight clears its canvas, phase and damage ledger immediately.
 await page.evaluate(()=>window.popoReview.attach(127));assert(!(await blank()));
 await page.evaluate(async()=>{window.decodeMode='reject';return window.popoReview.reset(146,false);});
 assert(await blank());assert.equal(await page.locator('#ledger').textContent(),'');assert.equal(await page.locator('.steps .active').count(),0);
 const failedHash=(await page.evaluate(()=>window.popoReview.snapshot())).hash;await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).hash,failedHash);
 await page.screenshot({path:`${root}/${viewport.width}-replacement-failure.png`});
 await page.evaluate(()=>window.decodeMode='normal');await page.click('#retry');await page.waitForFunction(()=>window.popoReview.snapshot().audit.length>0);assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).tick,146);
 // Old failure cannot clear a successfully painted new owner.
 await page.evaluate(()=>{window.decodeMode='hold';window.oldReset=window.popoReview.reset(127,false);});assert(await blank());
 await page.evaluate(async()=>{window.decodeMode='normal';await window.popoReview.reset(146,false);});
 const beforeLate=await page.locator('canvas').evaluate(c=>c.toDataURL());
 assert.equal(await page.evaluate(async()=>{window.heldDecodes.splice(0).forEach(d=>d.reject());return window.oldReset;}),false);
 assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),beforeLate);assert.equal(await page.locator('#retry').isVisible(),false);
 // Old success cannot erase a newer owner's failure or its retry scene.
 await page.evaluate(()=>{window.decodeMode='hold';window.oldReset=window.popoReview.reset(127,false);});
 await page.evaluate(async()=>{window.decodeMode='reject';await window.popoReview.reset(122,false);});
 assert.equal(await page.evaluate(async()=>{window.heldDecodes.splice(0).forEach(d=>d.resolve());return window.oldReset;}),false);
 assert(await blank());assert.equal(await page.locator('#retry').isVisible(),true);
 await page.evaluate(()=>window.decodeMode='normal');await page.click('#retry');await page.waitForFunction(()=>window.popoReview.snapshot().audit.length>0);assert.equal((await page.evaluate(()=>window.popoReview.snapshot())).tick,122);
 // Intercept a real RAF frame in-flight, then exercise the real size select handler.
 const paused=await page.evaluate(async()=>{
  window.popoReview.configure(36,0);await window.popoReview.reset(122,true);
  return new Promise(resolve=>{function inspect(){const s=window.popoReview.snapshot(),f=s.audit.at(-1);if(s.tick===127&&f.flightPixels.length&&f.flightPixels[0].position.x>135){window.popoReview.pause();resolve(s);}else requestAnimationFrame(inspect);}requestAnimationFrame(inspect);});
 });
 const position=paused.audit.at(-1).flightPixels;assert.equal(position.length,1);
 for(const size of ['32','36','32']){await page.selectOption('#size',size);const after=await page.evaluate(()=>window.popoReview.snapshot());assert.deepEqual(after.audit.at(-1).flightPixels,position);assert.equal(after.hash,paused.hash);}
 await page.waitForTimeout(120);assert.deepEqual((await page.evaluate(()=>window.popoReview.snapshot())).audit.at(-1).flightPixels,position);
 await page.screenshot({path:`${root}/${viewport.width}-paused-resize.png`});
 await page.evaluate(()=>window.popoReview.resume());await page.waitForFunction(()=>window.popoReview.snapshot().tick===136);
 assert.equal(errors.length,0);results.push({viewport,initialReject:true,retry:true,paintedSceneReject:true,lateReject:true,lateSuccessAfterNewReject:true,pauseResizePosition:position,noUnhandledErrors:true});await page.close();
}
await fs.writeFile(`${root}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
