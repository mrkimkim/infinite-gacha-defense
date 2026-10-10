import * as core from '../../core-timing/index.ts';
import type {MatchState,Command} from '../../core-timing/types.ts';
/** Legal deterministic replay only: no injected enemy HP, positions or attack state. */
export function scenario(tick=122):MatchState {
 const initial=core.createMatch(1,core.EXPERIMENT_RULES_ID);if(!initial.ok)throw Error(initial.error.code);
 let state=initial.state;
 const commands:Command[]=[{type:'recruit',offerSlot:0},{type:'move',unitId:1,to:{kind:'board',col:3,row:0}},{type:'startWave'}];
 for(const command of commands){const r=core.dispatch(state,command);if(!r.ok)throw Error(r.error.code);state=r.state;}
 const r=core.advance(state,tick);if(!r.ok)throw Error(r.error.code);return r.state;
}
export function supported(source:{x:number;y:number},target:{x:number;y:number}){
 return target.x>source.x && Math.abs(target.y-source.y)<=.6*(target.x-source.x);
}
