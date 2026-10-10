import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch, dispatch, previewRecruit, observe, getRules, advance, stateHash,
  EXPERIMENT_RULES_ID, RULES_PROPOSALS,
} from '../../src/core-v2/index.ts';
import type {
  Command, CoreErrorCode, DispatchResult, Location, MatchState, PlanRef,
  PlannedUnit, RecruitPreview, RulesId, Unit,
} from '../../src/core-v2/index.ts';

const MAX = Number.MAX_SAFE_INTEGER;
const rulesIds = Object.keys(RULES_PROPOSALS) as RulesId[];
type Success = Extract<DispatchResult, { ok: true }>;
type Preview = Extract<RecruitPreview, { ok: true }>;
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };
const old = (unitId: number): PlanRef => ({ kind: 'existing', unitId });
const made = (creationIndex: number): PlanRef => ({ kind: 'created', creationIndex });
const bench = (slot: number): Location => ({ kind: 'bench', slot });
const board = (col: number, row: number): Location => ({ kind: 'board', col, row });
const unit = (id: number, location: Location, patch: Partial<Unit> = {}): Unit => ({
  id, definitionId: 'fixture-01', star: 1, location, cooldown: 0, ...patch,
});

function initial(seed = 1, rulesId: RulesId = EXPERIMENT_RULES_ID): MatchState {
  const result = createMatch(seed, rulesId);
  assert.ok(result.ok, JSON.stringify(result));
  return result.state;
}

/**
 * Explicit synthetic, stabilized state fixtures for boundary/placement tests.
 * These are engine-owned diagnostic states, not an external state-import API,
 * saved games, or evidence that the state was reached by gameplay. Real public
 * command sequences are exercised separately below.
 */
function fixture(patch: Partial<MatchState> = {}): MatchState {
  const state = { ...initial(), ...patch };
  if (patch.nextEntityId === undefined) {
    state.nextEntityId = Math.max(0, ...state.units.map(u => u.id), ...state.enemies.map(e => e.id)) + 1;
  }
  const identities = [...state.units, ...state.enemies].map(u => u.id);
  assert.equal(new Set(identities).size, identities.length, 'fixture identities must be unique');
  for (const id of identities) assert.ok(id > 0 && id < state.nextEntityId && Number.isSafeInteger(id));
  const occupied = state.units.map(u => JSON.stringify(u.location));
  assert.equal(new Set(occupied).size, occupied.length, 'fixture locations must be distinct');
  for (const u of state.units) {
    if (u.location.kind === 'board') {
      assert.ok(u.location.col >= 0 && u.location.col < 4);
      assert.ok(u.location.row >= 0 && u.location.row < 4);
    } else assert.ok(u.location.slot >= 0 && u.location.slot < 8);
    if (u.star < 3) assert.ok(state.units.filter(v => v.definitionId === u.definitionId && v.star === u.star).length < 3,
      'synthetic inventory must already be stabilized');
  }
  return state;
}

function accepted(state: MatchState, command: Command): Success {
  const before = structuredClone(state);
  const result = dispatch(state, command);
  assert.ok(result.ok, JSON.stringify(result));
  assert.deepEqual(state, before, 'accepted dispatch must not mutate its input');
  assert.notStrictEqual(result.state, state);
  assert.equal(result.events.length, 1, 'exactly one aggregate event per accepted command');
  assert.equal(result.state.acceptedLog.length, state.acceptedLog.length + 1);
  assert.deepEqual(result.state.acceptedLog.slice(0, -1), state.acceptedLog);
  const entry = result.state.acceptedLog.at(-1);
  assert.ok(entry?.type === 'command');
  assert.deepEqual(entry, { type: 'command', seq: state.acceptedLog.length + 1,
    atTick: state.tick, command, events: result.events });
  return result;
}

function rejected(state: MatchState, command: unknown, code: CoreErrorCode): void {
  const before = structuredClone(state);
  const hash = stateHash(state);
  const result = dispatch(state, command);
  assert.equal(result.ok, false);
  assert.deepEqual(result, { ok: false, state, error: { code } });
  assert.strictEqual(result.state, state, 'rejection returns the identical state reference');
  assert.strictEqual(result.state.acceptedLog, state.acceptedLog);
  assert.strictEqual(result.state.offers, state.offers);
  assert.strictEqual(result.state.units, state.units);
  assert.deepEqual(state, before, 'rejection rolls back coins, slots, units, IDs, RNG and log');
  assert.equal(stateHash(state), hash);
  assert.equal(Object.hasOwn(result, 'events'), false);
}

function rejectRecruit(state: MatchState, offerSlot: unknown, code: CoreErrorCode): void {
  const before = structuredClone(state);
  assert.deepEqual(previewRecruit(state, offerSlot), { ok: false, error: { code } });
  assert.deepEqual(state, before);
  rejected(state, { type: 'recruit', offerSlot }, code);
}

