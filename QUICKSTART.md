# First Hook: build, install, write and read back

This is the shortest reference path for a new developer. It uses a fresh **testnet** account and the small `owner-setting.c` example so there is real state to verify. Allow extra time for dependencies, faucet funding and ledger validation; “ten minutes” is not guaranteed. No network transactions were sent when this walkthrough was packaged.

Commands below use a POSIX shell on Linux or inside Windows WSL. Prerequisites: Node.js 20+, npm, Git, `g++` (Linux/WSL checker), and an independently funded disposable testnet wallet. The npm compiler can also run on Windows/macOS; use a compatible Linux/WSL environment for this checker's verified route. See [toolchain setup](references/toolchain-setup.md).

If any prerequisite is missing, start with [environment setup](references/environment-setup.md), including the bootstrap path when Node itself is absent. Doctor reports task readiness separately: missing optional Docker/native clang does not block the npm compiler route. A timeout during a probe means unconfirmed, not necessarily uninstalled.

## 1. Get the skill and inspect the environment

Skip cloning if you already have the repository:

```sh
git clone https://github.com/XRPDomains/xahau-hooks-dev.git
cd xahau-hooks-dev
node scripts/doctor.mjs
npm ci --ignore-scripts --no-audit --no-fund --prefix assets/toolchain
npm ci --ignore-scripts --no-audit --no-fund --prefix assets/examples/deploy
mkdir -p build
```

Docker is optional for this route. [Toolchain setup](references/toolchain-setup.md) explains each component and an alternative Docker build. For a project layout, optionally run `node scripts/init-project.mjs --out /absolute/new/project --name my-hook`; its parent must exist. This walkthrough uses bundled examples directly instead of modifying that scaffold.

## 2. Compile and guard-check

```sh
node assets/toolchain/compile.mjs --source assets/examples/owner-setting.c --out build/owner-setting
node scripts/setup-guard.mjs --out build/guard
node scripts/inspect-artifact.mjs --wasm build/owner-setting/hook.cleaned.wasm --policy assets/owner-setting-artifact-policy.json --guard build/guard/guard_checker --out build/inspection.json
node -e "const fs=require('node:fs');const r=JSON.parse(fs.readFileSync('build/inspection.json','utf8'));if(r.structure!=='PASS'||r.guard.result!=='PASS')process.exit(1);console.log('Artifact and guard PASS',r.bytes,r.sha256)"
```

Stop on a nonzero exit or FAIL. The selected checker is pinned; compare its rules with your node. The output directory must be new; use another name for another build. For an even smaller compile-only example substitute `minimal.c` and its policy, but it never writes HookState and is not the rest of this walkthrough's contract.

## 3. Configure and fund the disposable wallet

