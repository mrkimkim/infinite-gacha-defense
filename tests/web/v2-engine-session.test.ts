import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../../src/core-v2/index.ts';
import type { CombatEvent, PlanRef, RulesId } from '../../src/core-v2/index.ts';
import { createV2Session } from '../../src/web/v2-session.ts';
import type { V2Session } from '../../src/web/v2-session.ts';

// Actual unmodified core only: no injected fake API, no constructed/mutated state.
// Public-observation smoke policy is not browser, human-play, or balance evidence.
const rulesId: RulesId = 'playable-v2-gen2-fixture1-count40';
const positions = [[1, 1], [2, 2], [0, 0], [3, 3], [3, 0], [0, 3], [1, 0], [2, 3],
  [0, 1], [3, 2], [2, 0], [1, 3], [0, 2], [3, 1], [2, 1], [1, 2]] as const;

function prepare(session: V2Session): number[] {
  const upgrades: number[] = [];
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const view = session.observe();
    assert.equal(view.phase, 'preparation');
    const benched = view.units.find(u => u.location.kind === 'bench');
    const free = positions.find(([col, row]) => !view.units.some(u =>
      u.location.kind === 'board' && u.location.col === col && u.location.row === row));
    if (benched && free) {
      session.cancel();
      assert.ok(session.selectLocation(benched.location).ok);
      assert.ok(session.selectLocation({ kind: 'board', col: free[0], row: free[1] }).ok);
      assert.equal(session.selection, null);
      continue;
    }
    const offer = view.offers.find(o => o.recruitPreview.ok);
    if (offer) {
      const preview = offer.recruitPreview;
      assert.ok(preview.ok);
      const state = session.match.state;
      const before = session.canonical();
      // Repeated preview and offer inspection allocate no IDs or accepted log entries.
      assert.deepEqual(core.previewRecruit(state, offer.slot), preview);
      assert.ok(session.selectOffer(offer.slot).ok);
      assert.equal(session.match.state, state);
      assert.equal(session.canonical(), before);
      const bought = session.recruitSelected();
      assert.ok(bought.ok);
      const event = bought.events.find(e => e.type === 'recruited');
      assert.ok(event);
      const resolve = (ref: PlanRef): number => ref.kind === 'existing' ? ref.unitId
        : ref.creationIndex === 0 ? event.arrival.id : event.upgrades[ref.creationIndex - 1]!.result.id;
      assert.equal(event.result.id, resolve(preview.result.ref));
      assert.deepEqual(session.selection, { kind: 'unit', id: event.result.id });
      assert.equal(session.observe().gold, preview.goldAfter);
      assert.equal(event.upgrades.length, preview.upgrades.length);
      preview.upgrades.forEach((planned, i) => {
        assert.deepEqual(event.upgrades[i]!.consumedIds, planned.consumed.map(resolve));
        assert.equal(event.upgrades[i]!.result.id, resolve(planned.result.ref));
      });
      assert.deepEqual(session.match.state.units, preview.finalUnits.map(({ ref, ...unit }) =>
        ({ id: resolve(ref), ...unit })));
      assert.ok(session.observe().units.some(u => u.id === event.result.id));
      upgrades.push(...event.upgrades.map(u => u.result.star));
      continue;
    }
    const minimumPrice = Math.min(...view.rules.rarities.map(r => r.recruitPrice));
    if (view.gold >= view.rules.rerollCost + minimumPrice && view.benchCount < view.rules.benchCapacity) {
      assert.ok(session.reroll().ok); continue;
    }
    return upgrades;
  }
  assert.fail('Preparation policy failed to settle within its action guard');
}
function play(session: V2Session) {
  const events: CombatEvent[] = [];
  const upgrades: number[] = [];
  for (let segment = 0; segment < 20 && session.observe().phase !== 'result'; segment += 1) {
    upgrades.push(...prepare(session));
    assert.ok(session.start().ok);
    const unit = session.observe().units[0]!;
    assert.ok(session.selectLocation(unit.location).ok);
    const before = session.match.state;
    const selected = session.selection;
    assert.deepEqual(session.reroll(), { ok: false, code: 'BAD_PHASE' });
    assert.equal(session.match.state, before);
    assert.deepEqual(session.selection, selected);
    while (session.observe().phase === 'combat') {
      const result = session.advance(session.match, 1000);
      assert.ok(result);
      assert.ok(result.executedTicks > 0);
      events.push(...result.events);
    }
    assert.equal(session.selection, null);
  }
  assert.equal(session.observe().phase, 'result');
  return { events, upgrades };
}
function verifyReplay(session: V2Session): string {
  const record = session.record();
  const replay = core.replay(record.header, record.entries, record.finalHash);
  assert.ok(replay.ok);
  assert.equal(core.canonicalState(replay.state), session.canonical());
  assert.equal(core.stateHash(replay.state), record.finalHash);
  return record.finalHash;
}

