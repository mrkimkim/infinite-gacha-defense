from pathlib import Path
from PIL import Image,ImageDraw
from scipy import ndimage
import numpy as np,json,hashlib
root=Path(__file__).parent;p=root/'body-attempt-2';im=Image.open(p/'raw-generated.png');raw=np.array(im);names=['idle','anticipation','release','recovery'];(p/'frames').mkdir(exist_ok=True);(p/'previews').mkdir(exist_ok=True);rows=[];frames=[];restored=np.zeros_like(raw)
labels,n=ndimage.label(raw[:,:,3]>127);counts=np.bincount(labels.ravel());counts[0]=0;ids=np.argsort(counts)[-4:];ids=sorted(ids,key=lambda i:np.where(labels==i)[1].min());seeds=np.zeros(labels.shape,dtype=np.int32)
for i,label in enumerate(ids,1):seeds[labels==label]=i
indices=ndimage.distance_transform_edt(seeds==0,return_distances=False,return_indices=True);owner=seeds[tuple(indices)]
for i,name in enumerate(names):
 body=seeds==i+1;y,x=np.where(body);b=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)];yy,xx=np.where(body[b[3]-5:b[3]]);anchor=round((xx.min()+xx.max()+1)/2);dx=360-anchor;dy=640-b[3];mask=owner==i+1;yy,xx=np.where(mask);ox,oy=xx+dx,yy+dy;assert ox.min()>=0 and ox.max()<960 and oy.min()>=0 and oy.max()<768;fa=np.zeros((768,960,4),dtype=np.uint8);fa[oy,ox]=raw[yy,xx];restored[yy,xx]=fa[oy,ox];out=Image.fromarray(fa);out.save(p/'frames'/f'{name}.png');frames.append(out);rows.append({'pose':name,'extraction':'nearest-main-component partition; source strong bodies overlap x, so no vertical seam cut','translation':[dx,dy],'body_bbox':b,'body_height':b[3]-b[1],'pivot':[360,640]})
assert np.array_equal(restored,raw)
maxh=max(r['body_height'] for r in rows);letter=Image.open(root/'letter/raw-generated.png');la=np.array(letter)[:,:,3];ly,lx=np.where(la>127);letterbox=[int(lx.min()),int(ly.min()),int(lx.max()+1),int(ly.max()+1)];letter_scale=138/(letterbox[2]-letterbox[0]);letter_size=(round(letter.width*letter_scale),round(letter.height*letter_scale));letter_small=letter.resize(letter_size,Image.Resampling.LANCZOS)
# Native source fingertip/grip points manually located from inspected source pixels.
anchors={'anticipation':{'source':[903,370],'kind':'grip contact on raised paw'},'release':{'source':[1646,354],'kind':'rightmost open fingertip'}}
for name,a in anchors.items():
 r=rows[names.index(name)];a['frame']=[a['source'][0]+r['translation'][0],a['source'][1]+r['translation'][1]]
# Letter hold uses right edge at grip; release uses left edge just beyond fingertips.
positions={}
for name in anchors:
 ax,ay=anchors[name]['frame'];x=ax-(letterbox[0]+letterbox[2])/2*letter_scale if name=='anticipation' else ax-letterbox[0]*letter_scale+12; y=ay-(letterbox[1]+letterbox[3])/2*letter_scale;positions[name]=[round(x),round(y)]
panel=Image.new('RGB',(1080,580),'#0b1520');d=ImageDraw.Draw(panel);d.text((15,10),'Popo v6 attempt2 / body + ONE separate letter / static art choreography only',fill='white');stats=[]
for row,h in enumerate([32,36]):
 scale=h/maxh;wh=(round(960*scale),round(768*scale));
 for i,name in enumerate(names):
  composite=frames[i].copy()
  if name in positions:composite.alpha_composite(letter_small,tuple(positions[name]))
  padded=Image.new('RGBA',(978,788));padded.paste(composite,(0,0));small=padded.resize(wh,Image.Resampling.LANCZOS,box=(0,0.375/scale,wh[0]/scale,(wh[1]+0.375)/scale));small.save(p/'previews'/f'{name}-{h}px-composite.png');cleanpad=Image.new('RGBA',(978,788));cleanpad.paste(frames[i],(0,0));bodysmall=cleanpad.resize(wh,Image.Resampling.LANCZOS,box=(0,0.375/scale,wh[0]/scale,(wh[1]+0.375)/scale));bodysmall.save(p/'previews'/f'{name}-{h}px-body.png');x=20+i*265;y=55+row*260;d.text((x,y),f'{name} | body target {h}px',fill='white');bg=Image.new('RGBA',wh,'#65717d');bg.alpha_composite(small);panel.paste(bg.convert('RGB'),(x,y+35));panel.paste(bg.resize((wh[0]*3,wh[1]*3),Image.Resampling.NEAREST).convert('RGB'),(x+65,y+30));ba=np.array(bodysmall)[:,:,3];l,n=ndimage.label(ba>127);cnt=np.bincount(l.ravel());cnt[0]=0;by,bx=np.where(l==cnt.argmax());stats.append({'pose':name,'target':h,'actual_body_height':int(by.max()-by.min()+1),'canvas':list(wh),'letter_strong_width':138*scale if name in positions else 0})
panel.save(p/'initial-contact-32-36.png');m={'status':'initial candidate inspection; not accepted','body_frames':rows,'letter_source_bbox_alpha_gt127':letterbox,'letter_native_scale':letter_scale,'anchors':anchors,'letter_overlay_positions':positions,'common_preview_sampling_phase_y_px':0.375,'previews':stats,'integrity':'full RGBA reconstructs exactly; no alpha cleanup; all pixel ownership by nearest main-body component; no strong body cut','projectile_contract':'art-only attachment/release comparison, no game anticipation or moving projectile implemented'};(p/'measurements.json').write_text(json.dumps(m,indent=2));print(json.dumps(m,indent=2))
