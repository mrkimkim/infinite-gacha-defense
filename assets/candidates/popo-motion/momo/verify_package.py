"""Verify preserved candidate bytes and offline review assets; not browser playback."""
from pathlib import Path
import base64,hashlib,json,re
from PIL import Image
import numpy as np
root=Path(__file__).resolve().parent
v=root/'v5';m=json.loads((v/'manifest.json').read_text())
for name,digest in m['package_hashes'].items():
 path=root/name
 assert path.is_file(),name
 assert hashlib.sha256(path.read_bytes()).hexdigest()==digest,name
raw=np.array(Image.open(v/'raw-generated.png')); restored=np.zeros_like(raw)
for frame in m['frames']:
 x0,y0,x1,y1=frame['source_partition'];dx,dy=frame['translation'];a=np.array(Image.open(v/frame['path'])); restored[y0:y1,x0:x1]=a[y0+dy:y1+dy,x0+dx:x1+dx]
assert np.array_equal(raw,restored),'native RGBA reconstruction'
gif=Image.open(v/'playback-36px.gif'); durations=[]; decoded=[]
for i in range(gif.n_frames):
 gif.seek(i);durations.append(gif.info['duration']);decoded.append(np.array(gif.convert('RGBA')))
assert durations==[120,100,140,640]
assert np.array_equal(decoded[0],decoded[3]),'idle lead-in/gap equality'
html=(v/'viewer.html').read_text()
assert 'idle lead-in' in html and "['prepare'" not in html
assert not re.search(r'(?:src|href)=[\"\']https?://',html)
embedded=re.findall(r'data:image/png;base64,([A-Za-z0-9+/=]+)',html)
assert len(embedded)==4
for data in embedded: assert base64.b64decode(data).startswith(b'\x89PNG\r\n\x1a\n')
for doc in [root/'README.md',v/'README.md']:
 for target in re.findall(r'\]\(([^)]+)\)',doc.read_text()):
  if not target.startswith(('http://','https://','#')):assert (doc.parent/target).exists(),target
reference=root/'../../../../docs/reference/characters/popo/sheet.png'
assert hashlib.sha256(reference.read_bytes()).hexdigest()==m['reference_sha256']
# V6 is an independently manifested candidate. Exclude exactly that subtree;
# retain exhaustive inventory checks for the original v1-v5 package.
# Run v6/verify_package.py separately; no other new path is exempt.
assert {f.relative_to(root).as_posix() for f in root.rglob('*') if f.is_file() and f.relative_to(root).parts[0] != 'v6'}==set(m['package_hashes'])|{'v5/manifest.json','package-verification.json'}
result={'status':'PASS','hashed_files':len(m['package_hashes']),'full_native_rgba_reconstruction':True,'gif_frames':len(decoded),'gif_durations_ms':durations,'idle_first_last_identical':True,'viewer_embedded_pngs':len(embedded),'local_links_valid':True,'actual_browser_playback':'UNVERIFIED: author environment Chromium socket launch blocked','production_adoption':False}
(root/'package-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
