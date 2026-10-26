# Offline WASM tests, interface codecs and guard diagnostics

These tools complement the production compiler/checker and ledger tests. They do not replace a node, infer an arbitrary C protocol, or implement a wallet/RPC SDK. Node 20+ is sufficient for the mock and generator; compiling C still requires the [optional toolchain](toolchain-setup.md).

## A complete small example

Run from the skill root. All output paths must be new:

```sh
node assets/toolchain/compile.mjs --source assets/examples/contact-book.c --out build/contact
node scripts/mock-hook.mjs --wasm build/contact/hook.cleaned.wasm --cases assets/contact-book.mock.json --out build/contact/mock.json
node scripts/generate-client.mjs --schema assets/contact-book.interface.json --out build/contact/client.mjs
node scripts/profile-guards.mjs --source assets/examples/contact-book.c --mock build/contact/mock.json --wasm build/contact/hook.cleaned.wasm --policy assets/contact-book-artifact-policy.json --guard build/guard/guard_checker --wsl Ubuntu --out build/contact/profile.json
```

Omit `--wsl Ubuntu` when invoking a native checker on Linux/macOS. The CLI records original/probe hashes, initialization/run time, cases, outcomes, state, emitted fixture blobs, guards and API call counts. Worker startup is included in `initMs`; no universal sub-100ms performance claim is made. Tests are sequential within a runtime so accepted state carries forward; rollback/trap discards the current overlay.

The contact Hook accepts owner self-Invoke only. `op=01`, `name` is 1..28 non-NUL bytes, `addr` is exactly 20 AccountID bytes. Key is ASCII `CTCT` + name + right zero padding to 32 bytes. State is `01` + AccountID. The generated client validates UTF-8; C treats name bytes as opaque, so externally submitted non-UTF-8 bytes remain possible. This example has no Unicode normalization or uniqueness policy beyond exact bytes.

## Mock fixture contract

Use `{ "initialState": { "HEX32_KEY": "HEX_VALUE" }, "cases": [...] }`. Each case has `name`, `fixture`, and optional `expect` containing exact top-level result values. See [the runnable fixture](../assets/contact-book.mock.json). Expectations use lowercase hex for state and 16 lowercase hex digits for return codes. Missing expectations still execute the case; an unhandled trap fails the CLI.

Fixture fields:

| Field | Meaning |
|---|---|
| `hookAccount`, `txId` | Hex20, hex32; missing reads report not-found |
| `type`, `generation`, `ledgerIndex` | Fixture transaction type (default Invoke=99), generation (default 0), ledger sequence |
| `fields` | Numeric SField ID -> serialized hex, e.g. `524289` Account, `524291` Destination, `393217` Amount |
| `parameters`, `hookParameters` | Arrays of `{name: HEX, value: HEX}` for transaction/install parameters |
| `entry`, `argument` | `hook` (default) or `cbak`, uint32 argument; callback reason is explicit fixture data |
| `metadata` | SField -> hex for `meta_slot`/`slot_subfield`; TransactionResult is `1048579` |
| `preparedHex`, `emittedId` | Required explicit prepare/emit adapter outputs; no native serialization, fee or emission acceptance is simulated |
| `faults` | API -> `{at: 1, code: -4}`; fail a selected call. Terminal/guard injection is refused |

Supported APIs are enumerated in [mock-worker.mjs](../assets/toolchain/mock-worker.mjs). Unknown imports fail initialization. Byte copies enforce bounds; memory is capped (default 64 pages), state is isolated and capped at 256 bytes/value, guards are counted, and execution timeout terminates the worker including infinite WASM loops. State uses one local namespace; foreign state, chains, grants, reserves, fees, signatures, XFL arithmetic and consensus are unsupported. Weak invocation is explicitly refused. Calling `cbak` checks its C branches with an accept/rollback overlay; it **does not establish native weak callback semantics**.

The worker adds a test-only memory export and caps memory in a temporary module. Both hashes are reported. Never deploy that module, feed it to the production checker, or claim the transformed hash identifies production WASM. Use trusted local test inputs: a worker timeout is a test safeguard, not a security sandbox for hostile binaries.

## Package-specific interface schema v1

[contact-book.interface.json](../assets/contact-book.interface.json) is the schema paired with the C example. It is an explicit codec contract, not a Xahau network standard or an ABI extracted from WASM. Review the C and independently test vectors when changing it.

The generator writes a standalone Node module containing `client`. Import it from any cwd without optional npm dependencies:

```js
import {client} from './client.mjs';
const tx = client.buildInvoke('set', {name: 'alice', addr: ownerAddress},
  {account: ownerAddress, networkId: 21338}); // unsigned; Self-Invoke omits Destination
const key = client.stateKey('contact', {name: 'alice'});
const decoded = client.decodeState('contact', savedStateHex);
```

Header: `schemaVersion:1`, `name`, application `version`, `operations`, `state`, optional `artifactSha256`. Operations declare `route` (`self`/`destination`), `params`, optional `discriminator:{name,valueHex}`. This subset allows at most 16 parameters including the discriminator, with values at most 256 bytes. Parameter names are UTF-8 encoded literally, not hashed. State layouts declare ordered `fields` plus a key formula.

Types: `uint8`, `uint32be`, `uint64be`, `account20`, fixed `bytes` with `bytes:N`, UTF-8 `string` with `maxBytes:N`, optional `minBytes:N` and `noNul:true`. `uint64be` input is decimal string/BigInt; output is decimal string. State strings have uint16 BE byte-length prefixes; parameter strings use the HookParameter boundary. `account20` accepts a checksummed classic address or hex20 and decodes to a classic address. A field `const` is inserted/checked (e.g. version). Unknown input fields, malformed UTF-8, oversized values, trailing/truncated state and unsupported versions fail. This subset limits state values to 256 bytes.

Keys: `fixed` hex32; `prefix-text` prefix bytes + named nonempty non-NUL UTF-8 field + right-zero padding to 32 bytes; `sha512half` hashes prefix bytes + ordered encoded fields (including string length prefixes). No implicit case folding or normalization. Binary formats must match C exactly.

`client.identity` records schema hash/version and optional production artifact binding. Set `artifactSha256` after the production build, regenerate, then call `client.assertArtifact(actualHash)` before use. Without that field the assertion refuses to claim a binding. Generated bytes still require the project's independent authorization and signer checks.

## Guard diagnostics

For readable explorer tables, use the separate [explorer ABI adapter](explorer-abi.md). It exports the supported fixed state subset, retaining explicit BE and exact key bytes, and tests projections with the pinned upstream decoder. It does not replace this schema's Invoke/state codec or convert every dynamic layout automatically.

`profile-guards.mjs` lists literal source `_g(id,budget)` calls with lines and optional maximum observed visits from mock cases. Source scanning does not expand macros or evaluate constant expressions; unresolved calls are reported. Use unique guard IDs so source/fixture correlation is unambiguous. Observations must match the supplied production WASM hash when both inputs are supplied. C/source correspondence itself requires the build manifest.

With `--wasm --policy --guard`, it runs the real checker and records its binary hash, artifact hash and total counts per reported entry, including callback when present. `--baseline profile.json` compares totals only when checker hash and entry count match; review compiler versions/entry order before interpreting deltas. There is no exact per-loop instruction attribution or automatic optimization. Low observed visits do not justify reducing a worst-case guard budget. Always rebuild and check the original final WASM after changes.

Run regression tests with `node --test tests/framework.test.mjs`; C/WASM tests report SKIP if optional compiler dependencies are absent. The portable schema/codec tests still run.
