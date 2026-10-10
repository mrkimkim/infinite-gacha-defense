export type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
export function copy<T>(value: T): Mutable<T> {
  if (Array.isArray(value)) return value.map(copy) as Mutable<T>;
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) result[key] = copy((value as Record<string, unknown>)[key]);
    return result as Mutable<T>;
  }
  return value as Mutable<T>;
}
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export class IntegerOverflow extends Error {
  constructor() { super('INTEGER_OVERFLOW'); }
}
export function safe(value: number): number {
  if (!Number.isSafeInteger(value)) throw new IntegerOverflow();
  return value;
}
export function checkNumbers(value: unknown): void {
  if (typeof value === 'number') safe(value);
  else if (value !== null && typeof value === 'object') Object.values(value).forEach(checkNumbers);
}
