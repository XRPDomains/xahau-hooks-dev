# Direct reads and transaction-based writes

## Read

Hooks do not expose EVM-style arbitrary readonly function calls. Read documented state/ledger objects through RPC, derive their keys, then decode the bytes according to the project's protocol. If the project defines a query transaction, distinguish its fees and execution from a read-only RPC.

The bundled `read-state.mjs` uses HTTP JSON-RPC and an explicit config. It verifies `server_info.info.network_id`, obtains a validated ledger hash, then paginates `account_namespace` at that hash. It has a per-request timeout, total page limit and repeated-marker check. It does not enumerate every namespace or discover the correct account/namespace for a project.

Equivalent illustrative request body, after obtaining a validated hash:

```json
{
  "method": "account_namespace",
  "params": [{
    "account": "PROJECT_ACCOUNT",
    "namespace_id": "PROJECT_NAMESPACE_HEX64",
    "ledger_hash": "VALIDATED_LEDGER_HEX64",
    "limit": 200
  }]
}
```

Carry a returned marker into the next page unchanged. Verify available response ledger identity, reject unexpected entry types and unknown layouts, and retain raw bytes. Use `ledger_entry` for an individual known object where supported; confirm its request fields against the target API. Absence is distinct from connection failure.

## Write

An operation is a protocol-defined transaction, not a C function name sent to RPC. Determine whether it needs `Invoke`, a funded `Payment`, an asset transaction, or another trigger. Set the routing account and direction so the intended hook executes.

Illustrative unsigned Invoke shape; replace all values and verify target definitions before serializing:

```json
{
  "TransactionType": "Invoke",
  "Account": "CALLER_ACCOUNT",
  "Destination": "HOOK_ACCOUNT",
  "HookParameters": [{
    "HookParameter": { "HookParameterName": "6F70", "HookParameterValue": "01" }
  }]
}
```

The parameter named `op` and value `01` above are demonstration bytes, not a universal Hook convention. For memos, encode MemoType/MemoData exactly once from the protocol bytes. Verify whether payment amounts are native drops or an issued amount; reject partial-payment semantics if incompatible with the operation.

Complete Sequence, fees, NetworkID and ledger expiry using an appropriate maintained Xahau transaction library or wallet in the target project. Verify the signed transaction preserves required business fields. Never concatenate a seed into a command, log it, include it in fixtures or commit it. The skill deliberately does not ship signing code.

## Outcome and recovery

Track stages separately: prepare -> sign -> submit -> validated -> hook execution -> workflow completed. A signing error is not a Hook rejection. A preliminary engine response is not a validated transaction. Fetch `tx` by hash and check `validated`, metadata TransactionResult and HookExecutions for the expected HookHash/account. Decode return strings as hex only if the encoding is valid.

Missing HookExecutions must not become success just because TransactionResult is `tesSUCCESS`. For emits, inspect children/callback and final state/asset conditions. On a timeout after signing/submission, retain the hash and reconcile first; do not blindly rebuild and repay. Reads may retry with bounds; submission retries require proof that duplication is prevented.

For performance, share one transport per session where appropriate, deduplicate concurrent identical reads and avoid reconnecting per field. Pin grouped reads to one ledger and bound cache lifetime. Measure request counts and latency before adding caching. These are call-pattern principles, not a bundled SDK.
