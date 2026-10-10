#!/usr/bin/env python3
"""Rebuild comparison rasters from unchanged imagegen originals; no drawn art."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageStat, __version__ as pillow_version

ROOT = Path(__file__).resolve().parent
TASK = 'https://github.com/mrkimkim/infinite-gacha-defense/issues/4'
BASE_COMMIT = '5848b28eb711dd0ee0dbca9fc973d519eea52ddf'
ASSIGNMENT_GENERATION = 2
SOURCE_FILES = {
    'cream': ('cream-tile.png', 'exec-10cd2ccc-7b6f-4576-8339-da85061b9731.png'),
    'straight': ('mint-straight.png', 'exec-1c7164eb-289f-486c-a535-eb49f2f281df.png'),
    'corner': ('mint-corner-v3.png', 'exec-b362ae91-1d19-4326-8d03-1837516280f4.png'),
    'guardian': ('capsule-guardian-v2.png', 'exec-f1737964-998b-433a-a551-3462b83f67bd.png'),
}
GUARDIAN_CELLS = [(1, 1), (2, 3), (3, 2), (4, 4)]  # zero-based (row, col)
CROP_ALPHA_MIN = 8
FOOT_ALPHA_MIN = 128
TILE_SIZES = (144, 60)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_bbox(im, minimum=1):
    if 'A' not in im.getbands():
        return [0, 0, *im.size]
    return list(im.getchannel('A').point(lambda a: 255 if a >= minimum else 0).getbbox())


def stats(path):
    with Image.open(path) as im:
        im.load()
        alpha = im.getchannel('A') if 'A' in im.getbands() else None
        return {
            'path': path.relative_to(ROOT).as_posix(), 'format': im.format,
            'dimensions_px': list(im.size), 'mode': im.mode,
            'alpha': {'present': alpha is not None,
                      'extrema': list(alpha.getextrema()) if alpha else None,
                      'effective_extrema': list(alpha.getextrema()) if alpha else [255, 255],
                      'nonzero_bbox_xyxy': alpha_bbox(im),
                      'bbox_alpha_ge_8_xyxy': alpha_bbox(im, 8)},
            'byte_count': path.stat().st_size, 'sha256': sha256(path),
        }


def measure_foot(im):
    """Foot pivot is midpoint of the two opaque bottom-row contact segments."""
    a = im.getchannel('A')
    opaque = a.point(lambda x: 255 if x >= FOOT_ALPHA_MIN else 0)
    y = opaque.getbbox()[3] - 1
    occupied = [x for x in range(im.width) if a.getpixel((x, y)) >= FOOT_ALPHA_MIN]
    groups = []
    for x in occupied:
        if not groups or x > groups[-1][-1] + 1:
            groups.append([x])
        else:
            groups[-1].append(x)
    if len(groups) != 2:
        raise ValueError(f'Expected two visible foot contacts, found {len(groups)}')
    centers = [(g[0] + g[-1] + 1) / 2 for g in groups]
    pivot = [sum(centers) / 2, y + 0.5]
    return {'coordinate_system': 'pixel-edge coordinates; pixel centers add 0.5',
            'method': 'Midpoint of the two alpha>=128 segments on the lowest visible row; visually checked as boots.',
            'alpha_min': FOOT_ALPHA_MIN, 'contact_pixel_row': y,
            'foot_contact_inclusive_x_ranges': [[g[0], g[-1]] for g in groups],
            'source_px': pivot,
            'source_normalized': [pivot[0] / im.width, pivot[1] / im.height]}


def rotate_clockwise(im, degrees):
    return im.transpose({90: Image.Transpose.ROTATE_270,
                         180: Image.Transpose.ROTATE_180,
                         270: Image.Transpose.ROTATE_90}[degrees]) if degrees else im.copy()


def cell_spec(row, col):
    corners = {(0, 0): 0, (0, 5): 90, (5, 5): 180, (5, 0): 270}
    if (row, col) in corners:
        return 'corner', corners[row, col]
    if row in (0, 5):
        return 'straight', 0
    if col in (0, 5):
        return 'straight', 90
    return 'cream', 0


def edge_difference(a, b, vertical):
    n = a.width
    ca = a.crop((0, n - 1, n, n) if vertical else (n - 1, 0, n, n))
    cb = b.crop((0, 0, n, 1) if vertical else (0, 0, 1, n))
    return round(sum(ImageStat.Stat(ImageChops.difference(ca, cb)).mean) / 3, 4)


def main():
    images = {}
    originals = []
    for key, (filename, generated_name) in SOURCE_FILES.items():
        path = ROOT / 'originals' / filename
        with Image.open(path) as im:
            im.load()
            images[key] = im.copy()
        item = stats(path)
        item.update({'asset_id': f'kiki-round01-{key}', 'variant': filename.removesuffix('.png'),
                     'provenance': {'type': 'AI-generated raster', 'tool': 'image_gen.imagegen',
                                    'generation_output_filename': generated_name,
                                    'original_bytes_preserved': True,
                                    'prompt_record': 'See PROMPTS.md when supplied by generating session.'},
                     'approval': 'pending independent reviews and team selection'})
        if key != 'guardian':
            item['pivot'] = {'source_px': [images[key].width / 2, images[key].height / 2],
                             'normalized': [0.5, 0.5], 'purpose': 'geometric tile center; not a measured foot'}
        originals.append(item)

    guardian = images['guardian']
    crop_box = alpha_bbox(guardian, CROP_ALPHA_MIN)
    cropped = guardian.crop(crop_box)  # Preserve every original RGBA pixel inside; do not threshold/edit alpha.
    foot = measure_foot(guardian)
    cropped_pivot = [foot['source_px'][0] - crop_box[0], foot['source_px'][1] - crop_box[1]]
    foot['display_crop_px'] = cropped_pivot
    foot['display_crop_normalized'] = [cropped_pivot[0] / cropped.width, cropped_pivot[1] / cropped.height]
    for item in originals:
        key = item['asset_id'].removeprefix('kiki-round01-')
        item['recommended_display'] = ([{'tile_px': 144, 'dimensions_px': [115, 92]},
                                         {'tile_px': 60, 'dimensions_px': [48, 39]}]
                                        if key == 'guardian' else
                                        [{'tile_px': n, 'dimensions_px': [n, n]} for n in TILE_SIZES])
    originals[-1]['pivot'] = foot
    originals[-1]['display_crop'] = {
        'alpha_min_for_bbox_only': CROP_ALPHA_MIN, 'bbox_xyxy': crop_box,
        'dimensions_px': list(cropped.size), 'alpha_pixels_inside_unchanged_before_resize': True,
        'warning': 'Near-transparent stray pixels outside the visible bbox are omitted in display copies only. Original bytes and full alpha remain intact.'}
    for im, item in zip(images.values(), originals):
        if 'A' in im.getbands():
            item['alpha']['pixel_count_alpha_1'] = im.getchannel('A').histogram()[1]

    generated = []
    boards = []
    for tile in TILE_SIZES:
        display_dir = ROOT / 'display' / str(tile)
        display_dir.mkdir(parents=True, exist_ok=True)
        tiles = {k: images[k].resize((tile, tile), Image.Resampling.LANCZOS) for k in ('cream', 'straight', 'corner')}
        for key, im in tiles.items():
            dest = display_dir / f'{key}.png'
            im.save(dest)
            item = stats(dest)
            item.update({'source_asset_id': f'kiki-round01-{key}',
                         'operations': ['resize LANCZOS'],
                         'pivot_px': [tile / 2, tile / 2]})
            generated.append(item)
        max_side = math.floor(tile * 0.8)
        sprite = cropped.copy()
        sprite.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        pivot = [cropped_pivot[0] * sprite.width / cropped.width,
                 cropped_pivot[1] * sprite.height / cropped.height]
        dest = display_dir / 'guardian.png'
        sprite.save(dest)
        item = stats(dest)
        item.update({'source_asset_id': 'kiki-round01-guardian',
                     'operations': ['crop visible-alpha>=8 bbox for display only', 'aspect-preserving LANCZOS thumbnail'],
                     'pivot_px': pivot, 'max_allowed_side_px': max_side,
                     'aspect_ratio_rounding': 'Integer raster dimensions are rounded by Pillow.thumbnail; no intentional stretch.'})
        generated.append(item)

        board = Image.new('RGB', (tile * 6, tile * 6))
        assembled = {}
        cells = []
        for row in range(6):
            for col in range(6):
                key, angle = cell_spec(row, col)
                piece = rotate_clockwise(tiles[key], angle)
                board.paste(piece, (col * tile, row * tile))
                assembled[row, col] = piece
                cells.append({'row': row, 'col': col, 'source': key, 'rotation_clockwise_degrees': angle})
        seams = []
        for row in range(6):
            for col in range(6):
                for dr, dc in ((0, 1), (1, 0)):
                    if row + dr < 6 and col + dc < 6:
                        seams.append({'cells': [[row, col], [row + dr, col + dc]],
                                      'rgb_edge_mean_absolute_difference_0_255': edge_difference(
                                          assembled[row, col], assembled[row + dr, col + dc], bool(dr))})
        placements = []
        board = board.convert('RGBA')
        for row, col in GUARDIAN_CELLS:
            target = [(col + 0.5) * tile, (row + 0.9) * tile]
            xy = [round(target[0] - pivot[0]), round(target[1] - pivot[1])]
            assert xy[0] >= col * tile and xy[1] >= row * tile
            assert xy[0] + sprite.width <= (col + 1) * tile
            assert xy[1] + sprite.height <= (row + 1) * tile
            board.alpha_composite(sprite, tuple(xy))
            placements.append({'row': row, 'col': col, 'display_dimensions_px': list(sprite.size),
                               'top_left_px': xy, 'target_foot_px': target,
                               'actual_foot_px': [xy[0] + pivot[0], xy[1] + pivot[1]]})
        dest = ROOT / 'comparison' / f'board-{tile * 6}.png'
        dest.parent.mkdir(parents=True, exist_ok=True)
        board.convert('RGB').save(dest)
        item = stats(dest)
        item.update({'tile_display_px': tile, 'grid': [6, 6], 'central_cream_grid': [4, 4],
                     'cells': cells, 'guardian_placements': placements,
                     'tile_seams': {'status': 'not seamless; observed curb and corner junction mismatch',
                                    'metric': 'RGB edge mean absolute difference, no pass/fail threshold; imagery only, not collision/path topology',
                                    'all_60_adjacencies': seams}})
        boards.append(item)

    path_clockwise = ([[0, col] for col in range(6)] + [[row, 5] for row in range(1, 6)]
                      + [[5, col] for col in range(4, -1, -1)] + [[row, 0] for row in range(4, 0, -1)])
    assert len(path_clockwise) == len(set(map(tuple, path_clockwise))) == 20
    manifest = {
        'schema_version': 1, 'task': TASK, 'dot': '키키', 'variant': 'round-01',
        'assignment_generation': ASSIGNMENT_GENERATION, 'base_commit': BASE_COMMIT,
        'assignment_url': TASK + '#issuecomment-6093797788',
        'approval': {'status': 'pending', 'independent_reviews': [], 'production_selected': False},
        'rights_and_provenance': {
            'basis': 'New neutral capsule-guardian concept and tiles generated with OpenAI image_gen.imagegen; user-provided reference used for style/layout direction.',
            'license': 'No separate exclusive-rights or third-party-IP clearance assertion; candidate approval and rights review remain pending.',
            'prompt_record': 'PROMPTS.md',
            'no_legacy_asset_import': True, 'reference_pixels_copied_into_package': False},
        'reference': {
            'user_original_sha256': 'aaa262539399848781ea841597c70d74e59a3ff3532447fb416bfd4a2de3ff95',
            'user_original_dimensions_px': [941, 1672], 'user_original_mode': 'RGBA',
            'user_original_byte_count': 2734243,
            'source_verification': 'Generating session visually inspected supplied original; assembly uses generated pieces only.',
            'assigned_repo_path': 'docs/reference/front-square-4x4.png',
            'repo_reference_at_assigned_base': {
                'sha256': '0014783902d050eff49e762b7da7e09a5c94144cc92c9d027171a9113ac9af63',
                'dimensions_px': [941, 1672], 'mode': 'RGB', 'byte_count': 2398176,
                'source': 'docs/reference/README.md at assigned base; separate reference-repair task, not this package.',
                'same_pixels_as_user_rgba_version': 'not established'},
            'historical_initial_base': {
                'commit': '62ca8d0fddb6b51fef596f91d6ad668c83cd3176',
                'sha256': '8b7a13cba742638198a3ba06598d9161d636970b7be8a34167323e3aa83293fa',
                'byte_count': 786445,
                'decode_status': 'Pillow.verify raised OSError: Truncated File Read; never used as decoded pixels in this package.'}},
        'assembly': {'script': 'assemble.py', 'pillow_version': pillow_version,
                     'artwork_created_by_code': False,
                     'operations': ['byte-for-byte copy originals', 'display-only crop', 'LANCZOS resize', 'right-angle rotate', 'alpha composite'],
                     'tile_display_sizes_px': list(TILE_SIZES), 'guardian_max_tile_fraction': 0.8,
                     'cell_foot_anchor_normalized': [0.5, 0.9], 'guardian_cells_row_col': GUARDIAN_CELLS,
                     'clockwise_perimeter_cells_row_col': path_clockwise,
                     'clockwise_direction_note': '20-cell intended ordering recorded here; no arrows baked in and no runtime pathfinding/gameplay implied.'},
        'originals': originals, 'display_derivatives': generated, 'comparison_boards': boards,
        'known_limitations': [
            'Generated RGB tiles are opaque, including dark corner pixels; no false alpha claim.',
            'Straight/corner curbs do not meet perfectly; visual seam and band-width mismatch remains.',
            'Rotating baked highlights/shadows rotates the light direction; no global lighting consistency claim.',
            'Guardian alpha=1 speckles enlarge the strict bbox; visible-alpha display crop hides padding but does not clean original alpha.',
            'All display copies use one neutral temporary guardian; no role/rarity/UI/gameplay validation.',
            'No browser gameplay, simulation, human playtest, peer approval, production adoption, commit, or publication performed by assembly.'],
        'visual_qa_record': 'README.md; manual inspection must be repeated if inputs or assembly change.',
    }
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'original_count': len(originals), 'display_count': len(generated),
                      'boards': [{k: b[k] for k in ('path', 'dimensions_px', 'sha256')} for b in boards],
                      'guardian_crop': crop_box, 'guardian_foot': foot}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
