import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSession } from '../../src/web/session.ts';
import type {
  AdvanceResult, Command, CoreApi, CreateMatchResult, DispatchResult,
  MatchState, Observation, PublicRules, Unit,
} from '../../src/core/index.ts';

// Adapter-only tests. These frozen fixtures and scripted CoreApi responses do
// not implement gameplay, validate rules, or provide evidence of a playable core.
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const rules: PublicRules = freeze({
  schemaVersion: 1, rulesId: 'test-only', rulesDigest: 'test-digest', tickMs: 50,
  waveCount: 1, startingLives: 1, startingGold: 1, recruitCost: 1,
  offerCount: 1, waveReward: 1,
  board: { columns: 4, rows: 4, tileSize: 1, capacity: 16 }, benchCapacity: 1,
  path: { length: 1, vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  units: {
    single: { damage: 1, range: 1, cooldownTicks: 1, splashRadius: 0 },
    splash: { damage: 1, range: 1, cooldownTicks: 1, splashRadius: 1 },
  },
  enemies: { basic: { speed: 1, leakDamage: 1 } },
});
const unit = (id: number, col: number, row: number): Unit =>
  ({ id, typeId: 'single', star: 1, location: { kind: 'board', col, row }, cooldown: 0 });
function state(patch: Partial<MatchState> = {}): MatchState {
  return freeze({
    schemaVersion: 1, rulesId: 'test-only', rulesDigest: 'test-digest', seed: 42,
    rngState: 123, nextEntityId: 1, tick: 0, phase: 'preparation', outcome: null,
    wave: 1, waveTick: 0, spawnCursor: 0, lives: 1, gold: 1,
    offers: [{ slot: 0, typeId: 'single' }], units: [], enemies: [], acceptedLog: [],
    ...patch,
  });
}
function harness(initial = state()) {
  const calls = {
    create: [] as { seed: unknown; rulesId?: string }[],
    dispatch: [] as { state: MatchState; command: unknown }[],
    advance: [] as { state: MatchState; count: unknown }[],
    observe: [] as MatchState[], canonical: [] as MatchState[],
  };
  let createResponse: CreateMatchResult = { ok: true, state: initial };
  let dispatchResponse: DispatchResult | undefined;
  let advanceResponse: AdvanceResult | undefined;
  let onCreate: (() => void) | undefined;
  const unused = (): never => { throw new Error('Unexpected test-double API call'); };
  const api: CoreApi = {
    createMatch(seed, rulesId) {
      calls.create.push({ seed, rulesId });
      onCreate?.();
      return createResponse;
    },
    dispatch(current, command) {
      calls.dispatch.push({ state: current, command });
      assert.ok(dispatchResponse, 'dispatch response must be explicitly scripted');
      return dispatchResponse;
    },
    advance(current, count) {
      calls.advance.push({ state: current, count });
      assert.ok(advanceResponse, 'advance response must be explicitly scripted');
      return advanceResponse;
    },
    observe(current): Observation {
      calls.observe.push(current);
      return freeze(structuredClone({ rules, tick: current.tick, phase: current.phase,
        outcome: current.outcome, wave: current.wave, waveTick: current.waveTick,
        lives: current.lives, gold: current.gold, offers: current.offers,
        units: current.units, enemies: current.enemies }));
    },
    canonicalState(current) { calls.canonical.push(current); return 'core canonical sentinel'; },
    stateHash: unused, replay: unused, getRules: unused,
    pathPosition: unused, boardPosition: unused,
  };
  return {
    api, calls, initial,
    create(result: CreateMatchResult) { createResponse = result; },
    dispatch(result: DispatchResult) { dispatchResponse = result; },
    advance(result: AdvanceResult) { advanceResponse = result; },
    onCreate(callback: () => void) { onCreate = callback; },
    session: createSession(42, api),
  };
}
function accepted(next: MatchState): DispatchResult { return { ok: true, state: next, events: [] }; }

test('initialization uses injected core; observation and canonical serialization are delegated', () => {
  const h = harness();
  assert.deepEqual(h.calls.create, [{ seed: 42, rulesId: undefined }]);
  assert.equal(h.session.match.state, h.initial);
  assert.deepEqual(h.session.observe().units, []);
  assert.deepEqual(h.calls.observe, [h.initial]);
  assert.equal(h.session.canonical(), 'core canonical sentinel');
  assert.deepEqual(h.calls.canonical, [h.initial]);
  assert.equal(h.session.selection, null);
  assert.deepEqual(h.session.archives, []);
});

test('initial creation failure is surfaced rather than fabricating a match', () => {
  const h = harness();
  h.create({ ok: false, error: { code: 'BAD_SEED' } });
  assert.throws(() => createSession(42, h.api), /BAD_SEED/);
});

test('offer toggle, switching, and cancel are adapter-only and do not mutate core state', () => {
  const h = harness();
  const before = structuredClone(h.initial);
  assert.deepEqual(h.session.selectOffer(0), { ok: true });
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
  h.session.selectOffer(0);
  assert.equal(h.session.selection, null);
  h.session.selectOffer(0);
  h.session.selectOffer(1);
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 1 });
  h.session.cancel();
  h.session.cancel();
  assert.equal(h.session.selection, null);
  assert.equal(h.session.match.state, h.initial);
  assert.deepEqual(h.initial, before);
  assert.equal(h.calls.dispatch.length, 0);
});

