import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as core from '../../src/core-v2/index.ts';
import type { Command, MatchState, Observation, RulesId } from '../../src/core-v2/index.ts';
import { waveGuidance } from '../../src/web/v2-wave-guidance.ts';

function initial(rulesId: RulesId = core.EXPERIMENT_RULES_ID): MatchState {
  const result = core.createMatch(1, rulesId);
  assert.ok(result.ok);
  return result.state;
}
function dispatch(state: MatchState, command: Command): MatchState {
  const result = core.dispatch(state, command);
  assert.ok(result.ok);
  return result.state;
}
function advance(state: MatchState, ticks: number): MatchState {
  const result = core.advance(state, ticks);
  assert.ok(result.ok);
  return result.state;
}
function weakBoard(): MatchState {
  const bought = dispatch(initial(), { type: 'recruit', offerSlot: 2 });
  return dispatch(bought, { type: 'move', unitId: bought.units[0].id,
    to: { kind: 'board', col: 1, row: 1 } });
}
const fresh = core.observe(initial());
// Explicit display-only boundary fixtures retain the actual Observation shape.
// They do not claim engine reachability or simulate future combat outcomes.
function display(overrides: Partial<Observation>): Observation { return { ...fresh, ...overrides }; }

test('initial actual observation previews current upcoming wave, not wave + 1', () => {
  const result = waveGuidance(fresh);
  assert.match(result.preview, new RegExp(`^1웨이브 신규 ${fresh.nextWave!.spawns.length}명`));
  assert.match(result.carry, /이월 0명/);
  assert.match(result.timing, /구간 종료까지 20초/);
  assert.match(result.timing, /남은 적을 이월하고 다음 준비/);
});

test('actual combat observation previews the next numbered wave and labels mixed live count', () => {
  const state = advance(dispatch(weakBoard(), { type: 'startWave' }), 1);
  const o = core.observe(state), result = waveGuidance(o);
  assert.equal(o.nextWave!.wave, 2);
  assert.match(result.preview, new RegExp(`^2웨이브 신규 ${o.nextWave!.spawns.length}명`));
  assert.match(result.carry, new RegExp(`현재 잔존 ${o.remainingCount}명`));
  assert.match(result.carry, /이전 이월과 이번 출현 적을 포함/);
  assert.doesNotMatch(result.carry, /이월 \d+명/);
});

test('real expiry carries survivors; preparation separates survivors from new spawns', () => {
  const state = advance(dispatch(weakBoard(), { type: 'startWave' }), 1000);
  const o = core.observe(state);
  assert.equal(o.phase, 'preparation');
  assert.equal(o.wave, 2);
  assert.ok(o.remainingCount > 0);
  const result = waveGuidance(o);
  assert.match(result.carry, new RegExp(`이월 ${o.remainingCount}명`));
  assert.match(result.preview, new RegExp(`신규 ${o.nextWave!.spawns.length}명`));
  assert.doesNotMatch(result.preview, new RegExp(`신규 ${o.nextWave!.spawns.length + o.remainingCount}명`));
  assert.match(result.timing, /20초/); // Preparation resets the displayed budget, not waveTick.
});

test('preview composition is supplied schedule data, without a fabricated forecast', () => {
  const nextWave = { wave: 17, durationTicks: 333, bossDeadlineWaveTick: null,
    spawns: [{ atWaveTick: 1, typeId: 'sturdy', hp: 79 },
      { atWaveTick: 29, typeId: 'sturdy', hp: 80 }, { atWaveTick: 88, typeId: 'swift', hp: 1 }] } as const;
  const result = waveGuidance(display({ nextWave, remainingCount: 19 }));
  assert.equal(result.preview, '17웨이브 신규 3명 (신속 1 · 튼튼 2)');
  assert.doesNotMatch(result.preview, /일반|보스|22명|HP/);
  assert.equal(waveGuidance(display({ nextWave: { ...nextWave, spawns: [] } })).preview, '17웨이브 신규 0명');
  assert.equal(waveGuidance(display({ nextWave: null })).preview, '다음 웨이브 없음');
});

test('ordinary timer zero is a carry boundary, not a boss or final loss message', () => {
  const result = waveGuidance(display({ phase: 'combat', segmentRemainingTicks: 0 }));
  assert.match(result.timing, /0초/);
  assert.match(result.timing, /남은 적을 이월/);
  assert.doesNotMatch(result.timing, /마감|패배/);
});

test('boss preparation uses full deadline even with the previous waveTick retained', () => {
  const result = waveGuidance(display({ wave: 5, waveTick: 400,
    bossDeadlineWaveTick: 600, bossRemainingTicks: 600, segmentRemainingTicks: 600 }));
  assert.match(result.timing, /보스 마감 30초/);
  assert.match(result.timing, /마감에 보스가 남으면 패배/);
  assert.match(result.timing, /보스 처치 후 일반 적은 구간 종료 시 이월/);
});

test('boss countdown preserves a zero deadline rather than treating it as absent', () => {
  const result = waveGuidance(display({ phase: 'combat', wave: 5, waveTick: 600,
    bossDeadlineWaveTick: 600, bossRemainingTicks: 0, segmentRemainingTicks: 0 }));
  assert.match(result.timing, /보스 마감 0초/);
});