Create a testnet wallet with a maintained local wallet/library, retain its seed privately, and fund its address through the [faucet](https://xahau-test.net/). Use a fresh account without installed hooks. Do not use a production account or seed. Read [funding, fees and reserve](references/funding-and-fees.md).

Alternatively follow the [cached wallet workflow](references/agent-workflow.md#cached-testnet-wallet-and-funding): it creates a local throwaway wallet, requests funding of its address only when explicitly requested, honors bounded faucet cooldown and waits for validated account existence. Reuse the cache after a timeout rather than generating another wallet. When importing an existing seed, use `loadWallet(seed, expectedAddress)` from `assets/examples/deploy/wallet.mjs`: the locked library's default is ed25519, while a secp256k1 seed needs the explicit algorithm. A secp256k1 seed need not start with `ss`; the wrapper validates its seed and derived address.

Set public values in this terminal (replace the address):

```sh
export HOOK_ACCOUNT='REPLACE_WITH_FUNDED_TESTNET_ADDRESS'
export HOOK_NAMESPACE="$(node -e "process.stdout.write(require('node:crypto').createHash('sha256').update('xahau-hooks-dev:owner-setting:v1').digest('hex').toUpperCase())")"
node -e "require('node:fs').writeFileSync('build/network.json',JSON.stringify({networkId:21338,websocket:'wss://xahau-test.net',timeoutMs:15000,maxPages:100},null,2))"
node scripts/hookon.mjs --types Invoke
```

Network values above are an explicit testnet example, not library defaults. The reader checks the server's network identity. HookOn's SetHook bit is a special case; use [the calculator](references/hookon.md).

## 4. Prepare and review unsigned SetHook

```sh
node scripts/prepare-sethook.mjs --wasm build/owner-setting/hook.cleaned.wasm --evidence build/inspection.json --account "$HOOK_ACCOUNT" --namespace "$HOOK_NAMESPACE" --types Invoke --network-id 21338 --out build/sethook.unsigned.json
node assets/examples/deploy/submit-testnet.mjs --config build/network.json --tx build/sethook.unsigned.json --evidence build/inspection.json
```

This is offline review; no seed is needed and nothing is submitted. Inspect Account, NetworkID, namespace, HookOn, code/evidence and first-install intent. The reference refuses upgrades and deletions. Actual submission is a separate explicit action.

## 5. Submit once, when authorized

For Bash, obtain the seed from a session-only hidden prompt (do not paste it into a shell command or enable shell tracing):

```sh
set +x
read -r -s -p 'Disposable testnet seed: ' XAHAU_TESTNET_SEED
printf '\n'
export XAHAU_TESTNET_SEED
```

Set a fee ceiling you have reviewed. The value below is an example ceiling of one million drops, **not a fee estimate**:

```sh
export MAX_FEE_DROPS='1000000'
node assets/examples/deploy/submit-testnet.mjs --config build/network.json --tx build/sethook.unsigned.json --evidence build/inspection.json --submit --max-fee-drops "$MAX_FEE_DROPS" --journal build/install-journal.json
```

The script verifies the signer and network, refuses an existing installation, obtains a transaction-specific fee quote, records the signed hash, and submits once. A timeout requires hash-based status recovery, not rerunning with a different journal. After validation, review the installed HookHash from the journal/readback; it is **not** the artifact SHA-256.

## 6. Write the example setting

Extract the observed installed hash, then prepare a self-Invoke that writes the BE uint64 value 42:

```sh
export HOOK_HASH="$(node -e "const j=JSON.parse(require('node:fs').readFileSync('build/install-journal.json','utf8'));const h=j.installedHooks.flatMap(o=>o.Hooks||[]).find(x=>x.Hook&&x.Hook.HookHash);if(!h)process.exit(1);process.stdout.write(h.Hook.HookHash)")"
node scripts/prepare-setting.mjs --account "$HOOK_ACCOUNT" --network-id 21338 --value-hex 000000000000002A --out build/setting.unsigned.json
node assets/examples/deploy/submit-testnet.mjs --config build/network.json --tx build/setting.unsigned.json --expected-hook-hash "$HOOK_HASH"
node assets/examples/deploy/submit-testnet.mjs --config build/network.json --tx build/setting.unsigned.json --expected-hook-hash "$HOOK_HASH" --submit --max-fee-drops "$MAX_FEE_DROPS" --journal build/setting-journal.json
unset XAHAU_TESTNET_SEED
```

The signer accepts only this example's exact setting parameter and requires the expected single installed hook. Inspect the validated engine result and HookExecutions in the setting journal. A successful transaction with no expected hook execution is a failure of this walkthrough.

## 7. Read back actual state

```sh
node assets/examples/deploy/read-state-websocket.mjs --config build/network.json --account "$HOOK_ACCOUNT" --namespace "$HOOK_NAMESPACE" --out build/state.json
node -e "const fs=require('node:fs');const s=JSON.parse(fs.readFileSync('build/state.json','utf8'));const key='0'.repeat(63)+'1';const e=s.entries.find(x=>x.HookStateKey.toLowerCase()===key);if(!e)process.exit(1);fs.writeFileSync('build/value.hex',e.HookStateData);console.log(e.HookStateData)"
node scripts/decode-state.mjs --layout assets/state-layout.example.json --hex "$(cat build/value.hex)"
```

Expected bytes: `01000000000000002A`; expected decoded fields: `version: 1`, `value: "42"`. Verify these are the actual readback, not just expected constants. The snapshot includes the pinned validated ledger hash.

For HTTP, the dependency-free reader accepts a URL with an explicit network identity:

```sh
node scripts/read-state.mjs --endpoint https://xahau-test.net --network-id 21338 --account "$HOOK_ACCOUNT" --namespace "$HOOK_NAMESPACE" --out build/state-http.json
```

Alternatively create `build/rpc.json` containing `{"endpoint":"https://xahau-test.net","networkId":21338}` and pass `--config build/rpc.json`. **`--config` is a JSON file path, not a URL.** The HTTP reader cannot consume `wss://`; use the WebSocket reader above for that transport. Endpoint availability must be checked against your selected provider.

The installed `xahau` dependency belongs to `assets/examples/deploy`. Running a bundled `.mjs` by path works from any cwd (use absolute script/config paths outside the root). For inline imports such as `node -e 'import("xahau")'`, first `cd assets/examples/deploy`. For your own project, install the dependency there; copying one script also requires updating its relative helper imports. See [module resolution](assets/examples/deploy/README.md#module-resolution).

For a custom application operation after install, start with the separate [project submitter template](references/deployment.md#project-submitter-template). For strings/URLs see [variable-length state](references/state.md#variable-length-state-example). Neither uses the owner-setting protocol automatically.

Keep the journals and hashes as evidence. For cleanup see [deliberate testnet removal/reset](references/deployment.md#deliberate-testnet-removal-and-reset); never reset state as an incidental redeploy step. For failures start with [the first-run error table](references/first-run-errors.md).
