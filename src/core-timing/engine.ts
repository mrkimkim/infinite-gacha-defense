import type { AdvanceResult, CombatEvent, Command, CommandEvent, CoreErrorCode,
  CreateMatchResult, DispatchResult, Enemy, MatchState, OutcomeReason, PlanRef, PlannedUnit,
  ReplayEntry, RuleData, Stamp, Unit } from './types.ts';
import type { AttackSnapshot, Flight, Windup, CancelReason, Point } from './types.ts';
import { flightDuration, home } from './timing.ts';
import { RULES_DIGESTS, RULES_PROPOSALS } from './profiles.ts';
import { boardPosition, definition, isRulesId, nextRandom, pathPosition,
  sameLocation, sellGold, squared, stats, validLocation } from './rules.ts';
import { previewRecruit } from './planner.ts';
import { command as validCommand, dataTree, integer } from './validation.ts';
import { checkNumbers, copy, freeze, IntegerOverflow, safe } from './util.ts';
import type { Mutable } from './util.ts';
import { observe } from './observation.ts';
type WorkingState = Mutable<Omit<MatchState, 'acceptedLog'>> & { acceptedLog: ReplayEntry[] };
// Only this module's successfully validated, deeply frozen snapshots are trusted.
// Object.isFrozen alone cannot establish that externally supplied children are safe.
const publishedStates = new WeakSet<MatchState>();
function workingCopy(state: MatchState): WorkingState {
  if (!publishedStates.has(state)) return copy(state);
  const { acceptedLog, ...live } = state;
  return { ...copy(live), acceptedLog: [...acceptedLog] };
}
function stamp(state: MatchState): Stamp {
  return { tick: state.tick, wave: state.wave, waveTick: state.waveTick };
}
function allocateId(state: WorkingState): number {
  const id = state.nextEntityId; state.nextEntityId = safe(id + 1); return id;
}
function uniform(state: WorkingState, size: number): number {
  const bound = Math.floor(4294967295 / size) * size;
  do { state.rngState = nextRandom(state.rngState); } while (state.rngState > bound);
  return (state.rngState - 1) % size;
}
function refreshOffers(state: WorkingState, rules: RuleData): void {
  state.offers = Array.from({ length: rules.offerCount }, (_, slot) => {
    let value = uniform(state, rules.shopSampling.weightTotal);
    const rarity = rules.shopSampling.rarityOrder.find(id => {
      const weight = rules.rarities.find(r => r.id === id)!.offerWeight;
      if (value < weight) return true; value -= weight; return false;
    })!;
    const pool = rules.characters.filter(character => character.rarityId === rarity);
    return { slot, definitionId: pool[uniform(state, pool.length)].id };
  });
}
function publish(state: WorkingState, previous?: MatchState): MatchState {
  if (previous !== undefined && publishedStates.has(previous)) {
    const { acceptedLog, ...live } = state;
    checkNumbers(live);
    for (let index = previous.acceptedLog.length; index < acceptedLog.length; index += 1) {
      checkNumbers(acceptedLog[index]);
    }
  } else checkNumbers(state);
  observe(state);
  freeze(state);
  publishedStates.add(state);
  return state;
}
export function createMatch(seed: unknown, rulesId: unknown): CreateMatchResult {
  if (typeof rulesId !== 'string') return { ok: false, error: { code: 'BAD_FORMAT' } };
  if (!isRulesId(rulesId)) return { ok: false, error: { code: 'UNKNOWN_RULES' } };
  if (!integer(seed, 1, 4294967295)) return { ok: false, error: { code: 'BAD_SEED' } };
  const rules = RULES_PROPOSALS[rulesId];
  const state: WorkingState = { schemaVersion: 4, rulesId, rulesDigest: RULES_DIGESTS[rulesId],
    seed, rngState: seed, nextEntityId: 1, nextAttackId: 1, windups: [], flights: [], tick: 0, phase: 'preparation', outcome: null,
    outcomeReason: null, wave: 1, waveTick: 0, spawnCursor: 0, gold: rules.startingGold,
    offers: [], units: [], enemies: [], acceptedLog: [] };
  refreshOffers(state, rules); return { ok: true, state: publish(state) };
}
function reject(state: MatchState, code: CoreErrorCode): DispatchResult {
  return { ok: false, state, error: { code } };
}
function semanticError(state: MatchState, command: Exclude<Command, { type: 'recruit' }>, rules: RuleData): CoreErrorCode | null {
  const find = (id: number) => state.units.find(u => u.id === id);
  switch (command.type) {
    case 'reroll': return state.gold < rules.rerollCost ? 'INSUFFICIENT_GOLD' : null;
    case 'move': {
      const unit = find(command.unitId);
      if (!unit) return 'UNIT_NOT_FOUND';
      if (!validLocation(command.to)) return 'BAD_LOCATION';
      if (sameLocation(unit.location, command.to)) return 'SAME_LOCATION';
      return state.units.some(u => sameLocation(u.location, command.to)) ? 'LOCATION_OCCUPIED' : null;
    }
    case 'swap': {
      if (command.aId === command.bId) return 'DUPLICATE_ID';
      const a = find(command.aId), b = find(command.bId);
      if (!a || !b) return 'UNIT_NOT_FOUND';
      return sameLocation(a.location, b.location) ? 'SAME_LOCATION' : null;
    }
    case 'sell': return find(command.unitId) ? null : 'UNIT_NOT_FOUND';
    case 'startWave': return state.units.some(u => u.location.kind === 'board') ? null : 'NO_BOARD_UNITS';
  }
}
export function dispatch(state: MatchState, input: unknown): DispatchResult {
  try {
    if (!dataTree(input) || input === null || typeof input !== 'object' || Array.isArray(input)) return reject(state, 'BAD_FORMAT');
    const type = (input as Record<string, unknown>).type;
    if (typeof type !== 'string') return reject(state, 'BAD_FORMAT');
    if (!['recruit', 'reroll', 'move', 'swap', 'sell', 'startWave'].includes(type)) return reject(state, 'UNSUPPORTED_COMMAND');
    if (!validCommand(input)) return reject(state, 'BAD_FORMAT');
  } catch { return reject(state, 'BAD_FORMAT'); }
  const identityError=stateIdentityError(state);
  if(identityError)return reject(state,identityError);
  const command = input as Command;
  if (state.phase !== 'preparation') return reject(state, 'BAD_PHASE');
  const rules = RULES_PROPOSALS[state.rulesId];
  // The identical planner is the only source of purchase checks and state changes.
  const plan = command.type === 'recruit' ? previewRecruit(state, command.offerSlot) : null;
  if (plan && !plan.ok) return reject(state, plan.error.code);
  if (command.type !== 'recruit') {
    const error = semanticError(state, command, rules); if (error) return reject(state, error);
  }
  try {
    const next = workingCopy(state), events: CommandEvent[] = [], at = stamp(next);
    const find = (id: number) => next.units.find(u => u.id === id)!;
    switch (command.type) {
      case 'recruit': {
        if (!plan || !plan.ok) throw new Error('Validated plan missing');
        const ids = Array.from({ length: plan.upgrades.length + 1 }, () => allocateId(next));
        const actualId = (ref: PlanRef) => ref.kind === 'existing' ? ref.unitId : ids[ref.creationIndex];
        const materialize = (unit: PlannedUnit): Mutable<Unit> => ({ id: actualId(unit.ref),
          definitionId: unit.definitionId, star: unit.star, cooldown: unit.cooldown, location: copy(unit.location) });
        next.units = plan.finalUnits.map(materialize); next.gold = plan.goldAfter;
        next.offers[command.offerSlot].definitionId = null;
        events.push({ ...at, type: 'recruited', offerSlot: command.offerSlot, goldDelta: -plan.price,
          arrival: { id: ids[0], definitionId: plan.arrival.definitionId, star: 1, cooldown: 0, location: null },
          upgrades: plan.upgrades.map(step => ({ consumedIds: step.consumed.map(actualId) as [number, number, number], result: materialize(step.result) })),
          result: materialize(plan.result) }); break;
      }
      case 'reroll':
        next.gold = safe(next.gold - rules.rerollCost); refreshOffers(next, rules);
        events.push({ ...at, type: 'rerolled', offers: copy(next.offers), goldDelta: -rules.rerollCost }); break;
      case 'move': {
        const unit = find(command.unitId), from = copy(unit.location); unit.location = copy(command.to);
        events.push({ ...at, type: 'moved', unitId: unit.id, from, to: copy(unit.location) }); break;
      }
      case 'swap': {
        const a = find(command.aId), b = find(command.bId), aFrom = copy(a.location), bFrom = copy(b.location);
        a.location = copy(bFrom); b.location = copy(aFrom);
        events.push({ ...at, type: 'swapped', aId: a.id, bId: b.id, aFrom, bFrom }); break;
      }
      case 'sell': {
        const unit = find(command.unitId), goldDelta = sellGold(rules, unit);
        next.gold = safe(next.gold + goldDelta); next.units = next.units.filter(u => u.id !== unit.id);
        events.push({ ...at, type: 'sold', unitId: unit.id, goldDelta }); break;
      }
      case 'startWave':
        next.phase = 'combat'; next.waveTick = 0; next.spawnCursor = 0;
        events.push({ ...stamp(next), type: 'waveStarted' }); break;
    }
    next.acceptedLog.push(copy({ type: 'command', seq: safe(next.acceptedLog.length + 1), atTick: state.tick, command, events } satisfies ReplayEntry));
    freeze(events); return { ok: true, state: publish(next, state), events };
  } catch (error) { if (error instanceof IntegerOverflow) return reject(state, 'INTEGER_OVERFLOW'); throw error; }
}

