# Installation and upgrade

## Prepare

Require task authorization for the particular network and action; never inherit an old project's deployment permission. Identify account, NetworkID, endpoint, signer mechanism, namespace(s), hook chain/order, activation masks and enabled amendments. Verify sufficient funds/reserve and a concrete fee budget. Public metadata and secrets belong in separate files.

Build from identified source with pinned tools. Record artifact SHA-256, size, import/export policy, checker output and relevant behavioral tests. A checker unavailable in this environment is a missing stage; do not label the artifact deployment-ready on structural validation alone. Where supported, validate against the target node as well.

Before upgrade, capture installed hook hashes/effective configuration and a validated namespace snapshot. Define how application invariants and pending operations survive the replacement. Plan forward recovery; redeploying older code is not automatically safe after new-format state writes.

## Submit and verify

Construct SetHook with the exact intended chain and namespace behavior. Replacing one hook must not accidentally erase other installations. Do not set deletion flags to achieve a routine upgrade. Review the serialized transaction, actual signer, fee and ledger expiry; submit once and retain its hash immediately.

Wait for a validated outcome. On connection failure, recover by hash before considering a new submission. On rejection, capture the full engine result and HookExecutions/validator output; stop dependent bootstrap/smoke steps. Do not vary flags, masks or artifact bytes by trial and error on a funded deployment.

Read installed configuration back from the ledger; verify effective namespaces, hashes, order and masks rather than just trusting SetHook success. Run protocol-defined bootstrap, verify state bytes at a validated ledger, then trigger the documented smoke input. Confirm the expected hook(s) actually executed and return code/string match the intended path.

## Deliver evidence

Report source revision, toolchain/checker identity, artifact digests/sizes, network/account, install/bootstrap/smoke hashes, validated ledger indices, hook traces, state-preservation comparison, retries and outstanding gates. Explorer links are conveniences, not the only evidence. Use network-configured explorer bases; do not tell a mainnet operator to use a testnet faucet.

## Restricted beginner reference

An optional [testnet reference](../assets/examples/deploy/README.md) now demonstrates first-install SetHook and the owner-setting example's self-Invoke. It is deliberately not a universal deployment client: no chain replacement, migration, arbitrary bootstrap or mainnet. Review it before use and follow [quickstart](../QUICKSTART.md). Existing applications still need a workflow appropriate to their full chain and state lifecycle.

## Project submitter template

Installation does not define an application's input protocol. Keep the restricted `submit-testnet.mjs` for its teaching setting and use [submit-project.mjs](../assets/examples/deploy/submit-project.mjs) as a separate starting point. Review [project-contract.mjs](../assets/examples/deploy/project-contract.mjs) against your C parser first. Its illustrative contract is a testnet Invoke to a distinct Destination, or to itself with Destination omitted, with exactly three UTF-8 parameters: `op=register`, `name` (1..28 lower-case ASCII letters/digits/hyphens), and `value` (HTTP(S) URL, 1..200 bytes). It does not implement or deploy that Hook, define ownership, or claim that your project's register uses these fields. For other Invoke payloads use the [generic Invoke workflow](agent-workflow.md#application-defined-invoke); do not remove restrictions from the beginner signer.

To build an unsigned sample in the skill root, set public `CALLER_ACCOUNT` and `HOOK_ACCOUNT` shell variables and run:

```sh
node --input-type=module -e 'import fs from "node:fs"; const tx={TransactionType:"Invoke",Account:process.env.CALLER_ACCOUNT,...(process.env.CALLER_ACCOUNT===process.env.HOOK_ACCOUNT?{}:{Destination:process.env.HOOK_ACCOUNT}),NetworkID:21338,HookParameters:Object.entries({op:"register",name:"abc",value:"https://example.com"}).map(([k,v])=>({HookParameter:{HookParameterName:Buffer.from(k).toString("hex"),HookParameterValue:Buffer.from(v).toString("hex")}}))}; fs.writeFileSync("build/register.unsigned.json",JSON.stringify(tx,null,2),{flag:"wx"});'
node assets/examples/deploy/submit-project.mjs --config build/network.json --tx build/register.unsigned.json --expected-hook-account "$HOOK_ACCOUNT" --expected-hook-hash "$HOOK_HASH"
```

The second command only reviews offline. `build/network.json` needs `networkId:21338` and `websocket` for submission. When a task authorizes the adapted operation, add `--submit --max-fee-drops "$MAX_FEE_DROPS" --journal build/register-journal.json`; use the same session-only seed mechanism as [quickstart](../QUICKSTART.md). No submission was performed to validate this template.

Keep the contract validator strict: transaction type, caller/destination, amounts if applicable, exact parameter names/count/length/encoding and operation authorization. Keep configured and observed NetworkID checks, signer matching, explicit fee ceiling, bounded expiry, journal creation with `wx` before submission and exactly one submit call. Never widen the existing owner-setting signer to accept every Invoke.

After validation, assert engine success and expected HookAccount/HookHash/return code. The template demonstrates code zero; adapt that expectation to your protocol. Then pin a validated state read and assert your key/value or resolver result; a successful trace can still be a no-op. For emitted operations follow child transactions and completion state separately. On unknown outcome recover using the saved hash; a new journal does not authorize replay. Project templates need controlled testnet verification after adaptation.

## Deliberate testnet removal and reset

Cleanup is a separate authorized operation. Snapshot the installation and all affected namespaces first; use a disposable testnet account and inspect the exact slot being changed. The beginner signer refuses these operations, so the JSON below is a review template for a project-specific workflow, not a command it will execute.

For removing slot zero while preserving its state, the relevant Hook entry is:

```json
{"Hook": {"CreateCode": "", "Flags": 1}}
```

`1` is the reviewed `hsfOVERRIDE` value. Empty CreateCode here means deletion, not an empty valid WASM module. For another slot, construct the preceding no-op entries and verify the target chain's limits; do not shift unrelated hooks accidentally.

A separate namespace-reset entry is:

```json
{"Hook": {"HookNamespace": "REPLACE_WITH_EXACT_HEX64", "Flags": 2}}
```

`2` is `hsfNSDELETE`; omit CreateCode/HookHash and activation/API fields for this reset form. It can remove data used by multiple hooks sharing that namespace. It does not mean “clear only this hook's records.” Do not combine it with a routine upgrade.

Current node rules can bound deletion and return `tesPARTIAL`; inspect remaining state before any subsequent authorized cleanup. Do not promise a single reset transaction removes an arbitrarily large namespace. Verify numerical constants and behavior against the target headers/source. See [SetHook operations](https://xahau.network/docs/protocol-reference/transactions/transaction-types/sethook/).
