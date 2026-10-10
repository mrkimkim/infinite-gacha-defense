import type { EnemyTypeId, RuleData, RulesId, WaveDefinition } from './types.ts';

export const SCHEMA_VERSION = 3 as const;
/** Unapproved technical fixture only. No production odds, roster or economics chosen. */
export const EXPERIMENT_RULES_ID: RulesId = 'playable-v2-gen2-fixture1-count40';

/** Excludes acceptedLog: batching/log granularity must not change state hashes. */
export const CANONICAL_STATE_KEYS = Object.freeze([
  'enemies', 'gold', 'nextEntityId', 'offers', 'outcome', 'outcomeReason',
  'phase', 'rngState', 'rulesDigest', 'rulesId', 'schemaVersion', 'seed',
  'spawnCursor', 'tick', 'units', 'wave', 'waveTick',
] as const);

function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

/** These spawn details are hypotheses awaiting both independent DOT reviews. */
function proposedWaves(): WaveDefinition[] {
  return Array.from({ length: 20 }, (_, index) => {
    const wave = index + 1;
    const boss = wave % 5 === 0;
    const basicHp = 12 + 4 * wave + Math.floor(wave * wave / 4);
    const spawns: { atWaveTick: number; typeId: EnemyTypeId; hp: number }[] =
      Array.from({ length: 6 + wave }, (_, spawnIndex) => {
        // Stable three-role cycle; same composition across both fixture profiles.
        const typeId: EnemyTypeId = spawnIndex % 3 === 1 ? 'swift'
          : spawnIndex % 3 === 2 ? 'sturdy' : 'basic';
        const hp = typeId === 'swift' ? Math.max(1, Math.floor(basicHp * 70 / 100))
          : typeId === 'sturdy' ? Math.floor(basicHp * 160 / 100) : basicHp;
        return { atWaveTick: 1 + 12 * spawnIndex, typeId, hp };
      });
    // Boss allocated first at tick1; the ordinary spawn at tick1 follows it.
    if (boss) spawns.unshift({ atWaveTick: 1, typeId: 'boss', hp: 120 + 40 * wave });
    return { wave, durationTicks: boss ? 600 : 400,
      bossDeadlineWaveTick: boss ? 600 : null, spawns };
  });
}

