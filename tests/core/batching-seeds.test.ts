import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, dispatch, advance, canonicalState, stateHash, replay } from '../../src/core/index.ts';
import type { CombatEvent, MatchState, ReplayHeader } from '../../src/core/index.ts';

function start(state: MatchState): MatchState {
  const result = dispatch(state, { type: 'startWave' });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('wave start rejected');
  return result.state;
}

test('20 fixed seeds: per-wave batch/one-tick bytes, event traces and final replay agree', () => {
  let wins = 0, losses = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const created = createMatch(seed);
    if (!created.ok) throw new Error('seed rejected');
    let batch = created.state;
    for (let j = 0; j < 3; j++) {
      const result = dispatch(batch, { type: 'recruit', offerSlot: j,
        to: { kind: 'board', col: (seed + j) % 4, row: (seed * 3 + j) % 4 } });
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error('recruit rejected');
      batch = result.state;
    }
    let single = batch;
    while (batch.phase !== 'result') {
      batch = start(batch); single = start(single);
      const bulk = advance(batch, 10000);
      assert.equal(bulk.ok, true);
      if (!bulk.ok) throw new Error('advance rejected');
      const events: CombatEvent[] = [];
      let ticks = 0;
      while (single.phase === 'combat') {
        const step = advance(single, 1);
        assert.equal(step.ok, true);
        if (!step.ok) throw new Error('single advance rejected');
        events.push(...step.events); ticks += step.executedTicks; single = step.state;
      }
      batch = bulk.state;
      assert.equal(ticks, bulk.executedTicks, `seed ${seed}`);
      assert.deepEqual(events, bulk.events, `seed ${seed} event trace`);
      assert.equal(canonicalState(batch), canonicalState(single), `seed ${seed} boundary`);
    }
    if (batch.outcome === 'win') wins++; else losses++;
    const header: ReplayHeader = { schemaVersion: batch.schemaVersion, rulesId: batch.rulesId,
      rulesDigest: batch.rulesDigest, seed };
    for (const state of [batch, single]) {
      const result = replay(header, state.acceptedLog, stateHash(state));
      assert.equal(result.ok, true, `seed ${seed} replay`);
      if (result.ok) assert.deepEqual(result.state, state);
    }
  }
  // A deterministic regression snapshot, not a gameplay or balance acceptance threshold.
  assert.equal(wins, 7); assert.equal(losses, 13);
});
