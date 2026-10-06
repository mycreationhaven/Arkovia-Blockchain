#!/usr/bin/env node
import fs from 'node:fs';

const js = fs.readFileSync('html/www/js/nrs.modals.token.js', 'utf8');
const modal = fs.readFileSync('html/www/html/modals/nrs.html', 'utf8');
const header = fs.readFileSync('html/www/html/header.html', 'utf8');

let failed = 0;
function check(name, condition) {
  const ok = Boolean(condition);
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

check('wallet exposes Sign Message tool', header.includes('data-sign-message="true"') && header.includes('Sign Message'));
check('signer UI stays inside Arkovia wallet', modal.includes('id="sign_message_form"') && modal.includes('secret_phrase_modal_template'));
check('connected signer protocol is present', js.includes('ARKOVIA_HUBZAM_READY') && js.includes('ARKOVIA_HUBZAM_IDENTITY') && js.includes('ARKOVIA_HUBZAM_SIGN_REQUEST') && js.includes('ARKOVIA_HUBZAM_SIGNATURE'));
check('opener is bound', js.includes('event.source !== window.opener'));
check('request origin is bound', js.includes('event.origin !== hubzamSigner.returnOrigin'));
check('responses target exact origin', js.includes('window.opener.postMessage(message, hubzamSigner.returnOrigin)'));
check('wildcard postMessage is absent', !/postMessage\([^\n]*["']\*["']/.test(js));
check('Hubzam login signing domain is enforced', js.includes('HUBZAM_ARKOVIA_LOGIN_V1') && js.includes('purpose=login'));
check('wallet public key is bound into challenge', js.includes('"public_key_hex=" + hubzamSigner.publicKey'));
check('challenge expiry is checked', js.includes('Date.parse(expiresLine) <= Date.now()'));
check('message is UTF-8 encoded before signing', js.includes('converters.stringToHexString(message)'));
check('passphrase is encoded locally before signing', js.includes('converters.stringToHexString(secretPhrase)'));
check('signature is canonical hex', js.includes('/^[0-9a-f]{128}$/i'));
check('Hubzam signer clears temporary passphrase', js.includes('hubzamSigner.secretPhrase = null'));
check('connected request cannot authorize payment by wording', modal.includes('does not send ARKOS or authorize a payment'));

console.log(`\n${15 - failed}/15 connected signer checks passed.`);
if (failed) process.exit(1);
