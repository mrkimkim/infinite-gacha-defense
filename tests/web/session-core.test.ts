import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as core from '../../src/core/index.ts';
import { createSession } from '../../src/web/session.ts';
import type { InputResult, Session } from '../../src/web/session.ts';

// Integration against the real core, not a CoreApi double. These seed-1 policies
// are observed technical-v1 regression fixtures, not independently specified
// balance targets, evidence of fun, browser interaction, or human playtesting.
const centerCells = [[1, 1], [2, 1], [1, 2], [2, 2]] as const;
function accepted(result: InputResult): void { assert.deepEqual(result, { ok: true }); }
function recruit(session: Session, slot: number, col: number, row: number): void {
  accepted(session.selectOffer(slot));
  accepted(session.selectCell(col, row));
  assert.equal(session.selection, null);
}
function fillCenter(session: Session): void {
  // Every decision is based on the public observation, never RNG/future spawns.
  for (const [col, row] of centerCells) {
    const view = session.observe();
    if (view.gold < view.rules.recruitCost || view.units.length >= view.rules.board.capacity) break;
    if (view.units.some(unit => unit.location.kind === 'board'
      && unit.location.col === col && unit.location.row === row)) continue;
    const offer = view.offers.find(item => item.typeId === 'single') ?? view.offers[0];
    assert.ok(offer);
    recruit(session, offer.slot, col, row);
  }
}
function runFixture(policy: 'center' | 'corner', batch = 5, session = createSession(1)): Session {
  if (policy === 'corner') {
    const offer = session.observe().offers[0];
    assert.ok(offer);
    assert.equal(offer.typeId, 'splash');
    recruit(session, offer.slot, 0, 0);
  }
  let calls = 0;
  while (session.observe().phase !== 'result') {
    assert.ok(++calls < 10_000, 'smoke policy must reach a terminal result');
    if (session.observe().phase === 'preparation') {
      if (policy === 'center') fillCenter(session);
      accepted(session.start());
    } else {
      const result = session.advance(session.match, batch);
      assert.ok(result?.ok);
      assert.ok(result.executedTicks > 0);
    }
  }
  return session;
}
function assertRejectedUnchanged(session: Session, action: () => InputResult, code: string): void {
  const wrapper = session.match;
  const state = wrapper.state;
  const snapshot = structuredClone(state);
  const selection = structuredClone(session.selection);
  assert.deepEqual(action(), { ok: false, code });
  assert.equal(session.match, wrapper);
  assert.equal(session.match.state, state);
  // canonicalState intentionally excludes acceptedLog; compare the full state too.
  assert.deepEqual(session.match.state, snapshot);
  assert.deepEqual(session.selection, selection);
}
function assertReplay(session: Session): string {
  const canonical = session.canonical();
  assert.equal(canonical, core.canonicalState(session.match.state));
  const independentHash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  assert.equal(core.stateHash(session.match.state), independentHash);
  const record = session.record();
  const replayed = core.replay(record.header, record.entries, independentHash);
  assert.ok(replayed.ok);
  assert.equal(core.canonicalState(replayed.state), canonical);
  assert.deepEqual(replayed.state, session.match.state);
  return independentHash;
}

test('real core: offer selection recruits, unit selection moves and swaps', () => {
  const session = createSession(1);
  const initial = session.match.state;
  accepted(session.selectOffer(0));
  assert.deepEqual(session.selection, { kind: 'offer', slot: 0 });
  assert.equal(session.match.state, initial);
  accepted(session.selectOffer(0));
  assert.equal(session.selection, null);
  recruit(session, 0, 0, 0);
  const first = session.observe().units[0];
  assert.ok(first);
  accepted(session.selectCell(0, 0));
  assert.deepEqual(session.selection, { kind: 'unit', id: first.id });
  accepted(session.selectCell(1, 0));
  assert.equal(session.selection, null);
  assert.deepEqual(session.observe().units[0]?.location, { kind: 'board', col: 1, row: 0 });
  recruit(session, 0, 2, 0);
  const second = session.observe().units.find(unit => unit.id !== first.id);
  assert.ok(second);
  accepted(session.selectCell(1, 0));
  accepted(session.selectCell(2, 0));
  assert.equal(session.selection, null);
  assert.deepEqual(session.observe().units.find(unit => unit.id === first.id)?.location,
    { kind: 'board', col: 2, row: 0 });
  assert.deepEqual(session.observe().units.find(unit => unit.id === second.id)?.location,
    { kind: 'board', col: 1, row: 0 });
  assert.deepEqual(session.record().entries.filter(entry => entry.type === 'command')
    .map(entry => entry.command.type), ['recruit', 'move', 'recruit', 'swap']);
  accepted(session.selectCell(2, 0));
  accepted(session.selectCell(2, 0));
  assert.equal(session.selection, null);
  assertReplay(session);
});

