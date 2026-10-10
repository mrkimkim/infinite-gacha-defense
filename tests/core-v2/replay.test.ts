import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { advance, createMatch, dispatch } from '../../src/core-v2/engine.ts';
import { canonicalState, replay, stateHash } from '../../src/core-v2/replay.ts';
import { canonicalJson, sha256 } from '../../src/core-v2/serialization.ts';
import { array, command, dataTree, entry, event, integer, shape } from '../../src/core-v2/validation.ts';
import { CANONICAL_STATE_KEYS, EXPERIMENT_RULES_ID, RULES_DIGESTS, RULES_PROPOSALS } from '../../src/core-v2/profiles.ts';
import type { Command, CommandEvent, MatchState, ReplayEntry, ReplayHeader, RulesId } from '../../src/core-v2/types.ts';

function initial(seed = 1, rulesId: RulesId = EXPERIMENT_RULES_ID): MatchState {
  const result = createMatch(seed, rulesId);
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}

function accept(state: MatchState, input: Command): MatchState {
  const result = dispatch(state, input);
  if (!result.ok) throw new Error(`${input.type}: ${result.error.code}`);
  return result.state;
}

function prepared(rulesId: RulesId = EXPERIMENT_RULES_ID): MatchState {
  let state = initial(1, rulesId);
  for (let slot = 0; slot < 3; slot += 1) {
    state = accept(state, { type: 'recruit', offerSlot: slot });
    state = accept(state, { type: 'move', unitId: slot + 1, to: { kind: 'board', col: slot, row: 0 } });
  }
  return state;
}

function fixture(rulesId: RulesId = EXPERIMENT_RULES_ID): MatchState {
  const result = advance(accept(prepared(rulesId), { type: 'startWave' }), Number.MAX_SAFE_INTEGER);
  if (!result.ok) throw new Error(result.error.code);
  assert.equal(result.state.phase, 'preparation');
  assert.equal(result.state.wave, 2);
  return result.state;
}

function header(state: MatchState): ReplayHeader {
  return { schemaVersion: 3, rulesId: state.rulesId, rulesDigest: state.rulesDigest, seed: state.seed };
}

function failure(h: unknown, entries: unknown, code: string, entryIndex: number | null = null, hash?: unknown): void {
  const result = replay(h, entries, hash);
  assert.deepEqual(result, { ok: false, error: { code, entryIndex } });
  assert.equal(Object.hasOwn(result, 'state'), false);
}

function commandEntry(input: unknown, events: readonly unknown[] = [], seq = 1, atTick = 0): unknown {
  return { type: 'command', seq, atTick, command: input, events };
}

function independentJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(independentJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${independentJson(object[key])}`).join(',')}}`;
}

const stamp = { tick: 0, wave: 1, waveTick: 0 };
const exampleUnit = { id: 1, definitionId: 'fixture-01', star: 1,
  location: { kind: 'bench', slot: 0 }, cooldown: 0 } as const;
const exampleArrival = { ...exampleUnit, location: null };
const recruited = { ...stamp, type: 'recruited', offerSlot: 0, goldDelta: -2,
  arrival: exampleArrival, upgrades: [], result: exampleUnit } as const;
const exampleUpgrade = { consumedIds: [1, 2, 3], result: { ...exampleUnit, id: 4, star: 2 } } as const;
const commandEvents: CommandEvent[] = [
  recruited,
  { ...stamp, type: 'rerolled', offers: [0, 1, 2].map(slot => ({ slot, definitionId: 'fixture-01' })), goldDelta: -1 },
  { ...stamp, type: 'moved', unitId: 1, from: exampleUnit.location, to: { kind: 'board', col: 0, row: 0 } },
  { ...stamp, type: 'swapped', aId: 1, bId: 2, aFrom: exampleUnit.location, bFrom: { kind: 'bench', slot: 7 } },
  { ...stamp, type: 'sold', unitId: 1, goldDelta: 1 },
  { ...stamp, type: 'waveStarted' },
];