function stateIdentityError(state: MatchState): CoreErrorCode | null {
  if(state.schemaVersion!==4)return 'UNSUPPORTED_SCHEMA';
  if(!isRulesId(state.rulesId))return 'UNKNOWN_RULES';
  if(state.rulesDigest!==RULES_DIGESTS[state.rulesId])return 'RULES_DIGEST_MISMATCH';
  return null;
}
function allocateAttackId(state: WorkingState): number {
  const id=state.nextAttackId;state.nextAttackId=safe(id+1);return id;
}
/** Engine-owned snapshots, not an external save importer. Reject unsupported delayed variants. */
function validPending(state: MatchState): boolean {
  if(!Array.isArray(state.windups)||!Array.isArray(state.flights)||!integer(state.nextAttackId,1))return false;
  const ids=new Set<number>(),units=new Set<number>();
  for(const p of [...state.windups,...state.flights]) {
    if(!integer(p.attackId,1)||p.attackId>=state.nextAttackId||ids.has(p.attackId))return false;
    ids.add(p.attackId);
    if(!integer(p.unitId,1)||!integer(p.targetId,1)||!integer(p.startTick)||p.startTick>state.tick
      ||!integer(p.releaseTick,1)||p.releaseTick<=p.startTick)return false;
    const t=p.snapshot;
    if(!t||!['single','splash'].includes(t.behavior)||t.effect!==null
      ||![t.damage,t.bossDamage,t.period,t.windupTicks,t.minFlightTicks,t.distancePerFlightTick].every(v=>integer(v,1))
      ||!integer(t.range)||!integer(t.radius))return false;
    if(p.kind==='windup') {
      if(units.has(p.unitId)||p.releaseTick<=state.tick)return false;units.add(p.unitId);
    } else if(p.kind==='flight') {
      if(!integer(p.arrivalTick,1)||p.arrivalTick<=state.tick||p.releaseTick>state.tick
        ||!integer(p.positionTick)||!integer(p.previousPositionTick)||p.positionTick!==state.tick
        ||p.previousPositionTick>p.positionTick)return false;
    } else return false;
  }
  return true;
}
function cancel(state: WorkingState,events: CombatEvent[],p: Windup|Flight,reason:CancelReason): void {
  events.push({...stamp(state),type:'attackCancelled',attackId:p.attackId,unitId:p.unitId,targetId:p.targetId,reason});
}
function cancelRemaining(state: WorkingState,events: CombatEvent[]): void {
  for(const p of [...state.windups,...state.flights].sort((a,b)=>a.attackId-b.attackId))cancel(state,events,p,'phaseTransition');
  state.windups=[];state.flights=[];
}
function applyImpact(state:WorkingState,events:CombatEvent[],flight:Flight,center:Point):void {
  const at=stamp(state),snapshot=flight.snapshot;
  const targets=snapshot.behavior==='single'?state.enemies.filter(e=>e.id===flight.targetId):
    state.enemies.filter(e=>squared(center,pathPosition(e.totalDistance)!)<=safe(snapshot.radius*snapshot.radius)).sort((a,b)=>a.id-b.id);
  const hits=targets.map(e=>({enemyId:e.id,damage:Math.min(e.hp,e.typeId==='boss'?snapshot.bossDamage:snapshot.damage),position:pathPosition(e.totalDistance)!}));
  events.push({...at,type:'attackImpacted',attackId:flight.attackId,unitId:flight.unitId,targetId:flight.targetId,sourcePosition:copy(flight.sourcePosition),center:copy(center),hits});
  for(const hit of hits){const e=state.enemies.find(e=>e.id===hit.enemyId)!;e.hp=safe(e.hp-hit.damage);
    if(e.hp===0){state.enemies=state.enemies.filter(x=>x.id!==e.id);events.push({...at,type:'enemyDefeated',enemyId:e.id});}}
}
function processPending(state:WorkingState,events:CombatEvent[]):Set<number> {
  const blocked=new Set<number>(),flights:Mutable<Flight>[]=[];
  for(const flight of [...state.flights].sort((a,b)=>a.attackId-b.attackId)) {
    const target=state.enemies.find(e=>e.id===flight.targetId);
    if(!target){cancel(state,events,flight,'targetMissing');blocked.add(flight.unitId);continue;}
    const position=pathPosition(target.totalDistance)!;
    flight.previousPosition=copy(flight.position);flight.previousPositionTick=flight.positionTick;
    flight.position=home(flight.position,position,safe(safe(flight.arrivalTick-state.tick)+1));flight.positionTick=state.tick;
    if(state.tick===flight.arrivalTick)applyImpact(state,events,flight,position);
    else flights.push(flight);
  }
  state.flights=flights;
  const windups:Mutable<Windup>[]=[];
  for(const windup of [...state.windups].sort((a,b)=>a.attackId-b.attackId)) {
    const target=state.enemies.find(e=>e.id===windup.targetId);
    if(!target){cancel(state,events,windup,'targetMissing');blocked.add(windup.unitId);continue;}
    if(state.tick<windup.releaseTick){windups.push(windup);continue;}
    blocked.add(windup.unitId);
    const targetPosition=pathPosition(target.totalDistance)!;
    if(squared(windup.sourcePosition,targetPosition)>safe(windup.snapshot.range*windup.snapshot.range)) {
      cancel(state,events,windup,'outOfRange');continue;
    }
    const duration=flightDuration(windup.sourcePosition,targetPosition,windup.snapshot.minFlightTicks,windup.snapshot.distancePerFlightTick);
    const flight: Flight={...copy(windup),kind:'flight',arrivalTick:safe(state.tick+duration),
      previousPosition:copy(windup.sourcePosition),position:copy(windup.sourcePosition),previousPositionTick:state.tick,positionTick:state.tick};
    state.flights.push(copy(flight));events.push({...stamp(state),type:'attackReleased',attackId:flight.attackId,unitId:flight.unitId,targetId:flight.targetId,flight:copy(flight)});
  }
  state.windups=windups;state.flights.sort((a,b)=>a.attackId-b.attackId);return blocked;
}
function endLoss(state: WorkingState, events: CombatEvent[], reason: Exclude<OutcomeReason, null | 'cleared'>): void {
  cancelRemaining(state,events);
  state.phase = 'result'; state.outcome = 'loss'; state.outcomeReason = reason;
  events.push({ ...stamp(state), type: 'matchEnded', outcome: 'loss', reason });
}
function reward(state: WorkingState, events: CombatEvent[], rules: RuleData): void {
  cancelRemaining(state,events);
  const at = stamp(state);
  state.gold = safe(state.gold + rules.waveReward);
  events.push({ ...at, type: 'waveCompleted', goldDelta: rules.waveReward,
    carriedEnemyIds: state.enemies.map(e => e.id).sort((a, b) => a - b) });
  if (state.wave === rules.waveCount) {
    state.phase = 'result'; state.outcome = 'win'; state.outcomeReason = 'cleared';
    events.push({ ...at, type: 'matchEnded', outcome: 'win', reason: 'cleared' });
  } else {
    state.phase = 'preparation'; state.wave = safe(state.wave + 1); refreshOffers(state, rules);
    events.push({ ...at, type: 'shopRefreshed', offers: copy(state.offers) });
  }
}
function targetOrder(a: Enemy, b: Enemy): number {
  // Relational comparison avoids unsafe subtraction of widely separated distances.
  return a.totalDistance === b.totalDistance ? a.id - b.id : a.totalDistance > b.totalDistance ? -1 : 1;
}
function combatTick(state: WorkingState, events: CombatEvent[], rules: RuleData): void {
  state.tick = safe(state.tick + 1); state.waveTick = safe(state.waveTick + 1);
  const at = stamp(state), wave = rules.waves[state.wave - 1];
  for (const enemy of [...state.enemies].sort((a, b) => a.id - b.id)) {
    if (enemy.slow !== null && enemy.slow.expireAt <= state.tick) {
      events.push({ ...at, type: 'effectExpired', enemyId: enemy.id, effect: copy(enemy.slow) }); enemy.slow = null;
    }
  }
  while (state.spawnCursor < wave.spawns.length && wave.spawns[state.spawnCursor].atWaveTick <= state.waveTick) {
    const spawn = wave.spawns[state.spawnCursor]; state.spawnCursor = safe(state.spawnCursor + 1);
    const enemy: Mutable<Enemy> = { id: allocateId(state), typeId: spawn.typeId, hp: spawn.hp,
      maxHp: spawn.hp, totalDistance: 0, spawnTick: state.tick, slow: null };
    state.enemies.push(enemy); events.push({ ...at, type: 'enemySpawned', enemy: copy(enemy) });
  }
  const blocked = processPending(state,events);
  const board = state.units.filter(u => u.location.kind === 'board').sort((a, b) => a.id - b.id);
  for (const unit of board) {
    unit.cooldown = Math.max(0, unit.cooldown - 1);
    if (unit.cooldown !== 0 || blocked.has(unit.id) || state.windups.some(w=>w.unitId===unit.id) || unit.location.kind !== 'board') continue;
    const derived = stats(unit, state, rules), character = definition(rules, unit.definitionId);
    const sourcePosition = boardPosition(unit.location.col, unit.location.row)!;
    const targets = state.enemies.filter(e => squared(sourcePosition, pathPosition(e.totalDistance)!) <= safe(derived.range * derived.range))
      .sort((a, b) => character.behavior === 'bossFirst' && (a.typeId === 'boss') !== (b.typeId === 'boss')
        ? a.typeId === 'boss' ? -1 : 1 : targetOrder(a, b));
    const primary = targets[0];
    if (!primary) continue;
    if(character.behavior==='single'||character.behavior==='splash') {
      const snapshot: AttackSnapshot={damage:derived.damage,bossDamage:derived.bossDamage,range:derived.range,
        period:derived.nextAttackCooldown,behavior:character.behavior,radius:character.splashRadius,effect:null,
        windupTicks:character.behavior==='single'?rules.timing.singleWindupTicks:rules.timing.splashWindupTicks,
        minFlightTicks:rules.timing.minFlightTicks,distancePerFlightTick:rules.timing.distancePerFlightTick};
      const windup: Windup={kind:'windup',attackId:allocateAttackId(state),unitId:unit.id,targetId:primary.id,
        startTick:state.tick,releaseTick:safe(state.tick+snapshot.windupTicks),sourcePosition,snapshot};
      state.windups.push(copy(windup));
      events.push({...at,type:'attackStarted',attackId:windup.attackId,unitId:unit.id,targetId:primary.id,windup:copy(windup)});
      unit.cooldown=derived.nextAttackCooldown;
      continue;
    }
    const center = pathPosition(primary.totalDistance)!;
    const hitTargets = targets.slice(0, character.maxTargets ?? 1);
    const hits = hitTargets.map(enemy => ({ enemyId: enemy.id,
      damage: Math.min(enemy.hp, enemy.typeId === 'boss' ? derived.bossDamage : derived.damage),
      position: pathPosition(enemy.totalDistance)! }));
    events.push({ ...at, type: 'attack', attackId: allocateAttackId(state), unitId: unit.id, targetId: primary.id, sourcePosition, center, hits });
    for (const hit of hits) {
      const enemy = state.enemies.find(e => e.id === hit.enemyId)!;
      enemy.hp = safe(enemy.hp - hit.damage);
      if (enemy.hp === 0) {
        state.enemies = state.enemies.filter(e => e.id !== enemy.id);
        events.push({ ...at, type: 'enemyDefeated', enemyId: enemy.id });
      } else if (character.behavior === 'slow') {
        enemy.slow = { type: 'slow', percent: rules.slow.percent,
          expireAt: Math.max(enemy.slow?.expireAt ?? 0, safe(state.tick + rules.slow.durationTicks)) };
        events.push({ ...at, type: 'effectApplied', enemyId: enemy.id, effect: copy(enemy.slow) });
      }
    }
    unit.cooldown = derived.nextAttackCooldown;
  }
  for (const enemy of state.enemies) {
    const speed = enemy.slow === null ? rules.enemySpeed[enemy.typeId]
      : Math.floor(safe(rules.enemySpeed[enemy.typeId] * (100 - enemy.slow.percent)) / 100);
    enemy.totalDistance = safe(enemy.totalDistance + speed);
  }
  if (state.enemies.length >= rules.countLimit) { endLoss(state, events, 'accumulation'); return; }
  if (wave.bossDeadlineWaveTick !== null && state.waveTick >= wave.bossDeadlineWaveTick) {
    if (state.enemies.some(e => e.typeId === 'boss')) { endLoss(state, events, 'bossTimeout'); return; }
    if (state.wave === rules.waveCount && state.enemies.length > 0) { endLoss(state, events, 'finalTimeout'); return; }
  }
  const exhausted = state.spawnCursor === wave.spawns.length;
  if ((exhausted && state.enemies.length === 0) || state.waveTick >= wave.durationTicks) reward(state, events, rules);
}
export function advance(state: MatchState, count: unknown): AdvanceResult {
  const fail = (code: CoreErrorCode): AdvanceResult => ({ ok: false, state, error: { code }, executedTicks: 0 });
  if (!integer(count, 1)) return fail('BAD_COUNT');
  const identityError=stateIdentityError(state);
  if(identityError)return fail(identityError);
  if (state.phase !== 'combat') return fail('BAD_PHASE');
  try {
    // Published snapshots were already checked and deeply frozen; do not rescan their whole history.
    if(!publishedStates.has(state))checkNumbers(state);
    if(!validPending(state))return fail('BAD_FORMAT');
    const next = workingCopy(state), events: CombatEvent[] = [], rules = RULES_PROPOSALS[state.rulesId];
    let executedTicks = 0;
    while (executedTicks < count && next.phase === 'combat') {
      combatTick(next, events, rules); executedTicks += 1;
    }
    next.acceptedLog.push({ type: 'advance', seq: safe(next.acceptedLog.length + 1), startTick: state.tick, executedTicks });
    freeze(events);
    return { ok: true, state: publish(next, state), events, executedTicks };
  } catch (error) {
    if (error instanceof IntegerOverflow) return fail('INTEGER_OVERFLOW');
    throw error;
  }
}
