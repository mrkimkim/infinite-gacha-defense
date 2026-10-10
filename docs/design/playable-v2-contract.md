# playable-v2 구현 경계와 실험 계약

상태: **main의 schema3 실행 계약과 동기화 / 현재 문서 SHA 독립 재리뷰 대기**. 최종 IP·밸런스 승인이 아니다.
문서 동기화 담당 모모 / 기존 branch `leader/contract-auto-merge` / [PR #36 후속 배정][sync-assignment].
대조 기준 main `8140bda52445c348d1c9dde6fc3265c0962af010`. 원장은 [Issue #21][issue], 코어 배정 이력은 [#23 generation2][generation2]다. 아래 현재 구현 설명은 이 SHA의 `src/core-v2` 기준이며 타입 정의·실행 검증 결과를 대신하지 않는다.

## 1. 현재 확정 방향과 자동승급 공통 경계

4×4 보드에서 영입 → 자동승급 → 벤치/편성/시너지 → 전투 → 판매/리롤로 다음 전투 대응을 바꾼다. **개별 기물 레벨·XP·XP책·수동합성을 제거한다.** 희귀도는 캐릭터 정의의 고정 등급(일반·고급·희귀·영웅·전설), 성급은 개체의 ★1~3으로 분리한다. IP마다 서로 다른8명 구성 방향이 요구됐지만 최종 로스터·출시 규모·등급 배치·확률은 확정되지 않았다. 현재 등록 데이터는 중립 ID `fixture-01`~`fixture-08`의 기술 기물8개·5희귀도이며 최종 IP 로스터가 아니다. 과거6명/3등급 모델을 현재 fixture와 혼동하지 않는다.

**별도 출전 인원 상한은 없다.** 보드의 공간·충돌 제약은 남는다. 첫 실험은 모든 성급1칸, 벤치8슬롯으로 구분한다. 3성2×2 점유는 미정이며 이 실험에 암묵 적용하지 않는다. 채택하려면 footprint/anchor/충돌/승급 후 공간 부족·보관·배치 선택 규칙을 따로 결정해야 한다.

- 구매·리롤·이동·교환·판매·시작은 준비 단계 전용. 전투 편성은 잠기고 준비의 적·효과·cooldown·시간은 정지한다. 다음 전투는 수동 시작이며 출전0은 거부한다.
- 상점3칸, 최초/다음 준비 진입당1회 무료 전체갱신, 구매칸 비움·즉시 보충 없음, 유료 전체 리롤·잠금 없음이라는 기존 흐름은 유지한다. 구매 RNG 소비0. 현재 fixture는 희귀도 가중치 추첨 후 해당 희귀도 정의 중 균등추첨한다(§3). 기존6명 균등추첨이나 현재 실험 수치를 최종 규칙으로 승계하지 않는다.
- 구매 입력은 `recruit{offerSlot}` 공통 경계를 따른다. 사용자가 빈 벤치를 지정하지 않는다. 코어의 **같은 순수 구매계획**으로 가능 여부/거절 사유/예상 위치/승급 체인을 관측하고 실제 구매도 판정한다. UI가 공간·합성을 다시 계산하지 않는다.
- 새 영입을 임시 상태에 포함해 보드+벤치 전체의 동일 캐릭터 정의·동일 성급인 서로 다른3개 개체를 ID 오름차순으로 선택한다. ★1→★2→★3 순으로 연쇄를 안정화하며 ★3은 더 합성하지 않는다. 정상 상태에는 승급 가능한3개가 남지 않는다. 영입이 새 승급의 계기이며 이동/판매는 개수를 늘리지 않으므로 별도 합성 버튼/명령을 만들지 않는다.
- 매 승급은 보드 재료가 있으면 그중 가장 오래된 ID의 자리, 전부 벤치면 재료가 있던 최저 슬롯을 보존한다. 결과는 새 ID이며 재료의 최대 남은 cooldown을 승계한다. 중간 승급까지 소비 ID·새 결과·결과 위치를 이벤트로 제공한다. 현재 `CommandEvent`의 단일 `recruited` 이벤트에 `arrival`, 순서 있는 `upgrades`, `result`가 담긴다.
- 단독 영입은 최저 빈 벤치에 놓는다. 임의 보드 배치나 다른 기물 밀어내기는 없다. 가득 찬 벤치도 임시 영입이 합성 재료로 소비되어 연쇄 결과가 유효하게 들어가면 허용한다. 임시 공간을 독립 기물 보관으로 남기지 않는다. 어떤 결과 배치가 불가능하면 구매 전체를 거부한다.
- 구매·코인 차감·후보 비움·ID 발급·중간/최종 승급·로그는 **계획 검증 후 한 번에 커밋**한다. 거절 시 코인/후보/ID/기물/로그/RNG는 전부 원상태다. 예고의 기존 기물은 `PlanRef.existing.unitId`, 새 영입·중간 결과는 `PlanRef.created.creationIndex`로 표현해 다음 내부 ID를 노출하지 않는다. `previewRecruit`의 오류 순서는 형식 → 단계 → 슬롯 → 빈 후보 → 코인 → 공간 → 안전정수 검사이며, dispatch는 명령 형태를 먼저 검증한 뒤 같은 계획을 사용한다.
- 판매는 기물 제거와 코인 회수를 원자 처리하며 XP책은 생성하지 않는다. 킬 코인은 없다. 성공 전환과 최종 성공에는 코인 보상을1회 지급하고 실패는 미지급한다. 현재 fixture 보상은6코인이며 최종 보상액은 미정이다. 다음 준비의 무료갱신은 전환당1회다. XP 분배용 출전ID 명단과 XP 보상/예고는 제거한다.

[모모 제안][auto-momo]·[키키 의견][auto-kiki]·[키키 후속 동의][auto-kiki-followup]를 읽고 [리더 합의 체크포인트][auto-consensus]에 기록된 공통 경계만 반영했다. 아래 실험 수치에 같은 합의가 생겼다고 확대하지 않는다.

## 2. 시간·타깃·피해

시간/리플레이의 50ms tick은 유지한다. **총20웨이브, 보스5/10/15/20, 일반 최대400tick·보스 최대600tick은 기존 비교 실험 일정이며 최종 콘텐츠 길이/난도 확정이 아니다.** 아래 웨이브 번호와 기한 예시는 이 프로필 안의 동작 경계다. 마지막 예정 스폰 소진+생존 적0이면 조기 준비 전환 또는 최종 승리한다. 미래 스폰을 생략하거나 다음 전투를 자동 시작하지 않는다.

5/10/15는 보스가 기한 안에 죽었으면 구간 끝에 일반 잔존을 다음 준비로 이월한다.20은 기한 내 일반 적까지 전부 제거해야 한다. 보스가 준비로 이월되지는 않는다. 잔존 수는 보스 포함이며 `count >= limit`이면 즉시 패배, 유예 없음. 경고는 limit의80%부터다.

전역 `tick`은 경기 전체에서 단조증가하며 효과 `expireAt`과 이벤트 timestamp는 전역 tick 기준이다. `waveTick`은 startWave마다0으로 리셋하며 스폰 시각·구간400/600·보스기한은 waveTick 기준이다. 첫 advance는 전역 tick1, 각 웨이브의 첫 처리는 waveTick1이다. 전투의 처리 한 번마다 둘 다1씩 증가하고 준비에서는 진행하지 않는다. 각 처리의 순서는 다음과 같다.

1. `expireAt <= tick`인 효과 만료.
2. 예정 스폰.
3. unitId 오름차순으로 각 유닛의 cooldown 감소/공격, 공격 직후 사망 제거.
4. 생존 적 이동.
5. 잔존 수 패배 판정.
6. 보스/최종 기한 실패 판정.
7. 조기 또는 최대 구간 성공 전환·보상.

웨이브 기한 `waveTick=600`은 해당 웨이브의600번째 공격·사망 정리·이동까지 처리한 뒤 판정한다. 예를 들어5웨이브 시작 시 전역 tick이 T라면 첫 처리는 전역 T+1/waveTick1, 기한 처리는 전역 T+600/waveTick600이다. 보스기한을 전역 tick600과 비교하지 않는다. 따라서 해당 공격으로 보스/마지막 적을 잡으면 기한 실패를 피할 수 있다. 경로의 화면 modulo 위치와 누적 이동 거리는 분리한다.

일반 타깃은 사거리 내 누적거리 내림차순, 동률 enemyId 오름차순이다. 보스 특화는 사거리 내 보스를 먼저 고른다. 각 유닛의 다중/범위 공격은 그 공격 직전 정렬된 대상 스냅샷으로 처리하고 즉시 사망 제거하여 뒤 유닛이 죽은 적을 다시 선택하지 않게 한다. 범위 기물의 공격 중심은 공격 직전 주 타깃 위치로 고정하며 첫 대상이 사망해도 바꾸지 않는다. 화면상 유클리드 거리 제곱으로 범위를 판정한다. 다중2발은 서로 다른 최대2대상이며1명에게2발을 몰지 않는다. 범위 대상도 누적거리 내림차순·enemyId 오름차순으로 정렬하며 거리 제곱이 반경 제곱 이하인 경계를 포함한다. 이펙트는 확정된 hit를 표시하며 렌더링 완료나 애니메이션 시간이 코어 판정/시간에 영향을 주지 않는다.

피해는 기본×별×시너지×해당 보스 배율의 **전체 유리수 곱을 한 번만 내림**, 최소1이다. 중간 배율마다 내리지 않는다. 실제 hit damage는 대상 남은HP 이하로 clamp한다. 각 정수 곱의 안전 범위를 검사한다. 별은 피해만 성장시키며 사거리·둔화·지원 강도는 성장시키지 않는다.

공격과 cooldown 진행은 보드 기물만 대상이며 벤치는 전투 중에도 동결한다. 보드 복귀 시 남은 값을 이어간다. cooldown은 해당 tick에 먼저 `max(0, cooldown−1)`로 감소한 뒤0이면 공격 가능하다. 공격하면 적용 주기로 새 cooldown을 설정하고 같은 tick에 다시 감소/재공격하지 않는다. 예: 신규 cooldown0이 tick1에 주기12로 공격하면 tick2에서11, tick12에서1, tick13에서0이 되어 다음 공격한다(간격12tick). 신규 영입0, 합성은 입력 최대 잔여값 승계, 준비·이동·교환으로 리셋하지 않는다. 버프는 다음 공격 직후 새 주기에만 적용하며 기존 잔여값은 소급 재계산하지 않는다.

## 3. 실험 프로필과 역할 데이터

현재 `profiles.ts`의 `playable-v2-gen2-fixture1-count40` / `playable-v2-gen2-fixture1-count80` 두 등록 프로필을 사용한다. 둘 다 `status: 'unapproved-fixture'`이며 프로필 식별자를 제외하면 잔존 한계·경고만 다르다. 아래 값은 **현재 실행되는 고정 기술 fixture**이고 최종 경제·확률·성능 승인이 아니다. 과거 proposal1의 경제A/B·XP/책/수동합성 비교를 현재 모델로 승계하지 않는다.

| 항목 | 현재 schema3 fixture / 최종 지위 |
|---|---|
| 시작 / 리롤 / 웨이브보상 | 12 / 1 / 6코인; 최종 경제 미정 |
| 일반·고급·희귀·영웅·전설 가중치 | 500·250·150·75·25 / 합1000; 이후 해당 등급 내 균등추첨 |
| 같은 순서의 영입 가격 | 2·3·4·5·6코인; 최종 비용 미정 |
| ★1·2·3 판매금 | 일반/고급1·3·9, 희귀/영웅2·6·18, 전설3·9·27코인 |
| 잔존 한계·경고 | count40은40·32, count80은80·64 |
| 별 피해 배율 | 100·220·484%; 최종 성능 미정 |
| Lv/XP/회수율/XP책 | 현재 모델에 없음 |
| 콘텐츠 규모 | 기술 기물8개·5희귀도; IP별8명 방향·48/80명 후보 계획과 별개이며 최종 로스터·경기별 풀 미정 |

현재20웨이브 fixture는 일반 적 수 `6+w`, 기본HP `12+4w+floor(w²/4)`, basic/swift/sturdy 순환, 스폰tick `1+12i`를 사용한다. swift HP는 기본의70% 내림(최소1), sturdy는160% 내림이며 이속은 basic70/swift110/sturdy45/boss55다. 매5웨이브 보스는tick1에 먼저 스폰하며 HP `120+40w`다. 이는 명시된 비교용 데이터이며 최종 스폰·보스 밸런스가 아니다.

현재 중립 기술 기물은 다음과 같다. [과거 역할 절충안][roles]·[모모][role-ack]·[키키][k-role-ack]의 이름을 현재 ID나 최종 IP 배치로 승계하지 않는다. 좌표1칸=1000이며 이 표는 원작 능력·외형/아트 공개 승인이 아니다.

| 기술 ID / 희귀도 | 피해 / 주기tick / 사거리 | 자동 행동 |
|---|---|---|
| fixture-01 / 일반 | 6 / 12 / 3200 | 단일 즉시 피해 |
| fixture-02 / 희귀 | 5 / 24 / 3000 | 주 타깃 주변 반경1100의 모든 적에 즉시 범위 피해 |
| fixture-03 / 고급 | 대상당3 / 10 / 2200 | 서로 다른 최대2대상, 적1명이면1대상 |
| fixture-04 / 일반 | 3 / 20 / 3000 | 단일 피해와 이동속도30% 감소40tick |
| fixture-05 / 영웅 | 3 / 20 / 2800 | 단일 공격+인접4방향 아군 공격주기10% 단축 |
| fixture-06 / 전설 | 10 / 30 / 4500 | 보스 우선, 보스 피해×2, 없으면 일반 타깃 |
| fixture-07 / 고급 | 6 / 12 / 3200 | 단일 즉시 피해 |
| fixture-08 / 희귀 | 5 / 24 / 3000 | 주 타깃 주변 반경1100의 모든 적에 즉시 범위 피해 |

지원은 자신/벤치 제외, 동종 중첩 없음. 새 주기는 `max(1, floor(기본주기×90/100))`. 집중(fixture-01·03·06·07)은 피해, 협력(fixture-02·04·05·08)은 사거리 +5/+10%를 **해당 태그 기물에만** 준다. 출전 고유 캐릭터2/3명 기준이며 중복/별/벤치는 수를 더하지 않는다. 준비 명령 후 파생 시너지/오라를 표시한다.

둔화는 일반/보스 모두 이동속도30% 감소40tick으로 같고, 재적용 시 기존/신규 만료 중 더 늦은 값으로 갱신한다. 강도 합산이나 별도 보스 저항은 없다. 사거리는 `floor(baseRange×(100+시너지증가%)/100)`이며 집중 시너지 배율은 피해의 전체 유리수 분자에 함께 넣어 한 번만 내린다.

## 4. 공유 API 원칙

technical-v1의 exported API·schema1·canonical17키와 기존 bytes/hash/리플레이 해석을 유지한다. 새 규칙은 별도 진입점·명시적으로 구분된 schema/rulesId·고정 digest로 격리하고 브라우저/Node가 같은 TypeScript 코어를 사용한다. 기존 전역 규칙을 바꾸거나 임의 데이터 주입으로 digest를 우회하지 않는다. XP 기반 proposal1의 schema/canonical19키/리플레이에 새 규칙을 조용히 덮어쓰지 않는다. 현재 `src/core-v2`는 schema3이며 형식이 유효한 proposal1/schema2 replay 헤더를 `UNSUPPORTED_SCHEMA`로 거부한다. canonical 상태는 `profiles.ts`의17키로 구성하며 `acceptedLog`는 제외한다. 명령 로그에는 이벤트를 포함하고 advance 로그에는 실행tick수를 기록하며 replay가 순서·시간·이벤트·최종hash를 대조한다. 5희귀도·확률표·별배율·자동승급 순서·footprint를 포함한 전체 고정 RuleData의 canonical JSON SHA-256을 등록 digest로 사용한다. 데이터 주입형 구성은 검증된 프로필 등록을 뜻하며 미검증 런타임 교체 허용이 아니다.

준비 명령은 `recruit`, `reroll`, `move`, `swap`, `sell`, `startWave`. pause/restart는 어댑터 기능이며 새 경기는 createMatch로 시작한다. 명령의 ID·재화·공간 검증 및 적용은 원자적이다. 거절 시 ID/코인/후보/기물/RNG/로그 불변. 수동 `merge`/`useBook`, 개별 level/xp/books, XP 분배용 waveParticipants, XP/레벨/책 관측·이벤트는 새 모델에서 제거한다. 비정상 advance·안전정수 overflow도 사전 검증/복제 상태로 처리하여 부분 진행을 반환하지 않는다.

observe는 분리된 readonly 관측이다. 필수 항목은 배치/벤치/상점, 희귀도와 성급, 실효 피해·사거리·활성 시너지, 잔존 수·한계/경고, 구간 시간/보스 마감, 판매 코인, 후보별 구매 가능 여부/불가 사유/예상 승급 체인·최종 위치, 준비/결과의 잔존 적과 효과다. 공개 `rules.rarities`와 `shopSampling`으로 현재 fixture의 가중치·추첨 방식을 설명하며 최종 확률 승인과 구분한다. RNG/seed/다음ID/미래 랜덤후보/acceptedLog는 정책 관측에 노출하지 않는다. 다음 웨이브 예고는 공개 고정 패턴만 제공한다. UI가 계산식이나 진행 권한을 복제하지 않는다.

**현재 공유 API는 `src/core-v2/index.ts`와 `types.ts`, 오류 판정은 `validation.ts`·`planner.ts`·`engine.ts`, canonical/replay는 `profiles.ts`·`replay.ts`가 기준이다.** 두 어댑터는 같은 코어를 import하며 이 문서에 타입을 별도로 재정의하지 않는다. [이전 API 스케치][api]의 XP/수동합성 부분은 폐기된 입력이다. PR29의 이전 승인 SHA를 새 API 승인으로 쓰지 않으며 문서에 타입을 중복 정의하지 않는다.

[PR #48](https://github.com/mrkimkim/infinite-gacha-defense/pull/48)의 schema4는 별도 opt-in 공격 타이밍 실험이다. 검토 head `493590fba179c2c100f628fb9aeb3d5e0de37c0b`에서 fixture-01·02만 준비/발사/도착 피해를 실험하며 schema3 기본 코어·즉시 피해 계약을 바꾸지 않는다. 전체 IP·고유스킬·최종 수치 확정이 아니다.

## 5. 수용 기준

- 정확성: v1 과거 fixture/seed1 UI 로그 회귀, v2 Node↔브라우저 canonical/hash/로그와 batching 일치, strict 입력·프로필 검사 및 실패 원자성.
- 경제/승급: 동일 정의·성급3개 및1→2→3 연쇄, 결과자리 우선순위·중간 새ID·cooldown 최대, 포화벤치 구매 성공/전체거절, 단독 영입 최저 빈 벤치, 보드 임의배치/밀어내기 없음, 예고와 실행 결과 일치, 정상 상태에 승급가능3개 없음, 매매/승급 재화 복제 금지, 무료갱신/보상 중복 금지, 거절 RNG/ID/로그 불변. 별도 출전8명 상한 제거와 실제 공간 제약을 구분한다. XP/책/수동합성 명령·이벤트가 새 모델에 남지 않는지 확인한다.
- 전투: 전역 tick과 waveTick 분리/효과만료/해당 웨이브600번째 공격, count 경계·동일tick 처치, 예정 스폰 전 조기종료 금지, 최종 잔존 실패, cooldown 실제 간격, 준비 완전 정지, 공격 스냅샷/실제 hit damage 검사.
- 정책: 일반/숙련 모두 같은 공개 관측만 사용한다. 일반을 무작위 초보로 약화하지 않으며 숙련 탐색 RNG는 경기 RNG와 분리한다. 현재 count40/count80 고정 fixture 비교와 향후 경제 비교군 결정을 구분하며, 조정/검증 seed를 분리하고 프로필별500경기를 검증 목표 후보로 삼는다. 실행 완료나 합격 증거가 아니다. 정책ID·seed·리플레이와 역할전환/첫2·3성/유효행동/유휴웨이브/벤치포화/코인/대기/보스실패/편성다양성을 기록한다. 같은 seed도 리롤 횟수에 따라 상점 경험이 다름을 명시한다. 포화벤치·연쇄승급·복제지원·매매 재사용 stress는 별도 집계한다.
- 화면: 짧은 높이에서 보드/벤치/핵심조작·잔존/보스시간 동시 확인, 희귀도와 ★성급 분리, 사거리·공격/피격·판매회수·구매예고/거절이유 표시, 접힌 시너지의 활성단계 표시. 실제 viewport는 웹 수용 체크포인트에서 고정한다.
- 세 독립 DOT가 실제 화면의 성장 루프와6역할 구분·승패/재시작을 플레이하고 정확한 SHA로 교차 리뷰한다. 봇 승률·브라우저 조작을 사람의 재미 평가로 부르지 않는다. 정확성 결함은 통과시키지 않는다.

## 근거와 남은 승인

이전 [초안 키키 리뷰][kr]·[초안 모모 리뷰][mr]·[경계 조정][boundary]·[후속 정리][finalize]·[시간 기준 리뷰][time-review] 중 현재 요구와 충돌하지 않는 전투·시간·결정적 리플레이 경계는 보존했다. [정책 계획][policy]의 XP/책 항목은 새 규칙에서 제외한다. 최신 근거는 [자동승급 합의][auto-consensus]와 [코어 generation2 배정][generation2]이며 과거 SHA 승인을 이 문서나 새 API 승인으로 승계하지 않는다.

남은 결정: 현재 문서 SHA 재리뷰(과거 SHA 승인은 승계하지 않음), 희귀도별 최종 확률·가격·판매금·성능·스폰/보스 데이터, 최종 로스터·경기별 뽑기 풀·출시 규모·웨이브 길이, 3성2×2 채택 및 공간 부족 처리. 1칸 실험은 이 미결정 사항과 분리한다. 구현은 별도 배정 원장을 따르며 아트/원본 설정 공개는 [Issue #19](https://github.com/mrkimkim/infinite-gacha-defense/issues/19)와 분리한다.

[issue]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21
[kr]: https://github.com/mrkimkim/infinite-gacha-defense/pull/22#issuecomment-6094407183
[mr]: https://github.com/mrkimkim/infinite-gacha-defense/pull/22#issuecomment-6094410314
[boundary]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21#issuecomment-6094394416
[finalize]: https://github.com/mrkimkim/infinite-gacha-defense/pull/22#issuecomment-6094420868
[api]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21#issuecomment-6094372523
[roles]: https://github.com/mrkimkim/infinite-gacha-defense/issues/19#issuecomment-6094396481
[role-ack]: https://github.com/mrkimkim/infinite-gacha-defense/issues/19#issuecomment-6094411771
[policy]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21#issuecomment-6094398759

[k-role-ack]: https://github.com/mrkimkim/infinite-gacha-defense/issues/19#issuecomment-6094424317

[time-review]: https://github.com/mrkimkim/infinite-gacha-defense/pull/22#issuecomment-6094445696

[auto-momo]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21#issuecomment-6094707191
[auto-kiki]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21#issuecomment-6094691603
[auto-kiki-followup]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21#issuecomment-6094713285
[auto-consensus]: https://github.com/mrkimkim/infinite-gacha-defense/issues/21#issuecomment-6094731321
[generation2]: https://github.com/mrkimkim/infinite-gacha-defense/issues/23#issuecomment-6094839654

[sync-assignment]: https://github.com/mrkimkim/infinite-gacha-defense/pull/36#issuecomment-6100521620
