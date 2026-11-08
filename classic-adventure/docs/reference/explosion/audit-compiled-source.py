from pathlib import Path
import zlib,struct,re,json,argparse,hashlib
parser=argparse.ArgumentParser(description="Decode the pinned Powie particle cache using Definition.cpp layout")
parser.add_argument("definition_source",type=Path)
parser.add_argument("--compiled",type=Path,default=Path(__file__).with_name("Powie.xml.compiled"))
parser.add_argument("--output",type=Path,default=Path(__file__).with_name("compiled-tracks.json"))
args=parser.parse_args()
assert hashlib.sha256(args.definition_source.read_bytes()).hexdigest()=="83c9ecb229fe5529a502220372de6e9bc0326fdf7ea73eecba510878c2180acc"
raw=args.compiled.read_bytes();body=zlib.decompress(raw[8:]);assert len(body)==struct.unpack_from('<I',raw,4)[0]
source=args.definition_source.read_text(errors='replace');pos=4
schema={}
for key,array in [('emitter','gEmitterDefFields'),('field','gParticleFieldDefFields')]:
 block=source.split('DefField '+array+'[]')[1].split('};')[0]
 schema[key]=[(n,int(off,16),kind) for n,off,kind in re.findall(r'\{\s*"([^"]+)"\s*,\s*(0x[0-9A-Fa-f]+)\s*,\s*DefFieldType::(\w+)',block)]
def take(n):
 global pos
 b=body[pos:pos+n];assert len(b)==n;pos+=n;return b
def integer():return struct.unpack('<i',take(4))[0]
def string():return take(integer()).decode()
def read(kind,data):
 result={}
 for name,offset,t in schema[kind]:
  if t in ['DT_IMAGE','DT_STRING']:result[name]=string()
  elif t=='DT_TRACK_FLOAT':result[name]=[struct.unpack('<fffii',take(20)) for _ in range(integer())]
  elif t=='DT_ARRAY':
   count=struct.unpack_from('<i',data,offset+4)[0];size=integer();assert size==20
   fields=[take(size) for _ in range(count)];result[name]=[read('field',d) for d in fields]
  elif t in ['DT_INT','DT_ENUM','DT_FLAGS']:result[name]=struct.unpack_from('<i',data,offset)[0]
 return result
header=take(8);count=struct.unpack_from('<i',header,4)[0];size=integer();assert count==3 and size==356
emitterdata=[take(size) for _ in range(count)];emitters=[read('emitter',d) for d in emitterdata];assert pos==len(body),(pos,len(body))
args.output.write_text(json.dumps(emitters,indent=2)+'\n')
for e in emitters:print(json.dumps({k:v for k,v in e.items() if k in ['Name','ParticleScale','ParticleAlpha','SystemAlpha','Field','ParticleDuration','SpawnRate']}))
