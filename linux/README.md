# Arkovia Linux Full Node

Headless, independently validating Arkovia mainnet node built from
`mycreationhaven/Arkovia-Blockchain`. It includes the original genesis files,
compiled Java core, bundled dependencies, browser wallet, corresponding core
source, license notices, SHA-256 checksums, and a systemd service.

**You need the address of an existing Arkovia peer.** The upstream source has
no default peers. A process running at height zero is not a synchronized node.
This package does not create a new blockchain, forge automatically, or need a
wallet secret phrase. Full validation is enabled; upstream prunable-message
retention defaults remain unchanged, so this is not a prunable-data archive.

## Requirements

- Linux with Bash and OpenJDK **17**. Systemd installation targets Debian/Ubuntu.
- Python 3 for installation and status reporting; GNU coreutils and tar.
- Suggested starting resources: 2 CPU cores, 4 GB RAM, SSD with at least 20 GB
  free and room to grow. These are provisioning estimates, not measured chain
  capacity requirements. Default Java heap is 2 GB.
- Outbound network connectivity to existing Arkovia peers. Allow inbound TCP
  **47874** if this server should accept peers. Keep API port **7876** private.

## Install the compiled package

On a Debian/Ubuntu server:

```bash
sudo apt-get update
sudo apt-get install -y openjdk-17-jre-headless python3 ca-certificates
tar -xzf arkovia-linux-full-node.tar.gz
cd arkovia-linux-full-node
sha256sum --check --quiet SHA256SUMS
```

Replace the example address below with a real, existing **Arkovia P2P** peer,
not the explorer website or wallet API. The installer rejects existing
installation paths/accounts to avoid overwriting a running node or its data.

```bash
sudo bash linux/install.sh YOUR_EXISTING_PEER:47874
sudo systemctl enable --now arkovia
sudo journalctl -u arkovia -f
```

An optional second argument advertises this new node's public address:

```bash
sudo bash linux/install.sh YOUR_EXISTING_PEER:47874 THIS_NODE_PUBLIC_HOST:47874
```

Use only one of those installer commands. The installer does not start the
node, open ports, or alter firewall/SSH rules. If using UFW and it is already
enabled, `sudo ufw allow 47874/tcp` permits peer traffic; allow the same port in
your hosting firewall and router where applicable.

## Files and management

| Purpose | Location |
| --- | --- |
| Read-only program and wallet | `/opt/arkovia` |
| Configuration and generated admin password | `/etc/arkovia/nxt.properties` |
| Blockchain database | `/var/lib/arkovia/nxt_db` |
| Rotating application logs | `/var/lib/arkovia/logs` |
| systemd unit | `/etc/systemd/system/arkovia.service` |

```bash
sudo systemctl status arkovia
bash /opt/arkovia/linux/status.sh
sudo systemctl stop arkovia
sudo systemctl restart arkovia
```

The status command exits 1 if the API is unavailable and 2 if there are no
connected peers. Initial genesis loading may take several minutes. Check that
`application` is `Arkovia`, `isLightClient` is false, connected peers are present,
and height advances. Compare height and `lastBlock` with a trusted Arkovia node;
`isDownloading=false` alone does not establish synchronization.

Edit `/etc/arkovia/nxt.properties` with `sudoedit`. Additional seed peers are
separated by semicolons in `nxt.wellKnownPeers`. The generated admin password
is available only to root and the service account; never put a wallet secret
phrase in this file. No automatic forging configuration is added.

To adjust heap, use `sudo systemctl edit arkovia` and add:

```ini
[Service]
Environment=ARKOVIA_HEAP_MB=2048
```

Then run `sudo systemctl daemon-reload` and `sudo systemctl restart arkovia`.

## Wallet access from another computer

From your own computer, open an SSH tunnel:

```bash
ssh -L 7876:127.0.0.1:7876 YOUR_SSH_USER@YOUR_SERVER
```

Keep that session open and visit `http://127.0.0.1:7876`. The API stays bound to
loopback and API proxying is disabled so requests use this node's local chain.

## Run without systemd

Use the extracted release as a normal Linux user. Create configuration in a
separate private data directory and set a real seed peer, a random admin
password, and `nxt.apiResourceBase` to the release's absolute `html/www` path.

```bash
mkdir -m 700 -p "$HOME/arkovia-data"
cp linux/nxt.properties.example "$HOME/arkovia-data/nxt.properties"
chmod 600 "$HOME/arkovia-data/nxt.properties"
# Edit that file and replace every REPLACE_WITH_ value before proceeding.
cd "$HOME/arkovia-data"
/absolute/path/arkovia-linux-full-node/linux/start-node.sh "$PWD/nxt.properties"
```

The launcher stays in the foreground; Ctrl+C shuts down cleanly. Database and
logs are relative to the working directory. Do not run two processes against
the same database.

## Build from source

Install `openjdk-17-jdk-headless` and Git, then from a checkout containing these
Linux scripts run:

```bash
bash linux/build.sh
```

Output: `dist/arkovia-linux-full-node.tar.gz` and its `.sha256` file. The build
compiles `src/java/nxt` with Java 17 and does not need JavaFX or a desktop. It
uses repository-bundled JARs and does not fetch new dependencies. `SOURCE_COMMIT`
identifies the checked-out source revision. Rebuild from a clean reviewed
checkout for subsequent releases; local source edits would also be compiled.

Run the isolated package smoke test with:

```bash
python3 linux/smoke-test.py dist/arkovia-linux-full-node
```

It uses temporary data and loopback ports, checks the wallet/API and expected
loopback-peer rejection, and verifies shutdown and a second database startup.
It intentionally does not connect to the live network.

## Backup, upgrade, and rollback

Stop the service before copying the H2 database. Confirm the service has
stopped, then back up `/var/lib/arkovia`, `/etc/arkovia`, and the old program
directory with ownership and permissions preserved. Protect backups because
they contain the API admin password and node records.

For an upgrade, verify the new package checksums, stop the service, move the
old `/opt/arkovia` aside, and place the new release at `/opt/arkovia`, owned by
root and not writable by the service user. Retain `/etc/arkovia` and
`/var/lib/arkovia`; do not rerun the first-install script. Review service-file
changes before applying them, then restart and verify peers/height. Database
migrations may prevent binary-only rollback: restore the matching stopped
database backup with the previous program when needed. Never replace genesis
files to resolve synchronization problems.

## Validation and limits

See `VALIDATION.md` for actual build/runtime results. No deployment credentials
or live Arkovia seed were supplied with this request; live-network sync and
installation on your server must be verified there. This release preserves
upstream consensus and bundled dependency versions; it is not a security audit
or dependency modernization of the blockchain.
