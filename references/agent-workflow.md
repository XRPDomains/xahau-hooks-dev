# Configurable agent workflow

Use this for cached testnet setup, custom Invoke calls, encoding-safe reports or a local-to-testnet pipeline. Read [environment setup](environment-setup.md) first if runtimes/dependencies are absent. These helpers do not install an OS, provision a mainnet wallet or infer an application's protocol from its C filename.

## UTF-8 reports

All reporting CLIs in `scripts/` now accept `--out FILE`; directory generators (`init-project`, `setup-guard`) retain their existing directory `--out`. Library modules are not CLIs. File writers use explicit UTF-8 and refuse an existing report/transaction path. For example:

```sh
node scripts/inspect-artifact.mjs --wasm build/owner-setting/hook.cleaned.wasm --policy assets/owner-setting-artifact-policy.json --guard build/guard/guard_checker --out build/inspection.json
node scripts/hookon.mjs --types Invoke --out build/hookon.json
node scripts/lint-source.mjs --source assets/examples/owner-setting.c --out build/lint.json
```

Append `--wsl Ubuntu` to the checker command on native Windows. A lint finding or checker failure still writes its report where that stage supports it; exit status must also be checked. Do not interpret a produced file as success.

[Windows PowerShell 5.1 redirection](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding) can produce UTF-16LE; PowerShell 6+ text defaults and newer native-command behavior differ. Prefer direct `--out` consistently across shells. `jsonFile` also accepts UTF-8 BOM and BOM-marked UTF-16LE/BE input for older captured JSON, but new files are always UTF-8. It does not guess arbitrary legacy encodings.

## Cached testnet wallet and funding

Keep `network.json` public: `{"networkId":21338,"websocket":"wss://xahau-test.net"}`. Install the locked `assets/examples/deploy` dependencies. Choose an absolute **private** wallet cache path outside any directory you plan to share as evidence:

```sh
node assets/examples/deploy/setup-testnet-wallet.mjs --config network.json --cache /private/testnet-wallet.json --fund-testnet --faucet https://xahau-test.net/accounts --out build/wallet-public.json
```

