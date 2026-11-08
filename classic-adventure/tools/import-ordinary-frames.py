"""Verify and extract global starts for the ordinary source body clips."""
from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as E
root=Path(__file__).resolve().parents[1];raw=Path(sys.argv[1]).read_bytes();sha='4b53ccfa0c000b203405a1f7666eec761935553e533e1746ec0dea517897b9cc';assert hashlib.sha256(raw).hexdigest()==sha
tracks={t.findtext('name'):t.findall('t') for t in E.fromstring('<root>'+raw.decode()+'</root>').findall('track')};ranges={}
for layer in ['anim_walk','anim_walk2','anim_eat']:
 value=-1;ids=[]
 for i,t in enumerate(tracks[layer]):
  if t.find('f') is not None:value=float(t.findtext('f'))
  if value>=0:ids.append(i)
 assert ids==list(range(ids[0],ids[-1]+1));ranges[layer]={'start':ids[0],'count':len(ids)}
assert ranges=={'anim_walk':{'start':44,'count':47},'anim_walk2':{'start':91,'count':47},'anim_eat':{'start':138,'count':40}}
data={f'{kind}-{state}':ranges['anim_'+state]['start'] for kind in ['zombie','cone','bucket','door'] for state in ['walk','walk2','eat']};data['zombie-headless']=44
p=root/'src/rendering/ordinary-frame-start.json';p.write_text(json.dumps(data,separators=(',',':'))+'\n')
(root/'docs/ordinary-frame-source.json').write_text(json.dumps({'commit':'325b2229a7225d73870bb69322eefcda3a45bf8d','sourceSHA256':sha,'source':'SexyAppFramework/reanim/Zombie.reanim','ranges':ranges,'metadataSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'metadataBytes':p.stat().st_size,'newImages':0},indent=2)+'\n')
print(ranges)
