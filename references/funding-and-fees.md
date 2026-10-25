# Funding, fees and reserve

For an initial experiment use a fresh throwaway **Xahau testnet** account funded by the [testnet faucet](https://xahau-test.net/). The commonly used testnet WebSocket endpoint is `wss://xahau-test.net`; verify the server's reported NetworkID rather than trusting a hostname. Xahau testnet uses 21338; mainnet uses 21337. Custom networks need their own explicit identity and configuration.

Generate the wallet through a maintained local library/wallet. Keep its seed outside tracked files and out of shell history, screenshots and logs. Supplying an environment variable is a transport choice, not protection against a compromised local process. Never reuse a mainnet signer for the beginner workflow.

## Three different costs

- Transaction Fee is consumed when a transaction is applied according to its engine outcome.
- Account/owner reserve affects available balance; Hook installation and state objects can change reserve requirements.
- Hook execution and code creation influence fees; a SetHook fee can be far larger than a simple transfer's fee.

Use current node values, not a fixed fee or a fixed “XAH per hook” copied from an example. `server_state` exposes validated-ledger fee/reserve values in drops where supported; `server_info` often presents similarly named fields in native-currency units. Check the actual response schema before converting. `account_info` provides Balance and OwnerCount, but calculating the exact additional Hook/state reserve may require target-specific object rules. Do not assume the faucet grant covers every build size or record count.

### Transaction-specific fee

Query the Hook-aware `fee` RPC with the **serialized unsigned transaction** using Fee `"0"` and an empty SigningPubKey. An ordinary fee call without the transaction blob can omit creation/execution costs. Use the target node's result and enforce an explicit fee ceiling before signing. An unrecognized/invalid blob can also produce a generic fee response; syntax/field validation and target integration remain necessary.

The optional signer follows this quote flow, with no fixed fee default. It does not guarantee exact reserve sufficiency; insufficient reserve remains a transaction failure that must be reported and investigated, not silently retried.

Read [Hook fee guidance](https://xahau.network/docs/hooks/concepts/hook-fees/) and the target node's current API. Historical per-byte rates are useful context, not a substitute for the live quote.

## Mainnet policy

The beginner signing reference refuses every network except 21338, with no mainnet override. Advanced mainnet deployment is a separate reviewed project workflow. `doctor` is local diagnostics and has no network to block. Read-only state tools may inspect mainnet when the explicit NetworkID matches; blocking those reads would not protect funds and would impede auditing.