This is an explicit faucet funding action, not a step to run while merely reviewing a project. The utility verifies configured and observed NetworkID 21338 before generating a local disposable secp256k1 wallet. It writes the cache with exclusive creation and mode 0600 where supported **before** requesting funds. It calls the [documented POST /accounts route](https://xahau.network/docs/features/faucet-and-explorer/) with `destination` equal to that cached address. It does not request `/newcreds` or trust a remote seed. Windows file mode does not replace an appropriate private ACL.

Existing seeds can be loaded by `loadWallet(seed, expectedAddress)` in `assets/examples/deploy/wallet.mjs`. The locked `xahau@4.2.0` default is ed25519. The wrapper explicitly selects ed25519 for the `sEd` family and secp256k1 for other family seeds; the library validates seed format/checksum. It then verifies the actual derived address, without `masterAddress` substitution. Not all secp256k1 seeds start with `ss`. A faucet address/seed mismatch stops before signing.

The utility reuses an existing cache, queries `account_info` at `validated`, and waits only for `actNotFound` with bounded retries. Other RPC/identity failures stop immediately. Faucet 429 or an explicit wait/error response can retry the **same cached address** up to three attempts, at most 90 seconds per cooldown and 180 seconds total, using Retry-After or a parsed wait value. A success message saying to wait for ledger closure is not a rate rejection and is not re-funded. Validation waiting is bounded separately; no fixed ledger close time is promised.

On a lost funding response the cache remains `REQUESTED`. Subsequent runs first inspect/wait for that address; they do not automatically repeat the request. Preserve the cache and inspect the address before a deliberate new funding attempt. A temporary cache lock prevents concurrent setup operations. A stale lock after a crashed process must be investigated, not automatically removed to force another request. Already validated accounts are reused without requesting more funds; depleted/reset accounts need explicit operator reconciliation. Do not run concurrent signing pipelines against the same account.

The cache contains a seed. `.gitignore` excludes the default `testnet-wallet*.json` and `*.wallet.json` patterns, but a custom filename may need its own exclusion. Never put the cache into public evidence, a commit, logs or a command argument. Public wallet reports contain address/balance/cache path only.

## Application-defined Invoke

Keep `submit-testnet.mjs` restricted to the owner-setting example and first install. Use `submit-generic-invoke.mjs` for arbitrary **unsigned Invoke business payloads** validated by the locked codec:

```sh
node assets/examples/deploy/submit-generic-invoke.mjs --config network.json --tx project-invoke.json --expected-hook-account rTarget --expected-hook-hash HEX64 --out build/invoke-review.json
```

Offline review makes no connection and reads no seed. Self-Invoke omits Destination; for a different target include a distinct Destination in the transaction. Accepted business fields are Account, NetworkID, HookParameters, Memos and Blob with optional Destination. Fee, Sequence, signatures, Payment, SetHook and raw signed blobs are refused. This is payload flexibility within one reviewed transaction type, not a universal transaction sender.

When submission is authorized, add `--submit --wallet-cache /private/testnet-wallet.json --max-fee-drops LIMIT --journal build/new-invoke-journal.json`, using a new report path if `--out` is retained. The runner checks the actual network, signer, validated sender account, expected installed HookHash, transaction-specific fee cap and bounded ledger expiry. It checks that autofill preserves reviewed business fields, journals the signed hash, and submits exactly once. Preliminary `tem`/`tel` rejection is saved as SUBMIT_REJECTED. Validation requires `tesSUCCESS` and matching HookAccount/HookHash/return code; default code is zero, configurable with `--expected-return-code HEX`.

After a status timeout/disconnection recover by journal hash. Never change the journal name to bypass an unknown outcome. Successful execution still requires project state/asset readback; this sender cannot infer an escrow or directory's business postcondition. Raw signed blobs remain outside this helper because fee, signer, expiry, network and business intent must be reviewed before a fee-bearing send.

## Pipeline: local by default

The one-command local path from the skill root is:

```sh
node scripts/agent-pipeline.mjs --source assets/examples/owner-setting.c --policy assets/owner-setting-artifact-policy.json --guard build/guard/guard_checker --wsl Ubuntu --work build/new-agent-run --testnet --run-tests --tests-file tests/tools.test.mjs
```

Omit `--wsl` on Linux. Supply a new `--work` directory. This runs source lint, the explicitly selected Node test file, compile and production guard-check, writing UTF-8 `evidence.json`, logs and inspection evidence. The sample test file tests packaged tools; replace it with your own application's tests for a source-specific correctness claim. `--run-tests` without `--tests-file` is rejected. Lint findings stop for review; this pipeline never suppresses them or weakens the checker. Individual child stages have a 60-second command timeout.

With `--setup-tools`, the pipeline runs the documented locked local npm installs and builds the pinned checker if the specified guard file is absent. It uses argument arrays, not a shell. An unavailable runtime/compiler/WSL distro or blocked download stops with evidence and the remaining stages NOT_RUN. Without this flag it uses installed tools and performs no automatic dependency installation. Use `--out new-evidence.json` to choose a separate report path; other artifacts stay in the new work directory.

## Pipeline: authorized install, smoke and readback

For the teaching owner-setting source, the JSON contract is [owner-setting-pipeline.json](../assets/owner-setting-pipeline.json). For a new Hook, review and replace all protocol-specific values: namespace, activation types (must include Invoke for this pipeline), self-Invoke payload, expected return code and exact state key/value assertions. `extraReserveDrops` is a caller-reviewed **additional reserve budget**, not a universal reserve formula; the example's 10000000 drops is illustrative and must be checked against the selected network/project.

Add these options to the local command only for an explicitly authorized testnet trial:

```sh
--submit --config network.json --contract assets/owner-setting-pipeline.json --wallet-cache /private/testnet-wallet.json --max-fee-drops LIMIT
```

The line above lists extra arguments, not a standalone shell command. If funding is also authorized, add `--fund-testnet --faucet https://xahau-test.net/accounts`. The pipeline does not accept mainnet, upgrades, chain replacement, arbitrary Payment/asset smoke operations or an unconfigured project's guessed smoke call.

After local validation it checks wallet/account readiness, exact current `server_state` reserve values in drops, current OwnerCount, two fee ceilings and the explicit additional reserve budget. It refuses insufficient balance. It performs one restricted first installation, reads the observed single installed HookHash, sends the contract's self-Invoke with a separate journal, asserts expected execution, pins state reads to a validated ledger at/after the smoke transaction, and compares every configured state key/value.

Evidence distinguishes LOCAL_VALIDATION_ONLY from VERIFIED_PROJECT_POSTCONDITIONS. The latter proves only the configured assertions for that run; it does not certify arbitrary application security or emitted workflows. Existing work/evidence/journal files are refused. On any failure inspect those records and recover by hash; there is no automatic resume/replay. Installation can succeed before smoke fails, so do not rerun in a new directory as if the account were still fresh.

## Evidence boundaries

Tests cover generated disposable seed families, mock faucet cooldown/latency, UTF encodings, single-submit/unknown outcomes and a complete install/smoke/readback pipeline against a local mock WebSocket ledger. A separate local-only run uses the real compiler and pinned production guard checker. Mock signing/ledger responses do not establish live testnet acceptance. No live faucet request or testnet deployment is needed to run these tests.
