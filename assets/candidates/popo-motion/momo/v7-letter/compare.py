from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
r=Path(__file__).parent;(r/'effects').mkdir(exist_ok=True)
screen=Image.open(r/'references/pr49-32px-0019.jpg');beige=tuple(np.median(np.array(screen)[460:480,260:300],axis=(0,1)).astype(int));bg=[('beige screenshot sample',beige),('light',(248,245,235)),('dark',(24,44,38))]
names=['v6 baseline','attempt-1','attempt-2'];paths=[r/'references/v6-letter.png',r/'attempt-1/raw-generated.png',r/'attempt-2/raw-generated.png'];effects={};rows=[]
def bbox(a,t):
 y,x=np.where(a>t);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
for name,path in zip(names,paths):
 im=Image.open(path);b=bbox(np.array(im)[:,:,3],127)
 for target in [8,10,12]:
  for increment in range(81):
   s=(target+increment*.025)/(b[2]-b[0]);w=round(im.width*s)+4;h=round(im.height*s)+4
   pad=Image.new('RGBA',(int(w/s)+2,int(h/s)+2));pad.paste(im,(int(2/s),int(2/s)));sm=pad.resize((w,h),Image.Resampling.LANCZOS,box=(0,0,w/s,h/s));a=np.array(sm)[:,:,3];bb=bbox(a,127)
   if bb[2]-bb[0]==target:break
  assert bb[2]-bb[0]==target
  nz=bbox(a,0);effects[name,target]=(sm,bb);sm.save(r/'effects'/f'{name.replace(" ","-")}-{target}px.png');rows.append({'variant':name,'requested_effect_width':target,'canvas':[w,h],'alpha_gt127_bbox':bb,'alpha_gt0_bbox':nz,'strong_dimensions':[bb[2]-bb[0],bb[3]-bb[1]],'source_strong_bbox':b,'scale':s,'scale_adjustment_to_measured_width':increment*.025})

contact=Image.new('RGB',(1260,1430),'#efefeb');d=ImageDraw.Draw(contact);d.text((15,10),'ART-POPO-03 | actual-size + 4x nearest inspection | effect width independent of body',fill='black')
for j,(label,color) in enumerate(bg):
 for i,name in enumerate(names):
  x=10+i*415;y=40+j*460;d.rectangle((x,y,x+405,y+450),fill=color);ink='white' if j==2 else 'black';d.text((x+8,y+8),name+' / '+label,fill=ink)
  for k,target in enumerate([8,10,12]):
   sm,b=effects[name,target];xx=x+10+k*132;d.text((xx,y+30),f'alpha>127 width {target}px',fill=ink)
   for row,bodyh in enumerate([32,36]):
    body=Image.open(r/f'references/release-{bodyh}px-body.png');tile=Image.new('RGBA',(86,60),color);tile.alpha_composite(body,(0,0));ax=688*bodyh/563;ay=365*bodyh/563-.375
    # Leftmost strong effect pixel one screen pixel beyond unchanged fingertip.
    pos=(round(ax+1)-b[0],round(ay-(b[3]-b[1])/2)-b[1]);tile.alpha_composite(sm,pos);contact.paste(tile.convert('RGB'),(xx,y+50+row*200));d.text((xx+85,y+65+row*200),f'{bodyh}px',fill=ink);contact.paste(tile.resize((344,240),Image.Resampling.NEAREST).crop((140,55,268,175)).convert('RGB'),(xx,y+108+row*200))
contact.save(r/'comparison-8-10-12.png')
m={'assignment':'https://github.com/mrkimkim/infinite-gacha-defense/issues/24#issuecomment-6100065723','native_release_anchor':[688,365],'body_scale':'height/563; phase_y=0.375','effect_attachment':'leftmost alpha>127 effect pixel = round(anchor_x)+1; vertical center = round(anchor_y); never changes native body anchor','background_sample':{'source':'references/pr49-32px-0019.jpg','rect':[260,460,300,480],'median_RGB':beige},'effects':rows}
(r/'measurements.json').write_text(json.dumps(m,indent=2,default=int));print(json.dumps(rows))
flight=Image.new('RGB',(1080,660),'#eeeeea');draw=ImageDraw.Draw(flight);draw.text((12,8),'Detached flight specimens | actual size and 4x nearest | static direction remains uncertain',fill='black')
for j,(label,color) in enumerate(bg):
 for i,name in enumerate(names):
  x=i*360;y=30+j*210;draw.rectangle((x,y,x+355,y+205),fill=color);ink='white' if j==2 else 'black';draw.text((x+8,y+8),name+' / '+label,fill=ink)
  for k,w in enumerate([8,10,12]):
   im,b=effects[name,w];xx=x+10+k*116;draw.text((xx,y+30),f'{w}px strong width',fill=ink);tile=Image.new('RGBA',(26,24),color);tile.alpha_composite(im,(2,2));flight.paste(tile.convert('RGB'),(xx+35,y+50));flight.paste(tile.resize((104,96),Image.Resampling.NEAREST).convert('RGB'),(xx,y+80))
flight.save(r/'detached-flight-comparison.png')
