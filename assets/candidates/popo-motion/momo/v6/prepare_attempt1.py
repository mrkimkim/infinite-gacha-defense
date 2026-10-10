from pathlib import Path
from PIL import Image,ImageDraw
from scipy import ndimage
import numpy as np,json,hashlib
root=Path(__file__).parent;p=root/'body-attempt-1';im=Image.open(p/'raw-generated.png');raw=np.array(im);cuts=[0,536,1058,1644,2172];names=['idle','anticipation','release','recovery'];(p/'frames').mkdir(exist_ok=True);(p/'previews').mkdir(exist_ok=True);rows=[];frames=[];restored=np.zeros_like(raw)
for i,name in enumerate(names):
 x0,x1=cuts[i:i+2];a=raw[:,x0:x1];l,n=ndimage.label(a[:,:,3]>127);cnt=np.bincount(l.ravel());cnt[0]=0;body=l==cnt.argmax();y,x=np.where(body);b=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)];yy,xx=np.where(body[b[3]-5:b[3]]);anchor=round((xx.min()+xx.max()+1)/2);dx=360-anchor;dy=640-b[3];out=Image.new('RGBA',(960,768));out.paste(Image.fromarray(a),(dx,dy));fa=np.array(out);assert np.array_equal(fa[dy:dy+724,dx:dx+x1-x0],a);restored[:,x0:x1]=fa[dy:dy+724,dx:dx+x1-x0];out.save(p/'frames'/f'{name}.png');frames.append(out);rows.append({'pose':name,'source_partition':[x0,0,x1,724],'translation':[dx-x0,dy],'body_bbox':[b[0]+x0,b[1],b[2]+x0,b[3]],'body_height':b[3]-b[1],'pivot':[360,640]})
assert np.array_equal(restored,raw)
maxh=max(r['body_height'] for r in rows);letter=Image.open(root/'letter/raw-generated.png');la=np.array(letter)[:,:,3];ly,lx=np.where(la>127);letterbox=[int(lx.min()),int(ly.min()),int(lx.max()+1),int(ly.max()+1)];letter_scale=138/(letterbox[2]-letterbox[0]);letter_size=(round(letter.width*letter_scale),round(letter.height*letter_scale));letter_small=letter.resize(letter_size,Image.Resampling.LANCZOS)
# Native source fingertip/grip points manually located from inspected source pixels.
anchors={'anticipation':{'source':[903,370],'kind':'grip contact on raised paw'},'release':{'source':[1640,365],'kind':'rightmost open fingertip'}}
for name,a in anchors.items():
 r=rows[names.index(name)];a['frame']=[a['source'][0]+r['translation'][0],a['source'][1]+r['translation'][1]]
# Letter hold uses right edge at grip; release uses left edge just beyond fingertips.
positions={}
for name in anchors:
 ax,ay=anchors[name]['frame'];x=ax-(letterbox[0]+letterbox[2])/2*letter_scale if name=='anticipation' else ax-letterbox[0]*letter_scale+12; y=ay-(letterbox[1]+letterbox[3])/2*letter_scale;positions[name]=[round(x),round(y)]
panel=Image.new('RGB',(1080,580),'#0b1520');d=ImageDraw.Draw(panel);d.text((15,10),'Popo v6 attempt1 / body + ONE separate letter / static art choreography only',fill='white');stats=[]
for row,h in enumerate([32,36]):
 scale=h/maxh;wh=(round(960*scale),round(768*scale));
 for i,name in enumerate(names):
  composite=frames[i].copy()
  if name in positions:composite.alpha_composite(letter_small,tuple(positions[name]))
  padded=Image.new('RGBA',(978,788));padded.paste(composite,(0,0));small=padded.resize(wh,Image.Resampling.LANCZOS,box=(0,0,wh[0]/scale,wh[1]/scale));small.save(p/'previews'/f'{name}-{h}px-composite.png');cleanpad=Image.new('RGBA',(978,788));cleanpad.paste(frames[i],(0,0));bodysmall=cleanpad.resize(wh,Image.Resampling.LANCZOS,box=(0,0,wh[0]/scale,wh[1]/scale));bodysmall.save(p/'previews'/f'{name}-{h}px-body.png');x=20+i*265;y=55+row*260;d.text((x,y),f'{name} | body target {h}px',fill='white');bg=Image.new('RGBA',wh,'#65717d');bg.alpha_composite(small);panel.paste(bg.convert('RGB'),(x,y+35));panel.paste(bg.resize((wh[0]*3,wh[1]*3),Image.Resampling.NEAREST).convert('RGB'),(x+65,y+30));ba=np.array(bodysmall)[:,:,3];l,n=ndimage.label(ba>127);cnt=np.bincount(l.ravel());cnt[0]=0;by,bx=np.where(l==cnt.argmax());stats.append({'pose':name,'target':h,'actual_body_height':int(by.max()-by.min()+1),'canvas':list(wh),'letter_strong_width':138*scale if name in positions else 0})
panel.save(p/'initial-contact-32-36.png');m={'status':'initial candidate inspection; not accepted','body_frames':rows,'letter_source_bbox_alpha_gt127':letterbox,'letter_native_scale':letter_scale,'anchors':anchors,'letter_overlay_positions':positions,'previews':stats,'integrity':'full RGBA reconstructs exactly; no alpha cleanup; narrow gutters may split faint fringe','projectile_contract':'art-only attachment/release comparison, no game anticipation or moving projectile implemented'};(p/'measurements.json').write_text(json.dumps(m,indent=2));print(json.dumps(m,indent=2))
