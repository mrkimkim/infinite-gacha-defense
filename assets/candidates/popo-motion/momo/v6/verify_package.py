"""Non-mutating preservation checks, not a browser or combat test."""
from pathlib import Path
import hashlib, json, re, base64, io
import numpy as np
from scipy import ndimage
from PIL import Image
r=Path(__file__).parent
m=json.loads((r/'manifest.json').read_text())
actual={str(p.relative_to(r)) for p in r.rglob('*') if p.is_file() and p.name!='manifest.json'}
assert actual==set(m['sha256'])
for name,sha in m['sha256'].items():
 assert hashlib.sha256((r/name).read_bytes()).hexdigest()==sha,name
p=r/'body-attempt-2'; raw=np.array(Image.open(p/'raw-generated.png'))
labels,n=ndimage.label(raw[:,:,3]>127); counts=np.bincount(labels.ravel());counts[0]=0
ids=sorted(np.argsort(counts)[-4:],key=lambda i:np.where(labels==i)[1].min());seeds=np.zeros(labels.shape,dtype=np.int32)
for i,label in enumerate(ids,1):seeds[labels==label]=i
indices=ndimage.distance_transform_edt(seeds==0,return_distances=False,return_indices=True);owner=seeds[tuple(indices)];restored=np.zeros_like(raw)
measure=json.loads((p/'measurements.json').read_text())
for i,row in enumerate(measure['body_frames']):
 yy,xx=np.where(owner==i+1);dx,dy=row['translation'];f=np.array(Image.open(p/'frames'/f"{row['pose']}.png"));restored[yy,xx]=f[yy+dy,xx+dx]
assert np.array_equal(restored,raw)
g=Image.open(p/'art-cycle-32-36.gif');ds=[]
for i in range(g.n_frames):g.seek(i);ds.append(g.info['duration'])
assert ds==[500,180,100,180]
for pose in ['idle','anticipation','release','recovery']:
 for height in [32,36]:
  a=np.array(Image.open(p/'previews'/f'{pose}-{height}px-body.png'))[:,:,3];l,n=ndimage.label(a>127);c=np.bincount(l.ravel());c[0]=0;y,x=np.where(l==c.argmax());assert y.max()-y.min()+1==height
html=(p/'art-cycle-viewer.html').read_text(); embedded=re.findall(r'data:image/png;base64,([A-Za-z0-9+/=]+)',html)
assert len(embedded)==9
for data in embedded:Image.open(io.BytesIO(base64.b64decode(data))).verify()
assert not re.search(r'(?:src|href)=["\'](?:https?://|/)',html)
assert 'fetch(' not in html
for f in r.rglob('*'):
 if f.suffix in ['.py','.json','.html','.txt','.md','.cjs']:
  s=f.read_text(); assert ('/'+'workspace'+'/') not in s and ('slack'+'.com/') not in s,f
print(json.dumps({'status':'PASS','hashed_files':len(actual),'raw_RGBA_reconstruction':True,'body_heights':[32,36],'gif_durations_ms':ds,'embedded_PNGs':9,'actual_browser_playback':False}))
