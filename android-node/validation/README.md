# Validation record

- Node core: source commit 52172c5079dc85e643a566b2cbeccfa5320a7a3a.
- Host JDK: OpenJDK 17 on Linux x86_64.
- Two offline runs: initialize genesis, report height 0, stop cleanly with code 0, reopen persisted H2 database, stop cleanly again.
- ARM64 and x86_64 APK compilation, v3 signature verification, and ZIP alignment: passed.
- Android 15 emulator startup: in progress.
- Physical Moto g 5G (2024) startup and live synchronization: not tested.

These checks do not establish production readiness or guaranteed Android background uptime.
