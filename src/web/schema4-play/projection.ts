import type {Point,Flight} from '../../core-timing/types.ts';
import {home} from '../../core-timing/timing.ts';
/** One square world projection for board, path, sources, pending flights and committed hit snapshots. */
export const SCALE=.06;
export const point=(p:Point):Point=>({x:60+p.x*SCALE,y:90+p.y*SCALE});
export const boardPoint=(col:number,row:number)=>point({x:500+1000*col,y:500+1000*row});
export function boardCell(x:number,y:number){const col=Math.floor((x-60)/60),row=Math.floor((y-90)/60);return col>=0&&col<4&&row>=0&&row<4?{kind:'board' as const,col,row}:null;}
export const supported=(id:string,s:Point,t:Point)=>id==='fixture-01'?t.x>s.x&&Math.abs(t.y-s.y)<=.6*(t.x-s.x):id==='fixture-02'?t.x>s.x&&t.y>=s.y&&t.y-s.y<=1.5*(t.x-s.x):false;
export function nextFlightPosition(f:Flight,target:Point,tick:number):Point{const left=f.arrivalTick-tick;return Number.isSafeInteger(left)&&left>0&&f.positionTick===tick?home(f.position,target,left):f.position;}
export function anchored(p:Point,f:Flight,tick:number,alpha:number,id:string,target:Point):Point{
 const q=point(p),t=point(target),s=point(f.sourcePosition),progress=Math.max(0,Math.min(1,(tick-f.releaseTick+alpha)/(f.arrivalTick-f.releaseTick))),length=Math.hypot(t.x-s.x,t.y-s.y)||1;
 const offset=id==='fixture-01'?{x:(688-360)*32/563+7,y:(365-640)*32/563}:{x:292*32/480+(t.x-s.x)/length*7,y:-170*32/480+(t.y-s.y)/length*7};
 return{x:q.x+offset.x*(1-progress),y:q.y+offset.y*(1-progress)};
}
/** Conservative reserve for full-alpha12px letter /8px bubble; do not relocate overlapping starts. */
export function guard(start:Point,end:Point,enemies:readonly Point[],radius=27):Point|null{let limit=1;const dx=end.x-start.x,dy=end.y-start.y,a=dx*dx+dy*dy;for(const e of enemies){const sx=start.x-e.x,sy=start.y-e.y,c=sx*sx+sy*sy-radius*radius;if(c< -1e-7)return null;if(!a)continue;const b=2*(sx*dx+sy*dy),disc=b*b-4*a*c;if(disc<0)continue;const entry=(-b-Math.sqrt(disc))/(2*a);if(entry>=0&&entry<=limit)limit=entry;}return{x:start.x+dx*limit,y:start.y+dy*limit};}
