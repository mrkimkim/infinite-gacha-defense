import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../../src/core-v2/index.ts';
import type { CharacterDefinition, ObservedUnit, PublicRules, RecruitPreview, Synergy } from '../../src/core-v2/index.ts';
import {
  attackIntervalLabel, tileRadiusLabel, unitRole, unitStatsDisplay, recruitPreviewDetails,
} from '../../src/web/v2-unit-display.ts';

// Presentation fixtures deliberately differ from the current roster. They do not
// establish balance, IP, a legal purchase plan, or reachable gameplay.
const character: CharacterDefinition = {
  id: 'display-ninth', label: '추가 기물', rarityId: 'epic', tag: 'focus',
  damage: 123, cooldownTicks: 19, range: 2345, behavior: 'single',
  maxTargets: 1, splashRadius: 0, bossDamagePercent: 135,
};
const rules = {
  characters: [character], tickMs: 50, benchCapacity: 8,
  board: { columns: 4, rows: 4, tileSize: 1000 },
} as const satisfies Pick<PublicRules, 'characters' | 'tickMs' | 'board' | 'benchCapacity'>;
const unit: ObservedUnit = {
  id: 41, definitionId: character.id, rarityId: 'epic', star: 2,
  location: { kind: 'board', col: 2, row: 3 }, cooldown: 2,
  damage: 987, bossDamage: 1357, nextAttackCooldown: 9, range: 2876,
  supportActive: true, supportSourceIds: [42], sellGold: 17,
};
const synergies: readonly Synergy[] = [
  { tag: 'focus', distinctDefinitions: ['display-ninth', 'another'], affectedUnitIds: [41], tier: 2, percent: 17 },
  { tag: 'cooperation', distinctDefinitions: ['elsewhere', 'another'], affectedUnitIds: [99], tier: 2, percent: 13 },
];
const chain: Extract<RecruitPreview, { ok: true }> = {
  ok: true, offerSlot: 2, price: 13, goldAfter: 987,
  arrival: { ref: { kind: 'created', creationIndex: 0 }, definitionId: character.id, star: 1, cooldown: 0, location: null },
  upgrades: [
    { consumed: [{ kind: 'existing', unitId: 41 }, { kind: 'existing', unitId: 42 }, { kind: 'created', creationIndex: 0 }],
      result: { ref: { kind: 'created', creationIndex: 1 }, definitionId: character.id, star: 2,
        location: { kind: 'bench', slot: 5 }, cooldown: 17 } },
    { consumed: [{ kind: 'existing', unitId: 61 }, { kind: 'existing', unitId: 62 }, { kind: 'created', creationIndex: 1 }],
      result: { ref: { kind: 'created', creationIndex: 2 }, definitionId: character.id, star: 3,
        location: { kind: 'board', col: 2, row: 3 }, cooldown: 29 } },
  ],
  result: { ref: { kind: 'created', creationIndex: 2 }, definitionId: character.id, star: 3,
    location: { kind: 'board', col: 2, row: 3 }, cooldown: 29 },
  finalUnits: [], boardCountAfter: 11, benchCountAfter: 7,
};
const materials = [
  { ...unit, star: 1 as const },
  { ...unit, id: 42, star: 1 as const, location: { kind: 'bench' as const, slot: 4 } },
  { ...unit, id: 61, location: { kind: 'bench' as const, slot: 2 } },
  { ...unit, id: 62, location: { kind: 'board' as const, row: 0, col: 1 } },
];

test('attack periods preserve 9 ticks at 50ms as 0.45 seconds and use supplied tick length', () => {
  assert.equal(attackIntervalLabel(9, 50), '0.45초');
  assert.equal(attackIntervalLabel(19, 50), '0.95초');
  assert.equal(attackIntervalLabel(20, 50), '1초');
  assert.equal(attackIntervalLabel(3, 25), '0.075초');
});

test('range is tile radius without losing sub-hundredth precision or doubling into diameter', () => {
  assert.equal(tileRadiusLabel(2345, 1000), '2.345칸');
  assert.equal(tileRadiusLabel(3000, 1000), '3칸');
  assert.equal(tileRadiusLabel(2345, 500), '4.69칸');
});

test('all actual behavior roles are labeled without invented character skills or target counts', () => {
  assert.deepEqual(['single', 'splash', 'multi', 'slow', 'support', 'bossFirst'].map(behavior =>
    unitRole({ ...character, behavior: behavior as CharacterDefinition['behavior'] })[1]),
  ['단일 공격', '범위 공격', '다중 공격', '둔화', '인접 지원', '보스 우선']);
  assert.deepEqual(unitRole(undefined), ['?', '역할 정보 없음']);
});

test('unpurchased definition exposes one-star baseline and explicitly excludes buffs', () => {
  const display = unitStatsDisplay(rules, character.id);
  assert.equal(display.basis, '1성 기본값');
  assert.equal(display.attack, '123');
  assert.equal(display.attackInterval, '0.95초');
  assert.equal(display.range, '2.345칸');
  assert.match(display.note, /시너지·인접 지원 미반영/);
  assert.match(display.note, /보스 공격 배율 135%/);
});

test('effective values come verbatim from observation, not remaining cooldown or frontend buff math', () => {
  const display = unitStatsDisplay(rules, character.id, unit, synergies);
  assert.equal(display.basis, '현재 2성 실효값');
  assert.equal(display.attack, '987');
  assert.equal(display.attackInterval, '0.45초');
  assert.equal(display.range, '2.876칸');
  assert.match(display.note, /1성 기본: 공격력 123 · 주기 0.95초 · 반경 2.345칸/);
  assert.match(display.note, /현재 보스 공격력 1357/);
  assert.match(display.note, /적용: 집중 17%, 인접 지원 1명/);
  assert.doesNotMatch(display.note, /협동|13%/);
});

