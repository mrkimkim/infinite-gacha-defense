#!/usr/bin/env python3
"""Rebuild comparison boards and numeric evidence; never modifies source PNGs.
Requires Python 3 and Pillow. Run: python assets/candidates/round-01/momo/assemble.py
Optional first import: --source-dir PATH (byte-for-byte copy of named imagegen outputs).
Only resizes, quarter-turn rotates, and alpha-composites existing art. No new painted art.
"""
import argparse, hashlib, json, shutil, math
from pathlib import Path
from PIL import Image, __version__ as pillow_version
ROOT = Path(__file__).resolve().parent
SOURCE = {
    'cream.png': 'exec-10c87168-4435-418c-9512-8beeef720243.png',
    'straight.png': 'exec-c9b9d70d-68e6-4cb0-a1e4-21f777ecc372.png',
    'corner.png': 'exec-ab650795-76e4-442a-be3f-a470884e36ff.png',
    'guardian.png': 'exec-82368056-8cca-43a1-abf2-e3e96ebc392a.png',
}
BASE = '62ca8d0fddb6b51fef596f91d6ad668c83cd3176'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def bbox(alpha, threshold): return alpha.point(lambda p: 255 if p >= threshold else 0).getbbox()
def inspect(path):
    im = Image.open(path); a = im.convert('RGBA').getchannel('A'); hist = a.histogram()
    return {'path':path.name, 'dimensions_px':list(im.size), 'mode':im.mode,
        'has_alpha_channel':'A' in im.getbands(), 'alpha_range':list(a.getextrema()),
        'alpha_interpretation':'stored alpha' if 'A' in im.getbands() else 'RGB is fully opaque; implicit alpha 255',
        'alpha_nonzero_bbox':a.getbbox(), 'alpha_ge128_bbox':bbox(a,128),
        'alpha_ge250_bbox':bbox(a,250), 'alpha_zero_pixels':hist[0],
        'alpha_partial_pixels':sum(hist[1:255]), 'alpha_opaque_pixels':hist[255],
        'sha256':sha(path)}
def seam(a,b,axis):
    # Mean absolute RGB difference at adjacent edge pixels, range 0..255.
    a=a.convert('RGB'); b=b.convert('RGB'); n=a.width
    pairs = [(a.getpixel((n-1,y)), b.getpixel((0,y))) for y in range(n)] if axis=='x' else [(a.getpixel((x,n-1)),b.getpixel((x,0))) for x in range(n)]
    return round(sum(abs(x-y) for p,q in pairs for x,y in zip(p,q))/(3*n),4)
