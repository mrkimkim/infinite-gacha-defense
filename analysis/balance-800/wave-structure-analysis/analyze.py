import json,pathlib,collections,statistics
base=pathlib.Path(__file__).resolve().parents[1];groups=[];allrows=[]
for folder in ['balance-baseline-400','balance-revision-101-200']:
 rows=json.loads((base/folder/'results.json').read_text())
 for profile in sorted(set(r['profile'] for r in rows)):
  for policy in ['normal','expert']:
   runs=[r for r in rows if r['profile']==profile and r['policy']==policy];waveStats=collections.defaultdict(list)
   for r in runs:
    rec=json.loads((base/folder/'replays'/f"{policy}-{profile}-{r['seed']}.json").read_text());wave=None;ticks=0
    for e in rec['entries']:
     if e['type']=='command' and e['command']['type']=='startWave':
      if wave is not None:waveStats[wave].append(ticks)
      wave=e['events'][0]['wave'];ticks=0
     elif e['type']=='advance':ticks+=e['executedTicks']
    if wave is not None:waveStats[wave].append(ticks)
   g=dict(cohort=folder,profile=profile,policy=policy,runs=len(runs),wins=sum(r['outcome']=='win' for r in runs),failures=dict(collections.Counter(f"{r['wave']}:{r['reason']}" for r in runs if r['outcome']=='loss')),peakObserved=max(r['maxPressure'] for r in runs),waves={str(w):dict(n=len(ts),early=sum(t<(600 if w%5==0 else 400) for t in ts),atDuration=sum(t==(600 if w%5==0 else 400) for t in ts),meanTicks=statistics.mean(ts)) for w,ts in waveStats.items()});groups.append(g);allrows+=runs
out=dict(runs=len(allrows),wins=sum(r['outcome']=='win' for r in allrows),failures=dict(collections.Counter(f"{r['wave']}:{r['reason']}" for r in allrows if r['outcome']=='loss')),maximumObserved=max(r['maxPressure'] for r in allrows),groups=groups)
(base/'wave-structure-analysis'/'summary.json').write_text(json.dumps(out,indent=2))
print('TOTAL', {k:v for k,v in out.items() if k!='groups'})
for g in groups:print(g['cohort'],g['profile'].split('-')[-1],g['policy'],'peak',g['peakObserved'],'w19',g['waves']['19'],'w20',g['waves']['20'])
