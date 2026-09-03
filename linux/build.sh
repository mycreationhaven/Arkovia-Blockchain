#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
root=$PWD
out="$root/dist/arkovia-linux-full-node"
command -v java >/dev/null || { echo 'Install OpenJDK 17 JDK first.' >&2; exit 1; }
java --list-modules | grep -q '^jdk.compiler@17\.' || { echo 'Build requires OpenJDK 17 JDK.' >&2; exit 1; }
mkdir -p "$root/dist"
stage=$(mktemp -d "$root/dist/build.XXXXXX")
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/classes"
find src/java/nxt -name '*.java' -print | LC_ALL=C sort > "$stage/sources.txt"
build_cp=''
for dependency in "$root"/lib/*.jar; do build_cp+="$dependency:"; done
java -m jdk.compiler/com.sun.tools.javac.Main --release 17 -encoding UTF-8 \
  -classpath "$build_cp" -d "$stage/classes" @"$stage/sources.txt"
java -m jdk.jartool/sun.tools.jar.Main --create --file "$stage/arkovia.jar" -C "$stage/classes" .
rm -rf "$out"
mkdir -p "$out/conf" "$out/linux" "$out/source"
cp "$stage/arkovia.jar" "$out/"
cp -a lib html "$out/"
cp conf/nxt-default.properties conf/logging-default.properties "$out/conf/"
cp -a conf/data "$out/conf/"
cp linux/*.sh linux/*.py linux/*.service linux/*.example linux/*.md "$out/linux/"
cp LICENSE.txt 3RD-PARTY-LICENSES.txt AUTHORS.txt JPL-NRS.pdf "$out/"
# Include the corresponding core source and original notices with the binary.
cp -a src "$out/source/"
git rev-parse HEAD > "$out/SOURCE_COMMIT"
chmod +x "$out/linux/"*.sh
(cd "$out" && find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > SHA256SUMS)
tar -C "$root/dist" -czf "$root/dist/arkovia-linux-full-node.tar.gz" arkovia-linux-full-node
(cd "$root/dist" && sha256sum arkovia-linux-full-node.tar.gz > arkovia-linux-full-node.tar.gz.sha256)
echo "Built $root/dist/arkovia-linux-full-node.tar.gz"
