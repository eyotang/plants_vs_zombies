"""从本地透明 PNG 图集去除空白，生成等价的紧凑图集与首帧图集。"""
import json,re,sys
from pathlib import Path
from fix_sprite_mattes import read_png,write_png
ROOT=Path(__file__).resolve().parents[1]
w,h,pixels=read_png(ROOT/'assets/classic/atlas.png')
text=(ROOT/'classic-assets.js').read_text();frames=json.loads(re.search(r'const ATLAS_FRAMES=(.*?);',text).group(1))
items=[]
for key,group in frames.items():
 if key.startswith('card-'):continue
 for index,f in enumerate(group):
  sw,sh=f.get('sw',f['width']),f.get('sh',f['height']);xs=[];ys=[]
  for y in range(sh):
   for x in range(sw):
    if pixels[((f['sy']+y)*w+f['sx']+x)*4+3]:xs.append(x);ys.append(y)
  x0,x1=(min(xs),max(xs)+1) if xs else (0,1);y0,y1=(min(ys),max(ys)+1) if ys else (0,1)
  tw,th=x1-x0,y1-y0;data=bytearray(tw*th*4)
  for y in range(th):
   p=((f['sy']+y0+y)*w+f['sx']+x0)*4;data[y*tw*4:(y+1)*tw*4]=pixels[p:p+tw*4]
  items.append(dict(key=key,index=index,width=f['width'],height=f['height'],ox=f.get('ox',0)+x0,oy=f.get('oy',0)+y0,sw=tw,sh=th,data=data))
def pack(selected,path):
 width=1024;x=y=row=0;placed=[];result={}
 for item in sorted(selected,key=lambda i:-i['sh']):
  if x+item['sw']+4>width:x=0;y+=row;row=0
  placed.append((item,x+2,y+2));x+=item['sw']+4;row=max(row,item['sh']+4)
 height=y+row;canvas=bytearray(width*height*4)
 for item,x,y in placed:
  for line in range(item['sh']):
   start=((y+line)*width+x)*4;a=line*item['sw']*4;canvas[start:start+item['sw']*4]=item['data'][a:a+item['sw']*4]
  result.setdefault(item['key'],[]).append((item['index'],dict(sx=x,sy=y,sw=item['sw'],sh=item['sh'],ox=item['ox'],oy=item['oy'],width=item['width'],height=item['height'])))
 write_png(path,width,height,canvas)
 return {key:[f for _,f in sorted(values)] for key,values in result.items()},[width,height]
full,size=pack(items,ROOT/'assets/classic/atlas.png');starter,small=pack([i for i in items if i['index']==0],Path('/tmp/pvz-starter.png'))
(ROOT/'classic-assets.js').write_text('const ATLAS_FRAMES='+json.dumps(full,separators=(',',':'))+';\nconst STARTER_FRAMES='+json.dumps(starter,separators=(',',':'))+';\n')
print({'old':[w,h],'packed':size,'starter':small})
