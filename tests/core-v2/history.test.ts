import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, createMatch, dispatch, EXPERIMENT_RULES_ID, stateHash } from '../../src/core-v2/index.ts';
import type { Command, MatchState } from '../../src/core-v2/types.ts';
import { copy, freeze } from '../../src/core-v2/util.ts';

function initial(): MatchState {
  const result = createMatch(1, EXPERIMENT_RULES_ID); assert.ok(result.ok);
  return result.state;
}
function accepted(state: MatchState, command: Command) {
  const result = dispatch(state, command); assert.ok(result.ok);
  return result;
}
function prepared(): MatchState {
  const recruited = accepted(initial(), { type: 'recruit', offerSlot: 0 });
  return accepted(recruited.state, { type: 'move', unitId: 1, to: { kind: 'board', col: 0, row: 0 } }).state;
}
function combat(): MatchState { return accepted(prepared(), { type: 'startWave' }).state; }
function deeplyFrozen(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    Object.values(value).forEach(deeplyFrozen);
  }
}
function sharesHistory(previous: MatchState, next: MatchState): void {
  assert.notStrictEqual(next, previous);
  assert.notStrictEqual(next.acceptedLog, previous.acceptedLog);
  assert.equal(next.acceptedLog.length, previous.acceptedLog.length + 1);
  previous.acceptedLog.forEach((entry, index) => assert.strictEqual(next.acceptedLog[index], entry));
  for (const key of ['offers', 'units', 'enemies'] as const) {
    assert.notStrictEqual(next[key], previous[key]);
    previous[key].forEach((item, index) => assert.notStrictEqual(next[key][index], item));
  }
  deeplyFrozen(next);
}

test('published command and advance states share frozen historical entries, never live trees or log arrays', () => {
  const before = prepared(), snapshot = structuredClone(before), hash = stateHash(before);
  const rolled = accepted(before, { type: 'reroll' });
  sharesHistory(before, rolled.state);
  assert.notStrictEqual(rolled.state.units[0].location, before.units[0].location);
  const started = accepted(rolled.state, { type: 'startWave' });
  sharesHistory(rolled.state, started.state);
  const first = advance(started.state, 1); assert.ok(first.ok);
  sharesHistory(started.state, first.state);
  const firstSnapshot = structuredClone(first.state);
  const second = advance(first.state, 1); assert.ok(second.ok);
  sharesHistory(first.state, second.state);
  assert.deepEqual(first.state, firstSnapshot);
  assert.deepEqual(before, snapshot); assert.equal(stateHash(before), hash);
  deeplyFrozen(rolled.events); deeplyFrozen(first.events); deeplyFrozen(initial());
  assert.throws(() => { (second.state.acceptedLog as unknown[]).pop(); }, TypeError);
  const oldEntry = second.state.acceptedLog[0];
  assert.throws(() => { (oldEntry as { seq: number }).seq = 99; }, TypeError);
});

test('new command inputs, returned events, live units and retained historical event snapshots stay detached', () => {
  const recruited = accepted(initial(), { type: 'recruit', offerSlot: 0 });
  const input = { type: 'move', unitId: 1, to: { kind: 'board', col: 0, row: 0 } } as const;
  const moved = accepted(recruited.state, input);
  const entry = moved.state.acceptedLog.at(-1)!;
  assert.ok(entry.type === 'command' && entry.command.type === 'move');
  const event = moved.events[0], historicalEvent = entry.events[0];
  assert.ok(event.type === 'moved' && historicalEvent.type === 'moved');
  assert.notStrictEqual(entry.command, input);
  assert.notStrictEqual(entry.command.to, input.to);
  assert.notStrictEqual(entry.events, moved.events);
  assert.notStrictEqual(historicalEvent, event);
  assert.notStrictEqual(historicalEvent.to, event.to);
  assert.notStrictEqual(historicalEvent.to, moved.state.units[0].location);
  (input.to as { col: number }).col = 3;
  assert.deepEqual(entry.command.to, { kind: 'board', col: 0, row: 0 });
  const later = accepted(moved.state, { type: 'move', unitId: 1, to: { kind: 'board', col: 1, row: 0 } });
  assert.strictEqual(later.state.acceptedLog[1], entry);
  assert.deepEqual(historicalEvent.to, { kind: 'board', col: 0, row: 0 });
  assert.deepEqual(event.to, historicalEvent.to);
  assert.deepEqual(later.state.units[0].location, { kind: 'board', col: 1, row: 0 });
  assert.throws(() => { (historicalEvent.to as { col: number }).col = 2; }, TypeError);
});

