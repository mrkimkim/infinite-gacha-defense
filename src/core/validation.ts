import type { Command, CommandEvent, Location, ReplayEntry } from './types.ts';

export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

/** No getters, custom prototypes, symbols, hidden keys, or JSON coercion hooks. */
export function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key)
    && Object.getOwnPropertyDescriptor(value, key)?.enumerable === true
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value'));
}

export function array(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let i = 0; i < value.length; i++) {
    const desc = Object.getOwnPropertyDescriptor(value, String(i));
    if (!desc || !desc.enumerable || !Object.hasOwn(desc, 'value')) return false;
  }
  return true;
}

export function location(value: unknown): value is Location {
  if (shape(value, ['kind', 'col', 'row'])) {
    return value.kind === 'board' && integer(value.col, 0, 3) && integer(value.row, 0, 3);
  }
  return shape(value, ['kind', 'slot']) && value.kind === 'bench' && integer(value.slot, 0, 2);
}

export function command(value: unknown): value is Command {
  if (shape(value, ['type', 'offerSlot', 'to'])) return value.type === 'recruit'
    && integer(value.offerSlot, 0, 2) && location(value.to);
  if (shape(value, ['type', 'unitId', 'to'])) return value.type === 'move'
    && integer(value.unitId, 1) && location(value.to);
  if (shape(value, ['type', 'aId', 'bId'])) return value.type === 'swap'
    && integer(value.aId, 1) && integer(value.bId, 1);
  if (shape(value, ['type'])) return value.type === 'startWave';
  return shape(value, ['type', 'ids', 'keepId']) && value.type === 'merge'
    && array(value.ids) && value.ids.length === 3 && value.ids.every(id => integer(id, 1))
    && new Set(value.ids).size === 3 && integer(value.keepId, 1) && value.ids.includes(value.keepId);
}

export function event(value: unknown): value is CommandEvent {
  return shape(value, ['type', 'id', 'typeId', 'star', 'location'])
    && value.type === 'unitCreated' && integer(value.id, 1)
    && (value.typeId === 'single' || value.typeId === 'splash')
    && value.star === 1 && location(value.location);
}

export function entry(value: unknown): value is ReplayEntry {
  if (shape(value, ['type', 'seq', 'atTick', 'command', 'events'])) return value.type === 'command'
    && integer(value.seq, 1) && integer(value.atTick) && command(value.command)
    && array(value.events) && value.events.every(event);
  return shape(value, ['type', 'seq', 'startTick', 'executedTicks']) && value.type === 'advance'
    && integer(value.seq, 1) && integer(value.startTick) && integer(value.executedTicks, 1, 10000);
}