function profile(limit: 40 | 80): RuleData {
  return freezeTree<RuleData>({
    schemaVersion: 3,
    rulesId: `playable-v2-gen2-fixture1-count${limit}`,
    status: 'unapproved-fixture', tickMs: 50, waveCount: 20, startingGold: 12,
    rerollCost: 1, waveReward: 6, offerCount: 3,
    board: { columns: 4, rows: 4, tileSize: 1000 }, benchCapacity: 8,
    footprintByStar: [{ width: 1, height: 1 }, { width: 1, height: 1 }, { width: 1, height: 1 }],
    countLimit: limit, warningCount: limit === 40 ? 32 : 64,
    rarities: [
      { id: 'common', label: '일반', offerWeight: 500, recruitPrice: 2, sellGoldByStar: [1, 3, 9] },
      { id: 'uncommon', label: '고급', offerWeight: 250, recruitPrice: 3, sellGoldByStar: [1, 3, 9] },
      { id: 'rare', label: '희귀', offerWeight: 150, recruitPrice: 4, sellGoldByStar: [2, 6, 18] },
      { id: 'epic', label: '영웅', offerWeight: 75, recruitPrice: 5, sellGoldByStar: [2, 6, 18] },
      { id: 'legendary', label: '전설', offerWeight: 25, recruitPrice: 6, sellGoldByStar: [3, 9, 27] },
    ],
    starDamagePercent: [100, 220, 484],
    synergyPercentByDistinctCount: [0, 0, 5, 10],
    slow: { percent: 30, durationTicks: 40 }, supportPeriodPercent: 90,
    // Explicit v2 geometry proposal, not an implicit v1 dependency.
    path: { length: 20000, vertices: [
      { x: -500, y: -500 }, { x: 4500, y: -500 },
      { x: 4500, y: 4500 }, { x: -500, y: 4500 },
    ] },
    characters: [
      { id: 'fixture-01', label: '기술 기물 01', rarityId: 'common', tag: 'focus', damage: 6, cooldownTicks: 12, range: 3200,
        behavior: 'single', maxTargets: 1, splashRadius: 0, bossDamagePercent: 100 },
      { id: 'fixture-02', label: '기술 기물 02', rarityId: 'rare', tag: 'cooperation', damage: 5, cooldownTicks: 24, range: 3000,
        behavior: 'splash', maxTargets: null, splashRadius: 1100, bossDamagePercent: 100 },
      { id: 'fixture-03', label: '기술 기물 03', rarityId: 'uncommon', tag: 'focus', damage: 3, cooldownTicks: 10, range: 2200,
        behavior: 'multi', maxTargets: 2, splashRadius: 0, bossDamagePercent: 100 },
      { id: 'fixture-04', label: '기술 기물 04', rarityId: 'common', tag: 'cooperation', damage: 3, cooldownTicks: 20, range: 3000,
        behavior: 'slow', maxTargets: 1, splashRadius: 0, bossDamagePercent: 100 },
      { id: 'fixture-05', label: '기술 기물 05', rarityId: 'epic', tag: 'cooperation', damage: 3, cooldownTicks: 20, range: 2800,
        behavior: 'support', maxTargets: 1, splashRadius: 0, bossDamagePercent: 100 },
      { id: 'fixture-06', label: '기술 기물 06', rarityId: 'legendary', tag: 'focus', damage: 10, cooldownTicks: 30, range: 4500,
        behavior: 'bossFirst', maxTargets: 1, splashRadius: 0, bossDamagePercent: 200 },
      { id: 'fixture-07', label: '기술 기물 07', rarityId: 'uncommon', tag: 'focus',
        damage: 6, cooldownTicks: 12, range: 3200, behavior: 'single', maxTargets: 1,
        splashRadius: 0, bossDamagePercent: 100 },
      { id: 'fixture-08', label: '기술 기물 08', rarityId: 'rare', tag: 'cooperation',
        damage: 5, cooldownTicks: 24, range: 3000, behavior: 'splash', maxTargets: null,
        splashRadius: 1100, bossDamagePercent: 100 },
    ],
    enemySpeed: { basic: 70, swift: 110, sturdy: 45, boss: 55 },
    waves: proposedWaves(),
    shopSampling: { algorithm: 'rarity-weight-then-uniform-definition', weightTotal: 1000,
      rarityOrder: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      withinRarityOrder: 'profile-character-order', drawsForSingleton: true },
    autoUpgrade: { materialCount: 3, maxStar: 3, starOrder: [1, 2],
      materialOrder: 'ascending-identity', placement: 'oldest-board-else-lowest-material-bench',
      newRecruitPlacement: 'transient-until-stable', loneRecruitPlacement: 'lowest-empty-bench',
      cooldown: 'max-material-remainder' },
    prng: { algorithm: 'xorshift32', shifts: [13, 17, 5], seedMin: 1,
      seedMax: 4294967295, sampling: 'nonzero-domain-rejection-uniform' },
    semantics: {
      revision: 'playable-v2-generation2-api-fixture1',
      tickOrder: ['incrementClocks', 'expireEffects', 'spawn', 'unitAttacksAndDeaths',
        'move', 'accumulationLoss', 'deadlineLoss', 'successRewards'],
      targetOrder: ['totalDistanceDescending', 'enemyIdAscending'],
      hitOrder: 'targetPrioritySnapshot', rangeBoundary: 'inclusiveSquaredDistance',
      slowRounding: 'floorBaseSpeedTimes70Over100',
    },
  });
}

export const RULES_PROPOSALS: Readonly<Record<RulesId, RuleData>> = freezeTree({
  'playable-v2-gen2-fixture1-count40': profile(40),
  'playable-v2-gen2-fixture1-count80': profile(80),
});

/** Full fixed RuleData canonical UTF-8 JSON SHA-256; never hash runtime overrides. */
export const RULES_DIGESTS: Readonly<Record<RulesId, string>> = Object.freeze({
  'playable-v2-gen2-fixture1-count40': '83462afeda2fe1756f130669f4b77af45c518390c04248d1d006909fb911c886',
  'playable-v2-gen2-fixture1-count80': 'f4f82d384a0a0774eefb75b9b7428cee45564749d815f0df3d3964ba64ba63d2',
});
