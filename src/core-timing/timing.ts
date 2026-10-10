/** Pure checked integer geometry; no wall clock, renderer anchor or hidden RNG. */
import type { Point } from './types.ts';
import { safe } from './util.ts';
export function flightDuration(source: Point, target: Point, minimum: number, divisor: number): number {
  const dx=Math.abs(safe(target.x-source.x)),dy=Math.abs(safe(target.y-source.y));
  return safe(Math.max(minimum,Math.ceil(Math.max(dx,dy)/divisor)));
}
export function home(position: Point, target: Point, remainingTicks: number): Point {
  const dx=safe(target.x-position.x),dy=safe(target.y-position.y);
  return {x:safe(position.x+Math.trunc(dx/remainingTicks)),y:safe(position.y+Math.trunc(dy/remainingTicks))};
}
