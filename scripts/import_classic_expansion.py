"""按参考仓库导入扩展植物与动画，去除底色、保留原始裁切信息，分组生成渐进图集。"""
from pathlib import Path
import struct,zlib,json,re,subprocess,collections,argparse,shutil
from fix_sprite_mattes import write_png
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=Path('/tmp/pvz-reference/PythonPlantsVsZombies-master/resources/graphics'));SRC=parser.parse_args().source
CWEBP=shutil.which('cwebp');assert CWEBP,'Install cwebp before importing assets'
def read(path):
 data=path.read_bytes();pos=8;compressed=bytearray();palette=[];alpha=[]
 while pos<len(data):
  n=struct.unpack_from('>I',data,pos)[0];tag=data[pos+4:pos+8];chunk=data[pos+8:pos+8+n];pos+=n+12
  if tag==b'IHDR':w,h,depth,color,*_=struct.unpack('>IIBBBBB',chunk)
  if tag==b'PLTE':palette=[tuple(chunk[i:i+3]) for i in range(0,len(chunk),3)]
  if tag==b'tRNS':alpha=list(chunk)
  if tag==b'IDAT':compressed.extend(chunk)
 channels={0:1,2:3,3:1,4:2,6:4}[color];stride=(w*channels*depth+7)//8;bpp=max(1,(channels*depth+7)//8);raw=zlib.decompress(compressed);previous=bytearray(stride);out=bytearray(w*h*4)
 def paeth(a,b,c):
  p=a+b-c;d=[abs(p-a),abs(p-b),abs(p-c)];return (a,b,c)[d.index(min(d))]
 for y in range(h):
  start=y*(stride+1);f=raw[start];row=bytearray(raw[start+1:start+1+stride])
  for i in range(stride):
   a=row[i-bpp] if i>=bpp else 0;b=previous[i];c=previous[i-bpp] if i>=bpp else 0
   row[i]=(row[i]+(0 if f==0 else a if f==1 else b if f==2 else (a+b)//2 if f==3 else paeth(a,b,c)))&255
  for x in range(w):
   if color==3:
    index=(row[x*depth//8]>>(8-depth-(x*depth)%8))&((1<<depth)-1);rgba=(*palette[index],alpha[index] if index<len(alpha) else 255)
   elif color==6:rgba=row[x*4:x*4+4]
   elif color==2:rgba=(*row[x*3:x*3+3],255)
   else:raise ValueError((path,color))
   out[(y*w+x)*4:(y*w+x+1)*4]=bytes(rgba)
  previous=row
 return w,h,out
def remove_matte(w,h,pixels):
 # Only connected background pixels: keep white newspaper, teeth and eyes inside outlines.
 for white in [True,False]:
  def matches(x,y):
   p=(y*w+x)*4;c=pixels[p:p+4]
   return c[3]>0 and (min(c[:3])>=245 if white else max(c[:3])==0)
  if not white and not all(matches(x,y) for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]):continue
  queue=collections.deque([(x,0) for x in range(w)]+[(x,h-1) for x in range(w)]+[(0,y) for y in range(h)]+[(w-1,y) for y in range(h)])
  while queue:
   x,y=queue.popleft()
   if not matches(x,y):continue
   p=(y*w+x)*4;pixels[p:p+4]=b'\0\0\0\0'
   for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if 0<=nx<w and 0<=ny<h:queue.append((nx,ny))
 return pixels
sets={
'garden':{'three':'Plants/Threepeater','chomper':'Plants/Chomper/Chomper','chomperAttack':'Plants/Chomper/ChomperAttack','chomperDigest':'Plants/Chomper/ChomperDigest','mine':'Plants/PotatoMine/PotatoMine','mineInit':'Plants/PotatoMine/PotatoMineInit','mineExplode':'Plants/PotatoMine/PotatoMineExplode','squash':'Plants/Squash/Squash','squashAim':'Plants/Squash/SquashAim','squashAttack':'Plants/Squash/SquashAttack','spike':'Plants/Spikeweed/Spikeweed','jalapeno':'Plants/Jalapeno/Jalapeno','flame':'Plants/Jalapeno/JalapenoExplode','flag':'Zombies/FlagZombie/FlagZombie','flagAttack':'Zombies/FlagZombie/FlagZombieAttack'},
'night':{'puff':'Plants/PuffShroom/PuffShroom','puffSleep':'Plants/PuffShroom/PuffShroomSleep','scaredy':'Plants/ScaredyShroom/ScaredyShroom','scaredySleep':'Plants/ScaredyShroom/ScaredyShroomSleep','scaredyCry':'Plants/ScaredyShroom/ScaredyShroomCry','sunshroom':'Plants/SunShroom/SunShroom','sunshroomBig':'Plants/SunShroom/SunShroomBig','sunshroomSleep':'Plants/SunShroom/SunShroomSleep','iceShroom':'Plants/IceShroom/IceShroom','iceShroomSleep':'Plants/IceShroom/IceShroomSleep','iceTrap':'Plants/IceShroom/IceShroomTrap','hypno':'Plants/HypnoShroom/HypnoShroom','hypnoSleep':'Plants/HypnoShroom/HypnoShroomSleep','spore':'Bullets/BulletMushRoom'},
'bowling':{'rollnut':'Plants/WallNut/WallNutBowling','rednut':'Plants/WallNut/RedWallNutBowling'},
'combat':{'headless':'Zombies/NormalZombie/ZombieLostHead','headlessAttack':'Zombies/NormalZombie/ZombieLostHeadAttack','flagHeadless':'Zombies/FlagZombie/FlagZombieLostHead','flagHeadlessAttack':'Zombies/FlagZombie/FlagZombieLostHeadAttack','paperHeadless':'Zombies/NewspaperZombie/NewspaperZombieLostHead','paperHeadlessAttack':'Zombies/NewspaperZombie/NewspaperZombieLostHeadAttack','head':'Zombies/NormalZombie/ZombieHead','fall':'Zombies/NormalZombie/ZombieDie','paperFall':'Zombies/NewspaperZombie/NewspaperZombieDie','charred':'Zombies/NormalZombie/BoomDie'}
}
crops={'chomper':(0,0,100,114),'puff':(0,28,35,38),'puffSleep':(1,0,39,65),'mine':(0,0,75,55),'spike':(3,0,80,35),'squash':(10,140,80,86),'squashAim':(10,140,80,86)}
def items_for(group):
 items=[];rates={}
 for key,folder in sets[group].items():
  files=sorted((SRC/folder).glob('*.png'),key=lambda p:int(p.stem.rsplit('_',1)[-1]));assert files,(key,folder)
  every=2 if len(files)>16 else 1;files=files[::every];rates[key]=(1000/(100 if key.endswith('Attack') else 150) if key.startswith('flag') else 4 if key.startswith('chomper') else 5 if group=='night' else 10)/every
  if group=='combat':rates[key]=(5 if key in ['fall','paperFall','charred'] else 10 if key.endswith('Attack') else 1000/150)/every
  for index,path in enumerate(files):
   w,h,pixels=read(path);pixels=remove_matte(w,h,pixels)
   if key in crops:
    cx,cy,cw,ch=crops[key];assert cx+cw<=w and cy+ch<=h,(key,w,h);data=bytearray(cw*ch*4)
    for y in range(ch):data[y*cw*4:(y+1)*cw*4]=pixels[((cy+y)*w+cx)*4:((cy+y)*w+cx+cw)*4]
    w,h,pixels=cw,ch,data
   xs=[];ys=[]
   for y in range(h):
    for x in range(w):
     if pixels[(y*w+x)*4+3]:xs.append(x);ys.append(y)
   left,right=(min(xs),max(xs)+1) if xs else (0,1);top,bottom=(min(ys),max(ys)+1) if ys else (0,1);sw,sh=right-left,bottom-top;data=bytearray(sw*sh*4)
   for y in range(sh):data[y*sw*4:(y+1)*sw*4]=pixels[((top+y)*w+left)*4:((top+y)*w+right)*4]
   items.append(dict(key=key,index=index,width=w,height=h,ox=left,oy=top,sw=sw,sh=sh,data=data))
 return items,rates
def pack(items,target):
 width=1024;x=y=row=0;placed=[];result={}
 for i in sorted(items,key=lambda i:-i['sh']):
  if x+i['sw']+4>width:x=0;y+=row;row=0
  assert i['sw']+4<=width,(i['key'],i['sw'])
  placed.append((i,x+2,y+2));x+=i['sw']+4;row=max(row,i['sh']+4)
 height=y+row;pixels=bytearray(width*height*4)
 for i,x,y in placed:
  for line in range(i['sh']):pixels[((y+line)*width+x)*4:((y+line)*width+x+i['sw'])*4]=i['data'][line*i['sw']*4:(line+1)*i['sw']*4]
  result.setdefault(i['key'],[]).append((i['index'],dict(sx=x,sy=y,sw=i['sw'],sh=i['sh'],ox=i['ox'],oy=i['oy'],width=i['width'],height=i['height'])))
 write_png(target,width,height,pixels)
 return {key:[f for _,f in sorted(group)] for key,group in result.items()},[width,height]
output={}
for group in sets:
 items,rates=items_for(group);full,size=pack(items,Path('/tmp')/f'{group}.png');starter,small=pack([i for i in items if i['index']==0],Path('/tmp')/f'{group}-starter.png')
 for name,lossless in [(group,True),(group+'-starter',False)]:
  args=[CWEBP,'-quiet']+(['-lossless','-z','9'] if lossless else ['-q','88','-alpha_q','100','-m','6'])+[f'/tmp/{name}.png','-o',str(ROOT/f'assets/classic/{name}.webp')];subprocess.run(args,check=True)
 output[group]={'frames':full,'starter':starter,'fps':rates};print(group,size,small,flush=True)
for key,name in {'three':'threepeashooter','chomper':'chomper','puff':'puffshroom','mine':'potatomine','squash':'squash','spike':'spikeweed','jalapeno':'jalapeno','scaredy':'scaredyshroom','sunshroom':'sunshroom','iceShroom':'iceshroom','hypno':'hypnoshroom','rednut':'redwallnut_move'}.items():
 subprocess.run([CWEBP,'-quiet','-q','88','-m','6',str(SRC/f'Cards/card_{name}.png'),'-o',str(ROOT/f'assets/classic/card-{key}.webp')],check=True)
for i in [1,4]:
 import shutil
 shutil.copyfile(SRC/f'Items/Background/Background_{i}.jpg',ROOT/f'assets/classic/background-{i}.jpg')
(ROOT/'expansion-assets.js').write_text('const EXPANSION_ASSETS='+json.dumps(output,separators=(',',':'))+';\n')
# Keep original scripted timing and lanes from the five reference levels.
name_map={'Zombie':'basic','FlagZombie':'flag','ConeheadZombie':'cone','BucketheadZombie':'bucket','NewspaperZombie':'paper'}
titles=['前院初战','路锥来袭','夜幕降临','传送带突袭','坚果保龄球'];levels=[]
for number in range(1,6):
 raw=json.loads((SRC.parents[1]/f'source/data/map/level_{number}.json').read_text())
 levels.append({'number':number,'name':titles[number-1],'background':raw['background_type'],'sun':raw.get('init_sun_value',0),'kind':{0:'normal',1:'conveyor',2:'bowling'}[raw.get('choosebar_type',0)],'enemies':[{'time':z['time']/1000,'r':z['map_y'],'type':name_map[z['name']]} for z in raw['zombie_list']]})
(ROOT/'campaign-data.js').write_text('const CAMPAIGN_LEVELS='+json.dumps(levels,separators=(',',':'),ensure_ascii=False)+';\n')
