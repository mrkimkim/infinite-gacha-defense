from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from scipy.ndimage import label
import hashlib,json,shutil,sys,base64
R=Path(__file__).resolve().parent
raw=R/'raw-generated.png'
if len(sys.argv)>1:shutil.copyfile(sys.argv[1],raw)
im=Image.open(raw).convert('RGBA');a=np.array(im)[:,:,3];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def box(mask):
 y,x=np.where(mask);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def comps(mask):
 l,n=label(mask,np.ones((3,3)));sizes=np.bincount(l.ravel());return l,n,sizes
xs=[0,650,1500,2172];W,H=896,704;pivot=[448,640];frames=[];outs=[];bodymasks=[]
for x in xs[1:-1]:assert not a[:,x].any()
(R/'frames').mkdir(exist_ok=True)
for i in range(3):
 x0,x1=xs[i:i+2];part=a[:,x0:x1];strict=box(part>0);l,n,sz=comps(part>127);body=l==int(np.argmax(sz[1:])+1);bb=box(body);y,x=np.where(body & (np.indices(body.shape)[0]>=bb[3]-5));anchor=[round((int(x.min())+int(x.max())+1)/2),bb[3]];crop=[strict[0]+x0,strict[1],strict[2]+x0,strict[3]];offset=[pivot[0]-anchor[0]+strict[0],pivot[1]-anchor[1]+strict[1]];tile=im.crop(crop);out=Image.new('RGBA',(W,H));out.paste(tile,tuple(offset));assert min(offset)>=0 and offset[0]+tile.width<=W and offset[1]+tile.height<=H;assert np.array_equal(np.array(out)[offset[1]:offset[1]+tile.height,offset[0]:offset[0]+tile.width],np.array(tile));path=R/'frames'/f'{i+1:02d}.png';out.save(path);outs.append(out)
 bm=Image.new('L',(W,H));bm.paste(Image.fromarray((body*255).astype('uint8')).crop(strict),tuple(offset));bodymasks.append(bm)
 ll,nn,ss=comps(part>0)
 frames.append(dict(index=i+1,pose=['preparation holding envelope','release with detached envelope','recovery'][i],path=str(path.relative_to(R)),sha256=sha(path),dimensions_px=[W,H],source_partition_xyxy=[x0,0,x1,724],source_crop_xyxy=crop,source_body_alpha_gt127_bbox_xyxy=[bb[0]+x0,bb[1],bb[2]+x0,bb[3]],body_height_px=bb[3]-bb[1],source_anchor_xy=[anchor[0]+x0,anchor[1]],crop_offset_in_output_xy=offset,source_to_output_translation_xy=[pivot[0]-anchor[0]-x0,pivot[1]-anchor[1]],scale=1,pivot=pivot,alpha=dict(nonzero_pixels=int((part>0).sum()),partial_pixels=int(((part>0)&(part<255)).sum()),opaque_pixels=int((part==255).sum()),strict_output_bbox=box(np.array(out)[:,:,3]>0),components_8connected=nn,components_at_most_4_pixels=int((ss[1:]<=4).sum()))))
assert sum(f['alpha']['nonzero_pixels'] for f in frames)==int((a>0).sum())
# Verify exact reconstruction before making inspection previews.
reconstructed=np.zeros_like(np.array(im))
for f,out in zip(frames,outs):
 x0,y0,x1,y1=f['source_crop_xyxy'];dx,dy=f['crop_offset_in_output_xy'];reconstructed[y0:y1,x0:x1]=np.array(out)[dy:dy+y1-y0,dx:dx+x1-x0]
assert np.array_equal(reconstructed[:,:,3],a);assert np.array_equal(reconstructed[a>0],np.array(im)[a>0])
refheight=max(f['body_height_px'] for f in frames)
def preview(src,height):
 s=height/refheight;return src.transform((int(np.ceil(W*s)),int(np.ceil(H*s))),Image.Transform.AFFINE,(1/s,0,0,0,1/s,0.25/s),Image.Resampling.NEAREST)
