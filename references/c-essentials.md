# C essentials for Hook authors

## Pointer, array, length

```c
uint8_t key[32];          /* storage: 32 bytes */
uint8_t *p = key;         /* address, not a copy of that storage */
/* sizeof(key) is 32 here. sizeof(p) is the pointer's size. */
```

An array passed to a helper parameter becomes a pointer. A macro based on `sizeof(parameter)` does not recover the original capacity. Pass `(pointer, length)` explicitly at API boundaries. Macro shorthand is appropriate only when its argument is an actual array and its terminator semantics match the call.

For each buffer record: allocated capacity, bytes initialized, valid payload length, and whether a terminator exists. A 32-byte hash is not a C string. `strlen`/`strcmp` are wrong for arbitrary binary data and may also introduce unsupported library imports. Never read an output buffer after an API failure.

```c
/* Wrong: turns a negative error into a huge unsigned length. */
uint32_t n = state(...);
/* Correct shape: retain signed result, then validate before conversion. */
int64_t got = state(...);
if (got != EXPECTED_BYTES) { /* handle missing/error/malformed separately */ }
```

For ranges, prefer `offset <= capacity && length <= capacity - offset`. Checking only `offset + length <= capacity` can overflow before comparison. Avoid unchecked `memcpy`, unbounded scans and dynamic allocation. Even bounded libc functions must be verified against the final imports; the compiler may lower copies to a library symbol.

## Unsigned integers and endian

Use fixed-width integer types for persisted data. Reject overflow **before** arithmetic: decimal accumulation must check `value <= (MAX - digit) / 10`. Parse the entire intended field, not a numeric prefix followed by garbage. For JSON, use a bounded parser with a defined subset or a verified complete parser; a substring search for `"op"` can match nested fields or string contents.

Shift unsigned values of the intended width. For a BE 32-bit integer:

```c
uint32_t n = ((uint32_t)p[0] << 24) |
             ((uint32_t)p[1] << 16) |
             ((uint32_t)p[2] << 8) | (uint32_t)p[3];
```

Validate that four bytes exist first. Do not cast unaligned bytes to `uint32_t *` or persist a native struct: alignment, padding, aliasing and endian can change behavior. Explicit encoding gives a reviewable protocol.

Use integer drops for native currency where the protocol expects them. XFL is a different representation; do not reinterpret it as an integer amount. Match the API's exact width and return semantics.

## Encodings

An address string is not its 20-byte AccountID. Hex doubles byte length; require even input length, reject invalid digits, and check output capacity. UTF-8 byte length differs from displayed character count. Define whether text normalization is allowed and where it occurs; on-chain validation must still reject unsupported input regardless of UI normalization.

## Lifetime and resource use

Pointers to local arrays are valid only while their storage exists. Static/global WASM memory is not persistent ledger state across transactions. Store durable state with HookState, not a C variable.

Large local arrays and aggressive inlining can combine into excessive stack/memory pressure. Prefer measured bounded buffers and reuse only when lifetimes do not overlap. Removing zero-initialization is safe only if every subsequently read byte is provably initialized. Native tests with sanitizers help, but do not prove WASM-host behavior.

See [portable helpers](../assets/examples/safe-bytes.h) for bounded hex/decimal examples. Their guard adapter is mandatory when loops are used inside a production Hook.
