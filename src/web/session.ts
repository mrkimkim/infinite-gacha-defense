import * as core from '../core/index.ts';
import type { Command, CoreApi, CoreErrorCode, MatchState, Observation, ReplayHeader } from '../core/index.ts';

export type Selection = { kind: 'offer'; slot: number } | { kind: 'unit'; id: number } | null;
export interface MatchContainer { state: MatchState }
export interface ReplayRecord { header: ReplayHeader; entries: MatchState['acceptedLog'] }
export type InputResult = { ok: true } | { ok: false; code: CoreErrorCode | 'STALE_INPUT' | 'NO_SELECTION' };

/** Adapter-owned selection/archive. All authoritative decisions stay in CoreApi. */
export function createSession(seed: number, api: CoreApi = core) {
  const created = api.createMatch(seed);
  if (!created.ok) throw new Error(created.error.code);
  let current: MatchContainer = { state: created.state };
  let selection: Selection = null;
  const previous: ReplayRecord[] = [];
  const record = (state: MatchState): ReplayRecord => ({
    header: { schemaVersion: state.schemaVersion, rulesId: state.rulesId,
      rulesDigest: state.rulesDigest, seed: state.seed },
    entries: state.acceptedLog,
  });
  function command(command: Command, target = current): InputResult {
    if (target !== current) return { ok: false, code: 'STALE_INPUT' };
    const result = api.dispatch(current.state, command);
    if (!result.ok) return { ok: false, code: result.error.code };
    current.state = result.state;
    selection = null;
    return { ok: true };
  }
  return {
    get match() { return current; },
    get selection() { return selection; },
    get archives(): readonly ReplayRecord[] { return previous; },
    observe(): Observation { return api.observe(current.state); },
    canonical(): string { return api.canonicalState(current.state); },
    record(): ReplayRecord { return record(current.state); },
    cancel() { selection = null; },
    selectOffer(slot: number): InputResult {
      if (current.state.phase !== 'preparation') return { ok: false, code: 'BAD_PHASE' };
      selection = selection?.kind === 'offer' && selection.slot === slot ? null : { kind: 'offer', slot };
      return { ok: true };
    },
    selectCell(col: number, row: number, target = current): InputResult {
      if (target !== current) return { ok: false, code: 'STALE_INPUT' };
      if (current.state.phase !== 'preparation') return { ok: false, code: 'BAD_PHASE' };
      const unit = api.observe(current.state).units.find((u) =>
        u.location.kind === 'board' && u.location.col === col && u.location.row === row);
      if (selection?.kind === 'offer') {
        return command({ type: 'recruit', offerSlot: selection.slot, to: { kind: 'board', col, row } }, target);
      }
      if (selection?.kind === 'unit') {
        if (unit?.id === selection.id) { selection = null; return { ok: true }; }
        return command(unit ? { type: 'swap', aId: selection.id, bId: unit.id }
          : { type: 'move', unitId: selection.id, to: { kind: 'board', col, row } }, target);
      }
      if (unit) { selection = { kind: 'unit', id: unit.id }; return { ok: true }; }
      return { ok: false, code: 'NO_SELECTION' };
    },
    start(target = current): InputResult { return command({ type: 'startWave' }, target); },
    advance(target: MatchContainer, ticks: number) {
      if (target !== current) return;
      const result = api.advance(current.state, ticks);
      if (!result.ok) throw new Error(result.error.code);
      current.state = result.state;
      if (current.state.phase !== 'combat') selection = null;
      return result;
    },
    restart(): InputResult {
      if (current.state.phase !== 'result') return { ok: false, code: 'BAD_PHASE' };
      const next = api.createMatch(seed, current.state.rulesId);
      if (!next.ok) return { ok: false, code: next.error.code };
      // Keep the authoritative old replay before exposing the next match.
      previous.push(record(current.state));
      current = { state: next.state };
      selection = null;
      return { ok: true };
    },
  };
}
export type Session = ReturnType<typeof createSession>;