test('empty unselected cell does not issue a command', () => {
  const h = harness();
  assert.deepEqual(h.session.selectCell(2, 3), { ok: false, code: 'NO_SELECTION' });
  assert.equal(h.calls.dispatch.length, 0);
});

test('recruit command uses selected slot and clicked cell; acceptance clears selection once', () => {
  const h = harness();
  const next = state({ units: [unit(9, 2, 3)], gold: 0 });
  h.dispatch(accepted(next));
  const wrapper = h.session.match;
  h.session.selectOffer(0);
  assert.deepEqual(h.session.selectCell(2, 3), { ok: true });
  assert.deepEqual(h.calls.dispatch, [{ state: h.initial,
    command: { type: 'recruit', offerSlot: 0, to: { kind: 'board', col: 2, row: 3 } } }]);
  assert.equal(h.session.match, wrapper);
  assert.equal(h.session.match.state, next);
  assert.equal(h.session.selection, null);
  // The second click selects the unit; it must not recruit again.
  assert.deepEqual(h.session.selectCell(2, 3), { ok: true });
  assert.deepEqual(h.session.selection, { kind: 'unit', id: 9 });
  assert.equal(h.calls.dispatch.length, 1);
});

test('rejected recruit preserves selection, match, replay, and frozen authoritative state', () => {
  const h = harness();
  const wrapper = h.session.match;
  const before = structuredClone(h.initial);
  h.session.selectOffer(0);
  const selection = h.session.selection;
  h.dispatch({ ok: false, state: h.initial, error: { code: 'INSUFFICIENT_GOLD' } });
  assert.deepEqual(h.session.selectCell(1, 2), { ok: false, code: 'INSUFFICIENT_GOLD' });
  assert.equal(h.session.match, wrapper);
  assert.equal(h.session.match.state, h.initial);
  assert.equal(h.session.selection, selection);
  assert.equal(h.session.record().entries, h.initial.acceptedLog);
  assert.deepEqual(h.initial, before);
  assert.deepEqual(h.session.archives, []);
});

test('unit click selects and repeated click cancels without core mutation', () => {
  const h = harness(state({ units: [unit(7, 1, 2)] }));
  h.session.selectCell(1, 2);
  assert.deepEqual(h.session.selection, { kind: 'unit', id: 7 });
  h.session.selectCell(1, 2);
  assert.equal(h.session.selection, null);
  assert.equal(h.calls.dispatch.length, 0);
  assert.equal(h.session.match.state, h.initial);
});

for (const occupied of [false, true]) {
  test(`selected unit emits ${occupied ? 'swap' : 'move'} with core IDs and board coordinates`, () => {
    const h = harness(state({ units: occupied ? [unit(7, 0, 0), unit(19, 2, 3)] : [unit(7, 0, 0)] }));
    const next = state();
    h.dispatch(accepted(next));
    h.session.selectCell(0, 0);
    assert.deepEqual(h.session.selectCell(2, 3), { ok: true });
    const expected: Command = occupied ? { type: 'swap', aId: 7, bId: 19 }
      : { type: 'move', unitId: 7, to: { kind: 'board', col: 2, row: 3 } };
    assert.deepEqual(h.calls.dispatch, [{ state: h.initial, command: expected }]);
    assert.equal(h.session.match.state, next);
    assert.equal(h.session.selection, null);
  });
}

