import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createV2Session } from '../../src/web/v2-session.ts';
import { RULES_PROPOSALS, RULES_DIGESTS } from '../../src/core-v2/index.ts';
import type {
  AdvanceResult, Command, CoreApi, CreateMatchResult, DispatchResult, Location,
  MatchState, Observation, ObservedUnit, PublicRules, RulesId, Unit,
} from '../../src/core-v2/index.ts';

// Typed, scripted adapter fixtures ONLY. No engine simulation or gameplay/playtest evidence.
const rulesId: RulesId = 'playable-v2-gen2-fixture1-count40';
const { prng: _prng, ...proposal } = RULES_PROPOSALS[rulesId];
const rules: PublicRules = { ...proposal, rulesDigest: RULES_DIGESTS[rulesId] };
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const bench = (slot: number): Location => ({ kind: 'bench', slot });
const board = (col: number, row: number): Location => ({ kind: 'board', col, row });
const unit = (id: number, location = bench(0)): Unit =>
  ({ id, definitionId: 'popo', star: 1, cooldown: 0, location });
function state(patch: Partial<MatchState> = {}): MatchState {
  return freeze({ schemaVersion: 3, rulesId, rulesDigest: RULES_DIGESTS[rulesId], seed: 42,
    rngState: 123, nextEntityId: 100, tick: 0, phase: 'preparation', outcome: null,
    outcomeReason: null, wave: 1, waveTick: 0, spawnCursor: 0, gold: 12,
    offers: [{ slot: 0, definitionId: 'popo' }, { slot: 1, definitionId: null },
      { slot: 2, definitionId: 'momo' }], units: [],
    enemies: [], acceptedLog: [], ...patch });
}
function observation(source: MatchState): Observation {
  const units: ObservedUnit[] = source.units.map((u) => ({ ...u,
    rarityId: 'common', damage: 1,
    bossDamage: 1, range: 1, nextAttackCooldown: 1, supportActive: false,
    supportSourceIds: [], sellGold: 1 }));
  return freeze({ rules, tick: source.tick, phase: source.phase, outcome: source.outcome,
    outcomeReason: source.outcomeReason, wave: source.wave, waveTick: source.waveTick,
    gold: source.gold, offers: source.offers.map((offer) => ({ ...offer,
      rarityId: offer.definitionId === null ? null : 'common',
      price: offer.definitionId === null ? null : 2,
      recruitPreview: { ok: false, error: { code: 'NO_RECRUIT_SPACE' } } })), units, enemies: [],
    synergies: [], boardCount: 0, benchCount: 0, remainingCount: 0,
    countLimit: 40, warningCount: 32, warning: false, segmentRemainingTicks: 400,
    bossDeadlineWaveTick: null, bossRemainingTicks: null,
    nextWave: null, canStartWave: false });
}
function harness(initial = state()) {
  const calls = { create: [] as unknown[][], dispatch: [] as { state: MatchState; command: unknown }[],
    advance: [] as unknown[][], observe: [] as MatchState[], hash: [] as MatchState[] };
  let created: CreateMatchResult = { ok: true, state: initial };
  let dispatched: DispatchResult | undefined;
  let advanced: AdvanceResult | undefined;
  let onCreate: (() => void) | undefined;
  let onDispatch: (() => void) | undefined;
  let observed: Observation | undefined;
  let onHash: (() => void) | undefined;
  const unused = (): never => { throw new Error('Unscripted fixture API'); };
  const api: CoreApi = {
    createMatch(seed, profile) { calls.create.push([seed, profile]); onCreate?.(); return created; },
    dispatch(source, command) {
      calls.dispatch.push({ state: source, command }); onDispatch?.();
      assert.ok(dispatched, 'explicit dispatch fixture required'); return dispatched;
    },
    advance(source, ticks) {
      calls.advance.push([source, ticks]); assert.ok(advanced, 'explicit advance fixture required'); return advanced;
    },
    observe(source) { calls.observe.push(source); return observed ?? observation(source); },
    canonicalState: () => 'core-canonical',
    stateHash(source) { calls.hash.push(source); onHash?.(); return 'a'.repeat(64); },
    previewRecruit: unused, replay: unused, getRules: unused, pathPosition: unused, boardPosition: unused,
  };
  return { api, calls, initial, session: createV2Session(42, rulesId, api),
    create(value: CreateMatchResult) { created = value; },
    dispatch(value: DispatchResult) { dispatched = value; },
    advance(value: AdvanceResult) { advanced = value; },
    observe(value: Observation) { observed = value; },
    onCreate(value: () => void) { onCreate = value; },
    onDispatch(value: () => void) { onDispatch = value; },
    onHash(value: () => void) { onHash = value; },
  };
}
const accepted = (next = state()): DispatchResult => ({ ok: true, state: next, events: [] });
const success = { ok: true, events: [] };

