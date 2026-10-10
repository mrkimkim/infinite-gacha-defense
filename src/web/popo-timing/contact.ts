import type {Point} from '../../core-timing/types.ts';

export type IncomingSample={position:Point;targetId:number;tick:number};
export type SurfaceContact={anchor:Point;points:readonly Point[];direction:'flight'|'source'};
const RX=14,RY=15,HALF_ARC=.24;
/** Display-space geometry only. hit is the immutable, committed target snapshot. */
export function surfaceContact(hit:Point,source:Point,targetId:number,impactTick:number,sample?:IncomingSample):SurfaceContact|null{
 const valid=sample&&sample.targetId===targetId&&sample.tick===impactTick-1
  &&Number.isFinite(sample.position.x)&&Number.isFinite(sample.position.y)
  &&Math.hypot(sample.position.x-hit.x,sample.position.y-hit.y)>12;
 const from=valid?sample.position:source,dx=from.x-hit.x,dy=from.y-hit.y;
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<1e-6)return null;
 // Parametric ellipse angle whose radius points toward the incoming position.
 const theta=Math.atan2(dy/RY,dx/RX);
 const at=(a:number):Point=>({x:hit.x+RX*Math.cos(a),y:hit.y+RY*Math.sin(a)});
 return{anchor:at(theta),points:Array.from({length:13},(_,i)=>at(theta-HALF_ARC+2*HALF_ARC*i/12)),direction:valid?'flight':'source'};
}
/** Conservative body/HP mask, including stroke/antialias fringe. */
export function protectedEnemyPixel(p:Point,enemy:Point):boolean{
 const dx=p.x-enemy.x,dy=p.y-enemy.y;
 return (dx/11.5)**2+(dy/12.5)**2<=1 || (Math.abs(dx)<=14&&dy>=-21&&dy<=-15);
}
/** Never move a cue around an occluder: keep its source-facing surface or suppress. */
export function contactVisible(contact:SurfaceContact,enemies:readonly Point[]):boolean{
 // Each segment's expanded bounding box contains its round 3.5px outline + AA.
 // It is deliberately conservative and independent of device/effect scaling.
 for(let i=1;i<contact.points.length;i++){
  const a=contact.points[i-1],b=contact.points[i];
  for(let y=Math.floor(Math.min(a.y,b.y)-2.5);y<=Math.ceil(Math.max(a.y,b.y)+2.5);y++)
   for(let x=Math.floor(Math.min(a.x,b.x)-2.5);x<=Math.ceil(Math.max(a.x,b.x)+2.5);x++)
    {const p={x:x+.5,y:y+.5},dx=b.x-a.x,dy=b.y-a.y;
     const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
     if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=1.75+Math.SQRT1_2
       &&enemies.some(e=>protectedEnemyPixel(p,e)))return false;}
 }
 return true;
}
