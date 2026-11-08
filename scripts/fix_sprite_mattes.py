"""检查/修复图集中的白色背景。仅处理从帧边缘连通的白底，保留报纸和眼白。"""
import struct,zlib,json,sys,re
from pathlib import Path
from collections import deque
ROOT=Path(__file__).resolve().parents[1]
def read_png(path):
 data=path.read_bytes();pos=8;compressed=bytearray()
 while pos<len(data):
  n=struct.unpack_from('>I',data,pos)[0];tag=data[pos+4:pos+8];chunk=data[pos+8:pos+8+n];pos+=n+12
  if tag==b'IHDR':w,h,depth,color,*_=struct.unpack('>IIBBBBB',chunk);assert (depth,color)==(8,6),'Expected RGBA8 atlas'
  if tag==b'IDAT':compressed.extend(chunk)
 raw=zlib.decompress(compressed);stride=w*4;pixels=bytearray(w*h*4);previous=bytearray(stride)
 def paeth(a,b,c):
  p=a+b-c;da,db,dc=abs(p-a),abs(p-b),abs(p-c)
  return a if da<=db and da<=dc else b if db<=dc else c
 for y in range(h):
  start=y*(stride+1);f=raw[start];row=bytearray(raw[start+1:start+1+stride])
  for x in range(stride):
   a=row[x-4] if x>=4 else 0;b=previous[x];c=previous[x-4] if x>=4 else 0
   row[x]=(row[x]+(0 if f==0 else a if f==1 else b if f==2 else (a+b)//2 if f==3 else paeth(a,b,c)))&255
  pixels[y*stride:(y+1)*stride]=row;previous=row
 return w,h,pixels
def write_png(path,w,h,pixels):
 def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
 raw=b''.join(b'\0'+pixels[y*w*4:(y+1)*w*4] for y in range(h))
 path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
def main():
 source=(ROOT/'classic-assets.js').read_text();frames=json.loads(re.search(r'const ATLAS_FRAMES=(.*?);',source).group(1))
 path=ROOT/'assets/classic/atlas.png';w,h,pixels=read_png(path);fix='--fix' in sys.argv;failures=[];count=0
 for key,items in frames.items():
  for i,f in enumerate(items):
   fw,fh=f.get('sw',f['width']),f.get('sh',f['height']);sx,sy=f['sx'],f['sy'];seen=set();queue=deque()
   def white(x,y):
    p=((sy+y)*w+sx+x)*4
    return pixels[p+3]>0 and min(pixels[p:p+3])>=245
   for x in range(fw):
    if white(x,0):queue.append((x,0))
    if white(x,fh-1):queue.append((x,fh-1))
   for y in range(fh):
    if white(0,y):queue.append((0,y))
    if white(fw-1,y):queue.append((fw-1,y))
   while queue:
    x,y=queue.popleft()
    if (x,y) in seen or not white(x,y):continue
    seen.add((x,y))
    for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
     if 0<=nx<fw and 0<=ny<fh and (nx,ny) not in seen:queue.append((nx,ny))
   if seen:
    failures.append(f'{key}[{i}]: {len(seen)} exterior white pixels');count+=len(seen)
    if fix:
     for x,y in seen:
      p=((sy+y)*w+sx+x)*4;pixels[p:p+4]=b'\0\0\0\0'
 if fix:write_png(path,w,h,pixels);print(f'Fixed {len(failures)} frames, {count} background pixels')
 elif failures:print('\n'.join(failures));raise SystemExit(1)
 else:print('PASS: all animation frames are free of exterior white mattes')
if __name__=='__main__':main()
