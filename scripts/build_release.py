"""Build the full adventure plus the original five-stage reference challenge."""
from pathlib import Path
import argparse,shutil,subprocess,tempfile,zipfile,json
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--skip-build',action='store_true');parser.add_argument('--previous-release',type=Path,default=ROOT/'dist');args=parser.parse_args()
if not args.skip_build:subprocess.run(['npm','run','build'],cwd=ROOT/'classic-adventure',check=True)
with tempfile.TemporaryDirectory(prefix='pvz-release-') as temp:
 stage=Path(temp)/'dist';shutil.copytree(ROOT/'classic-adventure/dist',stage)
 current=sorted(p.relative_to(stage).as_posix() for p in (stage/'assets').iterdir() if p.suffix in ['.js','.css'])
 current_workers=sorted(p.name for p in stage.glob('sw-*.js'))
 previous=args.previous_release
 manifest=previous/'asset-generations.json'
 old_assets=json.loads(manifest.read_text())['currentAssets'] if manifest.exists() else sorted(p.relative_to(previous).as_posix() for p in (previous/'assets').glob('*') if p.suffix in ['.js','.css'])
 retained=[]
 for name in old_assets:
  relative=Path(name)
  if len(relative.parts)!=2 or relative.parts[0]!='assets' or relative.suffix not in ['.js','.css']:continue
  if (previous/relative).is_file() and not (stage/relative).exists():shutil.copy2(previous/relative,stage/relative);retained.append(name)
 old_workers=json.loads(manifest.read_text()).get('currentWorkers',[]) if manifest.exists() else []
 retained_workers=[]
 for name in old_workers:
  if Path(name).name!=name or not name.startswith('sw-') or not name.endswith('.js'):continue
  if (previous/name).is_file() and not (stage/name).exists():shutil.copy2(previous/name,stage/name);retained_workers.append(name)
 (stage/'asset-generations.json').write_text(json.dumps({'currentAssets':current,'previousAssets':retained,'currentWorkers':current_workers,'previousWorkers':retained_workers},indent=2)+'\n')
 legacy=stage/'reference';legacy.mkdir()
 for name in ['index.html','game.js','styles.css','classic-assets.js','campaign-data.js','expansion-assets.js','sound-engine.js']:
  shutil.copy2(ROOT/name,legacy/name)
 target=legacy/'assets/classic';target.mkdir(parents=True)
 for p in (ROOT/'assets/classic').iterdir():
  if p.suffix.lower() in ['.webp','.svg','.jpg']:shutil.copy2(p,target/p.name)
 for name in ['THIRD_PARTY_NOTICES.md','README.md']:shutil.copy2(ROOT/name,stage/name)
 shutil.copy2(ROOT/'classic-adventure/UPSTREAM.md',stage/'ADVENTURE_REFERENCE.md')
 # All published files are derived output; the source files remain untouched.
 old=ROOT/'dist';backup=ROOT/'output/previous-dist'
 if backup.exists():shutil.rmtree(backup)
 if old.exists():old.rename(backup)
 shutil.copytree(stage,old)
 archive=ROOT/'output/植物大战僵尸-本地经典版.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for p in old.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(old))
  z.write(ROOT/'本地启动.command','本地启动.command')
 print('Release bytes:',sum(p.stat().st_size for p in old.rglob('*') if p.is_file()))
