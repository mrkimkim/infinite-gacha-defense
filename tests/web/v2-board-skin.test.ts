import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  BOARD_SKIN_CANDIDATE, BOARD_SKIN_RECTS, BOARD_SKIN_RING,
  boardSkinReviewOption, boardSkinViewport, createBoardSkin,
} from '../../src/web/v2-board-skin.ts';
import type { BoardSkinLoader } from '../../src/web/v2-board-skin.ts';
import { shellSink } from './v2-render-harness.ts';

const candidatePath = new URL('../../public/assets/board-candidate/v03/', import.meta.url);
const css = readFileSync(new URL('../../src/web/v2-board-skin.css', import.meta.url), 'utf8');
const size = { width: 1254, height: 1254 };
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function harness() {
  const value = shellSink();
  const classes = new Set<string>();
  value.elements.arena.classList.toggle = (name, enabled) => { enabled ? classes.add(name) : classes.delete(name); };
  const skin = (loader: BoardSkinLoader = async () => size) => createBoardSkin(value.shell, { candidate: 'v03', loader });
  return { ...value, classes, skin };
}

test('review requires a single exact opt-in, never truthy values, aliases or duplicates', () => {
  for (const search of ['', '?screen=v2', '?boardSkin', '?boardSkin=true', '?boardSkin=v02',
    '?boardSkin=V03', '?boardSkin=v03&boardSkin=v03', '?boardSkin=v03&boardSkin=', '?skin=v03']) {
    assert.equal(boardSkinReviewOption(search), undefined, search);
  }
  assert.deepEqual(boardSkinReviewOption('?screen=v2&boardSkin=v03&seed=3'), { candidate: 'v03' });
});

test('atlas, metadata, provenance and review remain byte-identical to PR44 exact head', () => {
  const hashes = {
    'modular-board-atlas-v03.png': '67bf4c16b1d1eac5844c907a989b99dc185e9522d791b31316fa62ca5af3d816',
    'sprites.json': 'db93671f100c58ed39955e4b2c9e6dfee41d646951995172e0cf720dc71367bf',
    'generation-prompt.txt': 'b67c4291588fdbbd4ae5c7d10d50893d7ace80e01246f3471a47432e50499c03',
    'REVIEW.md': '21b9dac910b17d1cecff01f3be44521ec4d8dc9d267d367979cbdf65fab1fc0d',
  };
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file, candidatePath))).digest('hex'), hash, file);
  }
  const input = JSON.parse(readFileSync(new URL('sprites.json', candidatePath), 'utf8'));
  for (const [name, rect] of Object.entries(BOARD_SKIN_RECTS)) {
    assert.deepEqual(rect, input.sprites.find((sprite: { name: string }) => sprite.name === name).rect);
  }
  assert.equal(BOARD_SKIN_CANDIDATE.sourceCommit, '761df8c30fd07b719b6e1d046d1d0d33df38e257');
  assert.equal(BOARD_SKIN_CANDIDATE.width, input.atlas.width);
  assert.equal(BOARD_SKIN_CANDIDATE.height, input.atlas.height);
});

test('20 ring tiles surround all 16 inner positions with correct, unrotated corner assets', () => {
  assert.equal(BOARD_SKIN_RING.length, 20);
  const positions = new Set(BOARD_SKIN_RING.map(tile => `${tile.col},${tile.row}`));
  assert.equal(positions.size, 20);
  for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
    assert.equal(positions.has(`${col},${row}`), col === 0 || row === 0 || col === 5 || row === 5);
  }
  assert.equal(BOARD_SKIN_RING.find(tile => tile.col === 0 && tile.row === 0)?.sprite, 'path_corner_tl');
  assert.equal(BOARD_SKIN_RING.find(tile => tile.col === 5 && tile.row === 0)?.sprite, 'path_corner_tr');
  assert.equal(BOARD_SKIN_RING.find(tile => tile.col === 0 && tile.row === 5)?.sprite, 'path_corner_bl');
  assert.equal(BOARD_SKIN_RING.find(tile => tile.col === 5 && tile.row === 5)?.sprite, 'path_corner_br');
});

test('percentage viewports reproduce exact rect coordinates at fractional and high-DPI sizes', () => {
  // CSS background-position percentages apply to (box - rendered image), not the image.
  for (const name of Object.keys(BOARD_SKIN_RECTS) as (keyof typeof BOARD_SKIN_RECTS)[]) {
    const [x, y, width, height] = BOARD_SKIN_RECTS[name];
    const viewport = boardSkinViewport(name);
    const [sx, sy] = viewport.backgroundSize.split(' ').map(parseFloat);
    const [px, py] = viewport.backgroundPosition.split(' ').map(parseFloat);
    for (const arenaInner of [284, 426]) for (const dpr of [1, 1.25, 2]) {
      const pitch = arenaInner / 6 * dpr;
      assert.ok(Math.abs((pitch - pitch * sx / 100) * px / 100 + x / width * pitch) < 1e-9);
      assert.ok(Math.abs((pitch - pitch * sy / 100) * py / 100 + y / height * pitch) < 1e-9);
    }
  }
});

