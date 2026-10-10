import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
function finiteClock(value,label){assert(Number.isFinite(value),`Invalid ${label}: expected a finite number`);}
function deliveryClocks(frame){finiteClock(frame.receivedAt,'CDP receivedAt');finiteClock(frame.ackedAt,'CDP ackedAt');assert(frame.ackedAt>=frame.receivedAt,'CDP ACK precedes receipt');}
/** Confirm the rendered status tick in actual CDP pixels, then await that frame's write and ACK. */
export async function terminalFrame({page,frames,root,terminalTick,renderedAt,statusBox,timeoutMs=10000}){
 finiteClock(renderedAt,'renderedAt');
 const seen=new Set(),deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){
  for(const frame of [...frames]){
   finiteClock(frame.timestamp,'CDP timestamp');
   if(seen.has(frame.file)||frame.timestamp<renderedAt-.025)continue;seen.add(frame.file);
   await frame.completed;deliveryClocks(frame);
   const crop=execFileSync('python3',['-c',`import sys
from PIL import Image
x,y,w,h=map(float,sys.argv[2:]);im=Image.open(sys.argv[1]);im.crop((int(x),int(y),int(x+w),int(y+h))).resize((int(w)*3,int(h)*3)).save(sys.stdout.buffer,format='PNG')`,root+'/'+frame.file,String(statusBox.x),String(statusBox.y),String(statusBox.width),String(statusBox.height)]);
   const text=execFileSync('tesseract',['stdin','stdout','--psm','7','-l','eng'],{input:crop,encoding:'utf8',stdio:['pipe','pipe','ignore'],timeout:3000});
   const tick=Number(text.match(/tick\s*(\d+)/i)?.[1]);
   if(tick===terminalTick){return{file:frame.file,timestamp:frame.timestamp,receivedAt:frame.receivedAt,ackedAt:frame.ackedAt,terminalTick,renderedAt,statusTickFromPixels:tick,statusBox,ocr:text};}
  }
  await page.waitForTimeout(25);
 }
 throw Error(`No received and ACKed CDP pixels show first terminal tick ${terminalTick}`);
}

/** Clean capture has no diagnostic tick text: verify final canvas pixels against a post-render browser screenshot. */
export async function finalCanvasFrame({page,frames,root,renderedAt,reference,box,timeoutMs=10000}){
 finiteClock(renderedAt,'renderedAt');
 const seen=new Set(),deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){
  for(const frame of [...frames]){
   finiteClock(frame.timestamp,'CDP timestamp');
   if(seen.has(frame.file)||frame.timestamp<renderedAt)continue;seen.add(frame.file);await frame.completed;deliveryClocks(frame);
   const metrics=JSON.parse(execFileSync('python3',['-c',`import sys,json
from PIL import Image,ImageChops,ImageStat
x,y,w,h=map(float,sys.argv[3:]);box=(round(x),round(y),round(x+w),round(y+h))
a=Image.open(sys.argv[1]).convert('RGB').crop(box);b=Image.open(sys.argv[2]).convert('RGB').crop(box)
d=ImageChops.difference(a,b);s=ImageStat.Stat(d);bad=sum(max(p)>40 for p in d.getdata())
print(json.dumps({'meanAbsoluteError':sum(s.mean)/3,'largeErrorPixels':bad,'pixels':a.width*a.height}))`,root+'/'+frame.file,reference,String(box.x),String(box.y),String(box.width),String(box.height)],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
   if(metrics.meanAbsoluteError<1&&metrics.largeErrorPixels<=36){return{file:frame.file,timestamp:frame.timestamp,receivedAt:frame.receivedAt,ackedAt:frame.ackedAt,renderedAt,reference,metrics,comparison:'Canvas JPEG versus final browser PNG; MAE<1 and <=36 pixels with any channel error>40'};}
  }
  await page.waitForTimeout(25);
 }
 throw Error('No ACKed CDP frame contains the final canvas pixels at/after final render');
}
