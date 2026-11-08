"""Import pinned GraveBuster particle sheets and a Safari-compatible sound.
Usage: python3 tools/import-gravebuster-feedback.py SOURCE_DIRECTORY FFMPEG
SOURCE_DIRECTORY contains the unchanged upstream PNG/XML/OGG files.
"""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
expected = {
    'RockSmall.png': '0b24b298edcc5676d6fbbd3148cde87dd14611404f9fb58219d94941ee6c7d16',
    'dirtsmall.png': '0103a7e07c2735e23c462245454a6b850e1527ab14554632c7a92006935a4572',
    'GraveBuster.xml': '3372e80de6d55d56af679b4258547946d1a511e1f2c05736e2caabd857c419a4',
    'GraveBusterDie.xml': 'c09acd8aa04d0f879bcb8fec721d0506d6501dfa1c146fc2582dd24fac8cef5c',
    'gravebusterchomp.ogg': 'a2ace857d92f8e07332f40ff8bbe78bee6c99f259c4c3f5a292c834e79f450c3',
}
for name, digest in expected.items():
    assert hashlib.sha256((source / name).read_bytes()).hexdigest() == digest, name
files = []
for name, dest in [('RockSmall.png', 'assets/runtime/particles/grave-rock.png'), ('dirtsmall.png', 'assets/runtime/particles/grave-dirt.png')]:
    target = root / 'public' / dest
    shutil.copyfile(source / name, target)
    files.append(target)
sound = root / 'public/assets/original/gravebuster-chomp.mp3'
subprocess.run([sys.argv[2], '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source / 'gravebusterchomp.ogg'), '-map_metadata', '-1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k', str(sound)], check=True)
files.append(sound)
report = {'commit': '325b2229a7225d73870bb69322eefcda3a45bf8d', 'sources': expected,
          'conversion': 'PNG byte copies; Vorbis to44100Hz mono96kbit/s MP3, without pitch/speed changes',
          'files': [{'file': str(p.relative_to(root / 'public')), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
(root / 'docs/gravebuster-feedback-assets.json').write_text(json.dumps(report, indent=2) + '\n')
print(sum(p.stat().st_size for p in files), 'bytes in3 files')