/** Reach a two-step upgrade using only real weighted shops, coins and waves. */
function chained(rulesId: RulesId = EXPERIMENT_RULES_ID): MatchState {
  let state = initial(1082, rulesId);
  for (let wave = 1; wave <= 5; wave += 1) {
    for (let slot = 0; slot < 3; slot += 1) {
      if (state.offers[slot].definitionId !== 'fixture-01') continue;
      state = accept(state, { type: 'recruit', offerSlot: slot });
      for (const unit of state.units.filter(unit => unit.location.kind === 'bench')) {
        const taken = new Set(state.units.filter(item => item.location.kind === 'board')
          .map(item => item.location.kind === 'board' ? item.location.row * 4 + item.location.col : -1));
        const cell = Array.from({ length: 16 }, (_, index) => index).find(index => !taken.has(index))!;
        state = accept(state, { type: 'move', unitId: unit.id,
          to: { kind: 'board', col: cell % 4, row: Math.floor(cell / 4) } });
      }
      if (state.units.some(unit => unit.star === 3)) return state;
    }
    const result = advance(accept(state, { type: 'startWave' }), Number.MAX_SAFE_INTEGER);
    if (!result.ok) throw new Error(result.error.code);
    state = result.state;
    assert.equal(state.phase, 'preparation', `chain fixture wave ${wave}`);
  }
  throw new Error('Expected a real nine-purchase upgrade chain');
}

test('strict data trees reject hidden/accessor/symbol/exotic/cyclic data without invoking getters', () => {
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, 'type', { enumerable: true, get() { getterCalls += 1; return 'reroll'; } });
  const nestedAccessor = { type: 'unknown', nested: Object.defineProperty({}, 'x', { enumerable: true,
    get() { getterCalls += 1; return 1; } }) };
  const cyclic: Record<string, unknown> = { type: 'unknown' };
  cyclic.self = cyclic;
  const accessorArray = Object.defineProperty([1], '0', { enumerable: true,
    get() { getterCalls += 1; return 1; } });
  for (const bad of [undefined, () => 1, 1n, NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1,
    accessor, nestedAccessor, Object.defineProperty({ type: 'reroll' }, 'x', { value: 1 }),
    { type: 'reroll', [Symbol('x')]: 1 }, cyclic, accessorArray, new (class extends Array<number> {})(1),
    new Array(1), Object.assign([], { extra: 1 }), new Date(0), /a/, new Map(), Object.create({ inherited: 1 })]) {
    assert.equal(dataTree(bad), false);
  }
  assert.equal(getterCalls, 0);
  const shared = { value: -0 };
  assert.equal(dataTree({ a: shared, b: shared }), true);
  assert.equal(dataTree(Object.assign(Object.create(null), { type: 'reroll' })), true);
  assert.equal(dataTree([null, true, false, '한글', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]), true);
  let deep: unknown = null;
  for (let index = 0; index < 20000; index += 1) deep = { child: deep };
  assert.equal(dataTree(deep), true);
});

test('strict validators reject throwing/revoked proxies and exact-array violations', () => {
  const throwing = new Proxy({}, { getPrototypeOf() { throw new Error('hostile'); } });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const bad of [throwing, revoked.proxy]) {
    assert.equal(dataTree(bad), false);
    assert.equal(shape(bad, []), false);
    assert.equal(array(bad), false);
    assert.equal(command(bad), false);
    assert.equal(event(bad), false);
    assert.equal(entry(bad), false);
  }
  for (const bad of [new Array(2), Object.assign([1], { extra: 1 }), Object.assign([1], { [Symbol('x')]: 2 })]) {
    assert.equal(array(bad), false);
  }
  assert.equal(array(Object.freeze([1, 2])), true);
  assert.equal(integer(-0), true);
  assert.equal(integer(-0, 1), false);
  assert.equal(integer(Number.MAX_SAFE_INTEGER), true);
  assert.equal(integer(Number.MAX_SAFE_INTEGER + 1), false);
});

test('commands keep signed semantic bounds but reject removed growth and destination fields', () => {
  for (const input of [
    { type: 'recruit', offerSlot: -1 }, { type: 'reroll' },
    { type: 'move', unitId: 1, to: { kind: 'board', col: Number.MIN_SAFE_INTEGER, row: 4 } },
    { type: 'move', unitId: 1, to: { kind: 'bench', slot: 8 } },
    { type: 'swap', aId: 1, bId: 1 }, { type: 'sell', unitId: 1 }, { type: 'startWave' },
  ]) assert.equal(command(input), true, JSON.stringify(input));
  for (const input of [null, {}, { type: 'unknown' }, { type: 'reroll', extra: 1 },
    { type: 'sell', unitId: 0 }, { type: 'swap', aId: -1, bId: 1 },
    { type: 'merge', ids: [1, 2, 3], keepId: 1 }, { type: 'useBook', bookId: 1, unitId: 1 },
    { type: 'recruit', offerSlot: 0, benchSlot: 0 }, { type: 'recruit', offerSlot: 0, keepId: 1 },
    { type: 'move', unitId: 1, to: { kind: 'bench', slot: 0, col: 0 } },
    { type: 'recruit', offerSlot: 0.5 }]) assert.equal(command(input), false);
});

