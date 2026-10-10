import './style.css';
import * as core from '../../core-timing/index.ts';
import type {Observation,CombatEvent,Point} from '../../core-timing/types.ts';
import {scenario,scenes,supported,type Scene} from './scenario.ts';
import {createConsumer} from './consumer.ts';
import {createLedger} from './ledger.ts';
import {frames,commonHeight,paths,bubble} from './art.ts';
import {point,anchoredPosition,stopBeforeEnemies,clearanceRadius} from './projection.ts';
const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const canvas=$<HTMLCanvasElement>('canvas'),ctx=canvas.getContext('2d')!;
const consumer=createConsumer(),ledger=createLedger();
let scene:Scene='multi',state=scenario(scene),observation=core.observe(state),owner={},generation=0;
let images:Record<string,HTMLImageElement>={},ready=false,paused=true,size=36,delay=0;
let continuous=false,clean=false,stopTick=scenes[scene].end as number;
let lastTime=0,lastPaint=0,accumulator=0,presentationAlpha=0,events:readonly CombatEvent[]=[];
let retry:{name:Scene;tick:number;autoplay:boolean}={name:scene,tick:scenes[scene].start as number,autoplay:false};
let flightPixels=new Map<number,Point>();
type PaintAudit={wall:number;tick:number;phase:string;flights:{attackId:number;position:Point}[];contacts:{attackId:number;position:Point}[];hits:{attackId:number;enemyId:number;before:number;after:number;damage:number;position:Point}[];hp:readonly (readonly number[])[];cancelled:number[];pose:string;clearance:number;enemies:{id:number;position:Point}[];outside:{enemyId:number;hp:number}[]};
const audit:PaintAudit[]=[];
function loading(failed=false){
 ctx.clearRect(0,0,canvas.width,canvas.height);$('#status').textContent=failed?'이미지 로딩에 실패했습니다. 다시 불러오기를 눌러 주세요.':'누리 이미지를 불러오는 중…';$('#status').setAttribute('role',failed?'alert':'status');canvas.setAttribute('aria-busy',String(!failed));$('#retry').hidden=!failed;$<HTMLButtonElement>('#pause').disabled=true;$('#hits').replaceChildren();$('#outside').replaceChildren();$('#summary').textContent='';$('#timeline').textContent='';
}
function body(position:Point,pose:keyof typeof frames){const f=frames[pose],s=size/commonHeight,[x0,y0,x1,y1]=f.rect;ctx.drawImage(images.body,x0,y0,x1-x0,y1-y0,position.x+(x0-f.pivot[0])*s,position.y+(y0-f.pivot[1])*s,(x1-x0)*s,(y1-y0)*s);}
function droplet(position:Point,target:Point){const scale=size/4/bubble.visibleWidth;ctx.save();ctx.translate(position.x,position.y);ctx.rotate(Math.atan2(target.y-position.y,target.x-position.x)-Math.PI/4);ctx.drawImage(images.bubble,-bubble.pivot.x*scale,-bubble.pivot.y*scale,bubble.width*scale,bubble.height*scale);ctx.restore();}
function enemy(p:Point,hp:number,maxHp:number,hit=false,dead=false,fade=1){
 ctx.save();ctx.globalAlpha=fade;ctx.fillStyle=dead?'#927f77':hit?'#9bdade':'#71846b';ctx.strokeStyle='#334a3d';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.x,p.y,10,11,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#22352d';
 for(const dx of [-4,4]){if(dead){ctx.beginPath();ctx.moveTo(p.x+dx-2,p.y-4);ctx.lineTo(p.x+dx+2,p.y);ctx.moveTo(p.x+dx+2,p.y-4);ctx.lineTo(p.x+dx-2,p.y);ctx.stroke();}else{ctx.fillStyle='#203b2e';ctx.fillRect(p.x+dx-1,p.y-4,2,4);}}
 ctx.fillStyle='#514f42';ctx.fillRect(p.x-12,p.y-20,24,4);ctx.fillStyle=hit?'#48bccc':'#58a675';ctx.fillRect(p.x-12,p.y-20,maxHp?24*hp/maxHp:0,4);ctx.restore();
}
function paint(token:object,o:Observation,ev:readonly CombatEvent[],alpha:number,cosmetic=false){
 const view=consumer.present(token,o,ev,alpha);if(!view||!ready)return null;o=view.observation;presentationAlpha=alpha;ledger.accept(o,ev);
 const history=ledger.view(),recent=history.impacts.filter(a=>o.tick-a.shownTick<=8),own=recent.filter(a=>a.aoe).at(-1);
 const hits=recent.flatMap(a=>a.hits.map(h=>({...h,attackId:a.attackId,shownTick:a.shownTick,aoe:a.aoe})));
 const lastHit=new Map(hits.map(h=>[h.enemyId,h]));
 ctx.clearRect(0,0,360,340);ctx.fillStyle='#c2bea1';ctx.fillRect(184,0,32,340);ctx.strokeStyle='#b0ad92';ctx.lineWidth=1;
 for(let x=35;x<180;x+=55){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,340);ctx.stroke();}for(let y=40;y<340;y+=70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(184,y);ctx.stroke();}
 if(own){const p=point(own.center);ctx.save();ctx.globalAlpha=.2;ctx.drawImage(images.ripple,p.x-121,p.y-10,242,35);ctx.globalAlpha=clean?0:.6;ctx.strokeStyle='#2d8a96';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,1100*.11,1100*.07,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 let pose:keyof typeof frames='idle',unsupported=false;
 for(const u of o.units){if(u.location.kind!=='board')continue;const source={x:500+1000*u.location.col,y:500+1000*u.location.row},p=point(source);
  if(u.definitionId!=='fixture-02'){ctx.fillStyle='#b48b5c';ctx.fillRect(p.x-6,p.y-10,12,12);ctx.font='10px system-ui';if(!clean)ctx.fillText('보조 #'+u.id,p.x-15,p.y+15);continue;}
  const windup=view.windups.find(w=>w.unitId===u.id),flight=o.flights.find(f=>f.unitId===u.id),pending=windup??flight,target=pending?o.enemies.find(e=>e.id===pending.targetId):null;
  const facing=target&&supported(source,target.position);unsupported=!!pending&&!facing;
  pose=facing&&windup?'preparation':facing&&flight?(o.tick===flight.releaseTick?'release':'recoil'):recent.some(a=>a.unitId===u.id)?'recovery':'idle';body(p,pose);
 }
 const enemyPixels=o.enemies.map(e=>{const h=lastHit.get(e.id);return{id:e.id,position:h&&o.tick===h.shownTick?point(h.position):point(e.position)};});
 for(const e of o.enemies){const h=lastHit.get(e.id);enemy(enemyPixels.find(p=>p.id===e.id)!.position,e.hp,e.maxHp,!!h&&o.tick-h.shownTick<3);}
 for(const h of lastHit.values())if(h.after===0&&!o.enemies.some(e=>e.id===h.enemyId)){const p=point(h.position);enemy(p,0,h.before,true,true,Math.max(.4,1-(o.tick-h.shownTick)/12));enemyPixels.push({id:h.enemyId,position:p});}
 const drawn:{attackId:number;position:Point}[]=[];
 for(const f of view.flights){const original=o.flights.find(p=>p.attackId===f.attackId)!,unit=o.units.find(u=>u.id===original.unitId),target=o.enemies.find(e=>e.id===original.targetId);
  if(unit?.definitionId!=='fixture-02'||!target||!supported(original.sourcePosition,target.position)||core.getRules(state.rulesId)?.timing.delayedDefinitions['fixture-02']?.behavior!=='splash')continue;
  const start=anchoredPosition(f.currentPosition,original,o.tick,0,size,target.position),end=anchoredPosition(f.position,original,o.tick,f.fraction,size,target.position);
  const guarded=stopBeforeEnemies(start,end,enemyPixels.map(e=>e.position)),p=cosmetic&&flightPixels.has(f.attackId)?flightPixels.get(f.attackId)!:guarded;
  if(p){droplet(p,point(target.position));drawn.push({attackId:f.attackId,position:p});}
 }
 const contacts:{attackId:number;position:Point}[]=[];
 // Every hit uses its own immutable snapshot, even after the primary's HP reaches zero.
 for(const a of recent){for(const h of a.hits){const p=enemyPixels.find(e=>e.id===h.enemyId)?.position??point(h.position);if(o.tick-a.shownTick<=2){ctx.strokeStyle=a.aoe?'#197e91':'#ae7f48';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,12,0,2*Math.PI);ctx.stroke();}ctx.fillStyle='#315056';ctx.font='bold 10px system-ui';if(!clean)ctx.fillText('#'+h.enemyId+(h.after===0?' 처치':' −'+h.damage),p.x+14,p.y-1);}
  if(a.aoe&&o.tick-a.shownTick<=1){const p=point(a.center);ctx.save();ctx.globalAlpha=.7;ctx.drawImage(images.impact,p.x-17,p.y-17,34,34);ctx.restore();contacts.push({attackId:a.attackId,position:p});}
 }
 const cancelled=!continuous&&history.cancelled.includes(scenes[scene].attack),phase=cancelled?'비행 취소':own?'도착 · 범위 피해':view.windups.length?'준비':view.flights.length?(o.flights.some(f=>f.releaseTick===o.tick)?'방출':'비행'):'대기';
 $('#status').textContent=`${size}px · tick ${o.tick} · ${phase}${unsupported?' · 이 방향 자세 미지원':''}`;
 $('#hits').replaceChildren();if(own){$('#summary').textContent=`공격 #${own.attackId} · 중심 대상 #${own.targetId} · ${own.hits.length}명 · 반경1100`;
  for(const h of own.hits){const row=document.createElement('div');row.className='hit'+(h.after===0?' dead':'');row.textContent=`#${h.enemyId}  HP ${h.before} → ${h.after}  (−${h.damage})${h.after===0?' 처치':''}`;const pos=document.createElement('small');pos.textContent=`(${h.position.x}, ${h.position.y})`;row.append(pos);$('#hits').append(row);}
 }else $('#summary').textContent=cancelled?'주대상이 먼저 죽어 물방울이 취소됐습니다. 누리의 범위 피해는 없습니다.':'물방울 도착 전에는 누리의 범위 피해가 없습니다.';
 $('#outside').replaceChildren();for(const e of own?.outside??[]){const chip=document.createElement('span');chip.className='outside';chip.textContent=`#${e.enemyId} HP ${e.hp} 유지`;$('#outside').append(chip);}
 $('#timeline').textContent=continuous?'연속 재생 · 코어50ms/tick · 자세 미지원 방향은 원화로 대체하지 않음':scene==='cancel'?'보조 fixture-07: tick621 처치 → 누리 tick622 취소':`준비4tick → tick${scenes[scene].release} 방출 → tick${scenes[scene].terminal} 도착`;
 flightPixels=new Map(drawn.map(f=>[f.attackId,f.position]));audit.push({wall:performance.now(),tick:o.tick,phase,flights:drawn,contacts,hits:hits.map(h=>({attackId:h.attackId,enemyId:h.enemyId,before:h.before,after:h.after,damage:h.damage,position:h.position})),hp:view.hp,cancelled:history.cancelled,pose,clearance:clearanceRadius,enemies:enemyPixels,outside:own?.outside??[]});if(audit.length>3000)audit.shift();return view;
}
function schedule(token:object){requestAnimationFrame(now=>{if(token!==owner)return;
 if(!paused&&!document.hidden&&ready){if(!lastTime)lastTime=now;if(now-lastPaint>=delay){accumulator+=now-lastTime;lastTime=now;lastPaint=now;const count=Math.min(Math.floor(accumulator/50),stopTick-state.tick);accumulator-=count*50;
  if(count){const r=core.advance(state,count);if(!r.ok)throw Error(r.error.code);state=r.state;observation=core.observe(state);events=r.events;}
  paint(token,observation,events,accumulator/50);events=[];if(state.tick>=stopTick||state.phase!=='combat'){paused=true;accumulator=0;}
 }}else lastTime=0;schedule(token);});}
