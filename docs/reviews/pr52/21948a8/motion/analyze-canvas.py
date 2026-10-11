from pathlib import Path
import json,subprocess,statistics,sys
p=Path(sys.argv[1]);c=json.loads((p/'capture.json').read_text());s=json.loads((p/'snapshot.json').read_text());f=c['samples'];offset=statistics.median(x['receivedAt']-x['timestamp']/1000 for x in f[1:]);pts=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_frames','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',str(p/'canvas-original.webm')]))['frames'];assert len(f)==len(pts)
errors=[abs(float(p['best_effort_timestamp_time'])-x['timestamp']/1e6) for p,x in zip(pts,f)];assert max(errors)<.002
trans=[];contacts=[];seen=set();prev={}
for a in s['audit']:
 t=(a['wall']-offset)/1000
 for u in a['units']:
  status=(u['pose'],u['unsupported']);key=u['id']
  if prev.get(key)!=status:trans.append({'approxVideoSeconds':t,'wall':a['wall'],'tick':a['tick'],'unitId':key,'pose':status[0],'unsupported':status[1]});prev[key]=status
 for contact in a['contacts']:
  key=contact['attackId'],contact['targetId']
  if key in seen:continue
  seen.add(key);near=[x['timestamp']/1e6 for x in f if abs(x['timestamp']/1e6-t)<.2]
  contacts.append({'approxVideoSeconds':t,'wall':a['wall'],'tick':a['tick'],**contact,'nearbyFrameCount':len(near),'nearbyMaxGapSeconds':max([b-a for a,b in zip(near,near[1:])],default=None)})
report={'run':json.loads((p/'run.json').read_text()),'decodedFrames':len(pts),'sampledFrames':len(f),'maxDecodedPTSErrorSeconds':max(errors),'frameTimestampMaxGapSeconds':max((b['timestamp']-a['timestamp'])/1e6 for a,b in zip(f,f[1:])),'mapping':{'method':'Approximate cue position only: audit wall minus median(track frame receive performance.now - track timestamp). Arrival latency is not zero; pixel frames are final authority.','offsetMilliseconds':offset,'receiveOffsetRangeMilliseconds':[min(x['receivedAt']-x['timestamp']/1000 for x in f),max(x['receivedAt']-x['timestamp']/1000 for x in f)]},'transitions':trans,'contacts':contacts}
(p/'analysis.json').write_text(json.dumps(report,indent=2)+'\n');print('counts/maxgap',len(f),report['frameTimestampMaxGapSeconds']);print('contacts',[(x['attackId'],x['unitId'],round(x['approxVideoSeconds'],3),x['nearbyMaxGapSeconds']) for x in contacts]);print('idle',[(x['unitId'],round(x['approxVideoSeconds'],3),x['unsupported']) for x in trans if x['pose']=='idle'])
