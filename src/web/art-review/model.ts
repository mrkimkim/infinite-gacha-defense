import * as core from '../../core-v2/index.ts';
import type { CombatEvent, Command, MatchState } from '../../core-v2/types.ts';
export type Attack = Extract<CombatEvent, { type: 'attack' }>;
export const ATTACK_TICKS = 2, RECOVERY_TICKS = 3, HIT_TICKS = 8;
/** All data comes from committed engine results; no event fabrication or state patching. */
export type ReviewSetup = { seed: number; placements: { slot: number; row: number; col: number }[] };
export function createReviewMatch(setup?: ReviewSetup) {
  const created = core.createMatch(setup?.seed ?? 1, core.EXPERIMENT_RULES_ID);
  if (!created.ok) throw new Error('REVIEW_CREATE');
  let state: MatchState = created.state;
  function command(command: Command) {
    const result = core.dispatch(state, command);
    if (!result.ok) throw new Error(result.error.code);
    state = result.state;
  }
  for(const p of setup?.placements ?? [{slot:0,row:0,col:0},{slot:1,row:3,col:3}]) {
    command({type:'recruit',offerSlot:p.slot});
    command({type:'move',unitId:state.units.at(-1)!.id,to:{kind:'board',row:p.row,col:p.col}});
  }
  const owner = Object.freeze({});
  return { owner, get state() { return state; }, command,
    advance(ticks: number) { const r = core.advance(state, ticks); if (!r.ok) throw new Error(r.error.code); state = r.state; return r.events; },
    observe: () => core.observe(state),
    record: () => ({ header: { schemaVersion: 3 as const, rulesId: state.rulesId, rulesDigest: state.rulesDigest, seed: state.seed }, entries: state.acceptedLog, finalHash: core.stateHash(state) }),
  };
}
/** A binding is scoped to match + selected entity. Past effects never migrate on replacement. */
export function createFeedback() {
  let owner: object | null = null, entity = -1, attacks: Attack[] = [];
  const shown = new Map<Attack,number>();
  return {
    bind(nextOwner: object, nextEntity: number) { owner = nextOwner; entity = nextEntity; attacks = []; shown.clear(); },
    consume(from: object, events: readonly CombatEvent[], presentationTick?: number) {
      if (from !== owner) return;
      for (const e of events) if (e.type === 'attack' && e.unitId === entity && !attacks.some(a => a.tick === e.tick)) { attacks.push(e); shown.set(e,presentationTick ?? e.tick); }
      attacks = attacks.slice(-32);
      for(const a of shown.keys())if(!attacks.includes(a))shown.delete(a);
    },
    sample(from: object, tick: number) {
      if (from !== owner) { return { pose: 'idle' as const, hits: [] as Attack[], attack: undefined }; }
      attacks = attacks.filter(a => a.tick <= tick && tick - (shown.get(a) ?? a.tick) < HIT_TICKS);
      const attack = attacks.at(-1), age = attack ? tick - (shown.get(attack) ?? attack.tick) : Infinity;
      const pose: 'idle' | 'attack' | 'recovery' = age < ATTACK_TICKS ? 'attack' : age < ATTACK_TICKS + RECOVERY_TICKS ? 'recovery' : 'idle';
      return { pose, hits: [...attacks], attack };
    },
  };
}
/** Guards the entire binding, not merely image identity; rejects late loads after any reset. */
export function createLease() {
  let generation = 0, disposed = false;
  return { renew: () => ++generation, accepts: (ticket: number) => !disposed && ticket === generation,
    dispose() { disposed = true; generation++; } };
}