test('rejected move preserves unit selection and does not adopt rejection state', () => {
  const h = harness(state({ units: [unit(7, 0, 0)] }));
  h.session.selectCell(0, 0);
  h.dispatch({ ok: false, state: state({ gold: 999 }), error: { code: 'BAD_LOCATION' } });
  assert.deepEqual(h.session.selectCell(-1, 3), { ok: false, code: 'BAD_LOCATION' });
  assert.equal(h.session.match.state, h.initial);
  assert.deepEqual(h.session.selection, { kind: 'unit', id: 7 });
});

for (const phase of ['combat', 'result'] as const) {
  test(`${phase} guards selection locally and forwards start rejection without mutation`, () => {
    const h = harness(state({ phase }));
    assert.deepEqual(h.session.selectOffer(0), { ok: false, code: 'BAD_PHASE' });
    assert.deepEqual(h.session.selectCell(0, 0), { ok: false, code: 'BAD_PHASE' });
    assert.equal(h.calls.observe.length, 0);
    assert.equal(h.calls.dispatch.length, 0);
    h.dispatch({ ok: false, state: h.initial, error: { code: 'BAD_PHASE' } });
    assert.deepEqual(h.session.start(), { ok: false, code: 'BAD_PHASE' });
    assert.deepEqual(h.calls.dispatch[0]?.command, { type: 'startWave' });
    assert.equal(h.session.match.state, h.initial);
  });
}

test('start delegates exactly startWave and clears selection only on acceptance', () => {
  const h = harness();
  h.session.selectOffer(0);
  h.dispatch({ ok: false, state: h.initial, error: { code: 'NO_BOARD_UNITS' } });
  assert.deepEqual(h.session.start(), { ok: false, code: 'NO_BOARD_UNITS' });
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
  const next = state({ phase: 'combat' });
  h.dispatch(accepted(next));
  assert.deepEqual(h.session.start(), { ok: true });
  assert.equal(h.session.selection, null);
  assert.equal(h.session.match.state, next);
  assert.deepEqual(h.calls.dispatch.map((call) => call.command), [{ type: 'startWave' }, { type: 'startWave' }]);
});

for (const phase of ['preparation', 'combat'] as const) {
  test(`restart is blocked during ${phase} before calling createMatch`, () => {
    const h = harness(state({ phase }));
    assert.deepEqual(h.session.restart(), { ok: false, code: 'BAD_PHASE' });
    assert.equal(h.calls.create.length, 1);
    assert.equal(h.session.match.state, h.initial);
    assert.deepEqual(h.session.archives, []);
  });
}

test('restart archives exact old header and log before replacing the match wrapper', () => {
  const old = state({ phase: 'result', outcome: 'loss', acceptedLog: [
    { type: 'command', seq: 0, atTick: 0, command: { type: 'startWave' }, events: [] },
    { type: 'advance', seq: 1, startTick: 0, executedTicks: 5 },
  ] });
  const h = harness(old);
  const wrapper = h.session.match;
  const next = state({ rngState: 456 });
  h.create({ ok: true, get state() {
    assert.equal(h.session.match, wrapper, 'replacement is not exposed yet');
    assert.equal(h.session.archives.length, 1, 'archive exists before adopting replacement state');
    assert.equal(h.session.archives[0]?.entries, old.acceptedLog);
    return next;
  } });
  h.onCreate(() => {
    assert.equal(h.session.match, wrapper, 'old match stays exposed while creation runs');
    assert.deepEqual(h.session.archives, [], 'failed creation must not archive');
  });
  assert.deepEqual(h.session.restart(), { ok: true });
  assert.notEqual(h.session.match, wrapper);
  assert.equal(h.session.match.state, next);
  assert.equal(wrapper.state, old);
  assert.equal(h.session.selection, null);
  assert.deepEqual(h.calls.create[1], { seed: 42, rulesId: old.rulesId });
  assert.deepEqual(h.session.archives, [{ header: {
    schemaVersion: old.schemaVersion, rulesId: old.rulesId,
    rulesDigest: old.rulesDigest, seed: old.seed,
  }, entries: old.acceptedLog }]);
  assert.equal(h.session.archives[0]?.entries, old.acceptedLog);
  assert.equal(h.session.record().entries, next.acceptedLog);
});

