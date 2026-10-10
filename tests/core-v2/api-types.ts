/** Compile-only schema3 contract checks: no runtime engine is implemented here. */
import type { CoreApi, MatchState, Observation, Command, PublicRules, Unit, CommandEvent,
  CombatEvent, PlanRef, PlannedArrival, DefinitionId, RecruitPreview } from '../../src/core-v2/index.ts';
import { CANONICAL_STATE_KEYS } from '../../src/core-v2/index.ts';
type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type CanonicalKeysCoverState = Assert<Equal<typeof CANONICAL_STATE_KEYS[number], Exclude<keyof MatchState, 'acceptedLog'>>>;
export type PolicyHasNoSecrets = Assert<Equal<Extract<keyof Observation,
  'seed' | 'rngState' | 'nextEntityId' | 'acceptedLog'>, never>>;
export type PublicRulesHaveNoRng = Assert<Equal<Extract<keyof PublicRules, 'prng'>, never>>;
export type RemovedState = Assert<Equal<Extract<keyof MatchState, 'books' | 'waveParticipants'>, never>>;
export type RemovedUnit = Assert<Equal<Extract<keyof Unit, 'xp' | 'level'>, never>>;
export type RemovedCommands = Assert<Equal<Extract<Command['type'], 'merge' | 'useBook'>, never>>;
export type RemovedEvents = Assert<Equal<Extract<CommandEvent['type'] | CombatEvent['type'],
  'merged' | 'bookUsed' | 'levelChanged' | 'xpGranted'>, never>>;
export type RosterIsDataDriven = Assert<Equal<DefinitionId, string>>;
export type SynchronousPreview = Assert<Equal<ReturnType<CoreApi['previewRecruit']>, RecruitPreview>>;
export const exampleCommands: readonly Command[] = [
  { type: 'recruit', offerSlot: 0 }, { type: 'reroll' },
  { type: 'move', unitId: 1, to: { kind: 'board', col: 3, row: 3 } },
  { type: 'swap', aId: 1, bId: 2 }, { type: 'sell', unitId: 1 }, { type: 'startWave' },
];
export const symbolic: PlanRef = { kind: 'created', creationIndex: 0 };
export const arrival: PlannedArrival = { ref: { kind: 'created', creationIndex: 0 },
  definitionId: 'another-data-defined-character', star: 1, cooldown: 0, location: null };
export function compileOnly(api: CoreApi, state: MatchState, observed: Observation): void {
  // @ts-expect-error No implicit default profile.
  api.createMatch(1);
  // @ts-expect-error Schema2 is not silently reused.
  const oldSchema: MatchState['schemaVersion'] = 2;
  // @ts-expect-error No user-selected bench in a purchase command.
  const bench: Command = { type: 'recruit', offerSlot: 0, benchSlot: 1 };
  // @ts-expect-error Manual merge is removed.
  const merge: Command = { type: 'merge', ids: [1, 2, 3], keepId: 1 };
  // @ts-expect-error No future actual ID in a created preview reference.
  const leak: PlanRef = { kind: 'created', unitId: 999, creationIndex: 0 };
  // @ts-expect-error Permanent units cannot occupy a transient null slot.
  const invalid: Unit['location'] = null;
  // @ts-expect-error Deeply readonly snapshot.
  observed.offers[0].recruitPreview.ok = false;
  // @ts-expect-error No policy seed or allocator state.
  observed.seed;
  // @ts-expect-error No mutable state arrays.
  state.units.push({});
  void [oldSchema, bench, merge, leak, invalid];
}

import * as runtime from '../../src/core-v2/index.ts';
export const implementedApi: CoreApi = runtime;
