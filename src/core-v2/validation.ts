import type { Command, CommandEvent, Location, ReplayEntry } from './types.ts';

const MIN_SAFE = Number.MIN_SAFE_INTEGER;

export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

/** Exact plain-object data shape, without invoking an accessor. */
export function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const actual = Reflect.ownKeys(value);
    return actual.length === keys.length && actual.every(key => {
      if (typeof key !== 'string' || !keys.includes(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && descriptor.enumerable === true && Object.hasOwn(descriptor, 'value');
    });
  } catch {
    return false;
  }
}

/** Dense ordinary arrays; the only non-enumerable key may be their length. */
export function array(value: unknown): value is unknown[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
    const length = Object.getOwnPropertyDescriptor(value, 'length');
    if (!length || !Object.hasOwn(length, 'value') || !integer(length.value)) return false;
    if (Reflect.ownKeys(value).length !== length.value + 1) return false;
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate all descendants, including values under an unknown command type.
 * An explicit stack avoids recursion limits; only ancestor cycles are rejected,
 * so the same otherwise valid object may appear in separate branches.
 */
export function dataTree(value: unknown): boolean {
  const ancestors = new Set<object>();
  const pending: { value: unknown; leaving?: boolean }[] = [{ value }];
  try {
    while (pending.length > 0) {
      const item = pending.pop()!;
      const current = item.value;
      if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
      if (typeof current === 'number') {
        if (!integer(current, MIN_SAFE)) return false;
        continue;
      }
      if (typeof current !== 'object') return false;
      if (item.leaving) {
        ancestors.delete(current);
        continue;
      }
      if (ancestors.has(current)) return false;
      ancestors.add(current);
      pending.push({ value: current, leaving: true });
      const isArray = Array.isArray(current);
      if (isArray) {
        if (!array(current)) return false;
      } else {
        const prototype: unknown = Object.getPrototypeOf(current);
        if (prototype !== Object.prototype && prototype !== null) return false;
      }
      for (const key of Reflect.ownKeys(current)) {
        if (typeof key !== 'string') return false;
        if (isArray && key === 'length') continue;
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
        pending.push({ value: descriptor.value });
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Commands defer bounds to semantic validation; event snapshots do not. */
export function location(value: unknown, bounded = true): value is Location {
  if (shape(value, ['kind', 'col', 'row'])) {
    return value.kind === 'board' && integer(value.col, bounded ? 0 : MIN_SAFE, bounded ? 3 : undefined)
      && integer(value.row, bounded ? 0 : MIN_SAFE, bounded ? 3 : undefined);
  }
  return shape(value, ['kind', 'slot']) && value.kind === 'bench'
    && integer(value.slot, bounded ? 0 : MIN_SAFE, bounded ? 7 : undefined);
}

export function command(value: unknown): value is Command {
  try {
    if (shape(value, ['type'])) {
      return value.type === 'reroll' || value.type === 'startWave';
    }
    if (shape(value, ['type', 'offerSlot'])) return value.type === 'recruit'
      && integer(value.offerSlot, MIN_SAFE);
    if (shape(value, ['type', 'unitId', 'to'])) return value.type === 'move'
      && integer(value.unitId, 1) && location(value.to, false);
    if (shape(value, ['type', 'aId', 'bId'])) return value.type === 'swap'
      && integer(value.aId, 1) && integer(value.bId, 1);
    return shape(value, ['type', 'unitId']) && value.type === 'sell' && integer(value.unitId, 1);
  } catch {
    return false;
  }
}

function definition(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function unit(value: unknown): boolean {
  return shape(value, ['id', 'definitionId', 'star', 'location', 'cooldown'])
    && integer(value.id, 1) && definition(value.definitionId) && integer(value.star, 1, 3)
    && location(value.location) && integer(value.cooldown);
}

function offer(value: unknown): boolean {
  return shape(value, ['slot', 'definitionId']) && integer(value.slot, 0, 2)
    && (value.definitionId === null || definition(value.definitionId));
}

function arrival(value: unknown): boolean {
  return shape(value, ['id', 'definitionId', 'star', 'location', 'cooldown'])
    && integer(value.id, 1) && definition(value.definitionId) && value.star === 1
    && value.location === null && value.cooldown === 0;
}

function upgrade(value: unknown): boolean {
  return shape(value, ['consumedIds', 'result']) && array(value.consumedIds)
    && value.consumedIds.length === 3 && value.consumedIds.every(id => integer(id, 1))
    && unit(value.result);
}

const STAMP_KEYS = ['type', 'tick', 'wave', 'waveTick'] as const;

/** Only command-event variants are permitted in a replay command entry. */
export function event(value: unknown): value is CommandEvent {
  try {
    if (value === null || typeof value !== 'object') return false;
    const stamp = value as Record<string, unknown>;
    // Read descriptors first: malformed event getters must never be invoked.
    for (const key of STAMP_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
    }
    if (!integer(stamp.tick) || !integer(stamp.wave) || !integer(stamp.waveTick)) return false;
    switch (stamp.type) {
      case 'recruited': return shape(value, [...STAMP_KEYS, 'offerSlot', 'goldDelta', 'arrival', 'upgrades', 'result'])
        && integer(value.offerSlot, 0, 2) && integer(value.goldDelta, MIN_SAFE)
        && arrival(value.arrival) && array(value.upgrades) && value.upgrades.every(upgrade) && unit(value.result);
      case 'rerolled': return shape(value, [...STAMP_KEYS, 'offers', 'goldDelta'])
        && array(value.offers) && value.offers.length === 3 && value.offers.every(offer)
        && integer(value.goldDelta, MIN_SAFE);
      case 'moved': return shape(value, [...STAMP_KEYS, 'unitId', 'from', 'to'])
        && integer(value.unitId, 1) && location(value.from) && location(value.to);
      case 'swapped': return shape(value, [...STAMP_KEYS, 'aId', 'bId', 'aFrom', 'bFrom'])
        && integer(value.aId, 1) && integer(value.bId, 1) && location(value.aFrom) && location(value.bFrom);
      case 'sold': return shape(value, [...STAMP_KEYS, 'unitId', 'goldDelta'])
        && integer(value.unitId, 1) && integer(value.goldDelta, MIN_SAFE);
      case 'waveStarted': return shape(value, STAMP_KEYS);
      default: return false;
    }
  } catch {
    return false;
  }
}

export function entry(value: unknown): value is ReplayEntry {
  try {
    if (shape(value, ['type', 'seq', 'atTick', 'command', 'events'])) return value.type === 'command'
      && integer(value.seq, 1) && integer(value.atTick) && command(value.command)
      && array(value.events) && value.events.every(event);
    return shape(value, ['type', 'seq', 'startTick', 'executedTicks']) && value.type === 'advance'
      && integer(value.seq, 1) && integer(value.startTick) && integer(value.executedTicks, 1);
  } catch {
    return false;
  }
}