test('cleared nonfinal boss removes its loss countdown but preserves ordinary carry', () => {
  const result = waveGuidance(display({ phase: 'combat', wave: 5, waveTick: 400,
    bossDeadlineWaveTick: 600, bossRemainingTicks: null, segmentRemainingTicks: 200 }));
  assert.match(result.timing, /보스 처치 완료 · 구간 종료까지 10초/);
  assert.match(result.timing, /남은 적을 이월/);
  assert.doesNotMatch(result.timing, /보스 마감/);
});

test('final deadline survives boss death, including the exact zero boundary', () => {
  for (const waveTick of [599, 600]) {
    const result = waveGuidance(display({ phase: 'combat', wave: fresh.rules.waveCount,
      waveTick, bossDeadlineWaveTick: 600, bossRemainingTicks: null,
      segmentRemainingTicks: 600 - waveTick, remainingCount: 1, nextWave: null }));
    assert.match(result.timing, /최종 마감/);
    assert.match(result.timing, /보스를 포함한 모든 적을 처치/);
    assert.match(result.timing, /잔존 시 패배/);
    assert.doesNotMatch(result.timing, /이월|보스 처치 완료/);
    if (waveTick === 600) assert.match(result.timing, /0초/);
  }
});

test('final preparation shows full available deadline, not previous wave elapsed time', () => {
  const result = waveGuidance(display({ wave: fresh.rules.waveCount, waveTick: 400,
    bossDeadlineWaveTick: 600, bossRemainingTicks: 600, segmentRemainingTicks: 600 }));
  assert.match(result.timing, /최종 마감 30초/);
});

test('count pressure uses actual observation thresholds for both supported profiles', () => {
  for (const rulesId of ['playable-v2-gen2-fixture1-count40', 'playable-v2-gen2-fixture1-count80'] as const) {
    const o = core.observe(initial(rulesId));
    for (const count of [o.warningCount - 1, o.warningCount, o.countLimit]) {
      const result = waveGuidance({ ...o, remainingCount: count, warning: count >= o.warningCount });
      assert.match(result.carry, new RegExp(`${o.warningCount}명부터 경고, ${o.countLimit}명 이상이면 패배`));
      assert.equal(result.carry.includes('⚠'), count >= o.warningCount);
    }
  }
});

test('actual boss loss and fresh restart retain no obsolete preview or carry state', () => {
  let state = weakBoard();
  while (state.phase !== 'result') state = advance(dispatch(state, { type: 'startWave' }), 1000);
  assert.equal(state.outcomeReason, 'bossTimeout');
  const result = waveGuidance(core.observe(state));
  assert.equal(result.preview, '다음 웨이브 없음');
  assert.equal(result.timing, '보스 제한 시간 초과');
  assert.match(result.carry, /다음 전투로 이월되지 않습니다/);
  assert.deepEqual(waveGuidance(core.observe(initial())), waveGuidance(fresh));
});

test('all terminal reasons suppress stale next-wave schedules and ticking guidance', () => {
  for (const outcomeReason of ['cleared', 'accumulation', 'bossTimeout', 'finalTimeout'] as const) {
    const result = waveGuidance(display({ phase: 'result', outcomeReason,
      outcome: outcomeReason === 'cleared' ? 'win' : 'loss' }));
    assert.equal(result.preview, '다음 웨이브 없음');
    assert.doesNotMatch(result.timing, /\d+(?:\.\d+)?초|이월/);
  }
});

test('projection leaves actual frozen observation, state hash, and accepted log unchanged', () => {
  const state = weakBoard(), o = core.observe(state), before = core.canonicalState(state);
  const snapshot = JSON.stringify(o);
  assert.deepEqual(waveGuidance(o), waveGuidance(o));
  assert.equal(JSON.stringify(o), snapshot);
  assert.equal(core.canonicalState(state), before);
});

test('inert shell exposes dedicated wave refs and interval label without a live claim', () => {
  const shell = readFileSync(new URL('../../src/web/v2-shell.ts', import.meta.url), 'utf8');
  for (const name of ['wave-carry', 'wave-timing']) {
    assert.match(shell, new RegExp(`data-v2="${name}">연결 후 표시됩니다`));
    assert.ok(shell.includes(`ref('${name}')`));
  }
  assert.match(shell, /<span>등장 예정<\/span>/);
  assert.match(shell, /<dt>공격 간격<\/dt>/);
  assert.doesNotMatch(shell, /<dt>공격 속도<\/dt>/);
});


test('all countdowns preserve nine ticks as exactly 0.45 seconds and zero as zero', () => {
  for (const ticks of [9, 0]) {
    const seconds = ticks === 9 ? '0.45초' : '0초';
    const ordinary = waveGuidance(display({ phase: 'combat', segmentRemainingTicks: ticks }));
    assert.ok(ordinary.timing.includes(`구간 종료까지 ${seconds}`));
    const boss = waveGuidance(display({ phase: 'combat', wave: 5, waveTick: 600 - ticks,
      bossDeadlineWaveTick: 600, bossRemainingTicks: ticks, segmentRemainingTicks: ticks }));
    assert.ok(boss.timing.includes(`보스 마감 ${seconds}`));
    const final = waveGuidance(display({ phase: 'combat', wave: fresh.rules.waveCount,
      waveTick: 600 - ticks, bossDeadlineWaveTick: 600, bossRemainingTicks: null,
      segmentRemainingTicks: ticks }));
    assert.ok(final.timing.includes(`최종 마감 ${seconds}`));
  }
});