test('mandatory injected API, exact seed/profile, observation/canonical and full replay delegation', () => {
  const h = harness();
  assert.deepEqual(h.calls.create, [[42, rulesId]]);
  assert.equal(h.session.match.state, h.initial);
  assert.equal(h.session.observe().phase, 'preparation');
  assert.equal(h.session.canonical(), 'core-canonical');
  assert.equal(h.calls.hash.length, 0);
  assert.deepEqual(h.session.record(), { header: { schemaVersion: 3, seed: 42, rulesId,
    rulesDigest: h.initial.rulesDigest }, entries: h.initial.acceptedLog, finalHash: 'a'.repeat(64) });
  h.create({ ok: false, error: { code: 'BAD_SEED' } });
  assert.throws(() => createV2Session(0, rulesId, h.api), /BAD_SEED/);
});

test('selection validates observation identity; empty offers, unknown locations never selected', () => {
  const h = harness();
  h.session.selectOffer(0);
  for (const [slot, code] of [[1, 'OFFER_EMPTY'], [9, 'BAD_SLOT']] as const) {
    assert.deepEqual(h.session.selectOffer(slot), { ok: false, code });
    assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
  }
  h.session.cancel();
  assert.deepEqual(h.session.selectLocation(board(0, 0)), { ok: false, code: 'NO_SELECTION' });
  h.session.selectOffer(0); h.session.selectOffer(0);
  assert.equal(h.session.selection, null);
  assert.equal(h.calls.dispatch.length, 0);
});

test('observation is the sole selection/phase source, not exposed diagnostic state', () => {
  const h = harness();
  h.observe(observation(state({ units: [unit(7, board(2, 2))], phase: 'combat' })));
  assert.deepEqual(h.session.selectOffer(0), { ok: false, code: 'BAD_PHASE' });
  assert.deepEqual(h.session.selectLocation(board(2, 2)), success);
  assert.deepEqual(h.session.selection, { kind: 'unit', id: 7 });
  assert.equal(h.calls.dispatch.length, 0);
});

for (const occupied of [false, true]) {
  test(`board/bench input delegates ${occupied ? 'swap' : 'move'} and toggles same unit`, () => {
    const h = harness(state({ units: [unit(7, board(0, 0)), ...(occupied ? [unit(8, bench(2))] : [])] }));
    h.session.selectLocation(board(0, 0)); h.session.selectLocation(board(0, 0));
    assert.equal(h.session.selection, null);
    h.session.selectLocation(board(0, 0)); h.dispatch(accepted());
    assert.deepEqual(h.session.selectLocation(bench(2)), success);
    const expected: Command = occupied ? { type: 'swap', aId: 7, bId: 8 }
      : { type: 'move', unitId: 7, to: bench(2) };
    assert.deepEqual(h.calls.dispatch[0]?.command, expected);
  });
}

test('sell, reroll and start forward exact commands; validation remains core-owned', () => {
  const h = harness();
  h.dispatch(accepted());
  h.session.sell(7); h.session.reroll(); h.session.start();
  assert.deepEqual(h.calls.dispatch.map((call) => call.command), [
    { type: 'sell', unitId: 7 }, { type: 'reroll' }, { type: 'startWave' }]);
});

