import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const root=process.env.EVIDENCE_DIR??'/tmp/schema4-direction-layout',baseline=process.env.BASELINE==='1';await fs.mkdir(root,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),checks=[];
try{for(const width of [390,1165]){
 const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{window.directionCanvasText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(text==='기본 방향')window.directionCanvasText.push({text,x:args[0],y:args[1]});return original.call(this,text,...args);};});
 await page.goto(process.env.PLAY_URL??'http://127.0.0.1:4241/schema4-play.html');await page.waitForFunction(()=>window.graphicsReview?.snapshot().ready);
 await page.clock.install({time:new Date('2026-10-11T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-11T00:00:00Z'));
 const buy=async(slot,col,row)=>{await page.locator('#offers button').nth(slot).click();await page.click('#buy');await page.locator(`#board button[data-col="${col}"][data-row="${row}"]`).click();};
 await buy(0,0,0);await buy(2,1,0);await buy(1,0,1);await page.click('#start');
 await page.clock.runFor(100);await page.click('#pause');await page.locator('#board button[data-col="0"][data-row="0"]').click();
 const state=await page.evaluate(()=>window.graphicsReview.snapshot());assert(state.view.units.some(u=>u.id===1&&u.unsupported));assert.equal(state.selection.id,1);
 await page.locator('canvas').evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`${root}/${width}-selected-nuri.png`,fullPage:true});await page.locator('canvas').screenshot({path:`${root}/${width}-selected-nuri-canvas.png`});
 const layout=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};const note=document.querySelector('#direction-note');return{canvas:rect(document.querySelector('canvas')),note:note?rect(note):null,noteText:note?.textContent??null,canvasWarnings:window.directionCanvasText.length,scrollWidth:document.documentElement.scrollWidth,innerWidth};});
 if(!baseline){assert.equal(layout.canvasWarnings,0);assert(layout.note.y>=layout.canvas.bottom);assert(layout.noteText.includes('누리 후보 (02) #1'));assert(layout.noteText.includes('선택'));assert(layout.scrollWidth<=layout.innerWidth);assert(layout.note.x>=0&&layout.note.x+layout.note.width<=layout.innerWidth);const marker=await page.locator('#board button[data-col="0"][data-row="1"]');await marker.click();assert(!(await page.locator('#direction-note').textContent()).includes('(선택)'));await page.locator('#board button[data-col="0"][data-row="0"]').click();assert((await page.locator('#direction-note').textContent()).includes('#1 (선택)'));}
 else assert(layout.canvasWarnings>0);
 await fs.writeFile(`${root}/${width}-selected-state.json`,JSON.stringify({hash:state.hash,observation:state.observation,view:state.view,selection:state.selection},null,2));
 const replay=await page.evaluate(()=>window.graphicsReview.replay());await fs.writeFile(`${root}/${width}-replay.json`,JSON.stringify(replay));
 // Reach the lower panel by normal scrolling and return to pause/resume controls.
 await page.locator('#selection').scrollIntoViewIfNeeded();const lower=await page.locator('#selection').isVisible();await page.locator('#pause').scrollIntoViewIfNeeded();await page.click('#pause');await page.clock.runFor(100);assert((await page.evaluate(()=>window.graphicsReview.snapshot().observation.tick))>state.observation.tick);
 await page.click('#restart');await page.waitForFunction(()=>window.graphicsReview.snapshot().ready);if(!baseline)assert.equal(await page.locator('#direction-note').textContent(),'');
 assert.deepEqual(errors,[]);checks.push({width,pass:true,hash:state.hash,tick:state.observation.tick,layout,lowerSelectionReachable:lower,resumeAdvanced:true,restartClearsNotice:baseline?null:true});await page.close();
}await fs.writeFile(root+'/results.json',JSON.stringify({sha,baseline,checks},null,2));console.log(JSON.stringify({sha,baseline,checks}));}finally{await browser.close();}
