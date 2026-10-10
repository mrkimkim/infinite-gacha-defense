import type {
  CombatEvent, Command, CommandEvent, CoreApi, CoreErrorCode, Location,
  MatchState, Observation, ReplayDocument, RulesId,
} from '../core-v2/index.ts';

export type V2Selection = Readonly<{ kind: 'offer'; slot: number } | { kind: 'unit'; id: number }> | null;
export interface V2MatchContainer { readonly state: MatchState }
export type V2InputResult = Readonly<{ ok: true; events: readonly CommandEvent[] }>
  | Readonly<{ ok: false; code: CoreErrorCode | 'STALE_INPUT' | 'NO_SELECTION' }>;
export type V2AdvanceResult = Readonly<{ ok: true; events: readonly CombatEvent[]; executedTicks: number }>;
const selected = (): V2InputResult => ({ ok: true, events: [] });
const sameLocation = (a: Location, b: Location): boolean => a.kind === 'board'
  ? b.kind === 'board' && a.col === b.col && a.row === b.row
  : b.kind === 'bench' && a.slot === b.slot;

/** Input wiring only. An actual v2 engine must be supplied by the caller. */
export function createV2Session(seed: number, rulesId: RulesId, api: CoreApi) {
  const created = api.createMatch(seed, rulesId);
  if (!created.ok) throw new Error(created.error.code);
  // A retired wrapper retains its last state after restart.
  let current = { state: created.state };
  let selection: V2Selection = null;
  const archives: ReplayDocument[] = [];
  const stale = (target: V2MatchContainer) => target !== current;
  const record = (source: MatchState): ReplayDocument => ({
    header: { schemaVersion: source.schemaVersion, rulesId: source.rulesId,
      rulesDigest: source.rulesDigest, seed: source.seed },
    entries: source.acceptedLog,
    finalHash: api.stateHash(source),
  });
  function reconcileSelection(): void {
    if (selection?.kind !== 'unit') return;
    const id = selection.id;
    if (!api.observe(current.state).units.some((unit) => unit.id === id)) selection = null;
  }
  function command(input: Command, target: V2MatchContainer): V2InputResult {
    if (stale(target)) return { ok: false, code: 'STALE_INPUT' };
    const result = api.dispatch(current.state, input);
    if (!result.ok) return { ok: false, code: result.error.code };
    current.state = result.state;
    // The event contains the committed final identity after every automatic upgrade.
    // Never use the transient arrival or infer survivor IDs from preview symbols.
    const purchase = result.events.find((event) => event.type === 'recruited');
    selection = purchase ? { kind: 'unit', id: purchase.result.id } : null;
    reconcileSelection();
    return { ok: true, events: result.events };
  }
  return {
    get match(): V2MatchContainer { return current; },
    get selection(): V2Selection { return selection; },
    get archives(): readonly ReplayDocument[] { return [...archives]; },
    observe(): Observation { return api.observe(current.state); },
    canonical(): string { return api.canonicalState(current.state); },
    record(): ReplayDocument { return record(current.state); },
    cancel(target: V2MatchContainer = current): V2InputResult {
      if (stale(target)) return { ok: false, code: 'STALE_INPUT' };
      selection = null;
      return selected();
    },
    selectOffer(slot: number, target: V2MatchContainer = current): V2InputResult {
      if (stale(target)) return { ok: false, code: 'STALE_INPUT' };
      const observed = api.observe(current.state);
      if (observed.phase !== 'preparation') return { ok: false, code: 'BAD_PHASE' };
      const offer = observed.offers.find((offer) => offer.slot === slot);
      if (!offer) return { ok: false, code: 'BAD_SLOT' };
      if (offer.definitionId === null) return { ok: false, code: 'OFFER_EMPTY' };
      selection = selection?.kind === 'offer' && selection.slot === slot ? null : { kind: 'offer', slot };
      return selected();
    },
    selectLocation(location: Location, target: V2MatchContainer = current): V2InputResult {
      if (stale(target)) return { ok: false, code: 'STALE_INPUT' };
      const observed = api.observe(current.state);
      const unit = observed.units.find((unit) => sameLocation(unit.location, location));
      // Combat/result clicks only inspect existing units. Never dispatch a move/swap/recruit.
      if (observed.phase !== 'preparation') {
        if (!unit) return { ok: false, code: 'BAD_PHASE' };
        selection = selection?.kind === 'unit' && selection.id === unit.id ? null : { kind: 'unit', id: unit.id };
        return selected();
      }
      if (selection?.kind === 'offer') {
        // Offer inspection is not purchase intent, including on a full bench.
        if (!unit) return { ok: false, code: 'NO_SELECTION' };
        selection = { kind: 'unit', id: unit.id };
        return selected();
      }
      if (selection?.kind === 'unit') {
        if (selection.id === unit?.id) { selection = null; return selected(); }
        return command(unit ? { type: 'swap', aId: selection.id, bId: unit.id }
          : { type: 'move', unitId: selection.id, to: location }, target);
      }
      if (!unit) return { ok: false, code: 'NO_SELECTION' };
      selection = { kind: 'unit', id: unit.id };
      return selected();
    },
    recruitSelected(target: V2MatchContainer = current): V2InputResult {
      if (stale(target)) return { ok: false, code: 'STALE_INPUT' };
      if (selection?.kind !== 'offer') return { ok: false, code: 'NO_SELECTION' };
      return command({ type: 'recruit', offerSlot: selection.slot }, target);
    },
    sell(unitId: number, target: V2MatchContainer = current): V2InputResult {
      return command({ type: 'sell', unitId }, target);
    },
    reroll(target: V2MatchContainer = current): V2InputResult { return command({ type: 'reroll' }, target); },
    start(target: V2MatchContainer = current): V2InputResult { return command({ type: 'startWave' }, target); },
    advance(target: V2MatchContainer, ticks: number): V2AdvanceResult | undefined {
      if (stale(target)) return undefined;
      const result = api.advance(current.state, ticks);
      if (!result.ok) throw new Error(result.error.code);
      current.state = result.state;
      if (api.observe(current.state).phase !== 'combat') selection = null;
      else reconcileSelection();
      return { ok: true, events: result.events, executedTicks: result.executedTicks };
    },
    restart(target: V2MatchContainer = current): V2InputResult {
      if (stale(target)) return { ok: false, code: 'STALE_INPUT' };
      const phase = api.observe(current.state).phase;
      if (phase === 'combat' || (phase === 'preparation' && current.state.acceptedLog.length === 0))
        return { ok: false, code: 'BAD_PHASE' };
      const next = api.createMatch(seed, rulesId);
      if (!next.ok) return { ok: false, code: next.error.code };
      const nextState = next.state;
      const oldReplay = record(current.state);
      archives.push(oldReplay);
      current = { state: nextState };
      selection = null;
      return selected();
    },
  };
}
export type V2Session = ReturnType<typeof createV2Session>;