for (const phase of ['combat', 'result'] as const) {
  test(`${phase} permits unit inspection only; explicit commands get core BAD_PHASE`, () => {
    const h = harness(state({ phase, units: [unit(7), unit(8, board(1, 1))] }));
    assert.deepEqual(h.session.selectOffer(0), { ok: false, code: 'BAD_PHASE' });
    h.session.selectLocation(bench(0)); h.session.selectLocation(board(1, 1));
    assert.deepEqual(h.session.selection, { kind: 'unit', id: 8 });
    assert.deepEqual(h.session.selectLocation(bench(5)), { ok: false, code: 'BAD_PHASE' });
    assert.equal(h.calls.dispatch.length, 0);
    h.dispatch({ ok: false, state: h.initial, error: { code: 'BAD_PHASE' } });
    assert.deepEqual(h.session.sell(8), { ok: false, code: 'BAD_PHASE' });
    assert.deepEqual(h.session.selection, { kind: 'unit', id: 8 });
  });
}

test('advance delegates batch and combat events, clears selection on transition, failures throw', () => {
  const h = harness(state({ phase: 'combat', units: [unit(7)] }));
  h.session.selectLocation(bench(0));
  const wrapper = h.session.match;
  const next = state({ phase: 'result', tick: 2 });
  const events = [{ type: 'matchEnded' as const, tick: 2, wave: 1, waveTick: 2,
    outcome: 'loss' as const, reason: 'accumulation' as const }];
  h.advance({ ok: true, state: next, events, executedTicks: 2 });
  assert.deepEqual(h.session.advance(wrapper, 5), { ok: true, events, executedTicks: 2 });
  assert.deepEqual(h.calls.advance, [[h.initial, 5]]);
  assert.equal(wrapper.state, next); assert.equal(h.session.selection, null);
  h.advance({ ok: false, state: h.initial, executedTicks: 0, error: { code: 'BAD_COUNT' } });
  assert.throws(() => h.session.advance(wrapper, 0), /BAD_COUNT/);
  assert.equal(wrapper.state, next);
});

test('restart archives exact old replay then replaces wrapper; same seed/profile; stale inputs inert', () => {
  const old = state({ phase: 'result', acceptedLog: [
    { type: 'advance', seq: 1, startTick: 0, executedTicks: 2 },
  ] });
  const h = harness(old);
  const target = h.session.match;
  h.create({ ok: true, state: state() });
  h.onHash(() => { assert.equal(h.session.match, target); });
  assert.deepEqual(h.session.restart(), success);
  assert.notEqual(h.session.match, target); assert.equal(target.state, old);
  assert.deepEqual(h.calls.create[1], [42, rulesId]);
  assert.equal(h.session.archives[0]?.entries, old.acceptedLog);
  assert.equal(h.session.archives[0]?.finalHash, 'a'.repeat(64));
  h.session.selectOffer(0);
  for (const stale of [target, { state: h.session.match.state }]) {
    const results = [h.session.selectOffer(2, stale), h.session.recruitSelected(stale),
      h.session.selectLocation(bench(0), stale), h.session.cancel(stale),
      h.session.sell(1, stale),
      h.session.reroll(stale), h.session.start(stale), h.session.restart(stale)];
    results.forEach((result) => assert.deepEqual(result, { ok: false, code: 'STALE_INPUT' }));
    assert.equal(h.session.advance(stale, 1), undefined);
  }
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
  assert.equal(h.calls.dispatch.length, 0); assert.equal(h.calls.advance.length, 0);
});

