import './style.css';import * as core from '../../core-timing/index.ts';
import type {CombatEvent,Location,CommandEvent} from '../../core-timing/types.ts';
import {createSession} from './session.ts';import {createScheduler,type SchedulerController} from '../scheduler.ts';
import {createPresentation,name,type Images} from './presentation.ts';import {draw} from './draw.ts';import {validateEffectImage} from './effects.ts';
const $=<T extends HTMLElement>(q:string)=>document.querySelector<T>(q)!;
const canvas=$<HTMLCanvasElement>('canvas'),ctx=canvas.getContext('2d')!;
let session=createSession(5,core.EXPERIMENT_RULES_ID,core),scheduler:SchedulerController,ready=false,paused=false,images:Images={},assetGeneration=0,queued:CombatEvent[]=[];
const presentation=createPresentation(),archives:ReturnType<typeof session.record>[]=[],audit:unknown[]=[];
let latest=core.observe(session.match.state),lastView:ReturnType<typeof presentation.present>=null;
const assets={
 'popo-idle':'popo/idle.png','popo-anticipation':'popo/anticipation.png','popo-release':'popo/release.png','popo-recovery':'popo/recovery.png',letter:'popo/v7-letter/effects/v6-baseline-12px.png',
 nuri:'nuri/nuri-direction-correction-raw-v05.png',bubble:'nuri/flight-bubble-raw-v05.png',ripple:'nuri/ground-ripple-reference-v04.png',
};
function makeButton(text:string,run:()=>void,disabled=false,selected=false){const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.setAttribute('aria-pressed',String(selected));const owner=session.match;b.onclick=()=>{if(owner===session.match)run();};return b;}
// Keep interactive nodes (and their pressed/focused identity) for this match.
// A new owner gets new controls; detached old controls retain makeButton's guard.
const controlGroups=new Map<string,{owner:object;buttons:HTMLButtonElement[]}>();
function controls(selector:string,count:number,create:(i:number)=>HTMLButtonElement){
 let group=controlGroups.get(selector);
 if(!group||group.owner!==session.match||group.buttons.length!==count){
  group={owner:session.match,buttons:Array.from({length:count},(_,i)=>create(i))};
  controlGroups.set(selector,group);$(selector).replaceChildren(...group.buttons);
 }
 return group.buttons;
}
function buttonState(b:HTMLButtonElement,text:string,disabled:boolean,selected=false){
 if(b.firstChild?.textContent!==text)b.firstChild!.textContent=text;
 b.disabled=disabled;b.setAttribute('aria-pressed',String(selected));
}
function message(text:string){$('#message').textContent=text;}
function changed(result:{ok:boolean;code?:string;events?:readonly CommandEvent[]}){if(!result.ok){message('명령 거절: '+result.code);return;}const recruit=result.events?.find(e=>e.type==='recruited');message(recruit?`${name(recruit.result.definitionId)} 영입${recruit.upgrades.length?' · 자동승급 '+recruit.upgrades.length+'회':''} · 선택 #${recruit.result.id}`:'');if(result.events?.length)presentation.acceptPreparation(session.match,session.observe(),session.match.state.acceptedLog.length);scheduler.sync();paint(session.match);}
function place(to:Location){changed(session.selectLocation(to));}
function ui(){const o=latest,select=session.selection,editable=ready&&o.phase==='preparation';
 $('#status').textContent=`${o.phase==='combat'?'전투':o.phase==='result'?'종료':'준비'} · ${o.wave}/${o.rules.waveCount} 웨이브 · ${o.gold}G · 잔존 ${o.remainingCount}/${o.countLimit}${paused?' · 일시정지':''}`;
 $('#wave').textContent=o.phase==='result'?`결과 ${o.outcome} · ${o.outcomeReason}`:`구간 ${Math.max(0,o.segmentRemainingTicks)*o.rules.tickMs/1000}초 · ${o.bossRemainingTicks===null?'일반 웨이브':'보스 기한 '+o.bossRemainingTicks*o.rules.tickMs/1000+'초'} · 다음 ${o.nextWave?.wave??'없음'}`;
 $<HTMLButtonElement>('#start').disabled=!ready||!o.canStartWave;$<HTMLButtonElement>('#pause').disabled=!ready||o.phase!=='combat';$('#pause').textContent=paused?'계속':'일시정지';
 $<HTMLButtonElement>('#buy').disabled=!editable||select?.kind!=='offer'||!o.offers.find(f=>f.slot===(select?.kind==='offer'?select.slot:-1))?.recruitPreview.ok;
 $<HTMLButtonElement>('#reroll').disabled=!editable||o.gold<o.rules.rerollCost;$<HTMLButtonElement>('#sell').disabled=!editable||select?.kind!=='unit';$('#reroll').textContent=`새로고침 ${o.rules.rerollCost}G`;
 const offers=controls('#offers',o.offers.length,i=>{const slot=o.offers[i].slot,b=makeButton(' ',()=>changed(session.selectOffer(slot)));b.dataset.slot=String(slot);b.append(document.createElement('small'));return b;});
 o.offers.forEach((f,i)=>{const p=f.recruitPreview,b=offers[i];buttonState(b,f.definitionId?name(f.definitionId)+' · '+f.price+'G':'비어 있음',!editable||!f.definitionId,select?.kind==='offer'&&select.slot===f.slot);const small=b.querySelector('small')!,def=o.rules.characters.find(c=>c.id===f.definitionId),text=def?`${f.rarityId} · 피해${def.damage} · ${def.cooldownTicks*o.rules.tickMs/1000}초 · 사거리${def.range}\n${p.ok?`영입 후 ${p.goldAfter}G · 승급${p.upgrades.length}회`:p.error.code}`:'';if(small.textContent!==text)small.textContent=text;});
 const bench=controls('#bench',o.rules.benchCapacity,slot=>{const b=makeButton(' ',()=>place({kind:'bench',slot}));b.dataset.slot=String(slot);return b;});
 bench.forEach((b,slot)=>{const u=o.units.find(u=>u.location.kind==='bench'&&u.location.slot===slot);buttonState(b,u?name(u.definitionId)+' '+u.star+'★':`대기 ${slot+1}`,!ready,select?.kind==='unit'&&u?.id===select.id);});
 const board=controls('#board',16,i=>{const col=i%4,row=Math.floor(i/4),b=makeButton('',()=>place({kind:'board',col,row}));b.dataset.col=String(col);b.dataset.row=String(row);return b;});
 board.forEach((b,i)=>{const col=i%4,row=Math.floor(i/4),u=o.units.find(u=>u.location.kind==='board'&&u.location.col===col&&u.location.row===row);b.disabled=!ready;b.setAttribute('aria-label',`${row+1}행 ${col+1}열 ${u?name(u.definitionId)+' '+u.star+'성':'빈 칸'}`);});
 const unit=select?.kind==='unit'?o.units.find(u=>u.id===select.id):null;$('#selection').textContent=unit?`선택 #${unit.id} ${name(unit.definitionId)} ${unit.star}★ · 피해${unit.damage} · 보스${unit.bossDamage} · 사거리${unit.range} · 주기${unit.nextAttackCooldown*o.rules.tickMs/1000}초 · 판매${unit.sellGold}G`:select?.kind==='offer'?'선택 상품을 확인한 뒤 영입하세요.':'기물을 선택한 뒤 빈 보드/대기석을 누르세요. 점유 칸은 교환합니다.';
 $('#hits').replaceChildren(...(lastView?.impacts??[]).slice(-6).flatMap(a=>a.hits.map(h=>{const d=document.createElement('div');d.className='hit';d.textContent=`공격${a.attackId} · 기물${a.unitId} → 적${h.enemyId} HP ${h.before}→${h.after}${h.after===0?' 처치':''}`;return d;})));
 $('#contract').textContent=`${o.rules.rulesId}\n${o.rules.rulesDigest}\ntick ${o.tick} · windup ${o.windups.length} / flight ${o.flights.length}`;
}
function paint(token:object){if(token!==session.match)return;latest=session.observe();if(ready){lastView=presentation.present(token,latest,queued,(scheduler?.getStatus().accumulator??0)/latest.rules.tickMs);queued=[];if(lastView){draw(ctx,lastView,images,session.selection?.kind==='unit'?session.selection.id:null);audit.push({wall:performance.now(),tick:lastView.tick,phase:lastView.phase,units:lastView.units,flights:lastView.flights,contacts:lastView.contacts,hits:lastView.hits,cancelled:lastView.cancelled});if(audit.length>5000)audit.shift();}}ui();}
function install(){presentation.bind(session.match,session.observe());scheduler=createScheduler({tickMs:50,getMatch:()=>session.match,getPhase:()=>session.observe().phase,advance:(match,ticks)=>{const r=session.advance(match,ticks);if(r)queued.push(...r.events);},requestFrame:cb=>{const owner=session.match;return requestAnimationFrame(t=>{cb(t);paint(owner);});},cancelFrame:handle=>cancelAnimationFrame(handle),initiallyHidden:document.hidden});scheduler.setPaused(!ready||paused);}
async function load(){const token=session.match,generation=++assetGeneration;ready=false;scheduler.setPaused(true);ctx.clearRect(0,0,360,390);message('후보 이미지를 불러오는 중…');ui();try{const loaded:Images={};await Promise.all(Object.entries(assets).map(async([key,path])=>{const image=new Image();image.src='/assets/schema4-play/'+path;await image.decode();loaded[key]=image;}));validateEffectImage(loaded.letter,12);if(token!==session.match||generation!==assetGeneration)return false;images=loaded;ready=true;$('#retry').hidden=true;message('검수 후보 그래픽 · seed5 상점은 누리/기본03/포포입니다.');scheduler.setPaused(paused);paint(token);return true;}catch{if(token!==session.match||generation!==assetGeneration)return false;$('#retry').hidden=false;message('이미지 로딩 실패. 재시도 전에는 전투가 진행되지 않습니다.');return false;}}
$('#buy').onclick=()=>changed(session.recruitSelected());$('#reroll').onclick=()=>changed(session.reroll());$('#sell').onclick=()=>{if(session.selection?.kind==='unit')changed(session.sell(session.selection.id));};
$('#start').onclick=()=>{const r=session.start();if(r.ok){presentation.clear(session.match,session.observe());paused=false;scheduler.setPaused(false);}changed(r);};
$('#pause').onclick=()=>{paused=!paused;scheduler.setPaused(paused);paint(session.match);};
async function restart(){const seed=Number($<HTMLInputElement>('#seed').value);const result=core.createMatch(seed,core.EXPERIMENT_RULES_ID);if(!result.ok){message('seed 오류: '+result.error.code);return false;}archives.push(session.record());scheduler.dispose();assetGeneration++;queued=[];audit.length=0;lastView=null;session=createSession(seed,core.EXPERIMENT_RULES_ID,core);paused=false;ready=false;install();return load();}
$('#restart').onclick=()=>void restart();$('#retry').onclick=()=>void load();$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(session.record(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='schema4-replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};document.addEventListener('visibilitychange',()=>scheduler.setHidden(document.hidden));
Object.assign(window,{graphicsReview:{snapshot:()=>({timeOrigin:performance.timeOrigin,observation:session.observe(),hash:core.stateHash(session.match.state),selection:session.selection,view:lastView,audit:[...audit],scheduler:scheduler.getStatus(),ready}),replay:()=>session.record(),archives:()=>[...archives]}});
install();void load();