test('schema3 atomic command event shapes constrain null arrival and placed result independently', () => {
  for (const input of commandEvents) {
    assert.equal(event(input), true, input.type);
    assert.equal(event({ ...input, extra: 1 }), false, input.type);
    assert.equal(event({ ...input, tick: -1 }), false, input.type);
    assert.equal(event({ ...input, waveTick: 0.1 }), false, input.type);
    const missing = { ...input } as Record<string, unknown>;
    delete missing.wave;
    assert.equal(event(missing), false, input.type);
  }
  for (const input of [
    { ...recruited, offerSlot: 3 }, { ...recruited, goldDelta: NaN },
    ...[{ ...exampleArrival, id: 0 }, { ...exampleArrival, definitionId: '' },
      { ...exampleArrival, star: 2 }, { ...exampleArrival, cooldown: 1 },
      { ...exampleArrival, location: exampleUnit.location }].map(arrival => ({ ...recruited, arrival })),
    ...[{ ...exampleUnit, id: 0 }, { ...exampleUnit, definitionId: '' }, { ...exampleUnit, star: 4 },
      { ...exampleUnit, cooldown: -1 }, { ...exampleUnit, location: null },
      { ...exampleUnit, location: { kind: 'bench', slot: 8 } },
      { ...exampleUnit, location: { kind: 'board', col: 4, row: 0 } },
      { ...exampleUnit, xp: 0 }].map(result => ({ ...recruited, result })),
    ...[[1, 2], [1, 2, 3, 4], [0, 2, 3]].map(consumedIds => ({ ...recruited,
      upgrades: [{ ...exampleUpgrade, consumedIds }] })),
    { ...recruited, upgrades: [{ ...exampleUpgrade, result: { ...exampleUnit, location: null } }] },
    { ...recruited, upgrades: new Array(1) },
    { ...commandEvents[1], offers: [{ slot: 0, definitionId: 'fixture-01' }] },
    { ...commandEvents[1], offers: [0, 1, 2].map(slot => ({ slot, definitionId: '' })) },
    { ...commandEvents[4], book: null }, { ...commandEvents[5], participants: [] },
    { ...stamp, type: 'enemyDefeated', enemyId: 1 },
    { ...stamp, type: 'effectApplied', enemyId: 1, effect: { type: 'slow', percent: 30, expireAt: 40 } },
  ]) assert.equal(event(input), false, JSON.stringify(input));
  assert.equal(event({ ...recruited, upgrades: [exampleUpgrade] }), true);
  assert.equal(event({ ...recruited, goldDelta: 0 }), true); // Signed amount is structurally valid.
  assert.equal(event({ ...recruited, arrival: { ...exampleArrival, definitionId: 'not-in-this-profile' },
    result: { ...exampleUnit, definitionId: 'not-in-this-profile' } }), true);
  assert.equal(event({ ...commandEvents[1], offers: [0, 1, 2].map(slot => ({ slot, definitionId: null })) }), true);
  assert.equal(entry({ type: 'advance', seq: 1, startTick: 0, executedTicks: Number.MAX_SAFE_INTEGER }), true);
});

