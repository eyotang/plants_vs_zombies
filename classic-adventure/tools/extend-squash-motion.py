"""Restore source Squash look/up/down clips without changing its atlas or footprint.
Run after import-actor-motion.py: python3 tools/extend-squash-motion.py Squash.reanim
"""
from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1];source=Path(sys.argv[1]);body=source.read_bytes()
provenance=json.loads((root/'docs/actor-motion-assets.json').read_text());expected=provenance['sources']['SexyAppFramework/reanim/Squash.reanim'];assert hashlib.sha256(body).hexdigest()==expected
fields=['x','y','sx','sy','kx','ky','f','a','i'];tracks={}
for track in ET.fromstring('<root>'+body.decode()+'</root>').findall('track'):
 state=dict(x=0,y=0,sx=1,sy=1,kx=0,ky=0,f=0,a=1,i='');poses=[]
 for frame in track.findall('t'):
  for child in frame:
   if child.tag in state:state[child.tag]=child.text.removeprefix('IMAGE_REANIM_') if child.tag=='i' else float(child.text)
  poses.append([state[f] for f in fields])
 tracks[track.findtext('name')]=poses
path=root/'public/assets/runtime/actor-motion/squash.json';data=json.loads(path.read_text());base=data['clips']['squash'];indexpath=root/'src/rendering/actor-motion-index.json';index=json.loads(indexpath.read_text());proof={}
for name,layer,fps in [('squash-look-left','anim_lookleft',24),('squash-look-right','anim_lookright',24),('squash-rise','anim_jumpup',24),('squash-attack','anim_jumpdown',60)]:
 ids=[i for i,p in enumerate(tracks[layer]) if p[6]>=0];selected=[]
 for track,poses in tracks.items():
  chosen=[poses[i] for i in ids]
  if any(p[8] and p[6]>=0 and p[7]>0 for p in chosen):selected.append({'name':track,'poses':chosen})
 assert all(p[8] in data['frames'] for t in selected for p in t['poses'] if p[8]),'New texture would require a separate asset audit'
 data['clips'][name]={'duration':len(ids)/fps*100,'groups':[{'length':len(ids),'tracks':selected}],**{key:base[key] for key in ['origin','scale','healthTop']}}
 index[name]='squash';provenance['clips'][name]={'source':'Squash','layer':layer};proof[name]={'layer':layer,'fps':fps,'frames':len(ids),'duration':len(ids)/fps*100,'posesSha256':hashlib.sha256(json.dumps(selected,separators=(',',':')).encode()).hexdigest()}
data['atlas']='squash';encoded=json.dumps(data,separators=(',',':'));filename='squash-'+hashlib.sha256(encoded.encode()).hexdigest()[:16]+'.json'
(path.parent/filename).write_text(encoded)
metapath=root/'src/rendering/actor-motion-metadata.json';metadata=json.loads(metapath.read_text()) if metapath.exists() else {};metadata['squash']=filename;metapath.write_text(json.dumps(metadata,indent=2)+'\n')
indexpath.write_text(json.dumps(index,indent=2)+'\n');(root/'docs/actor-motion-assets.json').write_text(json.dumps(provenance,indent=2)+'\n')
(root/'docs/squash-motion.json').write_text(json.dumps({'commit':provenance['commit'],'sourceSha256':expected,'metadataFile':filename,'clips':proof,'texturesChanged':False,'timingSource':'Plant::UpdateSquash: look/up 24 fps, down 60 fps; 80 look, 45 prelaunch, 50 rise, 10 fall, 100 hold.'},indent=2)+'\n')
print('Restored four source clips; all parts reuse the existing atlas.')
