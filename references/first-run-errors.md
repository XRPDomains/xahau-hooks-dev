# First-run errors

An engine code identifies a category, not necessarily one root cause. Retain the actual RPC response, transaction hash, validation status, artifact hash and checker output.

| Symptom | Likely checks | Safe next step |
|---|---|---|
| Cannot resolve `hooks-compiler` or `xahau` | Optional package not installed in its own directory | Run the documented `npm ci --prefix ...`; do not install a random global package |
| Docker CLI found but build fails | Daemon stopped, wrong container mode, image absent | `doctor --docker --image EXPLICIT_IMAGE`; distinguish CLI, daemon and image |
| Linux binary will not execute on Windows | Wrong execution environment | Use the documented `--wsl DISTRO` adapter or Linux shell |
| Compiler lacks a transaction constant | Header/version mismatch or typo | Inspect the target header; do not invent a numeric constant |
| `temMALFORMED` | Invalid fields, mixed masks, serialization, invalid code, flags, or another preflight failure | Inspect the exact transaction and final WASM; cleaner omission is only one possibility |
| Guard checker rejects | Missing/misplaced guard, wrong cumulative bound, unsupported structure/import/export, excessive depth | Use the full checker log and exact production artifact |
| Unexpected import/export | Library lowering, uncleaned code or helper exports | Inspect cleaned module; do not merely widen the policy |
| Insufficient funds/reserve | Fee versus available balance, new owner objects | Review current quote/reserve, fund deliberately, then decide whether a new attempt is authorized |
| `tecHOOK_REJECTED` | A hook rejected during application | Read expected HookHash/account and return code/string; identify which handler rejected |
| `tesSUCCESS` but no HookExecutions | Wrong routing, mask/direction, operation path or stakeholder assumptions | Check the installation and transaction; do not claim business success |
| `namespaceNotFound` or empty state | No state written, wrong namespace/account, reset or wrong ledger | Minimal accept has no records; use owner-setting's write before expecting data |
| Timeout after signing/submission | Outcome unknown | Read the journal hash via `tx`; do not recreate the payment blindly |
| Faucet funded an address but `actNotFound` persists | Wrong seed algorithm/derived address, or funding not validated yet | Use `loadWallet(seed, expectedAddress)`; reuse the cache and wait for validated `account_info` |
| `Invoke: Destination and Account must not be equal` | Self call encoded as an equal-address Destination | Omit Destination entirely for self-Invoke |
| JSON syntax error after PowerShell redirection | Windows PowerShell 5.1 may have written UTF-16LE | Use the reporting CLI's direct UTF-8 `--out`; BOM-marked older JSON can be read by the shared reader |
| Faucet says wait/cooldown | Explicit rate rejection | Retry the same cached address with bounded delay; an unknown funding outcome is not permission to request again |
| `tesPARTIAL` during namespace deletion | Bounded cleanup not finished | Inspect remaining state and the target's deletion rules before another authorized cleanup |

For the broader workflow see [testing and debugging](testing.md). Primary references: [compilation](https://xahau.network/docs/hooks/concepts/compiling-hooks/) and [SetHook](https://xahau.network/docs/protocol-reference/transactions/transaction-types/sethook/).
