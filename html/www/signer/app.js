(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = {
    wallets: [],
    selectedWallet: null,
    unlockedWallet: null,
    unlockedSecretPhrase: null,
    lockTimer: null,
    pendingChallenge: null,
    installPrompt: null,
    connected: null,
  };

  const TRUSTED_PRODUCTION_ORIGINS = new Set([
    'https://hubzamworks.162-35-102-161.sslip.io',
    'https://hubzamworks.com',
    'https://www.hubzamworks.com',
  ]);

  function normalizeOrigin(value) {
    try {
      const url = new URL(String(value || ''));
      return url.origin;
    } catch {
      return '';
    }
  }

  function isTrustedHubzamOrigin(origin) {
    const normalized = normalizeOrigin(origin);
    if (!normalized || normalized !== String(origin || '').replace(/\/$/, '')) return false;
    if (TRUSTED_PRODUCTION_ORIGINS.has(normalized)) return true;
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && host.endsWith('.hubzamworks.com')) return true;
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (host === 'localhost' || host === '127.0.0.1');
  }

  function toast(message, type = 'info') {
    const el = $('toast');
    el.textContent = String(message || '');
    el.className = type === 'error' ? 'toast error' : 'toast';
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 4200);
  }

  function setStatus(title, text) {
    $('statusTitle').textContent = title;
    $('statusText').textContent = text;
  }

  function shortKey(value) {
    const text = String(value || '');
    return text.length > 18 ? `${text.slice(0, 10)}…${text.slice(-8)}` : text;
  }

  function connectedMessage(type, payload = {}) {
    const connected = state.connected;
    if (!connected || !window.opener || window.opener.closed) return false;
    window.opener.postMessage({
      type,
      request_id: connected.requestId,
      ...payload,
    }, connected.returnOrigin);
    return true;
  }

  function parseConnectedRequest() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('arkovia_signer') !== 'hubzam') return null;

    const requestId = params.get('request_id') || '';
    const returnOrigin = normalizeOrigin(params.get('return_origin'));
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(requestId)) {
      throw new Error('Hubzam signer request ID is invalid.');
    }
    if (!isTrustedHubzamOrigin(returnOrigin)) {
      throw new Error('This website is not approved to request Arkovia signatures.');
    }
    if (!window.opener || window.opener.closed) {
      throw new Error('This signer request must be opened directly from Hubzam Works.');
    }
    return { requestId, returnOrigin };
  }

  function resetLockTimer() {
    clearTimeout(state.lockTimer);
    if (!state.unlockedSecretPhrase) return;
    state.lockTimer = setTimeout(() => lockWallet('Wallet locked after inactivity.'), 5 * 60 * 1000);
  }

  function lockWallet(message = 'Wallet locked.') {
    state.unlockedSecretPhrase = null;
    state.unlockedWallet = null;
    state.pendingChallenge = null;
    $('manualSignButton').disabled = true;
    $('lockButton').hidden = true;
    $('requestPanel').hidden = true;
    $('manualOutputWrap').hidden = true;
    $('manualSignature').value = '';
    setStatus('Wallet locked', message);
    renderWallets();
  }

  function showPanel(panelId) {
    for (const id of ['unlockPanel', 'addWalletPanel']) $(id).hidden = id !== panelId;
  }

  function hideSetupPanels() {
    $('unlockPanel').hidden = true;
    $('addWalletPanel').hidden = true;
  }

  function renderWallets() {
    const list = $('walletList');
    list.textContent = '';
    $('emptyWallets').hidden = state.wallets.length > 0;

    for (const wallet of state.wallets) {
      const card = document.createElement('div');
      card.className = 'wallet-card' + (state.unlockedWallet?.public_key_hex === wallet.public_key_hex ? ' active' : '');

      const meta = document.createElement('div');
      meta.className = 'wallet-meta';
      const label = document.createElement('div');
      label.className = 'wallet-label';
      label.textContent = wallet.label || 'Arkovia Wallet';
      const account = document.createElement('div');
      account.className = 'wallet-key';
      account.textContent = `Account ${wallet.account_id} · ${shortKey(wallet.public_key_hex)}`;
      meta.append(label, account);

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'button ' + (state.unlockedWallet?.public_key_hex === wallet.public_key_hex ? 'secondary' : 'ghost');
      action.textContent = state.unlockedWallet?.public_key_hex === wallet.public_key_hex ? 'Unlocked' : 'Unlock';
      action.disabled = state.unlockedWallet?.public_key_hex === wallet.public_key_hex;
      action.addEventListener('click', () => beginUnlock(wallet));

      card.append(meta, action);
      list.append(card);
    }
  }

  async function refreshWallets() {
    state.wallets = await ArkoviaSignerVault.listWallets();
    renderWallets();

    if (state.connected && !state.unlockedWallet && state.wallets.length === 1) {
      beginUnlock(state.wallets[0]);
    } else if (!state.wallets.length) {
      setStatus('Set up Arkovia Signer', 'Add an encrypted wallet vault on this device.');
    } else if (!state.unlockedWallet) {
      setStatus('Choose a wallet', 'Unlock the Arkovia identity you want to use.');
    }
  }

  function beginUnlock(wallet) {
    state.selectedWallet = wallet;
    $('unlockWalletLabel').textContent = wallet.label || 'Unlock Arkovia Wallet';
    $('unlockPassword').value = '';
    showPanel('unlockPanel');
    setTimeout(() => $('unlockPassword').focus(), 30);
  }

  async function unlockSelectedWallet() {
    const wallet = state.selectedWallet;
    if (!wallet) return;
    try {
      $('unlockButton').disabled = true;
      const result = await ArkoviaSignerVault.unlockWallet(wallet.public_key_hex, $('unlockPassword').value);
      state.unlockedSecretPhrase = result.secretPhrase;
      state.unlockedWallet = result.wallet;
      state.selectedWallet = null;
      $('unlockPassword').value = '';
      hideSetupPanels();
      $('manualSignButton').disabled = false;
      $('lockButton').hidden = false;
      setStatus('Signer unlocked', `${result.wallet.label} is ready for local signing.`);
      resetLockTimer();
      await refreshWallets();

      if (state.connected) {
        connectedMessage('ARKOVIA_HUBZAM_IDENTITY', {
          public_key_hex: result.wallet.public_key_hex,
        });
        setStatus('Connected to Hubzam Works', 'Waiting for a one-time identity challenge.');
      }
    } catch (error) {
      toast(error?.message || 'Could not unlock wallet.', 'error');
    } finally {
      $('unlockButton').disabled = false;
    }
  }

  function openAddWallet() {
    $('walletLabel').value = '';
    $('walletSecret').value = '';
    $('vaultPassword').value = '';
    $('vaultPasswordConfirm').value = '';
    showPanel('addWalletPanel');
    setTimeout(() => $('walletLabel').focus(), 30);
  }

  async function saveWallet() {
    const label = $('walletLabel').value.trim();
    const secretPhrase = $('walletSecret').value;
    const password = $('vaultPassword').value;
    const confirm = $('vaultPasswordConfirm').value;

    if (!secretPhrase.trim()) return toast('Enter the Arkovia secret phrase inside the signer.', 'error');
    if (password.length < 8) return toast('Signer password must be at least 8 characters.', 'error');
    if (password !== confirm) return toast('Signer passwords do not match.', 'error');

    try {
      $('saveWalletButton').disabled = true;
      const wallet = await ArkoviaSignerVault.saveWallet({ label, secretPhrase, password });
      state.unlockedSecretPhrase = secretPhrase;
      state.unlockedWallet = wallet;
      $('walletSecret').value = '';
      $('vaultPassword').value = '';
      $('vaultPasswordConfirm').value = '';
      hideSetupPanels();
      $('manualSignButton').disabled = false;
      $('lockButton').hidden = false;
      resetLockTimer();
      await refreshWallets();
      setStatus('Wallet encrypted and ready', `${wallet.label} is unlocked for local signing.`);
      toast('Wallet encrypted and saved on this device.');

      if (state.connected) {
        connectedMessage('ARKOVIA_HUBZAM_IDENTITY', { public_key_hex: wallet.public_key_hex });
        setStatus('Connected to Hubzam Works', 'Waiting for a one-time identity challenge.');
      }
    } catch (error) {
      toast(error?.message || 'Could not save wallet.', 'error');
    } finally {
      $('saveWalletButton').disabled = false;
    }
  }

  function parseChallenge(message) {
    const text = String(message || '');
    if (!text || text.length > 4096) throw new Error('Challenge is empty or too large.');

    const lines = text.split('\n');
    const domain = lines.shift();
    const fields = {};
    for (const line of lines) {
      const index = line.indexOf('=');
      if (index < 1) continue;
      fields[line.slice(0, index)] = line.slice(index + 1);
    }

    let allowedPurpose = false;
    if (domain === 'HUBZAM_ARKOVIA_LOGIN_V1') {
      allowedPurpose = fields.purpose === 'login';
    } else if (domain === 'HUBZAM_ARKOVIA_AUTH_V1') {
      allowedPurpose = ['link_wallet', 'offline_login'].includes(fields.purpose);
    } else {
      throw new Error('This is not a recognized Hubzam Arkovia identity challenge.');
    }

    if (!allowedPurpose) throw new Error('Unsupported Hubzam signing purpose.');
    const expiresAt = Date.parse(fields.expires_at || '');
    const issuedAt = Date.parse(fields.issued_at || '');
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('This Hubzam challenge is expired.');
    if (Number.isFinite(issuedAt)) {
      if (issuedAt > Date.now() + 60_000) throw new Error('Challenge issue time is invalid.');
      if (expiresAt - issuedAt > 10 * 60_000) throw new Error('Challenge validity window is too long.');
    }

    if (fields.public_key_hex && state.unlockedWallet
      && fields.public_key_hex.toLowerCase() !== state.unlockedWallet.public_key_hex.toLowerCase()) {
      throw new Error('This challenge is for a different Arkovia wallet.');
    }

    return { domain, fields, text };
  }

  function challengeLabel(purpose) {
    if (purpose === 'login') return 'Sign in to Hubzam Works';
    if (purpose === 'offline_login') return 'Offline Hubzam identity check';
    if (purpose === 'link_wallet') return 'Link this wallet to Hubzam Works';
    return 'Hubzam identity request';
  }

  function renderChallenge(parsed) {
    state.pendingChallenge = parsed;
    $('requestTitle').textContent = challengeLabel(parsed.fields.purpose);
    $('requestPurposeBadge').textContent = parsed.fields.purpose === 'offline_login' ? 'Offline identity' : 'Identity only';
    $('requestMessage').textContent = parsed.text;
    const details = $('requestDetails');
    details.textContent = '';

    const rows = [
      ['Purpose', parsed.fields.purpose],
      ['Wallet', state.unlockedWallet?.label],
      ['Account', state.unlockedWallet?.account_id],
      ['Company', parsed.fields.company_id],
      ['Device', parsed.fields.device_id],
      ['Location', parsed.fields.location_id],
      ['Register', parsed.fields.register_id],
      ['Expires', parsed.fields.expires_at ? new Date(parsed.fields.expires_at).toLocaleString() : null],
    ].filter((row) => row[1]);

    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = String(value);
      details.append(dt, dd);
    }
    $('requestPanel').hidden = false;
    $('requestPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setStatus('Approval required', 'Review the request, then approve it if you recognize the action.');
    resetLockTimer();
  }

  async function approveChallenge() {
    if (!state.pendingChallenge || !state.unlockedSecretPhrase || !state.unlockedWallet) {
      return toast('Unlock a wallet and load a valid request first.', 'error');
    }

    try {
      $('approveButton').disabled = true;
      const parsed = parseChallenge(state.pendingChallenge.text);
      const signatureHex = await ArkoviaSignerCrypto.signMessage(parsed.text, state.unlockedSecretPhrase);
      resetLockTimer();

      if (state.connected) {
        connectedMessage('ARKOVIA_HUBZAM_SIGNATURE', {
          public_key_hex: state.unlockedWallet.public_key_hex,
          signature_hex: signatureHex,
        });
        setStatus('Signature returned to Hubzam', 'Hubzam is verifying your identity now.');
        $('requestPanel').hidden = true;
        state.pendingChallenge = null;
        setTimeout(() => {
          try { window.close(); } catch (_) {}
        }, 900);
      } else {
        $('manualSignature').value = signatureHex;
        $('manualOutputWrap').hidden = false;
      }
    } catch (error) {
      toast(error?.message || 'Could not sign request.', 'error');
    } finally {
      $('approveButton').disabled = false;
    }
  }

  function rejectChallenge() {
    state.pendingChallenge = null;
    $('requestPanel').hidden = true;
    if (state.connected) {
      connectedMessage('ARKOVIA_HUBZAM_ERROR', { message: 'The user rejected the Arkovia signing request.' });
      setStatus('Request rejected', 'No signature was created.');
    }
  }

  async function manualSign() {
    if (!state.unlockedSecretPhrase || !state.unlockedWallet) return toast('Unlock a wallet first.', 'error');
    const message = $('manualMessage').value;
    if (!message) return toast('Enter a message to sign.', 'error');
    try {
      $('manualSignButton').disabled = true;
      const signature = await ArkoviaSignerCrypto.signMessage(message, state.unlockedSecretPhrase);
      $('manualSignature').value = signature;
      $('manualOutputWrap').hidden = false;
      resetLockTimer();
    } catch (error) {
      toast(error?.message || 'Could not sign message.', 'error');
    } finally {
      $('manualSignButton').disabled = false;
    }
  }

  async function copySignature() {
    try {
      await navigator.clipboard.writeText($('manualSignature').value || '');
      toast('Signature copied.');
    } catch {
      toast('Could not copy signature.', 'error');
    }
  }

  function handleConnectedMessage(event) {
    const connected = state.connected;
    if (!connected || event.source !== window.opener || event.origin !== connected.returnOrigin) return;
    const data = event.data || {};
    if (data.request_id !== connected.requestId || data.type !== 'ARKOVIA_HUBZAM_SIGN_REQUEST') return;

    if (!state.unlockedWallet || !state.unlockedSecretPhrase) {
      connectedMessage('ARKOVIA_HUBZAM_ERROR', { message: 'Unlock an Arkovia wallet before signing.' });
      return;
    }

    try {
      const parsed = parseChallenge(data.challenge);
      renderChallenge(parsed);
    } catch (error) {
      connectedMessage('ARKOVIA_HUBZAM_ERROR', { message: error?.message || 'Invalid Hubzam challenge.' });
      toast(error?.message || 'Invalid Hubzam challenge.', 'error');
    }
  }

  async function checkNodeStatus() {
    const badge = $('networkBadge');
    if (!navigator.onLine) {
      badge.textContent = 'Offline signing ready';
      badge.className = 'badge secure';
      return;
    }
    try {
      const response = await fetch('/nxt?requestType=getBlockchainStatus', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.application === 'Arkovia') {
        badge.textContent = data.blockchainState === 'UP_TO_DATE' ? 'Arkovia network online' : 'Node syncing';
        badge.className = data.blockchainState === 'UP_TO_DATE' ? 'badge secure' : 'badge muted';
        return;
      }
    } catch (_) {}
    badge.textContent = 'Network unavailable · local signing works';
    badge.className = 'badge muted';
  }

  function wireInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      state.installPrompt = event;
      $('installButton').hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      state.installPrompt = null;
      $('installButton').hidden = true;
      toast('Arkovia Signer installed.');
    });
    $('installButton').addEventListener('click', async () => {
      if (!state.installPrompt) return;
      await state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      $('installButton').hidden = true;
    });
  }

  async function init() {
    wireInstallPrompt();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
        toast('Offline cache could not be registered on this browser.', 'error');
      });
    }

    try {
      state.connected = parseConnectedRequest();
    } catch (error) {
      $('connectedBanner').hidden = false;
      $('connectedOrigin').textContent = error.message;
      setStatus('Connection rejected', 'This signer window was not opened by an approved Hubzam Works origin.');
      toast(error.message, 'error');
      state.connected = null;
    }

    if (state.connected) {
      $('connectedBanner').hidden = false;
      $('connectedOrigin').textContent = `Requesting app: ${state.connected.returnOrigin}`;
      connectedMessage('ARKOVIA_HUBZAM_READY', { signer_version: 2, capabilities: ['login', 'link_wallet', 'offline_login'] });
    }

    await refreshWallets();
    await checkNodeStatus();

    window.addEventListener('online', checkNodeStatus);
    window.addEventListener('offline', checkNodeStatus);
    window.addEventListener('message', handleConnectedMessage);
    window.addEventListener('beforeunload', () => {
      state.unlockedSecretPhrase = null;
    });

    document.addEventListener('pointerdown', resetLockTimer, { passive: true });
    document.addEventListener('keydown', resetLockTimer);

    $('addWalletButton').addEventListener('click', openAddWallet);
    $('cancelAddWalletButton').addEventListener('click', hideSetupPanels);
    $('saveWalletButton').addEventListener('click', saveWallet);
    $('unlockButton').addEventListener('click', unlockSelectedWallet);
    $('cancelUnlockButton').addEventListener('click', hideSetupPanels);
    $('unlockPassword').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') unlockSelectedWallet();
    });
    $('lockButton').addEventListener('click', () => lockWallet('Locked by user.'));
    $('approveButton').addEventListener('click', approveChallenge);
    $('rejectButton').addEventListener('click', rejectChallenge);
    $('manualSignButton').addEventListener('click', manualSign);
    $('copySignatureButton').addEventListener('click', copySignature);
  }

  init().catch((error) => {
    setStatus('Signer could not start', error?.message || 'Unexpected startup error.');
    toast(error?.message || 'Unexpected signer startup error.', 'error');
  });
})();
