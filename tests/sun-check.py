"""阳光表现回归：顶部只用卡槽图标，抽帧动画保持原始周期。"""
from pathlib import Path
import re,json
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text();js=(root/'game.js').read_text()
box=re.search(r'<div class="sunbox">(.*?)</div>',html).group(1)
assert '<img' not in box, '顶部卡槽已有太阳，不能叠加第二张太阳图片'
assert "const size=s.value<25?46:70" in js and "image('sunDrop',s.x-size/2,s.y-size/2,size,size,s.age*.5)" in js, '阳光抽帧后要减半帧率以保留 2.2 秒周期'
assert 'Math.sin(s.age*12)' not in js, '阳光临过期时渐隐，不进行频繁闪烁'
print('PASS: 单个顶部图标、2.2 秒阳光周期、70 像素比例、渐隐消失')
