/** Actual browser surface lifetime/late attachment; no arbitrary core state importer. */
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const root=process.env.EVIDENCE_DIR??'artifacts/popo-surface';await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium'});
const results=[];
for(const viewport of [{width:390,height:844},{width:1165,height:747}]){
 const p=await browser.newPage({viewport});await p.goto(process.env.REVIEW_URL??'http://127.0.0.1:4198/popo-timing.html');await p.waitForFunction(()=>window.popoReview?.snapshot().audit.length);
 // Compare every changed RGBA byte from the actual surface stroke, not just RGB>=8 audit pixels.
 await p.evaluate(()=>{window.strokeChecks=[];const proto=CanvasRenderingContext2D.prototype,stroke=proto.stroke;
  proto.stroke=function(...args){if(this.canvas!==document.querySelector('canvas')||!['#fff4cd','#6d5637'].includes(this.strokeStyle))return stroke.apply(this,args);
   const before=this.getImageData(0,0,360,260).data;const result=stroke.apply(this,args);const after=this.getImageData(0,0,360,260).data,changed=[];
   for(let y=0;y<260;y++)for(let x=0;x<360;x++){const i=(y*360+x)*4;if([0,1,2,3].some(k=>before[i+k]!==after[i+k]))changed.push({x:x+.5,y:y+.5});}
   window.strokeChecks.push({tick:window.popoReview.snapshot().tick,changed});return result;};
 });
 for(const start of [122,146]){
  const impact=start+6;
  await p.evaluate(async start=>{window.strokeChecks=[];popoReview.configure(36,0,12);await popoReview.reset(start,true);},start);
  await p.waitForFunction(t=>popoReview.snapshot().tick>=t,impact+2);
  const pixels=await p.evaluate(()=>({checks:window.strokeChecks,audit:popoReview.snapshot().audit}));
  assert(pixels.checks.length>0);
  for(const c of pixels.checks){assert.equal(c.tick,impact);const frame=pixels.audit.find(a=>a.tick===c.tick&&a.surfaceContacts.length);assert(frame);
   for(const v of c.changed)for(const e of frame.enemyPixels){const dx=v.x-e.position.x,dy=v.y-e.position.y;assert(!((dx/11.5)**2+(dy/12.5)**2<=1||(Math.abs(dx)<=14&&dy>=-21&&dy<=-15)),'any-alpha cue pixel entered protected body/HP');}}
  await p.screenshot({path:`${root}/${viewport.width}-${start}-after-contact.png`});
  // Enter at impact without the event: no fabricated aftermath. Initial flight attachment then
  // delivery of a real impact may create a cue, but never replays the old flight after impact.
  await p.evaluate(t=>popoReview.attach(t),impact);let s=await p.evaluate(()=>popoReview.snapshot());assert.equal(s.audit.at(-1).surfaceContacts.length,0);assert.equal(s.audit.at(-1).rasterContacts.length,0);
  await p.evaluate(async t=>{popoReview.configure(36,250,12);await popoReview.reset(t,true);},start+3);
  await p.waitForFunction(t=>popoReview.snapshot().tick>=t,impact);
  s=await p.evaluate(()=>popoReview.snapshot());const late=s.audit.find(a=>a.surfaceContacts.length);assert(late);assert.equal(late.surfaceContacts[0].direction,'source');assert.equal(late.flightPixels.length,0);
  // Freeze exactly on the real impact and change all effects/body heights. Surface is fixed.
  const frozen=await p.evaluate(async start=>{popoReview.configure(36,0,12);await popoReview.reset(start,true);return new Promise(resolve=>{function inspect(){const s=popoReview.snapshot();if(s.audit.at(-1).surfaceContacts.length){popoReview.pause();resolve(s);}else requestAnimationFrame(inspect);}requestAnimationFrame(inspect);});},start);
  const surface=frozen.audit.at(-1).surfaceContacts;
  for(const size of ['32','36'])for(const effect of ['8','10','12','0']){await p.selectOption('#size',size);await p.selectOption('#effect',effect);s=await p.evaluate(()=>popoReview.snapshot());assert.equal(s.hash,frozen.hash);assert.deepEqual(s.audit.at(-1).surfaceContacts,surface);assert.equal(s.audit.at(-1).flightPixels.length,0);}
  await p.screenshot({path:`${root}/${viewport.width}-${start}-paused-surface.png`});
  await p.waitForTimeout(100);assert.equal((await p.evaluate(()=>popoReview.snapshot())).hash,frozen.hash);
  await p.evaluate(()=>popoReview.reset(122,false));s=await p.evaluate(()=>popoReview.snapshot());assert.equal(s.audit.at(-1).surfaceContacts.length,0);assert.equal(s.audit.at(-1).impact.length,0);
  results.push({viewport,start,anyAlphaProtectedChanges:0,lateFallback:late.surfaceContacts,paused:surface,resetCleared:true});
 }
 await p.close();
}
await fs.writeFile(`${root}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
