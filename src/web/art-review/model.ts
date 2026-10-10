import * as core from '../../core-v2/index.ts';
import type { CombatEvent, Command, MatchState } from '../../core-v2/types.ts';
export type Attack = Extract<CombatEvent, { type: 'attack' }>;
export const ATTACK_TICKS = 2, RECOVERY_TICKS = 3, HIT_TICKS = 8;
/** All data comes from committed engine results; no event fabrication or state patching. */
export function createReviewMatch() {
  const created = core.createMatch(1, core.EXPERIMENT_RULES_ID);
  if (!created.ok) throw new Error('REVIEW_CREATE');
  let state: MatchState = created.state;
  function command(command: Command) {
    const result = core.dispatch(state, command);
    if (!result.ok) throw new Error(result.error.code);
    state = result.state;
  }
  command({ type: 'recruit', offerSlot: 0 });
  command({ type: 'move', unitId: state.units[0].id, to: { kind: 'board', row: 0, col: 0 } });
  command({ type: 'recruit', offerSlot: 1 });
  command({ type: 'move', unitId: state.units[1].id, to: { kind: 'board', row: 3, col: 3 } });
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
  return {
    bind(nextOwner: object, nextEntity: number) { owner = nextOwner; entity = nextEntity; attacks = []; },
    consume(from: object, events: readonly CombatEvent[]) {
      if (from !== owner) return;
      for (const e of events) if (e.type === 'attack' && e.unitId === entity && !attacks.some(a => a.tick === e.tick)) attacks.push(e);
      attacks = attacks.slice(-32);
    },
    sample(from: object, tick: number) {
      if (from !== owner) { return { pose: 'idle' as const, hits: [] as Attack[], attack: undefined }; }
      attacks = attacks.filter(a => a.tick <= tick && tick - a.tick < HIT_TICKS);
      const attack = attacks.at(-1), age = attack ? tick - attack.tick : Infinity;
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
