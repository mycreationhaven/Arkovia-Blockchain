#!/usr/bin/env node
import fs from 'node:fs';

const index = fs.readFileSync('html/www/signer/index.html', 'utf8');
const app = fs.readFileSync('html/www/signer/app.js', 'utf8');
const crypto = fs.readFileSync('html/www/signer/crypto.js', 'utf8');
const vault = fs.readFileSync('html/www/signer/vault.js', 'utf8');
const sw = fs.readFileSync('html/www/signer/sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('html/www/signer/manifest.webmanifest', 'utf8'));

let failed = 0;
function check(name, condition) {
  const ok = Boolean(condition);
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

check('PWA manifest has standalone mode', manifest.display === 'standalone');
check('PWA manifest has 192px icon', manifest.icons?.some((icon) => icon.sizes === '192x192'));
check('PWA manifest has 512px icon', manifest.icons?.some((icon) => icon.sizes === '512x512'));
check('service worker precaches signer shell', sw.includes("'./index.html'") && sw.includes("'./app.js'") && sw.includes("'./crypto.js'"));
check('service worker precaches Curve25519 dependencies', sw.includes('../js/crypto/curve25519.js') && sw.includes('../js/crypto/curve25519_.js'));
check('vault uses IndexedDB rather than plaintext localStorage', vault.includes('indexedDB.open') && !vault.includes('localStorage'));
check('vault encryption uses AES-256-GCM', crypto.includes("'AES-GCM'") && crypto.includes('length: 256'));
check('vault KDF uses PBKDF2-SHA256', crypto.includes("'PBKDF2'") && crypto.includes("'SHA-256'") && crypto.includes('310000'));
check('signer derives Arkovia public key locally', crypto.includes('curve25519.keygen'));
check('signer creates 128-character signatures locally', crypto.includes('curve25519.sign') && crypto.includes('/^[0-9a-f]{128}$/'));
check('Hubzam opener is origin-bound', app.includes('event.origin !== connected.returnOrigin') && app.includes('event.source !== window.opener'));
check('wildcard postMessage is absent', !/postMessage\([^\n]*["']\*["']/.test(app));
check('Hubzam request ID is bound', app.includes('data.request_id !== connected.requestId'));
check('online login domain is enforced', app.includes('HUBZAM_ARKOVIA_LOGIN_V1'));
check('offline/login-link domain is enforced', app.includes('HUBZAM_ARKOVIA_AUTH_V1'));
check('offline login is supported', app.includes("'offline_login'"));
check('wallet link signing is supported', app.includes("'link_wallet'"));
check('challenge expiration is checked', app.includes('expiresAt <= Date.now()'));
check('PWA never claims signing requires Node 1', index.includes('Node 1 is used for distribution and network status—not as a requirement'));
check('secret phrase is only accepted inside signer UI', index.includes('Arkovia secret phrase') && !app.includes('fetch(' + "'/api"));

console.log(`\n${20 - failed}/20 Arkovia Signer PWA checks passed.`);
if (failed) process.exit(1);