test('actual core session rejects invalid/poor inputs without state/log/selection changes', () => {
  const session = createV2Session(3, rulesId, core);
  assert.deepEqual(session.start(), { ok: false, code: 'NO_BOARD_UNITS' });
  assert.deepEqual(session.restart(), { ok: false, code: 'BAD_PHASE' });
  assert.deepEqual(session.selectOffer(99), { ok: false, code: 'BAD_SLOT' });
  assert.deepEqual(session.sell(999), { ok: false, code: 'UNIT_NOT_FOUND' });
  assert.equal(session.match.state.acceptedLog.length, 0);
  const offer = session.observe().offers.find(o => o.recruitPreview.ok)!;
  assert.ok(session.selectOffer(offer.slot).ok);
  assert.ok(session.recruitSelected().ok);
  const before = session.match.state;
  const selection = session.selection;
  assert.deepEqual(session.selectLocation({ kind: 'board', col: -1, row: 0 }),
    { ok: false, code: 'BAD_LOCATION' });
  assert.equal(session.match.state, before);
  assert.deepEqual(session.selection, selection);
  assert.deepEqual(session.selectOffer(offer.slot), { ok: false, code: 'OFFER_EMPTY' });
  for (let i = 0; session.observe().gold >= session.observe().rules.rerollCost && i < 20; i += 1) {
    assert.ok(session.reroll().ok);
  }
  const expensive = session.observe().offers.find(o => o.definitionId !== null)!;
  assert.ok(session.selectOffer(expensive.slot).ok);
  const poor = session.match.state;
  assert.deepEqual(session.recruitSelected(), { ok: false, code: 'INSUFFICIENT_GOLD' });
  assert.equal(session.match.state, poor);
  assert.deepEqual(session.selection, { kind: 'offer', slot: expensive.slot });
  verifyReplay(session);
});

test('actual seed 3 session reaches wave 20 win, upgrades, archives, replays, and repeats identically', t => {
  const session = createV2Session(3, rulesId, core);
  const initial = session.canonical();
  const first = play(session);
  assert.equal(session.observe().outcome, 'win');
  assert.equal(session.observe().outcomeReason, 'cleared');
  assert.equal(session.observe().wave, 20);
  assert.equal(session.observe().tick, 6378);
  assert.ok(first.upgrades.includes(2));
  assert.ok(first.upgrades.includes(3));
  assert.equal(first.events.filter(e => e.type === 'waveCompleted').length, 20);
  assert.equal(first.events.filter(e => e.type === 'shopRefreshed').length, 19);
  const hash = verifyReplay(session);
  const retired = session.match;
  const old = retired.state;
  const record = session.record();
  assert.ok(session.restart().ok);
  assert.notEqual(session.match, retired);
  assert.equal(retired.state, old);
  assert.equal(session.canonical(), initial);
  assert.deepEqual(session.archives, [record]);
  const replay = core.replay(session.archives[0]!.header, session.archives[0]!.entries, hash);
  assert.ok(replay.ok);
  assert.equal(core.stateHash(replay.state), hash);
  const fresh = session.match.state;
  assert.deepEqual(session.start(retired), { ok: false, code: 'STALE_INPUT' });
  assert.deepEqual(session.recruitSelected(retired), { ok: false, code: 'STALE_INPUT' });
  assert.equal(session.advance(retired, 1), undefined);
  assert.equal(session.match.state, fresh);
  const second = play(session);
  assert.deepEqual(second, first);
  assert.equal(verifyReplay(session), hash);
  assert.deepEqual(session.record(), record);
  t.diagnostic(JSON.stringify({ seed: 3, rulesId, outcome: 'win', tick: old.tick,
    upgrades: first.upgrades.length, finalHash: hash, acceptedEntries: record.entries.length }));
});

test('actual seed 1 session reaches natural wave 20 finalTimeout loss and replays', t => {
  const session = createV2Session(1, rulesId, core);
  const result = play(session);
  assert.equal(session.observe().outcome, 'loss');
  assert.equal(session.observe().outcomeReason, 'finalTimeout');
  assert.equal(session.observe().wave, 20);
  assert.equal(result.events.filter(e => e.type === 'waveCompleted').length, 19);
  const hash = verifyReplay(session);
  t.diagnostic(JSON.stringify({ seed: 1, rulesId, outcome: 'loss', reason: 'finalTimeout',
    tick: session.observe().tick, finalHash: hash }));
});

for (const rulesId of ['playable-v2-gen2-fixture1-count40', 'playable-v2-gen2-fixture1-count80'] as const) {
  test(`${rulesId}: exhausted preparation restarts with exact replay archive and stale-owner protection`, () => {
    const session = createV2Session(1, rulesId, core);
    for (let i = 0; i < 12; i++) assert.ok(session.reroll().ok);
    assert.equal(session.observe().gold, 0);
    assert.equal(session.observe().units.length, 0);
    assert.deepEqual(session.start(), { ok: false, code: 'NO_BOARD_UNITS' });
    assert.ok(session.observe().offers.every(o => !o.recruitPreview.ok));
    session.selectOffer(0);
    const oldOwner = session.match;
    const record = session.record();
    assert.ok(session.restart(oldOwner).ok);
    assert.deepEqual(session.archives, [record]);
    assert.ok(core.replay(record.header, record.entries, record.finalHash).ok);
    assert.equal(session.observe().gold, 12);
    assert.equal(session.observe().wave, 1);
    assert.equal(session.match.state.tick, 0);
    assert.equal(session.selection, null);
    assert.equal(session.record().entries.length, 0);
    assert.deepEqual(session.restart(oldOwner), { ok: false, code: 'STALE_INPUT' });
    assert.deepEqual(session.reroll(oldOwner), { ok: false, code: 'STALE_INPUT' });
    assert.equal(session.advance(oldOwner, 1), undefined);
    assert.deepEqual(session.restart(), { ok: false, code: 'BAD_PHASE' });
    assert.equal(session.archives.length, 1);
    assert.ok(session.selectOffer(0).ok);
    assert.ok(session.recruitSelected().ok);
    assert.ok(session.selectLocation({ kind: 'board', col: 0, row: 0 }).ok);
    assert.ok(session.start().ok);
    assert.deepEqual(session.restart(), { ok: false, code: 'BAD_PHASE' });
  });
}
