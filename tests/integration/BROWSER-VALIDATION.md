# 실제 브라우저 통합 하네스

Issue14 generation2. browser-verify.mjs는 환경에 이미 있는 Playwright/Chromium을 사용합니다. npm 의존성 설치·배포·터널을 만들지 않습니다. 다른 환경에 없다면 해당 검증은 BLOCKED입니다. 프로젝트 테스트는 Node에서 돌아가며 이 브라우저 하네스는 별도 실행합니다.

## 정확한 세 소스 결합

별도 검증 디렉터리를 만들고 리더 PR의 정확한 commit 전체에 모모 commit의 src/core 및 tsconfig.core.json, 키키 commit의 index.html/src/web/tests/web만 git archive로 추출합니다. 원본 source bytes를 수정하지 않습니다. 각 파일의 git hash-object가 각 source commit의 blob과 일치하는지 확인하고 세 SHA를 실행 기록에 남깁니다. 이 임시 결합은 main 병합이나 승인된 production 빌드가 아닙니다.

현재 준비 기준: core b6b38f9edcf0fc0181dfd461f677a28a37849192, web945f977ec90f6c3d0927d3ecc928269d709fcfce, CLI fbcb12ffa95a9051b2cf6e152ca7bece54007d99. 하네스 자체 SHA는 이 파일을 게시한 PR 체크포인트를 따릅니다. 이후 core가 구현되면 이전 stub SHA를 재사용하지 말고 실제 구현 SHA를 기록합니다.

검증 디렉터리에서 npm ci --ignore-scripts, npm run check, npm run typecheck:core, npm run build를 실행합니다. Vite를127.0.0.1에서 띄운 뒤 `node tests/integration/browser-verify.mjs http://127.0.0.1:4173/`를 실행하고 종료 후 서버를 닫습니다. exit2/BLOCKED는 게임 PASS가 아닙니다. stdout JSON과 exact sources를 함께 보존합니다.

## 증거 범위

하네스는 실제 DOM 클릭과 실제 core/crypto를 사용합니다. snapshot textarea에서 같은 시점의 canonical bytes/header/entries를 받아 Node CLI replay 및 표준 SHA-256과 대조합니다. 입력 단계별 검사와 종료해시를 구분합니다. RAF·document.hidden만 테스트용으로 제어하며 이는 실제 OS 탭 전환이나 일반 벽시계 플레이 증거가 아닙니다. 모의 코어를 UI에 삽입하지 않습니다.

준비된 검사는 반복 영입/이동/교환/거부선택/Escape/거부 뒤 focus,250ms 포함·초과·음수dt,수동pause 상태의 hidden 복귀, stale RAF,결과/같은seed재시작,지연 WebCrypto 결과의 새 경기 덮어쓰기 방지입니다. 코어stub이면 게임 진입 전에 진단과 disabled controls만 확인하고 BLOCKED로 종료합니다.

추가 필수 검증: 실제 OS hidden/visible 전환,390/넓은 화면 touch/keyboard와 모든16칸 hitbox,승리와패배 각각의 경로,실제 RAF 성능과 저FPS 시간폐기,개별tick/event 대조 및 batching 별도 비교,연속 snapshot 역순 완료,사람 플레이. 하네스 한 번 성공만으로 이 항목을 통과 처리하지 않습니다. stdout PASS도 이 스크립트의 명시 검사 범위에 한정됩니다.

## 준비 실행 결과

browser-preparation-evidence.json에 정확한 세 SHA와 수행 결과를 기록했습니다. source blob12개 일치, 타입/core타입 검사·두 번들 성공, 어댑터/도구62 PASS·실제코어1 BLOCKED skip입니다. 실제 Chromium151.0.7922.173에서 진단과 비활성 버튼만 검사한 뒤 하네스 exit2/BLOCKED로 종료했습니다. 준비된 게임 DOM/RAF/해시 분기는 아직 실행되지 않았으므로 하네스 자체도 그 분기의 성공을 주장하지 않습니다. 서버와 브라우저를 종료했습니다.
