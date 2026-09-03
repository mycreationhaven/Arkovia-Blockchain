#!/usr/bin/env python3
"""Isolated release smoke test; no public peers, forging, or production data."""
import json
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


release = Path(sys.argv[1]).resolve()
api_port, peer_port = free_port(), free_port()
while peer_port == api_port:
    peer_port = free_port()

with tempfile.TemporaryDirectory(prefix='arkovia-smoke-') as temporary:
    work = Path(temporary)
    config = (release / 'linux/nxt.properties.example').read_text()
    config = config.replace('REPLACE_WITH_EXISTING_ARKOVIA_PEER:47874', '')
    config = config.replace('REPLACE_WITH_RANDOM_ADMIN_PASSWORD', secrets.token_hex(32))
    config = config.replace('nxt.peerServerHost=0.0.0.0', 'nxt.peerServerHost=127.0.0.1')
    config = config.replace('nxt.apiServerPort=7876', f'nxt.apiServerPort={api_port}')
    config = config.replace('nxt.peerServerPort=47874', f'nxt.peerServerPort={peer_port}')
    config = config.replace('/opt/arkovia/html', str(release / 'html'))
    (work / 'nxt.properties').write_text(config)
    base = f'http://127.0.0.1:{api_port}'

    def read_url(url, data=None):
        with urllib.request.urlopen(url, data=data, timeout=10) as response:
            return response.read()

    def query(request):
        return json.loads(read_url(base + '/nxt?requestType=' + request))

    first_block = None
    for attempt in range(2):
        started = time.monotonic()
        with (work / f'run-{attempt}.log').open('w') as log:
            node = subprocess.Popen(
                [str(release / 'linux/start-node.sh'), str(work / 'nxt.properties')],
                cwd=work, stdout=log, stderr=subprocess.STDOUT)
            try:
                while True:
                    if node.poll() is not None:
                        raise RuntimeError('Node exited during startup; see output below')
                    try:
                        status = query('getBlockchainStatus')
                        break
                    except (urllib.error.URLError, TimeoutError):
                        if time.monotonic() - started > 240:
                            raise TimeoutError('Startup exceeded 240 seconds')
                        time.sleep(1)
                assert status['application'] == 'Arkovia', status
                assert status['isLightClient'] is False, status
                assert status['numberOfBlocks'] == 1, status
                assert not query('getPeers&state=CONNECTED')['peers']
                assert b'<html' in read_url(base + '/index.html').lower()
                peer_info = json.loads(read_url(
                    f'http://127.0.0.1:{peer_port}/nxt',
                    json.dumps({'protocol': 1, 'requestType': 'getInfo'}).encode()))
                # Upstream deliberately rejects loopback addresses as peers.
                assert peer_info.get('error') == 'Your peer address cannot be resolved', peer_info
                if first_block is None:
                    first_block = status['lastBlock']
                else:
                    assert status['lastBlock'] == first_block
                print(json.dumps({'run': attempt + 1,
                                  'startup_seconds': round(time.monotonic() - started, 1),
                                  'genesis_block': first_block,
                                  'api_wallet_peer_server': 'passed'}), flush=True)
            except Exception:
                print((work / f'run-{attempt}.log').read_text()[-6000:], file=sys.stderr)
                raise
            finally:
                node.terminate()
                try:
                    node.wait(timeout=120)
                except subprocess.TimeoutExpired:
                    node.kill()
                    node.wait()
                    raise RuntimeError('Node failed to stop within 120 seconds')
            assert node.returncode in (0, 143, -15), node.returncode
            assert 'stopped.' in (work / f'run-{attempt}.log').read_text()
    print('PASS: genesis initialization, local API/wallet/P2P, clean shutdown, database restart.')
