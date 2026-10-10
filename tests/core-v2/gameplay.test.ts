import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, createMatch, dispatch, observe, replay, RULES_PROPOSALS, stateHash } from '../../src/core-v2/index.ts';
import type { CombatEvent, Command, MatchState, RulesId } from '../../src/core-v2/types.ts';

/** Deterministic public-observation-only smoke policy, not a gamer/balance model. */
function play(seed: number, rulesId: RulesId, batch: number) {
  const created = createMatch(seed, rulesId); assert.ok(created.ok);
  let state = created.state;
  const events: CombatEvent[] = [];
  const positions = [[1, 1], [2, 2], [0, 0], [3, 3], [3, 0], [0, 3], [1, 0], [2, 3],
    [0, 1], [3, 2], [2, 0], [1, 3], [0, 2], [3, 1], [2, 1], [1, 2]];
  const act = (command: Command) => {
    const accepted = dispatch(state, command); assert.ok(accepted.ok); state = accepted.state;
  };
  while (state.phase !== 'result') {
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const publicView = observe(state);
      const benched = publicView.units.find(u => u.location.kind === 'bench');
      const free = positions.find(([col, row]) => !publicView.units.some(u =>
        u.location.kind === 'board' && u.location.col === col && u.location.row === row));
      if (benched && free) {
        act({ type: 'move', unitId: benched.id, to: { kind: 'board', col: free[0], row: free[1] } }); continue;
      }
      const offer = publicView.offers.find(o => o.recruitPreview.ok);
      if (offer) { act({ type: 'recruit', offerSlot: offer.slot }); continue; }
      const minimumPrice = Math.min(...publicView.rules.rarities.map(r => r.recruitPrice));
      if (publicView.gold >= publicView.rules.rerollCost + minimumPrice && publicView.benchCount < publicView.rules.benchCapacity) {
        act({ type: 'reroll' }); continue;
      }
      break;
    }
    act({ type: 'startWave' });
    while (state.phase === 'combat') {
      const result = advance(state, batch); assert.ok(result.ok);
      events.push(...result.events); state = result.state;
    }
  }
  return { state, events };
}
function roundTrip(state: MatchState): void {
  const result = replay({ schemaVersion: 3, rulesId: state.rulesId, rulesDigest: state.rulesDigest,
    seed: state.seed }, state.acceptedLog, stateHash(state));
  assert.ok(result.ok); assert.equal(stateHash(result.state), stateHash(state));
}
test('real commands reach twenty-wave win in both fixed profiles; final reward once and no final refresh', () => {
  for (const rulesId of Object.keys(RULES_PROPOSALS) as RulesId[]) {
    const result = play(3, rulesId, 1000);
    assert.equal(result.state.outcome, 'win'); assert.equal(result.state.outcomeReason, 'cleared');
    assert.equal(result.state.wave, 20); assert.equal(result.state.tick, 6378);
    assert.equal(result.events.filter(e => e.type === 'waveCompleted').length, 20);
    assert.equal(result.events.filter(e => e.type === 'shopRefreshed').length, 19);
    assert.deepEqual(result.events.slice(-2).map(e => e.type), ['waveCompleted', 'matchEnded']);
    assert.ok(result.state.units.some(u => u.star === 3));
    assert.equal(observe(result.state).boardCount, 16);
    assert.equal(result.state.enemies.length, 0);
    assert.equal(advance(result.state, 1).state, result.state);
    roundTrip(result.state);
  }
});
test('seventeen-tick batches reproduce the entire natural win event trace and final hash', () => {
  const id = Object.keys(RULES_PROPOSALS)[0] as RulesId;
  const full = play(3, id, 1000), split = play(3, id, 17);
  assert.equal(stateHash(split.state), stateHash(full.state));
  assert.deepEqual(split.events, full.events);
  assert.notEqual(split.state.acceptedLog.length, full.state.acceptedLog.length);
  roundTrip(split.state);
});
test('same public smoke policy also records a natural finalTimeout loss with no failed-wave reward', () => {
  const id = Object.keys(RULES_PROPOSALS)[0] as RulesId;
  const result = play(1, id, 1000);
  assert.equal(result.state.outcome, 'loss'); assert.equal(result.state.outcomeReason, 'finalTimeout');
  assert.equal(result.state.wave, 20);
  assert.equal(result.events.filter(e => e.type === 'waveCompleted').length, 19);
  assert.equal(result.events.at(-1)?.type, 'matchEnded');
  assert.ok(result.state.enemies.length > 0);
  roundTrip(result.state);
});