function refKey(ref: PlanRef): string {
  return ref.kind === 'existing' ? `old:${ref.unitId}` : `created:${ref.creationIndex}`;
}
function compareRefs(a: PlanRef, b: PlanRef): number {
  return a.kind === 'existing' ? b.kind === 'existing' ? a.unitId - b.unitId : -1
    : b.kind === 'existing' ? 1 : a.creationIndex - b.creationIndex;
}
function committed(ref: PlanRef, state: MatchState): number {
  return ref.kind === 'existing' ? ref.unitId : state.nextEntityId + ref.creationIndex;
}
function committedUnit(planned: PlannedUnit, state: MatchState): Unit {
  const { ref, ...rest } = planned;
  return { id: committed(ref, state), ...rest };
}

/** Independent trace checks: no planner internals or predicted offers are used. */
function inspectPreview(state: MatchState, preview: Preview): void {
  const publicIds = new Set(state.units.map(u => u.id));
  const live = new Set(state.units.map(u => refKey(old(u.id))));
  live.add(refKey(made(0)));
  assert.deepEqual(preview.arrival, { ref: made(0), definitionId: state.offers[preview.offerSlot].definitionId,
    star: 1, cooldown: 0, location: null });
  assert.ok(preview.upgrades.length <= 2);
  for (const [index, step] of preview.upgrades.entries()) {
    assert.equal(step.consumed.length, 3);
    assert.equal(new Set(step.consumed.map(refKey)).size, 3);
    assert.deepEqual([...step.consumed].sort(compareRefs), step.consumed);
    for (const ref of step.consumed) {
      assert.ok(live.delete(refKey(ref)), 'a consumed reference must be currently live');
    }
    assert.deepEqual(step.result.ref, made(index + 1));
    assert.ok(!live.has(refKey(step.result.ref)));
    assert.equal(step.result.star, index + 2);
    live.add(refKey(step.result.ref));
  }
  assert.deepEqual([...preview.finalUnits].sort((a, b) => compareRefs(a.ref, b.ref)), preview.finalUnits);
  assert.equal(preview.finalUnits.length, live.size);
  assert.deepEqual(new Set(preview.finalUnits.map(u => refKey(u.ref))), live);
  assert.deepEqual(preview.finalUnits.find(u => refKey(u.ref) === refKey(preview.result.ref)), preview.result);
  assert.ok(preview.finalUnits.every(u => u.location !== null));
  assert.equal(preview.boardCountAfter, preview.finalUnits.filter(u => u.location.kind === 'board').length);
  assert.equal(preview.benchCountAfter, preview.finalUnits.filter(u => u.location.kind === 'bench').length);
  const inspect = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    for (const secret of ['seed', 'rngState', 'nextEntityId', 'acceptedLog', 'id']) {
      assert.equal(Object.hasOwn(object, secret), false, `preview must not expose ${secret}`);
    }
    if (object.kind === 'created') assert.deepEqual(Object.keys(object).sort(), ['creationIndex', 'kind']);
    if (object.kind === 'existing') {
      assert.deepEqual(Object.keys(object).sort(), ['kind', 'unitId']);
      assert.ok(publicIds.has(object.unitId as number));
    }
    Object.values(object).forEach(inspect);
  };
  inspect(preview);
}

function purchaseParity(state: MatchState, offerSlot = 0): { preview: Preview; result: Success } {
  const before = structuredClone(state);
  const preview = previewRecruit(state, offerSlot);
  assert.ok(preview.ok, JSON.stringify(preview));
  inspectPreview(state, preview);
  assert.deepEqual(state, before);
  assert.deepEqual(observe(state).offers[offerSlot].recruitPreview, preview);
  const result = accepted(state, { type: 'recruit', offerSlot });
  const expectedUnits = preview.finalUnits.map(u => committedUnit(u, state)).sort((a, b) => a.id - b.id);
  assert.deepEqual([...result.state.units].sort((a, b) => a.id - b.id), expectedUnits);
  assert.equal(result.state.gold, preview.goldAfter);
  assert.equal(result.state.gold, state.gold - preview.price);
  assert.equal(result.state.nextEntityId, state.nextEntityId + 1 + preview.upgrades.length);
  assert.equal(result.state.rngState, state.rngState, 'purchases draw zero random numbers');
  assert.deepEqual(result.state.offers, state.offers.map(o => o.slot === offerSlot ? { ...o, definitionId: null } : o));
  assert.deepEqual(result.events, [{ type: 'recruited', tick: state.tick, wave: state.wave, waveTick: state.waveTick,
    offerSlot, goldDelta: -preview.price,
    arrival: { id: state.nextEntityId, definitionId: preview.arrival.definitionId, star: 1, cooldown: 0, location: null },
    upgrades: preview.upgrades.map(step => ({ consumedIds: step.consumed.map(ref => committed(ref, state)),
      result: committedUnit(step.result, state) })), result: committedUnit(preview.result, state) }]);
  const observation = observe(result.state);
  assert.deepEqual([observation.boardCount, observation.benchCount], [preview.boardCountAfter, preview.benchCountAfter]);
  assert.deepEqual(observation.offers[offerSlot], { slot: offerSlot, definitionId: null, rarityId: null,
    price: null, recruitPreview: { ok: false, error: { code: 'OFFER_EMPTY' } } });
  return { preview, result };
}

