import './style.css';
import * as core from '../../core-timing/index.ts';
import type {CombatEvent,Observation,Point} from '../../core-timing/types.ts';
import {createConsumer} from './consumer.ts';
import {scenario,supported} from './scenario.ts';
const $=<T extends HTMLElement>(q:string)=>document.querySelector<T>(q)!;
const canvas=$<HTMLCanvasElement>('canvas'),ctx=canvas.getContext('2d')!;
const consumer=createConsumer();
let state=scenario(),owner={},size=36,delay=0,paused=true,lastTime=0,accumulator=0,lastPaint=0,endTick=136;
let observation=core.observe(state),events:readonly CombatEvent[]=[],generation=0;
let assets:Record<string,HTMLImageElement>={},ready=false;
let impacts=new Map<number,{event:Extract<CombatEvent,{type:'attackImpacted'}>;shown:number;before:number;after:number}>();
const point=(p:Point)=>({x:100+(p.x-3500)*.11,y:140+(p.y-500)*.08});
const assetRoot='/assets/popo-timing/';
const audit:{wall:number;tick:number;phase:string;flights:number[];hp:readonly (readonly number[])[];pose:string;impact:number[]}[]=[];
function letter(p:{x:number;y:number},scale:number){
 const w=138*scale;ctx.drawImage(assets.letter,110,335,1033,584,p.x-w/2,p.y-w*584/1033/2,w,w*584/1033);
}
function body(p:Point,pose:string){const s=size/563;ctx.drawImage(assets[pose],p.x-360*s,p.y-640*s,960*s,768*s);}
function enemy(p:Point,hp:number,maxHp:number,hit=false,dead=false,opacity=1){
 ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=dead?'#a09086':hit?'#ffd58d':'#647962';ctx.strokeStyle='#344932';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.ellipse(p.x,p.y,10,11,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#18271f';
 for(const dx of [-4,4]){if(dead){ctx.beginPath();ctx.moveTo(p.x+dx-2,p.y-4);ctx.lineTo(p.x+dx+2,p.y);ctx.moveTo(p.x+dx+2,p.y-4);ctx.lineTo(p.x+dx-2,p.y);ctx.stroke();}else{ctx.fillStyle='#17281d';ctx.fillRect(p.x+dx-1,p.y-4,2,4);}}
 ctx.fillStyle='#4e4437';ctx.fillRect(p.x-13,p.y-20,26,4);ctx.fillStyle=hit?'#f6a16a':'#59a56f';ctx.fillRect(p.x-13,p.y-20,26*hp/maxHp,4);ctx.restore();
}
function paint(from:object,o:Observation,ev:readonly CombatEvent[],alpha:number){
 const view=consumer.present(from,o,ev,alpha);if(!view||!ready)return null;
 for(const a of view.aftermath)if(!impacts.has(a.attackId)){
  const hit=a.hits[0],after=o.enemies.find(e=>e.id===hit.enemyId)?.hp??0;
  impacts.set(a.attackId,{event:a,shown:o.tick,before:after+hit.damage,after});
 }
 const active=[...impacts.values()].filter(a=>o.tick-a.shown<=8).slice(-1)[0];
 ctx.clearRect(0,0,360,260);ctx.fillStyle='#c4bea0';ctx.fillRect(194,0,32,260);ctx.strokeStyle='#a3a180';ctx.lineWidth=1;
 for(let x=45;x<180;x+=55){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,260);ctx.stroke();}
 for(let y=20;y<260;y+=55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(194,y);ctx.stroke();}
 const unit=o.units.find(u=>u.definitionId==='fixture-01'),windup=view.windups.find(w=>w.unitId===unit?.id),flight=o.flights.find(f=>f.unitId===unit?.id);
 const pending=windup??flight,target=pending?o.enemies.find(e=>e.id===pending.targetId):null;
 const source=unit&&unit.location.kind==='board'?{x:500+1000*unit.location.col,y:500+1000*unit.location.row}:{x:3500,y:500};
 const facing=!!(target&&supported(source,target.position));
 // Eligibility is fixture-specific; compatibility behavior metadata never selects art.
 const eligible=!!unit&&core.getRules(state.rulesId)?.timing.delayedDefinitions['fixture-01']?.behavior==='single';
 let pose='idle';if(eligible&&facing&&windup)pose='anticipation';else if(eligible&&facing&&flight)pose=o.tick===flight.releaseTick?'release':'recovery';
 const unitPoint=point(source);body(unitPoint,pose);
 if(pose==='anticipation'){const s=size/563;letter({x:unitPoint.x+(467-360)*s,y:unitPoint.y+(382-640)*s},s);}
 for(const e of o.enemies){const hit=active?.event.hits.some(h=>h.enemyId===e.id);enemy(hit&&o.tick===active!.shown?point(active!.event.hits.find(h=>h.enemyId===e.id)!.position):point(e.position),e.hp,e.maxHp,!!hit&&o.tick-active!.shown<=2);}
 for(const f of view.flights){const original=o.flights.find(p=>p.attackId===f.attackId)!;const t=o.enemies.find(e=>e.id===original.targetId);if(!eligible||!t||!supported(original.sourcePosition,t.position))continue;
  const p=point(f.position),s=size/563;
  // Renderer-only hand offset decays to zero at impact; never affects core positions/hash.
  const traveled=Math.max(Math.abs(f.position.x-original.sourcePosition.x),Math.abs(f.position.y-original.sourcePosition.y));
  const distance=Math.max(Math.abs(t.position.x-original.sourcePosition.x),Math.abs(t.position.y-original.sourcePosition.y));
  const progress=Math.min(1,traveled/Math.max(1,distance));
  letter({x:p.x+(688-360+69)*s*(1-progress),y:p.y+(365-640)*s*(1-progress)},s);
 }
 if(active){for(const h of active.event.hits){const p=point(h.position),dead=!o.enemies.some(e=>e.id===h.enemyId);if(dead)enemy(p,0,active.before,true,true,Math.max(.35,1-(o.tick-active.shown)/12));
  // Contact mark is stationary at the core hit position, never another flight.
  if(o.tick-active.shown<=1){letter(p,size/563);ctx.strokeStyle='#fff4cd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#713d26';ctx.font='bold 12px system-ui';ctx.fillText(dead?'처치':'−'+h.damage,p.x+17,p.y-4);
 }}
 const phase=active?'접촉·피해':windup?'준비':flight?(o.tick===flight.releaseTick?'방출':'비행'):'대기';
 $('#status').textContent=`${size}px · tick ${o.tick} · ${phase}${pending&&!facing?' / 이 방향 자세 미지원':''}`;
 $('#ledger').textContent=active?`적 #${active.event.targetId} · HP ${active.before} → ${active.after} · 실제 피해 ${active.event.hits[0].damage}${active.after===0?' · 처치':''}`:'피해는 편지가 도착할 때 코어에서 확정됩니다.';
 document.querySelectorAll('.steps span').forEach(e=>e.classList.toggle('active',e.textContent===phase));
 audit.push({wall:performance.now(),tick:view.tick,phase,flights:view.flights.map(f=>f.attackId),hp:view.hp,pose,impact:active?[active.event.attackId]:[]});if(audit.length>4000)audit.shift();
 return view;
}
function schedule(token:object){requestAnimationFrame(now=>{
 if(token!==owner)return;
 if(!paused&&!document.hidden&&ready){
  if(lastTime===0)lastTime=now;
  if(now-lastPaint>=delay){accumulator+=now-lastTime;lastTime=now;lastPaint=now;
   const count=Math.min(Math.floor(accumulator/50),endTick-state.tick);accumulator-=count*50;
   if(count>0){const r=core.advance(state,count);if(!r.ok)throw Error(r.error.code);state=r.state;observation=core.observe(state);events=r.events;}
   paint(token,observation,events,accumulator/50);events=[];
   if(state.tick>=endTick){paused=true;accumulator=0;}
  }
 }else lastTime=0;
 schedule(token);
});}
async function reset(tick=122,autoplay=true){
 owner={};const token=owner,currentGeneration=++generation;consumer.bind(owner);state=scenario(tick);observation=core.observe(state);events=[];impacts=new Map();audit.length=0;endTick=tick<140?136:160;accumulator=0;lastTime=0;lastPaint=0;paused=true;ready=false;
 const loaded:Record<string,HTMLImageElement>={};
 await Promise.all(['idle','anticipation','release','recovery','letter'].map(async name=>{const img=new Image();img.src=assetRoot+name+'.png';await img.decode();loaded[name]=img;}));
 if(token!==owner||currentGeneration!==generation)return false;
 assets=loaded;ready=true;paint(token,observation,[],0);paused=!autoplay;schedule(token);return true;
}
$('#restart').onclick=()=>void reset(122);$('#hit').onclick=()=>void reset(146);
$('#pause').onclick=()=>{paused=!paused;lastTime=0;};
$<HTMLSelectElement>('#size').onchange=e=>{size=Number((e.target as HTMLSelectElement).value);paint(owner,observation,[],1);};
$<HTMLSelectElement>('#delay').onchange=e=>{delay=Number((e.target as HTMLSelectElement).value);lastTime=0;};
document.addEventListener('visibilitychange',()=>{lastTime=0;});
// Explicit review API exercises the same production paint/RAF functions.
const review={reset,configure(s:number,d:number){size=s;delay=d;$<HTMLSelectElement>('#size').value=String(s);$<HTMLSelectElement>('#delay').value=String(d);},pause(){paused=true;lastTime=0;},resume(){paused=false;lastTime=0;},snapshot(){return{hash:core.stateHash(state),tick:state.tick,observation,owner,generation,audit:[...audit]};},
 async lifecycle(){await reset(127,false);const token=owner,old=observation,first=paint(token,old,[],0)!;const late=new Promise(resolve=>setTimeout(()=>requestAnimationFrame(()=>resolve(paint(token,old,[],0))),100));const r=core.advance(state,1);if(!r.ok)throw Error(r.error.code);state=r.state;observation=core.observe(state);const impact=paint(token,observation,r.events,0)!;const stale=await late;const after=paint(token,observation,[],1)!;await reset(122,false);const resetStale=await new Promise(resolve=>requestAnimationFrame(()=>resolve(paint(token,old,[],1))));return{first,impact,stale,after,resetStale,currentHash:core.stateHash(state)};},
 attach(tick:number){return reset(tick,false);}};
Object.assign(window,{popoReview:review});void reset(122,false);
