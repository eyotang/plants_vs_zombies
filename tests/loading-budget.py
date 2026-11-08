"""防止完整动画重新阻塞首屏，约束首屏素材体积和动画内存。"""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
initial=['index.html','styles.css','classic-assets.js','sound-engine.js','campaign-data.js','game.js','assets/classic/starter.webp','assets/classic/background.jpg','assets/classic/menu.webp','assets/classic/tray.webp','assets/classic/shovel.svg','assets/classic/sun-collector.svg']+[f'assets/classic/card-{key}.webp' for key in ['sun','pea','nut','ice','twin','cherry']]
size=sum((root/path).stat().st_size for path in initial)
assert size<350000,f'首屏素材超出350KB：{size}'
js=(root/'game.js').read_text();loader=js.split('async function loadAssets()')[1]
assert 'animation.webp' not in loader,'完整动画不能阻塞开玩'
assert 'setTimeout(loadAnimations,1200)' in loader
assert 'GameAudio.unlock()' in js and 'GameAudio.setScene(false,true)' in js
print(f'PASS: 首屏全部资源 {size:,} bytes，完整动画延后加载，后台停止音频')
