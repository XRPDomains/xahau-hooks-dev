# Verification: 1.5.0

Date: 2026-10-26. These are package verification results, not a live deployment certification. Historical 1.1.0 evidence is retained below with its original scope.

## 1.5.0 combined framework work and test robustness

- The combined 1.4/1.5 feature work passed **68/68 Node tests, zero skips**. Package metadata identifies this combined release as 1.5.0; 1.4.0 was not published separately. See [offline framework](references/offline-framework.md) and [auto-forward](references/auto-forward.md) for commands and boundaries.
- Production contact-book WASM is 762 bytes, SHA-256 `c2afadd11f7bcecf2c7088c89bf88a4844e00f87b9460a5f86ca2257e8e8b465`, checker total 1781. Auto-forward WASM is 2209 bytes, SHA-256 `c556dd67da3a945d533563dc9e6557520ec8907c4a2848f48b4c3cd5fd2eea0c`, checker totals 11090 (hook) and 1008 (callback). Both original artifacts passed their exact import/export policies and the pinned checker through WSL.
- A disposable native standalone node verified emitted Payment success, validated `tecDST_TAG_NEEDED`, correlated callback state changes, and bounded owner retry after clearing the destination requirement. [Saved evidence](assets/auto-forward-evidence.json) identifies the binary/revision and artifact. Native expiry, native weak callback state-write faults and public-network deployment remain **NOT_RUN**; corresponding offline branches do not establish native semantics.
- Following reported VM startup timeouts, the remaining 5/10/20-second CLI subprocess ceilings were raised to 60 seconds. The two affected test files passed **8/8 tests, zero skips** after that change. Request-timeout tests, worker execution bounds and production submission logic were not changed. Package syntax/local links and whitespace checks passed.

## Independent 1.3.0 feedback relayed by the user

The user supplied an agent's report of Claude end-to-end use, 56/56 passing tests in a clean container, and independently rebuilt issuer artifacts with matching SHA-256 and guard PASS. This is user-relayed external evidence, not a second run performed by this package's author; raw evaluator logs and transaction hashes were not supplied here. The evaluator attributed earlier VM-only subprocess failures to timeouts; the robustness change above addresses that reported symptom. Independent Cursor evaluation remains **NOT_RUN**. The historical independent-evaluation row below describes the original 1.1.0 baseline only.

## Cursor feedback and Windows onboarding follow-up

The user subsequently supplied a Cursor assessment reporting successful build/test/guard use on the user's machine and identifying discovery/PowerShell onboarding friction. This is **REPORTED_PARTIAL_USE**, with no independently supplied Cursor version, transcript, commands or artifact hashes. It does not establish slash-menu discovery or a complete Cursor install/submit/readback evaluation; formal Cursor end-to-end evaluation remains **NOT_RUN**. The two inspected personal/project `.cursor/skills/xahau-hooks-dev` paths were absent at this follow-up; no Cursor installation or project rule was created by the author.

The [Windows walkthrough](references/windows-first-hook.md) documents explicit Cursor installation, scoped rule guidance and a local-only PowerShell pipeline. Package syntax/links and its pipeline evidence are checked separately from Cursor behavior. This documentation follow-up does not change signing/submission logic or broaden deployment authorization.

The walkthrough's local pipeline block was executed in Windows PowerShell against the existing installed dependencies and Ubuntu checker: lint/build/guard **PASS**, final `LOCAL_VALIDATION_ONLY`, tests and every wallet/ledger stage **NOT_RUN**. Evidence is retained locally under `build/first-hook-9b91dc4196ca401096ed89a1fcbb44f0/evidence.json`. Cursor cloning/discovery, fresh-machine prerequisite installation, funding and submission were not exercised. Package validation passed for 116 files, 140 local links and 55 JavaScript modules; skill frontmatter validation and `git diff --check` passed.

## 1.3.0 agent workflow fixes — 2026-10-26

This update responds to a second agent's reported operational issues. The seed-algorithm default and Self-Invoke restriction were reproduced against the locked Xahau library. PowerShell encoding guidance distinguishes Windows PowerShell 5.1 from newer versions; no live faucet rate/latency constant is assumed.

