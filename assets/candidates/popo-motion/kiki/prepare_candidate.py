"""Technical extraction only. No generation, redraw, alpha cleanup, or individual scaling."""
from pathlib import Path
import hashlib,json,shutil,sys
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import label
ROOT=Path(__file__).resolve().parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'raw-generated.png'
raw=ROOT/'raw-generated.png'
if source.resolve()!=raw.resolve(): shutil.copyfile(source,raw)
im=Image.open(raw).convert('RGBA'); arr=np.array(im); A=arr[:,:,3]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
bbox=lambda m: (lambda y,x:[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)])(*np.where(m)) if m.any() else None
lab,n=label(A>0,structure=np.ones((3,3),int))
# Measured empty x-columns and a y-seam that cuts no alpha>0 connected component.
xs=[0,425,908,1328,1774]; ys=[0,450,887]
for x in xs[1:-1]:assert not (A[:,x]>0).any()
assert not (set(lab[449][lab[449]>0]) & set(lab[450][lab[450]>0]))
frames=[]; imgs=[]
(ROOT/'frames').mkdir(exist_ok=True)
for i in range(8):
 r,c=divmod(i,4); box=[xs[c],ys[r],xs[c+1],ys[r+1]];x0,y0,x1,y1=box
 a=A[y0:y1,x0:x1]; strict=bbox(a>0);visible=bbox(a>127)
 bottom=visible[3]; yy,xx=np.where((a>127)&(np.indices(a.shape)[0]>=bottom-5))
 anchor=[round((int(xx.min())+int(xx.max())+1)/2),bottom]
 crop=[strict[0]+x0,strict[1]+y0,strict[2]+x0,strict[3]+y0]
 pivot=[256,464];offset=[pivot[0]-anchor[0]+strict[0],pivot[1]-anchor[1]+strict[1]]
 tile=im.crop(crop);out=Image.new('RGBA',(512,512));out.paste(tile,tuple(offset)) # No mask: preserves every RGBA byte.
 assert offset[0]>=0 and offset[1]>=0 and offset[0]+tile.width<=512 and offset[1]+tile.height<=512
 assert np.array_equal(np.array(out)[offset[1]:offset[1]+tile.height,offset[0]:offset[0]+tile.width],np.array(tile))
 path=ROOT/'frames'/f'{i+1:02d}.png';out.save(path);imgs.append(out)
 labs,nn=label(a>0,structure=np.ones((3,3),int));sizes=np.bincount(labs.ravel())[1:]
 frames.append(dict(index=i+1,path=str(path.relative_to(ROOT)),sha256=sha(path),dimensions_px=[512,512],source_partition_xyxy=box,source_crop_xyxy=crop,source_alpha_gt127_bbox_xyxy=[visible[0]+x0,visible[1]+y0,visible[2]+x0,visible[3]+y0],source_anchor_xy=[anchor[0]+x0,anchor[1]+y0],crop_offset_in_output_xy=offset,source_to_output_translation_xy=[pivot[0]-anchor[0]-x0,pivot[1]-anchor[1]-y0],scale=1,pivot=pivot,alpha=dict(nonzero_pixels=int((a>0).sum()),transparent_pixels=int((np.array(out)[:,:,3]==0).sum()),partial_pixels=int(((a>0)&(a<255)).sum()),opaque_pixels=int((a==255).sum()),max=int(a.max()),strict_bbox_output=bbox(np.array(out)[:,:,3]>0),components_8connected=int(nn),components_at_most_4_pixels=int((sizes<=4).sum()),pixels_in_components_at_most_4_pixels=int(sizes[sizes<=4].sum()))))
