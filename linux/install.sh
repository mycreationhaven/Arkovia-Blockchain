#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
if [[ ${1:-} == --help ]]; then
  echo 'Usage: sudo bash linux/install.sh EXISTING_PEER:47874 [THIS_NODE_PUBLIC_HOST:47874]'
  echo 'First install only. Does not start the node or change firewall rules.'
  exit 0
fi
[[ $EUID == 0 ]] || { echo 'Run installer with sudo.' >&2; exit 1; }
[[ $# -ge 1 && $# -le 2 ]] || { echo 'Supply an existing Arkovia peer host:port.' >&2; exit 1; }
# Strict host/IPv4 syntax prevents configuration injection. IPv6 can be set manually.
for endpoint in "$@"; do
  [[ "$endpoint" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*:[0-9]{1,5}$ ]] || { echo 'Expected host:port (DNS or IPv4).' >&2; exit 1; }
  port=${endpoint##*:}
  ((10#$port >= 1 && 10#$port <= 65535)) || { echo 'Invalid port.' >&2; exit 1; }
done
for dependency in java systemctl python3 useradd; do
  command -v "$dependency" >/dev/null || { echo "Missing $dependency; see README.md." >&2; exit 1; }
done
java --list-modules | grep -q '^java.base@17\.' || { echo 'Install OpenJDK 17.' >&2; exit 1; }
[[ -d /run/systemd/system ]] || { echo 'systemd must be running.' >&2; exit 1; }
for existing in /opt/arkovia /etc/arkovia /var/lib/arkovia /etc/systemd/system/arkovia.service; do
  [[ ! -e "$existing" ]] || { echo "Refusing to overwrite $existing. See upgrade instructions." >&2; exit 1; }
done
if getent passwd arkovia >/dev/null || getent group arkovia >/dev/null; then
  echo 'Account or group arkovia already exists; review it before a manual installation.' >&2
  exit 1
fi
[[ -f "$root/arkovia.jar" && -f "$root/SHA256SUMS" ]] || { echo 'Use the built release package.' >&2; exit 1; }
(cd "$root" && sha256sum --check --quiet SHA256SUMS)
useradd --system --user-group --home-dir /var/lib/arkovia --shell /usr/sbin/nologin arkovia
install -d -m 0755 /opt/arkovia
cp -a "$root/." /opt/arkovia/
chown -R root:root /opt/arkovia
chmod -R go-w /opt/arkovia
install -d -m 0750 -o root -g arkovia /etc/arkovia
install -d -m 0700 -o arkovia -g arkovia /var/lib/arkovia
python3 - "$1" "${2:-}" <<'PY'
from pathlib import Path
import secrets, sys
text = Path('/opt/arkovia/linux/nxt.properties.example').read_text()
text = text.replace('REPLACE_WITH_EXISTING_ARKOVIA_PEER:47874', sys.argv[1])
text = text.replace('REPLACE_WITH_RANDOM_ADMIN_PASSWORD', secrets.token_hex(32))
text = text.replace('nxt.myAddress=\n', 'nxt.myAddress=' + sys.argv[2] + '\n')
path = Path('/etc/arkovia/nxt.properties')
with path.open('x') as stream:
    stream.write(text)
path.chmod(0o640)
PY
chown root:arkovia /etc/arkovia/nxt.properties
install -m 0644 /opt/arkovia/linux/arkovia.service /etc/systemd/system/arkovia.service
systemctl daemon-reload
echo 'Installed. Start with: sudo systemctl enable --now arkovia'
echo 'Logs: sudo journalctl -u arkovia -f'
echo 'Wallet/API: http://127.0.0.1:7876 (use an SSH tunnel for remote access).'
