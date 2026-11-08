"""Export native pea body/head clips, reusing existing classic atlases.
Only eight blink images need an additional small lossless atlas.
Usage: python tools/import-pea-art.py SOURCE_DIRECTORY
"""
from pathlib import Path
import hashlib
import io
import json
import sys
import xml.etree.ElementTree as ET
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
output = root / 'public/assets/runtime/pea-motion'
output.mkdir(parents=True, exist_ok=True)
names = {'peashooter': ('PeaShooterSingle', 'plant-motion/peashooter'), 'snowpea': ('SnowPea', 'actor-motion/snowpea'),
         'repeater': ('PeaShooter', 'actor-motion/peashooter'), 'gatlingpea': ('GatlingPea', 'plant-motion/gatlingpea'), 'splitpea': ('SplitPea', 'actor-motion/splitpea'), 'threepeater': ('ThreePeater', 'plant-motion/threepeater')}
expected = json.loads((root / 'docs/pea-geometry-source.json').read_text())['sources']
blink_names = sorted([p for p in source.glob('*.png') if p.stem.upper() in {f'{kind}_BLINK{i}' for kind in ['PEASHOOTER', 'SNOWPEA', 'GATLINGPEA', 'THREEPEATER'] for i in [1, 2]}])
assert len(blink_names) == 8
canvas = Image.new('RGBA', (512, 512))
rects = {}; x = 1; y = 1; row = 0; sources = {}
for path in blink_names:
    image = Image.open(path).convert('RGBA')
    if x + image.width + 1 > canvas.width:
        x = 1; y += row + 2; row = 0
    assert y + image.height + 1 <= canvas.height
    canvas.paste(image, (x, y))
    rects[path.stem.upper()] = [x, y, image.width, image.height]
    sources[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    x += image.width + 2; row = max(row, image.height)
canvas = canvas.crop((0, 0, max(r[0] + r[2] + 1 for r in rects.values()), y + row + 1))
encoded = io.BytesIO(); canvas.save(encoded, 'WEBP', lossless=True, method=6, exact=True)
decoded = Image.open(io.BytesIO(encoded.getvalue())).convert('RGBA')
assert decoded.tobytes() == canvas.tobytes()
blink_json = json.dumps({'frames': rects}, separators=(',', ':')).encode()
blink = 'blink-' + hashlib.sha256(encoded.getvalue() + blink_json).hexdigest()[:16]
(output / (blink + '.classic.webp')).write_bytes(encoded.getvalue())
(output / (blink + '.json')).write_bytes(blink_json)
index = {'blink': blink, 'kinds': {}}
for kind, (name, atlas) in names.items():
    path = source / (name + '.reanim')
    sources[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    assert sources[path.name] == expected[path.name]
    tracks = {}
    for track in ET.fromstring('<root>' + path.read_text() + '</root>').findall('track'):
        track_name = track.findtext('name')
        if kind == 'peashooter' and track_name == 'GatlingPea_helmet2':
            continue  # Preserve the existing classic sprout, excluding the mirror's added helmet.
        state = dict(x=0, y=0, sx=1, sy=1, kx=0, ky=0, f=0, a=1, i='')
        poses = []
        for frame in track.findall('t'):
            for child in frame:
                if child.tag in state:
                    state[child.tag] = child.text.removeprefix('IMAGE_REANIM_') if child.tag == 'i' else float(child.text)
            poses.append(list(state.values()))
        tracks[track_name] = poses
    def poses_for(layer):
        ids = [i for i, pose in enumerate(tracks[layer]) if pose[6] >= 0]
        return {name: poses[ids[0]:ids[-1] + 1] for name, poses in tracks.items()}
    def visible(poses):
        return any(p[8] and p[6] >= 0 and p[7] > 0 for p in poses)
    body = poses_for('anim_idle')
    definition = {'body': {'length': len(body['anim_idle']), 'stem': body.get('anim_stem', body['anim_idle']),
                            'tracks': [{'name': name, 'poses': poses} for name, poses in body.items() if visible(poses)]}, 'heads': []}
    clips = [('anim_head_idle'+i, 'anim_shooting'+i) for i in ['1','2','3']] if kind == 'threepeater' else [('anim_head_idle', 'anim_shooting')] + ([('anim_splitpea_idle', 'anim_splitpea_shooting')] if kind == 'splitpea' else [])
    for idle, shoot in clips:
        idle_poses, shoot_poses = poses_for(idle), poses_for(shoot)
        selected = [name for name in tracks if visible(idle_poses[name]) or visible(shoot_poses[name])]
        definition['heads'].append({'names': selected, 'idle': [idle_poses[name] for name in selected], 'shoot': [shoot_poses[name] for name in selected]})
    if kind == 'threepeater':
        for i, head in enumerate(definition['heads'], 1):
            head['attachment'] = body['anim_head'+str(i)]
    old = json.loads((root / 'public/assets/runtime' / (atlas + '.json')).read_text())
    used = {p[8] for t in definition['body']['tracks'] for p in t['poses'] if p[8] and p[6] >= 0 and p[7] > 0}
    for head in definition['heads']:
        used.update(p[8] for mode in ['idle', 'shoot'] for poses in head[mode] for p in poses if p[8] and p[6] >= 0 and p[7] > 0)
    assert not used - set(old['frames']) - set(rects), (kind, used - set(old['frames']) - set(rects))
    data = json.dumps(definition, separators=(',', ':')).encode()
    filename = kind + '-' + hashlib.sha256(data).hexdigest()[:16] + '.json'
    (output / filename).write_bytes(data); index['kinds'][kind] = filename
    print(kind, len(data), 'bytes; existing image atlas reused')
(root / 'src/rendering/pea-art-index.json').write_text(json.dumps(index, indent=2) + '\n')
(root / 'docs/pea-art-source.json').write_text(json.dumps({'commit': '325b2229a7225d73870bb69322eefcda3a45bf8d', 'sources': sources,
    'blinkAtlas': {'base': blink, 'size': canvas.size, 'encodedBytes': len(encoded.getvalue()), 'decodedRGBA': canvas.width * canvas.height * 4},
    'existingAtlasesUnchanged': list(atlas for name, atlas in names.values())}, indent=2) + '\n')