async function reset(name:Scene='multi',tick:number=scenes[name].start,autoplay=true){
 scene=name;stopTick=continuous?scenes[name].start+120:scenes[name].end;owner={};const token=owner,version=++generation;consumer.bind(owner);state=scenario(name,tick);observation=core.observe(state);ledger.reset(observation);events=[];flightPixels=new Map();audit.length=0;presentationAlpha=0;lastTime=0;lastPaint=0;accumulator=0;paused=true;ready=false;images={};retry={name,tick,autoplay};$<HTMLSelectElement>('#scene').value=name;loading();
 const loaded:Record<string,HTMLImageElement>={};try{await Promise.all(Object.entries(paths).map(async([name,file])=>{const image=new Image();image.src='/assets/nuri-timing/'+file;await image.decode();loaded[name]=image;}));}catch{if(token!==owner||version!==generation)return false;paused=true;ready=false;loading(true);return false;}
 if(token!==owner||version!==generation)return false;images=loaded;ready=true;$('#retry').hidden=true;$<HTMLButtonElement>('#pause').disabled=false;canvas.setAttribute('aria-busy','false');$('#status').setAttribute('role','status');paint(token,observation,[],0);paused=!autoplay;schedule(token);return true;
}
$('#play').onclick=()=>void reset($<HTMLSelectElement>('#scene').value as Scene);$('#retry').onclick=()=>void reset(retry.name,retry.tick,retry.autoplay);
$('#pause').onclick=()=>{paused=!paused;lastTime=0;};$<HTMLSelectElement>('#scene').onchange=()=>void reset($<HTMLSelectElement>('#scene').value as Scene,undefined,false);
$<HTMLSelectElement>('#size').onchange=e=>{size=Number((e.target as HTMLSelectElement).value);paint(owner,observation,[],presentationAlpha,true);};
$<HTMLSelectElement>('#delay').onchange=e=>{delay=Number((e.target as HTMLSelectElement).value);lastTime=0;};document.addEventListener('visibilitychange',()=>{lastTime=0;});
$('#continuous').onchange=e=>{continuous=(e.target as HTMLInputElement).checked;void reset(scene,undefined,false);};
$('#clean').onchange=e=>{clean=(e.target as HTMLInputElement).checked;document.body.classList.toggle('clean',clean);paint(owner,observation,[],presentationAlpha,true);};
const review={reset,presentation(c:boolean,hide:boolean){continuous=c;clean=hide;$<HTMLInputElement>('#continuous').checked=c;$<HTMLInputElement>('#clean').checked=hide;document.body.classList.toggle('clean',hide);},configure(s:number,d:number){size=s;delay=d;$<HTMLSelectElement>('#size').value=String(s);$<HTMLSelectElement>('#delay').value=String(d);},pause(){paused=true;lastTime=0;},resume(){paused=false;lastTime=0;},snapshot(){return{timeOrigin:performance.timeOrigin,scene,continuous,clean,stopTick,tick:state.tick,hash:core.stateHash(state),observation,audit:[...audit],ledger:ledger.view()};},replay(){return{header:{schemaVersion:4,rulesId:state.rulesId,rulesDigest:state.rulesDigest,seed:state.seed},entries:state.acceptedLog,finalHash:core.stateHash(state)};},
 async lifecycle(){await reset('multi',1065,false);const token=owner,old=observation,first=paint(token,old,[],.95)!;const pending=new Promise(resolve=>setTimeout(()=>requestAnimationFrame(()=>resolve(paint(token,old,[],1))),100));const r=core.advance(state,1);if(!r.ok)throw Error(r.error.code);state=r.state;observation=core.observe(state);const impact=paint(token,observation,r.events,0)!;const stale=await pending,after=paint(token,observation,[],1)!;await reset('multi',1059,false);const resetStale=await new Promise(resolve=>requestAnimationFrame(()=>resolve(paint(token,old,[],1))));return{first,impact,stale,after,resetStale};}};
Object.assign(window,{nuriReview:review});void reset('multi',1059,false);
