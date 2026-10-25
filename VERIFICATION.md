# Verification: 1.1.0

Date: 2026-10-25. These are package verification results, not a live deployment certification.

| Check | Result | Evidence/boundary |
|---|---|---|
| Skill frontmatter | PASS | Official skill-creator `quick_validate.py`, Ubuntu Python/PyYAML |
| Node behavioral tests | PASS | 29 tests across `tools.test.mjs`, `beginner-tools.test.mjs`, `optional-examples.test.mjs`; optional Xahau dependency installed |
| JavaScript syntax/local Markdown links | PASS | `node scripts/validate-package.mjs`; excludes Git and runtime/build caches |
| Decimal/hex/BE C helper tests | PASS | Ubuntu GCC 13.3.0; strict C11 warnings plus AddressSanitizer/UndefinedBehaviorSanitizer |
| Optional npm installation | PASS | `npm ci --ignore-scripts` with separate toolchain and reference signer locks |
| Minimal example compilation | PASS | 171-byte cleaned WASM; artifact SHA-256 below |
| Owner-setting example compilation | PASS | 632-byte cleaned WASM; artifact SHA-256 below |
| Production guard validation | PASS | Both examples, matching import/export policies; native Linux checker through explicit WSL adapter |
| Xahau transaction codec | PASS | Offline serialization round-trip for SetHook and example Invoke with `xahau@4.2.0` |
| Signer boundaries | PASS | Offline review does not connect; mainnet, stale evidence and missing fee caps are rejected before signing/submission |
| Docker build/run | NOT_RUN | Docker Linux daemon unavailable; Dockerfile is a separate unexecuted recipe |
| Target-node artifact validation | NOT_RUN | No assertion that the pinned checker equals every deployed node's current rules |
| Live install/write/readback | NOT_RUN | No wallet seed read, signing or transaction submission in this task |
| Callback / native weak-phase recovery | NOT_RUN | No complete emitted workflow shipped |
| Independent agent evaluation | NOT_RUN | Not performed; instructions were not behaviorally tested in Claude/Cursor |

## Reproducible artifact evidence

Compiler reference: `hooks-compiler@0.2.0`, headers from `@xahau/hooks-cli@3.0.0`, Node 22.17.0. Exact dependencies are in `assets/toolchain/package-lock.json`. Each build also records source/header hashes and compiler metadata. No force-inlining patch was applied.

Checker source: `Xahau/xahaud` revision `5c05e107c0211dcedb7adcf73dab1f6012747fe7`; input checksums in `assets/toolchain/guard-sources.json`. Built with Ubuntu GCC 13.3.0. Both commands exited zero with the explicit success marker:

| Example | Cleaned bytes | Artifact SHA-256 | Checker worst-case instructions |
|---|---:|---|---:|
| minimal | 171 | `8edda57b05db46e794d11d0843e87551f5dfe13f00715baf3bb0c6463beb3b17` | 30 |
| owner-setting | 632 | `74a3ead81a1d305bcd4fa3832d76e8525b6a73d88841aa954d7d350d86fb6f87` | 714 |

Artifact SHA-256 is not ledger HookHash. This evidence does not establish callback behavior, application failure recovery, reserve sufficiency or live acceptance by a different node revision.

## Test scope

Core tests cover exact-length binary decoding, layout overlap/gaps, uint64 precision, wrong/missing network ID, validated-ledger pagination, duplicates/malformed state, timeout/page cap, trace interpretation, artifact policy and checker evidence. Beginner tests add active-high SetHook masking, directional field constraints, unsigned first-install/setting shape, stale evidence, WSL paths, mainnet read permission and exact dependency locks. Optional tests exercise the real Xahau codec and invoke the signer only in offline/pre-submit rejection paths.

The earlier 1.0.0 baseline had 16 Node tests and native helper coverage; production example compilation was not performed then. The 1.1.0 additions close the reproducible npm build/guard gap while leaving network stages explicitly unverified. No release ZIP was rebuilt automatically.
