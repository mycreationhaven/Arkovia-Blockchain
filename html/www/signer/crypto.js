(() => {
  'use strict';

  const encoder = new TextEncoder();

  function requireCrypto() {
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
      throw new Error('This browser does not provide the required Web Crypto APIs.');
    }
    if (!globalThis.curve25519) {
      throw new Error('Arkovia Curve25519 support did not load.');
    }
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(hex) {
    const normalized = String(hex || '').trim().toLowerCase();
    if (!/^[0-9a-f]*$/.test(normalized) || normalized.length % 2 !== 0) {
      throw new Error('Expected hexadecimal bytes.');
    }
    return Uint8Array.from(normalized.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) || []);
  }

  function concatBytes(...chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  async function sha256(...parts) {
    requireCrypto();
    const chunks = parts.map((part) => {
      if (typeof part === 'string') return encoder.encode(part);
      if (part instanceof Uint8Array) return part;
      if (ArrayBuffer.isView(part)) return new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
      if (part instanceof ArrayBuffer) return new Uint8Array(part);
      throw new Error('Unsupported SHA-256 input.');
    });
    return new Uint8Array(await crypto.subtle.digest('SHA-256', concatBytes(...chunks)));
  }

  async function deriveWallet(secretPhrase) {
    requireCrypto();
    const secret = String(secretPhrase || '');
    if (!secret) throw new Error('Arkovia secret phrase is required.');
    const digest = await sha256(secret);
    const keypair = curve25519.keygen(Array.from(digest));
    const publicKey = Uint8Array.from(keypair.p);
    const publicKeyHex = bytesToHex(publicKey);
    const accountHash = await sha256(publicKey);
    let accountId = 0n;
    for (let i = 7; i >= 0; i -= 1) accountId = (accountId << 8n) + BigInt(accountHash[i]);
    return { publicKeyHex, accountId: accountId.toString(10) };
  }

  async function signMessage(message, secretPhrase) {
    requireCrypto();
    const text = String(message ?? '');
    const secret = String(secretPhrase || '');
    if (!text) throw new Error('Message is required.');
    if (!secret) throw new Error('Wallet is locked.');

    const digest = await sha256(secret);
    const keypair = curve25519.keygen(Array.from(digest));
    const m = await sha256(text);
    const x = await sha256(m, Uint8Array.from(keypair.s));
    const y = Uint8Array.from(curve25519.keygen(Array.from(x)).p);
    const h = await sha256(m, y);
    const v = curve25519.sign(Array.from(h), Array.from(x), keypair.s);
    if (!v) throw new Error('Arkovia signing failed.');
    const signatureHex = bytesToHex(Uint8Array.from([...v, ...h]));
    if (!/^[0-9a-f]{128}$/.test(signatureHex)) throw new Error('Arkovia produced an invalid signature.');
    return signatureHex;
  }

  function randomBytes(length) {
    requireCrypto();
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function toBase64(bytes) {
    let binary = '';
    const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (const byte of source) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(String(value || ''));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  async function deriveVaultKey(password, salt, iterations = 310000) {
    requireCrypto();
    const raw = await crypto.subtle.importKey(
      'raw',
      encoder.encode(String(password || '')),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  async function encryptSecret(secretPhrase, password) {
    const passwordText = String(password || '');
    if (passwordText.length < 8) throw new Error('Signer password must be at least 8 characters.');
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const iterations = 310000;
    const key = await deriveVaultKey(passwordText, salt, iterations);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(String(secretPhrase || '')),
    ));
    return {
      kdf: 'PBKDF2-SHA256',
      cipher: 'AES-256-GCM',
      iterations,
      salt_b64: toBase64(salt),
      iv_b64: toBase64(iv),
      ciphertext_b64: toBase64(ciphertext),
    };
  }

  async function decryptSecret(record, password) {
    try {
      const salt = fromBase64(record.salt_b64);
      const iv = fromBase64(record.iv_b64);
      const ciphertext = fromBase64(record.ciphertext_b64);
      const key = await deriveVaultKey(String(password || ''), salt, Number(record.iterations || 310000));
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new TextDecoder().decode(plaintext);
    } catch {
      throw new Error('Could not unlock this wallet. Check the signer password.');
    }
  }

  window.ArkoviaSignerCrypto = Object.freeze({
    bytesToHex,
    hexToBytes,
    sha256,
    deriveWallet,
    signMessage,
    encryptSecret,
    decryptSecret,
  });
})();