- **56/56 Node tests PASS, zero skips** across seven test files. Ten workflow groups add both generated seed families/address mismatch, BOM-marked UTF-16 JSON input and direct UTF-8 output, generic Invoke business-field validation, fee/network/trace rejection, journal-before-submit and unknown-outcome handling, account validation latency, cached local faucet identity/cooldown and no-repeat behavior, stopped pipeline evidence and a complete configured pipeline against a local mock ledger.
- The complete mock pipeline uses disposable test-generated keys, real offline signing and exactly two submissions **to a local WebSocket fixture**, then verifies mocked installed identity, execution and state bytes. It does not submit to a real network or read an existing user seed. The test asserts the public evidence/stdout do not contain the generated seed.
- A separate local-only owner-setting pipeline run completed lint, explicitly selected tool tests, npm compilation and pinned production guard-check through WSL Ubuntu. Artifact remained 632 bytes with SHA-256 `74a3ead81a1d305bcd4fa3832d76e8525b6a73d88841aa954d7d350d86fb6f87`; wallet/install/smoke/readback were NOT_RUN in that real-tool run. Local evidence is generated under `build/agent-workflow-local/` and is not packaged as live deployment evidence.
- Funding tests inject a fake faucet transport. No live faucet request, testnet account provisioning or testnet SetHook/Invoke was performed. Exact current reserve calculation, live provider behavior, real cooldown responses, OS credential permissions and application-specific failure recovery still require controlled project verification.
- Report CLI syntax/local links and skill metadata were validated. The source and installed skill are version 1.3.0. No versioned ZIP was rebuilt.

## Historical 1.2.0 environment and issuer updates — 2026-10-26

- **46/46 Node tests PASS, zero skips** across the six documented test files. The ten new groups cover missing/wrong dependency metadata, command failures versus timeouts, Windows npm entrypoint discovery, per-task readiness, real offline Xahau codec plans, saved receipt/readback failures, local WebSocket ledger pinning/pagination/network mismatch, CLI boundaries, and compiled issuer WASM policy branches with mocked hosts.
- `doctor --wsl Ubuntu --guard build/guard/guard_checker` ran on Windows Node 22.17.0/npm 10.9.2 and observed Ubuntu GCC 13.3.0. No packages were installed by doctor. A cold WSL probe initially timed out; diagnostics now retain TIMED_OUT separately from NOT_FOUND, and the explicit recheck observed the installed compiler. Guard file presence remains NOT_RUN for artifact validation.
- Both original cleaned issuer artifacts passed their dedicated import/export policies and the same pinned production checker/WSL route as the 1.1.0 baseline. Compiler locks/header versions are unchanged. The test-only memory-export variants were used only for mocked probes, never as production guard evidence.

| New example | Cleaned bytes | Artifact SHA-256 | Checker worst-case instructions |
|---|---:|---|---:|
| URIToken issuer mint policy | 735 | `26643349c46eff4939fc18a94b256e1ad3b6198049675708f4ec5c81f3736d10` | 949 |
| Issued TST Payment policy | 984 | `09939b7c7ddedb7fa2f72e03c8f2cfba8319a002e9a7d2d351e433708e2beba5` | 1644 |

The mocked XFL hosts exercise integer sample values and API-error branches; they do not validate the native node's decimal/XFL implementation. WebSocket tests use a local mock server, not testnet. Actual fresh-machine OS installation, Docker build/run, target-node acceptance, issuer SetHook, mint/buy/burn, trust lines, issue/transfer/redemption, stakeholder routing and emitted failure recovery remain **NOT_RUN**. No seed read, transaction signing/submission or release ZIP was performed. New package syntax/links and skill frontmatter were also validated locally.

## Included usability and source-review updates — 2026-10-25

These changes respond to a skill-using agent reporting an actual build -> guard -> install -> register -> read -> resolve workflow. That report is operational feedback relayed by the user, separate from the local regression evidence below; its live transactions have not been independently retrieved.

Verified locally on 2026-10-25, after the 1.1.0 baseline below:

- **36/36 Node tests PASS, zero skips**: existing 29 plus seven regression groups in `tests/usability.test.mjs`. Includes actual npm compilation into missing nested parents and refusal to overwrite existing output, HTTP CLI reads against a local mock RPC, URL-vs-file diagnostics, source lint findings/exit codes, variable UTF-8 state, project contract/trace validation, real offline Xahau codec and submitter rejection boundaries from an unrelated cwd.
- Native `variable-state.test.c`: **PASS** with Ubuntu GCC, strict C11 warnings, AddressSanitizer and UndefinedBehaviorSanitizer. C key and URL byte output matches the JS fixture vectors. This validates a native byte codec, not a guarded production Hook or C UTF-8 validation.
- Skill frontmatter validation: **PASS** via `quick_validate.py` in WSL Ubuntu. Package syntax and local links are checked with `node scripts/validate-package.mjs`.
- Project submitter: **offline and pre-submit rejection tests only**. No seed read, signing, live network request, transaction submission, live register/resolve or failure-recovery trial was performed. Fee/submit/poll stages still require controlled testnet verification after project adaptation.
- Source lint is a lexical heuristic with documented false positives/negatives. It does not close every source-audit obligation and is not a replacement for compiler analysis, manual review or production guard checking.
- The skill-using agent's 1112-instruction/on-chain fee observation is documented as agent-reported evidence, with the fee relationship checked against official documentation. No transaction hash was supplied for independent retrieval.

The 1.2.0 source and installed skill were synchronized at that baseline. No versioned ZIP was rebuilt.

## Historical 1.1.0 baseline — 2026-10-25

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