function fullBench(): Unit[] {
  return Array.from({ length: 8 }, (_, slot) => unit(20 + slot, bench(slot), {
    definitionId: `fixture-${String(2 + slot % 7).padStart(2, '0')}`, cooldown: slot,
  }));
}

function chainState(patch: Partial<MatchState> = {}): MatchState {
  return fixture({ units: [unit(11, board(0, 0), { cooldown: 6 }), unit(3, board(0, 1), { star: 2, cooldown: 8 }),
    unit(7, board(3, 3), { cooldown: 2 }), unit(9, bench(2), { star: 2, cooldown: 4 }),
    ...fullBench().filter(u => u.location.kind === 'bench' && u.location.slot !== 2)],
  nextEntityId: 40, ...patch });
}

for (const rulesId of rulesIds) {
  test(`${rulesId}: first shop uses six weighted draws and leaves the allocator untouched`, () => {
    const state = initial(1, rulesId);
    assert.deepEqual(state.offers, [{ slot: 0, definitionId: 'fixture-01' },
      { slot: 1, definitionId: 'fixture-01' }, { slot: 2, definitionId: 'fixture-04' }]);
    assert.equal(state.rngState, 745495504);
    assert.equal(state.nextEntityId, 1);
    assert.equal(state.gold, 12);
    assert.deepEqual(state.acceptedLog, []);
    assert.deepEqual(state.units, []);
    assert.equal(state.schemaVersion, 3);
  });

  test(`${rulesId}: rejection sampling and singleton draw advance the exact RNG stream`, () => {
    // xorshift32(1584200935) = 4294967295, rejected for a size-1000 draw.
    // 253983 selects legendary, then singleton selection still consumes 4228382207.
    const state = initial(1584200935, rulesId);
    assert.deepEqual(state.offers.map(o => o.definitionId), ['fixture-06', 'fixture-04', 'fixture-08']);
    assert.equal(state.rngState, 2560970988, 'seven raw draws including the rejected draw');
  });
}

test('createMatch validates rules type, registry membership, then the seed; failure has no state', () => {
  for (const [seed, rulesId, code] of [
    [0, null, 'BAD_FORMAT'], [0, 'unregistered-fixture', 'UNKNOWN_RULES'],
    [0, EXPERIMENT_RULES_ID, 'BAD_SEED'], [4294967296, EXPERIMENT_RULES_ID, 'BAD_SEED'],
    [1.5, EXPERIMENT_RULES_ID, 'BAD_SEED'], ['1', EXPERIMENT_RULES_ID, 'BAD_SEED'],
  ] as const) assert.deepEqual(createMatch(seed, rulesId), { ok: false, error: { code } });
  for (const id of [null, 1, {}, 'unregistered-fixture']) assert.equal(getRules(id), null);
  assert.ok(createMatch(4294967295, EXPERIMENT_RULES_ID).ok);
});

test('recruit accepts only offerSlot, charges its rarity price and takes the lowest empty bench', () => {
  const state = fixture({ units: [unit(4, bench(0), { definitionId: 'fixture-08' }),
    unit(6, bench(2), { definitionId: 'fixture-07' })] });
  const { preview, result } = purchaseParity(state);
  assert.equal(preview.upgrades.length, 0);
  assert.deepEqual(preview.result.location, bench(1));
  assert.deepEqual(preview.result.ref, made(0));
  assert.equal(result.state.units.find(u => u.id === state.nextEntityId)?.cooldown, 0);
  rejected(state, { type: 'recruit', offerSlot: 0, benchSlot: 7 }, 'BAD_FORMAT');
  rejected(state, { type: 'recruit', offerSlot: 0, keepId: 4 }, 'BAD_FORMAT');
  rejected(state, { type: 'recruit', offerSlot: 0, to: board(0, 0) }, 'BAD_FORMAT');
});

for (const definition of RULES_PROPOSALS[EXPERIMENT_RULES_ID].characters) {
  test(`${definition.id}: recruitment charges the public rarity price`, () => {
    const state = fixture({ offers: [{ slot: 0, definitionId: definition.id },
      { slot: 1, definitionId: null }, { slot: 2, definitionId: null }] });
    const rarity = getRules(state.rulesId)!.rarities.find(r => r.id === definition.rarityId)!;
    const { preview } = purchaseParity(state);
    assert.equal(preview.price, rarity.recruitPrice);
    assert.equal(observe(state).offers[0].rarityId, rarity.id);
    assert.equal(observe(state).offers[0].price, rarity.recruitPrice);
  });
}

test('full bench without a matching pair rejects even with an entirely empty board', () => {
  const state = fixture({ units: fullBench() });
  rejectRecruit(state, 0, 'NO_RECRUIT_SPACE');
  assert.equal(observe(state).boardCount, 0);
  assert.equal(observe(state).benchCount, 8);
});

