# State keys, layouts and lifecycle

Define a shared schema before writing C or decoding RPC data: namespace, key preimage/domain separation, hash algorithm, fixed/variable lengths, offsets, endian, units, epoch, flags, versions, not-found and deletion semantics. Publish test vectors for key derivation and encoding. A schema alone does not prove the C implementation follows it; test encode/decode round-trips and actual state readback.

Hash inputs must have unambiguous boundaries, such as explicit lengths or fixed-width components. Record whether strings use UTF-8, normalized ASCII or another exact representation. A namespace seed is an input to a chosen derivation, not inherently interchangeable with the resulting 32-byte namespace.

## Variable-length state example

`decode-state.mjs` deliberately expects an exact fixed layout. For strings/URLs use a protocol-specific decoder such as [variable-state.mjs](../assets/examples/variable-state.mjs): byte 0 is version `1`, bytes 1..2 are the **UTF-8 byte length** as uint16 BE, followed by exactly 1..200 payload bytes. There is no trailing NUL or padding. Reject unknown versions, truncation, trailing bytes, invalid UTF-8 and oversized values; JavaScript string length is not byte length.

From the skill root, decode a value from the actual snapshot (replace the example bytes):

```sh
node --input-type=module -e 'import {decodeText} from "./assets/examples/variable-state.mjs"; console.log(decodeText("01001368747470733a2f2f6578616d706c652e636f6d"));'
```

This decodes `https://example.com` with byte length 19. A resolver must first derive the documented key, find that key in a validated snapshot, then call this decoder on its `HookStateData`; absence and malformed data are different results. The example's key is exactly 32 bytes: ASCII `SLK1`, a 1..28 byte lower-case ASCII label, then zero padding. NULs cannot occur in labels, so labels cannot alias through padding. `labelKey('abc')` is hex `534c4b31616263` followed by 25 zero bytes. This is an illustrative un-hashed key schema, not an existing application's key formula.

[variable-state.h](../assets/examples/variable-state.h) and its [native test](../assets/examples/variable-state.test.c) exercise matching byte encoding, decoding and key derivation. The C codec treats payload as opaque bytes; callers must validate UTF-8 if their protocol requires it. It is a native test template, not production guarded Hook code. Adapt it to the project's schema and add actual state readback; no URL resolution or remote content fetch is performed.

## Inventory and cleanup

Hashed keys cannot generally be enumerated by recovering their preimages. If transfer/reset/burn must remove all records, maintain a bounded on-chain inventory of dynamic keys. Include custom names as well as predefined keys. Check inventory writes and capacity before accepting a record that otherwise becomes undeletable.

Validate all inputs and bounds before mutation; rely only on rollback semantics actually available in the execution phase. For weak execution or multi-transaction changes, journal enough information before the risky transition to support bounded reconciliation. Define stale primary/reverse mapping cleanup and verify ownership when resolving it.

## Read consistency and migration

Pin related reads to one validated ledger hash. Pagination markers are opaque; retain them verbatim and reject repetition. A snapshot may contain an unknown schema version: report it rather than silently decoding it as current.

For upgrade, inventory namespaces, counts and contents before replacement. Preserve a raw snapshot with ledger identity. Define old/new decoder compatibility and migration idempotency. Never use namespace deletion or overwrite the installation chain as an incidental cleanup step.

Explorer projections are optional views. Exact hashed-key selectors can describe a snapshot but do not automatically cover future keys or variable record lengths. An explorer ABI is not an EVM callable contract ABI or a substitute for protocol key/layout definitions.
