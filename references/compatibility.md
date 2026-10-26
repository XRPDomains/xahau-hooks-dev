# Compatibility and authoritative sources

Documentation reviewed for this package: 2026-10-25. This date is not a promise that every published page describes every deployed node. Resolve the actual target first.

Environment bootstrap and issuer examples were checked against their linked official Node/WSL/Xahau documentation on 2026-10-26. Issuer stakeholder activation remains target-amendment dependent; the examples constrain issuer-originating transactions and do not assert universal issuer veto rights.

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

Core Node tools require Node 20+ built-ins. The HTTP reader needs network ID in `server_info`, `ledger`, and `account_namespace`; the optional WebSocket reference uses the same read contract. Optional npm compiler/header and signing dependencies are installed only by explicit setup commands, each with exact versions and a lock. No RPC server, wallet or system compiler is installed automatically.

The examples are original teaching material. Portable helper tests, measured production guard validity and live transactions remain separate evidence levels. There are no certified emit/callback snippets in this release because that would require a specific runtime contract and native integration evidence.