test('full bench plus a matching board pair upgrades at the oldest board material', () => {
  const fillers = fullBench();
  const state = fixture({ units: [...fillers, unit(11, board(0, 0), { cooldown: 6 }),
    unit(7, board(3, 3), { cooldown: 2 })] });
  const { preview, result } = purchaseParity(state);
  assert.deepEqual(preview.upgrades[0].consumed, [old(7), old(11), made(0)]);
  assert.deepEqual(preview.result.location, board(3, 3));
  assert.equal(preview.result.cooldown, 6);
  assert.deepEqual([preview.boardCountAfter, preview.benchCountAfter], [1, 8]);
  assert.deepEqual(result.state.units.filter(u => u.id < state.nextEntityId), fillers);
});

test('all-bench upgrade preserves the lowest material slot, ignoring a lower unrelated empty slot', () => {
  const state = fixture({ units: [unit(2, bench(6), { cooldown: 9 }),
    unit(8, bench(4), { cooldown: 3 }), unit(5, board(0, 0), { definitionId: 'fixture-02' })] });
  const { preview } = purchaseParity(state);
  assert.equal(preview.arrival.location, null);
  assert.deepEqual(preview.upgrades[0].consumed, [old(2), old(8), made(0)]);
  assert.deepEqual(preview.result.location, bench(4));
  assert.equal(preview.result.cooldown, 9);
  assert.ok(!preview.finalUnits.some(u => u.location.kind === 'bench' && u.location.slot === 0));
});

test('an older bench identity cannot displace the board material as upgrade location', () => {
  const state = fixture({ units: [unit(1, bench(0), { cooldown: 10 }), unit(8, board(2, 3), { cooldown: 4 })] });
  const { preview } = purchaseParity(state);
  assert.deepEqual(preview.upgrades[0].consumed, [old(1), old(8), made(0)]);
  assert.deepEqual(preview.result.location, board(2, 3));
  assert.equal(preview.result.cooldown, 10);
});

test('two-step full-bench chain reevaluates placement and max cooldown at every upgrade', () => {
  const state = chainState();
  const { preview, result } = purchaseParity(state);
  assert.deepEqual(preview.upgrades.map(step => step.consumed), [[old(7), old(11), made(0)], [old(3), old(9), made(1)]]);
  assert.deepEqual(preview.upgrades.map(step => step.result.location), [board(3, 3), board(0, 1)]);
  assert.deepEqual(preview.upgrades.map(step => step.result.cooldown), [6, 8]);
  assert.equal(preview.result.star, 3);
  assert.deepEqual([preview.boardCountAfter, preview.benchCountAfter], [1, 7]);
  assert.equal(result.state.nextEntityId, 43, 'arrival and both intermediate outputs consume IDs');
  assert.deepEqual(result.state.units.map(u => u.id), [...fullBench().filter(u => u.id !== 22).map(u => u.id), 42]);
  const event = result.events[0];
  assert.ok(event.type === 'recruited');
  assert.equal(event.arrival.id, 40);
  assert.deepEqual(event.upgrades.map(step => step.result.id), [41, 42]);
  assert.deepEqual(event.upgrades.map(step => step.consumedIds), [[7, 11, 40], [3, 9, 41]]);
  assert.equal(result.state.units.some(u => [3, 7, 9, 11, 40, 41].includes(u.id)), false);
});

test('second all-bench step uses its own lowest material slot and preserves an earlier max cooldown', () => {
  const state = fixture({ units: [unit(1, bench(6), { star: 2, cooldown: 2 }),
    unit(2, bench(4), { star: 2, cooldown: 5 }), unit(3, bench(7), { cooldown: 11 }),
    unit(4, bench(5), { cooldown: 3 })] });
  const { preview } = purchaseParity(state);
  assert.deepEqual(preview.upgrades.map(step => step.result.location), [bench(5), bench(4)]);
  assert.deepEqual(preview.upgrades.map(step => step.result.cooldown), [11, 11]);
  assert.deepEqual(preview.finalUnits, [preview.result]);
});

test('matching uses definition and star; same rarity or behavior never combines different definitions', () => {
  const state = fixture({ units: [unit(1, bench(0), { definitionId: 'fixture-01', star: 2 }),
    unit(2, bench(1), { definitionId: 'fixture-04' }), unit(3, bench(2), { definitionId: 'fixture-07' }),
    unit(4, bench(3), { definitionId: 'fixture-01', star: 3 })] });
  const { preview } = purchaseParity(state);
  assert.deepEqual(preview.upgrades, []);
  assert.equal(preview.finalUnits.length, 5);
  assert.deepEqual(preview.result.location, bench(4));
});

