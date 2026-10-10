/** Verify every displayed pending tick, not merely one sampled flight frame. */
export function cycleEvidence(snap,events){
 const starts=events.filter(e=>e.type==='attackStarted'),impacts=events.filter(e=>e.type==='attackImpacted');
 const at=(tick,pose)=>snap.audit.some(a=>a.tick===tick&&a.pose===pose);
 return impacts.map(impact=>{const start=starts.find(e=>e.attackId===impact.attackId),release=events.find(e=>e.type==='attackReleased'&&e.attackId===impact.attackId),next=starts.find(e=>e.tick>impact.tick);
  const pendingTicks=!!start&&!!release&&Array.from({length:impact.tick-start.tick},(_,i)=>start.tick+i).every(t=>at(t,t<release.tick?'preparation':t===release.tick?'release':'recoil'));
  const complete=pendingTicks&&snap.audit.some(a=>a.flights.some(f=>f.attackId===impact.attackId))&&at(impact.tick,'recovery')&&at(impact.tick+9,'idle')&&!!next;
  return{attackId:impact.attackId,start:start?.tick,release:release?.tick,impact:impact.tick,idle:impact.tick+9,nextStart:next?.tick,completeSupportedVisibleCycle:complete};
 });
}