test('real core: rejected input preserves the full state, replay log, and selection', () => {
  const session = createSession(1);
  accepted(session.selectOffer(0));
  assertRejectedUnchanged(session, () => session.start(), 'NO_BOARD_UNITS');
  assertRejectedUnchanged(session, () => session.selectCell(-1, 0), 'BAD_FORMAT');
  accepted(session.selectCell(0, 0));
  accepted(session.selectOffer(0));
  assertRejectedUnchanged(session, () => session.selectCell(0, 0), 'LOCATION_OCCUPIED');
  accepted(session.selectCell(1, 0));
  recruit(session, 0, 2, 0);
  accepted(session.selectOffer(0));
  assertRejectedUnchanged(session, () => session.selectCell(3, 0), 'INSUFFICIENT_GOLD');
  assertRejectedUnchanged(session, () => session.restart(), 'BAD_PHASE');
  session.cancel();
  accepted(session.selectCell(0, 0));
  assertRejectedUnchanged(session, () => session.selectCell(4, 0), 'BAD_FORMAT');
  accepted(session.start());
  assert.equal(session.selection, null);
  assertRejectedUnchanged(session, () => session.selectOffer(0), 'BAD_PHASE');
  assertRejectedUnchanged(session, () => session.selectCell(1, 0), 'BAD_PHASE');
  assertReplay(session);
});

test('real core: fixed legal public-observation center smoke policy wins', () => {
  const session = runFixture('center');
  const view = session.observe();
  assert.deepEqual({ outcome: view.outcome, tick: view.tick, lives: view.lives, wave: view.wave },
    { outcome: 'win', tick: 970, lives: 9, wave: 5 });
  assert.equal(view.units.length, 4);
  assert.equal(session.selection, null);
  assertReplay(session);
});

test('real core: fixed legal single-corner smoke policy loses', () => {
  const session = runFixture('corner');
  const view = session.observe();
  assert.deepEqual({ outcome: view.outcome, tick: view.tick, lives: view.lives, wave: view.wave },
    { outcome: 'loss', tick: 500, lives: 0, wave: 2 });
  assert.equal(view.units.length, 1);
  assertReplay(session);
});

test('real core: restart archives actual replay and restores identical seed state', () => {
  const session = createSession(1);
  const initial = session.canonical();
  for (const policy of ['center', 'corner'] as const) {
    runFixture(policy, 5, session);
    const hash = assertReplay(session);
    const finalState = session.match.state;
    const record = structuredClone(session.record());
    const count = session.archives.length;
    accepted(session.restart());
    assert.equal(session.canonical(), initial);
    assert.equal(session.match.state.seed, 1);
    assert.deepEqual(session.record().entries, []);
    assert.equal(session.archives.length, count + 1);
    assert.deepEqual(session.archives[count], record);
    const archive = session.archives[count];
    assert.ok(archive);
    const replayed = core.replay(archive.header, archive.entries, hash);
    assert.ok(replayed.ok);
    assert.deepEqual(replayed.state, finalState);
    assert.deepEqual(core.replay(archive.header, archive.entries, '0'.repeat(64)),
      { ok: false, error: { code: 'FINAL_HASH_MISMATCH', entryIndex: null } });
  }
  assert.equal(session.archives.length, 2);
});

test('real core: old match wrapper input and timer cannot affect restarted match', () => {
  const session = runFixture('corner');
  const oldWrapper = session.match;
  const oldState = structuredClone(oldWrapper.state);
  accepted(session.restart());
  assert.notEqual(session.match, oldWrapper);
  accepted(session.selectOffer(0));
  assertRejectedUnchanged(session, () => session.selectCell(1, 1, oldWrapper), 'STALE_INPUT');
  assertRejectedUnchanged(session, () => session.start(oldWrapper), 'STALE_INPUT');
  const state = session.match.state;
  const selection = structuredClone(session.selection);
  assert.equal(session.advance(oldWrapper, 5), undefined);
  assert.equal(session.match.state, state);
  assert.deepEqual(session.selection, selection);
  assert.deepEqual(oldWrapper.state, oldState);
});

test('real core: advance-one and advance-five policies have equal canonical outcomes', () => {
  for (const policy of ['center', 'corner'] as const) {
    const single = runFixture(policy, 1);
    const batched = runFixture(policy, 5);
    assert.equal(single.canonical(), batched.canonical());
    assert.deepEqual(single.observe(), batched.observe());
    assert.equal(assertReplay(single), assertReplay(batched));
    // Scheduling changes accepted advance records, which canonicalState excludes.
    assert.notDeepEqual(single.record().entries, batched.record().entries);
  }
});
