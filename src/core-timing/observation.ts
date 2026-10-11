import type { MatchState, Observation } from './types.ts';
import { RULES_PROPOSALS } from './profiles.ts';
import { definition, getRules, pathPosition, price, sellGold, stats, synergies } from './rules.ts';
import { previewRecruit } from './planner.ts';
import { copy, freeze, safe } from './util.ts';
export function observe(state: MatchState): Observation {
  const rules = RULES_PROPOSALS[state.rulesId], wave = rules.waves[state.wave - 1];
  const board = state.units.filter(u => u.location.kind === 'board');
  const bossDeadlineWaveTick = state.phase === 'result' ? null : wave.bossDeadlineWaveTick;
  const bossPending = wave.spawns.slice(state.spawnCursor).some(s => s.typeId === 'boss');
  const bossAlive = state.enemies.some(e => e.typeId === 'boss');
  const bossRemainingTicks = bossDeadlineWaveTick === null ? null
    : state.phase === 'preparation' ? bossDeadlineWaveTick
    : bossPending || bossAlive ? Math.max(0, bossDeadlineWaveTick - state.waveTick) : null;
  const nextWave = state.phase === 'preparation' ? wave
    : state.phase === 'combat' ? rules.waves[state.wave] ?? null : null;
  return freeze({ rules: getRules(state.rulesId)!, tick: state.tick, phase: state.phase,
    outcome: state.outcome, outcomeReason: state.outcomeReason, wave: state.wave,
    waveTick: state.waveTick, gold: state.gold,
    windups: copy([...state.windups].sort((a,b)=>a.attackId-b.attackId)),
    flights: copy([...state.flights].sort((a,b)=>a.attackId-b.attackId)),
    offers: state.offers.map(offer => ({ ...copy(offer),
      rarityId: offer.definitionId === null ? null : definition(rules, offer.definitionId).rarityId,
      price: offer.definitionId === null ? null : price(rules, offer.definitionId),
      recruitPreview: previewRecruit(state, offer.slot) })),
    units: [...state.units].sort((a, b) => a.id - b.id).map(unit => ({ ...copy(unit),
      rarityId: definition(rules, unit.definitionId).rarityId,
      ...stats(unit, state, rules), sellGold: sellGold(rules, unit) })),
    enemies: [...state.enemies].sort((a, b) => a.id - b.id).map(enemy => ({ ...copy(enemy),
      boss: enemy.typeId === 'boss', position: pathPosition(enemy.totalDistance)!,
      speed: enemy.slow === null ? rules.enemySpeed[enemy.typeId]
        : Math.floor(safe(rules.enemySpeed[enemy.typeId] * (100 - enemy.slow.percent)) / 100) })),
    synergies: synergies(state, rules), boardCount: board.length, benchCount: state.units.length - board.length,
    remainingCount: state.enemies.length, countLimit: rules.countLimit, warningCount: rules.warningCount,
    warning: state.enemies.length >= rules.warningCount,
    segmentRemainingTicks: state.phase === 'preparation' ? wave.durationTicks
      : state.phase === 'combat' ? Math.max(0, wave.durationTicks - state.waveTick) : 0,
    bossDeadlineWaveTick, bossRemainingTicks, nextWave: copy(nextWave),
    canStartWave: state.phase === 'preparation' && board.length > 0 });
}
