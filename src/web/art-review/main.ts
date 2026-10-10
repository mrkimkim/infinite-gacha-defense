import { createScheduler } from '../scheduler.ts';
import { createReviewMatch, createFeedback, createLease, HIT_TICKS, ATTACK_TICKS } from './model.ts';
import type { Attack } from './model.ts';
import { drawCandidate, loadCandidate, sources } from './assets.ts';
import type { Candidate } from './assets.ts';
import './style.css';
const root = document.querySelector<HTMLElement>('#review')!;
root.innerHTML = `<p class="eyebrow">CANDIDATE · 실제 엔진 이벤트 연결 검수</p><h1>보이는 공격과 실제 명중을 함께 확인</h1>
<p class="notice">누리·포포는 같은 공격자의 시각 표본입니다. 정식 캐릭터 성능 매핑이 아닙니다. seed 1의 합법 영입·배치로 만든 두 기술 기물이 실제로 전투합니다. 선택하지 않은 기물의 공격은 회색 연결선으로 표시합니다.</p>
<div class="controls"><button id="start">전투 시작</button><button id="pause">일시정지</button><button id="step">실제 1tick 진행</button><button id="reset">같은 seed 재시작</button><button id="replace">공격자 교체</button><label>실제 몸체 높이 <select id="size"><option>36</option><option>32</option></select>px</label></div>
<p id="status" role="status"></p><div class="cards">${(['nuri','popo'] as Candidate[]).map(id=>`<article><h2>${sources[id].label}</h2><small>검수용 시각 표본 · 원본/공통 배율 유지</small><div class="canvas-wrap"><canvas id="${id}" width="320" height="280" aria-label="${sources[id].label} 실제 공격 연결"></canvas></div><span class="pose" id="${id}-pose"></span></article>`).join('')}</div>
<p id="event"></p><p class="muted">코어 피해는 공격 이벤트에서 즉시 확정됩니다. 같은 프레임의 밝은 연결선·명중점 섬광·피해 숫자가 실제 hits 좌표를 표시합니다. 느린 투사체나 사전 준비 동작을 가장하지 않습니다. 포즈 유지 100ms + 복귀 150ms는 검수용 표현이며 공격 주기·판정은 코어 그대로입니다. 마지막 타격은 구간 종료 시 정지 화면에 남습니다.</p>
<details><summary>검수 기준과 남은 아트 문제</summary><p>불합격: 팔만 움직이고 대상 연결 없음, 피해보다 늦게 도착하는 투사체, 다른 위치의 피격, 재시작·개체 교체 후 오래된 공격 재생. 누리의 발 벌어짐·조개/꼬리 접촉, 포포의 팔 길이 급변·가방/얼굴 윤곽 변화는 아직 미해결입니다. 연결 성공만으로 production 품질을 승인하지 않습니다. 원본 팔 방향은 좌우 반전만 하며 상하 조준 포즈는 없습니다.</p><p><a href="./assets/art-review/provenance.json">원본 SHA·출처</a></p></details>
<details><summary>실제 이벤트·재현 기록</summary><button id="snapshot">기록 내보내기</button><pre id="audit"></pre><textarea id="record" readonly aria-label="재현 기록"></textarea></details>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let match = createReviewMatch(), selected = match.state.units[0].id, selectedIndex = 0, attacks: Attack[] = [], staleDrops = 0;
const feedback = createFeedback(); feedback.bind(match.owner, selected);
const slots = (['nuri','popo'] as Candidate[]).map(candidate=>({ candidate, lease: createLease(), images: null as HTMLImageElement[] | null, error: '', generation: 0 }));
function bindImages() {
  for(const slot of slots) {
    const ticket = slot.lease.renew(), owner = match.owner, entity = selected; slot.generation = ticket; slot.images = null; slot.error = '';
    void loadCandidate(slot.candidate).then(images=>{
      if(!slot.lease.accepts(ticket) || owner !== match.owner || entity !== selected){ staleDrops++;render();return; }
      slot.images=images;render();
    },()=>{ if(slot.lease.accepts(ticket)&&owner===match.owner&&entity===selected){slot.error='이미지 로드 실패 · 재시작으로 재시도';render();}else{staleDrops++;render();} });
  }
}
const project = (p: {x:number;y:number}) => ({x: 40+(p.x+500)*.048, y: 28+(p.y+500)*.044});
function render() {
  const o=match.observe(), sample=feedback.sample(match.owner,o.tick), size=Number(el<HTMLSelectElement>('size').value), paused=scheduler?.getStatus().paused??false;
  const current=attacks.filter(a=>o.tick-a.tick<HIT_TICKS);
  for(const slot of slots){
    const canvas=el<HTMLCanvasElement>(slot.candidate),ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,320,280);
    ctx.strokeStyle='#728a8c';ctx.lineWidth=10;ctx.strokeRect(40,28,240,220);ctx.fillStyle='#304a51';ctx.fillRect(64,50,192,176);
    ctx.lineWidth=1;ctx.strokeStyle='#526a6d';for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(64+i*48,50);ctx.lineTo(64+i*48,226);ctx.moveTo(64,50+i*44);ctx.lineTo(256,50+i*44);ctx.stroke();}
    for(const enemy of o.enemies){const p=project(enemy.position);ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle=enemy.boss?'#bd6585':'#9aaec3';ctx.fill();ctx.fillStyle='#75d4a5';ctx.fillRect(p.x-6,p.y-9,12*enemy.hp/enemy.maxHp,2);}
    const unit=o.units.find(u=>u.id===selected)!;
    for(const u of o.units){if(u.location.kind!=='board')continue;const p=project({x:500+u.location.col*1000,y:500+u.location.row*1000});if(u.id===selected){const facing=sample.attack&&sample.attack.center.x<sample.attack.sourcePosition.x?-1:1; if(slot.images)drawCandidate(ctx,slot.candidate,slot.images,sample.pose,size,p.x,p.y+size/2,facing);else{ctx.fillStyle='#ffc985';ctx.fillText(slot.error?'로드 실패':'로딩…',p.x-20,p.y);}}else{ctx.fillStyle='#788c95';ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();}}
    for(const a of current){const age=o.tick-a.tick,source=project(a.sourcePosition),chosen=a.unitId===selected;for(const hit of a.hits){const target=project(hit.position),dx=target.x-source.x,face=dx<0?-1:1;const hand={x:source.x+face*(chosen?size*.43:0),y:source.y+(chosen?size*.05:0)};
      ctx.save();ctx.globalAlpha=(1-age/HIT_TICKS)*(chosen?1:.55);
      // Instantaneous connection is shown at the same committed tick as damage, never traveling later.
      if(age<ATTACK_TICKS){ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hand.x,hand.y);ctx.quadraticCurveTo((hand.x+target.x)/2,(hand.y+target.y)/2-6,target.x,target.y);ctx.strokeStyle=chosen?'#ffb84f':'#a1b5c0';ctx.lineWidth=chosen?5:2;ctx.stroke();ctx.strokeStyle='#fff5d7';ctx.lineWidth=1.5;ctx.stroke();}
      ctx.translate(target.x,target.y);ctx.strokeStyle=chosen?'#ffe8a7':'#b9ced3';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,6+age*.8,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const t=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(t)*4,Math.sin(t)*4);ctx.lineTo(Math.cos(t)*(10+age),Math.sin(t)*(10+age));ctx.stroke();}
      ctx.fillStyle='#fff4cd';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(String(hit.damage),0,-12-age);ctx.restore();
    }}
    canvas.dataset.pose=sample.pose;canvas.dataset.entity=String(selected);canvas.dataset.generation=String(slot.generation);canvas.dataset.ready=String(Boolean(slot.images));canvas.dataset.attackTick=sample.attack?String(sample.attack.tick):'';canvas.dataset.hitCount=String(sample.hits.reduce((n,a)=>n+a.hits.length,0));
    el(slot.candidate+'-pose').textContent=`${slot.error||(!slot.images?'로딩 중':sample.pose)} · 공격자 #${unit.id} · ${size}px`;
  }
  el('status').textContent=`${o.phase} · tick ${o.tick} · ${paused?'정지':'재생'} · 실제 공격자 #${selected} (${o.units.find(u=>u.id===selected)?.definitionId})`;
  el<HTMLButtonElement>('start').disabled=o.phase!=='preparation';el<HTMLButtonElement>('pause').disabled=o.phase!=='combat';el('pause').textContent=paused?'재개':'일시정지';el<HTMLButtonElement>('step').disabled=o.phase!=='combat'||!paused;
  const a=sample.attack;el('event').textContent=a?`실제 공격 tick ${a.tick} · #${a.unitId} → ${a.hits.map(h=>`적 #${h.enemyId}, 피해 ${h.damage}, 위치 (${h.position.x}, ${h.position.y})`).join(' / ')}`:'선택한 공격자의 확정 공격 이벤트 대기 중 · 임의 공격 시연 없음';
  el('audit').textContent=JSON.stringify({tick:o.tick,selected,staleDrops,pose:sample.pose,attack:a??null,renderedHits:sample.hits,coreHash:match.record().finalHash},null,2);
}
const scheduler=createScheduler({tickMs:50,getMatch:()=>match,getPhase:m=>m.state.phase,advance:(m,ticks)=>{const events=m.advance(ticks);feedback.consume(m.owner,events);attacks.push(...events.filter((e):e is Attack=>e.type==='attack'));attacks=attacks.filter(a=>m.state.tick-a.tick<HIT_TICKS);render();},requestFrame:cb=>requestAnimationFrame(cb),cancelFrame:handle=>cancelAnimationFrame(handle),initiallyHidden:document.hidden});
el('start').onclick=()=>{feedback.bind(match.owner,selected);attacks=[];match.command({type:'startWave'});scheduler.sync();render();};
el('pause').onclick=()=>{scheduler.setPaused(!scheduler.getStatus().paused);render();};
el('step').onclick=()=>{if(!scheduler.getStatus().paused||match.state.phase!=='combat')return;const events=match.advance(1);feedback.consume(match.owner,events);attacks.push(...events.filter((e):e is Attack=>e.type==='attack'));attacks=attacks.filter(a=>match.state.tick-a.tick<HIT_TICKS);scheduler.sync();render();};
el('reset').onclick=()=>{match=createReviewMatch();selectedIndex=0;selected=match.state.units[0].id;attacks=[];feedback.bind(match.owner,selected);scheduler.setPaused(false);scheduler.sync();bindImages();render();};
el('replace').onclick=()=>{selectedIndex=(selectedIndex+1)%match.state.units.length;selected=match.state.units[selectedIndex].id;feedback.bind(match.owner,selected);attacks=[];bindImages();render();};
el('size').onchange=render;
el('snapshot').onclick=()=>{el<HTMLTextAreaElement>('record').value=JSON.stringify(match.record());};
document.addEventListener('visibilitychange',()=>{scheduler.setHidden(document.hidden);render();});
window.addEventListener('pagehide',()=>{scheduler.dispose();for(const s of slots)s.lease.dispose();});
bindImages();render();
