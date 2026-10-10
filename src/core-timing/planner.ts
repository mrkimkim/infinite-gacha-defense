import type { Location, MatchState, PlanRef, PlannedUnit, PlannedUpgrade, RecruitErrorCode, RecruitPreview } from './types.ts';
import { RULES_PROPOSALS } from './profiles.ts';
import { price, sameLocation, validLocation } from './rules.ts';
import { copy, freeze, safe, IntegerOverflow } from './util.ts';
import { integer } from './validation.ts';

type TemporaryUnit = Omit<PlannedUnit, 'location'> & { location: Location | null };
export function refOrder(a: PlanRef, b: PlanRef): number {
  return a.kind === 'existing' ? b.kind === 'existing' ? a.unitId - b.unitId : -1
    : b.kind === 'existing' ? 1 : a.creationIndex - b.creationIndex;
}
/** The sole purchase planner, shared unchanged by preview, observation and commit. */
export function previewRecruit(state: MatchState, offerSlot: unknown): RecruitPreview {
  const fail = (code: RecruitErrorCode): RecruitPreview => ({ ok: false, error: { code } });
  if (!integer(offerSlot, Number.MIN_SAFE_INTEGER)) return fail('BAD_FORMAT');
  if (state.phase !== 'preparation') return fail('BAD_PHASE');
  if (offerSlot < 0 || offerSlot >= 3) return fail('BAD_SLOT');
  const definitionId = state.offers[offerSlot].definitionId;
  if (definitionId === null) return fail('OFFER_EMPTY');
  const rules = RULES_PROPOSALS[state.rulesId], cost = price(rules, definitionId);
  if (state.gold < cost) return fail('INSUFFICIENT_GOLD');
  try {
    const arrival = { ref: { kind: 'created' as const, creationIndex: 0 as const },
      definitionId, star: 1 as const, cooldown: 0 as const, location: null };
    let live: TemporaryUnit[] = state.units.map(unit => ({ ref: { kind: 'existing', unitId: unit.id },
      definitionId: unit.definitionId, star: unit.star, cooldown: unit.cooldown, location: copy(unit.location) }));
    live.push(arrival);
    let lineage: TemporaryUnit = arrival, creationIndex = 0;
    const upgrades: PlannedUpgrade[] = [];
    for (const star of rules.autoUpgrade.starOrder) {
      for (;;) {
        const matching = live.filter(u => u.definitionId === definitionId && u.star === star)
          .sort((a, b) => refOrder(a.ref, b.ref));
        if (matching.length < 3) break;
        const materials = matching.slice(0, 3);
        const board = materials.filter(u => u.location?.kind === 'board');
        const bench = materials.filter(u => u.location?.kind === 'bench')
          .sort((a, b) => (a.location as { slot: number }).slot - (b.location as { slot: number }).slot);
        const location = (board[0] ?? bench[0])?.location;
        if (!location) return fail('NO_RECRUIT_SPACE');
        creationIndex += 1;
        const result: PlannedUnit = { ref: { kind: 'created', creationIndex }, definitionId,
          star: (star + 1) as 2 | 3, location: copy(location),
          cooldown: Math.max(...materials.map(u => u.cooldown)) };
        live = live.filter(unit => !materials.includes(unit)); live.push(result); lineage = result;
        upgrades.push({ consumed: materials.map(u => copy(u.ref)) as [PlanRef, PlanRef, PlanRef], result });
      }
    }
    if (lineage === arrival) {
      let slot = 0;
      while (slot < rules.benchCapacity && live.some(u => u.location?.kind === 'bench' && u.location.slot === slot)) slot += 1;
      if (slot === rules.benchCapacity) return fail('NO_RECRUIT_SPACE');
      lineage = { ...arrival, location: { kind: 'bench', slot } };
      live = live.map(unit => unit === arrival ? lineage : unit);
    }
    if (live.some(u => u.location === null || !validLocation(u.location))) return fail('NO_RECRUIT_SPACE');
    for (let i = 0; i < live.length; i += 1) for (let j = i + 1; j < live.length; j += 1) {
      if (sameLocation(live[i].location!, live[j].location!)) return fail('NO_RECRUIT_SPACE');
    }
    const boardCountAfter = live.filter(u => u.location!.kind === 'board').length;
    const benchCountAfter = live.length - boardCountAfter;
    if (benchCountAfter > rules.benchCapacity || boardCountAfter > rules.board.columns * rules.board.rows) return fail('NO_RECRUIT_SPACE');
    // Validate allocator arithmetic, but never return the current/future actual IDs.
    safe(state.nextEntityId + creationIndex + 1);
    const goldAfter = safe(state.gold - cost);
    return freeze({ ok: true, offerSlot, price: cost, goldAfter, arrival,
      upgrades: copy(upgrades), result: copy(lineage as PlannedUnit),
      finalUnits: copy(live.sort((a, b) => refOrder(a.ref, b.ref)) as PlannedUnit[]), boardCountAfter, benchCountAfter });
  } catch (error) {
    if (error instanceof IntegerOverflow) return fail('INTEGER_OVERFLOW');
    throw error;
  }
}
