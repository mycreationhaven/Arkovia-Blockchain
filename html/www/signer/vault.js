(() => {
  'use strict';

  const DB_NAME = 'arkovia-signer-v1';
  const DB_VERSION = 1;
  const STORE = 'wallets';

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'public_key_hex' });
          store.createIndex('label', 'label', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open signer vault database.'));
    });
  }

  async function withStore(mode, operation) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;
        try {
          result = operation(store);
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => resolve(result?.result ?? result);
        tx.onerror = () => reject(tx.error || new Error('Signer vault transaction failed.'));
        tx.onabort = () => reject(tx.error || new Error('Signer vault transaction was aborted.'));
      });
    } finally {
      db.close();
    }
  }

  async function listWallets() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => {
          const records = (request.result || []).map((record) => ({
            public_key_hex: record.public_key_hex,
            account_id: record.account_id,
            label: record.label,
            created_at: record.created_at,
            last_used_at: record.last_used_at || null,
          }));
          records.sort((a, b) => String(b.last_used_at || b.created_at).localeCompare(String(a.last_used_at || a.created_at)));
          resolve(records);
        };
        request.onerror = () => reject(request.error || new Error('Could not list wallet vaults.'));
      });
    } finally {
      db.close();
    }
  }

  async function getWallet(publicKeyHex) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(String(publicKeyHex || '').toLowerCase());
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Could not read wallet vault.'));
      });
    } finally {
      db.close();
    }
  }

  async function saveWallet({ label, secretPhrase, password }) {
    const derived = await ArkoviaSignerCrypto.deriveWallet(secretPhrase);
    const encrypted = await ArkoviaSignerCrypto.encryptSecret(secretPhrase, password);
    const now = new Date().toISOString();
    const existing = await getWallet(derived.publicKeyHex);
    const record = {
      version: 1,
      public_key_hex: derived.publicKeyHex,
      account_id: derived.accountId,
      label: String(label || '').trim() || 'Arkovia Wallet',
      created_at: existing?.created_at || now,
      updated_at: now,
      last_used_at: existing?.last_used_at || null,
      ...encrypted,
    };
    await withStore('readwrite', (store) => store.put(record));
    return {
      public_key_hex: record.public_key_hex,
      account_id: record.account_id,
      label: record.label,
      created_at: record.created_at,
      last_used_at: record.last_used_at,
    };
  }

  async function unlockWallet(publicKeyHex, password) {
    const record = await getWallet(publicKeyHex);
    if (!record) throw new Error('Wallet vault not found on this device.');
    const secretPhrase = await ArkoviaSignerCrypto.decryptSecret(record, password);
    const derived = await ArkoviaSignerCrypto.deriveWallet(secretPhrase);
    if (derived.publicKeyHex !== record.public_key_hex || derived.accountId !== record.account_id) {
      throw new Error('Wallet vault integrity check failed.');
    }

    const updated = {
      ...record,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await withStore('readwrite', (store) => store.put(updated));
    return {
      secretPhrase,
      wallet: {
        public_key_hex: record.public_key_hex,
        account_id: record.account_id,
        label: record.label,
        created_at: record.created_at,
        last_used_at: updated.last_used_at,
      },
    };
  }

  async function deleteWallet(publicKeyHex) {
    await withStore('readwrite', (store) => store.delete(String(publicKeyHex || '').toLowerCase()));
  }

  async function clearAll() {
    await withStore('readwrite', (store) => store.clear());
  }

  window.ArkoviaSignerVault = Object.freeze({
    listWallets,
    getWallet,
    saveWallet,
    unlockWallet,
    deleteWallet,
    clearAll,
  });
})();
