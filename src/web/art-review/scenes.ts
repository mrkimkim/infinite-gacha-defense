import type { ReviewSetup } from './model.ts';
/** All checkpoints are discovered in legal seeded matches, never injected events/state. */
export const scenes: ReadonlyArray<{id:string;label:string;tick:number;setup?:ReviewSetup}> = [
  {id:'original',label:'기존 두 공격자 / 사망',tick:25},
  {id:'near',label:'가까운 대각선',tick:1,setup:{seed:1,placements:[{slot:0,row:0,col:0}]}},
  {id:'up',label:'위 방향',tick:13,setup:{seed:1,placements:[{slot:0,row:0,col:0}]}},
  {id:'far',label:'먼 대각선',tick:1,setup:{seed:1,placements:[{slot:0,row:0,col:1}]}},
  {id:'horizontal',label:'수평 방향',tick:66,setup:{seed:2,placements:[{slot:1,row:0,col:3}]}},
  {id:'down',label:'아래 방향',tick:109,setup:{seed:2,placements:[{slot:1,row:2,col:3}]}},
  {id:'multiple',label:'범위 공격 / 복수 피격',tick:18,setup:{seed:2,placements:[{slot:1,row:0,col:3}]}},
];