test('header validation explicitly rejects schemas1/2 and applies the exact header precedence', () => {
  const state = initial(), h = header(state);
  for (const bad of [null, [], {}, { ...h, extra: 1 }, { ...h, schemaVersion: NaN },
    { ...h, schemaVersion: 3.1 }, { ...h, rulesId: 1 }, { ...h, rulesDigest: null },
    { ...h, seed: undefined }, { ...h, seed: NaN }, { ...h, seed: Infinity },
    { ...h, seed: 1.2 }, { ...h, seed: Number.MAX_SAFE_INTEGER + 1 }]) failure(bad, null, 'BAD_FORMAT');
  for (const schemaVersion of [1, 2, -1, 0, 4]) {
    failure({ ...h, schemaVersion, rulesId: 'missing', seed: 0 }, null, 'UNSUPPORTED_SCHEMA');
  }
  failure({ ...h, rulesId: 'missing', rulesDigest: 'bad', seed: 0 }, null, 'UNKNOWN_RULES');
  for (const rulesId of ['__proto__', 'toString', 'constructor', 'playable-v2-proposal1-count40']) {
    failure({ ...h, rulesId }, [], 'UNKNOWN_RULES');
  }
  failure({ ...h, rulesDigest: 'bad', seed: 0 }, null, 'RULES_DIGEST_MISMATCH');
  for (const seed of [0, -1, 4294967296, '1', null, true, [], {}]) failure({ ...h, seed }, null, 'BAD_SEED');
  for (const hash of [null, 1, '', 'A'.repeat(64), 'g'.repeat(64), '0'.repeat(63), '0'.repeat(65)]) {
    failure(h, null, 'BAD_FORMAT', null, hash);
  }
  failure(h, [], 'FINAL_HASH_MISMATCH', null, '0'.repeat(64));
  assert.equal(replay(h, [], stateHash(state)).ok, true);
});

test('complete structural preflight outranks all earlier sequence and execution errors', () => {
  const state = prepared(), h = header(state), first = state.acceptedLog[0];
  if (first.type !== 'command') throw new Error();
  const malformed: unknown[] = [null, {}, { ...first, extra: 1 }, { ...first, seq: 1.5 },
    { ...first, seq: 0 }, { ...first, atTick: -1 }, { ...first, command: { type: 'unknown' } },
    { ...first, command: { type: 'merge', ids: [1, 2, 3], keepId: 1 } },
    { ...first, command: { type: 'useBook', bookId: 1, unitId: 1 } },
    { ...first, command: { type: 'recruit', offerSlot: 0, benchSlot: 0 } },
    { ...first, events: [{ ...first.events[0], extra: 1 }] }, { ...first, events: new Array(1) },
    { type: 'advance', seq: 1, startTick: 0, executedTicks: 0 },
    { type: 'advance', seq: 1, startTick: 0, executedTicks: 1.5 }];
  for (const value of malformed) {
    failure(h, [value], 'BAD_FORMAT', 0);
    failure(h, [{ ...first, seq: 9 }, value], 'BAD_FORMAT', 1);
    failure(h, [{ ...first, atTick: 999 }, value], 'BAD_FORMAT', 1);
  }
  for (const values of [null, {}, new Array(1), Object.assign([], { extra: 1 })]) failure(h, values, 'BAD_FORMAT');
  failure(h, [commandEntry({ type: 'startWave' }), null], 'BAD_FORMAT', 1);
  failure(h, [{ ...first, seq: 2 }], 'BAD_SEQUENCE', 0);
  failure(h, [{ ...first, atTick: 999 }, { ...first, seq: 9 }], 'BAD_SEQUENCE', 1);
});

test('hostile header, entry and nested event data never invoke accessors or return partial state', () => {
  const h = header(initial());
  let calls = 0;
  const accessor = (base: object, key: string) => Object.defineProperty(base, key, {
    enumerable: true, get() { calls += 1; return 1; },
  });
  failure(h, [commandEntry({ type: 'unknown', extra: accessor({}, 'x') })], 'BAD_FORMAT', 0);
  const circular: unknown[] = [];
  circular.push(circular);
  failure(h, circular, 'BAD_FORMAT', 0);
  failure(h, [commandEntry({ type: 'recruit', offerSlot: 0 }, [accessor({ ...recruited }, 'arrival')])], 'BAD_FORMAT', 0);
  failure(h, [commandEntry({ type: 'recruit', offerSlot: 0 }, [{ ...recruited,
    upgrades: [accessor({ ...exampleUpgrade }, 'consumedIds')] }])], 'BAD_FORMAT', 0);
  failure(accessor({ ...h }, 'seed'), [], 'BAD_FORMAT');
  failure(h, Object.defineProperty([null], '0', { enumerable: true, get() { calls += 1; return null; } }), 'BAD_FORMAT');
  assert.equal(calls, 0);
  const throwing = new Proxy({}, { getPrototypeOf() { throw new Error(); } });
  failure(throwing, [], 'BAD_FORMAT');
  failure(h, [throwing], 'BAD_FORMAT', 0);
});

