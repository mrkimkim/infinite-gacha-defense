from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from scipy import ndimage
import hashlib,json
p=Path(__file__).resolve().parent/'v5'; im=Image.open(p/'raw-generated.png'); arr=np.array(im); a=arr[:,:,3]; cuts=[0,716,1492,2172]; frames=[]; rows=[]; out=np.zeros_like(arr); total=0
(p/'frames').mkdir(exist_ok=True); (p/'previews').mkdir(exist_ok=True)
for i in range(3):
 x0,x1=cuts[i:i+2]; part=arr[:,x0:x1]; lab,n=ndimage.label(part[:,:,3]>127); counts=np.bincount(lab.ravel()); counts[0]=0; body=lab==counts.argmax(); ys,xs=np.where(body); bbox=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]; foot=body[max(0,bbox[3]-5):bbox[3]]; fy,fx=np.where(foot); anchor=int(round((int(fx.min())+int(fx.max())+1)/2)); dx=448-anchor; dy=704-bbox[3]
 f=Image.new('RGBA',(896,768)); f.paste(Image.fromarray(part),(dx,dy)); frames.append(f); name=['idle','attack','recovery'][i]; f.save(p/'frames'/f'{name}.png'); fa=np.array(f); recon=fa[dy:dy+724,dx:dx+x1-x0]; assert np.array_equal(recon,part); out[:,x0:x1]=recon; total+=int((part[:,:,3]>0).sum()); lab0,n0=ndimage.label(part[:,:,3]>0); sizes=np.bincount(lab0.ravel())[1:]
 rows.append(dict(pose=name,path=f'frames/{name}.png',source_partition=[x0,0,x1,724],body_bbox_source=[bbox[0]+x0,bbox[1],bbox[2]+x0,bbox[3]],body_height=bbox[3]-bbox[1],translation=[dx-x0,dy],pivot=[448,704],alpha_nonzero=int((part[:,:,3]>0).sum()),alpha_partial=int(((part[:,:,3]>0)&(part[:,:,3]<255)).sum()),alpha_components=n0,tiny_components_le4=int((sizes<=4).sum())))
assert np.array_equal(out,arr)
maxh=max(r['body_height'] for r in rows); panel=Image.new('RGB',(1000,640),'#fbf6eb'); d=ImageDraw.Draw(panel); d.text((20,10),'Popo candidate v5 | Actual body 32/36 px | Native alpha unchanged | Independent review pending',fill='#302a23')
preview_stats=[]
for si,h in enumerate([32,36]):
 scale=h/maxh; wh=(round(896*scale),round(768*scale));
 for bi,bg in enumerate(['#fff7e8','#d8eee3']):
  y=48+(si*2+bi)*145; d.rectangle((0,y,1000,y+142),fill=bg); d.text((20,y+8),f'Body target {h}px / canvas {wh[0]}x{wh[1]} | {bg}',fill='#302a23')
  for i,f in enumerate(frames):
   padded=Image.new('RGBA',(916,788)); padded.paste(f,(0,0)); small=padded.resize(wh,Image.Resampling.LANCZOS,box=(0,0,wh[0]/scale,wh[1]/scale)); small.save(p/'previews'/f'{rows[i]["pose"]}-{h}px.png'); comp=Image.new('RGBA',wh,bg); comp.alpha_composite(small); panel.paste(comp.convert('RGB'),(300+i*230,y+32)); enlarged=comp.resize((wh[0]*2,wh[1]*2),Image.Resampling.NEAREST); panel.paste(enlarged.convert('RGB'),(365+i*230,y+22)); d.text((300+i*230,y+110),rows[i]['pose']+' | 1x + 2x',fill='#302a23')
   if bi==0:
    sa=np.array(small)[:,:,3]; labs,nn=ndimage.label(sa>127); counts=np.bincount(labs.ravel()); counts[0]=0; yy,xx=np.where(labs==counts.argmax()); preview_stats.append(dict(pose=rows[i]['pose'],target_body_height=h,canvas=list(wh),uniform_scale=scale,measured_body_height=int(yy.max()-yy.min()+1)))
panel.save(p/'contact-sheet-32-36.png')
manifest=dict(asset_id='mvp-am-popo-momo-v5',task='MVP-AM-ART-01',base_commit='412ddd2891655d96e7e9b0fff63e9ab7322699aa',generator='Built-in image_gen, v3 -> targeted v5 attack extension',reference='docs/reference/characters/popo/sheet.png',reference_sha256='324d5a44059328ec6e8219bb19f0f059275675c7a73a4c25fd7a01e7ea1be11b',raw_dimensions=list(im.size),raw_mode=im.mode,raw_nonzero_alpha=total,raw_opaque_alpha=int((a==255).sum()),native_frame_dimensions=[896,768],frames=rows,previews=preview_stats,integrity='PASS: exact full RGBA reconstructs from translated native frames; no recolor, alpha cleanup, pixel deletion or native scaling',approval='candidate_only_independent_review_pending',limitations=['Subtle generated contour/bag differences remain; independent visual acceptance pending','Three keyposes only, not smooth animation','Runtime projectile and hit synchronization not implemented or tested','Interior alpha nearopaque251-254, median253; opaque255 count alone is not a visual failure; no alpha alteration'])
manifest['hashes']={str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file() and f.name not in ('manifest.json','measurements.json')}; (p/'measurements.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
