// Run from an exact combined checkout against its local Vite URL.
// Uses the execution environment's existing Playwright, never installs a browser.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2];
if (!url || !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(url)) throw new Error('Provide a local Vite root URL');
const evidence = { status: 'NOT_RUN', browser: null, checks: [], limitation: 'Controlled RAF/visibility probes are not OS tab hiding or human play.' };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  evidence.browser = browser.version();
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let id = 0, now = 0, hidden = false;
    const queue = new Map(), history = new Map(), held = [];
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let hold = false;
    Object.defineProperty(document, 'hidden', {get: () => hidden, configurable: true});
    window.requestAnimationFrame = callback => { const key=++id; queue.set(key,callback); history.set(key,callback); return key; };
    window.cancelAnimationFrame = key => queue.delete(key);
    crypto.subtle.digest = (...args) => hold
      ? new Promise((resolve,reject) => held.push(() => digest(...args).then(resolve,reject))) : digest(...args);
    window.__probe = {
      frame(dt) { now+=dt; const batch=[...queue.values()]; queue.clear(); for(const callback of batch) callback(now); },
      hidden(value) { hidden=value; document.dispatchEvent(new Event('visibilitychange')); },
      lastId() { return id; }, stale(key) { history.get(key)?.(now+500); },
      hold(value) { hold=value; }, release() { hold=false; return Promise.all(held.splice(0).map(job=>job())); },
    };
  });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#phase')?.textContent?.trim());
  const phase = await page.locator('#phase').innerText();
  if (phase === '코어 미연결') {
    const message = await page.locator('#message').innerText();
    assert.match(message, /CORE_NOT_IMPLEMENTED/);
    for (const id of ['snapshot','export','start-wave','pause','restart']) assert.equal(await page.locator(`#${id}`).isDisabled(),true);
    evidence.status='BLOCKED'; evidence.reason=message;
    evidence.checks.push('API-only UI diagnostic and disabled controls confirmed; no gameplay executed');
    process.exitCode=2;
  } else {
    await page.locator('details.diagnostics summary').click({force:true});
    const frame = dt => page.evaluate(dt => window.__probe.frame(dt),dt);
    const tick = async () => Number((await page.locator('#tick').innerText()).replace('tick ',''));
    const cell = (col,row) => page.locator(`.cell[data-col="${col}"][data-row="${row}"]`);
    const offer = slot => page.locator(`.offer[data-offer-slot="${slot}"]`);
    async function snapshot(label) {
      await page.locator('#evidence').evaluate(el => { el.value=''; });
      await page.locator('#snapshot').click({force:true});
      await page.waitForFunction(() => document.querySelector('#evidence').value.length>0);
      const data=JSON.parse(await page.locator('#evidence').inputValue());
      assert.equal(createHash('sha256').update(data.canonicalState,'utf8').digest('hex'),data.stateHash);
      const replay=spawnSync(process.execPath,['src/cli/main.ts','replay','--input','-'],{
        input:JSON.stringify({header:data.header,entries:data.entries,expectedFinalHash:data.stateHash}),encoding:'utf8'});
      assert.equal(replay.status,0,replay.stdout+replay.stderr);
      const node=JSON.parse(replay.stdout);
      assert.equal(node.canonicalState,data.canonicalState); assert.equal(node.stateHash,data.stateHash);
      assert.deepEqual(node.entries,data.entries);
      evidence.checks.push({label,tick:JSON.parse(data.canonicalState).tick,hash:data.stateHash});
      return JSON.parse(data.canonicalState);
    }
    assert.equal(await page.locator('.cell').count(),16);
    const initial=await snapshot('initial browser/Node replay');
    await offer(0).click({force:true}); await cell(0,0).dblclick({force:true});
    let state=await snapshot('repeat recruit click');
    assert.equal(state.units.length,1); assert.equal(state.gold,initial.gold-2);
    // Explicitly reset selection after the second click selected the new unit.
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.selected').count(),0);
    await cell(0,0).click({force:true}); await cell(1,0).click({force:true});
    state=await snapshot('move'); assert.deepEqual(state.units[0].location,{kind:'board',col:1,row:0});
    await offer(1).click({force:true}); await cell(0,0).click({force:true});
    await cell(1,0).click({force:true}); await cell(0,0).click({force:true});
    state=await snapshot('swap'); assert.deepEqual(state.units.find(u=>u.id===1).location,{kind:'board',col:0,row:0});
    await offer(2).click({force:true}); await cell(2,0).click({force:true});
    await offer(0).click({force:true}); await cell(3,0).click({force:true});
    assert.equal(await offer(0).getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#message').innerText(),/부족/);
    assert.equal(await cell(3,0).evaluate(el=>el===document.activeElement),true);
    await snapshot('rejected recruit preserves state and selection');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.selected').count(),0);
    await page.locator('#start-wave').click({force:true}); await frame(0);
    const before=await tick(); await frame(250); assert.equal(await tick(),before+5);
    await frame(251); assert.equal(await tick(),before+5);
    await frame(-1); assert.equal(await tick(),before+5);
    await snapshot('dt250 included,251 and negative discarded');
    const stale=await page.evaluate(()=>window.__probe.lastId());
    await page.locator('#pause').click({force:true});
    const paused=await tick(); await page.evaluate(()=>window.__probe.hidden(true));
    await frame(5000); await page.evaluate(()=>window.__probe.hidden(false));
    await page.evaluate(key=>window.__probe.stale(key),stale); await frame(50);
    assert.equal(await tick(),paused); assert.equal(await page.locator('#pause').innerText(),'계속하기');
    await page.locator('#pause').click({force:true}); await frame(5000); assert.equal(await tick(),paused);
    await frame(50); assert.equal(await tick(),paused+1);
    await snapshot('manual pause survives visibility restoration and stale callback');
    // Keep a real crypto computation pending across result/restart; no game state injection.
    await page.evaluate(()=>window.__probe.hold(true)); await page.locator('#snapshot').click({force:true});
    let frames=0;
    while ((await page.locator('#phase').innerText())!=='경기 종료' && frames++<10000) {
      if ((await page.locator('#phase').innerText())==='편성 시간') await page.locator('#start-wave').click({force:true});
      await frame(50);
    }
    assert.ok(frames<10000,'bounded completion');
    await page.evaluate(()=>window.__probe.hold(false));
    const firstResult=await snapshot('first actual result');
    assert.equal(firstResult.outcome,'loss');
    mkdirSync('tests/integration/evidence',{recursive:true});
    await page.locator('details.diagnostics summary').click({force:true});
    await page.screenshot({path:'tests/integration/evidence/loss-390.png',fullPage:true});
    await page.locator('details.diagnostics summary').click({force:true});
    const oldCallback=await page.evaluate(()=>window.__probe.lastId());
    await page.locator('#restart').click({force:true});
    await page.evaluate(key=>window.__probe.stale(key),oldCallback);
    await page.evaluate(()=>window.__probe.release());
    // Flush the actual WebCrypto promise completion, not a wall-clock game advance.
    await page.evaluate(async()=>{await crypto.subtle.digest('SHA-256',new Uint8Array());});
    assert.equal(await page.locator('#evidence').inputValue(),'');
    assert.equal(await page.locator('#hash').innerText(),'상태 해시: 아직 계산하지 않음');
    const restarted=await snapshot('same seed restart; late crypto and stale RAF discarded');
    assert.deepEqual(restarted,initial);
    // A legal seed1 centre formation was selected offline as a win regression fixture.
    // This is a verification fixture, not an observe-only bot or a skill benchmark.
    for(const [col,row] of [[1,1],[2,1],[2,2]]) { await offer(0).click({force:true}); await cell(col,row).click({force:true}); }
    let fourth=false, winFrames=0;
    while((await page.locator('#phase').innerText())!=='경기 종료' && winFrames++<10000) {
      if((await page.locator('#phase').innerText())==='편성 시간') {
        if((await page.locator('#wave').innerText()).startsWith('2 /') && !fourth) {
          await offer(0).click({force:true}); await cell(1,2).click({force:true}); fourth=true;
        }
        await page.locator('#start-wave').click({force:true});
      }
      await frame(50);
    }
    assert.ok(winFrames<10000);
    const victory=await snapshot('actual five-wave win browser/Node replay');
    assert.equal(victory.outcome,'win'); assert.equal(victory.wave,5);
    await page.locator('details.diagnostics summary').click({force:true});
    await page.screenshot({path:'tests/integration/evidence/win-390.png',fullPage:true});
    await page.locator('details.diagnostics summary').click({force:true});
    await page.locator('#restart').click({force:true});
    assert.deepEqual(await snapshot('restart after win'),initial);
    assert.deepEqual(errors,[]);
    evidence.status='PASS';
    evidence.limitation+=' Both win and loss DOM result/restart paths exercised; no human fun claim. Click force bypasses Playwright RAF stability checks; separate native RAF/hitbox checks remain necessary.';
  }
} catch(error) {
  evidence.status='FAIL'; evidence.error=String(error); process.exitCode=1;
} finally {
  await browser.close(); console.log(JSON.stringify(evidence,null,2));
}
