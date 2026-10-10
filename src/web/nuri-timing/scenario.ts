import * as core from '../../core-timing/index.ts';
import type {Command,MatchState} from '../../core-timing/types.ts';
export const scenes={
 single:{label:'일반 범위 타격',seed:24,start:89,release:94,terminal:96,end:104,attack:4,hits:[2],dead:[]},
 lethal:{label:'두 적 동시 처치',seed:24,start:651,release:656,terminal:658,end:666,attack:26,hits:[7,10],dead:[7,10]},
 multi:{label:'주대상 처치 + 나머지 피해',seed:24,start:1059,release:1064,terminal:1066,end:1074,attack:43,hits:[9,14,25],dead:[9]},
 cancel:{label:'보조 기물 처치 → 물방울 취소',seed:10,start:615,release:620,terminal:622,end:630,attack:72,hits:[],dead:[]},
} as const;
export type Scene=keyof typeof scenes;
export function scenario(name:Scene,atTick:number=scenes[name].start):MatchState{
 const config=scenes[name],initial=core.createMatch(config.seed,core.EXPERIMENT_RULES_ID);if(!initial.ok)throw Error(initial.error.code);let state=initial.state;
 const commands:Command[]=[{type:'recruit',offerSlot:name==='cancel'?2:0},{type:'move',unitId:1,to:{kind:'board',col:3,row:0}}];
 if(name==='cancel')commands.push({type:'recruit',offerSlot:0},{type:'move',unitId:2,to:{kind:'board',col:3,row:1}});
 const dispatch=(command:Command)=>{const r=core.dispatch(state,command);if(!r.ok)throw Error(r.error.code);state=r.state;};
 for(const command of commands)dispatch(command);
 if(!Number.isSafeInteger(atTick)||atTick<0||atTick>config.end)throw Error('Review tick outside legal scene');
 while(state.tick<atTick){if(state.phase==='preparation')dispatch({type:'startWave'});const r=core.advance(state,1);if(!r.ok||r.executedTicks!==1)throw Error('Replay cannot reach review tick');state=r.state;}
 return state;
}
export function supported(source:{x:number;y:number},target:{x:number;y:number}){const dx=target.x-source.x,dy=target.y-source.y;return dx>0&&dy>=0&&dy<=1.5*dx;}
