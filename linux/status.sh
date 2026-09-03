#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import json, sys, urllib.request
def query(request):
    with urllib.request.urlopen('http://127.0.0.1:7876/nxt?requestType=' + request, timeout=15) as response:
        data = json.load(response)
    if 'errorCode' in data:
        raise RuntimeError(data.get('errorDescription', str(data)))
    return data
try:
    status = query('getBlockchainStatus')
    peers = query('getPeers&state=CONNECTED').get('peers', [])
    print(json.dumps({
        'application': status.get('application'),
        'version': status.get('version'),
        'height': status.get('numberOfBlocks', 1) - 1,
        'lastBlock': status.get('lastBlock'),
        'isDownloading': status.get('isDownloading'),
        'isScanning': status.get('isScanning'),
        'isLightClient': status.get('isLightClient'),
        'connectedPeers': len(peers),
    }, indent=2))
    if not peers:
        print('No connected peers: synchronization is NOT verified.', file=sys.stderr)
        sys.exit(2)
    print('Compare height and lastBlock with a trusted Arkovia node to verify sync.')
except Exception as error:
    print('Node unavailable: ' + str(error), file=sys.stderr)
    sys.exit(1)
PY
