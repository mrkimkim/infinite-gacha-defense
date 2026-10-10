from pathlib import Path
from PIL import Image
import hashlib,json,numpy as np
r=Path(__file__).parent;m=json.loads((r/'manifest.json').read_text());files={str(p.relative_to(r)) for p in r.rglob('*') if p.is_file() and p.name!='manifest.json'};assert files==set(m['sha256'])
for p,h in m['sha256'].items():assert hashlib.sha256((r/p).read_bytes()).hexdigest()==h,p
measure=json.loads((r/'measurements.json').read_text());assert measure['native_release_anchor']==[688,365]
for row in measure['effects']:
 p=r/'effects'/f"{row['variant'].replace(' ','-')}-{row['requested_effect_width']}px.png";im=Image.open(p);a=np.array(im)[:,:,3];y,x=np.where(a>127);assert x.max()-x.min()+1==row['requested_effect_width'];assert list(im.size)==row['canvas'];assert [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]==row['alpha_gt127_bbox']
print(json.dumps({'status':'PASS','hashed_files':len(files),'widths':[8,10,12],'native_anchor':[688,365],'actual_flight_test':False}))
