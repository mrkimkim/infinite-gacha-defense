import type { MatchState, ReplayEntry, ReplayErrorCode, ReplayResult } from './types.ts';
import { advance, createMatch, dispatch } from './engine.ts';
import { DEFAULT_RULES_ID, RULES_DIGEST, SCHEMA_VERSION } from './rules.ts';
import { canonicalJson, sha256 } from './serialization.ts';
import { array, entry, integer, shape } from './validation.ts';

export function canonicalState(state: MatchState): string {
  return canonicalJson({
    schemaVersion: state.schemaVersion, rulesId: state.rulesId, rulesDigest: state.rulesDigest,
    seed: state.seed, rngState: state.rngState, nextEntityId: state.nextEntityId,
    tick: state.tick, phase: state.phase, outcome: state.outcome, wave: state.wave,
    waveTick: state.waveTick, spawnCursor: state.spawnCursor, lives: state.lives, gold: state.gold,
    offers: [...state.offers].sort((a, b) => a.slot - b.slot),
    units: [...state.units].sort((a, b) => a.id - b.id),
    enemies: [...state.enemies].sort((a, b) => a.id - b.id),
  });
}

export function stateHash(state: MatchState): string { return sha256(canonicalState(state)); }

function fail(code: ReplayErrorCode, entryIndex: number | null = null): ReplayResult {
  return { ok: false, error: { code, entryIndex } };
}

export function replay(header: unknown, entries: unknown, expectedFinalHash?: string): ReplayResult {
  let index: number | null = null;
  try {
    if (!shape(header, ['schemaVersion', 'rulesId', 'rulesDigest', 'seed'])
      || !integer(header.schemaVersion) || typeof header.rulesId !== 'string'
      || typeof header.rulesDigest !== 'string') return fail('BAD_FORMAT');
    if (header.schemaVersion !== SCHEMA_VERSION) return fail('UNSUPPORTED_SCHEMA');
    if (header.rulesId !== DEFAULT_RULES_ID) return fail('UNKNOWN_RULES');
    if (header.rulesDigest !== RULES_DIGEST) return fail('RULES_DIGEST_MISMATCH');
    if (!integer(header.seed, 1, 4294967295)) return fail('BAD_SEED');
    if (expectedFinalHash !== undefined && (typeof expectedFinalHash !== 'string'
      || !/^[0-9a-f]{64}$/.test(expectedFinalHash))) return fail('BAD_FORMAT');
    if (!array(entries)) return fail('BAD_FORMAT');
    // Complete preflight before even creating the temporary match or drawing RNG.
    for (let i = 0; i < entries.length; i++) {
      index = i;
      if (!entry(entries[i])) return fail('BAD_FORMAT', i);
      if ((entries[i] as ReplayEntry).seq !== i + 1) return fail('BAD_SEQUENCE', i);
    }
    index = null;
    const created = createMatch(header.seed, header.rulesId);
    if (!created.ok) return fail('BAD_SEED'); // Preflight guarantees creation succeeds.
    let state = created.state;
    for (let i = 0; i < entries.length; i++) {
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
