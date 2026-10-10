import './style.css';
import * as core from '../../core-timing/index.ts';
import type {CombatEvent,Observation,Point} from '../../core-timing/types.ts';
import {createConsumer} from './consumer.ts';
import {surfaceContact,contactVisible,protectedEnemyPixel,type IncomingSample,type SurfaceContact} from './contact.ts';
import {effects,effectOrigin,validateEffectImage,type EffectWidth} from './effects.ts';
import {scenario,supported} from './scenario.ts';
import {point,anchoredPosition,stopBeforeEnemies,letterDimensions,clearanceRadius} from './projection.ts';
const $=<T extends HTMLElement>(q:string)=>document.querySelector<T>(q)!;
const canvas=$<HTMLCanvasElement>('canvas'),ctx=canvas.getContext('2d')!;
const consumer=createConsumer();
let state=scenario(),owner={},size=36,delay=0,paused=true,lastTime=0,accumulator=0,lastPaint=0,endTick=136;
let observation=core.observe(state),events:readonly CombatEvent[]=[],generation=0;
let assets:Record<string,HTMLImageElement>={},ready=false;
let presentationAlpha=0,effect:EffectWidth=8;
let flightPixels=new Map<number,Point>();
let incoming=new Map<number,IncomingSample>();
let effectMeasurements:Record<string,ReturnType<typeof validateEffectImage>>={};
let retryScene={tick:122,autoplay:false};
function loadingStatus(failed=false){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 $('#status').textContent=failed?'이미지를 불러오지 못했습니다. 다시 불러오기를 눌러 재시도해 주세요.':'이미지를 불러오는 중입니다…';
 $('#status').setAttribute('role',failed?'alert':'status');
 canvas.setAttribute('aria-busy',String(!failed));
 $('#ledger').textContent='';
 document.querySelectorAll('.steps span').forEach(e=>e.classList.remove('active'));
 $('#retry').hidden=!failed;$<HTMLButtonElement>('#pause').disabled=true;
}
let impacts=new Map<number,{event:Extract<CombatEvent,{type:'attackImpacted'}>;shown:number;before:number;after:number;surfaces:Map<number,SurfaceContact>}>();
const assetRoot='/assets/popo-timing/';
const audit:{wall:number;tick:number;phase:string;flights:number[];hp:readonly (readonly number[])[];pose:string;impact:number[];flightPixels:{attackId:number;position:Point}[];fraction:number;effect:EffectWidth;letterSize:{width:number;height:number};clearance:number;enemyPixels:{id:number;position:Point}[];contacts:{attackId:number;position:Point}[];rasterFlights:{attackId:number;raster:Raster|null}[];rasterContacts:{attackId:number;raster:Raster|null}[];surfaceContacts:{attackId:number;enemyId:number;coreHit:Point;anchor:Point;direction:string;visible:boolean;protectedChanges:number}[]}[]=[];
type Raster={x:number;y:number;width:number;height:number;changedPixels:number;maxContrast:number;bodyGapPx:number|null};
function letter(p:{x:number;y:number},scale:number,measure=false,obstacles:readonly Point[]=[]):Raster|null{
 const spec=effect?effects[effect]:null,origin=effect?effectOrigin(p,effect):null;
 const w=spec?spec.canvas[0]:138*scale,h=spec?spec.canvas[1]:w*584/1033;
 const drawX=origin?.x??p.x-w/2,drawY=origin?.y??p.y-h/2;
 const x=Math.max(0,Math.floor(drawX)-1),y=Math.max(0,Math.floor(drawY)-1);
 const rw=Math.min(canvas.width-x,Math.ceil(w)+3),rh=Math.min(canvas.height-y,Math.ceil(h)+3);
 const before=measure&&rw>0&&rh>0?ctx.getImageData(x,y,rw,rh):null;
 if(effect)ctx.drawImage(assets['letter'+effect],drawX,drawY);
 else ctx.drawImage(assets.letter,110,335,1033,584,drawX,drawY,w,h);
 if(!before)return null;
 const after=ctx.getImageData(x,y,rw,rh);let minX=rw,minY=rh,maxX=-1,maxY=-1,count=0,contrast=0,gap=Infinity;
 for(let j=0;j<rh;j++)for(let i=0;i<rw;i++){const offset=(j*rw+i)*4;let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(after.data[offset+k]-before.data[offset+k]));
  if(delta>=8){minX=Math.min(minX,i);minY=Math.min(minY,j);maxX=Math.max(maxX,i);maxY=Math.max(maxY,j);count++;contrast=Math.max(contrast,delta);for(const enemy of obstacles)gap=Math.min(gap,Math.hypot(x+i+.5-enemy.x,y+j+.5-enemy.y)-11.75-Math.SQRT1_2);}}
 return count?{x:x+minX,y:y+minY,width:maxX-minX+1,height:maxY-minY+1,changedPixels:count,maxContrast:contrast,bodyGapPx:Number.isFinite(gap)?gap:null}:null;
}
function contactCue(c:SurfaceContact,enemies:readonly Point[]):{raster:Raster|null;protectedChanges:number}{
 const before=ctx.getImageData(0,0,canvas.width,canvas.height);
 ctx.save();ctx.strokeStyle='#6d5637';ctx.lineWidth=3.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
 c.points.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();ctx.strokeStyle='#fff4cd';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
 const after=ctx.getImageData(0,0,canvas.width,canvas.height);let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1,count=0,maxContrast=0,protectedChanges=0;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const offset=(y*canvas.width+x)*4;let delta=0;for(let k=0;k<4;k++)delta=Math.max(delta,Math.abs(after.data[offset+k]-before.data[offset+k]));
  if(delta>=8){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;maxContrast=Math.max(maxContrast,delta);if(enemies.some(e=>protectedEnemyPixel({x:x+.5,y:y+.5},e)))protectedChanges++;}}
 return{raster:count?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,changedPixels:count,maxContrast,bodyGapPx:null}:null,protectedChanges};
}
function body(p:Point,pose:string){const s=size/563;ctx.drawImage(assets[pose],p.x-360*s,p.y-640*s,960*s,768*s);}
function enemy(p:Point,hp:number,maxHp:number,hit=false,dead=false,opacity=1){
 ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=dead?'#a09086':hit?'#ffd58d':'#647962';ctx.strokeStyle='#344932';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.ellipse(p.x,p.y,10,11,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#18271f';
 for(const dx of [-4,4]){if(dead){ctx.beginPath();ctx.moveTo(p.x+dx-2,p.y-4);ctx.lineTo(p.x+dx+2,p.y);ctx.moveTo(p.x+dx+2,p.y-4);ctx.lineTo(p.x+dx-2,p.y);ctx.stroke();}else{ctx.fillStyle='#17281d';ctx.fillRect(p.x+dx-1,p.y-4,2,4);}}
 ctx.fillStyle='#4e4437';ctx.fillRect(p.x-13,p.y-20,26,4);ctx.fillStyle=hit?'#f6a16a':'#59a56f';ctx.fillRect(p.x-13,p.y-20,26*hp/maxHp,4);ctx.restore();
}
function paint(from:object,o:Observation,ev:readonly CombatEvent[],alpha:number,cosmetic=false){
 const view=consumer.present(from,o,ev,alpha);if(!view||!ready)return null;
 o=view.observation;presentationAlpha=alpha;
 const drawnFlights:{attackId:number;position:Point}[]=[];
 const surfaceContacts:{attackId:number;enemyId:number;coreHit:Point;anchor:Point;direction:string;visible:boolean;protectedChanges:number}[]=[];
 const rasterFlights:{attackId:number;raster:Raster|null}[]=[],rasterContacts:{attackId:number;raster:Raster|null}[]=[];
 for(const a of view.aftermath)if(!impacts.has(a.attackId)){
  const hit=a.hits[0],after=o.enemies.find(e=>e.id===hit.enemyId)?.hp??0;
  const surfaces=new Map<number,SurfaceContact>();
  const caster=o.units.find(u=>u.id===a.unitId);
  if(caster?.definitionId==='fixture-01')for(const h of a.hits)if(supported(a.sourcePosition,h.position)){
   const c=surfaceContact(point(h.position),point(a.sourcePosition),h.enemyId,a.tick,incoming.get(a.attackId));if(c)surfaces.set(h.enemyId,c);
  }
  impacts.set(a.attackId,{event:a,shown:o.tick,before:after+hit.damage,after,surfaces});
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
 const enemyPixels=o.enemies.map(e=>{const hit=active?.event.hits.find(h=>h.enemyId===e.id);return{id:e.id,position:hit&&o.tick===active!.shown?point(hit.position):point(e.position)};});
 for(const e of o.enemies){const hit=active?.event.hits.some(h=>h.enemyId===e.id);enemy(enemyPixels.find(p=>p.id===e.id)!.position,e.hp,e.maxHp,!!hit&&o.tick-active!.shown<=2);}
 if(active)for(const h of active.event.hits)if(!o.enemies.some(e=>e.id===h.enemyId))enemyPixels.push({id:h.enemyId,position:point(h.position)});
 for(const f of view.flights){const original=o.flights.find(p=>p.attackId===f.attackId)!;const t=o.enemies.find(e=>e.id===original.targetId);if(!eligible||!t||!supported(original.sourcePosition,t.position))continue;
  const start=anchoredPosition(f.currentPosition,original,o.tick,0,size,effect);
  const wanted=anchoredPosition(f.position,original,o.tick,f.fraction,size,effect);
  const guarded=stopBeforeEnemies(start,wanted,enemyPixels.map(e=>e.position),size);
  const pixel=cosmetic&&flightPixels.has(f.attackId)?flightPixels.get(f.attackId)!:guarded;
  if(pixel){rasterFlights.push({attackId:f.attackId,raster:letter(pixel,size/563,true,enemyPixels.map(e=>e.position))});drawnFlights.push({attackId:f.attackId,position:pixel});incoming.set(f.attackId,{position:pixel,targetId:original.targetId,tick:o.tick});}

 }
 if(active){for(const h of active.event.hits){const p=point(h.position),dead=!o.enemies.some(e=>e.id===h.enemyId);if(dead)enemy(p,0,active.before,true,true,Math.max(.35,1-(o.tick-active.shown)/12));
  // The core hit snapshot stays p. Only the visual cue uses the incoming surface.
  const surface=active.surfaces.get(h.enemyId);
  if(surface&&o.tick===active.shown){
   const obstacles=enemyPixels.map(e=>e.position),visible=contactVisible(surface,obstacles);
   const drawn=visible?contactCue(surface,obstacles):{raster:null,protectedChanges:0};
   surfaceContacts.push({attackId:active.event.attackId,enemyId:h.enemyId,coreHit:p,anchor:surface.anchor,direction:surface.direction,visible,protectedChanges:drawn.protectedChanges});
   if(drawn.raster)rasterContacts.push({attackId:active.event.attackId,raster:drawn.raster});
  }
  ctx.fillStyle='#713d26';ctx.font='bold 12px system-ui';ctx.fillText(dead?'처치':'−'+h.damage,p.x+17,p.y-4);
 }}
 const phase=active?'접촉·피해':windup?'준비':flight?(o.tick===flight.releaseTick?'방출':'비행'):'대기';
 $('#status').textContent=`${size}px 몸체 / ${effect||'기존'}px 편지 · tick ${o.tick} · ${phase}${pending&&!facing?' / 이 방향 자세 미지원':''}`;
 $('#ledger').textContent=active?`적 #${active.event.targetId} · HP ${active.before} → ${active.after} · 실제 피해 ${active.event.hits[0].damage}${active.after===0?' · 처치':''}`:'피해는 편지가 도착할 때 코어에서 확정됩니다.';
 document.querySelectorAll('.steps span').forEach(e=>e.classList.toggle('active',e.textContent===phase));
 flightPixels=new Map(drawnFlights.map(f=>[f.attackId,f.position]));
 incoming=new Map([...incoming].filter(([id])=>o.flights.some(f=>f.attackId===id)));
 audit.push({wall:performance.now(),tick:view.tick,phase,flights:view.flights.map(f=>f.attackId),hp:view.hp,pose,impact:active?[active.event.attackId]:[],flightPixels:drawnFlights,fraction:alpha,effect,letterSize:letterDimensions(size,effect),clearance:clearanceRadius(size),enemyPixels,contacts:active?active.event.hits.map(h=>({attackId:active.event.attackId,position:point(h.position)})):[],rasterFlights,rasterContacts,surfaceContacts});if(audit.length>4000)audit.shift();
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
 retryScene={tick,autoplay};presentationAlpha=0;flightPixels=new Map();incoming=new Map();assets={};loadingStatus();
 const loaded:Record<string,HTMLImageElement>={},measured:typeof effectMeasurements={};
 try {await Promise.all(['idle','anticipation','release','recovery','letter','letter8','letter10','letter12'].map(async name=>{const img=new Image();img.src=assetRoot+(name.startsWith('letter')&&name!=='letter'?'v7-letter/effects/v6-baseline-'+name.slice(6)+'px.png':name+'.png');await img.decode();if(name.startsWith('letter')&&name!=='letter')measured[name]=validateEffectImage(img,Number(name.slice(6)) as 8|10|12);loaded[name]=img;}));
 }catch{
  // A superseded decode failure must not clear a newer scene or its error state.
  if(token!==owner||currentGeneration!==generation)return false;
  paused=true;ready=false;assets={};loadingStatus(true);return false;
 }
 if(token!==owner||currentGeneration!==generation)return false;
 assets=loaded;effectMeasurements=measured;ready=true;canvas.setAttribute('aria-busy','false');$('#status').setAttribute('role','status');$('#retry').hidden=true;$<HTMLButtonElement>('#pause').disabled=false;paint(token,observation,[],0);paused=!autoplay;schedule(token);return true;
}
$('#retry').onclick=()=>void reset(retryScene.tick,retryScene.autoplay);
$('#restart').onclick=()=>void reset(122);$('#hit').onclick=()=>void reset(146);
$('#pause').onclick=()=>{paused=!paused;lastTime=0;};
$<HTMLSelectElement>('#size').onchange=e=>{size=Number((e.target as HTMLSelectElement).value);paint(owner,observation,[],presentationAlpha,true);};
$<HTMLSelectElement>('#effect').onchange=e=>{effect=Number((e.target as HTMLSelectElement).value) as EffectWidth;paint(owner,observation,[],presentationAlpha,true);};
$<HTMLSelectElement>('#delay').onchange=e=>{delay=Number((e.target as HTMLSelectElement).value);lastTime=0;};
document.addEventListener('visibilitychange',()=>{lastTime=0;});
// Explicit review API exercises the same production paint/RAF functions.
const review={reset,configure(s:number,d:number,e:EffectWidth=8){size=s;delay=d;effect=e;$<HTMLSelectElement>('#effect').value=String(e);$<HTMLSelectElement>('#size').value=String(s);$<HTMLSelectElement>('#delay').value=String(d);},pause(){paused=true;lastTime=0;},resume(){paused=false;lastTime=0;},snapshot(){return{timeOrigin:performance.timeOrigin,effectMeasurements,hash:core.stateHash(state),tick:state.tick,observation,owner,generation,audit:[...audit]};},
 async lifecycle(){await reset(127,false);const token=owner,old=observation,first=paint(token,old,[],0)!;const late=new Promise(resolve=>setTimeout(()=>requestAnimationFrame(()=>resolve(paint(token,old,[],0))),100));const r=core.advance(state,1);if(!r.ok)throw Error(r.error.code);state=r.state;observation=core.observe(state);const impact=paint(token,observation,r.events,0)!;const stale=await late;const after=paint(token,observation,[],1)!;await reset(122,false);const resetStale=await new Promise(resolve=>requestAnimationFrame(()=>resolve(paint(token,old,[],1))));return{first,impact,stale,after,resetStale,currentHash:core.stateHash(state)};},
 attach(tick:number){return reset(tick,false);}};
Object.assign(window,{popoReview:review});void reset(122,false);
