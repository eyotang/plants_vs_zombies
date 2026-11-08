"""Pack original 1x Reanim pixels in the existing logical atlas layout.

Usage: python tools/build-classic-textures.py ORIGINAL_SOURCE_ROOT
The root contains the original repository-relative PNG/JPG paths. Existing 2x
assets and pose metadata remain untouched for older deployed clients.
"""
from pathlib import Path
import hashlib,json,sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1]).resolve()
RUNTIME=ROOT/'public/assets/runtime'
COMMIT='325b2229a7225d73870bb69322eefcda3a45bf8d'
sources={}
for name in ['actor-motion-assets','plant-motion-assets','giant-motion-assets','boss-assets','shop-plant-assets']:
    data=json.loads((ROOT/'docs'/f'{name}.json').read_text())
    if 'commit' in data:assert data['commit']==COMMIT
    for path,digest in data.get('sources',data).items():
        if path.lower().endswith(('.png','.jpg')):
            assert path not in sources or sources[path]==digest
            sources[path]=digest
images={Path(path).stem.upper():path for path in sources if path.lower().endswith('.png')}
images.update(ZOMBIE_BOSS_NECK='SexyAppFramework/reanim/Zombie_boss_neck_.png',ZOMBIE_BOSS_UPPERBODY='SexyAppFramework/reanim/Zombie_boss_upperbody_.png')
required={key for folder in ['plant-motion','actor-motion','giant-motion'] for metadata in (RUNTIME/folder).glob('*.json') for key in json.loads(metadata.read_text())['frames']}
assert required<=images.keys(),sorted(required-images.keys())
used={};cache={};outputs={}
def read(path):
    body=(SOURCE/path).read_bytes();assert hashlib.sha256(body).hexdigest()==sources[path],path
    used[path]=sources[path]
    return Image.open(SOURCE/path)
def original(name):
    if name not in cache:
        path=images[name];im=read(path).convert('RGBA')
        if name in ['ZOMBIE_BOSS_NECK','ZOMBIE_BOSS_UPPERBODY']:
            color=str(Path(path).with_name(Path(path).stem[:-1]+'.jpg'))
            alpha=im.convert('L');im=read(color).convert('RGBA');assert im.size==alpha.size;im.putalpha(alpha)
        cache[name]=im
    return cache[name]
def save(image,path,old,frame_hashes):
    path.parent.mkdir(parents=True,exist_ok=True)
    image.save(path,lossless=True,method=6,exact=True)
    decoded=Image.open(path).convert('RGBA')
    assert decoded.tobytes()==image.tobytes(),path
    old_size=Image.open(old).size
    assert old_size==(image.width*2,image.height*2),(path,old_size,image.size)
    outputs[path.relative_to(RUNTIME).as_posix()]={
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'size':list(image.size),'logicalSize':list(image.size),
        'oldSize':list(old_size),'encodedBytes':path.stat().st_size,
        'oldEncodedBytes':old.stat().st_size,'framesRGBA256':frame_hashes,
    }
for folder in ['plant-motion','actor-motion','giant-motion']:
    for metadata in sorted((RUNTIME/folder).glob('*.json')):
        definition=json.loads(metadata.read_text())
        if definition.get('atlas'):continue  # Versioned pose metadata shares its named atlas.
        old=metadata.with_suffix('.webp')
        width,height=Image.open(old).size;assert width%2==height%2==0
        atlas=Image.new('RGBA',(width//2,height//2));frame_hashes={}
        for name,rect in definition['frames'].items():
            assert all(int(value)==value for value in rect),(metadata,name,rect)
            x,y,w,h=map(int,rect);im=original(name);assert im.size==(w,h),(metadata,name,im.size,rect)
            assert x>=0 and y>=0 and x+w<=atlas.width and y+h<=atlas.height
            atlas.paste(im,(x,y));frame_hashes[name]=hashlib.sha256(im.tobytes()).hexdigest()
        target=metadata.with_suffix('.classic.webp');save(atlas,target,old,frame_hashes)
        decoded=Image.open(target).convert('RGBA')
        for name,(x,y,w,h) in definition['frames'].items():
            assert hashlib.sha256(decoded.crop((x,y,x+w,y+h)).tobytes()).hexdigest()==frame_hashes[name],(metadata,name)
definitions=json.loads((RUNTIME/'boss/tracks.json').read_text())
names=sorted({p[8] for d in definitions.values() for t in d['tracks'] for p in t['poses'] if p[8]})
for name in names:
    im=original(name);old=RUNTIME/'boss'/f'{name}.webp'
    save(im,RUNTIME/'boss'/f'{name}.classic.webp',old,{name:hashlib.sha256(im.tobytes()).hexdigest()})
report={'repository':'https://github.com/ruslan831/PlantsVsZombies-decompilation','commit':COMMIT,'generator':'tools/build-classic-textures.py','resolution':1,'note':'Original pixels packed without resizing or generative upscaling; logical frame rectangles and pose metadata unchanged. Lossless WebP decoded pixels and every packed frame verified against originals.','sources':used,'outputs':outputs,'oldDecodedRGBA':sum(w*h*4 for item in outputs.values() for w,h in [item['oldSize']]),'newDecodedRGBA':sum(w*h*4 for item in outputs.values() for w,h in [item['size']]),'oldEncodedBytes':sum(x['oldEncodedBytes'] for x in outputs.values()),'newEncodedBytes':sum(x['encodedBytes'] for x in outputs.values())}
(ROOT/'docs/classic-texture-assets.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k in ['oldDecodedRGBA','newDecodedRGBA','oldEncodedBytes','newEncodedBytes']}|{'outputs':len(outputs),'verifiedSources':len(used)}))