preview_records=[];sheet=Image.new('RGB',(900,470),'#fffaf0');d=ImageDraw.Draw(sheet);d.text((16,12),'Popo / Kiki v2: 3 keyposes, actual body-height previews',fill='#29332c')
for row,(height,bg) in enumerate([(44,'#fff7e8'),(56,'#fff7e8'),(44,'#d8eee3'),(56,'#d8eee3')]):
 y=40+row*106;d.rectangle((0,y,899,y+105),fill=bg);d.text((10,y+8),f'Body {height}px\nCommon scale {height}/{refheight}',fill='#29332c');dims=[]
 for i,out in enumerate(outs):
  p=preview(out,height);mask=preview(bodymasks[i],height);b=box(np.array(mask)>127);dims.append(b[3]-b[1]);x=240+i*220;sheet.paste(p,(x,y+8),p);d.text((x,y+86),f'{i+1}: body {b[3]-b[1]}px / canvas {p.width}x{p.height}',fill='#29332c')
 preview_records.append(dict(body_target_px=height,background=bg,uniform_scale=height/refheight,preview_sampling_phase_y_output_px=0.25,canvas_px=list(p.size),measured_raster_body_heights_px=dims,detached_envelope_width_px=157*height/refheight))
sheet.save(R/'contact-sheet.png')
manifest=dict(asset_id='popo-motion-kiki-v2',task='https://github.com/mrkimkim/infinite-gacha-defense/issues/26',dot='kiki',assignment_generation=1,base_commit='44bad8b2370e4f7086dfb3ea86586dccac527772',raw=dict(path='raw-generated.png',sha256=sha(raw),dimensions_px=list(im.size),mode='RGBA',nonzero_alpha_pixels=int((a>0).sum())),normalization=dict(method='Measured transparent x=650 and x=1500 seams, strict alpha>0 crops, integer translation only',canvas_px=[W,H],pivot=pivot,body_definition='Largest 8-connected alpha>127 component in each partition; threshold is measurement only and never changes image alpha',reference_body_height_px=refheight,anchor_method='Midpoint of body footprint in last 5 occupied rows, integer-rounded; y exclusive body bottom',coordinates='Half-open xyxy; edge-coordinate pivots'),detached_envelope=dict(frame=2,source_alpha_gt127_bbox_xyxy=[1292,288,1449,408],source_strict_component_bbox_xyxy=[1284,284,1451,414],width_alpha_gt127_px=157,strict_width_px=167,assignment='Entire component retained in frame 2; fully transparent 3-column gap between strict body and envelope components'),frames=frames,previews=preview_records,contact_sheet=dict(path='contact-sheet.png',sha256=sha(R/'contact-sheet.png'),dimensions_px=list(sheet.size)),provenance=dict(generator='Built-in image generation for Kiki; raw copied without re-encoding',reference_url='https://github.com/mrkimkim/infinite-gacha-defense/blob/eb95229d0ba9176c6f4bd396ae8acb34f717d3a8/docs/reference/characters/popo/sheet.png',reference_sha256='324d5a44059328ec6e8219bb19f0f059275675c7a73a4c25fd7a01e7ea1be11b',prompt='Exact prompt is preserved in prompt.txt'),rights='Project-owner-authorized candidate preparation; no new license claim',approval=dict(status='candidate_only_not_production_ready',independent_review='pending'),tile_seams='Not a tiling asset',limitations=['Three keyposes, not a fully smooth cycle.','Head and face are visually more consistent than v1, but green apron top/strap changes in release pose remain.','Detached envelope is baked into frame 2; a separate engine projectile is future work only, not implemented.','Faint alpha fringe and isolated pixels are preserved, including remote frame-1 outliers.','Preview scale is common to all poses, based on measured maximum body height557; no individual body resizing.'],integrity=dict(status='PASS',checks=['all nonzero pixels preserved once','all source alpha reconstructed exactly','all nontransparent RGBA reconstructed exactly','no seam intersects nonzero alpha','no frame clipping','raw copy unchanged']))
manifest['provenance']['prompt_file']={'path':'prompt.txt','sha256':sha(R/'prompt.txt')}
(R/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(raw=manifest['raw'],reference_body_height=refheight,frame_heights=[f['body_height_px'] for f in frames],previews=preview_records),indent=2))
