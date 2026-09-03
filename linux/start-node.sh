#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
config=${1:-/etc/arkovia/nxt.properties}
[[ -r "$config" ]] || { echo "Missing readable config: $config" >&2; exit 1; }
if grep -q 'REPLACE_WITH_' "$config"; then
  echo 'Configure an existing Arkovia seed peer and admin password first.' >&2
  exit 1
fi
[[ -f "$root/arkovia.jar" ]] || { echo 'Run linux/build.sh and use the built package.' >&2; exit 1; }
java --list-modules | grep -q '^java.base@17\.' || { echo 'OpenJDK 17 is required.' >&2; exit 1; }
mkdir -p logs
# Deliberately no shell evaluation of operator-supplied JVM arguments.
heap=${ARKOVIA_HEAP_MB:-2048}
[[ "$heap" =~ ^[0-9]+$ ]] || { echo 'ARKOVIA_HEAP_MB must be a positive integer.' >&2; exit 1; }
((heap >= 512)) || { echo 'Use at least 512 MiB heap; 2048 MiB is recommended.' >&2; exit 1; }
exec java -Xms256m "-Xmx${heap}m" -Djava.awt.headless=true \
  -Dnxt.runtime.dirProvider=nxt.env.DefaultDirProvider "-Dnxt.properties=$config" \
  -cp "$root/arkovia.jar:$root/lib/*:$root/conf" nxt.Nxt
