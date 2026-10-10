import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as api from '../../src/core-v2/index.ts';
import type { RuleData, RulesId } from '../../src/core-v2/types.ts';
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(k => `${JSON.stringify(k)}:${canonical(object[k])}`).join(',')}}`;
}
const profiles = Object.values(api.RULES_PROPOSALS);
function frozen(value: unknown): void {
  if (value !== null && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
test('schema3 entry exports the approved engine and no schema2 profile IDs', () => {
  assert.deepEqual(Object.keys(api).sort(), ['CANONICAL_STATE_KEYS', 'EXPERIMENT_RULES_ID', 'RULES_DIGESTS', 'RULES_PROPOSALS', 'SCHEMA_VERSION',
    'advance', 'boardPosition', 'canonicalState', 'createMatch', 'dispatch', 'getRules',
    'observe', 'pathPosition', 'previewRecruit', 'replay', 'stateHash']);
  assert.equal(api.SCHEMA_VERSION, 3); assert.equal(profiles.length, 2);
  for (const p of profiles) { assert.equal(p.schemaVersion, 3); assert.match(p.rulesId, /^playable-v2-gen2-fixture1-count(40|80)$/); }
});
test('entire immutable profile data match independent SHA256 digests', () => {
  frozen(api.RULES_PROPOSALS); frozen(api.RULES_DIGESTS);
  for (const p of profiles) {
    assert.equal(p.status, 'unapproved-fixture');
    assert.equal(createHash('sha256').update(canonical(p)).digest('hex'), api.RULES_DIGESTS[p.rulesId]);
  }
  assert.equal(new Set(Object.values(api.RULES_DIGESTS)).size, 2);
});
test('five rarity definitions and eight neutral roster fixtures are data-driven and internally complete', () => {
  for (const p of profiles) {
    assert.deepEqual(p.rarities.map(r => r.id), ['common', 'uncommon', 'rare', 'epic', 'legendary']);
    assert.deepEqual(p.rarities.map(r => r.label), ['일반', '고급', '희귀', '영웅', '전설']);
    assert.equal(p.rarities.reduce((sum, r) => sum + r.offerWeight, 0), p.shopSampling.weightTotal);
    assert.equal(p.characters.length, 8); assert.equal(new Set(p.characters.map(c => c.id)).size, 8);
    for (const rarity of p.rarities) {
      assert.ok(rarity.offerWeight > 0 && Number.isSafeInteger(rarity.offerWeight));
      assert.ok(p.characters.some(c => c.rarityId === rarity.id));
      assert.ok(rarity.recruitPrice > 0);
      rarity.sellGoldByStar.forEach((price, starIndex) => assert.ok(price <= rarity.recruitPrice * 3 ** starIndex));
    }
    for (const c of p.characters) assert.ok(p.rarities.some(r => r.id === c.rarityId));
    assert.deepEqual(p.shopSampling.rarityOrder, p.rarities.map(r => r.id));
    assert.equal(p.shopSampling.drawsForSingleton, true);
  }
});
test('only physical board space, bench8 and explicit one-cell footprint; no removed growth fields', () => {
  const forbidden = new Set(['xp', 'level', 'books', 'xpBudget', 'xpRecoveryPercent', 'xpThresholds',
    'levelDamageStepPercent', 'waveParticipants', 'recruitCost', 'capacity']);
  function inspect(value: unknown): void {
    if (value !== null && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.has(key), key); inspect(child);
    }
  }
  for (const p of profiles) {
    inspect(p); assert.deepEqual(p.board, { columns: 4, rows: 4, tileSize: 1000 });
    assert.equal(p.benchCapacity, 8);
    assert.deepEqual(p.footprintByStar, Array.from({ length: 3 }, () => ({ width: 1, height: 1 })));
    assert.equal(p.autoUpgrade.materialCount, 3); assert.deepEqual(p.autoUpgrade.starOrder, [1, 2]);
    assert.equal(p.autoUpgrade.newRecruitPlacement, 'transient-until-stable');
    assert.equal(p.autoUpgrade.placement, 'oldest-board-else-lowest-material-bench');
  }
});
test('two fixture limits differ only in identity and count/warning thresholds', () => {
  const neutral = (p: RuleData) => { const { rulesId, countLimit, warningCount, ...rest } = p;
    assert.match(rulesId, new RegExp(`count${countLimit}$`)); assert.equal(warningCount, countLimit * 80 / 100); return rest; };
  assert.deepEqual(neutral(profiles[0]), neutral(profiles[1]));
});
test('six behavior roles remain fixture data and four same-tag definitions can exercise capped tier3', () => {
  const p = profiles[0];
  assert.deepEqual(p.characters.slice(0, 6).map(c => [c.damage, c.cooldownTicks, c.range]),
    [[6, 12, 3200], [5, 24, 3000], [3, 10, 2200], [3, 20, 3000], [3, 20, 2800], [10, 30, 4500]]);
  assert.equal(new Set(p.characters.map(c => c.behavior)).size, 6);
  assert.equal(p.characters.filter(c => c.tag === 'focus').length, 4);
  assert.equal(p.characters.filter(c => c.tag === 'cooperation').length, 4);
});
test('all unapproved schedule fixtures are deterministic and leave a cleanup window', () => {
  for (const p of profiles) {
    assert.equal(p.waves.length, p.waveCount);
    for (const wave of p.waves) {
      const boss = wave.wave % 5 === 0;
      assert.equal(wave.durationTicks, boss ? 600 : 400);
      assert.equal(wave.bossDeadlineWaveTick, boss ? 600 : null);
      assert.equal(wave.spawns.length, 6 + wave.wave + Number(boss));
      assert.equal(wave.spawns.filter(s => s.typeId === 'boss').length, Number(boss));
      let previous = 0;
      for (const spawn of wave.spawns) {
        assert.ok(spawn.atWaveTick >= previous && spawn.atWaveTick < wave.durationTicks);
        assert.ok(Number.isSafeInteger(spawn.hp) && spawn.hp > 0); previous = spawn.atWaveTick;
      }
    }
  }
});
test('canonical17 for schema3 removes books/participants without reusing the v1 projection', () => {
  assert.equal(api.CANONICAL_STATE_KEYS.length, 17);
  assert.equal(new Set(api.CANONICAL_STATE_KEYS).size, 17);
  assert.deepEqual([...api.CANONICAL_STATE_KEYS].sort(), api.CANONICAL_STATE_KEYS);
  assert.ok(api.CANONICAL_STATE_KEYS.includes('outcomeReason'));
  for (const absent of ['lives', 'books', 'waveParticipants', 'acceptedLog']) assert.ok(!api.CANONICAL_STATE_KEYS.includes(absent as never));
});
test('all fixture leaves are JSON with safe integer numbers and pinned lowercase hashes', () => {
  const inspect = (v: unknown): void => {
    if (typeof v === 'number') assert.ok(Number.isSafeInteger(v));
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(inspect);
    else assert.ok(v === null || typeof v === 'string' || typeof v === 'boolean');
  }; inspect(api.RULES_PROPOSALS);
  for (const id of Object.keys(api.RULES_PROPOSALS) as RulesId[]) assert.match(api.RULES_DIGESTS[id], /^[a-f0-9]{64}$/);
});

test('weighted shop reference vectors pin two draws per offer, including singleton and rejection (not engine)', () => {
  const p = profiles[0];
  const next = (state: number) => { let x = state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
  const shop = (seed: number) => {
    let state = seed, draws = 0;
    const uniform = (size: number) => {
      const bound = Math.floor(4294967295 / size) * size;
      do { state = next(state); draws += 1; } while (state > bound);
      return (state - 1) % size;
    };
    const offers = Array.from({ length: 3 }, () => {
      let value = uniform(p.shopSampling.weightTotal);
      const rarity = p.rarities.find(r => { if (value < r.offerWeight) return true; value -= r.offerWeight; return false; })!;
      const pool = p.characters.filter(c => c.rarityId === rarity.id);
      return pool[uniform(pool.length)].id;
    });
    return { state, draws, offers };
  };
  assert.deepEqual(shop(1), { state: 745495504, draws: 6, offers: ['fixture-01', 'fixture-01', 'fixture-04'] });
  // First rarity draw rejects4294967295, then accepts253983→bucket982/legendary.
  // Singleton definition selection still consumes4228382207 as its own draw.
  const special = shop(1584200935);
  assert.equal(special.offers[0], 'fixture-06'); assert.equal(special.draws, 7);
});
