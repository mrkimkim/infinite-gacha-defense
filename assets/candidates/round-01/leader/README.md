# 리더 후보 round-01 — 실제 조립 검토 대기

Issue #4 / generation1 / branch leader/art-round-01. production 채택·독립 동료 승인 없음.

## 원본 무결성 복구
최초 전달 blob은 약786444bytes에서 잘려 네 PNG 모두 검증에 실패했습니다. incomplete-source 스크린샷은 그 실패의 역사적 진단이며 정상 후보가 아닙니다.
수정된 네 PNG를 새 clone에서 원본 byte count·SHA256·Git blob SHA 대조, Pillow verify 및 전체 load로 검증했습니다. 모두1254×1254; floor3개 RGB, guardian RGBA. 원본 픽셀을 수정하지 않았습니다. 정확한 값은 decode-report.json과 asset-manifest.json에 있습니다.

## 실제 조립 증거
preview.html은 img/CSS grid로 외곽 민트20칸+안쪽 크림16칸과 기물4개를 조립합니다. imagegen 전체판 대체가 아닙니다.
Chromium151.0.7922.173, localhost, viewport960×1600, DPR1에서 실행하고 comparison-864.png와 comparison-360.png를 캡처·직접 확인했습니다. 각 보드 실제 크기864×864/360×360, 타일144/60입니다.
기본 canvas116/48px의 실제 기물 가시폭은 alpha≥16 기준 약95.1/39.3px입니다. source pivot(627,1183)을 셀(0.5,0.875)에 맞춥니다. comparison-360-silhouette80.png는 원본 비율을 유지한 CSS canvas58.6px로 가시폭48px(타일80%)를 비교합니다. 큰 판의 동일 모드는 canvas140.5px입니다. canvas와 silhouette 폭을 혼동하지 않습니다.

## 직접 확인한 한계
두 크기 모두 이미지 누락은 없어졌습니다. 중앙 크림4×4와 민트 폐곡선은 구분되고 기물은 셀 안에 놓입니다. 작은 판 기본 기물은 다소 작으며 silhouette80 모드는 더 읽기 쉽지만 공간 여유가 줄어듭니다. 타일 질감과 줄눈이 강하며 반복이 눈에 띕니다. 회전하면 방향성 bevel 광원도 회전합니다. 코너 곡선은 희미해 길 방향은 배치에 의존합니다. 원본 alpha 잡음·대부분253/255인 내부 alpha도 그대로 보존했습니다. 적·VFX·숫자/UI 없는 비교판이므로 실제 전투 가독성은 아직 검증하지 않았습니다.

## 재현과 출처
정적 HTTP 서버로 preview.html을 열면 외부 CDN 없이 실행됩니다. capture-preview.cjs는 설치된 Playwright/Chromium으로 캡처를 재현합니다(CHROMIUM_PATH 선택 가능). PNG를 코드로 생성하거나 편집하지 않습니다.
generation-prompts.json은 제작자가 전달한 imagegen 프롬프트이며 executor 절대경로는 제거했습니다. corner는 v2만 게시하고 최초 corner는 생성 이력에만 남깁니다. 사용자 승인된 AI 원본 후보의 프로젝트 공개 검토이며 최종 IP/일반 재배포 라이선스 승인을 주장하지 않습니다.
main의 참고 PNG 복구는 별도 담당 사항으로 이 브랜치에서 수정하지 않았습니다.
