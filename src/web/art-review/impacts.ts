import type { CombatEvent, ObservedEnemy, EnemyTypeId, Point } from '../../core-v2/types.ts';
import type { Attack } from './model.ts';
import { HIT_TICKS } from './model.ts';
export type Impact = Readonly<{ attack: Attack; enemyId: number; typeId: EnemyTypeId; maxHp: number; beforeHp: number; afterHp: number; damage: number; position: Point; defeated: boolean; shownTick: number }>;
/** Review geometry buckets, NOT character attack definitions. */
export function geometry(source: Point, target: Point) {
  const dx=target.x-source.x,dy=target.y-source.y,distance=Math.hypot(dx,dy);
  return { direction: Math.abs(dy)<=Math.abs(dx)*.25?'horizontal':Math.abs(dx)<=Math.abs(dy)*.25?(dy<0?'up':'down'):'diagonal', distance, range: distance<=1500?'near':'far' };
}
/** Event order reconstructs HP from the actual pre-batch snapshot + actual spawns.
 * Damage is never inferred from a rule or final snapshot. Multiple attackers/ticks retain separate transitions.
 * shownTick is presentation time; attack.tick remains the immutable damage time.
 */
export function createImpactLedger() {
  let owner: object | null=null, rows: Impact[]=[];
  return {
    bind(next: object){owner=next;rows=[];},
    consume(from: object, before: readonly ObservedEnemy[], events: readonly CombatEvent[], shownTick: number){
      if(from!==owner)return;
      const hp=new Map<number,{hp:number;maxHp:number;typeId:EnemyTypeId}>(before.map(e=>[e.id,{hp:e.hp,maxHp:e.maxHp,typeId:e.typeId}]));
      const defeated=new Set(events.filter(e=>e.type==='enemyDefeated').map(e=>`${e.tick}:${e.enemyId}`));
      for(const e of events){
        if(e.type==='enemySpawned')hp.set(e.enemy.id,{hp:e.enemy.hp,maxHp:e.enemy.maxHp,typeId:e.enemy.typeId});
        if(e.type!=='attack')continue;
        for(const h of e.hits){const enemy=hp.get(h.enemyId);if(!enemy)throw new Error('REVIEW_MISSING_ENEMY');
          const afterHp=enemy.hp-h.damage;
          if(afterHp<0)throw new Error('REVIEW_INVALID_HP');
          if(!rows.some(r=>r.attack.tick===e.tick&&r.attack.unitId===e.unitId&&r.enemyId===h.enemyId))rows.push({attack:e,enemyId:h.enemyId,typeId:enemy.typeId,maxHp:enemy.maxHp,beforeHp:enemy.hp,afterHp,damage:h.damage,position:h.position,defeated:afterHp===0&&defeated.has(`${e.tick}:${h.enemyId}`),shownTick});
          enemy.hp=afterHp;
        }
      }
      rows=rows.slice(-256);
    },
    active(from:object,tick:number){return from===owner?rows.filter(r=>tick-r.shownTick<HIT_TICKS):[];},
    recent(from:object){return from===owner?rows.slice(-8):[];},
  };
}
