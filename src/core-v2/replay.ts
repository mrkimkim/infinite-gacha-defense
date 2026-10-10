import type { MatchState, ReplayEntry, ReplayErrorCode, ReplayResult, RulesId } from './types.ts';
import { advance, createMatch, dispatch } from './engine.ts';
import { RULES_DIGESTS, RULES_PROPOSALS, SCHEMA_VERSION } from './profiles.ts';
import { canonicalJson, sha256 } from './serialization.ts';
import { array, dataTree, entry, integer, shape } from './validation.ts';

/** Exactly the schema3 seventeen persisted keys; log batching is not state. */
export function canonicalState(state: MatchState): string {
  return canonicalJson({
    schemaVersion: state.schemaVersion, rulesId: state.rulesId, rulesDigest: state.rulesDigest,
    seed: state.seed, rngState: state.rngState, nextEntityId: state.nextEntityId,
    tick: state.tick, phase: state.phase, outcome: state.outcome, outcomeReason: state.outcomeReason,
    wave: state.wave, waveTick: state.waveTick, spawnCursor: state.spawnCursor, gold: state.gold,
    offers: [...state.offers].sort((a, b) => a.slot - b.slot),
    units: [...state.units].sort((a, b) => a.id - b.id),
    enemies: [...state.enemies].sort((a, b) => a.id - b.id),
  });
}

export function stateHash(state: MatchState): string { return sha256(canonicalState(state)); }

function fail(code: ReplayErrorCode, entryIndex: number | null = null): ReplayResult {
  return { ok: false, error: { code, entryIndex } };
}

export function replay(header: unknown, entries: unknown, expectedFinalHash?: unknown): ReplayResult {
  let index: number | null = null;
  try {
    if (!dataTree(header) || !shape(header, ['schemaVersion', 'rulesId', 'rulesDigest', 'seed'])
      || !integer(header.schemaVersion, Number.MIN_SAFE_INTEGER) || typeof header.rulesId !== 'string'
      || typeof header.rulesDigest !== 'string') return fail('BAD_FORMAT');
    if (header.schemaVersion !== SCHEMA_VERSION) return fail('UNSUPPORTED_SCHEMA');
    if (!Object.hasOwn(RULES_PROPOSALS, header.rulesId)) return fail('UNKNOWN_RULES');
    if (header.rulesDigest !== RULES_DIGESTS[header.rulesId as RulesId]) return fail('RULES_DIGEST_MISMATCH');
    if (!integer(header.seed, 1, 4294967295)) return fail('BAD_SEED');
    if (expectedFinalHash !== undefined && (typeof expectedFinalHash !== 'string'
      || !/^[0-9a-f]{64}$/.test(expectedFinalHash))) return fail('BAD_FORMAT');
    if (!array(entries)) return fail('BAD_FORMAT');
    // Complete structural preflight before sequence checks or any game execution.
    // Checking each tree separately preserves the first malformed entry's index.
    for (let i = 0; i < entries.length; i += 1) {
      index = i;
      if (!dataTree(entries[i]) || !entry(entries[i])) return fail('BAD_FORMAT', i);
    }
    for (let i = 0; i < entries.length; i += 1) {
      index = i;
      if ((entries[i] as ReplayEntry).seq !== i + 1) return fail('BAD_SEQUENCE', i);
    }
    index = null;
    const created = createMatch(header.seed, header.rulesId);
    if (!created.ok) return fail('BAD_SEED'); // Header preflight guarantees this succeeds.
    let state = created.state;
    for (let i = 0; i < entries.length; i += 1) {
      index = i;
      const logged = entries[i] as ReplayEntry;
      if (logged.type === 'command') {
        if (logged.atTick !== state.tick) return fail('TICK_MISMATCH', i);
        const result = dispatch(state, logged.command);
        if (!result.ok) return fail('COMMAND_REJECTED', i);
        if (canonicalJson(result.events) !== canonicalJson(logged.events)) return fail('EVENT_MISMATCH', i);
        state = result.state;
      } else {
        if (logged.startTick !== state.tick) return fail('TICK_MISMATCH', i);
        const result = advance(state, logged.executedTicks);
        if (!result.ok || result.executedTicks !== logged.executedTicks) return fail('ADVANCE_MISMATCH', i);
        state = result.state;
      }
    }
    index = null;
    if (expectedFinalHash !== undefined && stateHash(state) !== expectedFinalHash) return fail('FINAL_HASH_MISMATCH');
    return { ok: true, state };
  } catch {
    return fail('BAD_FORMAT', index);
  }
}
