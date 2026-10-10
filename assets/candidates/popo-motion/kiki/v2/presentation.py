from pathlib import Path
import json,base64,hashlib
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;m=json.loads((R/'manifest.json').read_text());sources={};frames=[]
for f in m['frames']:frames.append(Image.open(R/f['path']))
for h in (44,56):
 s=h/557;sources[str(h)]=[]
 for im in frames:
  p=im.transform((__import__('math').ceil(896*s),__import__('math').ceil(704*s)),Image.Transform.AFFINE,(1/s,0,0,0,1/s,.25/s),Image.Resampling.NEAREST)
  import io
  b=io.BytesIO();p.save(b,format='PNG');sources[str(h)].append('data:image/png;base64,'+base64.b64encode(b.getvalue()).decode())
# GIF is a separate flattened, lossy review presentation, not editable source.
an=[]
for i in range(3):
 page=Image.new('RGB',(740,290),'#fffaf0');d=ImageDraw.Draw(page);d.text((12,10),f'Popo / Kiki v2 - pose {i+1}/3 - 250ms each - inspection only',fill='#29332c')
 for col,(h,bg) in enumerate([(44,'#fff7e8'),(56,'#fff7e8'),(44,'#d8eee3'),(56,'#d8eee3')]):
  x=col*185;d.rectangle((x,40,x+184,289),fill=bg);s=h/557;p=frames[i].transform((__import__('math').ceil(896*s),__import__('math').ceil(704*s)),Image.Transform.AFFINE,(1/s,0,0,0,1/s,.25/s),Image.Resampling.NEAREST);page.paste(p,(x+40,85),p);d.text((x+9,52),f'Body {h}px / canvas {p.width}x{p.height}',fill='#29332c');d.text((x+9,190),f'Envelope width {157*s:.1f}px',fill='#29332c');d.text((x+9,215),['Prepare','Release (detached)','Recover'][i],fill='#29332c')
 an.append(page)
an[0].save(R/'preview.gif',save_all=True,append_images=an[1:],duration=[250]*3,loop=0,disposal=2,optimize=False)
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Popo / Kiki v2 keyposes</title><style>body{font:16px system-ui;margin:24px;color:#29332c;max-width:900px}button,select,input{font:inherit;margin:6px;padding:5px}#stage{height:220px;background:#fff7e8;border:1px solid #8ca18f;display:flex;align-items:center;justify-content:center}img{image-rendering:pixelated}p{line-height:1.5}</style><h1>Popo / Kiki v2: three keyposes</h1><p>Preparation → release → recovery. Candidate only, not a smooth completed animation.</p><div id="stage"><img id="sprite" alt="Popo keypose"></div><p><button id="prev">Previous</button><button id="toggle">Play</button><button id="next">Next</button><label>Pose <input id="frame" type="range" min="0" max="2" value="0"></label><output id="readout"></output></p><p><label>Actual body height <select id="size"><option>44</option><option selected>56</option></select>px</label><label>Background <select id="bg"><option value="#fff7e8">Cream</option><option value="#d8eee3">Mint</option></select></label></p><p id="dimensions"></p><p>Three real generated images, 250ms per pose (4fps). Common preview scale from maximum 557px body height, not outlier extent; native extracted frames are unchanged by preview scaling. Detached envelope is baked into pose 2. A separate engine projectile is future work only.</p><p>Head and face are more consistent than v1, but green apron top/strap changes remain. Alpha fringe and isolates are preserved. No timing or production approval is implied.</p><script>
const sources=DATA;const labels=['preparation','release with detached envelope','recovery'];const el=id=>document.getElementById(id);let index=0,timer=null,size='56';function show(i){index=(i+3)%3;el('sprite').src=sources[size][index];el('sprite').alt=`Popo ${labels[index]}`;el('frame').value=index;el('readout').textContent=`${index+1} / 3: ${labels[index]}`;el('dimensions').textContent=size==='44'?'Body 44px; preview canvas 71×56px; detached envelope width 12.4px.':'Body 56px; preview canvas 91×71px; detached envelope width 15.8px.';}function stop(){if(timer!==null)clearInterval(timer);timer=null;el('toggle').textContent='Play'}function start(){stop();timer=setInterval(()=>show(index+1),250);el('toggle').textContent='Pause'}el('toggle').onclick=()=>timer===null?start():stop();el('next').onclick=()=>{stop();show(index+1)};el('prev').onclick=()=>{stop();show(index-1)};el('frame').oninput=()=>{stop();show(Number(el('frame').value))};el('size').onchange=e=>{size=e.target.value;show(index)};el('bg').onchange=e=>el('stage').style.background=e.target.value;show(0);
</script></html>'''.replace('DATA',json.dumps(sources))
(R/'viewer.html').write_text(html)
with Image.open(R/'preview.gif') as gif:
 assert gif.n_frames==3
 for i in range(3):gif.seek(i);assert gif.info['duration']==250
m['animated_preview']=dict(path='preview.gif',sha256=hashlib.sha256((R/'preview.gif').read_bytes()).hexdigest(),dimensions_px=[740,290],frames=3,frame_order=[1,2,3],duration_each_ms=250,loop='infinite inspection loop',format_warning='Flattened lossy palette GIF presentation only; not source art or approved action timing')
m['viewer']=dict(path='viewer.html',sha256=hashlib.sha256((R/'viewer.html').read_bytes()).hexdigest(),method='Embeds six uniformly scaled preview PNGs, selects actual pose images; source native PNGs remain untouched',browser_validation='Live browser verification pending')
(R/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print('GIF and viewer prepared')
