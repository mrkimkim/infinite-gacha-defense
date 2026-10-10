from pathlib import Path
from PIL import Image,ImageDraw
from scipy import ndimage
import numpy as np,json
p=Path(__file__).resolve().parent/'v5'; raw=Image.open(p/'raw-generated.png'); arr=np.array(raw); a=arr[:,:,3]; inside=ndimage.binary_erosion(a>127,iterations=12); vals=a[inside]; hist={str(int(v)):int(n) for v,n in zip(*np.unique(vals,return_counts=True))}; report={'interior_definition':'alpha>127 mask eroded12nativepixels','interior_pixels':len(vals),'interior_alpha_histogram':hist,'interior_alpha_below250':int((vals<250).sum()),'maximum_black_to_white_background_influence_per_channel':int(255-vals.min()),'median_black_to_white_background_influence_per_channel':float(255-np.median(vals)),'interpretation':'Nearopaque interiors, not materially translucent on inspected backdrops; alpha255 count alone is not a rejection criterion.'}
canvas=Image.new('RGB',(980,420),'#888888');d=ImageDraw.Draw(canvas)
for row,bg in enumerate(['#ffffff','#07121f']):
 y=row*210;d.rectangle((0,y,980,y+210),fill=bg);d.text((10,y+8),'Popo v5 / '+bg+' / 36px body at1x and4x nearest display',fill='#333333' if row==0 else '#ffffff')
 for i,name in enumerate(['idle','attack','recovery']):
  im=Image.open(p/'previews'/f'{name}-36px.png');base=Image.new('RGBA',im.size,bg);base.alpha_composite(im);canvas.paste(base.convert('RGB'),(50+i*300,y+65)); canvas.paste(base.resize((im.width*4,im.height*4),Image.Resampling.NEAREST).convert('RGB'),(115+i*300,y+35))
canvas.save(p/'alpha-light-dark-review.png');(p/'alpha-inspection.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));m=json.loads((p/'manifest.json').read_text());print(m['previews']);print([(r['pose'],r['alpha_components'],r['tiny_components_le4']) for r in m['frames']])
