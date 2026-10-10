import type { V2ShellRefs } from './v2-shell.ts';

/** Static display adapter for PR44. This is not a character-art manifest or adoption. */
export const BOARD_SKIN_CANDIDATE = Object.freeze({
  sourceCommit: '761df8c30fd07b719b6e1d046d1d0d33df38e257',
  atlas: 'assets/board-candidate/v03/modular-board-atlas-v03.png',
  width: 1254, height: 1254,
});

// Exact top-left source viewports from preserved sprites.json; never a uniform slicer.
export const BOARD_SKIN_RECTS = Object.freeze({
  hero_normal: [44, 62, 258, 247],
  hero_selected: [349, 62, 257, 247],
  hero_normal_alt: [650, 62, 256, 247],
  hero_hover: [953, 62, 259, 247],
  path_horizontal: [47, 364, 255, 246],
  path_vertical: [353, 364, 251, 246],
  path_corner_tl: [652, 364, 253, 246],
  path_corner_tr: [955, 364, 253, 246],
  path_corner_bl: [47, 668, 256, 246],
  path_corner_br: [352, 669, 252, 245],
} as const);
type TileName = keyof typeof BOARD_SKIN_RECTS;
export type BoardSkinLoader = (src: string) => Promise<{ readonly width: number; readonly height: number }>;
export interface BoardSkinReviewOptions {
  readonly candidate: 'v03';
  readonly loader?: BoardSkinLoader;
}

/** A single, exact query opts into review. No persistent setting or default adoption. */
export function boardSkinReviewOption(search: string): BoardSkinReviewOptions | undefined {
  const query = new URLSearchParams(search);
  return query.getAll('boardSkin').length === 1 && query.get('boardSkin') === 'v03'
    ? { candidate: 'v03' } : undefined;
}

/** Six pitches span world -1000..5000, with board 0..4000 occupying the inner four. */
export const BOARD_SKIN_RING = Object.freeze(Array.from({ length: 36 }, (_, index) => {
  const col = index % 6, row = Math.floor(index / 6);
  const sprite: TileName | null = row === 0
    ? col === 0 ? 'path_corner_tl' : col === 5 ? 'path_corner_tr' : 'path_horizontal'
    : row === 5 ? col === 0 ? 'path_corner_bl' : col === 5 ? 'path_corner_br' : 'path_horizontal'
      : col === 0 || col === 5 ? 'path_vertical' : null;
  return Object.freeze({ row, col, sprite });
}).filter((tile): tile is typeof tile & { sprite: NonNullable<typeof tile.sprite> } => tile.sprite !== null));

/** CSS percentages retain each independent source viewport while normalizing to a square. */
export function boardSkinViewport(sprite: TileName) {
  const [x, y, width, height] = BOARD_SKIN_RECTS[sprite];
  return {
    backgroundSize: `${BOARD_SKIN_CANDIDATE.width / width * 100}% ${BOARD_SKIN_CANDIDATE.height / height * 100}%`,
    backgroundPosition: `${x / (BOARD_SKIN_CANDIDATE.width - width) * 100}% ${y / (BOARD_SKIN_CANDIDATE.height - height) * 100}%`,
  };
}

async function loadBoardImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}

/** Owns only decoration. Existing buttons, labels, events and the scene SVG remain intact. */
export function createBoardSkin(shell: Pick<V2ShellRefs, 'arena' | 'boardCells'>, options: BoardSkinReviewOptions) {
  const document = shell.arena.ownerDocument;
  const note = document.createElement('p');
  note.className = 'v2-board-skin-note';
  note.setAttribute('role', 'status');
  note.textContent = '보드 v03 검수 후보 불러오는 중 · 기존 보드 유지';
  shell.arena.after(note);
  let disposed = false;
  const decoration: HTMLElement[] = [];
  // Deployment-relative, identical URL for preflight decode and all CSS viewports.
  const src = new URL(BOARD_SKIN_CANDIDATE.atlas, new URL('.', document.baseURI)).href;
  function tile(sprite: TileName, className: string) {
    const node = document.createElement('span');
    node.className = `v2-board-skin-tile ${className}`;
    node.setAttribute('aria-hidden', 'true');
    node.dataset.boardTile = sprite;
    Object.assign(node.style, boardSkinViewport(sprite), { backgroundImage: `url(${JSON.stringify(src)})` });
    return node;
  }
  // A failed/late decoder never changes the default board or retries on each render.
  const ready = Promise.resolve().then(() => {
    if (disposed) return null;
    if (options.candidate !== 'v03' || shell.boardCells.length !== 16) throw new Error('BOARD_SKIN_CONTRACT');
    return (options.loader ?? loadBoardImage)(src);
  }).then(size => {
    if (disposed) return 'disposed' as const;
    if (!size || size.width !== BOARD_SKIN_CANDIDATE.width || size.height !== BOARD_SKIN_CANDIDATE.height) {
      throw new Error('BOARD_SKIN_DIMENSIONS');
    }
    const ring = document.createElement('div');
    ring.className = 'v2-board-skin-ring';
    ring.setAttribute('aria-hidden', 'true');
    for (const { row, col, sprite } of BOARD_SKIN_RING) {
      const node = tile(sprite, '');
      node.style.gridRow = String(row + 1);
      node.style.gridColumn = String(col + 1);
      ring.append(node);
    }
    shell.arena.append(ring);
    decoration.push(ring);
    shell.boardCells.forEach((slot, index) => {
      const face = document.createElement('span');
      face.className = 'v2-board-skin-cell';
      face.setAttribute('aria-hidden', 'true');
      const alternate = (index % 4 + Math.floor(index / 4)) % 2 !== 0;
      face.append(tile(alternate ? 'hero_normal_alt' : 'hero_normal', 'v2-board-skin-normal'),
        tile('hero_hover', 'v2-board-skin-hover'), tile('hero_selected', 'v2-board-skin-selected'));
      slot.button.append(face);
      decoration.push(face);
    });
    shell.arena.classList.toggle('v2-board-skin-active', true);
    note.textContent = '보드 v03 검수 후보 · 정식 채택 전 · 기물은 임시 그래픽';
    return 'active' as const;
  }).catch(() => {
    if (disposed) return 'disposed' as const;
    for (const node of decoration) node.remove();
    shell.arena.classList.toggle('v2-board-skin-active', false);
    note.textContent = '보드 v03 후보 로드 실패 · 기존 보드 유지';
    return 'fallback' as const;
  });
  return {
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      shell.arena.classList.toggle('v2-board-skin-active', false);
      for (const node of decoration) node.remove();
      note.remove();
    },
  };
}
