# Compatibility and authoritative sources

Documentation reviewed for this package: 2026-10-25. This date is not a promise that every published page describes every deployed node. Resolve the actual target first.

## Source order

Use the project's authoritative protocol for application semantics; target network amendments and pinned node/header code for runtime behavior; compiler/cleaner/checker versions for artifact behavior; and controlled execution for observed results. Investigate disagreements instead of silently choosing a convenient source.

Primary entry points:

- [Xahau documentation](https://xahau.network/docs/)
- [Loops and guarding](https://xahau.network/docs/hooks/concepts/loops-and-guarding/)
- [Emitted transactions](https://xahau.network/docs/hooks/concepts/emitted-transactions/)
- [Hook API conventions](https://xrpl-hooks.readme.io/reference/hook-api-conventions)
- [Compiling Hooks](https://xrpl-hooks.readme.io/v2.0/docs/compiling-hooks)
- [Node hook_validate API](https://xahau.network/docs/features/http-websocket-apis/hook-validate/)
- [Xahau node source](https://github.com/Xahau/xahaud)
- [XahauWin explorer ABI skill](https://github.com/XRPLWin/xahau-hooks-abi-skill) (optional, explorer-specific; not bundled or required)

Older XRPL Hooks pages can describe an older API. Record applicable node/header versions before borrowing a signature, error constant, limit or serialization example. API additions such as transaction preparation may be amendment-dependent. Testnet and mainnet can differ.

## Per-project compatibility record

```text
network ID / endpoint / validated ledger:
node version / enabled amendments:
header repository + commit + hashes:
compiler / linker / optimizer / cleaner:
guard checker repository + commit + hash:
allowed imports / exports / bytes / resource limits:
source revision / dependency lock / final artifact SHA-256:
node validation support and evidence:
behavioral and fault-injection evidence:
```

The Node tools require Node 20+ built-ins. The network reader requires HTTP(S) JSON-RPC, network ID in `server_info`, `ledger`, and `account_namespace`; it refuses to guess when unsupported. No compiler, headers, external validator, RPC server, signing library or wallet is installed by this skill.

The examples are original teaching material. Portable helper tests are separate from production guard validity. There are no certified emit/callback snippets in this release because that would require a specific runtime contract and native integration evidence.
