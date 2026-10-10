# 구현을 보기 전에 고정한 입력과 기대값

Issue #14 generation2. 준비 fixture는 승인 계약7a118337의 §2/3/6에서 직접 만든 기대값입니다. 코어 출력에서 복사한 golden hash가 아닙니다. JSON의 steps/expect는 테스트 시나리오 표현이며 코어 replay entry 형식을 임의로 확정하지 않습니다. 실제 rulesId·반환형·이벤트 shape는 공개 API 게시 후 연결합니다.

현재 게임 실행 결과: NOT_RUN(API 미게시). 이 파일의 JSON parse 성공을 게임 테스트 통과로 부르지 않습니다. seed1의 실제 모집 결과, rulesDigest, canonical hash는 아직 미확정이며 만들지 않습니다.

연결 후 검증:

1. 각 거부에서 structuredClone 전체 상태(acceptedLog 포함) 불변을 확인하고 각 수락의 명세 기대값을 확인합니다. 동일 fixture에서 거부 step을 제거한 실행과 다음 합법 입력 결과를 대조합니다.
2. core가 만든 header/acceptedLog를 replay하여 canonical bytes와 로그를 비교합니다. 동일 입력의 Node 두 번/실제 Chromium 한 번에서 매 단계 canonical/ID/이벤트를 대조합니다.
3. 동일 준비 명령 후 advance100 한 번과 advance1을100번 실행합니다. preparation/result 조기 종료가 있으면 실제 종료 tick을 맞추고 상태만 비교합니다. raw log entry 수 차이는 허용합니다.
4. 정상 replay 사본에서 schemaVersion, rulesId, rulesDigest, seed, seq, atTick/startTick, executedTicks, 생성 이벤트 ID, expectedFinalHash를 각각 한 곳만 변조합니다. 계약 오류 code/entryIndex 및 부분 상태 부재를 검사합니다. fixture 자체에 가짜 digest나 guessed event shape를 고정하지 않습니다.
5. seed1/2/4294967295 재현, seed0/-1/1.5/4294967296 거부를 별도 실행합니다. seed마다 같은 후보가 나올 수 있으므로 모든 서로 다른 seed가 반드시 다른 첫 후보를 가진다는 잘못된 assertion은 만들지 않습니다.

승패 완주·모바일 입력·일시정지·사람 재미는 이 준비 fixture의 증거가 아닙니다. 일반/숙련 정책 비교는 후속 공동 설계이며 기본 smoke를 그 대용으로 부르지 않습니다.
