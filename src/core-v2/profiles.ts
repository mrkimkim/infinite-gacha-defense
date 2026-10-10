import type { CharacterId, EnemyTypeId, RuleData, RulesId, WaveDefinition } from './types.ts';

export const SCHEMA_VERSION = 2 as const;
/** Functional-wiring experiment only. No production default has been selected. */
export const EXPERIMENT_RULES_ID: RulesId = 'playable-v2-proposal1-economyA-count40';

/** Excludes acceptedLog: batching/log granularity must not change state hashes. */
export const CANONICAL_STATE_KEYS = Object.freeze([
  'books', 'enemies', 'gold', 'nextEntityId', 'offers', 'outcome', 'outcomeReason',
  'phase', 'rngState', 'rulesDigest', 'rulesId', 'schemaVersion', 'seed',
  'spawnCursor', 'tick', 'units', 'wave', 'waveParticipants', 'waveTick',
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
        // Stable three-role cycle; same composition across all four profiles.
        const typeId: EnemyTypeId = spawnIndex % 3 === 1 ? 'swift'
          : spawnIndex % 3 === 2 ? 'sturdy' : 'basic';
        const hp = typeId === 'swift' ? Math.max(1, Math.floor(basicHp * 70 / 100))
          : typeId === 'sturdy' ? Math.floor(basicHp * 160 / 100) : basicHp;
        return { atWaveTick: 1 + 12 * spawnIndex, typeId, hp };
      });
    // Boss allocated first at tick1; the ordinary spawn at tick1 follows it.
    if (boss) spawns.unshift({ atWaveTick: 1, typeId: 'boss', hp: 120 + 40 * wave });
    return { wave, durationTicks: boss ? 600 : 400,
      bossDeadlineWaveTick: boss ? 600 : null, xpBudget: 16 + 2 * wave, spawns };
  });
}

function profile(economy: 'A' | 'B', limit: 40 | 80): RuleData {
  return freezeTree<RuleData>({
    schemaVersion: 2,
    rulesId: `playable-v2-proposal1-economy${economy}-count${limit}`,
    status: 'review-proposal', tickMs: 50, waveCount: 20, startingGold: 12,
    recruitCost: economy === 'A' ? 2 : 3, rerollCost: economy === 'A' ? 1 : 2,
    waveReward: economy === 'A' ? 6 : 4, offerCount: 3,
    board: { columns: 4, rows: 4, tileSize: 1000, capacity: 8 }, benchCapacity: 8,
    countLimit: limit, warningCount: limit === 40 ? 32 : 64,
    sellGoldByStar: [1, 3, 9], xpRecoveryPercent: 80,
    starDamagePercent: [100, 220, 484], levelDamageStepPercent: 8,
    xpThresholds: [0, 8, 24, 48, 80, 120, 168, 224, 288, 360],
    synergyPercentByDistinctCount: [0, 0, 5, 10],
    slow: { percent: 30, durationTicks: 40 }, supportPeriodPercent: 90,
    // Explicit v2 geometry proposal, not an implicit v1 dependency.
    path: { length: 20000, vertices: [
      { x: -500, y: -500 }, { x: 4500, y: -500 },
      { x: 4500, y: 4500 }, { x: -500, y: 4500 },
    ] },
    characters: {
      popo: { tag: 'focus', damage: 6, cooldownTicks: 12, range: 3200,
        behavior: 'single', maxTargets: 1, splashRadius: 0, bossDamagePercent: 100 },
      nuri: { tag: 'cooperation', damage: 5, cooldownTicks: 24, range: 3000,
        behavior: 'splash', maxTargets: null, splashRadius: 1100, bossDamagePercent: 100 },
      ruru: { tag: 'focus', damage: 3, cooldownTicks: 10, range: 2200,
        behavior: 'multi', maxTargets: 2, splashRadius: 0, bossDamagePercent: 100 },
      dodo: { tag: 'cooperation', damage: 3, cooldownTicks: 20, range: 3000,
        behavior: 'slow', maxTargets: 1, splashRadius: 0, bossDamagePercent: 100 },
      momo: { tag: 'cooperation', damage: 3, cooldownTicks: 20, range: 2800,
        behavior: 'support', maxTargets: 1, splashRadius: 0, bossDamagePercent: 100 },
      tori: { tag: 'focus', damage: 10, cooldownTicks: 30, range: 4500,
        behavior: 'bossFirst', maxTargets: 1, splashRadius: 0, bossDamagePercent: 200 },
    },
    enemySpeed: { basic: 70, swift: 110, sturdy: 45, boss: 55 },
    waves: proposedWaves(),
    prng: { algorithm: 'xorshift32', shifts: [13, 17, 5], seedMin: 1,
      seedMax: 4294967295, offerMapping: [
        'popo', 'nuri', 'ruru', 'dodo', 'momo', 'tori',
      ] satisfies CharacterId[], sampling: 'rejection-uniform' },
    semantics: {
      revision: 'playable-v2-api-proposal1',
      tickOrder: ['incrementClocks', 'expireEffects', 'spawn', 'unitAttacksAndDeaths',
        'move', 'accumulationLoss', 'deadlineLoss', 'successRewards'],
      targetOrder: ['totalDistanceDescending', 'enemyIdAscending'],
      hitOrder: 'targetPrioritySnapshot', rangeBoundary: 'inclusiveSquaredDistance',
      slowRounding: 'floorBaseSpeedTimes70Over100',
    },
  });
}

export const RULES_PROPOSALS: Readonly<Record<RulesId, RuleData>> = freezeTree({
  'playable-v2-proposal1-economyA-count40': profile('A', 40),
  'playable-v2-proposal1-economyA-count80': profile('A', 80),
  'playable-v2-proposal1-economyB-count40': profile('B', 40),
  'playable-v2-proposal1-economyB-count80': profile('B', 80),
});

/** SHA-256 of UTF-8 canonical JSON of the entire corresponding RuleData. */
export const RULES_DIGESTS: Readonly<Record<RulesId, string>> = Object.freeze({
  'playable-v2-proposal1-economyA-count40': '6ce864fd07b9b3892e3c2026dd8cdb6cb67cfbb49cb45518ee6aaeb9293fe4c9',
  'playable-v2-proposal1-economyA-count80': 'db62325b9c2d19ea1c7a92fa90ba59c00d77b41bb168ed888696d215e54dacaa',
  'playable-v2-proposal1-economyB-count40': '694afd3527e21b283994b4659b9de2f997edaef7d1e59ded840d552cc5973a4e',
  'playable-v2-proposal1-economyB-count80': '0513956e1bd5bf2ae48b082d7ff640a821c037bcf644d0b7fd88debe2ff5c557',
});
