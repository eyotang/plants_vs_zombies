"""Pack pinned original FirePea images and retain all interpolated source tracks.
Usage: python tools/import-fire-parts.py SOURCE_DIRECTORY
"""
from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as ET
from PIL import Image
root=Path(__file__).resolve().parents[1];source=Path(sys.argv[1])
expected=json.loads((root/'docs/fire-pea-assets.json').read_text())['files']
for name,digest in expected.items():assert hashlib.sha256((source/name).read_bytes()).hexdigest()==digest,name
images=sorted(name for name in expected if name.endswith('.png'))
width=sum(Image.open(source/name).width+2 for name in images)+2;height=max(Image.open(source/name).height for name in images)+2
atlas=Image.new('RGBA',(width,height));frames={};x=1
for name in images:
 image=Image.open(source/name).convert('RGBA');atlas.paste(image,(x,1));frames[Path(name).stem.upper()]=[x,1,*image.size];x+=image.width+2
output=root/'public/assets/runtime/particles/fire-pea-parts.classic.webp';atlas.save(output,lossless=True,method=6,exact=True)
assert Image.open(output).convert('RGBA').tobytes()==atlas.tobytes()
tracks=[]
for track in ET.fromstring('<root>'+(source/'FirePea.reanim').read_text()+'</root>').findall('track'):
 state=dict(x=0,y=0,sx=1,sy=1,kx=0,ky=0,f=0,a=1,i='');poses=[]
 for frame in track.findall('t'):
  for child in frame:
   if child.tag in state:state[child.tag]=child.text.removeprefix('IMAGE_REANIM_')if child.tag=='i'else float(child.text)
  poses.append(list(state.values()))
 tracks.append({'name':track.findtext('name'),'poses':poses})
definition={'clips':{'fire':{'duration':1,'origin':[0,0],'scale':1,'healthTop':0,'nativeFrameTime':True,'groups':[{'length':25,'tracks':tracks}]}},'frames':frames}
metadata=root/'src/rendering/fire-parts.json';metadata.write_text(json.dumps(definition,separators=(',',':'))+'\n')
(root/'docs/fire-parts-source.json').write_text(json.dumps({'commit':'325b2229a7225d73870bb69322eefcda3a45bf8d','sources':expected,'atlas':{'file':str(output.relative_to(root)),'size':atlas.size,'bytes':output.stat().st_size,'decodedRGBA':width*height*4,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()},'metadata':{'bytes':metadata.stat().st_size,'sha256':hashlib.sha256(metadata.read_bytes()).hexdigest()},'tracks':len(tracks),'frames':25,'rules':['Original unscaled pixels; lossless packing without resampling','Five source track slots,including image switches and visibility','Source frameCount-1 interpolation; native attachment offsets/mirroring applied by Scene']},indent=2)+'\n')
print(output.name,atlas.size,output.stat().st_size,'encoded bytes;',width*height*4,'decoded RGBA;',metadata.stat().st_size,'metadata bytes')
