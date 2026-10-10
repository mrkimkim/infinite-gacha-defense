# 킥오프 결정 기록 — 첫 가역 실험

Issue [#3](https://github.com/mrkimkim/infinite-gacha-defense/issues/3), owner 리더, assignment-generation 1.  
기준 base: 62ca8d0fddb6b51fef596f91d6ad668c83cd3176. 문서 초안이며 새로운 수치/인터페이스의 단독 승인 기록이 아닙니다.

## 실제 근거

| 구분 | 읽은 원문 |
|---|---|
| 리더 제안 | [6093164637](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093164637) |
| 키키 고정 제안 | [6093163784](https://github.com/mrkimkim/infinite-gacha-defense/issues/1#issuecomment-6093163784) |
| 모모 제안 | [6093187173](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093187173) |
| 모모 교차 리뷰 | [6093192569](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093192569) |
| 리더 후속 리뷰 | [6093200011](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093200011) |
| 키키 교차 리뷰 | [6093202375](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093202375) |
| 모모 가역 기본값 명시 동의 | [6093218593](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093218593) |
| 리더도 배치4/벤치3에 동의한 합의 기록 | [6093227516](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093227516) |
| 첫 작업 배정 | [6093238567](https://github.com/mrkimkim/infinite-gacha-defense/issues/2#issuecomment-6093238567), [Issue #3](https://github.com/mrkimkim/infinite-gacha-defense/issues/3) |

모모는 다른 안을 읽은 비블라인드 제안임을 공개했습니다. [리더 수용](https://github.com/mrkimkim/infinite-gacha-defense/issues/1#issuecomment-6093186548)대로 독립 판단과 차이를 인정하며 블라인드 출처를 꾸미지 않습니다. 같은 GitHub 계정의 이름만으로 독립성을 인증하지 않습니다. 근거는 각 닷의 실제 제안·응답 기록입니다.

## 합의된 가역 실험 범위

1. 정면4×4와 시계방향 닫힌 정사각 외곽 경로. 준비 중 무료 이동/교환, 전투 중 편성 잠금.
2. 단일 재화, 순수 TypeScript 공유 코어, 고정 tick/seed/명령 기록, Node·브라우저 결정성.
3. 단일·범위 **2역할**로 실행 계약과 짧은 완주 루프부터 검증. 5웨이브는 기술 실험량이며 최종 MVP 분량 아님.
4. 첫 패배 기준은 한 바퀴 누수 피해 후 제거. 누적 방식은 별도 비교 실험으로 남김.
5. 기술 단면 바로 다음 성장 실험은 같은1성3→2성. XP/판매 XP 이전은 영구 삭제가 아니라 보류.
6. 제3슬롯은 둔화/비중첩 인접 지원을 교체 비교. 동시 정식 채택이나 최종 우열 결정 아님.
7. 배치4 / 합성 실험 대기석3은 명시 동의한 가역 기본값. 포화 영입·실패 합성은 상태/재화 불변, 소모/결과 ID와 위치를 계약에서 명시.
8. 세로 우선, 크림판·민트길·따뜻한 목재 상점, 숫자·별·체력은 런타임 UI. 공통 브리프로 각자 후보를 만들고 실제 크기에서 검토.

이는 문서·이미지 토론의 합의이며 재미·승률·실제 게임 조작의 검증 결과가 아닙니다.

## 선택 이유와 보존한 이견

- 리더의 초기 XP·판매 이전 제안은 원인 분리가 어렵다는 두 동료 의견으로 뒤로 미룸. 먼저 작은 실행 계약, 다음 합성 하나를 관찰.
- 모모의 중앙 지원과 키키의 둔화를 취향으로 결정하지 않음. 중앙 고정 정답/누수/편성 다양성/사람의 선택 이유를 동일 예산으로 비교.
- 누수는 기술 기준선으로 시작. 누적의 위기감 가능성은 보존하며 화면 혼잡·회복 가능성·패배 원인 이해를 비교.
- 배치4/벤치3은 합성 공간과 명령 실패 규칙을 시험하기 위한 임시값. 원본 이미지의 숫자를 규칙으로 승계하지 않음.

## 새 계약 제안 — 아직 동료 승인 없음

[core-contract-v0.md](core-contract-v0.md)의 P1–P8이 새 제안의 단일 원본입니다. 좌표/시간 단위·PRNG·명령 모양·순서·공격 판정·금액/HP/쿨다운 등 수치를 이 문서에 중복 정의하지 않습니다.
특히 첫 프로필 벤치0, 초기 기물 없음, 판매 없음, 합성의 keepId 위치·새ID·2배 피해는 **새 제안**입니다. 합의된 것처럼 구현하지 않습니다. 모모·키키의 실제 PR SHA 리뷰와 필수 모호성 해결 전 문서는 draft입니다.

## 후속 판단과 완료의 선

최종 한 판 길이·웨이브/콘텐츠 수·메타 성장, XP 이전의 최종 채택, 누수/누적 최종 규칙, 제3역할, 정식 배치/대기석 상한은 미확정입니다.
사용자는 리더와만 소통합니다. 세 닷의 설계·아트 의견은 동등합니다. 리더는 배정·일정·합의/이견 기록을 맡으며 단독 설계 타이브레이크가 없습니다. 중요한 미해결 사안은 합의한 비교 기준/실험을 거쳐 리더가 사용자에게 모아 전달합니다.
이번 Issue의 완료는 두 동료가 현재 초안 SHA를 실제 읽고 구현 가능성과 P1–P8을 검토한 뒤 필요한 규칙을 해결하는 것입니다. 이 PR은 그 검토를 시작하는 문서 산출물이며 병합·생산 코드·게임 테스트는 포함하지 않습니다.
