import type {BattleView} from './presentation.ts';

/** A bounded presentation-only tail after combat stops; never advances core time. */
export function createRecoveryTail(options:{
 getOwner:()=>object;
 requestFrame:(callback:(timestamp:number)=>void)=>number;
 cancelFrame:(handle:number)=>void;
 paint:(owner:object)=>void;
}){
 const durationMs=400;
 let owner:object|null=null,stamp='',elapsed=0,last:number|null=null,settled=false,suspended=false,epoch=0;
 let pending:{handle:number|null}|null=null;
 function cancel(){epoch++;last=null;const old=pending;pending=null;if(old?.handle!==null&&old?.handle!==undefined)options.cancelFrame(old.handle);}
 function reset(){cancel();owner=null;stamp='';elapsed=0;settled=false;}
 function setSuspended(value:boolean){if(suspended===value)return;suspended=value;cancel();if(!value)schedule();}
 function schedule(){
  if(!owner||settled||suspended||pending)return;
  const token=owner,generation=epoch,ticket:{handle:number|null}={handle:null};pending=ticket;
  ticket.handle=options.requestFrame(timestamp=>{
   if(pending!==ticket||generation!==epoch||token!==options.getOwner()||suspended)return;
   pending=null;
   if(Number.isFinite(timestamp)){
    if(last!==null){const dt=timestamp-last;if(dt>=0&&dt<=250)elapsed+=dt;}
    last=timestamp;
   }else last=null;
   settled=elapsed>=durationMs;
   options.paint(token);
  });
 }
 function update(token:object,view:BattleView,blocked:boolean):BattleView{
  if(token!==options.getOwner())return view;
  // Result screens retain their existing terminal presentation policy.
  if(view.phase!=='preparation'||!view.units.some(u=>u.pose==='recovery')){reset();setSuspended(blocked);return view;}
  const nextStamp=`${view.phase}:${view.tick}`;
  if(owner!==token||stamp!==nextStamp){reset();owner=token;stamp=nextStamp;}
  setSuspended(blocked);schedule();
  // Keep impacts, enemy HP/death, contacts and ledger identities untouched.
  return settled?{...view,units:view.units.map(u=>u.pose==='recovery'?{...u,pose:'idle'}:u)}:view;
 }
 return{update,setSuspended,reset};
}
