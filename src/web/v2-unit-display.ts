import type {
  CharacterDefinition, DefinitionId, Location, ObservedUnit, PlanRef,
  PublicRules, RarityId, RecruitPreview, Synergy,
} from '../core-v2/index.ts';

const ROLES = {
  single: ['●', '단일 공격'], splash: ['◎', '범위 공격'], multi: ['Ⅱ', '다중 공격'],
  slow: ['❄', '둔화'], support: ['＋', '인접 지원'], bossFirst: ['◆', '보스 우선'],
} as const;
const TAG_NAMES = { focus: '집중', cooperation: '협동' } as const;
export const RECRUIT_ERRORS = {
  BAD_FORMAT: '영입 요청 형식 오류', BAD_PHASE: '준비 단계에서 영입할 수 있습니다',
  BAD_SLOT: '잘못된 후보', OFFER_EMPTY: '이미 영입한 후보',
  INSUFFICIENT_GOLD: '코인이 부족합니다', NO_RECRUIT_SPACE: '자동 승급 후에도 대기석 공간이 부족합니다',
  INTEGER_OVERFLOW: '수치 한계를 초과해 영입할 수 없습니다',
} as const;

export function definitionLabel(rules: Pick<PublicRules, 'characters'>, id: DefinitionId): string {
  return rules.characters.find(definition => definition.id === id)?.label ?? id;
}
export function rarityLabel(rules: Pick<PublicRules, 'rarities'>, id: RarityId): string {
  return rules.rarities.find(rarity => rarity.id === id)?.label ?? id;
}
export function locationLabel(location: Location): string {
  return location.kind === 'board' ? `${location.row + 1}행 ${location.col + 1}열`
    : `대기석 ${location.slot + 1}`;
}
export function planRefLabel(ref: PlanRef): string {
  return ref.kind === 'existing' ? `기존 #${ref.unitId}` : `생성 예정 기물 ${ref.creationIndex + 1}`;
}
export function unitRole(definition: CharacterDefinition | undefined): readonly [string, string] {
  return definition ? ROLES[definition.behavior] : ['?', '역할 정보 없음'];
}

/** Unit conversions only. Do not round attack periods with the countdown formatter. */
export function attackIntervalLabel(ticks: number, tickMs: number): string {
  return `${ticks * tickMs / 1000}초`;
}
export function tileRadiusLabel(range: number, tileSize: number): string {
  return `${range / tileSize}칸`;
}

export interface UnitStatsDisplay {
  readonly role: string;
  readonly basis: string;
  readonly attack: string;
  readonly attackInterval: string;
  readonly range: string;
  readonly note: string;
}

/** Display public 1-star definitions or engine-observed values, never recompute buffs. */
export function unitStatsDisplay(
  rules: Pick<PublicRules, 'characters' | 'tickMs' | 'board'>,
  definitionId: DefinitionId, unit?: ObservedUnit, synergies: readonly Synergy[] = [],
): UnitStatsDisplay {
  const definition = rules.characters.find(item => item.id === definitionId);
  const role = unitRole(definition)[1];
  const base = definition
    ? `1성 기본: 공격력 ${definition.damage} · 주기 ${attackIntervalLabel(definition.cooldownTicks, rules.tickMs)} · 반경 ${tileRadiusLabel(definition.range, rules.board.tileSize)}`
    : '1성 기본 정보 없음';
  if (!unit) return {
    role, basis: '1성 기본값',
    attack: definition ? String(definition.damage) : '—',
    attackInterval: definition ? attackIntervalLabel(definition.cooldownTicks, rules.tickMs) : '—',
    range: definition ? tileRadiusLabel(definition.range, rules.board.tileSize) : '—',
    note: `시너지·인접 지원 미반영${definition ? ` · 보스 공격 배율 ${definition.bossDamagePercent}%` : ' · 기본 정보 없음'}. 승급 결과는 영입 미리보기를 확인하세요.`,
  };
  const applied = synergies.filter(synergy => synergy.tier > 0 && synergy.affectedUnitIds.includes(unit.id));
  const buffs = applied.map(synergy => `${TAG_NAMES[synergy.tag]} ${synergy.percent}%`);
  if (unit.supportActive) buffs.push(`인접 지원 ${unit.supportSourceIds.length}명`);
  return {
    role, basis: `현재 ${unit.star}성 실효값`,
    attack: String(unit.damage),
    attackInterval: attackIntervalLabel(unit.nextAttackCooldown, rules.tickMs),
    range: tileRadiusLabel(unit.range, rules.board.tileSize),
    note: `${base}. 현재 보스 공격력 ${unit.bossDamage} · ${unit.location.kind === 'bench'
      ? '대기 중: 출전 시너지·지원 미적용'
      : `적용: ${buffs.join(', ') || '시너지·지원 없음'}`}.`,
  };
}

type MaterialUnit = Pick<ObservedUnit, 'id' | 'definitionId' | 'star' | 'location'>;
type PreviewRules = Pick<PublicRules, 'characters' | 'benchCapacity' | 'board'>;
function refKey(ref: PlanRef): string {
  return ref.kind === 'existing' ? `existing:${ref.unitId}` : `created:${ref.creationIndex}`;
}

/** Resolve only supplied current units and earlier preview steps; allocate no future IDs. */
export function recruitPreviewDetails(
  preview: RecruitPreview, rules: PreviewRules, units: readonly MaterialUnit[],
): string {
  if (!preview.ok) return RECRUIT_ERRORS[preview.error.code];
  const describe = (unit: Pick<MaterialUnit, 'definitionId' | 'star' | 'location'>) =>
    `${definitionLabel(rules, unit.definitionId)} ${unit.star}성 (${locationLabel(unit.location)})`;
  const refs = new Map(units.map(unit => [`existing:${unit.id}`, { label: describe(unit), star: unit.star }]));
  refs.set(refKey(preview.arrival.ref), {
    label: `이번 영입 ${definitionLabel(rules, preview.arrival.definitionId)} ${preview.arrival.star}성`,
    star: preview.arrival.star,
  });
  const steps = preview.upgrades.map((upgrade, index) => {
    const counts = new Map<MaterialUnit['star'] | undefined, number>();
    const materials = upgrade.consumed.map(ref => {
      const material = refs.get(refKey(ref));
      counts.set(material?.star, (counts.get(material?.star) ?? 0) + 1);
      return material?.label ?? `${planRefLabel(ref)} (정보 없음)`;
    });
    // Count supplied references only; never infer a missing material's star from the result.
    const summary = [...counts].map(([star, count]) =>
      `${star === undefined ? '성급 미상 재료' : `${star}성`} ${count}개`).join(' + ');
    const result = describe(upgrade.result);
    refs.set(refKey(upgrade.result.ref), { label: `${index + 1}단계 결과 ${result}`, star: upgrade.result.star });
    return `${index + 1}. ${summary} → ${upgrade.result.star}성 1개\n  재료: ${materials.join(' + ')}\n  결과: ${result}`;
  });
  return [
    `영입 ${preview.price}코인 · 영입 후 ${preview.goldAfter}코인`,
    steps.length ? `자동 승급 ${steps.length}단계 · 아래 재료가 소모됩니다` : '자동 승급 없음',
    ...steps,
    `최종: ${describe(preview.result)}`,
    `배치 ${preview.boardCountAfter}/${rules.board.columns * rules.board.rows} · 대기석 ${preview.benchCountAfter}/${rules.benchCapacity}`,
  ].join('\n');
}