test('failed restart preserves old wrapper and existing archives; a retry archives once', () => {
  const h = harness(state({ phase: 'result' }));
  const secondResult = state({ phase: 'result', tick: 5 });
  h.create({ ok: true, state: secondResult });
  h.session.restart();
  const wrapper = h.session.match;
  const archives = [...h.session.archives];
  h.create({ ok: false, error: { code: 'UNKNOWN_RULES' } });
  assert.deepEqual(h.session.restart(), { ok: false, code: 'UNKNOWN_RULES' });
  assert.equal(h.session.match, wrapper);
  assert.equal(h.session.match.state, secondResult);
  assert.deepEqual(h.session.archives, archives);
  h.create({ ok: true, state: state() });
  assert.deepEqual(h.session.restart(), { ok: true });
  assert.equal(h.session.archives.length, 2);
  assert.equal(h.session.archives[1]?.entries, secondResult.acceptedLog);
});

test('old-match and lookalike targets cannot select, dispatch, advance, or disturb new selection', () => {
  const h = harness(state({ phase: 'result' }));
  const old = h.session.match;
  h.create({ ok: true, state: state() });
  h.session.restart();
  h.session.selectOffer(0);
  for (const target of [old, { state: h.session.match.state }]) {
    assert.deepEqual(h.session.selectCell(0, 0, target), { ok: false, code: 'STALE_INPUT' });
    assert.deepEqual(h.session.start(target), { ok: false, code: 'STALE_INPUT' });
    assert.equal(h.session.advance(target, 99), undefined);
  }
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
  assert.equal(h.calls.dispatch.length, 0);
  assert.equal(h.calls.advance.length, 0);
  assert.equal(h.calls.observe.length, 0);
  assert.equal(h.session.archives.length, 1);
});

test('advance passes count and state to core, returns events, and keeps the match wrapper', () => {
  const h = harness(state({ phase: 'combat' }));
  const wrapper = h.session.match;
  const next = state({ phase: 'combat', tick: 3 });
  const response: AdvanceResult = { ok: true, state: next, executedTicks: 3,
    events: [{ type: 'enemySpawned', tick: 1, id: 4, typeId: 'basic' }] };
  h.advance(response);
  assert.equal(h.session.advance(wrapper, 3), response);
  assert.deepEqual(h.calls.advance, [{ state: h.initial, count: 3 }]);
  assert.equal(h.session.match, wrapper);
  assert.equal(h.session.match.state, next);
});

for (const phase of ['preparation', 'result'] as const) {
  test(`advance transition to ${phase} clears adapter selection`, () => {
    const h = harness();
    h.session.selectOffer(0);
    const next = state({ phase });
    h.advance({ ok: true, state: next, executedTicks: 0, events: [] });
    h.session.advance(h.session.match, 0);
    assert.equal(h.session.selection, null);
    assert.equal(h.session.match.state, next);
  });
}

test('advance failure throws the core error and preserves wrapper, state, selection, archives', () => {
  const h = harness();
  const wrapper = h.session.match;
  h.session.selectOffer(0);
  h.advance({ ok: false, state: state({ tick: 999 }), executedTicks: 0, error: { code: 'BAD_COUNT' } });
  assert.throws(() => h.session.advance(wrapper, -1), /BAD_COUNT/);
  assert.equal(h.session.match, wrapper);
  assert.equal(h.session.match.state, h.initial);
  assert.deepEqual(h.session.selection, { kind: 'offer', slot: 0 });
  assert.deepEqual(h.session.archives, []);
});

test('unexpected createMatch throw during restart preserves current match and old log', () => {
  const h = harness(state({ phase: 'result', outcome: 'loss' }));
  const before = h.session.match;
  const oldRecord = h.session.record();
  h.onCreate(() => { throw new Error('unexpected engine failure'); });
  assert.throws(() => h.session.restart(), /unexpected engine failure/);
  assert.strictEqual(h.session.match, before);
  assert.deepEqual(h.session.record(), oldRecord);
  assert.deepEqual(h.session.archives, []);
});