test('bench stats clarify that deployment buffs are inactive; missing definitions are never guessed', () => {
  const benched = { ...unit, location: { kind: 'bench' as const, slot: 0 }, supportActive: false, supportSourceIds: [] };
  assert.match(unitStatsDisplay(rules, character.id, benched).note, /대기 중: 출전 시너지·지원 미적용/);
  const unknown = unitStatsDisplay(rules, 'missing');
  assert.equal(unknown.attack, '—');
  assert.equal(unknown.attackInterval, '—');
  assert.equal(unknown.range, '—');
  assert.equal(unknown.role, '역할 정보 없음');
  assert.match(unknown.note, /기본 정보 없음/);
  assert.equal(unitStatsDisplay(rules, 'missing', unit).attack, '987');
});

test('chain copy identifies every material, source location, intermediate result and final location', () => {
  const before = JSON.stringify({ chain, materials });
  assert.equal(recruitPreviewDetails(chain, rules, materials), [
    '영입 13코인 · 영입 후 987코인',
    '자동 승급 2단계 · 아래 재료가 소모됩니다',
    '1. 1성 3개 → 2성 1개',
    '  재료: 추가 기물 1성 (4행 3열) + 추가 기물 1성 (대기석 5) + 이번 영입 추가 기물 1성',
    '  결과: 추가 기물 2성 (대기석 6)',
    '2. 2성 3개 → 3성 1개',
    '  재료: 추가 기물 2성 (대기석 3) + 추가 기물 2성 (1행 2열) + 1단계 결과 추가 기물 2성 (대기석 6)',
    '  결과: 추가 기물 3성 (4행 3열)',
    '최종: 추가 기물 3성 (4행 3열)',
    '배치 11/16 · 대기석 7/8',
  ].join('\n'));
  assert.equal(JSON.stringify({ chain, materials }), before);
});

test('missing material metadata remains explicitly unknown, without invented positions or IDs', () => {
  const text = recruitPreviewDetails(chain, rules, []);
  assert.match(text, /기존 #41 \(정보 없음\)/);
  assert.match(text, /1\. 성급 미상 재료 2개 \+ 1성 1개 → 2성 1개/);
  assert.match(text, /2\. 성급 미상 재료 2개 \+ 2성 1개 → 3성 1개/);
  assert.match(text, /1단계 결과 추가 기물 2성 \(대기석 6\)/);
  assert.doesNotMatch(text, /생성 예정 기물|#0|#1\b|대기석 1/);
});

test('each chain step leads with compact supplied-material count and supplied result star', () => {
  const lines = recruitPreviewDetails(chain, rules, materials).split('\n');
  assert.deepEqual(lines.filter(line => /^\d+\./.test(line)), [
    '1. 1성 3개 → 2성 1개', '2. 2성 3개 → 3성 1개',
  ]);
  for (const index of [2, 5]) {
    assert.match(lines[index + 1], /^  재료:/);
    assert.match(lines[index + 2], /^  결과:/);
  }
  const mixed = recruitPreviewDetails(chain, rules, materials.map(material =>
    material.id === 41 ? { ...material, star: 3 } : material));
  assert.match(mixed, /1\. 3성 1개 \+ 1성 2개 → 2성 1개/);
});

test('no-upgrade display preserves the supplied destination instead of picking a free slot', () => {
  const text = recruitPreviewDetails({ ...chain, upgrades: [],
    result: { ...chain.arrival, location: { kind: 'bench', slot: 6 } },
  }, rules, materials);
  assert.match(text, /자동 승급 없음/);
  assert.match(text, /최종: 추가 기물 1성 \(대기석 7\)/);
  assert.doesNotMatch(text, /소모|→/);
});

test('all rejected previews display only the actual error, without promised upgrade or destination', () => {
  for (const code of ['BAD_FORMAT', 'BAD_PHASE', 'BAD_SLOT', 'OFFER_EMPTY', 'INSUFFICIENT_GOLD', 'NO_RECRUIT_SPACE', 'INTEGER_OVERFLOW'] as const) {
    const text = recruitPreviewDetails({ ok: false, error: { code } }, rules, materials);
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /최종:|→|영입 후/);
  }
});

test('actual engine preview stays unchanged across repeated display and agrees with committed purchase', () => {
  const created = core.createMatch(1, core.EXPERIMENT_RULES_ID);
  assert.ok(created.ok);
  let state = created.state;
  const o = core.observe(state);
  const before = core.canonicalState(state);
  const preview = o.offers[0].recruitPreview;
  assert.ok(preview.ok);
  const text = recruitPreviewDetails(preview, o.rules, o.units);
  assert.equal(recruitPreviewDetails(preview, o.rules, o.units), text);
  assert.equal(core.canonicalState(state), before);
  const bought = core.dispatch(state, { type: 'recruit', offerSlot: 0 });
  assert.ok(bought.ok);
  state = bought.state;
  assert.equal(state.gold, preview.goldAfter);
  assert.deepEqual(state.units[0].location, preview.result.location);
  assert.equal(state.units[0].star, preview.result.star);
  assert.match(text, /자동 승급 없음/);
  assert.equal(core.observe(state).offers[0].recruitPreview.ok, false);
});
