import test from 'node:test';import assert from 'node:assert/strict';
import * as core from '../../src/core-timing/index.ts';
import {createSession} from '../../src/web/schema4-play/session.ts';
import {createPresentation,type BattleView} from '../../src/web/schema4-play/presentation.ts';
import {createRecoveryTail} from '../../src/web/schema4-play/recovery-tail.ts';
function completedWave(){
 const s=createSession(5,core.EXPERIMENT_RULES_ID,core);
 for(const [slot,col] of [[0,0],[2,1]]){s.selectOffer(slot);assert(s.recruitSelected().ok);assert(s.selectLocation({kind:'board',col,row:3}).ok);}
 assert(s.start().ok);const p=createPresentation();p.bind(s.match,s.observe());let view:BattleView;
 do{const r=s.advance(s.match,1)!;view=p.present(s.match,s.observe(),r.events,0)!;}while(s.observe().phase==='combat');
 assert.equal(s.observe().tick,335);assert.equal(view!.units.find(u=>u.id===2)!.pose,'recovery');return{s,p,view:view!};
}
function harness(view:BattleView,initialOwner:object){
 let owner=initialOwner,blocked=false,current=view,paintCount=0,next=0;const callbacks=new Map<number,(t:number)=>void>(),cancelled:number[]=[];
 const tail=createRecoveryTail({getOwner:()=>owner,requestFrame:cb=>{callbacks.set(++next,cb);return next;},cancelFrame:id=>{cancelled.push(id);},paint:token=>{paintCount++;current=tail.update(token,view,blocked);}});
 return{tail,callbacks,cancelled,get current(){return current;},get paints(){return paintCount;},get lastId(){return next;},draw(){current=tail.update(owner,view,blocked);},frame(t:number){callbacks.get(next)!(t);},block(value:boolean){blocked=value;tail.setSuspended(value);},replace(token:object){owner=token;},setView(v:BattleView){view=v;}};
}
test('preparation first frame retains final hit, then only recovery poses settle after 400 active ms',()=>{
 const {s,view}=completedWave(),h=harness(view,s.match),hash=s.record().finalHash;h.draw();assert.strictEqual(h.current,view);
 h.frame(0);h.frame(200);h.frame(399);assert.strictEqual(h.current,view);h.frame(400);
 assert.equal(h.current.units.find(u=>u.id===2)!.pose,'idle');assert.equal(h.current.units.find(u=>u.id===1)!.pose,'idle');
 for(const key of ['history','contacts','hits','impacts','enemies','flights','cancelled'] as const)assert.strictEqual(h.current[key],view[key]);
 assert(view.contacts.length>0);assert.equal(s.record().finalHash,hash);assert.equal(s.observe().tick,335);assert.equal(h.lastId,4);
 h.draw();assert.equal(h.current.units.find(u=>u.id===2)!.pose,'idle');assert.equal(h.lastId,4);
});
test('pause/hidden discard elapsed wall time and stale or duplicate RAF callbacks cannot settle',()=>{
 const {s,view}=completedWave(),h=harness(view,s.match);h.draw();h.frame(0);h.frame(100);const stale=h.callbacks.get(h.lastId)!;const paints=h.paints;
 h.block(true);stale(1000);h.draw();assert.equal(h.paints,paints);assert.strictEqual(h.current,view);
 h.block(false);h.frame(10000);assert.strictEqual(h.current,view);const duplicate=h.callbacks.get(h.lastId)!;h.frame(10200);const count=h.paints;duplicate(10400);assert.equal(h.paints,count);h.frame(10300);assert.equal(h.current.units.find(u=>u.id===2)!.pose,'idle');
});
test('invalid, backward and long RAF intervals never catch up display time',()=>{
 const {s,view}=completedWave(),h=harness(view,s.match);h.draw();for(const t of [0,1000,900,NaN,2000,2200]){h.frame(t);assert.strictEqual(h.current,view);}h.frame(2400);assert.equal(h.current.units.find(u=>u.id===2)!.pose,'idle');
});
test('old owner, reset and a new combat phase retire queued pose callbacks',()=>{
 const {s,view}=completedWave(),h=harness(view,s.match);h.draw();h.frame(0);h.frame(200);const old=h.callbacks.get(h.lastId)!;h.replace({});old(400);assert.strictEqual(h.current,view);assert.equal(h.paints,2);
 h.tail.reset();old(1000);h.draw();h.frame(2000);h.frame(2200);assert.strictEqual(h.current,view);
 const late=h.callbacks.get(h.lastId)!;h.setView({...view,phase:'combat'});h.draw();const count=h.paints;late(2400);assert.equal(h.paints,count);assert.equal(h.current.phase,'combat');
});
test('new preparation stamp gets a fresh tail; result policy and ordinary idle screens stay inert',()=>{
 const {s,view}=completedWave(),h=harness(view,s.match);h.draw();h.frame(0);h.frame(200);h.frame(400);h.setView({...view,tick:336});h.draw();assert.equal(h.current.units.find(u=>u.id===2)!.pose,'recovery');
 const stale=h.callbacks.get(h.lastId)!;h.setView({...view,phase:'result'});h.draw();const count=h.paints;stale(600);assert.equal(h.paints,count);assert.equal(h.current.units.find(u=>u.id===2)!.pose,'recovery');
 h.setView({...view,units:[]});h.draw();assert.equal(h.current.units.length,0);
});
