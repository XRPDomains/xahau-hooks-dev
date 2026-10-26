# Small examples

These are original teaching sources, not a production application. The [optional reference toolchain](../../references/toolchain-setup.md) can now build them; still verify headers and checker versions against the target network. Do not add made-up API declarations to silence incompatible headers.

| File | Purpose | Verification boundary |
|---|---|---|
| `minimal.c` | Entry guard and terminal accept | npm production build and guard-check passed; no live deployment evidence |
| `owner-setting.c` | Self-authorized Invoke, exact binary parameter, checked state write | npm production build and guard-check passed; runtime/node integration remains required |
| `safe-bytes.h` | Bounded hex/decimal parsing, BE encoding | Portable host tests; guard adapter/budgets must be integrated for production |
| `safe-bytes.test.c` | Independent boundaries, malformed input and sentinel checks | Host-native execution when a C compiler is available |
| `uritoken-issuer.c` | Issuer-originating mint URI and flag policy | npm build/production guard-check; mocked host policy tests; live install/mint NOT_RUN |
| `issued-token-issuer.c` | Outgoing TST asset identity and per-Payment XFL limit | npm build/production guard-check; mocked host policy tests; live issuance/transfer NOT_RUN |
| `variable-state.h`, `variable-state.mjs`, `variable-state.test.c` | Variable-length byte codec and key derivation | Native/JS fixture tests; not a guarded production Hook helper |

See [quickstart](../../QUICKSTART.md) for the complete testnet reference path and [optional transaction examples](deploy/README.md) for its deliberate restrictions.

For issuer examples, use the [URIToken and issued-currency walkthrough](../../references/issuer-examples.md). It includes unsigned codec-checked plans, negative cases, owner/trust-line readback and saved-evidence assertions. These do not implement emitted mint/issuance workflows or extend the beginner signers to asset transactions.

## Host helper test

```sh
clang -std=c11 -Wall -Wextra -Werror -pedantic safe-bytes.test.c -o safe-bytes-test
./safe-bytes-test
```

Optionally add `-fsanitize=address,undefined` if supported. The test defines a no-op guard adapter; it does not prove production guard placement/budgets. `XH_GUARD` must invoke the target `_g` with analyzed cumulative bounds in a real hook. This header deliberately refuses compilation unless the adapter is defined. Helpers are non-recursive and bounded; production inlining/exports remain a compiler/validator concern.

## Owner setting protocol

Trigger: Invoke from the hook account itself. Unrelated transaction types pass. Unauthorized Invokes roll back. Parameter name is UTF-8 `setting` (hex `73657474696E67`); value must be exactly eight BE bytes. State key is 31 zero bytes followed by `01`. State value is version byte `01` followed by those eight bytes. Read it using the project's actual namespace and decode using `../state-layout.example.json`.

For example, the value 42 has parameter hex `000000000000002A` and resulting state hex `01000000000000002A`. Repeated writes overwrite the same setting. Missing/short/oversized parameters, wrong sender, state write failure and non-Invoke routing require runtime tests before deployment.

The owner is defined as the hook account in this example, not as a reusable admin model. It does not change ledger asset rights. Input normalization, arbitrary profile records, transaction fees, full memo parsing and emission are intentionally outside this minimal protocol.

For emission, follow [the runtime-specific workflow](../../references/emit.md). A universal copied callback would misrepresent the verification needed, so no unverified serializer or refund implementation is included.
