/** Display-only one-tick forecast and conservative pixel-space clearance. */
import type {Flight,Point} from '../../core-timing/types.ts';
import {effects,maximumEffectRadius,type EffectWidth} from './effects.ts';
import {home} from '../../core-timing/timing.ts';
export const point=(p:Point):Point=>({x:100+(p.x-3500)*.11,y:140+(p.y-500)*.08});
export const letterDimensions=(size:number,effect:EffectWidth=0)=>effect?{width:effect,height:effects[effect].strong[3]-effects[effect].strong[1]}:{width:138*size/563,height:138*size/563*584/1033};
export function nextFlightPosition(f:Flight,target:Point,tick:number):Point{
 const remaining=f.arrivalTick-tick;
 return Number.isSafeInteger(remaining)&&remaining>0&&f.positionTick===tick?home(f.position,target,remaining):f.position;
}
export function anchoredPosition(position:Point,f:Flight,tick:number,fraction:number,size:number,effect:EffectWidth=0):Point{
 const p=point(position),s=size/563,duration=f.arrivalTick-f.releaseTick;
 const progress=duration>0?Math.max(0,Math.min(1,(tick-f.releaseTick+fraction)/duration)):1;
 const source=point(f.sourcePosition);
 const offsetX=effect?Math.round(source.x+(688-360)*s)+1+effect/2-source.x:(688-360+69)*s;
 return{x:p.x+offsetX*(1-progress),y:p.y+(365-640)*s*(1-progress)};
}
/** Reserve all full-alpha effect extents +integer alignment/filter fringe +2px gap for safe paused resizing. */
export function clearanceRadius(size:number):number{
 const letter=letterDimensions(Math.max(36,size));return 11.75+Math.max(maximumEffectRadius,Math.hypot(letter.width,letter.height)/2)+Math.SQRT1_2+1+2;
}
/** Stop at the first enemy safety circle; never push an already overlapping start outward. */
export function stopBeforeEnemies(start:Point,end:Point,enemies:readonly Point[],size:number):Point|null{
 const radius=clearanceRadius(size),dx=end.x-start.x,dy=end.y-start.y,a=dx*dx+dy*dy;let limit=1;
 for(const enemy of enemies){
  const sx=start.x-enemy.x,sy=start.y-enemy.y,c=sx*sx+sy*sy-radius*radius;
  if(c < -1e-7)return null; // suppress, rather than show speculative contact or teleport
  if(a===0)continue;
  const b=2*(sx*dx+sy*dy),discriminant=b*b-4*a*c;
  if(discriminant<0)continue;
  const entry=(-b-Math.sqrt(discriminant))/(2*a);
  if(entry>=0&&entry<=limit)limit=entry;
 }
 return{x:start.x+dx*limit,y:start.y+dy*limit};
}
