import type { EnemyTypeId, Observation } from '../core-v2/index.ts';

export interface V2WaveGuidance {
  readonly preview: string;
  readonly carry: string;
  readonly timing: string;
}

const ENEMY_NAMES: Readonly<Record<EnemyTypeId, string>> = {
  basic: '일반', swift: '신속', sturdy: '튼튼', boss: '보스',
};
const OUTCOMES = {
  accumulation: '잔존 적 한계 도달', bossTimeout: '보스 제한 시간 초과',
  finalTimeout: '최종 웨이브 시간 초과', cleared: '모든 웨이브 방어 성공',
} as const;

/** Display only: no simulation, survivor forecast, clock, or retained match history. */
export function waveGuidance(o: Observation): V2WaveGuidance {
  if (o.phase === 'result') return {
    preview: '다음 웨이브 없음',
    carry: `종료 시 잔존 ${o.remainingCount}명 · 다음 전투로 이월되지 않습니다.`,
    timing: o.outcomeReason ? OUTCOMES[o.outcomeReason] : '전투 종료',
  };

  const upcoming = o.nextWave;
  const composition = upcoming ? (Object.keys(ENEMY_NAMES) as EnemyTypeId[])
    .map(type => ({ type, count: upcoming.spawns.filter(spawn => spawn.typeId === type).length }))
    .filter(group => group.count > 0)
    .map(group => `${ENEMY_NAMES[group.type]} ${group.count}`).join(' · ') : '';
  const preview = upcoming
    ? `${upcoming.wave}웨이브 신규 ${upcoming.spawns.length}명${composition ? ` (${composition})` : ''}`
    : '다음 웨이브 없음';
  // During combat, remainingCount mixes carried survivors and current-wave spawns.
  // It must not be presented as a carried-only count or added to a future forecast.
  const carry = (o.phase === 'preparation'
    ? `이전 전투에서 이월 ${o.remainingCount}명 · 신규 출현 수와 별도입니다.`
    : `현재 잔존 ${o.remainingCount}명 · 이전 이월과 이번 출현 적을 포함합니다.`)
    + ` ${o.warning ? '⚠ ' : ''}${o.warningCount}명부터 경고, ${o.countLimit}명 이상이면 패배.`;
  const seconds = (ticks: number) => `${ticks * o.rules.tickMs / 1000}초`;
  const segment = seconds(o.segmentRemainingTicks);
  const deadline = o.bossDeadlineWaveTick;
  // The boss countdown disappears when the boss dies. The final cleanup deadline
  // remains in force for ordinary survivors, so use the public absolute deadline.
  const remainingDeadline = deadline === null ? null
    : o.phase === 'preparation' ? deadline : Math.max(0, deadline - o.waveTick);
  let timing: string;
  if (o.wave === o.rules.waveCount && remainingDeadline !== null) {
    timing = `최종 마감 ${seconds(remainingDeadline)} · 보스를 포함한 모든 적을 처치해야 합니다. 잔존 시 패배.`;
  } else if (remainingDeadline !== null && o.bossRemainingTicks !== null) {
    timing = `보스 마감 ${seconds(o.bossRemainingTicks)} · 마감에 보스가 남으면 패배. 보스 처치 후 일반 적은 구간 종료 시 이월됩니다.`;
  } else {
    timing = `${deadline !== null ? '보스 처치 완료 · ' : ''}구간 종료까지 ${segment} · 시간 종료 시 남은 적을 이월하고 다음 준비로 넘어갑니다.`;
  }
  return { preview, carry, timing };
}
