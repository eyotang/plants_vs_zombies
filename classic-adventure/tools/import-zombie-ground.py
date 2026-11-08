"""Extract the original anim_walk ground samples without image/texture changes.
Usage: python3 tools/import-zombie-ground.py /path/to/Zombie.reanim
"""
from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as E
root=Path(__file__).resolve().parents[1];source=Path(sys.argv[1]);raw=source.read_bytes()
expected='4b53ccfa0c000b203405a1f7666eec761935553e533e1746ec0dea517897b9cc'
assert hashlib.sha256(raw).hexdigest()==expected
xml=E.fromstring('<root>'+raw.decode()+'</root>');tracks={t.findtext('name'):t.findall('t')for t in xml.findall('track')}
f=-1;visible=[]
for i,t in enumerate(tracks['anim_walk']):
 if t.find('f')is not None:f=float(t.findtext('f'))
 if f>=0:visible.append(i)
x=0;values=[]
for t in tracks['_ground']:
 if t.find('x')is not None:x=float(t.findtext('x'))
 values.append(x)
assert visible==list(range(44,91))
data={'start':visible[0],'x':[values[i]for i in visible]};dest=root/'src/game/data/zombie-ground.json';dest.write_text(json.dumps(data,separators=(',',':'))+'\n')
manifest={'repository':'https://github.com/ruslan831/PlantsVsZombies-decompilation','commit':'325b2229a7225d73870bb69322eefcda3a45bf8d','source':'SexyAppFramework/reanim/Zombie.reanim','sourceSHA256':expected,'layer':'anim_walk','track':'_ground','start':44,'count':47,'metadataSHA256':hashlib.sha256(dest.read_bytes()).hexdigest(),'metadataBytes':dest.stat().st_size}
(root/'docs/zombie-ground-source.json').write_text(json.dumps(manifest,indent=2)+'\n');print(manifest)
