#!/usr/bin/env python3
"""Build without Gradle. Requires JDK 17, SDK 35, NDK r27d, and pinned runtime source."""
import argparse,hashlib,json,os,shutil,subprocess,tarfile,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--tools',type=Path,required=True);p.add_argument('--abi',choices=['arm64-v8a','x86_64'],default='arm64-v8a');a=p.parse_args()
base=Path(__file__).resolve().parents[1];repo=base.parent;tools=a.tools.resolve();b=base/'build'/a.abi
b.mkdir(parents=True,exist_ok=True)
jdk=tools/'jdk-17';sdk=tools/'sdk';bt=sdk/'build-tools/35.0.0';ndk=tools/'android-ndk-r27d/toolchains/llvm/prebuilt/linux-x86_64'
env=dict(os.environ,JAVA_HOME=str(jdk),PATH=str(jdk/'bin')+os.pathsep+os.environ['PATH'])
def run(cmd,cwd=repo):subprocess.run([str(x) for x in cmd],cwd=cwd,env=env,check=True)
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
arch='arm64' if a.abi=='arm64-v8a' else 'x86_64'
runtime_repo=tools/'zalith';rtassets=runtime_repo/'ZalithLauncher/src/main/assets/runtimes/jre-17'
runtime_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=runtime_repo,text=True).strip()
node_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
stage=b/'stage';shutil.rmtree(stage,ignore_errors=True);stage.mkdir();jre=stage/'jre';jre.mkdir()
for f in [rtassets/'universal.tar.xz',rtassets/f'bin-{arch}.tar.xz']:
 with tarfile.open(f) as tf:tf.extractall(jre,filter='data')
classes=b/'node-classes';shutil.rmtree(classes,ignore_errors=True);classes.mkdir()
sources=sorted((repo/'src/java/nxt').rglob('*.java'))+sorted((base/'node/src').rglob('*.java'))
sourcefile=b/'sources.txt';sourcefile.write_text('\n'.join(str(x) for x in sources))
run([jdk/'bin/javac','--release','17','-encoding','UTF-8','-cp',str(repo/'lib/*'),'-d',classes,'@'+str(sourcefile)])
(stage/'lib').mkdir();run([jdk/'bin/jar','--create','--file',stage/'lib/arkovia-node.jar','-C',classes,'.'])
for f in (repo/'lib').glob('*.jar'):shutil.copy2(f,stage/'lib'/f.name)
(stage/'conf/data').mkdir(parents=True)
for name in ['nxt-default.properties','logging-default.properties']:
 f=repo/'conf'/name
 if f.exists():shutil.copy2(f,stage/'conf'/name)
for f in (repo/'conf/data').glob('*.json'):shutil.copy2(f,stage/'conf/data'/f.name)
# Avoid unbounded duplicate disk logs; service captures console output with a cap.
(stage/'conf/logging.properties').write_text('handlers=java.util.logging.ConsoleHandler\n.level=INFO\njava.util.logging.ConsoleHandler.level=INFO\njava.util.logging.ConsoleHandler.formatter=java.util.logging.SimpleFormatter\n')
(stage/'licenses').mkdir()
for name in ['LICENSE.txt','3RD-PARTY-LICENSES.txt','AUTHORS.txt','JPL-NRS.pdf']:
 if (repo/name).exists():shutil.copy2(repo/name,stage/'licenses'/name)
shutil.copy2(base/'LAUNCHER-LICENSE.txt',stage/'licenses/LAUNCHER-LICENSE.txt')
# Native code is installed by Android in its executable native-library directory.
# Runtime paths are symlinked there at startup; no downloaded executable code.
native=b/'native';shutil.rmtree(native,ignore_errors=True);native.mkdir();links=[]
for f in sorted(jre.rglob('*.so')):
 target=native/f.name
 if target.exists() and sha(target)!=sha(f):raise RuntimeError('Conflicting native library: '+f.name)
 shutil.copy2(f,target);links.append({'path':f.relative_to(stage).as_posix(),'library':f.name});f.unlink()
