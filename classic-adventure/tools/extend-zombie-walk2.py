"""Import pinned Zombie anim_walk2 while reusing every existing atlas pixel.
Usage: python3 tools/extend-zombie-walk2.py /path/to/Zombie.reanim
"""
from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as E
root=Path(__file__).resolve().parents[1];raw=Path(sys.argv[1]).read_bytes();expected='4b53ccfa0c000b203405a1f7666eec761935553e533e1746ec0dea517897b9cc';assert hashlib.sha256(raw).hexdigest()==expected
fields=['x','y','sx','sy','kx','ky','f','a','i'];tracks={}
for track in E.fromstring('<root>'+raw.decode()+'</root>').findall('track'):
 state=dict(x=0,y=0,sx=1,sy=1,kx=0,ky=0,f=0,a=1,i='');poses=[]
 for t in track.findall('t'):
  for c in t:
   if c.tag in state:state[c.tag]=c.text.removeprefix('IMAGE_REANIM_') if c.tag=='i' else float(c.text)
  poses.append([state[f] for f in fields])
 tracks[track.findtext('name')]=poses
ids=[i for i,p in enumerate(tracks['anim_walk2']) if p[6]>=0];assert ids==list(range(91,138))
base=root/'public/assets/runtime/actor-motion';data=json.loads((base/'zombie.json').read_text());provenance=json.loads((root/'docs/actor-motion-assets.json').read_text());indexpath=root/'src/rendering/actor-motion-index.json';index=json.loads(indexpath.read_text());proof={}
for kind in ['zombie','cone','bucket','door']:
 name=kind+'-walk2';old=data['clips'][kind+'-walk'];hidden=provenance['clips'][kind+'-walk']['hidden'];selected=[]
 for track,poses in tracks.items():
  if any(track.startswith(prefix) for prefix in hidden):continue
  chosen=[poses[i] for i in ids]
  if any(p[8] and p[6]>=0 and p[7]>0 for p in chosen):selected.append({'name':track,'poses':chosen})
 assert all(p[8] in data['frames'] for t in selected for p in t['poses'] if p[8]),'Requires a new image audit'
 data['clips'][name]={**{k:old[k] for k in ['origin','scale','healthTop','duration']},'groups':[{'length':len(ids),'tracks':selected}],'nativeFrameTime':True};index[name]='zombie';proof[name]={'frames':len(ids),'tracks':len(selected),'posesSHA256':hashlib.sha256(json.dumps(selected,separators=(',',':')).encode()).hexdigest()}
data['atlas']='zombie'
encoded=json.dumps(data,separators=(',',':')).encode();filename='zombie-'+hashlib.sha256(encoded).hexdigest()[:16]+'.json';(base/filename).write_bytes(encoded)
p=root/'src/rendering/actor-motion-metadata.json';mapping=json.loads(p.read_text());mapping['zombie']=filename;p.write_text(json.dumps(mapping,indent=2)+'\n');indexpath.write_text(json.dumps(index,indent=2)+'\n')
ground={'start':91,'x':[tracks['_ground'][i][0] for i in ids]};p=root/'src/game/data/zombie-ground-walk2.json';p.write_text(json.dumps(ground,separators=(',',':'))+'\n')
proof={'commit':provenance['commit'],'sourceSHA256':expected,'source':'SexyAppFramework/reanim/Zombie.reanim','layer':'anim_walk2','start':91,'count':47,'metadata':filename,'metadataBytes':len(encoded),'metadataSHA256':hashlib.sha256(encoded).hexdigest(),'groundBytes':p.stat().st_size,'groundSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'clips':proof,'imagesAdded':0,'atlasChanged':False}
(root/'docs/zombie-walk2-source.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof,ensure_ascii=False))