test('safe signed command bounds and repeated IDs reach COMMAND_REJECTED', () => {
  const h = header(initial());
  for (const input of [
    { type: 'recruit', offerSlot: -1 }, { type: 'recruit', offerSlot: 3 },
    { type: 'move', unitId: 1, to: { kind: 'board', col: -1, row: 4 } },
    { type: 'move', unitId: 1, to: { kind: 'bench', slot: 8 } },
    { type: 'swap', aId: 1, bId: 1 }, { type: 'sell', unitId: 1 }, { type: 'startWave' },
  ]) failure(h, [commandEntry(input)], 'COMMAND_REJECTED', 0);
  const first = prepared().acceptedLog[0];
  failure(h, [{ ...first, atTick: 999 }, commandEntry({ type: 'swap', aId: 1, bId: 1 }, [], 2)], 'TICK_MISMATCH', 0);
});

test('regenerated events reject unknown nonempty definitions, changed IDs, signed amounts and stamps', () => {
  const state = fixture(), h = header(state), first = state.acceptedLog[0];
  if (first.type !== 'command' || first.events[0].type !== 'recruited') throw new Error();
  const recorded = first.events[0];
  failure(h, [{ ...first, atTick: 1 }], 'TICK_MISMATCH', 0);
  failure(h, [{ ...first, events: [] }], 'EVENT_MISMATCH', 0);
  for (const changed of [
    { ...recorded, arrival: { ...recorded.arrival, id: 999 } },
    { ...recorded, result: { ...recorded.result, id: 999 } },
    { ...recorded, arrival: { ...recorded.arrival, definitionId: 'unregistered-but-valid' } },
    { ...recorded, result: { ...recorded.result, definitionId: 'unregistered-but-valid' } },
    { ...recorded, goldDelta: 0 }, { ...recorded, goldDelta: 99 }, { ...recorded, tick: 1 },
    { ...recorded, result: { ...recorded.result, cooldown: 1 } },
  ]) failure(h, [{ ...first, events: [changed] }], 'EVENT_MISMATCH', 0);
  const advanceIndex = state.acceptedLog.findIndex(item => item.type === 'advance');
  const last = state.acceptedLog[advanceIndex];
  if (last.type !== 'advance') throw new Error();
  failure(h, [...state.acceptedLog.slice(0, advanceIndex), { ...last, startTick: 1 }], 'TICK_MISMATCH', advanceIndex);
  failure(h, [...state.acceptedLog.slice(0, advanceIndex), { ...last, executedTicks: last.executedTicks + 1 }],
    'ADVANCE_MISMATCH', advanceIndex);
  failure(h, [{ type: 'advance', seq: 1, startTick: 0, executedTicks: Number.MAX_SAFE_INTEGER }], 'ADVANCE_MISMATCH', 0);
  failure(h, state.acceptedLog, 'FINAL_HASH_MISMATCH', null, '0'.repeat(64));
});

test('real weighted purchases and a two-step automatic upgrade roundtrip across both profiles', () => {
  for (const rulesId of Object.keys(RULES_PROPOSALS) as RulesId[]) {
    const state = chained(rulesId);
    const purchases = state.acceptedLog.flatMap(item => item.type === 'command'
      ? item.events.filter(event => event.type === 'recruited') : []);
    assert.equal(purchases.length, 9);
    assert.equal(state.units.length, 1);
    assert.equal(state.units[0].star, 3);
    const final = purchases.at(-1)!;
    assert.equal(final.upgrades.length, 2);
    assert.equal(final.arrival.location, null);
    assert.equal(final.result.id, final.arrival.id + 2);
    assert.deepEqual(final.upgrades.map(upgrade => upgrade.result.star), [2, 3]);
    assert.deepEqual(final.upgrades.map(upgrade => upgrade.consumedIds.includes(final.arrival.id)), [true, false]);
    assert.ok(final.upgrades[1].consumedIds.includes(final.upgrades[0].result.id));
    for (const purchase of purchases) {
      assert.equal(purchase.goldDelta, -2);
      assert.equal(purchase.arrival.definitionId, 'fixture-01');
    }
    const entries = structuredClone(state.acceptedLog);
    const result = replay(header(state), entries, stateHash(state));
    assert.equal(result.ok, true, rulesId);
    if (!result.ok) continue;
    assert.deepEqual(result.state, state);
    assert.notEqual(result.state, state);
    assert.notEqual(result.state.acceptedLog, entries);
    const first = entries[0];
    if (first.type !== 'command' || first.command.type !== 'recruit' || first.events[0].type !== 'recruited') throw new Error();
    (first.command as { offerSlot: number }).offerSlot = 2;
    (first.events[0].arrival as { id: number }).id = 999;
    assert.deepEqual(result.state, state);
  }
});