test('two existing star3 units survive a chain which creates a third star3 unit', () => {
  const state = chainState({ units: [...chainState().units, unit(12, board(1, 2), { star: 3 }),
    unit(13, board(2, 2), { star: 3 })] });
  const { preview, result } = purchaseParity(state);
  assert.equal(preview.upgrades.length, 2);
  assert.equal(result.state.units.filter(u => u.definitionId === 'fixture-01' && u.star === 3).length, 3);
  assert.deepEqual(result.state.units.find(u => u.id === 12), state.units.find(u => u.id === 12));
  assert.deepEqual(result.state.units.find(u => u.id === 13), state.units.find(u => u.id === 13));
});

test('all 16 physical board cells may be occupied; recruitment still uses bench space', () => {
  const boardUnits = Array.from({ length: 15 }, (_, i) => unit(i + 1, board(i % 4, Math.floor(i / 4)), { star: 3 }));
  const state = fixture({ units: [...boardUnits, unit(16, bench(0), { star: 3, cooldown: 7 })] });
  const moved = accepted(state, { type: 'move', unitId: 16, to: board(3, 3) });
  assert.equal(observe(moved.state).boardCount, 16);
  assert.equal(moved.state.units.find(u => u.id === 16)?.cooldown, 7);
  const { preview } = purchaseParity(moved.state);
  assert.deepEqual([preview.boardCountAfter, preview.benchCountAfter], [16, 1]);
  assert.deepEqual(preview.result.location, bench(0));
});

test('repeated preview and observation are symbolic, deterministic, mutation-free, log-free and RNG-free', () => {
  const state = chainState();
  const before = structuredClone(state);
  const hash = stateHash(state);
  const expected = previewRecruit(state, 0);
  assert.ok(expected.ok);
  for (let i = 0; i < 20; i += 1) {
    const preview = previewRecruit(state, 0);
    assert.deepEqual(preview, expected);
    assert.deepEqual(observe(state).offers[0].recruitPreview, expected);
  }
  assert.deepEqual(state, before);
  assert.equal(stateHash(state), hash);
  assert.deepEqual(state.acceptedLog, []);
  // Changing hidden allocator values alone does not change symbolic success data.
  assert.deepEqual(previewRecruit(fixture({ ...state, nextEntityId: 1000 }), 0), expected);
  assert.deepEqual(previewRecruit(fixture({ ...state, rngState: 1584200935 }), 0), expected);
});

test('preview results are detached and cannot mutate authoritative units or later previews', () => {
  const state = chainState();
  const before = structuredClone(state);
  const preview = previewRecruit(state, 0);
  assert.ok(preview.ok);
  const expected = structuredClone(preview);
  const untouched = preview.finalUnits.find(u => u.ref.kind === 'existing')!;
  assert.notStrictEqual(untouched.location, state.units.find(u => u.id === (untouched.ref as { unitId: number }).unitId)!.location);
  const mutable = preview as Mutable<typeof preview>;
  for (const mutate of [() => { mutable.result.cooldown = 999; },
    () => { mutable.finalUnits[0].location = board(2, 2); },
    () => { mutable.upgrades[0].result.location = bench(0); }]) {
    try { mutate(); } catch (error) { assert.ok(error instanceof TypeError); }
  }
  assert.deepEqual(state, before);
  assert.deepEqual(previewRecruit(state, 0), expected);
});

test('dispatch recomputes after intervening movement or purchase and never accepts stale preview data', () => {
  const state = fixture({ units: [unit(1, board(3, 3)), unit(2, board(0, 0))] });
  const preview = previewRecruit(state, 0);
  assert.ok(preview.ok);
  assert.deepEqual(preview.result.location, board(3, 3));
  const moved = accepted(state, { type: 'move', unitId: 1, to: bench(5) });
  const bought = purchaseParity(moved.state);
  assert.deepEqual(bought.preview.result.location, board(0, 0));
  rejectRecruit(bought.result.state, 0, 'OFFER_EMPTY');
  rejected(moved.state, { type: 'recruit', offerSlot: 0, preview }, 'BAD_FORMAT');
});

test('recruit validation follows format, phase, slot, empty, gold, space, then overflow', () => {
  const blocked = fixture({ phase: 'combat', gold: 0, units: fullBench(), nextEntityId: MAX,
    offers: [{ slot: 0, definitionId: null }, { slot: 1, definitionId: 'fixture-01' }, { slot: 2, definitionId: 'fixture-01' }] });
  for (const slot of [undefined, null, '0', 0.5, NaN, Infinity, MAX + 1]) rejectRecruit(blocked, slot, 'BAD_FORMAT');
  rejectRecruit(blocked, -1, 'BAD_PHASE');
  rejectRecruit({ ...blocked, phase: 'result' }, 99, 'BAD_PHASE');
  const preparation = { ...blocked, phase: 'preparation' as const };
  rejectRecruit(preparation, -1, 'BAD_SLOT');
  rejectRecruit(preparation, 3, 'BAD_SLOT');
  rejectRecruit(preparation, 0, 'OFFER_EMPTY');
  rejectRecruit(preparation, 1, 'INSUFFICIENT_GOLD');
  rejectRecruit({ ...preparation, gold: 12 }, 1, 'NO_RECRUIT_SPACE');
  rejectRecruit({ ...preparation, gold: 12, units: [] }, 1, 'INTEGER_OVERFLOW');
});

