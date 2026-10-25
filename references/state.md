# State keys, layouts and lifecycle

Define a shared schema before writing C or decoding RPC data: namespace, key preimage/domain separation, hash algorithm, fixed/variable lengths, offsets, endian, units, epoch, flags, versions, not-found and deletion semantics. Publish test vectors for key derivation and encoding. A schema alone does not prove the C implementation follows it; test encode/decode round-trips and actual state readback.

Hash inputs must have unambiguous boundaries, such as explicit lengths or fixed-width components. Record whether strings use UTF-8, normalized ASCII or another exact representation. A namespace seed is an input to a chosen derivation, not inherently interchangeable with the resulting 32-byte namespace.

## Inventory and cleanup

Hashed keys cannot generally be enumerated by recovering their preimages. If transfer/reset/burn must remove all records, maintain a bounded on-chain inventory of dynamic keys. Include custom names as well as predefined keys. Check inventory writes and capacity before accepting a record that otherwise becomes undeletable.

Validate all inputs and bounds before mutation; rely only on rollback semantics actually available in the execution phase. For weak execution or multi-transaction changes, journal enough information before the risky transition to support bounded reconciliation. Define stale primary/reverse mapping cleanup and verify ownership when resolving it.

## Read consistency and migration

Pin related reads to one validated ledger hash. Pagination markers are opaque; retain them verbatim and reject repetition. A snapshot may contain an unknown schema version: report it rather than silently decoding it as current.

For upgrade, inventory namespaces, counts and contents before replacement. Preserve a raw snapshot with ledger identity. Define old/new decoder compatibility and migration idempotency. Never use namespace deletion or overwrite the installation chain as an incidental cleanup step.

Explorer projections are optional views. Exact hashed-key selectors can describe a snapshot but do not automatically cover future keys or variable record lengths. An explorer ABI is not an EVM callable contract ABI or a substitute for protocol key/layout definitions.