test('failed restart/throw preserve old state and archives; successful retry archives exactly once', () => {
  const h = harness(state({ phase: 'result' }));
  const wrapper = h.session.match;
  h.create({ ok: false, error: { code: 'UNKNOWN_RULES' } });
  assert.deepEqual(h.session.restart(), { ok: false, code: 'UNKNOWN_RULES' });
  h.onCreate(() => { throw new Error('fatal create'); });
  assert.throws(() => h.session.restart(), /fatal create/);
  assert.equal(h.session.match, wrapper); assert.deepEqual(h.session.archives, []);
  h.onCreate(() => {}); h.create({ ok: true, state: state() });
  h.onHash(() => { throw new Error('fatal hash'); });
  assert.throws(() => h.session.restart(), /fatal hash/);
  assert.equal(h.session.match, wrapper); assert.deepEqual(h.session.archives, []);
  h.onHash(() => {}); h.session.restart();
  assert.equal(h.session.archives.length, 1);
  assert.deepEqual(h.session.restart(), { ok: false, code: 'BAD_PHASE' });
  assert.equal(h.session.archives.length, 1);
});

test('unexpected dispatch throws propagate without adopting state or dropping selection', () => {
  const h = harness(); h.session.selectOffer(0);
  h.onDispatch(() => { throw new Error('fatal dispatch'); });
  assert.throws(() => h.session.recruitSelected(), /fatal dispatch/);
  assert.equal(h.session.match.state, h.initial);
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
});

test('move rejection preserves selected unit and authoritative reference', () => {
  const h = harness(state({ units: [unit(7)] }));
  h.session.selectLocation(bench(0));
  h.dispatch({ ok: false, state: state({ gold: 999 }), error: { code: 'BAD_LOCATION' } });
  assert.deepEqual(h.session.selectLocation(board(-1, 0)), { ok: false, code: 'BAD_LOCATION' });
  assert.equal(h.session.match.state, h.initial);
  assert.deepEqual(h.session.selection, { kind: 'unit', id: 7 });
});

test('restart failure preserves previous archives; throwing result accessor does not append archive', () => {
  const h = harness(state({ phase: 'result' }));
  const second = state({ phase: 'result', tick: 100 });
  h.create({ ok: true, state: second }); h.session.restart();
  const wrapper = h.session.match;
  const archived = h.session.archives[0];
  h.create({ ok: true, get state(): MatchState { throw new Error('fatal result accessor'); } });
  assert.throws(() => h.session.restart(), /fatal result accessor/);
  assert.equal(h.session.match, wrapper); assert.equal(h.session.archives.length, 1);
  assert.equal(h.session.archives[0], archived);
  h.create({ ok: true, state: state() }); h.session.restart();
  assert.equal(h.session.archives.length, 2);
  assert.equal(h.session.archives[1]?.entries, second.acceptedLog);
});

test('preparation/combat restart is blocked; accepted combat advance retains inspection', () => {
  for (const phase of ['preparation', 'combat'] as const) {
    const h = harness(state({ phase, units: [unit(7)] }));
    assert.deepEqual(h.session.restart(), { ok: false, code: 'BAD_PHASE' });
    assert.equal(h.calls.create.length, 1);
    assert.deepEqual(h.session.archives, []);
    if (phase === 'combat') {
      h.session.selectLocation(bench(0));
      h.advance({ ok: true, state: state({ phase, units: [unit(7)], tick: 1 }), events: [], executedTicks: 1 });
      h.session.advance(h.session.match, 1);
      assert.deepEqual(h.session.selection, { kind: 'unit', id: 7 });
    }
  }
});

test('offer location clicks never buy; only explicit purchase forwards slot without a destination', () => {
  const h = harness(state({ units: [unit(7, bench(0))] }));
  assert.deepEqual(h.session.recruitSelected(), { ok: false, code: 'NO_SELECTION' });
  h.session.selectOffer(0);
  assert.deepEqual(h.session.selectLocation(board(0, 0)), { ok: false, code: 'NO_SELECTION' });
  assert.deepEqual(h.session.selectLocation(bench(1)), { ok: false, code: 'NO_SELECTION' });
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
  h.session.selectLocation(bench(0));
  assert.deepEqual(h.session.selection, { kind: 'unit', id: 7 });
  assert.deepEqual(h.session.recruitSelected(), { ok: false, code: 'NO_SELECTION' });
  assert.equal(h.calls.dispatch.length, 0);
});

