----
# USERS GUIDE #

----
## What is in for me with Nxt? ##

  - a **decentralized** platform for my assets like money, company shares etc.
  - almost all trusted third parties **removed**
  - many useful financial, economical and social features

----
## What do I need to do? ##

  - for a quick start, see README.md
  - for configuration and updates, see OPERATORS-GUIDE.md

----
## How does it work? ##

### NRS (Nxt Reference Software) ###

  - client-server application
  - JavaFX UI on supported platforms
  - also access via a Web browser like Mozilla Firefox or Google Chrome
  - accounts are accessible from everywhere in the world
  - very strong and long passphrases required

### Nxt ###

  - peer-to-peer protocol
  - efficient blockchain technology (can run on low-power devices)
  - allows payment *transactions*, *exchange trading*, *name registrations*, *voting* and much more
  - no need to trust third parties anymore

### Forging (aka block generation) ###

  - reward for securing the network
  - start via the browser interface
  - requires only:
    - decent amount of the base currency NXT
    - running NRS (browser or tab can be closed)
    - very little CPU power

----
## How can I contribute? ##

  - review pull requests
  - help users on issues
  - join the forums and find places where you can help
  - get your friends to join Nxt
  - generate blocks via the forging capability
  - ask us, the dev team

----

----
## Message Signing ##

Arkovia Wallet can sign plain-text messages without sending a blockchain transaction.

- Open the wallet Settings/Tools menu and choose **Sign Message**.
- Review the exact message before signing.
- Enter your wallet passphrase only inside the Arkovia Wallet.
- The result is a 128-character hexadecimal signature that proves the wallet signed that exact message.
- Signing a message does **not** send ARKOS and does **not** authorize a payment by itself.

### Hubzam Works connected signing ###

When Hubzam Works requests an Arkovia login signature, Hubzam opens a small Arkovia-controlled signer window. The wallet returns only the public key and message signature. Your passphrase and private key remain inside the local Arkovia Wallet and are never sent to Hubzam.

The normal Hubzam flow is:

1. Choose **Sign Message with Arkovia** in Hubzam.
2. Unlock the local Arkovia Wallet if needed.
3. Review the one-time `HUBZAM_ARKOVIA_LOGIN_V1` message.
4. Choose **Approve & Sign**.
5. The signature is returned to Hubzam automatically for verification.

The manual copy/paste signature method remains available as a fallback.
