from pathlib import Path
import base64,json
root=Path(__file__).resolve().parent
urls=['data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in sorted((root/'frames').glob('*.png'))]
html='''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Popo / Kiki motion candidate inspection</title>
<style>body{font:16px system-ui;margin:24px;background:#f5f5f0;color:#29332c;max-width:1000px}h1{font-size:24px}button,select,input{font:inherit;margin:5px;padding:5px}#stage{height:320px;display:flex;align-items:center;justify-content:center;border:1px solid #798d7d;background:#fff7e8}#spritebox{position:relative}#sprite{display:block;image-rendering:pixelated}#spritebox.guides:before{content:"";position:absolute;left:50%;top:0;bottom:0;border-left:1px dashed #b74b65;z-index:1}#spritebox.guides:after{content:"";position:absolute;top:90.625%;left:0;right:0;border-top:1px dashed #b74b65;z-index:1}.controls{padding:12px 0}.note{line-height:1.5;max-width:850px}#readout{font-variant-numeric:tabular-nums}</style>
<h1>Popo / Kiki: generated motion candidate</h1><p>Candidate only. Not production-ready. Actual eight-frame stepping; default paused.</p>
<div id="stage"><div id="spritebox"><img id="sprite" alt="Popo generated pose 1 of 8" width="56" height="56"></div></div>
<div class="controls"><button id="prev">Previous</button><button id="toggle">Play</button><button id="next">Next</button><label>Frame <input id="frame" type="range" min="0" max="7" value="0"></label><output id="readout"></output><br>
<label>Canvas size <select id="size"><option>44</option><option selected>56</option><option>256</option></select> px</label>
<label>Background <select id="bg"><option value="#fff7e8">Cream</option><option value="#d8eee3">Mint</option></select></label>
<label>Frames/sec <input id="fps" type="number" min="1" max="12" value="4" style="width:3em"></label><label><input id="guides" type="checkbox">Pivot guides</label></div>
<p class="note">All frames: 512×512 source canvas, shared approximate foot anchor (256,464), integer translation only. The 44/56px options display the whole padded canvas, giving an approximately 32/41px-tall body. Retained faint isolates require padding. Cream and mint are flat inspection backgrounds.</p>
<p class="note">Frames 1 and 2 barely differ as idle poses. Head, face, clothing and bag drift across the generated sequence. Alpha fringe and isolated pixels remain unmodified. Playback order and 4fps timing are for inspection only, not approved game animation.</p>
<p id="status">Loading embedded PNGs…</p>
<script>
const sources=REPLACE_DATA;
const sprite=document.getElementById('sprite'),slider=document.getElementById('frame'),readout=document.getElementById('readout');let index=0,timer=null;
function show(i){index=(i+sources.length)%sources.length;sprite.src=sources[index];sprite.alt=`Popo generated pose ${index+1} of 8`;slider.value=index;readout.textContent=`${index+1} / 8`;}
function stop(){if(timer!==null)clearInterval(timer);timer=null;document.getElementById('toggle').textContent='Play';}
function start(){stop();let fps=Math.min(12,Math.max(1,Number(document.getElementById('fps').value)||4));document.getElementById('fps').value=fps;timer=setInterval(()=>show(index+1),1000/fps);document.getElementById('toggle').textContent='Pause';}
document.getElementById('toggle').onclick=()=>timer===null?start():stop();document.getElementById('prev').onclick=()=>{stop();show(index-1)};document.getElementById('next').onclick=()=>{stop();show(index+1)};slider.oninput=()=>{stop();show(Number(slider.value))};document.getElementById('fps').onchange=()=>{if(timer!==null)start()};document.getElementById('size').onchange=e=>{sprite.width=Number(e.target.value);sprite.height=Number(e.target.value)};document.getElementById('bg').onchange=e=>document.getElementById('stage').style.background=e.target.value;document.getElementById('guides').onchange=e=>document.getElementById('spritebox').classList.toggle('guides',e.target.checked);
Promise.all(sources.map(src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>im.width===512&&im.height===512?resolve():reject(new Error('Wrong dimensions'));im.onerror=reject;im.src=src}))).then(()=>document.getElementById('status').textContent='All 8 embedded PNGs loaded. No network requests needed.').catch(()=>document.getElementById('status').textContent='Image decode failed. Candidate inspection blocked.');show(0);
</script></html>'''.replace('REPLACE_DATA',json.dumps(urls))
(root/'viewer.html').write_text(html)
print('Wrote self-contained viewer',len(html),'bytes')
