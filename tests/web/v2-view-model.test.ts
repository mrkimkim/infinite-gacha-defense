import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicRules, RecruitPreview } from '../../src/core-v2/index.ts';
import {
  definitionLabel, rarityLabel, unitAccessibleLabel, locationLabel, planRefLabel,
  recruitPreviewLabel, ticksLabel,
} from '../../src/web/v2-view.ts';

// Explicit presentation mocks only. These do not execute or reproduce an engine,
// planner, spawn schedule, economy, random sampling, or browser layout.
const rules = {
  benchCapacity: 8,
  characters: [{ id: 'mock-added-ninth', label: '테스트 새 기물', rarityId: 'epic',
    tag: 'focus', damage: 123, cooldownTicks: 19, range: 2345, behavior: 'single',
    maxTargets: 1, splashRadius: 0, bossDamagePercent: 100 }],
  rarities: [
    { id: 'common', label: '일반 표시', offerWeight: 1, recruitPrice: 1, sellGoldByStar: [1, 2, 3] },
    { id: 'uncommon', label: '고급 표시', offerWeight: 1, recruitPrice: 2, sellGoldByStar: [1, 2, 3] },
    { id: 'rare', label: '희귀 표시', offerWeight: 1, recruitPrice: 3, sellGoldByStar: [1, 2, 3] },
    { id: 'epic', label: '영웅 표시', offerWeight: 1, recruitPrice: 4, sellGoldByStar: [1, 2, 3] },
    { id: 'legendary', label: '전설 표시', offerWeight: 1, recruitPrice: 5, sellGoldByStar: [1, 2, 3] },
  ],
} as const satisfies Pick<PublicRules, 'characters' | 'rarities' | 'benchCapacity'>;

const chainPreview = {
  ok: true, offerSlot: 2, price: 13, goldAfter: 987,
  arrival: { ref: { kind: 'created', creationIndex: 0 }, definitionId: 'mock-added-ninth', star: 1, cooldown: 0, location: null },
  upgrades: [
    { consumed: [{ kind: 'existing', unitId: 41 }, { kind: 'existing', unitId: 42 }, { kind: 'created', creationIndex: 0 }],
      result: { ref: { kind: 'created', creationIndex: 1 }, definitionId: 'mock-added-ninth', star: 2,
        location: { kind: 'bench', slot: 5 }, cooldown: 17 } },
    { consumed: [{ kind: 'existing', unitId: 61 }, { kind: 'existing', unitId: 62 }, { kind: 'created', creationIndex: 1 }],
      result: { ref: { kind: 'created', creationIndex: 2 }, definitionId: 'mock-added-ninth', star: 3,
        location: { kind: 'board', col: 2, row: 3 }, cooldown: 29 } },
  ],
  result: { ref: { kind: 'created', creationIndex: 2 }, definitionId: 'mock-added-ninth', star: 3,
    location: { kind: 'board', col: 2, row: 3 }, cooldown: 29 },
  finalUnits: [], boardCountAfter: 11, benchCountAfter: 7,
} as const satisfies RecruitPreview;

test('v2 labels a registry-added definition with no fixed roster', () => {
  assert.equal(definitionLabel(rules, 'mock-added-ninth'), '테스트 새 기물');
  assert.equal(definitionLabel(rules, 'unrecognized-id'), 'unrecognized-id');
});

test('v2 exposes five distinct registry rarity labels, separate from stars', () => {
  assert.deepEqual(rules.rarities.map(rarity => rarityLabel(rules, rarity.id)),
    ['일반 표시', '고급 표시', '희귀 표시', '영웅 표시', '전설 표시']);
  assert.equal(unitAccessibleLabel({ definitionId: 'mock-added-ninth', rarityId: 'epic', star: 2 }, rules),
    '테스트 새 기물, 희귀도 영웅 표시, 2성');
});

test('v2 symbolic plan references never claim to be allocated entity IDs', () => {
  assert.equal(planRefLabel({ kind: 'existing', unitId: 41 }), '기존 #41');
  assert.equal(planRefLabel({ kind: 'created', creationIndex: 41 }), '생성 예정 기물 42');
  assert.doesNotMatch(planRefLabel({ kind: 'created', creationIndex: 41 }), /#/);
});

test('v2 projects complete supplied chain order, gold, and final placement without planning', () => {
  const text = recruitPreviewLabel(chainPreview, rules);
  assert.equal(text, [
    '영입 13코인 · 영입 후 987코인',
    '자동 승급 2단계',
    '1. 기존 #41 + 기존 #42 + 생성 예정 기물 1 → 테스트 새 기물 2성 (생성 예정 기물 2), 대기석 6',
    '2. 기존 #61 + 기존 #62 + 생성 예정 기물 2 → 테스트 새 기물 3성 (생성 예정 기물 3), 4행 3열',
    '최종: 테스트 새 기물 3성 · 4행 3열 · 생성 예정 기물 3',
    '배치 11/16 · 대기석 7/8',
  ].join('\n'));
  assert.equal(chainPreview.arrival.location, null);
  assert.equal(chainPreview.finalUnits.length, 0);
});

test('v2 shows core full-bench and gold errors without inventing a destination', () => {
  assert.equal(recruitPreviewLabel({ ok: false, error: { code: 'NO_RECRUIT_SPACE' } }, rules),
    '자동 승급 후에도 대기석 공간이 부족합니다');
  assert.equal(recruitPreviewLabel({ ok: false, error: { code: 'INSUFFICIENT_GOLD' } }, rules),
    '코인이 부족합니다');
});

test('v2 no-upgrade preview preserves its core chosen bench slot', () => {
  const text = recruitPreviewLabel({ ...chainPreview, upgrades: [], result: {
    ...chainPreview.arrival, location: { kind: 'bench', slot: 6 },
  } }, rules);
  assert.match(text, /자동 승급 없음/);
  assert.match(text, /최종: 테스트 새 기물 1성 · 대기석 7 · 생성 예정 기물 1/);
});

test('v2 formats board and bench locations for people', () => {
  assert.equal(locationLabel({ kind: 'board', row: 0, col: 3 }), '1행 4열');
  assert.equal(locationLabel({ kind: 'bench', slot: 0 }), '대기석 1');
});

test('v2 time copy distinguishes an absent deadline from zero remaining', () => {
  assert.equal(ticksLabel(null, 50), '—');
  assert.equal(ticksLabel(0, 50), '0.0초');
  assert.equal(ticksLabel(31, 50), '1.6초');
});
