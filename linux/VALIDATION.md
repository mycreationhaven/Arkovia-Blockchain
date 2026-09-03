# Linux full-node validation

Source baseline: `52172c5079dc85e643a566b2cbeccfa5320a7a3a`.

Environment: Linux amd64, OpenJDK 17.0.20. Tests performed September 3, 2026.

| Check | Result |
| --- | --- |
| Headless Java 17 core compile and JAR/package creation | Passed; five upstream removal/deprecation warnings, no compile errors |
| Upstream Curve25519Test and ReedSolomonTest | Passed, 5 JUnit tests |
| Shell syntax for all Linux shell scripts | Passed |
| systemd-analyze verify | Passed using the local launcher path in a temporary copy of the unit |
| Missing/invalid installer arguments, invalid ports, config injection | Rejected before installation |
| Launcher with unresolved template values | Rejected before Java startup |
| Fresh temporary mainnet database initialization | Passed; API ready in 26.1 seconds |
| Local blockchain status and full-node flag | Arkovia 1.13.1, isLightClient=false, 1 genesis block |
| Browser wallet index | Served successfully |
| Peer HTTP endpoint | Responded with expected rejection of loopback peers |
| SIGTERM shutdown | Passed with shutdown-complete log message |
| Restart against same temporary database | Passed; API ready in 4.2 seconds |
| Genesis identity across restart | Unchanged: 10203308059164672611 |

The smoke test intentionally has zero connected peers and binds both servers
to loopback. Its timings describe this test environment only. Run it again with
`python3 linux/smoke-test.py dist/arkovia-linux-full-node` after building.

Not verified: installation and systemd auto-start on a real target host,
inbound public connectivity, live peer handshake, downloading/validating live
blocks, current network height, or ongoing production operation. No live seed
peer or target server was provided. No consensus, genesis, or third-party JAR
changes were made. The existing dependency set has not been security-audited
as part of this packaging task.
