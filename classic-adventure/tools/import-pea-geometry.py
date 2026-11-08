"""Extract body attachment points and head clip lengths from pinned Reanim XML.
Usage: python3 tools/import-pea-geometry.py SOURCE_DIRECTORY
This produces simulation geometry only; it does not alter runtime art.
"""
from pathlib import Path
import hashlib
import json
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
names = {'peashooter': 'PeaShooterSingle', 'snowpea': 'SnowPea', 'repeater': 'PeaShooter', 'gatlingpea': 'GatlingPea', 'splitpea': 'SplitPea', 'threepeater': 'ThreePeater'}
known = {}
for name in ['plant-motion-assets', 'actor-motion-assets']:
    known.update(json.loads((root / 'docs' / (name + '.json')).read_text())['sources'])
geometry = {}
hashes = {}
for kind, name in names.items():
    path = source / (name + '.reanim')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == known['SexyAppFramework/reanim/' + path.name], name
    hashes[path.name] = digest
    tracks = {}
    for track in ET.fromstring('<root>' + path.read_text() + '</root>').findall('track'):
        state = dict(x=0, y=0, sx=1, sy=1, kx=0, ky=0, f=0, a=1, i='')
        poses = []
        for frame in track.findall('t'):
            for child in frame:
                if child.tag in state:
                    state[child.tag] = child.text.removeprefix('IMAGE_REANIM_') if child.tag == 'i' else float(child.text)
            poses.append(list(state.values()))
        tracks[track.findtext('name')] = poses
    def span(layer):
        ids = [i for i, pose in enumerate(tracks[layer]) if pose[6] >= 0]
        return ids[0], ids[-1] + 1
    start, end = span('anim_idle')
    anchor = tracks.get('anim_stem', tracks['anim_idle'])
    geometry[kind] = {'bodyFrames': end - start, 'stem': [pose[:6] for pose in anchor[start:end]],
                      'heads': [{'idleFrames': span('anim_head_idle1' if kind == 'threepeater' else 'anim_head_idle')[1] - span('anim_head_idle1' if kind == 'threepeater' else 'anim_head_idle')[0],
                                 'shootFrames': span('anim_shooting1' if kind == 'threepeater' else 'anim_shooting')[1] - span('anim_shooting1' if kind == 'threepeater' else 'anim_shooting')[0]}]}
    if kind == 'threepeater':
        geometry[kind]['heads'] = [{'idleFrames': span('anim_head_idle'+i)[1]-span('anim_head_idle'+i)[0], 'shootFrames': span('anim_shooting'+i)[1]-span('anim_shooting'+i)[0]} for i in ['1','2','3']]
    if kind == 'splitpea':
        geometry[kind]['heads'].append({'idleFrames': span('anim_splitpea_idle')[1] - span('anim_splitpea_idle')[0],
                                        'shootFrames': span('anim_splitpea_shooting')[1] - span('anim_splitpea_shooting')[0]})
output = root / 'src/game/data/pea-geometry.json'
output.write_text(json.dumps(geometry, separators=(',', ':')) + '\n')
(root / 'docs/pea-geometry-source.json').write_text(json.dumps({'commit': '325b2229a7225d73870bb69322eefcda3a45bf8d', 'sources': hashes,
    'rules': ['GetFramesForLayer uses first-to-last visible marker span, including intervening frames',
              'GetPeaHeadOffset samples anim_stem, otherwise anim_idle, at current body frame',
              'SetFramesForLayer resets time but preserves loop count; direct head transitions retain it'],
    'bytes': output.stat().st_size}, indent=2) + '\n')
print(output.name, output.stat().st_size, 'bytes')
