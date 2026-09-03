# Validation record

- Node core: source commit 52172c5079dc85e643a566b2cbeccfa5320a7a3a.
- Host JDK: OpenJDK 17 on Linux x86_64.
- Two offline runs: initialize genesis, report height 0, stop cleanly with code 0, reopen persisted H2 database, stop cleanly again.
- ARM64 and x86_64 APK compilation, v3 signature verification, and ZIP alignment: passed.
- Android 15 emulator startup: NOT VERIFIED. The software-rendered emulator without KVM did not finish booting within 420 seconds; the app was not installed or launched in it.
- Physical Moto g 5G (2024) startup and live synchronization: not tested.

These checks do not establish production readiness or guaranteed Android background uptime.

Final ARM64 APK: 60,738,485 bytes. SHA-256: `75c799e253c1e0b5ed508831ca071ea8aeffbbe574f6198af5e898896c86dca0`. ZIP CRC validation passed.
