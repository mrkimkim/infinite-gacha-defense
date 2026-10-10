/** Compile-only contract checks, including negative API capabilities. */
import type { CoreApi, MatchState, Observation, Command, PublicRules } from '../../src/core-v2/index.ts';
import { CANONICAL_STATE_KEYS } from '../../src/core-v2/index.ts';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
export type CanonicalKeysCoverState = Assert<Equal<
  typeof CANONICAL_STATE_KEYS[number], Exclude<keyof MatchState, 'acceptedLog'>>>;
export type PolicyHasNoSecrets = Assert<Equal<Extract<keyof Observation,
  'seed' | 'rngState' | 'nextEntityId' | 'acceptedLog' | 'waveParticipants'>, never>>;
export type PublicRulesHaveNoRng = Assert<Equal<Extract<keyof PublicRules, 'prng'>, never>>;
export type SynchronousCreate = Assert<Equal<Extract<ReturnType<CoreApi['createMatch']>, Promise<unknown>>, never>>;
export const exampleCommands: readonly Command[] = [
  { type: 'recruit', offerSlot: 0, benchSlot: 7 }, { type: 'reroll' },
  { type: 'move', unitId: 1, to: { kind: 'board', col: 0, row: 3 } },
  { type: 'swap', aId: 1, bId: 2 }, { type: 'merge', ids: [1, 2, 3], keepId: 2 },
  { type: 'sell', unitId: 1 }, { type: 'useBook', bookId: 9, unitId: 3 },
  { type: 'startWave' },
];
export function compileOnly(api: CoreApi, state: MatchState, observed: Observation): void {
  // @ts-expect-error No implicit/default experiment profile on engine creation.
  api.createMatch(1);
  // @ts-expect-error Deeply readonly nested state.
  state.units[0].location.kind = 'bench';
  // @ts-expect-error No mutable observation arrays.
  observed.units.push(state.units[0]);
  // @ts-expect-error No policy seed.
  observed.seed;
  // @ts-expect-error A replay header is not a policy observation.
  observed.rules.prng;
  // @ts-expect-error Recruitment does not support direct board placement.
  const forbidden: Command = { type: 'recruit', offerSlot: 0, to: { kind: 'board', col: 0, row: 0 } };
  void forbidden;
}
