import {frames as nuri,bubble} from './nuri-art.ts';import {effectOrigin} from './effects.ts';import {SCALE} from './projection.ts';
import type {BattleView,Images} from './presentation.ts';
export function draw(ctx:CanvasRenderingContext2D,v:BattleView,images:Images,selected:number|null){
 ctx.clearRect(0,0,360,390);ctx.fillStyle='#ded6b4';ctx.fillRect(0,0,360,390);ctx.strokeStyle='#ada887';ctx.lineWidth=26;ctx.beginPath();ctx.moveTo(30,60);ctx.lineTo(330,60);ctx.lineTo(330,360);ctx.lineTo(30,360);ctx.closePath();ctx.stroke();
 ctx.lineWidth=1;ctx.strokeStyle='#b1aa87';for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(60+i*60,90);ctx.lineTo(60+i*60,330);ctx.moveTo(60,90+i*60);ctx.lineTo(300,90+i*60);ctx.stroke();}
 for(const a of v.impacts)if(a.aoe){const p={x:60+a.center.x*SCALE,y:90+a.center.y*SCALE};ctx.save();ctx.globalAlpha=.2;ctx.strokeStyle='#248f9a';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,1100*SCALE,0,Math.PI*2);ctx.stroke();ctx.drawImage(images.ripple,p.x-66,p.y-8,132,20);ctx.restore();}
 for(const u of v.units){const p=u.position;if(u.id===selected){ctx.strokeStyle='#af6b25';ctx.lineWidth=2;ctx.strokeRect(p.x-28,p.y-39,56,57);}
  if(u.definitionId==='fixture-01'){const pose=u.pose==='preparation'?'anticipation':u.pose==='recoil'?'recovery':u.pose;ctx.drawImage(images['popo-'+pose],p.x-360*32/563,p.y-640*32/563,960*32/563,768*32/563);}
  else if(u.definitionId==='fixture-02'){const f=nuri[u.pose as keyof typeof nuri],s=32/480,[x0,y0,x1,y1]=f.rect;ctx.drawImage(images.nuri,x0,y0,x1-x0,y1-y0,p.x+(x0-f.pivot[0])*s,p.y+(y0-f.pivot[1])*s,(x1-x0)*s,(y1-y0)*s);}
  else{ctx.fillStyle='#82779a';ctx.fillRect(p.x-12,p.y-25,24,25);ctx.fillStyle='white';ctx.font='11px system-ui';ctx.fillText(u.definitionId.slice(-2),p.x-7,p.y-9);}
  ctx.font='10px system-ui';ctx.fillStyle='#334332';ctx.fillText('★'.repeat(u.star),p.x-8,p.y+12);if(u.unsupported){ctx.fillStyle='#925321';ctx.fillText('기본 방향',p.x-22,p.y+23);}
 }
 for(const e of v.enemies){const p=e.position;ctx.fillStyle=e.dead?'#aaa08d':e.hit?'#e7c580':'#73876b';ctx.strokeStyle='#344c39';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.x,p.y,10,11,0,0,Math.PI*2);ctx.fill();ctx.stroke();for(const dx of [-4,4]){ctx.fillStyle='#263d2c';if(e.dead){ctx.beginPath();ctx.moveTo(p.x+dx-2,p.y-4);ctx.lineTo(p.x+dx+2,p.y);ctx.moveTo(p.x+dx+2,p.y-4);ctx.lineTo(p.x+dx-2,p.y);ctx.stroke();}else ctx.fillRect(p.x+dx-1,p.y-4,2,4);}ctx.fillStyle='#686453';ctx.fillRect(p.x-12,p.y-20,24,4);ctx.fillStyle='#50a17d';ctx.fillRect(p.x-12,p.y-20,e.maxHp?24*e.hp/e.maxHp:0,4);}
 for(const f of v.flights){const p=f.position;if(!f.art){ctx.fillStyle='#76538f';ctx.strokeStyle='#fff6d2';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(f.definitionId==='fixture-01'){const o=effectOrigin(p,12);ctx.drawImage(images.letter,o.x,o.y);}
  else{const scale=8/bubble.visibleWidth;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(f.target.y-p.y,f.target.x-p.x)-Math.PI/4);ctx.drawImage(images.bubble,-bubble.pivot.x*scale,-bubble.pivot.y*scale,bubble.width*scale,bubble.height*scale);ctx.restore();}}
 for(const c of v.contacts){if(c.surface){ctx.beginPath();c.surface.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineWidth=3.5;ctx.strokeStyle='#6d5637';ctx.stroke();ctx.lineWidth=1.5;ctx.strokeStyle='#fff4cd';ctx.stroke();}else if(!c.popoSurface&&v.tick-c.shownTick<=2){ctx.lineWidth=1.5;ctx.strokeStyle=c.aoe?'#167d96':'#a7763e';ctx.beginPath();ctx.arc(c.position.x,c.position.y,12,0,Math.PI*2);ctx.stroke();}}
}
