import * as core from '../../src/core-timing/index.ts';
import type {CoreApi,Windup,Flight,CombatEvent,Observation} from '../../src/core-timing/index.ts';
const api:CoreApi=core;void api;
function consume(o:Observation,event:CombatEvent){const pending:readonly(Windup|Flight)[]=[...o.windups,...o.flights];void pending;if(event.type==='attackStarted'||event.type==='attackReleased'){
 // @ts-expect-error Start/release are not actual damage events.
 void event.hits;
}
 // @ts-expect-error Public observation never contains private allocator.
 void o.nextAttackId;
}
void consume;
