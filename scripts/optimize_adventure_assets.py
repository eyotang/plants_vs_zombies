"""Restore native-size scenery while preserving its logical 1400×600 camera."""
from pathlib import Path
import subprocess,re,shutil,tempfile
ROOT=Path(__file__).resolve().parents[1]
base=ROOT/'classic-adventure/public/assets/runtime'
files=['yard.webp','lawn.webp','original/night.webp','original/pool.webp','original/fog.webp','original/roof.webp','boss/background.webp']
before=after=0
for name in files:
 path=base/name;info=subprocess.check_output([shutil.which('webpinfo'),str(path)],text=True)
 w,h=map(int,[re.search(r'Width: (\d+)',info).group(1),re.search(r'Height: (\d+)',info).group(1)])
 assert (w,h) in [(2800,1200),(1400,600)],(name,w,h)
 before+=path.stat().st_size
 if w==2800:
  with tempfile.TemporaryDirectory(prefix='pvz-scenery-') as temp:
   target=Path(temp)/path.name
   subprocess.run([shutil.which('cwebp'),'-quiet','-resize','1400','600','-q','92','-m','6',str(path),'-o',str(target)],check=True)
   shutil.copy2(target,path)
 after+=path.stat().st_size
print({'sceneryBeforeBytes':before,'sceneryAfterBytes':after,'rgbaTextureBytesSavedPerDayBoard':(2800*1200-1400*600)*4*2})