assert sum(f['alpha']['nonzero_pixels'] for f in frames)==int((A>0).sum())
manifest=dict(asset_id='popo-motion-kiki-generated-01',task='https://github.com/mrkimkim/infinite-gacha-defense/issues/26',dot='kiki',variant='generated-motion-01',assignment_generation=1,base_commit='5d69aacad292156de563f8c737e169a38687cb4c',raw=dict(path='raw-generated.png',sha256=sha(raw),dimensions_px=list(im.size),mode='RGBA',alpha_nonzero_pixels=int((A>0).sum()),alpha_zero_pixels=int((A==0).sum()),alpha_partial_pixels=int(((A>0)&(A<255)).sum())),extraction=dict(method='Measured spatial partitions, then strict alpha>0 bounding crop and integer translation only; all nonzero pixels retained exactly once',coordinates='xyxy rectangles are half-open; pivots use pixel-edge coordinates',partition_x=xs,partition_y=ys,vertical_seams='x=425,908,1328 are wholly transparent columns',horizontal_seam='y=450 boundary intersects no alpha>0 8-connected component; there is no wholly transparent row between character rows',anchor_method='Horizontal midpoint of union of alpha>127 pixels in last 5 occupied rows, rounded to nearest integer; y is exclusive bottom of alpha>127 bbox. This is a geometric foot-baseline approximation, not rigged anatomical annotation.',canvas_px=[512,512],pivot_px=[256,464],per_frame_scale=1,normalization='No per-frame resizing, rotations, recoloring, alpha retouching, isolated-pixel deletion or pose correction.'),reference=dict(url='https://github.com/mrkimkim/infinite-gacha-defense/blob/eb95229d0ba9176c6f4bd396ae8acb34f717d3a8/docs/reference/characters/popo/sheet.png',sha256='324d5a44059328ec6e8219bb19f0f059275675c7a73a4c25fd7a01e7ea1be11b',style_reference='Original user-provided 4x4 concept, not copied into this candidate.'),provenance='Built-in image generation output created for Kiki’s candidate, preserved byte-for-byte as raw-generated.png. Technical extraction script creates only crops, translations and inspection renders.',license_rights_basis='Project owner authorized public project-specific reference and generated candidate preparation; no claim of separate third-party license or production approval.',approval=dict(status='candidate_only_not_production_ready',independent_dot_review='pending',decision_url=None),tile_seams='Not a tiling asset. No tile continuity claim.',limitations=['Generated pose sheet, not a designed animation cycle. Frames 1 and 2 have little idle distinction; head, face, clothing and bag vary between poses.','Faint isolated pixels and partially transparent fringe are retained. Their assignment to neighboring frames follows measured spatial partitions, not semantic certainty.','Foot anchors are consistent geometric baselines, but pose silhouettes and character proportions still vary.','44/56px checks show the entire 512px normalized canvas at that size; visible character is smaller because preserved outliers require padding.','Frame order and timing in viewer are inspection controls, not approved animation choreography.'],frames=frames)
# Inspection contact sheet; nearest-neighbor common display scale only, never saved over frame pixels.
sheet=Image.new('RGB',(800,410),'#fffaf0');d=ImageDraw.Draw(sheet)
d.text((16,12),'Popo / Kiki - generated candidate, not production ready',fill='#252c26')
for row,(size,bg) in enumerate([(44,'#fff7e8'),(56,'#fff7e8'),(44,'#d8eee3'),(56,'#d8eee3')]):
 y=40+row*90;d.rectangle((0,y,799,y+89),fill=bg);d.text((8,y+5),f'{size}px canvas',fill='#252c26')
 for i,out in enumerate(imgs):
  x=112+i*84;thumb=out.resize((size,size),Image.Resampling.NEAREST);sheet.paste(thumb,(x+(60-size)//2,y+17),thumb);d.text((x+23,y+75),str(i+1),fill='#252c26')
sheet.save(ROOT/'contact-sheet.png')
manifest['contact_sheet']=dict(path='contact-sheet.png',dimensions_px=list(sheet.size),sha256=sha(ROOT/'contact-sheet.png'),backgrounds=['#fff7e8','#d8eee3'],frame_canvas_display_px=[44,56],filter='nearest-neighbor')
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(raw_sha256=sha(raw),nonzero_pixels=int((A>0).sum()),frames=[dict(index=f['index'],crop=f['source_crop_xyxy'],anchor=f['source_anchor_xy'],offset=f['crop_offset_in_output_xy']) for f in frames]),indent=2))