def build(cell):
    images={n:Image.open(ROOT/n).convert('RGBA') for n in SOURCE}
    tile={n:im.resize((cell,cell),Image.Resampling.LANCZOS) for n,im in images.items() if n!='guardian.png'}
    board=Image.new('RGBA',(6*cell,6*cell),(0,0,0,0)); grid={}; placements=[]
    for r in range(6):
        for c in range(6):
            if (r,c) in [(0,0),(0,5),(5,5),(5,0)]:
                name='corner.png'; angle={(0,0):0,(0,5):270,(5,5):180,(5,0):90}[(r,c)]
            elif r in [0,5]: name='straight.png'; angle=90
            elif c in [0,5]: name='straight.png'; angle=0
            else: name='cream.png'; angle=0
            im=tile[name].rotate(angle); grid[r,c]=(name,im)
            board.alpha_composite(im,(c*cell,r*cell))
            placements.append({'row':r,'column':c,'source':name,'rotation_ccw_degrees':angle})
    seams=[]
    for (r,c),(name,im) in grid.items():
        for dr,dc,axis in [(0,1,'x'),(1,0,'y')]:
            if (r+dr,c+dc) in grid:
                n2,im2=grid[r+dr,c+dc]
                if name!='cream.png' and n2!='cream.png': seams.append({'from':[r,c],'to':[r+dr,c+dc],'sources':[name,n2],'edge_rgb_mae':seam(im,im2,axis)})
    box=[44*cell/60,48*cell/60]; orig=images['guardian.png']; scale=min(box[0]/orig.width,box[1]/orig.height)
    size=(math.floor(orig.width*scale),math.floor(orig.height*scale)); sprite=orig.resize(size,Image.Resampling.LANCZOS)
    pieces=[]
    for r,c in [(1,1),(2,3),(3,2),(4,4)]:
        target=((c+.5)*cell,(r+.9)*cell)
        xy=(round(target[0]-.5*size[0]),round(target[1]-.9*size[1]))
        layer=Image.new('RGBA',board.size,(0,0,0,0)); layer.alpha_composite(sprite,xy)
        alpha=layer.getchannel('A'); board.alpha_composite(layer)
        pieces.append({'cell_row_column':[r,c],'display_box_px':box,'full_canvas_resized_px':list(size),
            'full_canvas_top_left_px':list(xy),'pivot_normalized':[.5,.9],
            'target_pivot_px':list(target),'rasterized_pivot_px':[xy[0]+.5*size[0],xy[1]+.9*size[1]],
            'alpha_nonzero_bbox_board_px':alpha.getbbox(),'alpha_ge128_bbox_board_px':bbox(alpha,128),
            'alpha_ge250_bbox_board_px':bbox(alpha,250),'trimmed':False})
    output=ROOT/f'board-{6*cell}.png'; board.save(output)
    return {'file':output.name,'cell_px':cell,'dimensions_px':list(board.size),'sha256':sha(output),
        'tiles':placements,'pieces':pieces,'road_seam_metrics':seams}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path);args=parser.parse_args()
    if args.source_dir:
        for dest,source in SOURCE.items():
            src=args.source_dir/source;target=ROOT/dest
            if target.exists() and sha(target)!=sha(src): raise RuntimeError(f'Refusing to overwrite differing source {dest}')
            shutil.copyfile(src,target); assert sha(src)==sha(target)
    originals=[inspect(ROOT/n) for n in SOURCE]
    boards=[build(60),build(144)]
    data={'schema_version':1,'base_commit':BASE,'assignment_generation':1,'pillow_version':pillow_version,
        'bbox_convention':'[left, top, right, bottom], right/bottom exclusive; alpha >= 1 unless threshold stated',
        'source_copy_method':'shutil.copyfile; byte equality verified on import; sources never re-encoded',
        'source_generation_files':SOURCE,'originals':originals,'boards':boards,
        'numeric_checks_only':True,'independent_peer_review':'not performed',
        'seam_metric_definition':'Mean absolute RGB difference at touching edge pixels (0..255); measures discontinuity, not subjective quality or seamlessness approval.'}
    (ROOT/'checks.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    manifest={'status':'candidate/unapproved','asset_id':'momo-round-01','task':'https://github.com/mrkimkim/infinite-gacha-defense/issues/4',
        'dot':'모모','variant':'round-01','assignment_generation':1,'base_commit':BASE,
        'reference':'docs/reference/front-square-4x4.png',
        'reference_verification':{'repository_file':{'path':'docs/reference/front-square-4x4.png','bytes':786445,
            'sha256':'8b7a13cba742638198a3ba06598d9161d636970b7be8a34167323e3aa83293fa',
            'pillow_verify':'TruncatedFileRead; not visually verified as a valid repository image'},
            'user_attachment_original':{'dimensions_px':[941,1672],'mode':'RGBA',
                'sha256':'aaa262539399848781ea841597c70d74e59a3ff3532447fb416bfd4a2de3ff95',
                'visual_confirmation':'Viewed directly by 모모; attachment original, not the damaged repository copy'}},
        'provenance':{'tool':'built-in imagegen','generation':'newly generated candidate assets',
        'existing_ip_assets_used':False,'exclusivity_guaranteed':False,'prompt_record':'prompts.json',
        'source_originals_byte_preserved':True,'derived_boards':'assembly only; resize, quarter-turn rotation, alpha compositing'},
        'rights_basis':'New AI-generated project candidates. No existing IP asset reuse. No guarantee of exclusivity or non-infringement; production adoption remains unapproved.',
        'approval':{'status':'unapproved','reviews':[],'decision_url':None},
        'assets':[dict(x,asset_id='momo-'+Path(x['path']).stem,
            recommended_display_box_px=[44,48] if x['path']=='guardian.png' else [60,60],
            pivot=[.5,.9] if x['path']=='guardian.png' else [.5,.5]) for x in originals],
        'comparisons':[{'path':x['file'],'dimensions_px':x['dimensions_px'],'sha256':x['sha256']} for x in boards],
        'tile_seams':{'status':'unapproved; quantitative edge checks in checks.json','rotation_rule':'Source straight is vertical. Top-left corner opens down/right. Quarter-turn rotations connect perimeter.'},
        'limitations':['Straight/corner were regenerated to reduce seam mismatch; residual color/border differences remain and need peer review.',
          'Rotating source tiles also rotates baked lighting; potential lighting inconsistency remains.',
          'Full guardian canvas is preserved without bbox trim. Actual silhouette differs from nominal 44x48 display box.',
          'Guardian alpha>=1 bounding box reaches source canvas bottom; threshold-specific bounds are recorded.',
          'Comparison only; no UI, platform, game integration, human play test or independent peer approval.'],
        'reproduce':'python assets/candidates/round-01/momo/assemble.py','numeric_evidence':'checks.json'}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'originals':originals,'boards':[{'file':b['file'],'piece':b['pieces'][0],'road_seam_mae_min_max':[min(s['edge_rgb_mae'] for s in b['road_seam_metrics']),max(s['edge_rgb_mae'] for s in b['road_seam_metrics'])]} for b in boards]},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