test('structurally valid incorrect upgrade order, material identities and placement are EVENT_MISMATCH', () => {
  const state = chained(), h = header(state);
  const index = state.acceptedLog.findIndex(item => item.type === 'command'
    && item.events.some(event => event.type === 'recruited' && event.upgrades.length === 2));
  assert.ok(index >= 0);
  const recorded = state.acceptedLog[index];
  if (recorded.type !== 'command' || recorded.events[0].type !== 'recruited') throw new Error();
  const bought = recorded.events[0], first = bought.upgrades[0];
  const altered = [
    { ...bought, upgrades: [...bought.upgrades].reverse() },
    { ...bought, upgrades: [] },
    { ...bought, upgrades: [{ ...first, consumedIds: [...first.consumedIds].reverse() }, bought.upgrades[1]] },
    { ...bought, upgrades: [{ ...first, consumedIds: [first.consumedIds[0], first.consumedIds[0], first.consumedIds[2]] }, bought.upgrades[1]] },
    { ...bought, upgrades: [{ ...first, consumedIds: [first.result.id, first.consumedIds[1], first.consumedIds[2]] }, bought.upgrades[1]] },
    { ...bought, upgrades: [{ ...first, result: { ...first.result, definitionId: 'future-content' } }, bought.upgrades[1]] },
    { ...bought, result: { ...bought.result, location: { kind: 'bench', slot: 7 } } },
  ];
  for (const changed of altered) {
    assert.equal(event(changed), true);
    failure(h, [...state.acceptedLog.slice(0, index), { ...recorded, events: [changed] }], 'EVENT_MISMATCH', index);
  }
});

test('reroll, swap, sell and stamp-only waveStarted survive replay without obsolete growth fields', () => {
  let state = prepared();
  state = accept(state, { type: 'swap', aId: 1, bId: 2 });
  state = accept(state, { type: 'reroll' });
  state = accept(state, { type: 'sell', unitId: 3 });
  state = accept(state, { type: 'startWave' });
  const last = state.acceptedLog.at(-1);
  assert.deepEqual(last?.type === 'command' ? last.events : null, [{ ...stamp, type: 'waveStarted' }]);
  const result = replay(header(state), state.acceptedLog, stateHash(state));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.state, state);
  for (const obsolete of ['books', 'xp', 'level', 'waveParticipants', 'participants']) {
    assert.equal(JSON.stringify(state).includes(`"${obsolete}"`), false);
  }
});

test('terminal loss and surviving enemies roundtrip without partial execution', () => {
  let state = prepared();
  for (let wave = 1; state.phase !== 'result'; wave += 1) {
    assert.ok(wave <= 20);
    const result = advance(accept(state, { type: 'startWave' }), Number.MAX_SAFE_INTEGER);
    if (!result.ok) throw new Error(result.error.code);
    state = result.state;
  }
  assert.equal(state.outcome, 'loss');
  assert.ok(state.enemies.length > 0);
  const before = structuredClone(state);
  failure(header(state), [...state.acceptedLog, null], 'BAD_FORMAT', state.acceptedLog.length);
  assert.deepEqual(state, before);
  const result = replay(header(state), state.acceptedLog, stateHash(state));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.state, state);
});

