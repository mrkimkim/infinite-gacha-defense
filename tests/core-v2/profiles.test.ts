import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as api from '../../src/core-v2/index.ts';
import type { RuleData, RulesId } from '../../src/core-v2/types.ts';

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}
const profiles = Object.values(api.RULES_PROPOSALS);
function allFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(allFrozen);
}

test('checkpoint exports only honest data, no fabricated engine', () => {
  assert.deepEqual(Object.keys(api).sort(), [
    'CANONICAL_STATE_KEYS', 'EXPERIMENT_RULES_ID', 'RULES_DIGESTS', 'RULES_PROPOSALS', 'SCHEMA_VERSION',
  ]);
  assert.equal(api.SCHEMA_VERSION, 2);
  assert.equal(profiles.length, 4);
  assert.equal(new Set(Object.values(api.RULES_DIGESTS)).size, 4);
});
test('all proposal data are deeply frozen and match pinned whole-data SHA-256', () => {
  allFrozen(api.RULES_PROPOSALS);
  allFrozen(api.RULES_DIGESTS);
  for (const data of profiles) {
    assert.equal(data.status, 'review-proposal');
    assert.equal(createHash('sha256').update(canonical(data)).digest('hex'), api.RULES_DIGESTS[data.rulesId]);
  }
});
test('economy/count factors are the only cross-profile gameplay differences', () => {
  const neutral = (data: RuleData) => {
    const { rulesId, recruitCost, rerollCost, waveReward, countLimit, warningCount, ...rest } = data;
    assert.equal(rulesId.includes('economyA'), recruitCost === 2);
    assert.deepEqual([recruitCost, rerollCost, waveReward], rulesId.includes('economyA') ? [2, 1, 6] : [3, 2, 4]);
    assert.equal(warningCount, countLimit * 80 / 100);
    return rest;
  };
  for (const data of profiles) assert.deepEqual(neutral(data), neutral(profiles[0]));
  assert.equal(api.EXPERIMENT_RULES_ID, 'playable-v2-proposal1-economyA-count40');
});
test('contract economy, XP, roles and growth data are exact', () => {
  const p = profiles[0];
  assert.equal(p.startingGold, 12);
  assert.deepEqual(p.sellGoldByStar, [1, 3, 9]);
  assert.deepEqual(p.starDamagePercent, [100, 220, 484]);
  assert.deepEqual(p.xpThresholds, [0, 8, 24, 48, 80, 120, 168, 224, 288, 360]);
  assert.deepEqual([p.xpRecoveryPercent, p.levelDamageStepPercent], [80, 8]);
  assert.deepEqual([p.board.capacity, p.benchCapacity, p.offerCount], [8, 8, 3]);
  assert.deepEqual(Object.values(p.characters).map(c => [c.damage, c.cooldownTicks, c.range]),
    [[6, 12, 3200], [5, 24, 3000], [3, 10, 2200], [3, 20, 3000], [3, 20, 2800], [10, 30, 4500]]);
  assert.equal(p.characters.nuri.splashRadius, 1100);
  assert.equal(p.characters.ruru.maxTargets, 2);
  assert.equal(p.characters.tori.bossDamagePercent, 200);
  assert.deepEqual(p.slow, { percent: 30, durationTicks: 40 });
  assert.equal(p.supportPeriodPercent, 90);
});
test('all fixed spawn hypotheses have valid deterministic order and deadlines', () => {
  for (const p of profiles) {
    assert.equal(p.waves.length, 20);
    for (const [index, wave] of p.waves.entries()) {
      const w = index + 1;
      const boss = w % 5 === 0;
      assert.equal(wave.wave, w);
      assert.equal(wave.xpBudget, 16 + 2 * w);
      assert.equal(wave.durationTicks, boss ? 600 : 400);
      assert.equal(wave.bossDeadlineWaveTick, boss ? 600 : null);
      assert.equal(wave.spawns.length, 6 + w + Number(boss));
      assert.equal(wave.spawns.filter(s => s.typeId === 'boss').length, Number(boss));
      let previous = 0;
      for (const spawn of wave.spawns) {
        assert.ok(Number.isSafeInteger(spawn.hp) && spawn.hp > 0);
        assert.ok(spawn.atWaveTick >= previous && spawn.atWaveTick <= wave.durationTicks);
        previous = spawn.atWaveTick;
      }
    }
  }
});
test('canonical key proposal has exactly 19 sorted unique keys, no log/lives', () => {
  assert.equal(api.CANONICAL_STATE_KEYS.length, 19);
  assert.equal(new Set(api.CANONICAL_STATE_KEYS).size, 19);
  assert.deepEqual([...api.CANONICAL_STATE_KEYS].sort(), api.CANONICAL_STATE_KEYS);
  assert.ok(!api.CANONICAL_STATE_KEYS.includes('acceptedLog' as never));
  assert.ok(!api.CANONICAL_STATE_KEYS.includes('lives' as never));
});
test('all profile leaves are canonical JSON data with safe integer numbers', () => {
  const inspect = (value: unknown): void => {
    if (typeof value === 'number') assert.ok(Number.isSafeInteger(value));
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(inspect);
    else assert.ok(value === null || typeof value === 'string' || typeof value === 'boolean');
  };
  inspect(api.RULES_PROPOSALS);
  for (const id of Object.keys(api.RULES_PROPOSALS) as RulesId[]) assert.match(api.RULES_DIGESTS[id], /^[a-f0-9]{64}$/);
});

test('proposed PRNG golden vectors include rejection and consumed-step counts (reference math only)', () => {
  // This checks the documented profile algorithm, NOT a nonexistent engine.
  const next = (state: number): number => {
    let x = state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0;
  };
  const draw = (state: number) => {
    let consumed = 0;
    do { state = next(state); consumed += 1; } while (state > 4294967292);
    return { state, consumed, index: (state - 1) % 6 };
  };
  let state = 1;
  const output = [];
  for (let i = 0; i < 6; i += 1) {
    const result = draw(state); state = result.state; output.push(result);
  }
  assert.deepEqual(output, [
    { state: 270369, consumed: 1, index: 2 },
    { state: 67634689, consumed: 1, index: 0 },
    { state: 2647435461, consumed: 1, index: 2 },
    { state: 307599695, consumed: 1, index: 4 },
    { state: 2398689233, consumed: 1, index: 4 },
    { state: 745495504, consumed: 1, index: 3 },
  ]);
  assert.equal(next(1584200935), 4294967295);
  assert.deepEqual(draw(1584200935), { state: 253983, consumed: 2, index: 2 });
  // Boundary rejection uses x-1 < 4294967292, equivalent to x <= 4294967292.
  assert.equal((4294967292 - 1) % 6, 5);
  assert.equal(4294967293 - 1 < 4294967292, false);
});