test('identity overflow at arrival, intermediate output or final increment rejects the whole purchase', () => {
  rejectRecruit(fixture({ nextEntityId: MAX }), 0, 'INTEGER_OVERFLOW');
  const lone = purchaseParity(fixture({ nextEntityId: MAX - 1 })).result;
  assert.equal(lone.state.nextEntityId, MAX);
  assert.equal(lone.state.units[0].id, MAX - 1);
  rejectRecruit(fixture({ units: [unit(1, bench(0)), unit(2, bench(1))], nextEntityId: MAX - 1 }), 0, 'INTEGER_OVERFLOW');
  rejectRecruit(chainState({ nextEntityId: MAX - 2 }), 0, 'INTEGER_OVERFLOW');
  const { result } = purchaseParity(chainState({ nextEntityId: MAX - 3 }));
  assert.equal(result.state.nextEntityId, MAX, 'last safe post-purchase allocator value remains legal');
  assert.equal(result.state.units.at(-1)?.id, MAX - 1);
});

test('reroll replaces all slots in order, costs one coin, and uses the next six draws', () => {
  const bought = purchaseParity(initial()).result.state;
  const result = accepted(bought, { type: 'reroll' });
  assert.deepEqual(result.state.offers.map(o => o.definitionId), ['fixture-04', 'fixture-04', 'fixture-01']);
  assert.equal(result.state.rngState, 1495045943);
  assert.equal(result.state.gold, bought.gold - 1);
  assert.equal(result.state.nextEntityId, bought.nextEntityId);
  assert.deepEqual(result.state.units, bought.units);
  assert.deepEqual(result.events, [{ type: 'rerolled', tick: 0, wave: 1, waveTick: 0,
    offers: result.state.offers, goldDelta: -1 }]);
  const rejectedDraw = accepted(fixture({ rngState: 1584200935 }), { type: 'reroll' });
  assert.deepEqual(rejectedDraw.state.offers.map(o => o.definitionId), ['fixture-06', 'fixture-04', 'fixture-08']);
  assert.equal(rejectedDraw.state.rngState, 2560970988);
  rejected(fixture({ phase: 'combat', gold: 0 }), { type: 'reroll' }, 'BAD_PHASE');
  rejected(fixture({ gold: 0, rngState: 1584200935 }), { type: 'reroll' }, 'INSUFFICIENT_GOLD');
});

test('all commands validate exact JSON-data shapes before semantic phase checks', () => {
  const state = fixture({ phase: 'combat' });
  const cycle: Record<string, unknown> = { type: 'unknown' };
  cycle.self = cycle;
  let getterCalls = 0;
  const accessor = Object.defineProperty({ type: 'recruit' }, 'offerSlot', {
    enumerable: true, get() { getterCalls += 1; return 0; },
  });
  const hidden = Object.defineProperty({ type: 'reroll' }, 'hidden', { value: 1 });
  const malformed: unknown[] = [null, [], 'recruit', {}, { type: 1 }, { type: 'recruit' },
    { type: 'recruit', offerSlot: undefined }, { type: 'reroll', extra: true },
    { type: 'sell', unitId: 0 }, { type: 'sell', unitId: -1 }, { type: 'sell', unitId: MAX + 1 },
    { type: 'swap', aId: 1, bId: 2.5 }, { type: 'startWave', wave: 1 },
    { type: 'move', unitId: 1, to: { kind: 'bench', slot: 0, col: 0 } },
    { type: 'move', unitId: 1, to: { kind: 'board', col: 0 } },
    { type: 'move', unitId: 1, to: { kind: 'board', col: NaN, row: 0 } },
    { type: 'unknown', value: undefined }, { type: 'unknown', value: () => 1 },
    { type: 'unknown', value: BigInt(1) }, { type: 'unknown', value: new Date(0) },
    { type: 'unknown', value: [1, , 3] }, { type: 'unknown', value: Infinity },
    Object.assign(Object.create({ inherited: true }), { type: 'reroll' }),
    { type: 'reroll', [Symbol('extra')]: 1 }, accessor, hidden, cycle,
    new Proxy({}, { ownKeys() { throw new Error('hostile trap'); } }),
  ];
  for (const command of malformed) rejected(state, command, 'BAD_FORMAT');
  assert.equal(getterCalls, 0, 'command validation must never execute accessor code');
  rejected(state, { type: 'unknown', payload: { safe: [1, null, true] } }, 'UNSUPPORTED_COMMAND');
});

test('plain null-prototype commands and locations are valid JSON-data objects', () => {
  const state = fixture({ units: [unit(1, bench(0))] });
  const to = Object.assign(Object.create(null), { kind: 'board', col: 3, row: 2 });
  const command = Object.assign(Object.create(null), { type: 'move', unitId: 1, to });
  const result = dispatch(state, command);
  assert.ok(result.ok);
  assert.deepEqual({ ...result.state.units[0].location }, board(3, 2));
});

