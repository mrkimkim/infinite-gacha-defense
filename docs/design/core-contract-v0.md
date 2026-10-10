# 첫 실행 계약 v0 — 검토용 제안

Issue: [#3](https://github.com/mrkimkim/infinite-gacha-defense/issues/3) · owner: 리더 · assignment-generation: 1  
브랜치: leader/core-contract-v1 · base: 62ca8d0fddb6b51fef596f91d6ad668c83cd3176  
상태: 모모·키키가 실제 PR SHA를 읽고 검토할 초안. 이 문서의 게시/PR 생성은 설계 승인이나 구현 착수가 아닙니다.

[합의 근거와 미합의 목록](kickoff-decisions.md)이 권한·출처의 기준입니다. **합의**는 가역적인 첫 실험 범위이며 최종 게임 규칙이 아닙니다. 아래 **제안 P1–P8**은 구현 모호성을 없애기 위한 리더 의견으로 두 동료 확인이 필요합니다.

## 1. 범위와 단일 원본 — 제안 P1

첫 프로필은 단일/범위 두 역할, 5웨이브, 한 바퀴 누수, 배치 최대4입니다. 다음 growth 프로필만 동일1성3→2성 합성과 대기석3을 엽니다. 첫 프로필 대기석0은 기술 프로필에 한정한 제안입니다. 벤치0·판매 없음으로 배치4가 차면 추가 영입/편성 전환이 막히므로 이 프로필을 경제·가챠·전환 재미의 검증 근거로 사용하지 않습니다. 두 동료의 조건부 수용이며 전체 계약 승인은 아닙니다. 둔화/지원 A/B는 이후 별도 계약으로 분리합니다.

순수 TypeScript 코어 하나가 상태·명령 타입, 데이터, 좌표/경로, 검증, PRNG, tick, 직렬화를 소유합니다. 브라우저/Node CLI/봇은 같은 exports를 import합니다. 이번 문서는 실제 파일 구조·패키지·생산 코드를 만들지 않습니다. ECS·플러그인 프레임워크는 필요 없습니다.

| 코어 표면 제안 | 책임 |
|---|---|
| createMatch(seed, rulesId) | 초기 상태, 초기 후보 생성; 외부 IO 없음 |
| dispatch(state, command) | 검증 후 한 번에 수락 또는 원상태와 오류 반환 |
| advance(state, count) | combat에서 최대 count개의 고정 tick; 결과가 나면 조기 종료 |
| observe(state) | UI/봇 공용 현재 관측값; 내부 난수/미래 정보 제외 |
| canonicalState(state) | 고정 규칙의 상태 직렬화; 동일 UTF-8 bytes |
| replay(header, entries) | 같은 dispatch/advance로 처음부터 재생 |

UI는 입력→명령 변환과 그리기, CLI는 실행·파일 입출력만 담당합니다. 공격/유효 배치 판정/가격/해시 투영을 각 어댑터에 복사하지 않습니다. 렌더 보간·속도 배수·브라우저 숨김 탭은 전투 dt를 바꾸지 않습니다.

## 2. 최소 상태·시간·식별자 — 제안 P2

상태에는 schemaVersion, rulesId, rulesDigest, seed, rngState, nextEntityId, tick, phase, outcome(null|win|loss), wave, waveTick, spawnCursor, lives, gold, offers, units, enemies, acceptedLog를 둡니다.
- phase는 preparation / combat / result. 준비와 결과에서는 tick을 진행하지 않습니다. 첫 준비의 wave=1, waveTick=0, tick=0.
- units는 {id, typeId, star:1|2, location, cooldown}; location은 board {col,row:0..3} 또는 bench {slot:0..2}. 각 위치는 최대 한 ID. 위치는 별도 중복 보관하지 않습니다.
- enemies는 {id, typeId, hp, distance}. wave 스폰 목록은 규칙 데이터에서 읽고 spawnCursor만 상태에 둡니다. x/y는 distance에서 계산하며 별도 가변 상태로 두지 않습니다.
- 모든 수치·좌표·HP·cooldown·tick은 안전한 정수. tick은 50ms, 즉 20Hz 제안. 부동소수 물리와 벽시계 사용 금지.
- 전역 nextEntityId는 1부터 시작해 유닛/적 생성 때 하나씩 증가. ID 재사용 없음. 초기화/새 경기만 reset. 타입 ID는 single / splash / basic처럼 고정 ASCII.
- seed는 1..4294967295 정수만 허용. 잘못된 seed는 경기 생성 실패; 임의 보정 없음.
- PRNG 제안: uint32 xorshift32. x ^= x << 13; x ^= x >>> 17; x ^= x << 5; 매 추출 후 x >>> 0. 상태는 rngState 하나. 초기값은 seed. 모집 후보 한 개당 한 번 추출해 값 % 2로 single/splash 선택. 전투에는 난수 없음. 0을 제외한 홀수 길이 주기에 따른 극미한 %2 편향을 첫 기술 실험에서 허용하는 제안이며 엄밀한 무편향·제품 확률 보장이나 최종 가중 가챠 설계가 아닙니다.
- PRNG 구현·테스트 벡터는 코어 단일 원본. Math.random·Date.now·호스트 순회 순서로 결과를 정하지 않습니다.

## 3. 명령과 원자적 거부 — 제안 P3

모든 command는 plain JSON의 정확한 discriminated shape만 허용합니다. 잘못된 phase/type/ID/좌표/중복 ID/재화/수용량/숫자(NaN, Infinity, 소수 포함)/알 수 없는 필드는 검증 실패입니다.
실패하면 **상태 전체·재화·난수·ID·tick·후보·acceptedLog 모두 불변**입니다. 오류 코드는 반환값이며 상태에 쓰지 않습니다. 어댑터의 실패 입력 진단은 리플레이 상태 밖에 기록합니다. 계산 도중 일부 금액을 먼저 차감하거나 ID를 먼저 소모하지 않습니다.

| 명령 | 조건과 원자적 효과 |
|---|---|
| recruit {offerSlot,to} | preparation. 현재 후보0..2와 빈 목적지 지정. 보드 상한/벤치 프로필/재화 충족 시 비용 차감, 새1성 ID 생성·배치, 해당 후보만 새 난수로 보충. 빈칸 없는 구매는 실패; 자동합성 예약으로 예외 허용하지 않음 |
| move {unitId,to} | preparation. 자기 위치와 다른 빈 유효 위치로 무료 이동. 보드↔벤치 가능; 보드 상한 유지 |
| swap {aId,bId} | preparation. 서로 다른 두 기존 유닛의 위치를 무료 교환. 수/재화 불변 |
| startWave {} | preparation, 보드 유닛1개 이상. combat, waveTick=0, spawnCursor=0, 모든 배치 유닛 cooldown=0 |
| merge {ids:[a,b,c],keepId} | growth의 preparation에서만. §7 적용. 첫 프로필에서는 거부 |



정확한 JSON shape 제안(따옴표는 JSON의 큰따옴표, 각 variant에 적힌 키만 허용):
```text
Location =
  {"kind":"board","col":integer(0..3),"row":integer(0..3)}
  | {"kind":"bench","slot":integer(0..2)}
Command =
  {"type":"recruit","offerSlot":integer(0..2),"to":Location}
  | {"type":"move","unitId":positiveSafeInteger,"to":Location}
  | {"type":"swap","aId":positiveSafeInteger,"bId":positiveSafeInteger}
  | {"type":"startWave"}
  | {"type":"merge","ids":[positiveSafeInteger,positiveSafeInteger,positiveSafeInteger],
     "keepId":positiveSafeInteger}
```
merge.ids는 정확히3개이며 중복 불가, keepId는 그중 하나입니다. bench shape가 유효해도 벤치0 프로필에서는 목적지 거부입니다. ID는 문자열이 아닌 양의 안전한 정수입니다. null/배열/누락 키/추가 키를 object variant 대신 받지 않습니다. startWave의 정확한 표현은 {"type":"startWave"}이며 {}는 표의 인자 없음 표기입니다.

보관 이동은 move의 목적지를 bench로 지정합니다. 별도 place는 recruit의 board 목적지 또는 bench→board move를 뜻하며 중복 명령을 만들지 않습니다. 판매·리롤·전투 중 편성·수동 공격 명령은 이번 계약에 없습니다.
pause는 어댑터가 advance 호출을 멈추는 행위입니다. **숨김 탭도 자동 일시정지**로 취급합니다. 사용자 pause와 hidden flag를 따로 유지하고 둘 중 하나라도 참이면 진행하지 않습니다.
- pause/hidden 진입과 재개 경계에서 accumulator=0, lastTimestamp=null, schedulerEpoch를 증가시키고 예약된 callback을 취소합니다.
- callback은 예약 당시 epoch와 match 인스턴스 식별자를 캡처합니다. 현재 값과 다르거나 paused/hidden/result이면 advance·명령 dispatch 전에 즉시 폐기합니다.
- 재개 후 첫 callback은 timestamp만 저장하고 tick을 실행하지 않습니다. 이전 벽시계 시간은 따라잡지 않습니다. visible 복귀도 사용자가 수동 pause 중이면 자동 재개하지 않습니다.
- 이후 정상 dt만 accumulator에 쌓고 고정50ms 단위로 advance합니다. dt<0 또는 dt>250ms는 긴 중단으로 간주해 accumulator를 버리고 timestamp를 새로 잡으며 해당 callback은 tick0입니다(250ms 임계값은 새 운영 제안). 보이지 않던 동안의 전투·스폰을 몰아서 실행하지 않습니다.
- 웨이브 종료/결과/새 경기 경계도 accumulator를 비우고 epoch를 갱신합니다. 남은 tick을 다음 준비 구간에 넘기지 않습니다. CLI는 벽시계 없이 명시한 tick만 진행합니다.

재시작은 result에서 새 seed 또는 같은 seed로 createMatch를 호출하는 새 경기이며 이전 리플레이를 먼저 보존합니다. 진행 중 재시작/저장 복구는 후속 범위입니다.

## 4. 실제 닫힌 정사각형 경로 — 제안 P4

타일 한 변=1000 정수 단위. 배치 셀 중심은 (500+1000*col, 500+1000*row), 화면 y는 아래쪽 증가.
경로 꼭짓점은 A=(-500,-500), B=(4500,-500), C=(4500,4500), D=(-500,4500), 다시 A입니다. 경로 네 변은 각5000, 전체 L=20000. 4×4 영역 [0,4000]²의 바깥을 둘러싸며 열린 U자 경로가 아닙니다.

distance d에 대해 0≤d<L:
- 0≤d<5000: (-500+d,-500)
- 5000≤d<10000: (4500,-500+(d-5000))
- 10000≤d<15000: (4500-(d-10000),4500)
- 15000≤d<20000: (-500,4500-(d-15000))

마지막 선분도 A에 연결합니다. 렌더 경로는 닫히지만 첫 실험 적은 한 바퀴 완주 시 피해 후 제거하므로 modulo로 다시 살리지 않습니다. d+speed≥L이면 같은 tick에 leak 처리합니다. 입구/누수 지점은 A 하나이며 아트 표시는 별도입니다.

## 5. 공격과 tick 순서 — 제안 P5

사거리는 유닛 중심과 적 중심 사이 제곱거리 ≤ range². 경계 포함, 직선거리, 장애물/방향/충돌박스 없음.
표적은 사거리 안 살아 있는 적 중 distance가 가장 큰 적; 같으면 numeric id가 작은 적. 렌더 순서는 표적 선택에 영향 없음.
공격은 즉시 판정. 투사체 애니메이션은 결과를 지연시키지 않습니다. splash는 주표적 중심의 radius 안 살아 있는 적 모두를 같은 피해로 공격하며 반경 경계 포함. 한 공격 내 대상은 id 오름차순, 공격자의 사거리 밖 부수 대상도 폭발 반경 안이면 맞습니다.
cooldown은 남은 tick. 공격에 성공하면 역할값으로 설정하며 표적 없으면 0 유지. 벤치 유닛은 공격/쿨다운 처리 대상이 아닙니다.

한 combat tick은 다음 고정 순서입니다.
1. 현재 waveTick에 예정된 적을 spawnCursor 순서로 d=0에 생성.
2. 배치 유닛 cooldown을 max(0,cooldown-1)로 갱신.
3. 유닛 id 오름차순으로 cooldown=0인 공격 처리. 각 공격 직후 HP≤0 적 제거; 다음 유닛은 살아 있는 목록에서 다시 표적 선택. 동시 공격처럼 가장하지 않음.
4. 생존 적을 id 오름차순으로 speed만큼 이동. L 이상은 lives에서 leakDamage 차감 후 제거. lives는 최소0.
5. tick과 waveTick을 각각 1 증가. lives=0이면 즉시 result/loss. 실패가 웨이브 완료보다 우선.
6. 스폰을 모두 소모했고 생존 적0이면 웨이브 완료. wave=5면 result/win. 아니면 고정 보상 지급, wave+=1, preparation, waveTick=0, spawnCursor=0, 후보3개 갱신. 유닛/배치는 유지.

advance의 count는 1..10000 정수. preparation/result에서는 거부. result 또는 preparation 전환 시 요청량보다 적게 실행하고 실제 실행 tick 수를 반환합니다. 어댑터는 다음 웨이브를 자동 시작하지 않습니다.

## 6. 실험 데이터 초깃값 — 제안 P6, 밸런스 합의 아님

| 값 | 제안 |
|---|---|
| 시작 lives / gold | 10 / 6 |
| 모집 후보 수 / 가격 | 3 / 유닛당2 |
| 시작 유닛 | 없음; 구매→배치로 시작 |
| 웨이브 완료 보상 | 비최종 웨이브당 gold+3, 처치 보상 없음 |
| 단일1성 | damage4, range3000, cooldown10 tick |
| 범위1성 | damage2, range3000, cooldown15 tick, radius1000 |
| 적 종류 | 첫 계약 basic 하나. 빠른 적·보스는 이후 |
| wave w=1..5의 적 수 / HP | 3+2*w / 8+4*w |
| 적 speed / leakDamage | 100 단위/tick / 1 |
| 스폰 일정 | 적 i=0..count-1을 waveTick=10*i에 생성 |
| 배치 / 벤치 상한 | 합의 배치4; 첫 프로필 벤치0 제안; growth 합의 벤치3 |

모든 값은 버전 있는 규칙 데이터 한 곳에 둡니다. 같은 rulesId의 데이터를 조용히 바꾸지 않습니다. 데이터 변경은 새 rulesId/digest로 구별합니다. 이 값으로 재미·승률·중앙 활용이 확보됐다는 주장은 하지 않습니다. 판매가 없는 첫 실험에서 후보 막힘·편성 고착 위험을 실제 플레이로 확인할 항목입니다.

## 7. 다음 성장 실험 — 제안 P7

growth 프로필은 preparation에서만 같은 typeId의 서로 다른 1성 ID 정확히3개를 받습니다. 세 ID는 board/bench 어디든 가능하며 keepId는 그중 하나여야 합니다.
검증 후 세 ID 모두 제거하고 새 ID 하나를 할당한 같은 typeId의 2성을 **keepId의 이전 위치**에 생성합니다. 새 ID임을 로그에 남깁니다. 2성의 피해=1성의2배, 사거리/쿨다운/반경 동일은 새 제안입니다.
재화 변화 없음, XP/레벨/판매 XP 이전 없음, 2성의 추가 합성 없음. board4/bench3 상한 유지. 결과 위치는 입력으로 이미 점유한 keepId 위치여서 별도 빈칸 탐색·랜덤 선택이 없습니다.
성공 이벤트는 consumedIds(정렬), resultId, resultLocation, typeId, star=2를 포함합니다. 중복/없는/2성/타입 혼합 ID 또는 keepId 누락은 전체 no-op. 자동합성 없음. 가득 찬 벤치에서 recruit→미래 합성을 예상한 예외는 없음.
same-star3→2의 기술 계약 뒤에만 성장 실험을 켭니다. 성장 프로필 도입이 첫 PR의 코드 구현 범위를 늘리지 않습니다.

## 8. 로그·해시·봇 정보 경계 — 제안 P8

리플레이 header는 schemaVersion, rulesId, rulesDigest, seed. entries는 수락 순서 seq=1..N로 기록합니다.
- command entry: seq, atTick, command, 결과 생성/소모 ID 이벤트.
- advance entry: seq, startTick, executedTicks. 시간 배속이나 렌더 프레임 수는 기록하지 않음.
- 거부된 명령은 authoritative log에 넣지 않습니다. 관측용 오류 기록은 별도.
- 재생은 현재 tick=atTick/startTick 확인 후 동일 코어 호출. 생성 이벤트를 재계산해 기록과 비교; 로그가 ID를 강제로 삽입하지 않음.

canonicalState의 루트 키는 정확히 schemaVersion, rulesId, **rulesDigest**, seed, rngState, nextEntityId, tick, phase, outcome, wave, waveTick, spawnCursor, lives, gold, offers, units, enemies입니다. 이 키들의 모든 중첩 데이터도 포함합니다. schemaVersion/rulesId/rulesDigest는 제외하지 않습니다.
제외는 acceptedLog 및 코어 밖 진단/뷰/어댑터 값뿐입니다. stateHash는 계산 결과로 반환하는 envelope 값이며 코어 상태에 저장하지 않습니다(자기참조 없음). 미래 상태 필드는 스키마 버전과 이 명시적 투영을 함께 갱신해야 하며 임의 누락할 수 없습니다. 문자열 키를 ASCII 오름차순 정렬한 JSON, 공백 없음, UTF-8; 숫자는 안전한 정수, 배열은 offers는 slot순, units/enemies는 numeric id순, 선택 필드는 null로 명시하고 undefined 금지. phase/result는 고정 enum. 상태 해시는 이 bytes의 SHA-256 소문자 hex. SHA-256은 tick 로직 밖에서 계산하고 브라우저/CLI가 같은 canonicalState bytes를 사용합니다.
규칙 digest는 schemaVersion, rulesId와 실제 모집·유닛·적·웨이브·경로·상한·시간·PRNG 정의 데이터 전체를 같은 canonical JSON 규칙으로 직렬화한 SHA-256입니다. rulesDigest 필드 자체, 주석·표시 전용 메타데이터만 제외합니다. 배열 순서는 의미 있는 규칙 데이터 순서를 유지하며 객체 키만 정렬합니다. 상태해시와 acceptedLog 일치 검증은 별도이며 해시 하나가 로그 출처를 증명하지 않습니다.

**batching 동등성:** 같은 초기 seed/규칙에서 같은 simulation tick에 같은 순서의 논리 command를 적용하고 같은 tick까지 진행하면 canonicalState/상태 해시/엔티티 ID/게임 결과는 같아야 합니다. advance(100)과 advance(1)×100은 이 상태 동등성 대상이지만 acceptedLog의 seq·entry 수는 달라질 수 있습니다. 원문 로그 바이트 일치는 동일 advance batching까지 제공했을 때만 요구합니다. command의 atTick과 command들 사이 상대 순서는 같아야 하며 raw seq는 batching 간 비교하지 않습니다. 준비/결과 전환으로 조기 종료되면 동일한 실제 종료 tick에서 비교합니다. 로그 정규화 프레임워크는 이번 계약에 추가하지 않습니다.

**replay 실패 계약:** replay는 현재 경기 객체를 받거나 수정하지 않고 임시 경기에서 실행합니다.
1. 경기 생성 전에 header의 정확한 shape {schemaVersion,rulesId,rulesDigest,seed}, 지원 schemaVersion, 등록된 rulesId, 로컬 규칙 digest의 일치, seed와 모든 entry shape/seq 연속성을 검증합니다. 실패 시 createMatch/명령 적용/난수 추출을 시작하지 않습니다.
2. entry 적용 전 atTick/startTick이 임시 경기 tick과 같은지 확인합니다. command 거부, 실행 tick 수 차이, 생성/소모 ID 이벤트 불일치는 즉시 실패입니다. 이벤트는 코어가 계산하고 로그는 이를 덮어쓰지 않습니다.
3. 성공은 {ok:true,state}이며 선택적인 expectedFinalHash 검증을 요청했다면 해시 일치 후에만 반환합니다. 실패는 {ok:false,error:{code,entryIndex|null}}만 반환하고 임시 경기·로그를 폐기합니다. 부분 재생 상태나 RNG를 정상 경기로 반환하지 않습니다. 기존 UI 경기는 성공 시에만 교체합니다.
4. 오류 code: BAD_FORMAT, UNSUPPORTED_SCHEMA, UNKNOWN_RULES, RULES_DIGEST_MISMATCH, BAD_SEED, BAD_SEQUENCE, TICK_MISMATCH, COMMAND_REJECTED, ADVANCE_MISMATCH, EVENT_MISMATCH, FINAL_HASH_MISMATCH. header 오류의 entryIndex는 null, entry 오류는0부터 시작하는 인덱스입니다. 오류 메시지/관측용 진단은 상태 해시에 포함하지 않습니다.

observe는 현재 보드/벤치/적/후보/재화/phase/tick/공개 규칙만 반환합니다. 봇에 seed, rngState, 미래 후보열, 코어 상태 참조나 replay header를 주지 않습니다. 봇은 observe와 합법 명령 인터페이스로만 행동합니다. 봇 자체 난수는 게임 PRNG와 분리된 botSeed를 사용하고 미래 가챠 결과를 엿보는 평가를 금지합니다. 로컬 게임의 정보 경계이며 악의적인 클라이언트 보안 보장은 아닙니다.

## 9. 문서 승인 및 이후 검증 체크리스트

이번 PR에는 생산 코드·테스트 실행·게임 플레이가 없습니다. 모모·키키는 P1–P8과 다음 모호성에 대해 실제 SHA로 리뷰합니다: 첫 벤치0/판매 없음, 준비 중 구매 목적지, 좌표·사거리, 공격 순서, 수치표, 합성 결과 위치·2배 피해, 로그/해시 투영.

이후 구현의 필수 사례:
- 거부 명령마다 전체 상태/난수/ID/재화/로그 불변; 구매 부족·꽉 찬 칸·전투 중 이동·합성 중복ID.
- 경로 d=0/4999/5000/9999/10000/14999/15000/19999, 마지막 선분과 overshoot leak, 모서리 이동.
- 사거리/폭발 경계 포함, 거리 동률의 id 우선, 선행 공격 처치 후 재표적, cooldown 간격.
- 동일 seed+명령+실행 tick으로 Node/브라우저의 canonical bytes/해시/생성 ID/결과 일치.
- 같은 seed 재시작 재현; 다른 seed의 모집 차이; 잘못된 버전/digest 리플레이 거부.
- 무유닛 startWave 거부, 최종 적 누수로 lives=0인 tick의 패배 우선, 결과 이후 advance 거부.
- growth 합성3→1 개수 감소·새ID·keep 위치·금액 불변; 포화 영입이 자동합성을 가정하지 않음.
- 실제 브라우저 시작→구매/배치→5웨이브 결과→재시작과 패배 경로. 봇 승리를 재미 증거로 쓰지 않음.

최종 게임 분량·메타 성장·제3역할·누적 패배 규칙·정식 상한은 이 계약 밖의 후속 공동 판단입니다.

## 변경 검토 요청
모모 [6093284745](https://github.com/mrkimkim/infinite-gacha-defense/pull/6#issuecomment-6093284745), 키키 [6093324107](https://github.com/mrkimkim/infinite-gacha-defense/pull/6#issuecomment-6093324107)의 실제 changes_requested를 반영한 문서 수정 제안입니다. batching 동등성, JSON shape, 리플레이의 사전 검증/원자적 실패, digest 투영, pause/hidden/stale callback 규칙을 새 SHA에서 재검토해야 합니다. 첫 기술 프로필은 편성·경제 재미 검증이 아닙니다. 이전 SHA의 조건부 동의를 현재 SHA 전체 승인으로 승계하지 않습니다.
