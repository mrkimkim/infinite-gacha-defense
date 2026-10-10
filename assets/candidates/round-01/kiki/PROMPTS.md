# 키키 Round 01 · 생성 프롬프트와 계보

- 작업: https://github.com/mrkimkim/infinite-gacha-defense/issues/4
- 패키징 assignment generation: 2
- 기준 커밋: `5848b28eb711dd0ee0dbca9fc973d519eea52ddf`
- 도구: `image_gen.imagegen`. 아래 영문은 실제 생성·수정 호출의 프롬프트 기록이다.
- 최초 4개 호출은 사용자 제공 941×1672 RGBA 참고 이미지(SHA-256 `aaa262539399848781ea841597c70d74e59a3ff3532447fb416bfd4a2de3ff95`)를 스타일·색 참고로 지정했다. 수정 호출은 바로 앞 후보를 입력으로 사용했다.
- 타일은 `transparent_background: false`, 수호자는 `transparent_background: true`로 요청했다. 실제 결과의 크기·알파·잡점은 manifest 측정이 기준이며 요청만으로 품질을 보증하지 않는다.
- 아래 식별자는 생성 결과 파일명이다. 채택된 네 원본만 `originals/`에 보존한다. 탈락 중간 파일은 패키지에 포함하지 않는다.
- 신규 AI 생성 후보이며, 기존 IP의 캐릭터나 기존 27개 에셋을 복사한 것이 아니다. 프롬프트 기록은 독점 권리·제3자 권리 검토 완료나 production 승인을 뜻하지 않는다.

## 최초 생성 공통 접두문

각 최초 호출의 프롬프트는 다음 공통 접두문(마침표 다음 공백 1개 포함)에 개별 본문을 이어 붙인 문자열이다.

```text
Use case: stylized-concept. Reference image is STYLE AND COLOR reference only, not an edit target. Create one modular 2D sprite for a warm toy gacha-shop defense board. Strict straight-on orthographic square plan view for tiles, no isometric diamond, no perspective taper. Soft hand-painted finish, cream/mint with restrained warm gold details, very subtle upper-left lighting. NO text, numbers, arrows, stars, health bars, UI, watermark, extra objects. 
```

## 크림 타일 · 최초 결과 채택

결과: `exec-10cd2ccc-7b6f-4576-8339-da85061b9731.png` → `originals/cream-tile.png`.

```text
One square cream placement floor tile filling the square canvas edge to edge, warm pale ivory interior, very narrow caramel bevel only around the perimeter. Four straight edges with subtle consistent border, corners barely rounded. Single tile, no board, no transparency required.
```

## 민트 직선 · 최초 결과 채택

결과: `exec-1c7164eb-289f-486c-a535-eb49f2f281df.png` → `originals/mint-straight.png`.

```text
One square mint-aqua straight path floor tile filling square canvas edge to edge, path runs horizontally through LEFT and RIGHT canvas edges, completely flat matching mint at left and right joins. Narrow warm gold curb only along TOP and BOTTOM. No edge border at left/right. Single tile, no arrow, no perspective, no transparency required.
```

## 민트 모서리 · 3차 결과 채택

### 최초 생성

결과: `exec-fdea4e35-c877-4adb-b1c3-00ad0011856b.png`. 내부 격자 때문에 탈락.

```text
One square mint-aqua corner path floor tile filling square canvas edge to edge, 90 degree path joining RIGHT edge and BOTTOM edge. Flat matching mint at RIGHT and BOTTOM joins. Narrow warm gold curb along TOP and LEFT only, meeting in upper-left corner. No arrows, no perspective, no border across open joins. Single tile, no transparency required.
```

### 수정 2차

입력: 최초 모서리 결과. 결과: `exec-c30b7903-cd93-4462-a67a-c07896d9f7bb.png`. 상단 턱이 완전히 이어지지 않아 탈락. 공통 접두문 없이 아래 전체 프롬프트를 사용했다.

```text
Edit this candidate tile. Keep square straight-on canvas, mint-aqua palette and hand-painted style. Remove ALL internal pale squares, ALL internal grid lines and curved painted paths. Entire interior must be ONE continuous flat mint floor. Keep only a narrow warm gold curb along the TOP and LEFT outermost edges. RIGHT and BOTTOM edges must be unobstructed mint floor edge-to-edge, matching the floor color of a straight tile. No arrows, no text, no multiple panels. This is a single modular corner floor cell, not a corner composed of many tiles.
```

### 수정 3차 · 보존 후보

입력: 2차 모서리 결과. 결과: `exec-b362ae91-1d19-4326-8d03-1837516280f4.png` → `originals/mint-corner-v3.png`.

```text
Edit this modular corner tile only: extend the gold TOP curb all the way from left edge to right edge of the canvas, exactly across the entire top 11 percent strip. Keep the LEFT gold curb full height. Keep all of the rest continuous mint floor, no inner squares or internal markings. Remove any mint gap in the top curb. No border along right or bottom edges. Preserve square front-on plan view and colors. This is one corner game tile.
```

직선 타일과 턱 폭·색·연결부가 완전히 맞지 않는 한계는 남아 있다. 선택은 비교용 보존이며 seamless 통과가 아니다.

## 중립 캡슐 수호자 · 2차 결과 채택

### 최초 생성

결과: `exec-97c6f3c9-d0f8-44d1-81a0-56ee93af8ba9.png`. 머리 태엽 때문에 탈락.

```text
One new neutral toy capsule guardian character only, full body facing viewer, nearly spherical pale cream capsule with a mint lower shell, two very small bronze boots planted evenly, two tiny side arms, one short bronze toy cannon held frontward, simple dark eyes, no mouth needed. Cute compact silhouette, small appendages readable at 44x48 display pixels. Centered full body with 8 percent clear padding, feet at about 90 percent canvas height. Soft shallow 2.5D hand-painted upper-left light, subdued shadow confined beneath feet. No tile, no platform, no UI, no existing IP character. Truly transparent background.
```

### 수정 2차 · 보존 후보

입력: 최초 수호자 결과. 결과: `exec-f1737964-998b-433a-a551-3462b83f67bd.png` → `originals/capsule-guardian-v2.png`. 공통 접두문 없이 아래 전체 프롬프트를 사용했다.

```text
Edit this exact capsule guardian sprite: REMOVE the winding-key on its head completely, so the top is a smooth plain cream capsule dome. Preserve the short cannon, mint lower shell, eyes, feet, full body front pose and hand-painted lighting. Reduce gold highlights a little. Keep background truly transparent; do not add any platform, UI, text, star or extra object. The missing winding key distinguishes this ally from the winding-key enemies in the game.
```

수정 프롬프트의 적 태엽 언급은 당시 시각 구분 의도이며 적 아트·규칙이 확정됐다는 선언이 아니다. 알파=1 잡점과 넓은 투명 여백은 원본에 남아 있으며 표시용 크롭 처리만 별도로 기록했다.

## 후처리

생성 원본 네 개는 변경 없이 보존한다. 코드로 새 아트를 그리지 않았다. `assemble.py`는 표시용 크롭·축소·90도 회전·알파 합성으로 144/60px 표시 파일과 864/360px 비교판을 만든다. 실제 처리·피벗·해시는 `README.md`, `manifest.json`을 따른다.