test('move, swap, sell and startWave semantic errors preserve the complete state', () => {
  const state = fixture({ units: [unit(1, board(0, 0)), unit(2, bench(0))] });
  const cases: readonly [Command, CoreErrorCode][] = [
    [{ type: 'move', unitId: 999, to: bench(-1) }, 'UNIT_NOT_FOUND'],
    [{ type: 'move', unitId: 1, to: bench(-1) }, 'BAD_LOCATION'],
    [{ type: 'move', unitId: 1, to: bench(8) }, 'BAD_LOCATION'],
    [{ type: 'move', unitId: 1, to: board(4, 0) }, 'BAD_LOCATION'],
    [{ type: 'move', unitId: 1, to: board(0, -1) }, 'BAD_LOCATION'],
    [{ type: 'move', unitId: 1, to: board(0, 0) }, 'SAME_LOCATION'],
    [{ type: 'move', unitId: 1, to: bench(0) }, 'LOCATION_OCCUPIED'],
    [{ type: 'swap', aId: 999, bId: 999 }, 'DUPLICATE_ID'],
    [{ type: 'swap', aId: 999, bId: 2 }, 'UNIT_NOT_FOUND'],
    [{ type: 'swap', aId: 1, bId: 999 }, 'UNIT_NOT_FOUND'],
    [{ type: 'sell', unitId: 999 }, 'UNIT_NOT_FOUND'],
  ];
  for (const [command, code] of cases) {
    rejected(state, command, code);
    rejected({ ...state, phase: 'combat' }, command, 'BAD_PHASE');
  }
  rejected(fixture({ units: [unit(1, bench(0))] }), { type: 'startWave' }, 'NO_BOARD_UNITS');
  rejected(fixture({ phase: 'result' }), { type: 'startWave' }, 'BAD_PHASE');
  const overflow = fixture({ gold: MAX, units: [unit(1, bench(0))] });
  rejected(overflow, { type: 'sell', unitId: 999 }, 'UNIT_NOT_FOUND');
  rejected(overflow, { type: 'sell', unitId: 1 }, 'INTEGER_OVERFLOW');
});

test('free moves and swaps preserve cooldown, coins, allocator, RNG and both occupied positions', () => {
  const state = fixture({ units: [unit(1, board(0, 0), { cooldown: 17 }),
    unit(2, bench(0), { cooldown: 9 })] });
  const moved = accepted(state, { type: 'move', unitId: 1, to: board(3, 3) });
  assert.deepEqual(moved.events, [{ type: 'moved', tick: 0, wave: 1, waveTick: 0,
    unitId: 1, from: board(0, 0), to: board(3, 3) }]);
  const swapped = accepted(moved.state, { type: 'swap', aId: 2, bId: 1 });
  assert.deepEqual(swapped.events, [{ type: 'swapped', tick: 0, wave: 1, waveTick: 0,
    aId: 2, bId: 1, aFrom: bench(0), bFrom: board(3, 3) }]);
  assert.deepEqual(swapped.state.units, [{ ...state.units[0], location: bench(0) },
    { ...state.units[1], location: board(3, 3) }]);
  for (const current of [moved.state, swapped.state]) {
    assert.equal(current.gold, state.gold);
    assert.equal(current.rngState, state.rngState);
    assert.equal(current.nextEntityId, state.nextEntityId);
  }
});

test('swap can exchange a full 16-cell board and full eight-slot bench without temporary space', () => {
  const state = fixture({ units: [
    ...Array.from({ length: 16 }, (_, i) => unit(i + 1, board(i % 4, Math.floor(i / 4)), { star: 3, cooldown: i })),
    ...Array.from({ length: 8 }, (_, i) => unit(i + 17, bench(i), { star: 3, cooldown: i + 20 })),
  ] });
  const result = accepted(state, { type: 'swap', aId: 1, bId: 17 });
  assert.deepEqual(result.state.units.find(u => u.id === 1), { ...state.units[0], location: bench(0) });
  assert.deepEqual(result.state.units.find(u => u.id === 17), { ...state.units[16], location: board(0, 0) });
  assert.deepEqual([observe(result.state).boardCount, observe(result.state).benchCount], [16, 8]);
});

