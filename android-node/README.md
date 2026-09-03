# Arkovia Node for Android — experimental standalone build

A sideloadable full-node app for the user's Moto g 5G (2024), Android 15,
ARM64 with 4 KB memory pages. Java and the unchanged Arkovia core are bundled;
no Termux, root, server account, or separately installed Java is required.

## Current scope

- User-controlled start and stop, foreground notification, wake lock.
- Local chain database, block height, peer count, synchronization status.
- Editable seed peers from `conf/nxt.properties.txt`.
- Wi-Fi-only and charging-only preferences; stops if a selected condition fails.
- Bounded console log, previous session log, diagnostic export.
- No wallet credentials, forging, incoming public peer server, HTTP control API,
  telemetry, or automatic boot start. This node downloads/verifies the chain
  through outgoing peer connections; it does not provide a publicly reachable
  relay endpoint behind a mobile connection.

This is a compatibility test build, not a production release. The bundled
Android OpenJDK port is 17.0.10. Updating/auditing its security baseline,
checking runtime source distribution requirements, device testing, and
full network synchronization validation are release gates. Android may stop
background processes; uptime is not guaranteed. Runtime libraries require
4 KB pages. The app checks this before launch.

## Architecture

The Android service supervises a separate native process installed by Android
as `libarkovia_exec.so`. It invokes the bundled OpenJDK VM through the JNI
Invocation API. Java bytecode, JVM modules, chain configuration and license
files are packaged in an integrity-checked asset. Native libraries are
installed in Android's native library directory and linked to their runtime
paths. The app never downloads executable code.

`NodeMain` calls the repository's `Nxt.init()` and writes atomic JSON status
snapshots to private app storage. It accepts `STOP` on stdin, then calls
`Nxt.shutdown()`. The service allows 30 seconds for graceful shutdown before
SIGTERM, then a further 15 seconds before forced termination. A parent-death
signal prevents orphan processes. Startup and stopping do not request keys or
create transactions. JVM heap is capped at 512 MB, CPU count at two and H2
cache at 32 MB. The full chain still needs growing disk space.

## Build

Requirements: Python 3.12+, JDK 17, Android SDK platform/build-tools 35.0.0,
Android NDK r27d, and the Android runtime assets from ZalithLauncher2.
`android-node/scripts/build.py` builds directly with javac, aapt2, D8, the NDK,
zipalign and apksigner. It does not need Gradle.

Provide a tools directory with:

```
jdk-17/
sdk/platforms/android-35/
sdk/build-tools/35.0.0/
android-ndk-r27d/
zalith/  # Git checkout of ZalithLauncher/ZalithLauncher2
```

The initial build uses ZalithLauncher2 commit
`0cd27d8340be8b035c38c0455c6086331783b50c`, specifically
`ZalithLauncher/src/main/assets/runtimes/jre-17/{universal,bin-arm64}.tar.xz`.
The script records exact runtime and node commit IDs plus payload hashes in
`build/<ABI>/provenance.json` and embeds build information in the APK.

```
python3 android-node/scripts/build.py --tools /absolute/path/to/tools
```

For emulator validation, use `--abi x86_64`. Outputs are in
`android-node/build/<ABI>/`. The script creates a **test signing key**, not a
production release identity. Preserve `build/test-signing.keystore` privately
for updates to the test APK. Never reuse this key for a public production app.
`build/` and keys are excluded from Git.

## Installation

1. Download the ARM64 APK to the phone and open it.
2. If prompted, allow that specific browser/file manager to install this APK.
3. Open **Arkovia Node (Test)** and allow notifications.
4. Connect to Wi-Fi, preferably plug in the phone, then tap **Start node**.
5. Check that block height increases and peers connect. Zero peers or a steady
   height alone does not prove synchronization; compare against a trusted node.
6. Use **Stop node** before troubleshooting or moving files. Uninstalling or
   clearing app storage deletes the downloaded chain.
7. If startup fails, tap **Save diagnostic log** and provide the saved text.

No Google Play submission, production deployment, upstream merge, or phone
installation is performed by this source change.

## Licenses

The new UI/native launcher uses the included MIT license. The Arkovia core
and integration retain the repository's applicable Jelurida Public License.
OpenJDK and third-party JARs retain their own licenses. Node notices and
OpenJDK legal files are retained in the APK payload. Runtime binary provenance
is available through the pinned ZalithLauncher2 assets; this is not a claim
that all upstream redistribution obligations have been independently audited.
