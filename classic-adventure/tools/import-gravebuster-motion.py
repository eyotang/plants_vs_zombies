"""Add native land/eat poses using only images already in the Gravebuster atlas.
Usage: python3 tools/import-gravebuster-motion.py /path/to/Gravebuster.reanim
Source: ruslan831/PlantsVsZombies-decompilation @325b2229a7225d73870bb69322eefcda3a45bf8d.
"""
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(source).hexdigest() == 'ad8e60b474dc05ead34efb505e68d807a1be269a8e9480d95eb578942e9d935c'
folder = root / 'public/assets/runtime/actor-motion'
definition = json.loads((folder / 'gravebuster.json').read_text())
definition['atlas'] = 'gravebuster'
tracks = {}
for track in ET.fromstring('<root>' + source.decode() + '</root>').findall('track'):
    state = dict(x=0, y=0, sx=1, sy=1, kx=0, ky=0, f=0, a=1, i='')
    poses = []
    for frame in track.findall('t'):
        for child in frame:
            if child.tag in state:
                state[child.tag] = child.text.removeprefix('IMAGE_REANIM_') if child.tag == 'i' else float(child.text)
        poses.append(list(state.values()))
    tracks[track.findtext('name')] = poses
for name, layer, fps in [('gravebuster-land', 'anim_land', 10), ('gravebuster-eating', 'anim_idle', 12)]:
    ids = [i for i, pose in enumerate(tracks[layer]) if pose[6] >= 0]
    selected = []
    for track, poses in tracks.items():
        frames = [poses[i] for i in ids]
        if any(p[8] and p[6] >= 0 and p[7] > 0 for p in frames):
            assert all(not p[8] or p[8] in definition['frames'] for p in frames)
            selected.append(dict(name=track, poses=frames))
    clip = {**definition['clips']['gravebuster'], 'duration': len(ids) / fps * 100,
            'groups': [dict(length=len(ids), tracks=selected)], 'nativeFrameTime': True}
    if layer == 'anim_idle':
        clip['blendFrom'] = 'gravebuster-land'
    definition['clips'][name] = clip
data = json.dumps(definition, separators=(',', ':')).encode()
name = 'gravebuster-' + hashlib.sha256(data).hexdigest()[:16] + '.json'
(folder / name).write_bytes(data)
metadata_path = root / 'src/rendering/actor-motion-metadata.json'
metadata = json.loads(metadata_path.read_text())
metadata['gravebuster'] = name
metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
index_path = root / 'src/rendering/actor-motion-index.json'
index = json.loads(index_path.read_text())
index.update({'gravebuster-land': 'gravebuster', 'gravebuster-eating': 'gravebuster'})
index_path.write_text(json.dumps(index, indent=2) + '\n')
print(name, len(data), 'bytes; existing atlas unchanged')