for (const rarity of RULES_PROPOSALS[EXPERIMENT_RULES_ID].rarities) {
  for (const star of [1, 2, 3] as const) {
    test(`${rarity.id} star${star}: sale only removes its unit and pays the documented coins`, () => {
      const definitionId = RULES_PROPOSALS[EXPERIMENT_RULES_ID].characters.find(c => c.rarityId === rarity.id)!.id;
      const survivor = unit(2, bench(1), { definitionId: 'fixture-08', cooldown: 13 });
      const state = fixture({ units: [unit(1, bench(0), { definitionId, star, cooldown: 7 }), survivor] });
      const result = accepted(state, { type: 'sell', unitId: 1 });
      assert.deepEqual(result.state.units, [survivor]);
      assert.equal(result.state.gold, state.gold + rarity.sellGoldByStar[star - 1]);
      assert.equal(result.state.nextEntityId, state.nextEntityId);
      assert.equal(result.state.rngState, state.rngState);
      assert.deepEqual(result.state.offers, state.offers);
      assert.deepEqual(result.events, [{ type: 'sold', tick: 0, wave: 1, waveTick: 0,
        unitId: 1, goldDelta: rarity.sellGoldByStar[star - 1] }]);
      assert.deepEqual(Object.keys(result.state).sort(), Object.keys(state).sort());
    });
  }
}

test('startWave emits only its reset clock stamp and never resets existing unit cooldown', () => {
  const state = fixture({ tick: 400, wave: 2, waveTick: 400, spawnCursor: 7,
    units: [unit(8, board(1, 0), { cooldown: 5 }), unit(3, bench(0), { definitionId: 'fixture-02', cooldown: 9 }),
      unit(2, board(0, 0), { cooldown: 17 })] });
  const result = accepted(state, { type: 'startWave' });
  assert.deepEqual(result.events, [{ type: 'waveStarted', tick: 400, wave: 2, waveTick: 0 }]);
  assert.equal(result.state.phase, 'combat');
  assert.equal(result.state.tick, 400);
  assert.equal(result.state.waveTick, 0);
  assert.equal(result.state.spawnCursor, 0);
  assert.deepEqual(result.state.units, state.units);
  assert.equal(result.state.gold, state.gold);
  assert.equal(result.state.nextEntityId, state.nextEntityId);
  assert.equal(result.state.rngState, state.rngState);
});

test('only board cooldown ticks during combat; bench remainder is frozen', () => {
  const state = fixture({ units: [unit(1, board(0, 0), { cooldown: 20 }), unit(2, bench(0), { cooldown: 20 })] });
  const started = accepted(state, { type: 'startWave' }).state;
  const result = advance(started, 3);
  assert.ok(result.ok);
  assert.equal(result.executedTicks, 3);
  assert.equal(result.state.units.find(u => u.id === 1)?.cooldown, 17);
  assert.equal(result.state.units.find(u => u.id === 2)?.cooldown, 20);
});

test('command/event/log values are detached from caller objects and persistent purchased units', () => {
  const state = chainState();
  const command: { type: 'recruit'; offerSlot: number } = { type: 'recruit', offerSlot: 0 };
  const result = accepted(state, command);
  const expected = structuredClone(result.state);
  command.offerSlot = 2;
  assert.deepEqual(result.state, expected);
  const event = result.events[0];
  assert.ok(event.type === 'recruited');
  const persistent = result.state.units.find(u => u.id === event.result.id)!;
  assert.notStrictEqual(event.result, persistent);
  assert.notStrictEqual(event.result.location, persistent.location);
  const log = result.state.acceptedLog.at(-1);
  assert.ok(log?.type === 'command');
  assert.notStrictEqual(log.command, command);
  assert.notStrictEqual(log.events, result.events);
  assert.notStrictEqual(log.events[0], event);
  const mutable = event as Mutable<typeof event>;
  try { mutable.result.cooldown = 999; } catch (error) { assert.ok(error instanceof TypeError); }
  try { mutable.upgrades[0].result.location = bench(7); } catch (error) { assert.ok(error instanceof TypeError); }
  assert.deepEqual(result.state, expected);
});

for (const rulesId of rulesIds) {
  test(`${rulesId}: real public commands recruit, move, reroll, auto-upgrade and start combat`, () => {
    // Entirely reachable public-command smoke, with no synthetic state changes.
    let state = initial(1, rulesId);
    state = purchaseParity(state, 0).result.state;
    state = accepted(state, { type: 'move', unitId: 1, to: board(3, 3) }).state;
    state = purchaseParity(state, 1).result.state;
    state = accepted(state, { type: 'reroll' }).state;
    const bought = purchaseParity(state, 2);
    state = bought.result.state;
    assert.equal(bought.preview.upgrades.length, 1);
    assert.deepEqual(state.units, [unit(4, board(3, 3), { star: 2 })]);
    assert.equal(state.nextEntityId, 5);
    assert.equal(state.gold, 5);
    assert.equal(state.rngState, 1495045943);
    state = accepted(state, { type: 'startWave' }).state;
    const advanced = advance(state, 1);
    assert.ok(advanced.ok);
    assert.equal(advanced.executedTicks, 1);
    const spawn = advanced.events.find(e => e.type === 'enemySpawned');
    assert.ok(spawn?.type === 'enemySpawned');
    assert.equal(spawn.enemy.id, 5, 'enemy allocator follows consumed arrival and upgrade identities');
    assert.equal(advanced.state.nextEntityId, 6);
    assert.equal(advanced.state.acceptedLog.length, 7);
  });
}