for (const operation of ['dispatch', 'advance'] as const) {
  const source = () => operation === 'dispatch' ? prepared() : combat();
  const run = (state: MatchState) => operation === 'dispatch' ? dispatch(state, { type: 'reroll' }) : advance(state, 1);

  for (const mode of ['mutable', 'shallow-frozen', 'deep-frozen'] as const) {
    test(`${operation} fully detaches unknown ${mode} history even when it resembles a published snapshot`, () => {
      const state = copy(source());
      const entry = state.acceptedLog[0]; assert.ok(entry.type === 'command');
      const event = entry.events[0]; assert.ok(event.type === 'recruited');
      if (mode === 'shallow-frozen') {
        Object.freeze(entry); Object.freeze(state.acceptedLog); Object.freeze(state);
        assert.equal(Object.isFrozen(event.result), false);
      } else if (mode === 'deep-frozen') freeze(state);
      const before = structuredClone(state), result = run(state); assert.ok(result.ok);
      assert.notStrictEqual(result.state.acceptedLog, state.acceptedLog);
      state.acceptedLog.forEach((oldEntry, index) => assert.notStrictEqual(result.state.acceptedLog[index], oldEntry));
      const copiedEntry = result.state.acceptedLog[0]; assert.ok(copiedEntry.type === 'command');
      const copiedEvent = copiedEntry.events[0]; assert.ok(copiedEvent.type === 'recruited');
      assert.notStrictEqual(copiedEntry.events, entry.events);
      assert.notStrictEqual(copiedEvent.result, event.result);
      assert.deepEqual(state, before); deeplyFrozen(result.state);
      if (mode !== 'deep-frozen') {
        event.result.cooldown = 9;
        assert.equal(copiedEvent.result.cooldown, 0);
        assert.equal(Object.isFrozen(event.result), false, 'publishing a copy must not freeze caller-owned children');
      }
      const next = run(result.state); assert.ok(next.ok);
      sharesHistory(result.state, next.state);
    });

    test(`${operation} rejects unsafe historical numbers in unknown ${mode} states atomically`, () => {
      for (const unsafe of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
        const state = copy(source());
        const entry = state.acceptedLog[0]; assert.ok(entry.type === 'command');
        const event = entry.events[0]; assert.ok(event.type === 'recruited');
        event.result.cooldown = unsafe;
        if (mode === 'shallow-frozen') {
          Object.freeze(entry); Object.freeze(state.acceptedLog); Object.freeze(state);
        } else if (mode === 'deep-frozen') freeze(state);
        const before = structuredClone(state), result = run(state);
        assert.equal(result.ok, false); assert.strictEqual(result.state, state);
        if (!result.ok) assert.equal(result.error.code, 'INTEGER_OVERFLOW');
        assert.equal(Object.hasOwn(result, 'events'), false);
        if ('executedTicks' in result) assert.equal(result.executedTicks, 0);
        assert.deepEqual(state, before);
      }
    });
  }

  test(`${operation} failure and success never mark the caller's unknown state as trusted`, () => {
    const state = copy(source());
    const entry = state.acceptedLog[0]; assert.ok(entry.type === 'command');
    const event = entry.events[0]; assert.ok(event.type === 'recruited');
    Object.freeze(entry); Object.freeze(state.acceptedLog); Object.freeze(state);
    event.result.cooldown = Infinity;
    const rejected = run(state); assert.equal(rejected.ok, false); assert.strictEqual(rejected.state, state);
    event.result.cooldown = 0;
    const recovered = run(state); assert.ok(recovered.ok);
    const snapshot = structuredClone(recovered.state);
    event.result.cooldown = Infinity;
    const rejectedAgain = run(state); assert.equal(rejectedAgain.ok, false);
    if (!rejectedAgain.ok) assert.equal(rejectedAgain.error.code, 'INTEGER_OVERFLOW');
    assert.strictEqual(rejectedAgain.state, state);
    const next = run(recovered.state); assert.ok(next.ok);
    sharesHistory(recovered.state, next.state);
    assert.deepEqual(recovered.state, snapshot);
  });
}

test('trusted command overflow preserves history and permits a later valid command', () => {
  const fixture = copy(prepared()); fixture.gold = Number.MAX_SAFE_INTEGER;
  const state = accepted(fixture, { type: 'move', unitId: 1, to: { kind: 'board', col: 1, row: 0 } }).state;
  const before = structuredClone(state), hash = stateHash(state);
  const failed = dispatch(state, { type: 'sell', unitId: 1 });
  assert.deepEqual(failed, { ok: false, state, error: { code: 'INTEGER_OVERFLOW' } });
  assert.strictEqual(failed.state, state); assert.deepEqual(state, before); assert.equal(stateHash(state), hash);
  const next = accepted(state, { type: 'reroll' });
  sharesHistory(state, next.state); assert.equal(next.state.gold, Number.MAX_SAFE_INTEGER - 1);
});

test('trusted later-tick overflow rolls back the whole batch without poisoning subsequent advances', () => {
  const fixture = copy(combat()); fixture.tick = Number.MAX_SAFE_INTEGER - 2;
  const first = advance(fixture, 1); assert.ok(first.ok);
  const state = first.state, before = structuredClone(state), hash = stateHash(state);
  const failed = advance(state, 2);
  assert.deepEqual(failed, { ok: false, state, error: { code: 'INTEGER_OVERFLOW' }, executedTicks: 0 });
  assert.strictEqual(failed.state, state); assert.deepEqual(state, before); assert.equal(stateHash(state), hash);
  const next = advance(state, 1); assert.ok(next.ok);
  sharesHistory(state, next.state); assert.equal(next.state.tick, Number.MAX_SAFE_INTEGER);
});