test('canonical state has exactly schema3 canonical17 and ignores only log batching and entity array order', () => {
  const positioned = accept(prepared(), { type: 'move', unitId: 3, to: { kind: 'board', col: 0, row: 1 } });
  const advanced = advance(accept(positioned, { type: 'startWave' }), 1);
  if (!advanced.ok) throw new Error(advanced.error.code);
  const state = advanced.state, copy = structuredClone(state), parsed = JSON.parse(canonicalState(state));
  assert.deepEqual(Object.keys(parsed), [...CANONICAL_STATE_KEYS]);
  assert.equal(Object.keys(parsed).length, 17);
  assert.equal(Object.hasOwn(parsed, 'acceptedLog'), false);
  assert.equal(Object.hasOwn(parsed.units[0], 'xp'), false);
  assert.deepEqual(parsed.enemies, state.enemies);
  assert.ok(state.enemies.some(enemy => enemy.slow !== null));
  const unordered: MatchState = { ...state, offers: [...state.offers].reverse(), units: [...state.units].reverse(),
    enemies: [...state.enemies].reverse(), acceptedLog: [] };
  assert.equal(canonicalState(unordered), canonicalState(state));
  assert.equal(stateHash(unordered), stateHash(state));
  assert.deepEqual(state, copy);
  for (const key of ['outcomeReason', 'rngState', 'spawnCursor', 'waveTick', 'nextEntityId', 'gold'] as const) {
    const changed = { ...state, [key]: key === 'outcomeReason' ? 'cleared' : (state[key] as number) + 1 } as MatchState;
    assert.notEqual(stateHash(changed), stateHash(state), key);
  }
  for (const changed of [
    { ...state, units: state.units.map((unit, index) => index ? unit : { ...unit, cooldown: unit.cooldown + 1 }) },
    { ...state, enemies: state.enemies.map(enemy => ({ ...enemy, totalDistance: enemy.totalDistance + 1 })) },
    { ...state, enemies: state.enemies.map(enemy => ({ ...enemy,
      slow: enemy.slow === null ? null : { ...enemy.slow, expireAt: enemy.slow.expireAt + 1 } })) },
  ]) assert.notEqual(stateHash(changed), stateHash(state));
  assert.equal(replay(header(state), state.acceptedLog, stateHash(state)).ok, true);
});

test('different advance batching produces equal hashes and concatenated combat events', () => {
  const started = accept(prepared(), { type: 'startWave' });
  const whole = advance(started, Number.MAX_SAFE_INTEGER);
  assert.equal(whole.ok, true);
  if (!whole.ok) return;
  let state = started;
  const events = [];
  let ticks = 0;
  for (let index = 0; state.phase === 'combat'; index += 1) {
    const result = advance(state, [1, 3, 17, 49][index % 4]);
    if (!result.ok) throw new Error(result.error.code);
    state = result.state;
    ticks += result.executedTicks;
    events.push(...result.events);
  }
  assert.equal(ticks, whole.executedTicks);
  assert.deepEqual(events, whole.events);
  assert.equal(canonicalState(state), canonicalState(whole.state));
  assert.equal(stateHash(state), stateHash(whole.state));
  assert.notDeepEqual(state.acceptedLog, whole.state.acceptedLog);
  assert.equal(replay(header(state), state.acceptedLog, stateHash(whole.state)).ok, true);
});

test('independent canonical JSON and Node SHA verify state and all fixed rule digests', () => {
  for (const rulesId of Object.keys(RULES_PROPOSALS) as RulesId[]) {
    assert.equal(sha256(canonicalJson(RULES_PROPOSALS[rulesId])), RULES_DIGESTS[rulesId]);
    assert.equal(createHash('sha256').update(independentJson(RULES_PROPOSALS[rulesId]), 'utf8').digest('hex'), RULES_DIGESTS[rulesId]);
  }
  const state = fixture(), parsed = JSON.parse(canonicalState(state));
  assert.equal(canonicalState(state), independentJson(parsed));
  assert.equal(stateHash(state), createHash('sha256').update(independentJson(parsed), 'utf8').digest('hex'));
});

test('pure SHA-256 matches Node UTF-8, padding, long strings and unpaired surrogates', () => {
  for (const value of ['', 'abc', '한글과 🍑', '\ud800', '\udc00', 'a\ud800z',
    ...[55, 56, 63, 64, 65, 127, 128, 10000].map(length => 'a'.repeat(length))]) {
    assert.equal(sha256(value), createHash('sha256').update(value, 'utf8').digest('hex'));
  }
  assert.equal(canonicalJson({ z: -0, a: [1, true, null, '한글'], A: 2 }), '{"A":2,"a":[1,true,null,"한글"],"z":0}');
  const badValues = [undefined, NaN, Infinity, 1.5, new Date(0), new Array(1),
    Object.assign([], { extra: 1 }), { [Symbol('x')]: 1 }, Object.defineProperty({}, 'x', { value: 1 })];
  for (const bad of badValues) assert.throws(() => canonicalJson(bad), TypeError);
  const circular: unknown[] = [];
  circular.push(circular);
  assert.throws(() => canonicalJson(circular), TypeError);
});

const unrestrictedAdvance: ReplayEntry = { type: 'advance', seq: 1, startTick: 0, executedTicks: Number.MAX_SAFE_INTEGER };
assert.equal(entry(unrestrictedAdvance), true);
