import { createScheduler } from '../scheduler.ts';
import { createReviewMatch, createFeedback, createLease, ATTACK_TICKS } from './model.ts';
import { createImpactLedger, geometry } from './impacts.ts';
import type { Impact } from './impacts.ts';
import { scenes } from './scenes.ts';
import { drawCandidate, loadCandidate, sources } from './assets.ts';
import type { Candidate } from './assets.ts';
import './style.css';
const root = document.querySelector<HTMLElement>('#review')!;
root.innerHTML = `<p class="eyebrow">EVENT INSPECTION · 최종 공격 미술 아님</p><h1>적이 맞고 사라지는 순간 검수</h1>
<p class="notice">누리·포포 패널은 같은 기술 기물을 비교 표시합니다. 정식 능력 매핑이 아닙니다. 적은 식별·피해·수명 확인용 실루엣입니다. 위·아래·대각 조준 원화는 미지원이며 해당 방향에서는 캐릭터를 idle로 둡니다. 근/원거리는 기하 검수 분류이며 근접/원거리 능력 확정이 아닙니다.</p>
<div class="controls"><label>실제 경기 사례 <select id="scene">${scenes.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}</select></label><label>몸체 <select id="size"><option>36</option><option>32</option></select>px</label>
<button id="start">전투 시작</button><button id="pause">일시정지</button><button id="step">실제 1tick 진행</button><button id="reset">같은 seed 재시작</button><button id="replace">공격자 교체</button></div>
<label><input id="guides" type="checkbox"> 계측 점선 / 범위 경계 표시 (공격 미술 아님)</label><p id="checkpoint"></p><p id="status" role="status"></p><p id="support" class="notice"></p>
<div class="cards">${(['nuri','popo'] as Candidate[]).map(id=>`<article><h2>${sources[id].label}</h2><small>원본 캐릭터 + 검수용 적 실루엣</small><div class="canvas-wrap"><canvas id="${id}" width="320" height="280" aria-label="${sources[id].label} 적 피격 수명 검수"></canvas></div><span class="pose" id="${id}-pose"></span></article>`).join('')}</div>
<h2>확정 피해 전후</h2><p class="muted">주황색은 이번 피해, 초록색은 남은 HP. 사망 잔상은 판정에서 제거된 적이며 400ms의 표시 수명 뒤 사라집니다. 정지하면 표시도 멈춥니다.</p><div id="hits" aria-live="off"></div>
<p id="event"></p><p class="muted">코어는 공격 tick에 피해·사망을 즉시 확정합니다. 묶음 진행 시 첫 화면에서 피격 표시를 시작하고 사건 tick과 표시 tick을 따로 기록합니다. 생존 적의 실제 HP·위치는 최신 관측 그대로입니다. 마지막 타격은 구간 종료 시 검수용 정지 화면에 남습니다.</p>
<details><summary>공격 의도 / 필요한 원화·계약</summary><p>기존 기능 실험: 포포는 단일 편지 투사체, 누리는 주대상 중심 물방울 범위. 가로 3포즈가 근접 주먹을 확정하지 않습니다. 이 화면은 편지·물방울 최종 미술이나 비행을 구현하지 않습니다. 이동체가 도착할 때 피해를 주려면 launch/impact 분리·비행 상태·도착 tick·타깃 소멸 처리와 리플레이 계약 검토가 필요합니다. 상하/대각 조준, 발사 준비, 편지/물방울 원화와 피격·사망 최종 원화는 별도 작업입니다.</p><p><a href="./assets/art-review/provenance.json">원본 SHA·출처</a></p></details>
<details><summary>실제 이벤트·재현 기록</summary><button id="snapshot">기록 내보내기</button><pre id="audit"></pre><textarea id="record" readonly aria-label="재현 기록"></textarea></details>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let match=createReviewMatch(),selected=match.state.units[0].id,selectedIndex=0,staleDrops=0;
const feedback=createFeedback(),ledger=createImpactLedger();feedback.bind(match.owner,selected);ledger.bind(match.owner);
const slots=(['nuri','popo'] as Candidate[]).map(candidate=>({candidate,lease:createLease(),images:null as HTMLImageElement[]|null,error:'',generation:0}));
function bindImages(){for(const slot of slots){const ticket=slot.lease.renew(),owner=match.owner,entity=selected;slot.generation=ticket;slot.images=null;slot.error='';void loadCandidate(slot.candidate).then(images=>{if(!slot.lease.accepts(ticket)||owner!==match.owner||entity!==selected){staleDrops++;render();return;}slot.images=images;render();},()=>{if(slot.lease.accepts(ticket)&&owner===match.owner&&entity===selected)slot.error='이미지 로드 실패';else staleDrops++;render();});}}
const project=(p:{x:number;y:number})=>({x:40+(p.x+500)*.048,y:28+(p.y+500)*.044});
const labels:Record<string,string>={horizontal:'수평',up:'위',down:'아래',diagonal:'대각선'};
/** A deliberately neutral test silhouette, never a replacement for approved enemy art. */
function enemy(ctx:CanvasRenderingContext2D,x:number,y:number,id:number,hp:number,maxHp:number,impact?:Impact,age=0){
  const dead=impact?.defeated??false,flash=Boolean(impact)&&age<ATTACK_TICKS;
  ctx.save();ctx.translate(x,y);if(dead){ctx.globalAlpha=Math.max(.3,1-age/10);if(age>=2)ctx.rotate(Math.PI/2);}
  ctx.fillStyle='#14212a';ctx.beginPath();ctx.ellipse(0,10,13,4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=flash?'#ffcc8a':dead?'#8b99a8':'#b9d6e6';ctx.strokeStyle=flash?'#fff0bf':'#1b263b';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-10,7);ctx.lineTo(-9,-4);ctx.lineTo(-7,-12);ctx.lineTo(-3,-9);ctx.lineTo(3,-9);ctx.lineTo(7,-12);ctx.lineTo(9,-4);ctx.lineTo(10,7);ctx.lineTo(5,10);ctx.lineTo(0,7);ctx.lineTo(-5,10);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#172330';ctx.lineWidth=2;for(const ex of [-4,4]){ctx.beginPath();if(dead){ctx.moveTo(ex-2,-4);ctx.lineTo(ex+2,0);ctx.moveTo(ex+2,-4);ctx.lineTo(ex-2,0);}else{ctx.moveTo(ex,-4);ctx.lineTo(ex,0);}ctx.stroke();}ctx.restore();
  // Outside the face: readable HP loss instead of a star hiding the target.
  ctx.fillStyle='#101e29';ctx.fillRect(x-14,y-21,28,5);
  if(impact){ctx.fillStyle='#ef9c55';ctx.fillRect(x-14,y-21,28*impact.beforeHp/maxHp,5);}
  ctx.fillStyle=dead?'#ff737a':'#73e8a9';ctx.fillRect(x-14,y-21,28*hp/maxHp,5);
  ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillStyle=dead?'#ffb9bd':'#fff';ctx.strokeStyle='#152733';ctx.lineWidth=3;const text=dead?`#${id} 사망`:`#${id}`;ctx.strokeText(text,x,y+23);ctx.fillText(text,x,y+23);
}
function render(){
  const o=match.observe(),sample=feedback.sample(match.owner,o.tick),size=Number(el<HTMLSelectElement>('size').value),paused=scheduler?.getStatus().paused??false,active=ledger.active(match.owner,o.tick),recent=ledger.recent(match.owner),guides=el<HTMLInputElement>('guides').checked;
  const a=sample.attack,g=a?geometry(a.sourcePosition,a.center):null,supported=!g||g.direction==='horizontal',pose=supported?sample.pose:'idle';
  for(const slot of slots){const canvas=el<HTMLCanvasElement>(slot.candidate),ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,320,280);ctx.strokeStyle='#728a8c';ctx.lineWidth=10;ctx.strokeRect(40,28,240,220);ctx.fillStyle='#304a51';ctx.fillRect(64,50,192,176);ctx.lineWidth=1;ctx.strokeStyle='#526a6d';for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(64+i*48,50);ctx.lineTo(64+i*48,226);ctx.moveTo(64,50+i*44);ctx.lineTo(256,50+i*44);ctx.stroke();}
    if(guides)for(const r of active){const s=project(r.attack.sourcePosition),p=project(r.position);ctx.save();ctx.setLineDash([3,5]);ctx.strokeStyle='#9dafb5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(p.x,p.y);ctx.stroke();const unit=o.units.find(u=>u.id===r.attack.unitId),definition=o.rules.characters.find(d=>d.id===unit?.definitionId);if(definition?.behavior==='splash'){const c=project(r.attack.center);ctx.beginPath();ctx.ellipse(c.x,c.y,definition.splashRadius*.048,definition.splashRadius*.044,0,0,Math.PI*2);ctx.stroke();}ctx.restore();}
    for(const u of o.units){if(u.location.kind!=='board')continue;const p=project({x:500+u.location.col*1000,y:500+u.location.row*1000});if(u.id===selected){const facing=a&&a.center.x<a.sourcePosition.x?-1:1;if(slot.images)drawCandidate(ctx,slot.candidate,slot.images,pose,size,p.x,p.y+size/2,facing);else{ctx.fillStyle='#ffc985';ctx.fillText(slot.error||'로딩…',p.x-20,p.y);}}else{ctx.fillStyle='#788c95';ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();}}
    for(const e of o.enemies){const p=project(e.position),r=active.filter(h=>h.enemyId===e.id).at(-1);enemy(ctx,p.x,p.y,e.id,e.hp,e.maxHp,r,r?o.tick-r.shownTick:0);}
    for(const r of active.filter(h=>h.defeated)){const p=project(r.position);enemy(ctx,p.x,p.y,r.enemyId,0,r.maxHp,r,o.tick-r.shownTick);}
    canvas.dataset.pose=pose;canvas.dataset.eventPose=sample.pose;canvas.dataset.entity=String(selected);canvas.dataset.generation=String(slot.generation);canvas.dataset.ready=String(Boolean(slot.images));canvas.dataset.attackTick=a?String(a.tick):'';canvas.dataset.hitCount=String(active.length);canvas.dataset.deaths=String(active.filter(r=>r.defeated).length);canvas.dataset.freshHits=String(active.filter(r=>o.tick-r.shownTick<ATTACK_TICKS).length);
    el(slot.candidate+'-pose').textContent=`${slot.error||(!slot.images?'로딩 중':pose)} · ${size}px · ${supported?'가로 포즈 표본':'해당 방향 포즈 미지원'}`;
  }
  const scene=scenes.find(s=>s.id===el<HTMLSelectElement>('scene').value)!;el('checkpoint').textContent=`관찰 지점 tick ${scene.tick} (${(scene.tick*.05).toFixed(2)}초) · 정상 속도 또는 일시정지 후 1tick으로 검사`;
  el('status').textContent=`${o.phase} · tick ${o.tick} · ${paused?'정지':'재생'} · 실제 공격자 #${selected} (${o.units.find(u=>u.id===selected)?.definitionId})`;
  el('support').textContent=g?`${labels[g.direction]} / ${g.range==='near'?'근거리':'원거리'} ${(g.distance/1000).toFixed(2)}칸 · ${supported?'좌우 반전 포즈 표본만 지원; 발사 미술 미구현':'조준 원화 미지원 → idle 유지'} · 피해 판정은 그대로`:'공격 전 · 적 본체 / HP / 사망 수명 검수';
  el<HTMLButtonElement>('start').disabled=o.phase!=='preparation';el<HTMLButtonElement>('pause').disabled=o.phase!=='combat';el('pause').textContent=paused?'재개':'일시정지';el<HTMLButtonElement>('step').disabled=o.phase!=='combat'||!paused;
  el('event').textContent=a?`선택 공격자 확정 tick ${a.tick} · 표시 화면 tick ${o.tick} · 대상 ${a.hits.map(h=>'#'+h.enemyId).join(', ')}`:'선택 공격자의 확정 공격 대기';
  el('hits').innerHTML=recent.slice(-4).reverse().map(r=>`<div class="hit-row ${r.defeated?'dead':''}" data-enemy="${r.enemyId}" data-tick="${r.attack.tick}"><canvas class="hit-compare" width="164" height="70" aria-label="적 #${r.enemyId} 피해 전후 비교"></canvas><strong>적 #${r.enemyId} ${r.defeated?'사망':'피격'}</strong><span>HP ${r.beforeHp} → ${r.afterHp} / ${r.maxHp} <b>−${r.damage}</b></span><small>공격자 #${r.attack.unitId} · 사건 ${r.attack.tick} / 첫 표시 ${r.shownTick}tick${r.shownTick>r.attack.tick?' · 묶음 후 표시':''}</small></div>`).join('')||'<p>아직 피해 없음</p>';
  el('hits').querySelectorAll<HTMLCanvasElement>('.hit-compare').forEach((canvas,index)=>{const r=recent.slice(-4).reverse()[index],ctx=canvas.getContext('2d')!;enemy(ctx,35,29,r.enemyId,r.beforeHp,r.maxHp);enemy(ctx,126,29,r.enemyId,r.afterHp,r.maxHp,r,0);ctx.font='14px system-ui';ctx.fillStyle='#ffcf98';ctx.fillText('→',80,31);ctx.font='10px system-ui';ctx.fillText('피해 전',35,66);ctx.fillText(r.defeated?'사망 직후':'피해 직후',126,66);});
  el('audit').textContent=JSON.stringify({tick:o.tick,selected,staleDrops,pose,eventPose:sample.pose,supported,geometry:g,attack:a??null,impacts:active,recent,coreHash:match.record().finalHash},null,2);
}
function advance(ticks:number){const before=match.observe().enemies,events=match.advance(ticks);ledger.consume(match.owner,before,events,match.state.tick);feedback.consume(match.owner,events,match.state.tick);render();}
const scheduler=createScheduler({tickMs:50,getMatch:()=>match,getPhase:m=>m.state.phase,advance:(_m,ticks)=>advance(ticks),requestFrame:cb=>requestAnimationFrame(cb),cancelFrame:handle=>cancelAnimationFrame(handle),initiallyHidden:document.hidden});
el('start').onclick=()=>{feedback.bind(match.owner,selected);ledger.bind(match.owner);match.command({type:'startWave'});scheduler.sync();render();};
el('pause').onclick=()=>{scheduler.setPaused(!scheduler.getStatus().paused);render();};
el('step').onclick=()=>{if(!scheduler.getStatus().paused||match.state.phase!=='combat')return;advance(1);scheduler.sync();};
function reset(){const scene=scenes.find(s=>s.id===el<HTMLSelectElement>('scene').value)!;match=createReviewMatch(scene.setup);selectedIndex=0;selected=match.state.units[0].id;ledger.bind(match.owner);feedback.bind(match.owner,selected);scheduler.setPaused(false);scheduler.sync();bindImages();render();}
el('reset').onclick=reset;el('scene').onchange=reset;
el('replace').onclick=()=>{selectedIndex=(selectedIndex+1)%match.state.units.length;selected=match.state.units[selectedIndex].id;feedback.bind(match.owner,selected);ledger.bind(match.owner);bindImages();render();};
el('size').onchange=render;el('guides').onchange=render;el('snapshot').onclick=()=>{el<HTMLTextAreaElement>('record').value=JSON.stringify(match.record());};
document.addEventListener('visibilitychange',()=>{scheduler.setHidden(document.hidden);render();});window.addEventListener('pagehide',()=>{scheduler.dispose();for(const s of slots)s.lease.dispose();});bindImages();render();
