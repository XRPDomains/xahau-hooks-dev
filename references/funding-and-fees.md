# Funding, fees and reserve

For an initial experiment use a fresh throwaway **Xahau testnet** account funded by the [testnet faucet](https://xahau-test.net/). The commonly used testnet WebSocket endpoint is `wss://xahau-test.net`; verify the server's reported NetworkID rather than trusting a hostname. Xahau testnet uses 21338; mainnet uses 21337. Custom networks need their own explicit identity and configuration.

Generate the wallet through a maintained local library/wallet. Keep its seed outside tracked files and out of shell history, screenshots and logs. Supplying an environment variable is a transport choice, not protection against a compromised local process. Never reuse a mainnet signer for the beginner workflow.

The locked `xahau@4.2.0` defaults seed derivation to ed25519. Use the bundled `loadWallet(seed, expectedAddress)` wrapper for existing seeds; it explicitly selects the encoded family (`sEd…` versus other checksum-valid family seeds), then checks the key-derived address. Do not classify all secp256k1 seeds by `ss` alone or use `masterAddress` to hide a mismatch. Both reference signers now use this wrapper.

For automation prefer a locally generated cached wallet and the documented [POST /accounts faucet](https://xahau.network/docs/features/faucet-and-explorer/) funding that address. The [wallet utility](agent-workflow.md#cached-testnet-wallet-and-funding) caches before requesting, waits for validated `account_info`, and retries only explicit rate rejection within a bounded budget. Cooldowns/ledger latency are observations, not fixed 30/60/5-second guarantees. A lost faucet response remains unknown; keep the address and poll it rather than requesting another wallet or funding blindly.

## Three different costs

- Transaction Fee is consumed when a transaction is applied according to its engine outcome.
- Account/owner reserve affects available balance; Hook installation and state objects can change reserve requirements.
- Hook execution and code creation influence fees; a SetHook fee can be far larger than a simple transfer's fee.

Use current node values, not a fixed fee or a fixed “XAH per hook” copied from an example. `server_state` exposes validated-ledger fee/reserve values in drops where supported; `server_info` often presents similarly named fields in native-currency units. Check the actual response schema before converting. `account_info` provides Balance and OwnerCount, but calculating the exact additional Hook/state reserve may require target-specific object rules. Do not assume the faucet grant covers every build size or record count.

### Transaction-specific fee

Query the Hook-aware `fee` RPC with the **serialized unsigned transaction** using Fee `"0"` and an empty SigningPubKey. An ordinary fee call without the transaction blob can omit creation/execution costs. Use the target node's result and enforce an explicit fee ceiling before signing. An unrecognized/invalid blob can also produce a generic fee response; syntax/field validation and target integration remain necessary.

The optional signer follows this quote flow, with no fixed fee default. It does not guarantee exact reserve sufficiency; insufficient reserve remains a transaction failure that must be reported and investigated, not silently retried.

Read [Hook fee guidance](https://xahau.network/docs/hooks/concepts/hook-fees/) and the target node's current API. Historical per-byte rates are useful context, not a substitute for the live quote.

## Guard budget has a fee cost

The [official Hook fee model](https://xahau.network/docs/hooks/concepts/hook-fees/) prices execution at one drop per worst-case WASM instruction. The [guard explanation](https://xahau.network/docs/hooks/concepts/loops-and-guarding/) connects bounded loops to that worst-case count. Under that model, a checker count of **1112 instructions corresponds to an execution component of 1112 drops = 0.001112 XAH**. This matches a skill-using agent's reported testnet run; this package has not independently retrieved that run's transaction evidence.

This is the checker-derived instruction count, not the literal `maxiter` supplied to one `_g` call. It is also not the total transaction Fee: base costs, other strong Hooks, callbacks/creation and target rules can change the quote. Record the node version, amendments, HookDefinition fee and transaction-specific `fee` response. Reducing worst-case work can reduce execution cost; arbitrarily increasing guard limits can increase fees as well as conceal an incorrect bound.

## Mainnet policy

The beginner signing reference refuses every network except 21338, with no mainnet override. Advanced mainnet deployment is a separate reviewed project workflow. `doctor` is local diagnostics and has no network to block. Read-only state tools may inspect mainnet when the explicit NetworkID matches; blocking those reads would not protect funds and would impede auditing.