# Unused command-line tools are not needed by the invocation API launcher.
shutil.rmtree(jre/'bin',ignore_errors=True)
for name in ['lib/jexec','lib/jspawnhelper']:(jre/name).unlink(missing_ok=True)
clang=ndk/'bin'/('aarch64-linux-android28-clang' if arch=='arm64' else 'x86_64-linux-android28-clang')
run([clang,'-O2','-Wall','-Wextra','-Werror','-fPIE','-pie','-Wl,-z,max-page-size=16384','-I'+str(jdk/'include'),'-I'+str(jdk/'include/linux'),base/'native/launcher.c','-ldl','-o',native/'libarkovia_exec.so'])
assets=b/'assets';assets.mkdir(exist_ok=True)
with zipfile.ZipFile(assets/'payload.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(stage.rglob('*')):
  if f.is_file():z.write(f,f.relative_to(stage))
(assets/'payload.sha256').write_text(sha(assets/'payload.zip')+'\n')
(assets/'runtime-libraries.json').write_text(json.dumps(links))
info=f'''Arkovia Node 0.1.0 — experimental standalone Android full node
Target: Android 15; ABI: {a.abi}; minimum API 28.
Node source commit: {node_commit}
Source: https://github.com/mycreationhaven/Arkovia-Blockchain
Runtime: Android OpenJDK 17.0.10 from ZalithLauncher2 commit {runtime_commit}.
Runtime binary source and license files: https://github.com/ZalithLauncher/ZalithLauncher2/tree/{runtime_commit}/ZalithLauncher/src/main/assets/runtimes/jre-17
Upstream node: Jelurida Public License; dependencies and OpenJDK retain their licenses. License files are included in the app payload and source package.
New Android UI and native launcher: MIT.
No wallet secrets, forging or remote control API. No advertising or analytics.
Runtime is an older Android port: this is a compatibility test, not a production security release. Requires 4 KB memory pages. Device startup and network synchronization must be verified before relying on this node.
Uninstalling deletes the local blockchain. Android may stop the process under memory pressure or power restrictions.
'''
(assets/'BUILD-INFO.txt').write_text(info)
(b/'provenance.json').write_text(json.dumps({'node_commit':node_commit,'runtime_commit':runtime_commit,'runtime_arch_sha256':sha(rtassets/f'bin-{arch}.tar.xz'),'runtime_universal_sha256':sha(rtassets/'universal.tar.xz'),'payload_sha256':sha(assets/'payload.zip')},indent=2))
reszip=b/'resources.zip';generated=b/'generated';generated.mkdir(exist_ok=True)
run([bt/'aapt2','compile','--dir',base/'res','-o',reszip])
unsigned=b/'unsigned.apk'
run([bt/'aapt2','link','-o',unsigned,'-I',sdk/'platforms/android-35/android.jar','--manifest',base/'AndroidManifest.xml','--java',generated,'-A',assets,reszip])
appclasses=b/'app-classes';shutil.rmtree(appclasses,ignore_errors=True);appclasses.mkdir()
appsources=sorted((base/'app/src').rglob('*.java'))+sorted(generated.rglob('*.java'))
run([jdk/'bin/javac','-source','8','-target','8','-encoding','UTF-8','-bootclasspath',str(sdk/'platforms/android-35/android.jar')+os.pathsep+str(bt/'core-lambda-stubs.jar'),'-d',appclasses,*appsources])
appjar=b/'app.jar';run([jdk/'bin/jar','--create','--file',appjar,'-C',appclasses,'.'])
dex=b/'dex';dex.mkdir(exist_ok=True)
run([bt/'d8','--min-api','28','--lib',sdk/'platforms/android-35/android.jar','--output',dex,appjar])
with zipfile.ZipFile(unsigned,'a',zipfile.ZIP_DEFLATED) as z:
 for f in dex.glob('*.dex'):z.write(f,f.name)
 for f in native.glob('*.so'):z.write(f,'lib/'+a.abi+'/'+f.name)
aligned=b/'aligned.apk';run([bt/'zipalign','-f','-p','4',unsigned,aligned])
key=base/'build/test-signing.keystore'
if not key.exists():run([jdk/'bin/keytool','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','arkovia-test','-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=Arkovia Node Test Build'])
apk=b/f'Arkovia-Node-0.1.0-test-{a.abi}.apk'
run([bt/'apksigner','sign','--ks',key,'--ks-key-alias','arkovia-test','--ks-pass','pass:android','--key-pass','pass:android','--out',apk,aligned])
run([bt/'apksigner','verify','--verbose',apk]);run([bt/'zipalign','-c','4',apk])
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None, 'APK CRC validation failed'
print('APK:',apk);print('BYTES:',apk.stat().st_size);print('SHA256:',sha(apk))
