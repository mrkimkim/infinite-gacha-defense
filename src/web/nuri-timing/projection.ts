import type {Flight,Point} from '../../core-timing/types.ts';
import {home} from '../../core-timing/timing.ts';
import {releaseRim,bubble} from './art.ts';
export const point=(p:Point):Point=>({x:90+(p.x-3500)*.11,y:110+(p.y-500)*.07});
export function nextFlightPosition(f:Flight,target:Point,tick:number):Point{const left=f.arrivalTick-tick;return Number.isSafeInteger(left)&&left>0&&f.positionTick===tick?home(f.position,target,left):f.position;}
export function anchoredPosition(position:Point,f:Flight,tick:number,fraction:number,size:number,target:Point):Point{
 const p=point(position),source=point(f.sourcePosition),t=point(target),dx=t.x-source.x,dy=t.y-source.y,length=Math.hypot(dx,dy)||1;
 const progress=Math.max(0,Math.min(1,(tick-f.releaseTick+fraction)/(f.arrivalTick-f.releaseTick)));
 const rim={x:releaseRim.x*size/480,y:releaseRim.y*size/480},edge=size/4*Math.SQRT2/2+1;
 return{x:p.x+(rim.x+dx/length*edge)*(1-progress),y:p.y+(rim.y+dy/length*edge)*(1-progress)};
}
// Full alpha>0 raw bounds(17,75)-(1240,1230), rotation about measured pivot; reserve36px.
export const bubbleRadius=Math.hypot(Math.max(bubble.pivot.x-17,1240-bubble.pivot.x),Math.max(bubble.pivot.y-75,1230-bubble.pivot.y))*9/bubble.visibleWidth;
export const clearanceRadius=11.75+bubbleRadius+1+2;
export function stopBeforeEnemies(start:Point,end:Point,enemies:readonly Point[]):Point|null{
 const dx=end.x-start.x,dy=end.y-start.y,a=dx*dx+dy*dy;let limit=1;
 for(const e of enemies){const sx=start.x-e.x,sy=start.y-e.y,c=sx*sx+sy*sy-clearanceRadius*clearanceRadius;if(c< -1e-7)return null;if(!a)continue;const b=2*(sx*dx+sy*dy),d=b*b-4*a*c;if(d<0)continue;const entry=(-b-Math.sqrt(d))/(2*a);if(entry>=0&&entry<=limit)limit=entry;}
 return{x:start.x+dx*limit,y:start.y+dy*limit};
}