test('decode commits only decorative nodes and never replaces buttons or their accessible state', async () => {
  const h = harness();
  const buttons = h.sink.boardCells.map(slot => slot.button);
  buttons.forEach((button, index) => {
    button.setAttribute('aria-label', `cell ${index}`); button.disabled = index % 2 === 0;
    button.setAttribute('aria-pressed', String(index === 3));
  });
  let requested = '';
  const skin = h.skin(async src => { requested = src; return size; });
  assert.equal(h.classes.has('v2-board-skin-active'), false);
  assert.equal(h.elements.arena.children.length, 0);
  assert.equal(await skin.ready, 'active');
  assert.equal(requested, 'https://example.test/deployed/game/assets/board-candidate/v03/modular-board-atlas-v03.png');
  assert.ok(h.classes.has('v2-board-skin-active'));
  const ring = h.elements.arena.children[0];
  assert.equal(ring.getAttribute('aria-hidden'), 'true');
  assert.equal(ring.children.length, 20);
  for (const [index, button] of buttons.entries()) {
    assert.equal(h.sink.boardCells[index].button, button);
    assert.equal(button.getAttribute('aria-label'), `cell ${index}`);
    assert.equal(button.getAttribute('aria-pressed'), String(index === 3));
    assert.equal(button.disabled, index % 2 === 0);
    const face = button.children[0];
    assert.equal(face.getAttribute('aria-hidden'), 'true');
    assert.equal(face.children.length, 3);
    for (const tile of face.children) {
      assert.equal(tile.getAttribute('aria-hidden'), 'true');
      assert.equal(tile.style.backgroundImage, `url("${requested}")`);
    }
  }
  assert.match(h.elements.arena.following!.textContent, /검수 후보.*정식 채택 전/);
  skin.dispose(); skin.dispose();
  assert.ok(!h.classes.has('v2-board-skin-active'));
  assert.equal(ring.removed, true);
  assert.equal(h.elements.arena.following!.removed, true);
  for (const button of buttons) assert.equal(button.children[0].removed, true);
});

test('failed decode or wrong dimensions preserve default, report fallback and request only once', async () => {
  for (const mode of ['error', 'width', 'height']) {
    const h = harness(); let calls = 0;
    const skin = h.skin(async () => {
      calls++;
      if (mode === 'error') throw new Error('decode failed');
      return { width: mode === 'width' ? 1 : 1254, height: mode === 'height' ? 1 : 1254 };
    });
    assert.equal(await skin.ready, 'fallback');
    for (let index = 0; index < 5; index++) await settle();
    assert.equal(calls, 1);
    assert.ok(!h.classes.has('v2-board-skin-active'));
    assert.equal(h.elements.arena.children.length, 0);
    assert.ok(h.sink.boardCells.every(slot => slot.button.children.length === 0));
    assert.match(h.elements.arena.following!.textContent, /로드 실패.*기존 보드 유지/);
    skin.dispose();
  }
});

test('disposal before loading avoids the request, and late successes/errors never repaint', async () => {
  const immediate = harness(); let calls = 0;
  const first = immediate.skin(async () => { calls++; return size; }); first.dispose();
  assert.equal(await first.ready, 'disposed'); assert.equal(calls, 0);
  for (const rejects of [false, true]) {
    const h = harness(); let resolve!: (size: { width: number; height: number }) => void;
    let reject!: (reason: Error) => void;
    const skin = h.skin(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    await settle(); skin.dispose();
    const originalNote = h.elements.arena.following!.textContent;
    if (rejects) reject(new Error('late decode failure')); else resolve(size);
    assert.equal(await skin.ready, 'disposed');
    assert.equal(h.elements.arena.following!.textContent, originalNote);
    assert.equal(h.elements.arena.children.length, 0);
    assert.ok(!h.classes.has('v2-board-skin-active'));
  }
});

test('skin CSS keeps decoration inert and scoped, retains state/focus and readable label backing', () => {
  assert.match(css, /\.v2-board-skin-ring,\s*\.v2-board-skin-cell,\s*\.v2-board-skin-tile\s*\{ pointer-events: none;/);
  assert.match(css, /\.v2-board-skin-active \.v2-board \{ inset: calc\(100% \/ 6\); gap: 0; background: transparent; z-index: 1;/);
  assert.match(css, /\.v2-board-slot:hover:not\(:disabled\)/);
  assert.match(css, /\.v2-shell \.v2-board-skin-active \.v2-board-slot:disabled/);
  assert.match(css, /\.v2-board-slot:focus-visible \{ outline: 3px solid #fff3aa/);
  assert.match(css, /background: #142332; color: #fff;/);
  assert.doesNotMatch(css, /opacity:\s*0|display:\s*none|\.v2-enemy-layer\s*\{[^}]*z-index/);
  // Calculated allocation, not a claim of browser layout or font rendering.
  const cell = (288 - 4) / 6;
  for (const sprite of [32, 34, 36]) assert.ok(sprite + 10 <= cell);
  assert.match(css, /flex: 0 0 auto/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /clip-path: inset\(50%\)/);
  const linear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance = [0x14, 0x23, 0x32].map(value => linear(value / 255))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  assert.ok(1.05 / (luminance + 0.05) > 15.9);
});