for (const chain of [false, true]) {
  test(`recruit adopts atomic ${chain ? 'chained upgrade' : 'arrival'} final identity on full bench`, () => {
    const initial = state({ gold: 0, units: Array.from({ length: 8 }, (_, i) => unit(i + 1, bench(i))) });
    const h = harness(initial);
    const intermediate: Unit = { ...unit(101, board(3, 2)), star: 2 };
    const final: Unit = chain ? { ...unit(102, board(3, 2)), star: 3 } : unit(100, bench(0));
    const next = state({ units: [final] });
    const events = freeze([{
      type: 'recruited' as const, tick: 0, wave: 1, waveTick: 0, offerSlot: 0, goldDelta: -2,
      arrival: { id: 100, definitionId: 'popo', star: 1 as const, cooldown: 0 as const, location: null },
      upgrades: chain ? [
        { consumedIds: [1, 2, 100] as const, result: intermediate },
        { consumedIds: [3, 4, 101] as const, result: final },
      ] : [], result: final,
    }]);
    const before = JSON.stringify(initial);
    const wrapper = h.session.match;
    h.session.selectOffer(0);
    // Deliberately contradictory scripted data: the adapter must not infer price,
    // capacity, affordability or upgrade outcome, or gate dispatch using a preview.
    assert.equal(h.session.observe().offers[0]?.recruitPreview.ok, false);
    h.dispatch({ ok: true, state: next, events });
    assert.deepEqual(h.session.recruitSelected(), { ok: true, events });
    assert.deepEqual(h.calls.dispatch, [{ state: initial, command: { type: 'recruit', offerSlot: 0 } }]);
    assert.deepEqual(h.session.selection, { kind: 'unit', id: final.id });
    assert.equal(h.session.match, wrapper);
    assert.equal(wrapper.state, next);
    assert.equal(JSON.stringify(initial), before);
    assert.ok(Object.isFrozen(initial));
  });
}

for (const code of ['NO_RECRUIT_SPACE', 'INSUFFICIENT_GOLD', 'INTEGER_OVERFLOW', 'OFFER_EMPTY'] as const) {
  test(`recruit rejection ${code} preserves selected offer and old state`, () => {
    const h = harness();
    h.session.selectOffer(0);
    h.dispatch({ ok: false, state: state({ gold: 999 }), error: { code } });
    assert.deepEqual(h.session.recruitSelected(), { ok: false, code });
    assert.equal(h.session.match.state, h.initial);
    assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
    assert.equal(h.calls.dispatch.length, 1);
  });
}

test('preview is passed through the observation without allocating IDs or reimplementing planning', () => {
  const h = harness();
  const observed = observation(h.initial);
  h.observe(observed);
  assert.equal(h.session.observe(), observed);
  assert.equal(h.session.observe().offers[0]?.recruitPreview, observed.offers[0]?.recruitPreview);
  assert.equal(h.session.match.state.nextEntityId, 100);
  assert.equal(h.calls.dispatch.length, 0);
});

test('selection never retains an identity absent from adopted observation', () => {
  const h = harness(state({ phase: 'combat', units: [unit(7)] }));
  h.session.selectLocation(bench(0));
  h.advance({ ok: true, state: state({ phase: 'combat', units: [], tick: 1 }), events: [], executedTicks: 1 });
  h.session.advance(h.session.match, 1);
  assert.equal(h.session.selection, null);
  assert.equal(h.calls.dispatch.length, 0);
});

test('returned archive collection cannot append/remove internal archives', () => {
  const h = harness(state({ phase: 'result' }));
  h.create({ ok: true, state: state() });
  h.session.restart();
  const exposed = h.session.archives;
  assert.equal(exposed.length, 1);
  // The copied array is harmless even if a JS consumer ignores readonly types.
  assert.ok(Array.isArray(exposed));
  exposed.pop();
  assert.equal(h.session.archives.length, 1);
});
